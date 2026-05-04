import { NextRequest, NextResponse } from "next/server";
import { detectPlatform, scrapeReviews } from "@/lib/scrapers";
import { analyzeReviews } from "@/lib/claude";
import { saveReport } from "@/lib/supabase";
import { z } from "zod";
import type { AnalysisReport, AnalyzeResponse } from "@/types";
import { randomUUID } from "crypto";

const BodySchema = z.object({
  url: z.string().url("Please enter a valid URL"),
});

// ─── Simple IP-based rate limiting (no Redis needed) ─────────────────────────
// For production, swap with Upstash Redis rate limiter (free tier available)

const ipCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipCounts.get(ip);

  if (!entry || entry.resetAt < now) {
    ipCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }

  if (entry.count >= 5) return true; // 5 requests per minute
  entry.count++;
  return false;
}

// ─── POST /api/analyze ────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<AnalyzeResponse>> {
  // Rate limit by IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0] ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Slow down." },
      { status: 429 }
    );
  }

  // Validate body
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.errors?.[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  // Detect platform
  console.log(`[Analyze] Received URL: ${body.url}`);
  const detected = detectPlatform(body.url);
  if (!detected) {
    console.log(`[Analyze] ❌ Platform not detected for URL: ${body.url}`);
    return NextResponse.json(
      {
        success: false,
        error:
          "URL not recognised. Paste an Amazon product, G2 product, or Trustpilot company URL.",
      },
      { status: 422 }
    );
  }
  console.log(`[Analyze] ✅ Detected platform: ${detected.platform}, identifier: ${detected.identifier}`);

  // Scrape reviews
  console.log(`[Analyze] Starting scrape...`);
  const scrapeStart = Date.now();
  const scrape = await scrapeReviews(detected);
  console.log(`[Analyze] Scrape completed in ${Date.now() - scrapeStart}ms`);
  console.log(`[Analyze] Reviews found: ${scrape.reviews.length}, error: ${scrape.error || 'none'}`);

  if (scrape.error && scrape.reviews.length === 0) {
    console.log(`[Analyze] ❌ Scrape failed with error: ${scrape.error}`);
    return NextResponse.json(
      { success: false, error: scrape.error },
      { status: 502 }
    );
  }

  if (scrape.reviews.length < 3) {
    console.log(`[Analyze] ❌ Only ${scrape.reviews.length} reviews — not enough (need 3+)`);
    return NextResponse.json(
      {
        success: false,
        error: `Only ${scrape.reviews.length} reviews found — not enough to analyse.`,
      },
      { status: 422 }
    );
  }

  // Analyse with Claude
  let analysis;
  try {
    analysis = await analyzeReviews(scrape);
  } catch (err: any) {
    console.error("[Claude]", err);
    return NextResponse.json(
      { success: false, error: "AI analysis failed. Please try again." },
      { status: 500 }
    );
  }

  // Build full report
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

  // Persist to Supabase (best-effort — don't fail if DB is down)
  try {
    const { getServerClient } = await import("@/utils/supabase/server");
    const supabase = getServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    await saveReport({
      id: report.id,
      user_id: session?.user?.id ?? null,
      url: body.url,
      platform: report.platform,
      product_name: report.productName,
      report_json: report,
      is_public: true,
    });
  } catch (err) {
    console.error("[Supabase save]", err);
  }

  return NextResponse.json({ success: true, report });
}
