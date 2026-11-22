import asyncio, os, sys, json, re
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from workflow import start, check, RESULTS, READ_FILE
from cms import *
async def main():
    async with async_playwright() as p:
        b, page, logs = await start(p)
        # ---- diagram via Insert menu ----
        await page.get_by_role('button', name='Create New Entry').click(); await page.wait_for_timeout(2500)
        await page.get_by_role('textbox', name='Naslov', exact=True).fill('Test dijagrama'); await page.get_by_role('textbox', name='Adresa (neobavezno)', exact=True).fill('test-dijagram')
        ed = page.locator('[contenteditable=true]').first
        await ed.click(); await page.keyboard.type('Bijeli na potezu:'); await page.keyboard.press('Enter')
        await page.get_by_role('button', name='Insert', exact=True).first.click(); await page.wait_for_timeout(400)
        await page.get_by_role('menuitem', name='Dodaj šahovski dijagram').click(); await page.wait_for_timeout(1000)
        await page.get_by_role('textbox', name='Pozicija (FEN)').fill('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'); await page.wait_for_timeout(1500)
        st = await page.locator('.cms-chess-status').last.inner_text()
        check('Diagram via Insert → "Dodaj šahovski dijagram" previews a valid position', st.startswith('✓ Pozicija je ispravna') and 'bijeli' in st, st.split('\n')[-1])
        await page.get_by_role('textbox', name='Pozicija (FEN)').fill('ovo nije FEN'); await page.wait_for_timeout(1200)
        st = await page.locator('.cms-chess-status').last.inner_text()
        check('Invalid FEN shows a diagram-specific error', st.startswith('⚠ Neispravna FEN pozicija'), st.replace('\n', ' | ')[:120])
        await page.get_by_role('textbox', name='Pozicija (FEN)').fill('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'); await page.wait_for_timeout(800)
        await page.get_by_role('button', name='Save', exact=True).click(); await page.wait_for_timeout(3000)
        md = await page.evaluate(READ_FILE, 'src/content/blog/hr/test-dijagrama/index.md')
        check('Diagram saved as ```fen block', '```fen\n6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1\n```' in md)
        open(os.path.join(OUT, 'wf_diagram.md'), 'w').write(md)
        # ---- training schedule editor (config bug fixed earlier) ----
        await page.goto(BASE + '#/collections/data', wait_until='networkidle'); await page.wait_for_timeout(2500)
        await page.get_by_text('Raspored treninga', exact=True).first.click(); await page.wait_for_timeout(2500)
        await page.get_by_role('button', name=re.compile(r'Add\W*Redoviti tjedni')).click(); await page.wait_for_timeout(800)
        await page.get_by_role('textbox', name='ID (jedinstven, bez razmaka)').last.fill('pocetnici-utorak')
        day = page.get_by_role('combobox').last
        await day.click(); await page.get_by_role('option', name='Utorak').click()
        await page.get_by_label('Početak', exact=True).last.fill('17:00')
        await page.get_by_label('Kraj (neobavezno)', exact=True).last.fill('18:30')
        await page.get_by_role('textbox', name='Grupa', exact=True).last.fill('Početnici – čćžšđ')
        rg = page.get_by_role('radiogroup').filter(has_text='Održava se').last
        opts = [t.strip() for t in (await rg.inner_text()).split('\n') if t.strip()]
        check('Schedule status options list the 4 Croatian statuses', opts == ['Održava se', 'Otkazano', 'Promjena termina', 'Najava uskoro'], str(opts))
        await rg.get_by_role('radio', name='Otkazano').click()
        await page.get_by_role('button', name='Save', exact=True).click(); await page.wait_for_timeout(3000)
        tj = json.loads(await page.evaluate(READ_FILE, 'src/data/training.json'))
        s0 = next((x for x in tj.get('sessions', []) if x.get('id') == 'pocetnici-utorak'), {})
        check('Schedule saved as valid JSON with the new session', s0.get('id') == 'pocetnici-utorak' and s0.get('day') == 'tuesday' and s0.get('status') == 'cancelled' and s0.get('group') == 'Početnici – čćžšđ', json.dumps(s0, ensure_ascii=False))
        open(os.path.join(OUT, 'wf_training.json'), 'w').write(json.dumps(tj, ensure_ascii=False, indent=2))
        print('LOGS', [l for l in logs if 'Failed to load resource' not in l][:5])
        await b.close()
        # ---- CMS on a phone ----
        b, page, logs = await start(p, width=390)
        await page.set_viewport_size({'width': 390, 'height': 844})
        await page.goto(BASE + '#/collections/blog-hr', wait_until='networkidle'); await page.wait_for_timeout(3500)
        await page.screenshot(path=os.path.join(OUT, 'cms_mobile_list.png'))
        await page.get_by_text('Demonstracija', exact=False).first.click(); await page.wait_for_timeout(3500)
        await page.screenshot(path=os.path.join(OUT, 'cms_mobile.png'))
        sw = await page.evaluate('document.documentElement.scrollWidth')
        check('CMS editor on a 390px phone has no horizontal overflow', sw <= 392, f'scrollWidth {sw}')
        check('CMS chess button reachable on a 390px phone', await page.get_by_role('button', name='Dodaj šahovsku partiju').count() == 1)
        await b.close()
    print(f"\n{sum(ok for _, ok in RESULTS)}/{len(RESULTS)} extra checks passed")
asyncio.run(main())
