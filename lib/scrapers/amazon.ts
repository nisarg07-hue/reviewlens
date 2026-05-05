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
  status: string;
  request_id: string;
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

  console.log(`[Amazon] Starting scrape for ASIN: ${asin}`);
  console.log(`[Amazon] RAPIDAPI_KEY exists: ${!!RAPIDAPI_KEY}`);
  console.log(`[Amazon] SCRAPINGBEE_KEY exists: ${!!process.env.SCRAPINGBEE_KEY}`);

  // ── Method 1: RapidAPI Real-Time Amazon Data ──────────────────────────
  if (RAPIDAPI_KEY) {
    try {
      console.log("[Amazon] Method 1: Trying RapidAPI...");
      const apiUrl = `https://${RAPIDAPI_HOST}/product-reviews?asin=${asin}&country=US&sort_by=TOP_REVIEWS&star_rating=ALL&page=1`;
      
      const res = await fetch(apiUrl, {
        headers: {
          "x-rapidapi-key": RAPIDAPI_KEY,
          "x-rapidapi-host": RAPIDAPI_HOST,
        },
        signal: AbortSignal.timeout(15000),
      });

      console.log(`[Amazon] RapidAPI status: ${res.status}`);

      if (!res.ok) {
        const errText = await res.clone().text();
        console.error("[Amazon] RapidAPI error", res.status, errText.substring(0, 500));
      } else {
        const json: RapidApiResponse = await res.json();
        console.log(`[Amazon] RapidAPI response status: ${json.status}`);
        console.log(`[Amazon] RapidAPI reviews count: ${json.data?.reviews?.length ?? 0}`);

        if (json.data?.reviews?.length > 0) {
          const reviews: RawReview[] = json.data.reviews.map((r) => ({
            id: r.review_id,
            rating: parseInt(r.review_star_rating, 10),
            title: r.review_title,
            body: r.review_comment,
            date: r.review_date,
            author: r.review_author,
            verified: r.is_verified_purchase,
          }));

          console.log(`[Amazon] ✅ RapidAPI returned ${reviews.length} reviews`);
          return {
            platform: "amazon",
            productName: json.data.product_title || `Amazon product (${asin})`,
            productUrl: `https://www.amazon.com/dp/${asin}`,
            totalReviews: json.data.product_num_ratings || reviews.length,
            averageRating: parseFloat(json.data.product_star_rating) || 0,
            reviews,
          };
        }
      }
    } catch (err: any) {
      console.error("[Amazon] RapidAPI error:", err.message);
    }
  }

  // ── Method 2: ScrapingBee ────────────────────────────────────────
  if (process.env.SCRAPINGBEE_KEY) {
    try {
      console.log("[Amazon] Method 2: Trying ScrapingBee...");
      const targetUrl = `https://www.amazon.com/product-reviews/${asin}?sortBy=recent&pageNumber=1`;
      const fetchUrl = `https://app.scrapingbee.com/api/v1/?api_key=${process.env.SCRAPINGBEE_KEY}&url=${encodeURIComponent(targetUrl)}&render_js=false&block_ads=true`;

      const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(30000) });
      console.log(`[Amazon] ScrapingBee status: ${res.status}`);

      if (res.ok) {
        const html = await res.text();
        console.log(`[Amazon] ScrapingBee HTML length: ${html.length}`);

        if (html.toLowerCase().includes("captcha") || html.toLowerCase().includes("robot check")) {
          console.error("[Amazon] ❌ ScrapingBee got CAPTCHA'd");
        } else {
          const result = parseAmazonHTML(html, asin);
          if (result.reviews.length > 0) {
            console.log(`[Amazon] ✅ ScrapingBee found ${result.reviews.length} reviews`);
            return result;
          }
          console.log("[Amazon] ScrapingBee HTML returned but no reviews parsed");
        }
      } else {
        const errText = await res.clone().text();
        console.error("[Amazon] ScrapingBee error:", res.status, errText.substring(0, 300));
      }
    } catch (err: any) {
      console.error("[Amazon] ScrapingBee error:", err.message);
    }
  }

  console.error("[Amazon] ❌ All methods failed");
  return {
    ...defaultResult,
    error: "Could not fetch Amazon reviews. Add RAPIDAPI_KEY or SCRAPINGBEE_KEY to environment variables.",
  };
}

// ─── Amazon HTML parser ───────────────────────────────────────────────────────

function parseAmazonHTML(html: string, asin: string): ScrapeResult {
  const cheerio = require("cheerio");
  const $ = cheerio.load(html);

  const reviews: RawReview[] = [];
  let idx = 0;

  const reviewElements = $('[data-hook="review"]');
  console.log(`[Amazon] HTML parser: found ${reviewElements.length} [data-hook=review] elements`);

  reviewElements.each((_: number, el: any) => {
    const ratingText = $(el).find('[data-hook="review-star-rating"] .a-icon-alt').text();
    const rating = parseFloat(ratingText.split(" ")[0]) || 3;
    const title = $(el).find('[data-hook="review-title"]').text().trim().replace(/^\d\.\d out of 5 stars\n/, "");
    const body = $(el).find('[data-hook="review-body"]').text().trim();
    const date = $(el).find('[data-hook="review-date"]').text().trim();
    const author = $(el).find(".a-profile-name").text().trim();
    const verified = $(el).find('[data-hook="avp-badge"]').length > 0;

    if (body) {
      reviews.push({ id: `amz-${idx++}`, rating, title, body, date, author, verified });
    }
  });

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
}
