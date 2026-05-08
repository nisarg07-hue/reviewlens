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
        
        # -> Navigate to /analyze and verify the presence of the required report sections (sentiment breakdown, star distribution, pain points, praises, improvement ideas, competitor signal).
        await page.goto("http://localhost:3000/analyze")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to http://localhost:3000/analyze and then verify the report sections (sentiment breakdown, star distribution, pain points, praises, improvement ideas, competitor signal).
        await page.goto("http://localhost:3000/analyze")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to http://localhost:3000/analyze and observe the page to verify the required report sections are present.
        await page.goto("http://localhost:3000/analyze")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to /analyze and observe the page to verify the required report sections are present.
        await page.goto("http://localhost:3000/analyze")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to http://localhost:3000/analyze and observe the page to verify the six report sections are present.
        await page.goto("http://localhost:3000/analyze")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to /analyze and observe the page to verify the six report sections (sentiment breakdown, star distribution, pain points, praises, improvement ideas, competitor signal).
        await page.goto("http://localhost:3000/analyze")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Fill the URL input with a Trustpilot example and submit (press Enter) to trigger the analysis and load the completed report page, then verify the required report sections.
        # url input placeholder="https://www.trustpilot.com/rev"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/input").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("https://www.trustpilot.com/review/notion.so")
        
        # --> Test failed (AST guard fallback)
        raise AssertionError("Test failed during agent run: " + "TEST FAILURE The analysis report could not be generated because Trustpilot reviews could not be fetched. Observations: - The page shows \"Could not fetch Trustpilot reviews.\" - The report sections (sentiment breakdown, star distribution, pain points, praises, improvement ideas, competitor signal) are not present on the page. - The input field and Analyze button are visible but submitting the Tru...")
        await asyncio.sleep(5)
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    