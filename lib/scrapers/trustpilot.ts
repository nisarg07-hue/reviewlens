import type { ScrapeResult, RawReview } from "@/types";

// Trustpilot Business Units API — free, no auth needed for public data
const TP_API = "https://api.trustpilot.com/v1";
const API_KEY = process.env.TRUSTPILOT_API_KEY ?? "";

interface TrustpilotUnit {
  id: string;
  displayName: string;
  numberOfReviews: { total: number };
  score: { trustScore: number; stars: number };
  websiteUrl: string;
}

interface TrustpilotReviewsResponse {
  reviews: Array<{
    id: string;
    stars: number;
    title: string;
    text: string;
    createdAt: string;
    consumer: { displayName: string };
    isVerified: boolean;
  }>;
  numberOfReviews: { total: number };
}

export async function scrapeTrustpilot(
  businessDomain: string
): Promise<ScrapeResult> {
  const defaultResult: ScrapeResult = {
    platform: "trustpilot",
    productName: businessDomain,
    productUrl: `https://www.trustpilot.com/review/${businessDomain}`,
    totalReviews: 0,
    averageRating: 0,
    reviews: [],
  };

  try {
    // Step 1 — find the business unit ID
    const searchRes = await fetch(
      `${TP_API}/business-units/find?name=${encodeURIComponent(businessDomain)}`,
      {
        headers: { apikey: API_KEY },
        next: { revalidate: 3600 },
      }
    );

    if (!searchRes.ok) {
      // Fallback: scrape the public page with cheerio when API key missing
      return scrapeTrustpilotPublic(businessDomain);
    }

    const unit: TrustpilotUnit = await searchRes.json();

    // Step 2 — fetch reviews (most recent 100)
    const reviewsRes = await fetch(
      `${TP_API}/business-units/${unit.id}/reviews?perPage=100&orderBy=createdat.desc&stars=1,2,3,4,5`,
      {
        headers: { apikey: API_KEY },
        next: { revalidate: 3600 },
      }
    );

    const data: TrustpilotReviewsResponse = await reviewsRes.json();

    const reviews: RawReview[] = data.reviews.map((r) => ({
      id: r.id,
      rating: r.stars,
      title: r.title,
      body: r.text,
      date: r.createdAt,
      author: r.consumer.displayName,
      verified: r.isVerified,
    }));

    return {
      platform: "trustpilot",
      productName: unit.displayName,
      productUrl: `https://www.trustpilot.com/review/${businessDomain}`,
      totalReviews: unit.numberOfReviews.total,
      averageRating: unit.score.stars,
      reviews,
    };
  } catch (err) {
    console.error("[Trustpilot]", err);
    return { ...defaultResult, error: "Failed to fetch Trustpilot reviews." };
  }
}

// ─── Public page scraper (fallback when no API key) ───────────────────────────

async function scrapeTrustpilotPublic(
  businessDomain: string
): Promise<ScrapeResult> {
  const { load } = await import("cheerio");
  const url = `https://www.trustpilot.com/review/${businessDomain}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
      Accept: "text/html",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    return {
      platform: "trustpilot",
      productName: businessDomain,
      productUrl: url,
      totalReviews: 0,
      averageRating: 0,
      reviews: [],
      error: "Could not access Trustpilot. Add TRUSTPILOT_API_KEY to .env.",
    };
  }

  const html = await res.text();
  const $ = load(html);

  const reviews: RawReview[] = [];
  let idx = 0;

  $("article[data-service-review-rating]").each((_, el) => {
    const rating = parseInt(
      $(el).attr("data-service-review-rating") ?? "3",
      10
    );
    const title = $(el).find("[data-service-review-title-typography]").text().trim();
    const body = $(el).find("[data-service-review-text-typography]").text().trim();
    const date =
      $(el).find("time").attr("datetime") ?? new Date().toISOString();
    const author = $(el)
      .find("[data-consumer-name-typography]")
      .text()
      .trim();

    if (body) {
      reviews.push({
        id: `tp-${idx++}`,
        rating,
        title,
        body,
        date,
        author,
      });
    }
  });

  // Parse overall rating from JSON-LD
  let averageRating = 0;
  let totalReviews = 0;
  let productName = businessDomain;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() ?? "{}");
      if (json.aggregateRating) {
        averageRating = parseFloat(json.aggregateRating.ratingValue ?? "0");
        totalReviews = parseInt(json.aggregateRating.reviewCount ?? "0", 10);
      }
      if (json.name) productName = json.name;
    } catch {}
  });

  return {
    platform: "trustpilot",
    productName,
    productUrl: url,
    totalReviews,
    averageRating,
    reviews,
  };
}
