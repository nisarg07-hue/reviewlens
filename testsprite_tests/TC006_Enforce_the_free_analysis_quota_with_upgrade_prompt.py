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
        
        # -> Perform the first analysis: enter a supported review URL into the URL input and start analysis (submit).
        # url input placeholder="https://www.trustpilot.com/rev"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/input").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("https://www.trustpilot.com/review/notion.so")
        
        # -> Perform the first analysis: enter a supported review URL into the URL input and start analysis (submit).
        # url input placeholder="https://www.trustpilot.com/rev"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/input").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("https://www.g2.com/products/notion/reviews")
        
        # -> Start the first analysis by clicking the Analyze button for the current URL in the input.
        # button "Analyze"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/button").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Submit the first analysis: replace the input with a supported Trustpilot review URL and click Analyze, then wait for the UI to respond so the page state can be observed.
        # url input placeholder="https://www.trustpilot.com/rev"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/input").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("https://www.trustpilot.com/review/notion.so")
        
        # -> Submit the first analysis: replace the input with a supported Trustpilot review URL and click Analyze, then wait for the UI to respond so the page state can be observed.
        # button "Analyze"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/button").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Click the Analyze button to start one more analysis attempt and observe whether the paywall modal and upgrade options appear.
        # button "Analyze"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/button").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Click the 'trustpilot.com/review' example button to populate the input (or reset the fetching state) and attempt another analysis; then wait for the UI to update so the page can be inspected for a paywall modal and upgrade options.
        # button "trustpilot.com/review"
        elem = page.locator("xpath=/html/body/main/div/div[2]/button").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Click the Analyze button to attempt one more analysis and wait for the UI to respond so the page can be inspected for a paywall modal and upgrade options.
        # button "Analyze"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/button").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Click the 'trustpilot.com/review' example button to populate/reset the input (index 20), then click the Analyze area/button (index 71) to start one final analysis attempt and wait for the UI to respond so the page can be inspected for a ...
        # button "trustpilot.com/review"
        elem = page.locator("xpath=/html/body/main/div/div[2]/button").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Click the 'trustpilot.com/review' example button to populate/reset the input (index 20), then click the Analyze area/button (index 71) to start one final analysis attempt and wait for the UI to respond so the page can be inspected for a ...
        # Click the 'trustpilot.com/review' example button to populate/reset the input (index 20), then click the Analyze area/button (index 71) to start one final analysis attempt and wait for the UI to respond so the page can be inspected for a ...
        elem = page.locator("xpath=/html/body/main/div/form/div/div/div").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Attempt another analysis to trigger the paywall: click the Analyze area and wait for the UI to settle, then inspect the page for a paywall modal and visible upgrade options.
        # Attempt another analysis to trigger the paywall: click the Analyze area and wait for the UI to settle, then inspect the page for a paywall modal and visible upgrade options.
        elem = page.locator("xpath=/html/body/main/div/form/div/div/div").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Click the Analyze button to start one more analysis attempt, wait for the UI to settle, then inspect the page for a paywall modal and visible upgrade options.
        # button "Analyze"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/button").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # --> Test failed (AST guard fallback)
        raise AssertionError("Test failed during agent run: " + "TEST FAILURE The paywall modal did not appear after the free analyses were consumed. Observations: - The footer shows '/3 free analyses used'. - Multiple analysis attempts showed 'Fetching reviews...' then 'Could not fetch Trustpilot reviews.' and no analysis completed. - No paywall modal or upgrade dialog appeared when starting additional analyses.")
        await asyncio.sleep(5)
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    