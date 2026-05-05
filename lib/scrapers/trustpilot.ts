import type { ScrapeResult, RawReview } from "@/types";

export async function scrapeTrustpilot(
  businessDomain: string
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

  // ── Method 1: ScrapingBee (use if available) ───────────────────────────
  if (process.env.SCRAPINGBEE_KEY) {
    try {
      console.log("[Trustpilot] Method 1: Trying ScrapingBee...");
      const fetchUrl = `https://app.scrapingbee.com/api/v1/?api_key=${process.env.SCRAPINGBEE_KEY}&url=${encodeURIComponent(url)}&render_js=false&block_ads=true`;
      
      const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(30000) });
      console.log(`[Trustpilot] ScrapingBee status: ${res.status}`);
      
      if (!res.ok) {
        const errText = await res.clone().text();
        console.error("[Trustpilot] ScrapingBee error:", res.status, errText.substring(0, 300));
      } else {
        const html = await res.text();
        console.log(`[Trustpilot] HTML length: ${html.length}`);
        
        const result = parseTrustpilotHTML(html, businessDomain, url);
        if (result.reviews.length > 0) {
          console.log(`[Trustpilot] ✅ ScrapingBee found ${result.reviews.length} reviews`);
          return result;
        }
        console.log("[Trustpilot] ScrapingBee returned HTML but no reviews parsed");
      }
    } catch (err: any) {
      console.error("[Trustpilot] ScrapingBee error:", err.message);
    }
  }

  // ── Method 2: Direct fetch with browser-like headers ──────────────────────
  try {
    console.log("[Trustpilot] Method 2: Trying direct fetch...");
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
      },
      signal: AbortSignal.timeout(15000),
    });

    console.log(`[Trustpilot] Direct fetch status: ${res.status}`);

    if (res.ok) {
      const html = await res.text();
      console.log(`[Trustpilot] HTML length: ${html.length}`);

      const jsonLdResult = parseTrustpilotJsonLd(html, businessDomain, url);
      if (jsonLdResult && jsonLdResult.reviews.length > 0) {
        console.log(`[Trustpilot] ✅ JSON-LD extracted ${jsonLdResult.reviews.length} reviews`);
        return jsonLdResult;
      }

      const result = parseTrustpilotHTML(html, businessDomain, url);
      if (result.reviews.length > 0) {
        console.log(`[Trustpilot] ✅ HTML parsed ${result.reviews.length} reviews`);
        return result;
      }
    }
  } catch (err: any) {
    console.error("[Trustpilot] Direct fetch error:", err.message);
  }

  console.error("[Trustpilot] ❌ All methods failed");
  return {
    ...defaultResult,
    error: "Could not fetch Trustpilot reviews.",
  };
}

// ─── HTML parser ──────────────────────────────────────────────────────────────

function parseTrustpilotHTML(html: string, businessDomain: string, url: string): ScrapeResult {
  // Use dynamic import for cheerio
  const cheerio = require("cheerio");
  const $ = cheerio.load(html);

  const reviews: RawReview[] = [];
  let idx = 0;

  // Primary selector
  $("article[data-service-review-rating]").each((_: number, el: any) => {
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
      const rating = parseInt($(el).closest("[data-service-review-rating]").attr("data-service-review-rating") || "3", 10);
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
