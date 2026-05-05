import { scrapeAppStore } from "../lib/scrapers/appstore";

async function test() {
  const appId = "544007664";
  console.log(`Testing App Store scraper with ID: ${appId}`);
  
  const result = await scrapeAppStore(appId);
  console.log("Result:", JSON.stringify(result, null, 2));
}

test();