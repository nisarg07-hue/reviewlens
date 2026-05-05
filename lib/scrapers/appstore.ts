import type { ScrapeResult, RawReview } from "@/types";

const ITUNES_API = "https://itunes.apple.com/lookup";

export async function scrapeAppStore(appId: string): Promise<ScrapeResult> {
  const defaultResult: ScrapeResult = {
    platform: "appstore",
    productName: `App (${appId})`,
    productUrl: `https://apps.apple.com/app/id${appId}`,
    totalReviews: 0,
    averageRating: 0,
    reviews: [],
  };

  console.log(`[AppStore] Starting scrape for app ID: ${appId}`);

  try {
    const url = `${ITUNES_API}?id=${appId}&entity=customerReview&limit=50`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

    console.log(`[AppStore] iTunes API status: ${res.status}`);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[AppStore] iTunes API error ${res.status}:`, errText.substring(0, 200));
      return { ...defaultResult, error: "App Store lookup failed." };
    }

    const json = await res.json();
    console.log(`[AppStore] API results count: ${json.resultCount}`);

    if (!json.results || json.results.length === 0) {
      return { ...defaultResult, error: "App not found in App Store." };
    }

    const appInfo = json.results[0];
    const productName = appInfo.trackName || appInfo.collectionName || `App (${appId})`;
    const productUrl = appInfo.trackViewUrl || `https://apps.apple.com/app/id${appId}`;

    const reviews: RawReview[] = [];
    const reviewResults = json.results.slice(1);

    for (let i = 0; i < reviewResults.length; i++) {
      const r = reviewResults[i];
      if (r.body) {
        reviews.push({
          id: r.trackId?.toString() || `as-${i}`,
          rating: r.score || 3,
          title: r.title || "",
          body: r.body,
          date: r.date,
          author: r.author?.name || "App Store User",
          verified: r.isEdited,
        });
      }
    }

    console.log(`[AppStore] ✅ Found ${reviews.length} reviews`);

    return {
      platform: "appstore",
      productName,
      productUrl,
      totalReviews: reviews.length,
      averageRating: appInfo.averageUserRating || 0,
      reviews,
    };
  } catch (err: any) {
    console.error(`[AppStore] Error:`, err.message);
    return { ...defaultResult, error: `App Store fetch failed: ${err.message}` };
  }
}