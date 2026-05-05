import type { DetectedPlatform, Platform, ScrapeResult } from "@/types";
import { scrapeAmazon } from "./amazon";
import { scrapeG2 } from "./g2";
import { scrapeTrustpilot } from "./trustpilot";
import { scrapeAppStore } from "./appstore";

// ─── Detect which platform a URL belongs to ───────────────────────────────────

export function detectPlatform(url: string): DetectedPlatform | null {
  console.log(`[Scraper] Detecting platform for URL: ${url}`);
  
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    console.log(`[Scraper] Hostname: ${host}`);

    // Amazon (supports all country TLDs)
    if (host.includes("amazon.")) {
      const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
      if (!asinMatch) {
        console.log("[Scraper] Amazon URL detected but no ASIN found (need /dp/XXXXXXXXXX)");
        return null;
      }
      console.log(`[Scraper] ✅ Amazon detected, ASIN: ${asinMatch[1]}`);
      return {
        platform: "amazon",
        identifier: asinMatch[1],
        displayName: "Amazon",
      };
    }

    // G2
    if (host === "g2.com" || host.endsWith(".g2.com")) {
      const slugMatch = u.pathname.match(/\/products\/([^/]+)\/?/);
      if (!slugMatch) {
        console.log("[Scraper] G2 URL detected but no product slug found (need /products/SLUG/)");
        return null;
      }
      console.log(`[Scraper] ✅ G2 detected, slug: ${slugMatch[1]}`);
      return {
        platform: "g2",
        identifier: slugMatch[1],
        displayName: "G2",
      };
    }

    // Trustpilot
    if (host === "trustpilot.com" || host.endsWith(".trustpilot.com")) {
      const domainMatch = u.pathname.match(/\/review\/(.+)/);
      if (!domainMatch) {
        console.log("[Scraper] Trustpilot URL detected but no business domain found (need /review/DOMAIN)");
        return null;
      }
      const identifier = domainMatch[1].replace(/\/$/, "");
      console.log(`[Scraper] ✅ Trustpilot detected, domain: ${identifier}`);
      return {
        platform: "trustpilot",
        identifier,
        displayName: "Trustpilot",
      };
    }

    // App Store
    if (host === "apps.apple.com" || host.endsWith(".apps.apple.com")) {
      const idMatch = url.match(/id(\d+)/);
      if (!idMatch) {
        console.log("[Scraper] App Store URL detected but no app ID found (need idXXXXXX)");
        return null;
      }
      console.log(`[Scraper] ✅ App Store detected, ID: ${idMatch[1]}`);
      return {
        platform: "appstore",
        identifier: idMatch[1],
        displayName: "App Store",
      };
    }

    console.log(`[Scraper] ❌ Unrecognised platform: ${host}`);
    return null;
  } catch (err) {
    console.error("[Scraper] URL parsing error:", err);
    return null;
  }
}

// ─── Main scraping dispatcher ─────────────────────────────────────────────────

export async function scrapeReviews(
  detected: DetectedPlatform
): Promise<ScrapeResult> {
  const startTime = Date.now();
  console.log(`[Scraper] ▶ Dispatching ${detected.platform} scraper for: ${detected.identifier}`);

  let result: ScrapeResult;

  switch (detected.platform) {
    case "amazon":
      result = await scrapeAmazon(detected.identifier);
      break;
    case "g2":
      result = await scrapeG2(detected.identifier);
      break;
    case "trustpilot":
      result = await scrapeTrustpilot(detected.identifier);
      break;
    case "appstore":
      result = await scrapeAppStore(detected.identifier);
      break;
    default:
      result = {
        platform: detected.platform as Platform,
        productName: "Unknown",
        productUrl: "",
        totalReviews: 0,
        averageRating: 0,
        reviews: [],
        error: `Platform ${detected.platform} not yet supported.`,
      };
  }

  const elapsed = Date.now() - startTime;
  console.log(`[Scraper] ◀ ${detected.platform} completed in ${elapsed}ms`);
  console.log(`[Scraper] Reviews found: ${result.reviews.length}`);
  console.log(`[Scraper] Error: ${result.error || "none"}`);

  return result;
}
