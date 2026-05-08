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
        
        # -> Paste a supported Trustpilot URL into the input (index 3) and submit to start the analysis, then wait for the report to appear.
        # url input placeholder="https://www.trustpilot.com/rev"
        elem = page.locator("xpath=/html/body/main/div/form/div/div/input").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("https://www.trustpilot.com/review/notion.so")
        
        # --> Test blocked (AST guard fallback)
        raise AssertionError("Test blocked during agent run: " + "TEST BLOCKED The test could not be run \u2014 the site is rate-limiting requests which prevents the analysis from starting. Observations: - After submitting a supported Trustpilot URL, the page displayed \"Too many requests. Slow down.\" - No analysis report appeared after the submission.")
        await asyncio.sleep(5)
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    