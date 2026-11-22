"""
Admin coverage test: drives the real Sveltia CMS through every section an administrator uses and
saves the results to tests/cms/output/saved/ (same layout as the repository), so that
tests/cms/build-saved.sh can build the website with exactly what the CMS wrote.

  - Croatian interface by default
  - Novosti: new article with featured image, image in the text, YouTube link, table, heading, list,
    link, categories/tags, SEO fields, draft → publish; delete an article
  - Članovi: add a member with a photo, move up, remove another member
  - Galerija: album with several photos uploaded at once + category
  - Raspored: announcement
  - Postavke: phone, social link, map coordinates
"""
import asyncio, os, re, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from workflow import check, RESULTS, READ_FILE, LIST_DIR
from cms import *

FILES = os.path.join(HERE, 'files')
SAVED = os.path.join(OUT, 'saved')

READ_BYTES = '''async (path) => {
  let dir = await navigator.storage.getDirectory();
  dir = await dir.getDirectoryHandle('sveltia-cms-test');
  const parts = path.split('/'); const name = parts.pop();
  for (const p of parts) dir = await dir.getDirectoryHandle(p);
  const f = await (await dir.getFileHandle(name)).getFile();
  return Array.from(new Uint8Array(await f.arrayBuffer()));
}'''


async def save_tree(page, path):
    """copy a folder (or file) from the CMS test repository to tests/cms/output/saved/"""
    try:
        names = await page.evaluate(LIST_DIR, path)
    except Exception:
        names = None
    if names is None:
        data = bytes(await page.evaluate(READ_BYTES, path))
        dest = os.path.join(SAVED, path); os.makedirs(os.path.dirname(dest), exist_ok=True)
        open(dest, 'wb').write(data)
        return
    for n in names:
        await save_tree(page, f'{path}/{n}')


async def start(p, **kw):
    b, page, logs = await open_cms(p, height=1200, **kw)
    await page.get_by_role('button', name=re.compile('Start Demo|Pokreni demo|Demo')).first.click(); await page.wait_for_timeout(3000)
    gs = page.get_by_role('button', name=re.compile('Get Started|Započni'))
    if await gs.count(): await gs.first.click(); await page.wait_for_timeout(400)
    return b, page, logs


async def upload(page, files, field_scope=None):
    """Browse → Upload → choose file(s) → Insert, in the asset dialog of the last image field"""
    scope = field_scope or page
    await scope.get_by_role('button', name='Browse').last.click(); await page.wait_for_timeout(800)
    async with page.expect_file_chooser() as fc:
        await page.get_by_role('button', name=re.compile('^Upload')).last.click()
    await (await fc.value).set_files(files); await page.wait_for_timeout(1500)
    ins = page.get_by_role('button', name=re.compile('^(Insert|Select|Choose)'))
    if await ins.count() and await ins.last.is_enabled(): await ins.last.click(); await page.wait_for_timeout(900)


async def save(page):
    await page.get_by_role('button', name='Save', exact=True).click(); await page.wait_for_timeout(3500)


async def open_entry(page, collection, text):
    """open an entry from the collection list by (part of) its title – as an editor would"""
    await page.goto(BASE + f'#/collections/{collection}', wait_until='networkidle'); await page.wait_for_timeout(2500)
    await page.get_by_text(text, exact=False).first.click(); await page.wait_for_timeout(3000)


async def scroll_to(page, locator, max_steps=80):
    """Sveltia draws long forms lazily – scroll the editor pane until `locator` exists"""
    for _ in range(max_steps):
        if await locator.count():
            await locator.first.scroll_into_view_if_needed(); return locator
        await page.evaluate('''() => {
          const el = [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY))
            .sort((a, b) => b.clientHeight - a.clientHeight)[0];
          if (el) el.scrollTop += 500;
        }''')
        await page.wait_for_timeout(150)
    return locator


async def field(page, label):
    """the container of a field, found by its label"""
    return page.locator('section, [role=group], div').filter(has=page.get_by_text(label, exact=True)).last


async def main():
    import shutil
    shutil.rmtree(SAVED, ignore_errors=True)
    async with async_playwright() as p:
        # ---------- Croatian interface by default ----------
        b, page, logs = await open_cms(p, ui_locale=None)
        await page.wait_for_timeout(1500)
        body = await page.inner_text('body')
        check('Admin opens in Croatian by default', 'Dobrodošli' in body or 'Prijav' in body, body.strip().split('\n')[0][:80])
        await b.close()

        b, page, logs = await start(p)
        # ---------- Novosti: new article ----------
        await page.goto(BASE + '#/collections/blog-hr/new', wait_until='networkidle'); await page.wait_for_timeout(2500)
        # no address typed: it must come from the title, without diacritics (đ included)
        await page.get_by_role('textbox', name='Naslov', exact=True).fill('Božićni turnir 2026 – izvještaj, Đurđevac')
        await page.get_by_role('textbox', name='Kratki opis (SEO opis)', exact=True).fill('Izvještaj s klupskog Božićnog turnira.')
        await page.get_by_role('textbox', name='SEO naslov (neobavezno)', exact=True).fill('Božićni turnir 2026')
        # featured image
        cover = page.locator('section, div').filter(has=page.get_by_text('Naslovna fotografija', exact=True)).filter(has=page.get_by_role('button', name='Browse')).last
        await upload(page, os.path.join(FILES, 'foto-1.jpg'), cover)
        await page.get_by_role('textbox', name='Opis naslovne fotografije (za slabovidne)', exact=True).fill('Igrači za pločom')
        # categories / tags (comma separated text in Sveltia's simple list)
        items = page.get_by_role('textbox', name='Item Value')
        await items.nth(0).fill('Turniri')
        await page.get_by_role('button', name=re.compile(r'Add\W*Kategorije')).click(); await page.wait_for_timeout(300)
        await page.get_by_role('textbox', name='Item Value').nth(1).fill('Klupske vijesti')
        await page.get_by_role('textbox', name='Item Value').nth(2).fill('blitz')
        # body: heading, paragraph with link, list, image, YouTube line, table
        ed = page.locator('[contenteditable=true]').first
        await ed.click()
        await page.keyboard.type('## Rezultati'); await page.keyboard.press('Enter')
        await page.keyboard.type('Pobijedio je Ivo, a čestitamo i ostalima – čćžšđ.'); await page.keyboard.press('Enter')
        await page.keyboard.type('- prvo mjesto'); await page.keyboard.press('Enter')
        await page.keyboard.type('drugo mjesto'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter')
        await page.keyboard.type('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); await page.keyboard.press('Enter')
        # table (Sveltia's own table tool: rows × columns, then type into the cells)
        await page.get_by_role('button', name='Insert Table').click(); await page.wait_for_timeout(600)
        await page.get_by_role('spinbutton').first.fill('2'); await page.get_by_role('spinbutton').nth(1).fill('2')
        await page.get_by_role('button', name='Insert', exact=True).last.click(); await page.wait_for_timeout(800)
        for cell in ('Igrač', 'Bodovi', 'Ivo', '5'):
            await page.keyboard.type(cell); await page.keyboard.press('Tab')
        # image inside the text (toolbar image button)
        img_btn = page.get_by_role('button', name=re.compile('^(Insert Image|Image|Slika)$', re.I))
        if await img_btn.count():
            await ed.locator(':scope > p').last.click()
            await img_btn.first.click(); await page.wait_for_timeout(900)
            await upload(page, os.path.join(FILES, 'foto-2.jpg'))
        # save as draft first
        draft = page.get_by_role('switch', name=re.compile('Skica'))
        if not await draft.count(): draft = page.get_by_role('checkbox', name=re.compile('Skica'))
        await draft.first.click(); await page.wait_for_timeout(300)
        await save(page)
        folder = 'src/content/blog/hr/bozicni-turnir-2026-izvjestaj-durdevac'
        hr_dirs = await page.evaluate(LIST_DIR, 'src/content/blog/hr')
        check('Web address generated from the title (no diacritics)', 'bozicni-turnir-2026-izvjestaj-durdevac' in hr_dirs, str(hr_dirs))
        md = await page.evaluate(READ_FILE, folder + '/index.md')
        files = await page.evaluate(LIST_DIR, folder)
        open(os.path.join(OUT, 'admin_article_draft.md'), 'w').write(md)
        check('New article saved as a draft', 'draft: true' in md)
        # uploads are converted to WebP in the browser (media_libraries → transformations), never AVIF
        check('Featured image uploaded next to the article, converted to WebP', 'foto-1.webp' in files and re.search(r'^image: foto-1\.webp', md, re.M), str(files))
        check('Heading, list, link line, YouTube line in the text', '## Rezultati' in md and re.search(r'^[-*] prvo mjesto', md, re.M) and 'youtube.com/watch?v=dQw4w9WgXcQ' in md)
        check('Table saved as a Markdown table', bool(re.search(r'\|\s*Igrač\s*\|\s*Bodovi\s*\|', md)) and bool(re.search(r'\|\s*Ivo\s*\|\s*5\s*\|', md)), md[md.find('|'):md.find('|') + 120] if '|' in md else 'no table')
        check('Image inserted in the text (WebP)', bool(re.search(r'!\[[^\]]*\]\((\./)?foto-2\.webp\)', md)) and 'foto-2.webp' in files, re.findall(r'!\[[^\]]*\]\([^)]*\)', md)[:2])
        check('Categories, tags and SEO fields saved', bool(re.search(r'categories:\n\s+- Turniri\n\s+- Klupske vijesti', md)) and 'blitz' in md and 'seoTitle: Božićni turnir 2026' in md, re.search(r'categories:[\s\S]{0,80}', md).group(0).replace('\n', ' | '))
        # publish: reopen, untick draft, save
        await open_entry(page, 'blog-hr', 'Božićni turnir 2026')
        draft = page.get_by_role('switch', name=re.compile('Skica'))
        if not await draft.count(): draft = page.get_by_role('checkbox', name=re.compile('Skica'))
        await draft.first.click(); await page.wait_for_timeout(300)
        await save(page)
        md = await page.evaluate(READ_FILE, folder + '/index.md')
        check('Unticking "Skica" and saving publishes the article', 'draft: false' in md)
        await save_tree(page, folder)
        open(os.path.join(OUT, 'admin_article.md'), 'w').write(md)

        # ---------- delete an article ----------
        before = await page.evaluate(LIST_DIR, 'src/content/blog/hr')
        await open_entry(page, 'blog-hr', 'Demonstracija')
        await page.get_by_role('button', name=re.compile('Show Editor Options|More')).first.click(); await page.wait_for_timeout(500)
        await page.get_by_role('menuitem', name=re.compile('^Delete')).click(); await page.wait_for_timeout(600)
        await page.get_by_role('button', name=re.compile('^Delete$')).last.click(); await page.wait_for_timeout(3000)
        after = await page.evaluate(LIST_DIR, 'src/content/blog/hr')
        check('Deleting an article removes its folder', 'demo-sahovske-partije' in before and 'demo-sahovske-partije' not in after, f'{len(before)} → {len(after)}')

        # ---------- members ----------
        await page.goto(BASE + '#/collections/data/entries/members', wait_until='networkidle'); await page.wait_for_timeout(3500)
        n_before = len(json.loads(await page.evaluate(READ_FILE, 'src/data/members.json'))['members'])
        await page.get_by_role('button', name=re.compile(r'Add\W*Članovi')).click(); await page.wait_for_timeout(900)
        await page.get_by_role('textbox', name='Ime i prezime', exact=True).last.fill('Novi Član Čćžšđ')
        await page.get_by_role('textbox', name='Uloga', exact=True).last.fill('Trener')
        photo = page.locator('section, div').filter(has=page.get_by_text('Fotografija', exact=True)).filter(has=page.get_by_role('button', name='Browse')).last
        await upload(page, os.path.join(FILES, 'foto-3.jpg'), photo)
        # move the new (last) member up one place, remove the first member
        await page.get_by_role('button', name='Move Up').last.click(); await page.wait_for_timeout(400)
        # remove "Ana Predović" (smallest element that shows her name and has its own Remove button)
        await scroll_to(page, page.get_by_text('Ana Predović'))
        removed = await page.evaluate('''(name) => {
          const btns = [...document.querySelectorAll('button[aria-label="Remove"]')];
          let best = null;
          for (const b of btns) {
            let el = b.parentElement;
            while (el && !el.textContent.includes(name)) el = el.parentElement;
            if (el && (!best || el.textContent.length < best.el.textContent.length)) best = { el, b };
          }
          return best ? btns.indexOf(best.b) : -1;
        }''', 'Ana Predović')
        if removed >= 0:
            await page.locator('button[aria-label="Remove"]').nth(removed).click(); await page.wait_for_timeout(500)
        removed = removed >= 0
        await save(page)
        mj = json.loads(await page.evaluate(READ_FILE, 'src/data/members.json'))
        names = [m['name'] for m in mj['members']]
        new = next((m for m in mj['members'] if m['name'] == 'Novi Član Čćžšđ'), {})
        check('Member added with role and photo', new.get('role') == 'Trener' and str(new.get('image', '')).startswith('/images/members/') and str(new.get('image', '')).endswith('.webp'), json.dumps(new, ensure_ascii=False)[:160])
        check('Member photo stored in public/images/members (WebP)', 'foto-3.webp' in (await page.evaluate(LIST_DIR, 'public/images/members')))
        check('Reordering and removing members', removed and len(names) == n_before and 'Ana Predović' not in names and names[-1] == 'Novi Član Čćžšđ' and names.index('Novi Član Čćžšđ') == n_before - 1, f'{n_before} → {len(names)}; last two: {names[-2:]}')
        await save_tree(page, 'src/data/members.json'); await save_tree(page, 'public/images/members/foto-3.webp')

        # ---------- gallery: several photos at once + category ----------
        await page.goto(BASE + '#/collections/albums/new', wait_until='networkidle'); await page.wait_for_timeout(2500)
        await page.get_by_role('textbox', name='Naziv albuma', exact=True).fill('Prvenstvo kluba 2026')
        await page.get_by_role('textbox', name='Kategorija', exact=True).fill('Turniri')
        multi = page.locator('section, div').filter(has=page.get_by_text('Dodaj više fotografija odjednom', exact=True)).filter(has=page.get_by_role('button', name='Browse')).last
        await upload(page, [os.path.join(FILES, f'foto-{i}.jpg') for i in (1, 2, 3)], multi)
        await save(page)
        gdirs = await page.evaluate(LIST_DIR, 'src/content/gallery')
        gd = next((d for d in gdirs if 'prvenstvo-kluba-2026' in d), '')
        amd = await page.evaluate(READ_FILE, f'src/content/gallery/{gd}/index.md') if gd else ''
        afiles = await page.evaluate(LIST_DIR, f'src/content/gallery/{gd}') if gd else []
        check('Album with 3 photos uploaded at once', sum(f.startswith('foto-') for f in afiles) == 3 and amd.count('foto-') >= 3, f'{afiles}')
        check('Album category saved', 'category: Turniri' in amd)
        if gd: await save_tree(page, f'src/content/gallery/{gd}')
        open(os.path.join(OUT, 'admin_album.md'), 'w').write(amd)

        # ---------- schedule announcement ----------
        await page.goto(BASE + '#/collections/data/entries/training', wait_until='networkidle'); await page.wait_for_timeout(3000)
        await page.get_by_role('button', name=re.compile(r'Add\W*Obavijesti')).click(); await page.wait_for_timeout(800)
        await page.get_by_role('textbox', name='Tekst obavijesti', exact=True).last.fill('Za vrijeme školskih praznika nema treninga – čćžšđ.')
        await page.get_by_label('Prikaži do', exact=True).last.fill('2099-01-06')
        await save(page)
        tj = json.loads(await page.evaluate(READ_FILE, 'src/data/training.json'))
        check('Schedule announcement saved', tj.get('announcements', [{}])[0].get('text', '').startswith('Za vrijeme školskih praznika'), json.dumps(tj.get('announcements'), ensure_ascii=False)[:150])
        await save_tree(page, 'src/data/training.json')

        # ---------- settings ----------
        await page.goto(BASE + '#/collections/data/entries/site', wait_until='networkidle'); await page.wait_for_timeout(3000)
        await page.get_by_role('textbox', name='Telefon kluba', exact=True).fill('01 234 5678')
        fb = await scroll_to(page, page.get_by_role('textbox', name='Facebook', exact=True))
        await fb.fill('https://www.facebook.com/primjer')
        lat = await scroll_to(page, page.get_by_role('spinbutton', name=re.compile('Geografska širina')))
        await lat.fill('45.7289'); await save(page)
        sj = json.loads(await page.evaluate(READ_FILE, 'src/data/site.json'))
        check('Settings saved (phone, social link, map)', sj.get('phone') == '01 234 5678' and sj['social'].get('facebook') == 'https://www.facebook.com/primjer' and abs(sj['map']['lat'] - 45.7289) < 1e-6, json.dumps({k: sj.get(k) for k in ('phone', 'map')}))
        await save_tree(page, 'src/data/site.json')

        print('LOGS', [l for l in logs if 'Failed to load resource' not in l][:5])
        await b.close()

        # ---------- coach admin (/admin/trener/): schedule only ----------
        b, page, logs = await open_cms(p, height=1200, url=BASE + 'trener/')
        await page.get_by_role('button', name=re.compile('Start Demo')).first.click(); await page.wait_for_timeout(3000)
        body = await page.inner_text('body')
        gs = page.get_by_role('button', name=re.compile('Get Started'))
        if await gs.count(): await gs.first.click(); await page.wait_for_timeout(400)
        check('Coach admin shows only the training schedule', 'Raspored treninga' in body and 'Novosti' not in body and 'Članovi kluba' not in body, body.replace('\n', ' | ')[:160])
        await page.goto(BASE + 'trener/#/collections/data/entries/training', wait_until='networkidle'); await page.wait_for_timeout(3000)
        add = await scroll_to(page, page.get_by_role('button', name=re.compile(r'Add\W*Iznimke')))
        await add.click(); await page.wait_for_timeout(800)
        await page.get_by_label('Datum treninga', exact=True).last.fill('2099-12-01')
        # "Koji trening": radio buttons (≤ 5 sessions) or a dropdown
        label = 'Utorak 19:00 – Šahovska škola – mlađa skupina'
        radios = page.get_by_role('radio', name=label)
        if await radios.count(): await radios.last.click()
        else:
            await page.get_by_role('combobox').last.click(); await page.get_by_role('option', name=label).click()
        await page.get_by_role('radio', name='Otkazano').last.click()
        await page.get_by_role('textbox', name='Napomena', exact=True).last.fill('Trener je bolestan – čćžšđ')
        await save(page)
        tj = json.loads(await page.evaluate(READ_FILE, 'src/data/training.json'))
        ex = [e for e in tj.get('exceptions', []) if e.get('date') == '2099-12-01']
        check('Coach cancels one training (exception saved)', ex and ex[0].get('status') == 'cancelled' and ex[0].get('sessionId') == 'mladja-utorak', json.dumps(ex, ensure_ascii=False)[:150])
        await b.close()
    print(f"\n{sum(ok for _, ok in RESULTS)}/{len(RESULTS)} admin checks passed")

if __name__ == '__main__':
    asyncio.run(main())
