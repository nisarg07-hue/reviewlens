import type { AnalysisReport, ScrapeResult, ComparisonReport } from "@/types";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

// ─── System prompt ────────────────────────────────────────────────────────────

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

// ─── Build the analysis prompt ────────────────────────────────────────────────

function buildPrompt(scrape: ScrapeResult): string {
  // Truncate to ~80 reviews to stay within token limits
  const reviews = scrape.reviews.slice(0, 80);

  const reviewText = reviews
    .map(
      (r, i) =>
        `[${i + 1}] ★${r.rating} | ${r.title ?? ""}\n${r.body.slice(0, 400)}`
    )
    .join("\n\n");

  return `Analyze these ${reviews.length} customer reviews for "${scrape.productName}" on ${scrape.platform}.
Overall rating: ${scrape.averageRating}/5 from ${scrape.totalReviews} total reviews.

REVIEWS:
${reviewText}

Return this exact JSON structure:
{
  "overallSummary": "2-3 sentence executive summary",
  "toneSignal": "very positive | mixed positive | neutral | mixed negative | very negative",
  "sentiment": {
    "positive": 65,
    "neutral": 15,
    "negative": 20,
    "starDistribution": { "1": 5, "2": 3, "3": 8, "4": 20, "5": 64 }
  },
  "painPoints": [
    {
      "theme": "Short theme name",
      "description": "What customers are complaining about",
      "frequency": "common",
      "severity": "moderate",
      "exampleQuotes": ["quote 1 under 100 chars", "quote 2 under 100 chars"]
    }
  ],
  "praises": [
    {
      "theme": "Short theme name",
      "description": "What customers love",
      "frequency": "very common",
      "exampleQuotes": ["quote 1 under 100 chars", "quote 2 under 100 chars"]
    }
  ],
  "improvements": [
    {
      "priority": "high",
      "title": "Short improvement title",
      "rationale": "Why this matters based on reviews",
      "estimatedImpact": "Expected outcome if fixed"
    }
  ],
  "competitorGap": "Any mention of competitors or switching from/to — or null"
}

Return at most 5 pain points, 5 praises, and 4 improvements. Return ONLY the JSON object.`;
}

// ─── Call Claude API ──────────────────────────────────────────────────────────

export async function analyzeReviews(
  scrape: ScrapeResult
): Promise<Omit<AnalysisReport, "id" | "createdAt" | "productName" | "productUrl" | "platform" | "totalReviewsAnalyzed" | "averageRating">> {
  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(scrape) }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const rawText: string = data.content[0]?.text ?? "{}";

  // Strip accidental markdown fences
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse Claude response: ${cleaned.slice(0, 200)}`);
  }
}

// ─── Compare two products ──────────────────────────────────────────────────────

const COMPARE_SYSTEM_PROMPT = `You are ReviewLens, an expert product intelligence analyst.
You receive raw customer reviews for TWO competing products and return a structured JSON comparison.

RULES:
- Output ONLY valid JSON — no markdown, no preamble
- Be brutally honest about strengths and weaknesses
- Keep all strings under 200 chars
- Return exactly the JSON schema below, no extra keys`;

export async function analyzeComparison(
  scrapeA: ScrapeResult,
  scrapeB: ScrapeResult
): Promise<Omit<ComparisonReport, "id" | "createdAt" | "productA" | "productB">> {
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
  "featureComparison": [
    {
      "feature": "Feature name (e.g. Usability, Support, Performance)",
      "winner": "Product B",
      "rationale": "Short rationale"
    }
  ]
}

Return ONLY the JSON object. "winner" must be "Product A", "Product B", or "Tie". "featureComparison.winner" must be "Product A", "Product B", or "Tie".`;

  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: COMPARE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const rawText: string = data.content[0]?.text ?? "{}";
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      executiveSummary: parsed.executiveSummary,
      winner: parsed.winner,
      winRationale: parsed.winRationale,
      featureComparison: parsed.featureComparison,
      // Temporarily stash these so the API route can attach them to the full objects
      // Note: this is a slight hack but avoids needing to redefine the full interface shape here
      ...parsed
    };
  } catch {
    throw new Error(`Failed to parse Claude response: ${cleaned.slice(0, 200)}`);
  }
}

