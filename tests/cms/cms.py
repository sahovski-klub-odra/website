"""Shared helpers for driving the real Sveltia CMS in the local test-repo harness."""
import asyncio, mimetypes, os, re
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'output'); os.makedirs(OUT, exist_ok=True)
# Optional: serve unpkg/jsdelivr files from a local node_modules (for machines without internet access).
UNPKG_DIR = os.environ.get('CMS_OFFLINE_DIR', '')
BASE = os.environ.get('CMS_URL', 'http://localhost:8800/admin/')
misses = []

async def unpkg_route(route):
    url = route.request.url
    m = re.match(r'https://unpkg\.com/((?:@[^/]+/)?[^/@]+)(?:@[^/]*)?/([^?]*)', url)
    if m:
        path = os.path.join(UNPKG_DIR, m.group(1), m.group(2))
        if os.path.isfile(path):
            ctype = 'text/javascript' if path.endswith(('.js', '.mjs')) else (mimetypes.guess_type(path)[0] or 'application/octet-stream')
            return await route.fulfill(path=path, headers={'Content-Type': ctype, 'Access-Control-Allow-Origin': '*'})
    misses.append(url)
    await route.fulfill(status=404, body='not available offline')

FONT = os.path.join(UNPKG_DIR, 'material-symbols/material-symbols-outlined.woff2')
async def fonts_route(route):
    url = route.request.url
    if 'fonts.gstatic.com/local-material-symbols' in url:
        return await route.fulfill(path=FONT, headers={'Content-Type': 'font/woff2', 'Access-Control-Allow-Origin': '*'})
    if 'Material+Symbols' in url or 'Material%20Symbols' in url:
        fam = 'Material Symbols Outlined'
        css = ("@font-face{font-family:'%s';font-style:normal;font-weight:100 700;src:url(https://fonts.gstatic.com/local-material-symbols) format('woff2')}"
               ".material-symbols-outlined{font-family:'%s';font-weight:normal;font-style:normal;font-size:24px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-feature-settings:'liga';font-feature-settings:'liga'}") % (fam, fam)
        return await route.fulfill(body=css, headers={'Content-Type': 'text/css', 'Access-Control-Allow-Origin': '*'})
    await route.fulfill(body='', headers={'Content-Type': 'text/css'})

async def open_cms(p, width=1440, height=900, **ctx_kw):
    chrome = os.environ.get('CHROME')
    b = await p.chromium.launch(**({'executable_path': chrome} if chrome else {}), args=['--no-sandbox'])
    locale = ctx_kw.pop('ui_locale', os.environ.get('CMS_UI_LOCALE', 'en'))
    url = ctx_kw.pop('url', BASE)
    ctx = await b.new_context(viewport={'width': width, 'height': height}, **ctx_kw)
    # The admin defaults to Croatian; the click-through tests use the English labels unless asked otherwise.
    if locale:
        await ctx.add_init_script("try{var k='sveltia-cms.prefs',p=JSON.parse(localStorage.getItem(k)||'{}')||{};if(!p.locale){p.locale=%r;localStorage.setItem(k,JSON.stringify(p))}}catch(e){}" % locale)
    if not UNPKG_DIR:
        page = await ctx.new_page(); logs = []
        page.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        await page.goto(url, wait_until='networkidle')
        return b, page, logs
    await ctx.route(re.compile(r'https://unpkg\.com/.*'), unpkg_route)
    await ctx.route(re.compile(r'https://fonts\.(googleapis|gstatic)\.com/.*'), fonts_route)
    async def jsd(route):
        if 'material-symbols-outlined' in route.request.url:
            return await route.fulfill(path=FONT, headers={'Content-Type': 'font/woff2', 'Access-Control-Allow-Origin': '*'})
        await route.fulfill(status=404, body='')
    await ctx.route(re.compile(r'https://cdn\.jsdelivr\.net/.*'), jsd)
    page = await ctx.new_page()
    logs = []
    page.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    await page.goto(url, wait_until='networkidle')
    return b, page, logs
