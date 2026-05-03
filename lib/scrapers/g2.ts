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

  try {
    // G2 is server-rendered, so Cheerio works without a JS engine
    // Use ScrapingBee proxy in prod to avoid IP blocks
    const fetchUrl = process.env.SCRAPINGBEE_KEY
      ? `https://app.scrapingbee.com/api/v1/?api_key=${process.env.SCRAPINGBEE_KEY}&url=${encodeURIComponent(url)}&render_js=false`
      : url;

    const res = await fetch(fetchUrl, {
      headers: !process.env.SCRAPINGBEE_KEY
        ? {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
            Accept: "text/html",
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

    // G2 review card selector (as of 2025)
    $('[itemprop="review"]').each((_, el) => {
      const ratingEl = $(el).find('[itemprop="ratingValue"]');
      const rating = parseFloat(ratingEl.attr("content") ?? "3");

      const title = $(el).find("[itemprop='name']").first().text().trim();

      // G2 splits reviews into "likes" and "dislikes" sections
      const likesText = $(el)
        .find(".review-body__likes .formatted-text")
        .text()
        .trim();
      const dislikesText = $(el)
        .find(".review-body__dislikes .formatted-text")
        .text()
        .trim();
      const body = [
        likesText ? `Likes: ${likesText}` : "",
        dislikesText ? `Dislikes: ${dislikesText}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

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
          verified: true, // G2 verifies all reviews
        });
      }
    });

    // Product name and rating from JSON-LD or meta
    let productName = productSlug;
    let averageRating = 0;
    let totalReviews = 0;

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() ?? "{}");
        if (json["@type"] === "Product" || json["@type"] === "SoftwareApplication") {
          productName = json.name ?? productSlug;
          averageRating = parseFloat(json.aggregateRating?.ratingValue ?? "0");
          totalReviews = parseInt(json.aggregateRating?.reviewCount ?? "0", 10);
        }
      } catch {}
    });

    // Fallback: parse from page heading
    if (!averageRating) {
      const ratingText = $(".product-rating .fw-semibold").first().text().trim();
      averageRating = parseFloat(ratingText) || 0;
    }
    if (!productName || productName === productSlug) {
      productName = $("h1.product-name").first().text().trim() || productSlug;
    }

    return {
      platform: "g2",
      productName,
      productUrl: url,
      totalReviews: totalReviews || reviews.length,
      averageRating,
      reviews,
    };
  } catch (err) {
    console.error("[G2 scraper]", err);
    return {
      ...defaultResult,
      error: "Failed to scrape G2. Add SCRAPINGBEE_KEY for reliable access.",
    };
  }
}
