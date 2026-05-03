import type { ScrapeResult, RawReview } from "@/types";

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? "";
const RAPIDAPI_HOST = "real-time-amazon-data.p.rapidapi.com";

interface RapidApiReview {
  review_id: string;
  review_title: string;
  review_comment: string;
  review_star_rating: string;
  review_date: string;
  review_author: string;
  is_verified_purchase: boolean;
}

interface RapidApiResponse {
  data: {
    product_title: string;
    product_star_rating: string;
    product_num_ratings: number;
    reviews: RapidApiReview[];
  };
}

export async function scrapeAmazon(asin: string): Promise<ScrapeResult> {
  const defaultResult: ScrapeResult = {
    platform: "amazon",
    productName: `Amazon product (${asin})`,
    productUrl: `https://www.amazon.com/dp/${asin}`,
    totalReviews: 0,
    averageRating: 0,
    reviews: [],
  };

  // ── Try RapidAPI first (500 free calls/month) ──────────────────────────────
  if (RAPIDAPI_KEY) {
    try {
      const res = await fetch(
        `https://${RAPIDAPI_HOST}/product-reviews?asin=${asin}&country=US&sort_by=TOP_REVIEWS&star_rating=ALL&verified_purchases_only=false&filter_by_keyword=&page=1`,
        {
          headers: {
            "x-rapidapi-key": RAPIDAPI_KEY,
            "x-rapidapi-host": RAPIDAPI_HOST,
          },
          next: { revalidate: 3600 },
        }
      );

      if (res.ok) {
        const json: RapidApiResponse = await res.json();
        const d = json.data;

        const reviews: RawReview[] = (d.reviews ?? []).map((r) => ({
          id: r.review_id,
          rating: parseInt(r.review_star_rating, 10),
          title: r.review_title,
          body: r.review_comment,
          date: r.review_date,
          author: r.review_author,
          verified: r.is_verified_purchase,
        }));

        return {
          platform: "amazon",
          productName: d.product_title,
          productUrl: `https://www.amazon.com/dp/${asin}`,
          totalReviews: d.product_num_ratings,
          averageRating: parseFloat(d.product_star_rating),
          reviews,
        };
      }
    } catch (err) {
      console.error("[Amazon RapidAPI]", err);
    }
  }

  // ── Fallback: scrape Amazon reviews page with Cheerio ─────────────────────
  // NOTE: Amazon actively blocks scrapers. Use ScrapingBee as proxy in prod:
  // https://app.scrapingbee.com — 1000 free credits
  try {
    const targetUrl = `https://www.amazon.com/product-reviews/${asin}?sortBy=recent&pageNumber=1`;
    const fetchUrl = process.env.SCRAPINGBEE_KEY
      ? `https://app.scrapingbee.com/api/v1/?api_key=${process.env.SCRAPINGBEE_KEY}&url=${encodeURIComponent(targetUrl)}&render_js=false`
      : targetUrl;

    const res = await fetch(fetchUrl, {
      headers: !process.env.SCRAPINGBEE_KEY
        ? {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
          }
        : {},
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { load } = await import("cheerio");
    const html = await res.text();
    const $ = load(html);

    const reviews: RawReview[] = [];
    let idx = 0;

    $('[data-hook="review"]').each((_, el) => {
      const ratingText = $(el)
        .find('[data-hook="review-star-rating"] .a-icon-alt')
        .text();
      const rating = parseFloat(ratingText.split(" ")[0]) || 3;
      const title = $(el).find('[data-hook="review-title"]').text().trim().replace(/^\d\.\d out of 5 stars\n/, "");
      const body = $(el).find('[data-hook="review-body"]').text().trim();
      const date = $(el).find('[data-hook="review-date"]').text().trim();
      const author = $(el).find(".a-profile-name").text().trim();
      const verified = $(el).find('[data-hook="avp-badge"]').length > 0;

      if (body) {
        reviews.push({
          id: `amz-${idx++}`,
          rating,
          title,
          body,
          date,
          author,
          verified,
        });
      }
    });

    // Product name from title
    const productName =
      $('[data-hook="product-link"]').text().trim() ||
      $(".product-title").text().trim() ||
      `Amazon product (${asin})`;

    const avgRatingText = $('[data-hook="rating-out-of-text"]').text();
    const averageRating = parseFloat(avgRatingText.split(" ")[0]) || 0;

    return {
      platform: "amazon",
      productName,
      productUrl: `https://www.amazon.com/dp/${asin}`,
      totalReviews: reviews.length,
      averageRating,
      reviews,
    };
  } catch (err) {
    console.error("[Amazon scraper]", err);
    return {
      ...defaultResult,
      error:
        "Amazon blocked this request. Add RAPIDAPI_KEY or SCRAPINGBEE_KEY to .env.",
    };
  }
}
