import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        pw = await async_api.async_playwright().start()
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )
        context = await browser.new_context()
        context.set_default_timeout(15000)
        page = await context.new_page()
        # -> navigate
        await page.goto("http://localhost:3000/")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Paste the first supported review URL into the analysis input and run the analysis (first of 3).
        # url input placeholder="https://www.trustpilot.com/rev"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/input").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("https://www.trustpilot.com/review/notion.so")
        
        # -> Click the Analyze button to run the first analysis and observe the UI response.
        # button "Analyze"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/button").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Retry the first analysis: wait briefly to clear throttle, then click the Analyze button (element index 19).
        # button "Analyze"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/button").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Click the 'g2.com/products' example button to populate the input with a supported URL (element index 25), then wait for the input to update before running the analysis.
        # button "g2.com/products"
        elem = page.locator("xpath=/html/body/main/div/div[2]/button[2]").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Click the Analyze button (index 19) to run the first analysis using the populated G2 URL, then wait for the UI to return results.
        # button "Analyze"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/button").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Navigate to the app root (/) and run two more analyses (use Amazon example then another example), then check whether an upgrade/paywall prompt/modal appears after the third analysis.
        await page.goto("http://localhost:3000/")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Run three analyses in sequence by filling the URL input and sending Enter for each (trustpilot, then g2, then amazon). After the third analysis, check the UI for an upgrade/paywall prompt/modal.
        # url input placeholder="https://www.trustpilot.com/rev"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/input").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("https://www.trustpilot.com/review/notion.so")
        
        # -> Run three analyses in sequence by filling the URL input and sending Enter for each (trustpilot, then g2, then amazon). After the third analysis, check the UI for an upgrade/paywall prompt/modal.
        # url input placeholder="https://www.trustpilot.com/rev"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/input").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("https://www.g2.com/products/slack/reviews")
        
        # -> Run two more analyses (Amazon then another example) and check the UI for an upgrade/paywall prompt/modal immediately after the third analysis.
        # button "amazon.com/dp"
        elem = page.locator("xpath=/html/body/main/div/div[2]/button[3]").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Run two more analyses (Amazon then another example) and check the UI for an upgrade/paywall prompt/modal immediately after the third analysis.
        # button "g2.com/products"
        elem = page.locator("xpath=/html/body/main/div/div[2]/button[2]").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Click the Analyze button (index 550) to run an analysis with the current input, then wait for the UI to respond.
        # button "Analyze"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/button").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Return to the app root/home and run two additional analyses using example URLs (avoid Trustpilot since it was throttled). After the third completed analysis, check the UI for an upgrade/paywall prompt.
        # button "←
 ReviewLens"
        elem = page.locator("xpath=/html/body/main/header/button").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Populate the input with an Amazon review URL by clicking the amazon.com/dp example button so the analysis input updates (then wait for the UI to reflect the change).
        # button "amazon.com/dp"
        elem = page.locator("xpath=/html/body/main/div/div[2]/button[3]").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        await asyncio.sleep(5)
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    