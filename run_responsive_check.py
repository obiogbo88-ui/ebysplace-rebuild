import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "https://3000-ib8debbi2y1en8l9lhmml-b7aa07d3.us2.manus.computer"
OUT = Path("/home/ubuntu/ebysplace-rebuild/final-responsive-screenshots")
OUT.mkdir(parents=True, exist_ok=True)

viewports = {
    "mobile": {"width": 390, "height": 844},
    "tablet": {"width": 768, "height": 1024},
    "desktop": {"width": 1440, "height": 1100},
}
pages = {
    "home": "/",
    "services": "/services",
    "booking": "/booking",
    "gallery": "/gallery",
    "admin": "/admin",
}

async def main():
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-gpu"])
        for viewport_name, viewport in viewports.items():
            context = await browser.new_context(viewport=viewport, device_scale_factor=1, is_mobile=(viewport_name == "mobile"), has_touch=(viewport_name == "mobile"))
            page = await context.new_page()
            for page_name, path in pages.items():
                url = BASE + path
                await page.goto(url, wait_until="networkidle", timeout=30000)
                await page.screenshot(path=str(OUT / f"{viewport_name}-{page_name}.png"), full_page=False)
                metrics = await page.evaluate("""() => ({
                    innerWidth: window.innerWidth,
                    scrollWidth: document.documentElement.scrollWidth,
                    bodyScrollWidth: document.body.scrollWidth,
                    title: document.title,
                })""")
                overflow = max(metrics["scrollWidth"], metrics["bodyScrollWidth"]) - metrics["innerWidth"]
                results.append({
                    "viewport": viewport_name,
                    "page": page_name,
                    "width": viewport["width"],
                    "path": path,
                    "overflow_px": overflow,
                    "title": metrics["title"],
                })
            await context.close()
        await browser.close()
    report = OUT / "responsive-report.md"
    lines = ["# Final Responsive Verification", "", "| Viewport | Page | Width | Overflow | Screenshot |", "|---|---:|---:|---:|---|" ]
    for r in results:
        shot = f"{r['viewport']}-{r['page']}.png"
        status = "0 px" if r["overflow_px"] <= 0 else f"{r['overflow_px']} px"
        lines.append(f"| {r['viewport']} | {r['page']} | {r['width']} px | {status} | `{shot}` |")
    report.write_text("\n".join(lines) + "\n")
    print(report)
    for r in results:
        print(f"{r['viewport']} {r['page']} width={r['width']} overflow={r['overflow_px']}px")

asyncio.run(main())
