import type { ScrapeResult, RawReview } from "@/types";

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? "";
const RAPIDAPI_HOST = "trustpilot-reviews-scraper.p.rapidapi.com";

export async function scrapeTrustpilot(
  businessDomain: string,
  retries = 3,
  delayMs = 2000
): Promise<ScrapeResult> {
  const url = `https://www.trustpilot.com/review/${businessDomain}`;
  const defaultResult: ScrapeResult = {
    platform: "trustpilot",
    productName: businessDomain,
    productUrl: url,
    totalReviews: 0,
    averageRating: 0,
    reviews: [],
  };

  console.log(`[Trustpilot] Starting scrape for: ${businessDomain}`);

  const attemptScrape = async (attempt: number): Promise<ScrapeResult | null> => {
    console.log(`[Trustpilot] Attempt ${attempt}/${retries + 1}...`);

    // Method 0: RapidAPI (Trustpilot Reviews Scraper)
    if (RAPIDAPI_KEY) {
      try {
        console.log("[Trustpilot] Method 0: Trying RapidAPI...");
        const apiUrl = `https://${RAPIDAPI_HOST}/reviews?domain=${businessDomain}&page=1`;
        
        const res = await fetch(apiUrl, {
          headers: {
            "x-rapidapi-key": RAPIDAPI_KEY,
            "x-rapidapi-host": RAPIDAPI_HOST,
          },
          signal: AbortSignal.timeout(20000),
        });

        if (res.ok) {
          const data = await res.json();
          // The API structure for this RapidAPI often returns { reviews: [...], total_reviews: 123, rating: 4.5 }
          const reviewsList = data.reviews || [];
          if (reviewsList.length > 0) {
            const reviews: RawReview[] = reviewsList.map((r: any, i: number) => ({
              id: r.id || `tp-api-${i}`,
              rating: r.rating || 5,
              title: r.title || "",
              body: r.text || r.content || "",
              date: r.date || new Date().toISOString(),
              author: r.author || "User",
            }));

            console.log(`[Trustpilot] ✅ RapidAPI returned ${reviews.length} reviews`);
            return {
              platform: "trustpilot",
              productName: data.business_name || businessDomain,
              productUrl: url,
              totalReviews: data.total_reviews || reviews.length,
              averageRating: data.rating || 0,
              reviews,
            };
          }
        } else {
          console.log(`[Trustpilot] RapidAPI status: ${res.status}`);
        }
      } catch (err: any) {
        console.error("[Trustpilot] RapidAPI error:", err.message);
      }
    }

    // Method 1: ScrapingBee (use if available)
    if (process.env.SCRAPINGBEE_KEY) {
      try {
        console.log("[Trustpilot] Method 1: Trying ScrapingBee...");
        const fetchUrl = `https://app.scrapingbee.com/api/v1/?api_key=${process.env.SCRAPINGBEE_KEY}&url=${encodeURIComponent(url)}&render_js=true&premium_proxy=true&block_ads=false&block_resources=false&wait=5000`;

        const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(60000) });
        console.log(`[Trustpilot] ScrapingBee status: ${res.status}`);

        if (res.status === 429 || res.status === 503) {
          console.log(`[Trustpilot] Rate limited (${res.status}), backing off...`);
          return null; 
        }

        if (res.ok) {
          const html = await res.text();
          const result = parseTrustpilotHTML(html, businessDomain, url);
          if (result.reviews.length > 0) {
            console.log(`[Trustpilot] ✅ ScrapingBee found ${result.reviews.length} reviews`);
            return result;
          }
        }
      } catch (err: any) {
        console.error("[Trustpilot] ScrapingBee error:", err.message);
      }
    }

    // Method 2: RapidAPI General Web Scraper (fallback for Vercel IP block)
    if (RAPIDAPI_KEY) {
      try {
        console.log("[Trustpilot] Method 2: Trying General Web Scraper Proxy...");
        const scraperUrl = `https://web-scraper.p.rapidapi.com/scrape?url=${encodeURIComponent(url)}&proxy_type=residential`;
        
        const res = await fetch(scraperUrl, {
          headers: {
            "x-rapidapi-key": RAPIDAPI_KEY,
            "x-rapidapi-host": "web-scraper.p.rapidapi.com",
          },
          signal: AbortSignal.timeout(30000),
        });

        if (res.ok) {
          const html = await res.text();
          const result = parseTrustpilotHTML(html, businessDomain, url);
          if (result.reviews.length > 0) {
            console.log(`[Trustpilot] ✅ Proxy Scraper found ${result.reviews.length} reviews`);
            return result;
          }
        }
      } catch (err: any) {
        console.error("[Trustpilot] Proxy Scraper error:", err.message);
      }
    }

    return null;
  };


  // Retry loop with exponential backoff
  for (let i = 0; i <= retries; i++) {
    const result = await attemptScrape(i);

    if (result && result.reviews?.length > 0) {
      return result;
    }

    if (i < retries) {
      const backoff = delayMs * Math.pow(2, i) + Math.random() * 1000;
      console.log(`[Trustpilot] Waiting ${Math.round(backoff)}ms before retry...`);
      await new Promise(r => setTimeout(r, backoff));
    }
  }

  console.error("[Trustpilot] ❌ All methods failed after retries");
  return {
    ...defaultResult,
    error: "Could not fetch Trustpilot reviews. The site may be rate-limiting requests. Try again later.",
  };
}

// ─── HTML parser ──────────────────────────────────────────────────────────────

function parseTrustpilotHTML(html: string, businessDomain: string, url: string): ScrapeResult {
  // Use dynamic import for cheerio
  const cheerio = require("cheerio");
  const $ = cheerio.load(html, { xmlns: { svg: 'http://www.w3.org/2000/svg' } });

  const reviews: RawReview[] = [];
  let idx = 0;

  // Primary selector
  $('[data-automation-id="review-card"]').each((_: number, el: any) => {
    const rating = parseInt($(el).attr("data-service-review-rating") ?? "3", 10);
    const title = $(el).find("[data-service-review-title-typography]").text().trim();
    const body = $(el).find("[data-service-review-text-typography]").text().trim();
    const date = $(el).find("time").attr("datetime") ?? new Date().toISOString();
    const author = $(el).find("[data-consumer-name-typography]").text().trim();

    if (body) {
      reviews.push({ id: `tp-${idx++}`, rating, title, body, date, author });
    }
  });

  // Fallback selector (newer Trustpilot layout)
  if (reviews.length === 0) {
    $("[data-review-content]").each((_: number, el: any) => {
      const ratingElement = $(el).closest("[data-service-review-rating]");
      const rating = parseInt(ratingElement.attr("data-service-review-rating") || "3", 10);
      const body = $(el).text().trim();
      if (body) {
        reviews.push({ id: `tp-${idx++}`, rating, title: "", body, date: new Date().toISOString(), author: "User" });
      }
    });
  }

  // Parse metadata
  let averageRating = 0;
  let totalReviews = 0;
  let productName = businessDomain;

  $('script[type="application/ld+json"]').each((_: number, el: any) => {
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
    totalReviews: totalReviews || reviews.length,
    averageRating,
    reviews,
  };
}

// ─── JSON-LD parser ───────────────────────────────────────────────────────────

function parseTrustpilotJsonLd(html: string, businessDomain: string, url: string): ScrapeResult | null {
  try {
    const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
    if (!jsonLdMatches) return null;

    let reviews: RawReview[] = [];
    let productName = businessDomain;
    let averageRating = 0;
    let totalReviews = 0;

    for (const match of jsonLdMatches) {
      const jsonStr = match.replace(/<script type="application\/ld\+json">/, "").replace(/<\/script>/, "");
      try {
        const json = JSON.parse(jsonStr);

        if (json["@type"] === "Organization" || json["@type"] === "LocalBusiness") {
          productName = json.name || businessDomain;
          averageRating = parseFloat(json.aggregateRating?.ratingValue || "0");
          totalReviews = parseInt(json.aggregateRating?.reviewCount || "0", 10);
        }

        if (json.review && Array.isArray(json.review)) {
          reviews = json.review.map((r: any, i: number) => ({
            id: `tp-ld-${i}`,
            rating: parseInt(r.reviewRating?.ratingValue || "3", 10),
            title: r.headline || r.name || "",
            body: r.reviewBody || "",
            date: r.datePublished || new Date().toISOString(),
            author: r.author?.name || "Anonymous",
          })).filter((r: RawReview) => r.body.length > 0);
        }
      } catch {}
    }

    if (reviews.length === 0) return null;

    return {
      platform: "trustpilot",
      productName,
      productUrl: url,
      totalReviews: totalReviews || reviews.length,
      averageRating,
      reviews,
    };
  } catch {
    return null;
  }
}
