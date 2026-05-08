import type { AnalysisReport, ScrapeResult, ComparisonReport } from "@/types";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? "";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent";

const SYSTEM_PROMPT = `You are ReviewLens, an expert product intelligence analyst.
You receive raw customer reviews and return a structured JSON analysis.

RULES:
- Output ONLY valid JSON — no markdown, no preamble, no explanation
- Be brutally honest — don't soften bad findings
- Quote actual review text (shortened) as evidence
- Frequency: "very common" = 30%+ reviews mention it, "common" = 10-30%, "occasional" = <10%
- Severity: "critical" = affects core value, "moderate" = significant friction, "minor" = polish issue
- Keep all strings under 200 chars
- Return exactly the JSON schema below, no extra keys`;

function buildPrompt(scrape: ScrapeResult): string {
  const reviews = scrape.reviews.slice(0, 80);
  const reviewText = reviews
    .map((r, i) => `[${i + 1}] ★${r.rating} | ${r.title ?? ""}\n${r.body.slice(0, 400)}`)
    .join("\n\n");

  return `Analyze these ${reviews.length} customer reviews for "${scrape.productName}" on ${scrape.platform}.
Overall rating: ${scrape.averageRating}/5 from ${scrape.totalReviews} total reviews.

REVIEWS:
${reviewText}

Return this exact JSON structure:
{
  "overallSummary": "2-3 sentence executive summary",
  "toneSignal": "very positive | mixed positive | neutral | mixed negative | very negative",
  "sentiment": { "positive": 65, "neutral": 15, "negative": 20, "starDistribution": { "1": 5, "2": 3, "3": 8, "4": 20, "5": 64 } },
  "painPoints": [{ "theme": "Short theme name", "description": "What customers are complaining about", "frequency": "common", "severity": "moderate", "exampleQuotes": ["quote 1", "quote 2"] }],
  "praises": [{ "theme": "Short theme name", "description": "What customers love", "frequency": "very common", "exampleQuotes": ["quote 1", "quote 2"] }],
  "improvements": [{ "priority": "high", "title": "Short improvement title", "rationale": "Why this matters", "estimatedImpact": "Expected outcome" }],
  "competitorGap": "Any competitor mentions or null"
}

Return at most 5 pain points, 5 praises, and 4 improvements. Return ONLY the JSON object.`;
}

export async function analyzeReviews(
  scrape: ScrapeResult
): Promise<Omit<AnalysisReport, "id" | "createdAt" | "productName" | "productUrl" | "platform" | "totalReviewsAnalyzed" | "averageRating">> {
  if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY not configured");
  }

  const prompt = buildPrompt(scrape);
  const url = `${GEMINI_ENDPOINT}?key=${GOOGLE_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        stopSequences: []
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Gemini error: ${data.error.message}`);
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[Gemini] raw response:", JSON.stringify(data).slice(0, 500));
  }

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse Gemini response: ${cleaned.slice(0, 200)}`);
  }
}

const COMPARE_SYSTEM_PROMPT = `You are ReviewLens, an expert product intelligence analyst.
You receive raw customer reviews for TWO competing products and return a structured JSON comparison.

RULES:
- Output ONLY valid JSON — no markdown, no preamble
- Be brutally honest about strengths and weaknesses
- Keep all strings under 200 chars`;

export async function analyzeComparison(
  scrapeA: ScrapeResult,
  scrapeB: ScrapeResult
): Promise<Omit<ComparisonReport, "id" | "createdAt" | "productA" | "productB">> {
  if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY not configured");
  }

  const reviewsA = scrapeA.reviews.slice(0, 50).map(r => `[A] ★${r.rating} | ${r.body.slice(0, 300)}`).join("\n\n");
  const reviewsB = scrapeB.reviews.slice(0, 50).map(r => `[B] ★${r.rating} | ${r.body.slice(0, 300)}`).join("\n\n");

  const prompt = `Analyze these customer reviews for Product A ("${scrapeA.productName}") vs Product B ("${scrapeB.productName}").

PRODUCT A REVIEWS:
${reviewsA}

PRODUCT B REVIEWS:
${reviewsB}

Return this exact JSON structure:
{
  "executiveSummary": "2-3 sentence overall comparison",
  "productA_strengths": ["strength 1", "strength 2", "strength 3"],
  "productA_weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "productB_strengths": ["strength 1", "strength 2", "strength 3"],
  "productB_weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "winner": "Product A",
  "winRationale": "Why Product A wins based on reviews",
  "featureComparison": [{ "feature": "Feature name", "winner": "Product B", "rationale": "Short rationale" }]
}

Return ONLY the JSON object. "winner" must be "Product A", "Product B", or "Tie".`;

  const url = `${GEMINI_ENDPOINT}?key=${GOOGLE_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Gemini error: ${data.error.message}`);
  }

  const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      executiveSummary: parsed.executiveSummary,
      winner: parsed.winner,
      winRationale: parsed.winRationale,
      featureComparison: parsed.featureComparison,
      ...parsed
    };
  } catch {
    throw new Error(`Failed to parse Gemini response: ${cleaned.slice(0, 200)}`);
  }
}