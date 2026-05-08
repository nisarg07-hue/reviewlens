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

    // Method 2: RapidAPI ScraperAPI residential proxy (fallback for Vercel IP block)
    if (RAPIDAPI_KEY) {
      try {
        console.log("[Trustpilot] Method 2: Trying ScraperAPI Residential Proxy...");
        const scraperUrl = `https://scraperapi.p.rapidapi.com/get?url=${encodeURIComponent(url)}&residential=true`;
        
        const res = await fetch(scraperUrl, {
          headers: {
            "x-rapidapi-key": RAPIDAPI_KEY,
            "x-rapidapi-host": "scraperapi.p.rapidapi.com",
          },
          signal: AbortSignal.timeout(45000),
        });

        if (res.ok) {
          const html = await res.text();
          const result = parseTrustpilotHTML(html, businessDomain, url);
          if (result.reviews.length > 0) {
            console.log(`[Trustpilot] ✅ ScraperAPI found ${result.reviews.length} reviews`);
            return result;
          }
        } else {
          console.log(`[Trustpilot] ScraperAPI status: ${res.status}`);
        }
      } catch (err: any) {
        console.error("[Trustpilot] ScraperAPI error:", err.message);
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
  const cheerio = require("cheerio");
  const $ = cheerio.load(html);

  // ── Method 1: __NEXT_DATA__ JSON extraction (Most reliable) ────────────────
  const nextData = $('script[id="__NEXT_DATA__"]').html();
  if (nextData) {
    try {
      const json = JSON.parse(nextData);
      // Trustpilot's __NEXT_DATA__ structure:
      // props.pageProps.reviews is an array
      // props.pageProps.businessUnit has metadata
      const props = json.props?.pageProps;
      const businessUnit = props?.businessUnit;
      const reviewsData = props?.reviews || [];

      if (reviewsData.length > 0) {
        console.log(`[Trustpilot] ✅ Extracted ${reviewsData.length} reviews from __NEXT_DATA__`);
        const reviews: RawReview[] = reviewsData.map((r: any, i: number) => ({
          id: r.id || `tp-nd-${i}`,
          rating: r.rating || 5,
          title: r.title || "",
          body: r.text || "",
          date: r.createdAt || new Date().toISOString(),
          author: r.consumer?.displayName || "User",
        })).filter((r: RawReview) => r.body.length > 0);

        if (reviews.length > 0) {
          return {
            platform: "trustpilot",
            productName: businessUnit?.displayName || businessDomain,
            productUrl: url,
            totalReviews: businessUnit?.numberOfReviews || reviews.length,
            averageRating: businessUnit?.rating || 0,
            reviews,
          };
        }
      }
    } catch (e) {
      console.log("[Trustpilot] Failed to parse __NEXT_DATA__ JSON");
    }
  }

  // ── Method 2: Traditional HTML selectors (Fallback) ───────────────────────
  const reviews: RawReview[] = [];
  let idx = 0;

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
