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

const ipCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (!entry || entry.resetAt < now) {
    ipCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= 5) return true;
  entry.count++;
  return false;
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

  try {
    console.log(`[analyze] received URL: ${body.url}`);
    const detected = detectPlatform(body.url);
    console.log(`[analyze] detected platform:`, detected);

    if (!detected) {
      return NextResponse.json({ success: false, error: "URL not recognised. Paste an Amazon, G2, or Trustpilot URL." }, { status: 422 });
    }

    console.log(`[analyze] starting scrape for ${detected.platform}...`);
    const scrape = await scrapeReviews(detected);
    console.log(`[analyze] scrape result:`, scrape.reviews.length, "reviews, error:", scrape.error ?? "none");

    if (scrape.error && scrape.reviews.length === 0) {
      return NextResponse.json({ success: false, error: scrape.error }, { status: 502 });
    }

    if (scrape.reviews.length < 2) {
      return NextResponse.json({ success: false, error: `Only ${scrape.reviews.length} reviews found — need at least 2.` }, { status: 422 });
    }

    const analysis = await analyzeReviews(scrape);

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
    const msg = process.env.NODE_ENV === "development" ? err.message : "Analysis failed. Please try again.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}