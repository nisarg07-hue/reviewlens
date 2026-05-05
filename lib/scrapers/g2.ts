import type { ScrapeResult, RawReview } from "@/types";

export async function scrapeG2(productSlug: string): Promise<ScrapeResult> {
  const url = `https://www.g2.com/products/${productSlug}/reviews`;

  const defaultResult: ScrapeResult = {
    platform: "g2",
    productName: productSlug,
    productUrl: url,
    totalReviews: 0,
    averageRating: 0,
    reviews: [],
  };

  console.log(`[G2] Starting scrape for: ${productSlug}`);

  // ── Method 1: ScrapingBee (always use if available) ─────────────────────
  if (process.env.SCRAPINGBEE_KEY) {
    try {
      console.log("[G2] Method 1: Trying ScrapingBee...");
      const fetchUrl = `https://app.scrapingbee.com/api/v1/?api_key=${process.env.SCRAPINGBEE_KEY}&url=${encodeURIComponent(url)}&render_js=true&premium_proxy=true&block_ads=true`;

      const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(30000) });
      console.log(`[G2] ScrapingBee status: ${res.status}`);

      if (!res.ok) {
        const errText = await res.clone().text();
        console.error("[G2] ScrapingBee error:", res.status, errText.substring(0, 300));
      } else {
        const html = await res.text();
        console.log(`[G2] HTML length: ${html.length}`);
        
        const result = parseG2HTML(html, productSlug, url);
        if (result.reviews.length > 0) {
          console.log(`[G2] ✅ ScrapingBee found ${result.reviews.length} reviews`);
          return result;
        }
        console.log("[G2] ScrapingBee returned HTML but no reviews parsed");
      }
    } catch (err: any) {
      console.error("[G2] ScrapingBee error:", err.message);
    }
  }

  // ── Method 2: Direct fetch (fallback only) ────────────────────────────
  try {
    console.log("[G2] Method 2: Trying direct fetch...");
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });

    console.log(`[G2] Direct fetch status: ${res.status}`);

    if (res.ok) {
      const html = await res.text();
      console.log(`[G2] HTML length: ${html.length}`);
      
      const result = parseG2HTML(html, productSlug, url);
      if (result.reviews.length > 0) {
        console.log(`[G2] ✅ Direct fetch found ${result.reviews.length} reviews`);
        return result;
      }
      
      if (html.includes("captcha") || html.includes("Verify") || html.length < 5000) {
        console.log("[G2] Likely blocked by CAPTCHA/Cloudflare");
      }
    }
  } catch (err: any) {
    console.error("[G2] Direct fetch error:", err.message);
  }

  console.error("[G2] ❌ All methods failed");
  return {
    ...defaultResult,
    error: "Could not fetch G2 reviews. Try Trustpilot or Amazon URLs instead.",
  };
}

// ─── G2 HTML parser ───────────────────────────────────────────────────────────

function parseG2HTML(html: string, productSlug: string, url: string): ScrapeResult {
  const cheerio = require("cheerio");
  const $ = cheerio.load(html);

  const reviews: RawReview[] = [];
  let idx = 0;

  // Primary selector: itemprop="review"
  $('[itemprop="review"]').each((_: number, el: any) => {
    const ratingEl = $(el).find('[itemprop="ratingValue"]');
    const rating = parseFloat(ratingEl.attr("content") ?? "3");
    const title = $(el).find("[itemprop='name']").first().text().trim();

    const likesText = $(el).find(".review-body__likes .formatted-text").text().trim();
    const dislikesText = $(el).find(".review-body__dislikes .formatted-text").text().trim();
    const body = [
      likesText ? `Likes: ${likesText}` : "",
      dislikesText ? `Dislikes: ${dislikesText}` : "",
    ].filter(Boolean).join(" | ");

    const date =
      $(el).find("time").attr("datetime") ??
      $(el).find("[itemprop='datePublished']").attr("content") ??
      new Date().toISOString();
    const author = $(el).find("[itemprop='author']").text().trim();

    if (body || title) {
      reviews.push({
        id: `g2-${idx++}`,
        rating,
        title,
        body,
        date,
        author,
        verified: true,
      });
    }
  });

  // Fallback: try div.review-content selectors
  if (reviews.length === 0) {
    console.log("[G2] Primary selector found 0. Trying fallback selectors...");
    $(".paper--box .review-content, .review-listing").each((_: number, el: any) => {
      const body = $(el).text().trim();
      if (body && body.length > 20) {
        reviews.push({
          id: `g2-${idx++}`,
          rating: 3,
          title: "",
          body: body.substring(0, 2000),
          date: new Date().toISOString(),
          author: "G2 User",
          verified: true,
        });
      }
    });
  }

  // Metadata from JSON-LD
  let productName = productSlug;
  let averageRating = 0;
  let totalReviews = 0;

  $('script[type="application/ld+json"]').each((_: number, el: any) => {
    try {
      const json = JSON.parse($(el).html() ?? "{}");
      if (json["@type"] === "Product" || json["@type"] === "SoftwareApplication") {
        productName = json.name ?? productSlug;
        averageRating = parseFloat(json.aggregateRating?.ratingValue ?? "0");
        totalReviews = parseInt(json.aggregateRating?.reviewCount ?? "0", 10);
      }
    } catch {}
  });

  if (!averageRating) {
    const ratingText = $(".product-rating .fw-semibold").first().text().trim();
    averageRating = parseFloat(ratingText) || 0;
  }
  if (!productName || productName === productSlug) {
    productName = $("h1.product-name, h1").first().text().trim() || productSlug;
  }

  return {
    platform: "g2",
    productName,
    productUrl: url,
    totalReviews: totalReviews || reviews.length,
    averageRating,
    reviews,
  };
}
