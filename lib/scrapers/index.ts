import type { DetectedPlatform, Platform, ScrapeResult } from "@/types";
import { scrapeAmazon } from "./amazon";
import { scrapeG2 } from "./g2";
import { scrapeTrustpilot } from "./trustpilot";

// ─── Detect which platform a URL belongs to ───────────────────────────────────

export function detectPlatform(url: string): DetectedPlatform | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");

    // Amazon
    if (host.includes("amazon.")) {
      const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
      if (!asinMatch) return null;
      return {
        platform: "amazon",
        identifier: asinMatch[1],
        displayName: "Amazon",
      };
    }

    // G2
    if (host === "g2.com" || host.endsWith(".g2.com")) {
      const slugMatch = u.pathname.match(/\/products\/([^/]+)\//);
      if (!slugMatch) return null;
      return {
        platform: "g2",
        identifier: slugMatch[1],
        displayName: "G2",
      };
    }

    // Trustpilot
    if (host === "trustpilot.com" || host.endsWith(".trustpilot.com")) {
      const domainMatch = u.pathname.match(/\/review\/(.+)/);
      if (!domainMatch) return null;
      return {
        platform: "trustpilot",
        identifier: domainMatch[1].replace(/\/$/, ""),
        displayName: "Trustpilot",
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Main scraping dispatcher ─────────────────────────────────────────────────

export async function scrapeReviews(
  detected: DetectedPlatform
): Promise<ScrapeResult> {
  switch (detected.platform) {
    case "amazon":
      return scrapeAmazon(detected.identifier);
    case "g2":
      return scrapeG2(detected.identifier);
    case "trustpilot":
      return scrapeTrustpilot(detected.identifier);
    default:
      return {
        platform: detected.platform as Platform,
        productName: "Unknown",
        productUrl: "",
        totalReviews: 0,
        averageRating: 0,
        reviews: [],
        error: `Platform ${detected.platform} not yet supported.`,
      };
  }
}
