import asyncio, json, os, re
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
OUT = Path("/tmp/browser/break-ui-matrix")
OUT.mkdir(parents=True, exist_ok=True)
PUBLIC = ["/", "/dashboard", "/cards", "/encyclopedia", "/features", "/manual", "/schedule", "/auth", "/login", "/membership", "/track-record", "/horse", "/race", "/racing-health", "/pool-odds", "/predictor", "/results", "/strategy-pnl", "/freeze-ledger", "/dev-log", "/media-credits", "/engine", "/engine/backtest", "/engine/features", "/engine/monitor", "/engine/residuals", "/explain"]
ADMIN = ["/admin/overview", "/admin/engine-health", "/admin/data-freshness", "/admin/prediction-lock", "/admin/model-versions", "/admin/pnl", "/admin/users-membership", "/admin/logs", "/admin/settings", "/admin/console"]

async def restore_auth(context, page):
    cookies = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if cookies:
        for cookie in json.loads(cookies): cookie["url"] = BASE
        await context.add_cookies(json.loads(cookies))
    await page.goto(BASE)
    key, session = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"), os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if key and session: await page.evaluate("([k,v]) => localStorage.setItem(k,v)", [key, session])

async def main():
    report = []
    async with async_playwright() as p:
      browser = await p.chromium.launch(headless=True)
      for width in (320, 390, 1280):
        context = await browser.new_context(viewport={"width": width, "height": 1800})
        page = await context.new_page(); errors=[]
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        await restore_auth(context, page)
        for route in PUBLIC + ADMIN:
          for direction in (["ltr", "rtl"] if width == 390 else ["ltr"]):
            errors.clear()
            if route.startswith("/admin"):
              await page.goto(BASE + route, wait_until="domcontentloaded", timeout=30000)
              await page.evaluate("localStorage.setItem('tx-admin-fixture','worst')")
              await page.reload(wait_until="domcontentloaded")
            else: await page.goto(BASE + route, wait_until="domcontentloaded", timeout=30000)
            await page.evaluate("d => document.documentElement.dir=d", direction)
            await page.wait_for_timeout(600)
            state = await page.evaluate(r"""() => ({overflow: document.documentElement.scrollWidth-document.documentElement.clientWidth, bad: location.pathname === '/dev-log' ? false : /(^|[\s:])(NaN|undefined|Invalid Date)([\s,]|$)/m.test(document.body.innerText), title: document.title})""")
            actionable = [e for e in errors if "hydrated but some attributes" not in e and "Failed to load resource" not in e]
            report.append({"route":route,"width":width,"dir":direction,**state,"consoleErrors":actionable[:5],"wrongRoute":page.url.split("?")[0].rstrip("/") != (BASE+route).rstrip("/")})
        await context.close()
      # Slow API: representative pages for each product and admin monitor.
      context = await browser.new_context(viewport={"width":390,"height":1800}); page = await context.new_page()
      await restore_auth(context,page)
      await page.route(re.compile(r".*/api/public/.*"), lambda route: asyncio.create_task(route.continue_()) if False else asyncio.create_task(slow(route)))
      for route in ["/predictor","/strategy-pnl","/admin/engine-health"]:
        try:
          await page.goto(BASE+route,wait_until="domcontentloaded",timeout=30000); await page.wait_for_timeout(1000)
          text=await page.locator("body").inner_text(); report.append({"route":route,"width":390,"dir":"ltr","scenario":"slow-api","blank":len(text.strip())<20})
        except Exception as exc: report.append({"route":route,"scenario":"slow-api","error":str(exc)[:200]})
      await context.close(); await browser.close()
    (OUT/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
    failures=[r for r in report if r.get("overflow",0)>2 or r.get("bad") or r.get("consoleErrors") or r.get("blank") or r.get("error") or r.get("wrongRoute")]
    print(json.dumps({"checks":len(report),"failures":len(failures),"report":str(OUT/"report.json")},ensure_ascii=False))
    if failures:
      (OUT/"failures.json").write_text(json.dumps(failures,ensure_ascii=False,indent=2))
      raise SystemExit(1)

async def slow(route):
    await asyncio.sleep(3)
    await route.continue_()

asyncio.run(main())