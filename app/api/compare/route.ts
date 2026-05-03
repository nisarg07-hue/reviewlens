import { NextRequest, NextResponse } from "next/server";
import { detectPlatform, scrapeReviews } from "@/lib/scrapers";
import { analyzeComparison } from "@/lib/claude";
import { getServerClient } from "@/utils/supabase/server";
import { z } from "zod";
import type { ComparisonReport, CompareResponse } from "@/types";
import { randomUUID } from "crypto";

const BodySchema = z.object({
  urlA: z.string().url("Please enter a valid URL for Product A"),
  urlB: z.string().url("Please enter a valid URL for Product B"),
});

export async function POST(req: NextRequest): Promise<NextResponse<CompareResponse>> {
  // 1. Authenticate and check plan
  const supabase = getServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized. Please log in." }, { status: 401 });
  }

  const { data: userData } = await supabase.from("users").select("plan").eq("id", session.user.id).single();
  if (!userData || userData.plan === "free") {
    return NextResponse.json({ success: false, error: "Comparison requires a Pro or Agency plan." }, { status: 403 });
  }

  // 2. Validate input
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.errors?.[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const detectedA = detectPlatform(body.urlA);
  const detectedB = detectPlatform(body.urlB);

  if (!detectedA || !detectedB) {
    return NextResponse.json({ success: false, error: "One or both URLs are not recognized." }, { status: 422 });
  }

  // 3. Parallel scrape
  const [scrapeA, scrapeB] = await Promise.all([
    scrapeReviews(detectedA),
    scrapeReviews(detectedB)
  ]);

  if ((scrapeA.error && scrapeA.reviews.length === 0) || (scrapeB.error && scrapeB.reviews.length === 0)) {
    return NextResponse.json({ success: false, error: "Failed to scrape one or both products." }, { status: 502 });
  }

  // 4. Analyze comparison with Claude
  let analysis;
  try {
    analysis = await analyzeComparison(scrapeA, scrapeB);
  } catch (err: any) {
    console.error("[Claude Comparison]", err);
    return NextResponse.json({ success: false, error: "AI comparison failed." }, { status: 500 });
  }

  // 5. Build full report
  const rawAnalysis = analysis as any;
  const report: ComparisonReport = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    executiveSummary: analysis.executiveSummary,
    winner: analysis.winner,
    winRationale: analysis.winRationale,
    featureComparison: analysis.featureComparison,
    productA: {
      name: scrapeA.productName,
      url: scrapeA.productUrl,
      platform: scrapeA.platform,
      averageRating: scrapeA.averageRating,
      totalReviewsAnalyzed: scrapeA.reviews.length,
      strengths: rawAnalysis.productA_strengths ?? [],
      weaknesses: rawAnalysis.productA_weaknesses ?? [],
    },
    productB: {
      name: scrapeB.productName,
      url: scrapeB.productUrl,
      platform: scrapeB.platform,
      averageRating: scrapeB.averageRating,
      totalReviewsAnalyzed: scrapeB.reviews.length,
      strengths: rawAnalysis.productB_strengths ?? [],
      weaknesses: rawAnalysis.productB_weaknesses ?? [],
    }
  };

  return NextResponse.json({ success: true, report });
}
