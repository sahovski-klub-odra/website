"""End-to-end editor workflow in the REAL Sveltia CMS (test-repo backend). Prints PASS/FAIL per check."""
import asyncio, os, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from cms import *
RESULTS = []
def check(name, ok, detail=''):
    RESULTS.append((name, bool(ok))); print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))

READ_FILE = '''async (path) => {
  let d = await (await navigator.storage.getDirectory()).getDirectoryHandle('sveltia-cms-test');
  const parts = path.split('/'); const name = parts.pop();
  for (const p of parts) d = await d.getDirectoryHandle(p);
  return await (await (await d.getFileHandle(name)).getFile()).text();
}'''
LIST_DIR = '''async (path) => {
  let d = await (await navigator.storage.getDirectory()).getDirectoryHandle('sveltia-cms-test');
  for (const p of path.split('/')) d = await d.getDirectoryHandle(p);
  const out = []; for await (const [n] of d.entries()) out.push(n); return out.sort();
}'''

PGN1 = '''[Event "Turnir u Zagrebu – test"]
[White "Đurđević, Žarko"]
[Black "Čubrić, Šime"]
[Result "1-0"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6?? {Školski mat – čćžšđ.} 4. Qxf7# 1-0'''
BAD = '''[White "Pogrešan, Zapis"]
[Black "Test"]

1. e4 e5 2. Ke3 Nf6 *'''

async def start(p, **kw):
    b, page, logs = await open_cms(p, height=1200, **kw)
    await page.get_by_role('button', name='Start Demo').click(); await page.wait_for_timeout(3000)
    if await page.get_by_role('button', name='Get Started').count():
        await page.get_by_role('button', name='Get Started').click(); await page.wait_for_timeout(400)
    return b, page, logs

async def main():
    async with async_playwright() as p:
        b, page, logs = await start(p)
        # ---------- 1. create article ----------
        await page.get_by_role('button', name='Create New Entry').click(); await page.wait_for_timeout(2500)
        await page.get_by_role('textbox', name='Naslov', exact=True).fill('Test: izvještaj s partijama – čćžšđ ČĆŽŠĐ')
        await page.get_by_role('textbox', name='Adresa (neobavezno)', exact=True).fill('test-izvjestaj-partije')
        await page.get_by_role('textbox', name='Kratki opis (SEO opis)', exact=True).fill('Automatski test unosa šahovskih partija u CMS-u.')
        ed = page.locator('[contenteditable=true]').first
        await ed.click(); await page.keyboard.type('Uvodni odlomak prije partije – čćžšđ.'); await page.keyboard.press('Enter')
        # ---------- 2. toolbar button ----------
        btn = page.get_by_role('button', name='Dodaj šahovsku partiju')
        check('Toolbar button "Dodaj šahovsku partiju" is visible', await btn.is_visible())
        await btn.click(); await page.wait_for_timeout(1200)
        pgn_fields = page.get_by_role('textbox', name='PGN zapis – zalijepite partiju (ili više partija)')
        check('Clicking it inserts a chess component with a PGN field', await pgn_fields.count() == 1, f'{await pgn_fields.count()} PGN fields')
        await page.get_by_role('textbox', name='Naslov iznad ploče (neobavezno)').last.fill('1. kolo: Đurđević – Čubrić')
        await pgn_fields.last.fill(PGN1); await page.wait_for_timeout(1500)
        st = await page.locator('.cms-chess-status').last.inner_text()
        check('Preview validates pasted PGN', st.startswith('✓'), st.replace('\n', ' | ')[:120])
        check('Preview renders an interactive board', await page.locator('.cms-chess .pgnv-board svg').count() >= 1)
        await page.screenshot(path=os.path.join(OUT, 'wf_1_pasted.png'))
        # ---------- 3. text after the game (click below the component, as an editor would) ----------
        async def type_at_end(text):
            # click the empty line below the last game (Sveltia keeps an empty paragraph there), then type
            await ed.locator(':scope > p').last.click()
            await page.keyboard.press('End'); await page.keyboard.type(text); await page.keyboard.press('Enter')
        await type_at_end('Tekst između partija.')
        check('Text typed after the game lands in the article, not in the PGN field',
              'Tekst između partija' not in await pgn_fields.first.input_value())
        # ---------- 4. second game: upload a .pgn file with 2 games ----------
        await btn.dispatch_event('click'); await page.wait_for_timeout(1200)
        await page.get_by_role('textbox', name='Naslov iznad ploče (neobavezno)').last.fill('3. kolo – sve partije')
        # exactly what an editor does: Browse → Upload → choose file → Insert
        await page.get_by_role('button', name='Browse').last.click(); await page.wait_for_timeout(800)
        dlg = page.get_by_role('dialog')
        async with page.expect_file_chooser() as fc:
            await dlg.get_by_role('button', name='Upload').click()
        await (await fc.value).set_files(os.path.join(HERE, 'files', 'kolo-3.pgn')); await page.wait_for_timeout(1500)
        await dlg.get_by_role('button', name='Insert', exact=True).click(); await page.wait_for_timeout(2500)
        await page.screenshot(path=os.path.join(OUT, 'wf_2_uploaded.png'))
        st = await page.locator('.cms-chess-status').last.inner_text()
        check('Uploaded .pgn file is read and validated in the preview (before saving)', st.startswith('✓') and 'Obje partije' in st, st.replace('\n', ' | ')[:140])
        sel = page.locator('.cms-chess select.pgnv-select').last
        check('Preview of a multi-game file offers a game selector', await sel.count() == 1 and len(await sel.locator('option').all_inner_texts()) == 2,
              ' / '.join(await sel.locator('option').all_inner_texts()) if await sel.count() else 'no selector')
        await type_at_end('Tekst nakon druge partije.')
        # ---------- 5. third game: invalid PGN ----------
        await btn.dispatch_event('click'); await page.wait_for_timeout(1200)
        await pgn_fields.last.fill(BAD); await page.wait_for_timeout(1500)
        st = await page.locator('.cms-chess-status').last.inner_text()
        check('Invalid PGN shows a clear error with the exact move', st.startswith('⚠') and 'Ke3' in st, st.replace('\n', ' | ')[:160])
        await page.locator('.cms-chess-status').last.scroll_into_view_if_needed(); await page.screenshot(path=os.path.join(OUT, 'wf_3_invalid.png'))
        await type_at_end('Završni odlomak.')
        # ---------- 6. save ----------
        await page.get_by_role('button', name='Save', exact=True).click(); await page.wait_for_timeout(3000)
        await page.screenshot(path=os.path.join(OUT, 'wf_4_saved.png'))
        # the folder name comes from the title; the typed address is stored as `slug` (the page URL)
        folder = 'src/content/blog/hr/' + next(d for d in await page.evaluate(LIST_DIR, 'src/content/blog/hr') if d.startswith('test-izvjestaj'))
        try:
            files = await page.evaluate(LIST_DIR, folder)
        except Exception as e:
            files = [f'ERROR {e}']
        print('   saved files:', files)
        md = await page.evaluate(READ_FILE, folder + '/index.md')
        open(os.path.join(OUT, 'wf_saved.md'), 'w').write(md)
        check('Article saved as index.md with the uploaded .pgn next to it', 'index.md' in files and 'kolo-3.pgn' in files, str(files))
        pgn_saved = await page.evaluate(READ_FILE, folder + '/kolo-3.pgn') if 'kolo-3.pgn' in files else ''
        check('Uploaded .pgn stored byte-for-byte (incl. čćžšđ)', pgn_saved == open(os.path.join(HERE, 'files', 'kolo-3.pgn')).read())
        body = md.split('---', 2)[2] if md.count('---') >= 2 else md
        order = [body.find(x) for x in ['Uvodni odlomak', '```pgn 1. kolo', 'Tekst između partija', '[3. kolo – sve partije](kolo-3.pgn)', 'Tekst nakon druge partije', 'Pogrešan, Zapis', 'Završni odlomak']]
        check('Games are at the positions where they were inserted', all(i >= 0 for i in order) and order == sorted(order), str(order))
        check('Pasted PGN saved unchanged (comments, ?? , Croatian letters)', PGN1 in body)
        check('Croatian title preserved', 'Test: izvještaj s partijama – čćžšđ ČĆŽŠĐ' in md)
        # ---------- 7. reopen ----------
        await page.goto(BASE + '#/collections/blog-hr', wait_until='networkidle'); await page.wait_for_timeout(2500)
        await page.get_by_text('Test: izvještaj s partijama').click(); await page.wait_for_timeout(3000)
        print('   reopened structure:', await page.evaluate("()=>[...document.querySelector('[contenteditable=true]').children].map(e=>e.tagName+(e.className?'.'+String(e.className).split(' ')[0]:'')+':'+(e.innerText||'').slice(0,30).replace(/\\n/g,' '))"))
        print('   textareas in components:', await page.locator('[contenteditable=true] .component textarea').count(), '| expand buttons:', await page.locator('[contenteditable=true] .component button[aria-expanded]').evaluate_all("els=>els.map(e=>e.getAttribute('aria-expanded'))"))
        await page.screenshot(path=os.path.join(OUT, 'wf_reopen.png'))
        comps = page.locator('[contenteditable=true] > .component')
        for i in range(await comps.count()):
            await comps.nth(i).scroll_into_view_if_needed(); await page.wait_for_timeout(700)
        vals = [await f.input_value() for f in await page.get_by_role('textbox', name='PGN zapis – zalijepite partiju (ili više partija)').all()]
        print('   PGN fields after scrolling through the article:', len(vals))
        check('Reopened article shows all 3 games', await comps.count() == 3 and len(vals) == 3, f'{await comps.count()} components, {len(vals)} PGN fields')
        check('Reopened pasted PGN is identical', len(vals) >= 1 and vals[0] == PGN1)
        check('Reopened file game still points to kolo-3.pgn', await page.get_by_text('kolo-3.pgn').count() >= 1)
        statuses = await page.locator('.cms-chess-status').all_inner_texts()
        check('Reopened previews: 2 valid + 1 error', len(statuses) == 3 and statuses[0].startswith('✓') and statuses[1].startswith('✓') and statuses[2].startswith('⚠'), ' || '.join(x.split('\n')[0] for x in statuses))
        # ---------- 8. edit text only, save, notation must be unchanged ----------
        ed = page.locator('[contenteditable=true]').first
        await ed.locator(':scope > p').last.click(); await page.keyboard.press('End'); await page.keyboard.type(' Dopuna.')
        await page.get_by_role('button', name='Save', exact=True).click(); await page.wait_for_timeout(3000)
        md2 = await page.evaluate(READ_FILE, folder + '/index.md'); open(os.path.join(OUT, 'wf_saved2.md'), 'w').write(md2)
        import re
        blocks = lambda t: re.findall(r'```pgn[\s\S]*?```|\[[^\]\n]*\]\([^)]*\.pgn\)', t)
        check('Editing other text and saving again leaves every chess block byte-identical', blocks(md) == blocks(md2) and 'Dopuna.' in md2, f'{len(blocks(md))} blocks')
        # ---------- 9. existing article: open, change description, save ----------
        await page.goto(BASE + '#/collections/blog-hr', wait_until='networkidle'); await page.wait_for_timeout(2500)
        orig = await page.evaluate(READ_FILE, 'src/content/blog/hr/demo-sahovske-partije/index.md')
        await page.get_by_text('Demonstracija: interaktivni').click(); await page.wait_for_timeout(3000)
        await page.get_by_role('textbox', name='Kratki opis (SEO opis)', exact=True).fill('Probni članak – opis izmijenjen u CMS-u (čćžšđ).')
        await page.get_by_role('button', name='Save', exact=True).click(); await page.wait_for_timeout(3000)
        after = await page.evaluate(READ_FILE, 'src/content/blog/hr/demo-sahovske-partije/index.md')
        open(os.path.join(OUT, 'wf_demo_after.md'), 'w').write(after)
        bo, ba = orig.split('---', 2)[2], after.split('---', 2)[2]
        check('Saving an existing article keeps its chess blocks identical', blocks(bo) == blocks(ba), f'{len(blocks(bo))} → {len(blocks(ba))} blocks')
        check('…including the FEN diagram block', '```fen\n6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1\n```' in ba)
        print('LOGS', [l for l in logs if 'Failed to load resource' not in l][:5]); print('UNPKG misses', misses)
        await b.close()
    print(f"\n{sum(ok for _, ok in RESULTS)}/{len(RESULTS)} checks passed")
if __name__ == "__main__": asyncio.run(main())
