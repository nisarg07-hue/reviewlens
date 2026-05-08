import { NextRequest, NextResponse } from "next/server";
export const maxDuration = 60;
import { detectPlatform, scrapeReviews } from "@/lib/scrapers";
import { analyzeReviews } from "@/lib/claude";
import { saveReport } from "@/lib/supabase";
import { z } from "zod";
import type { AnalysisReport, AnalyzeResponse } from "@/types";
import { randomUUID } from "crypto";

const BodySchema = z.object({
  url: z.string().url("Please enter a valid URL"),
});

const ipCounts = new Map<string, { count: number; resetAt: number }>();
const FREE_LIMIT = 3;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (!entry || entry.resetAt < now) {
    ipCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= 10) return true; // Increased from 5 to 10
  entry.count++;
  return false;
}

async function checkQuota(session: any, ip: string): Promise<{ allowed: boolean; reason?: string; upgradeUrl?: string }> {
  // Pro/agency users have unlimited
  if (session?.user) {
    const { getServerClient } = await import("@/utils/supabase/server");
    const supabase = getServerClient();
    const { data: userData } = await supabase
      .from("users")
      .select("plan")
      .eq("id", session.user.id)
      .single();
    
    if (userData?.plan === "pro" || userData?.plan === "agency") {
      return { allowed: true };
    }
  }

  // Check client-side usage count as fallback
  const usageKey = `reviewlens_usage_${ip}`;
  const usageCount = parseInt(process.env[usageKey] || "0", 10);

  if (usageCount >= FREE_LIMIT) {
    return { 
      allowed: false, 
      reason: "Free limit reached",
      upgradeUrl: "/?paywall=true"
    };
  }

  return { allowed: true };
}

export async function POST(req: NextRequest): Promise<NextResponse<AnalyzeResponse>> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ success: false, error: "Too many requests. Slow down." }, { status: 429 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.errors?.[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  // Check quota before processing
  try {
    const { getServerClient } = await import("@/utils/supabase/server");
    const supabase = getServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    const quota = await checkQuota(session, ip);
    if (!quota.allowed) {
      return NextResponse.json({ 
        success: false, 
        error: quota.reason,
        quotaReached: true 
      }, { status: 403 });
    }
  } catch (err) {
    // Allow through if DB check fails - rely on client-side check
    console.log("[analyze] DB quota check skipped:", err);
  }

  try {
    console.log(`[analyze] received URL: ${body.url}`);
    console.log(`[analyze] env check: GOOGLE_API_KEY=${!!process.env.GOOGLE_API_KEY}, RAPIDAPI_KEY=${!!process.env.RAPIDAPI_KEY}, SCRAPINGBEE_KEY=${!!process.env.SCRAPINGBEE_KEY}`);
    
    const detected = detectPlatform(body.url);
    console.log(`[analyze] detected platform:`, detected);

    if (!detected) {
      return NextResponse.json({ success: false, error: "URL not recognised. Paste an Amazon, G2, or Trustpilot URL." }, { status: 422 });
    }

    console.log(`[analyze] starting scrape for ${detected.platform}...`);
    const scrape = await scrapeReviews(detected);
    console.log(`[analyze] scrape result: ${scrape.reviews.length} reviews, error: ${scrape.error ?? "none"}`);

    if (scrape.error && scrape.reviews.length === 0) {
      const errMsg = scrape.error.includes("RAPIDAPI_KEY") || scrape.error.includes("SCRAPINGBEE_KEY")
        ? "Scraping service not configured. Add RAPIDAPI_KEY and SCRAPINGBEE_KEY in Vercel env vars."
        : scrape.error;
      return NextResponse.json({ success: false, error: errMsg }, { status: 502 });
    }

    if (scrape.reviews.length < 2) {
      return NextResponse.json({ success: false, error: `Only ${scrape.reviews.length} reviews found — need at least 2.` }, { status: 422 });
    }

    console.log(`[analyze] calling AI...`);
    const analysis = await analyzeReviews(scrape);
    console.log(`[analyze] AI analysis complete`);

    const report: AnalysisReport = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      productName: scrape.productName,
      productUrl: scrape.productUrl,
      platform: scrape.platform,
      totalReviewsAnalyzed: scrape.reviews.length,
      averageRating: scrape.averageRating,
      ...analysis,
    };

    try {
      const { getServerClient } = await import("@/utils/supabase/server");
      const supabase = getServerClient();
      const { data: { session } } = await supabase.auth.getSession();
      await saveReport({ id: report.id, user_id: session?.user?.id ?? null, url: body.url, platform: report.platform, product_name: report.productName, report_json: report, is_public: true });
    } catch (err) {
      console.error("[Supabase save]", err);
    }

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    console.error("[analyze] error:", err);
    let errorMsg = "Analysis failed. Please try again.";
    
    // Provide helpful error messages
    if (err.message?.includes("not configured") || err.message?.includes("API key")) {
      errorMsg = "AI service not configured. Add GOOGLE_API_KEY in Vercel env vars.";
    } else if (process.env.NODE_ENV === "development") {
      errorMsg = err.message;
    }
    
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}