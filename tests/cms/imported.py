"""
Imported WordPress articles in the real Sveltia CMS: open, edit text, change the title, add a category,
save – then check that nothing else in the file changed (chess games, images, galleries, tables,
links, front matter such as the WordPress ID used for redirects).

Run with the harness seeded with these articles, e.g.:
  SEED_ARTICLES="slug-a|slug-b" tests/cms/make-site.sh
"""
import asyncio, os, re, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from workflow import check, RESULTS, READ_FILE
from cms import *
from admin import start, open_entry, save, scroll_to

REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
ARTICLES = [a for a in os.environ.get('SEED_ARTICLES', '').split('|') if a and a != 'demo-sahovske-partije']


def parts(md):
    fm, body = md.split('\n---\n', 1) if md.startswith('---') else ('', md)
    return {
        'pgn': re.findall(r'^```(?:pgn|fen)[^\n]*\n[\s\S]*?\n```', body, re.M),
        'images': re.findall(r'!\[[^\]]*\]\(([^)\s]+)', body) + re.findall(r'<img\b[^>]*src="([^"]+)"', body),
        'links': sorted(re.findall(r'(?<!!)\[[^\]]*\]\(([^)\s]+)', body)),
        'table_rows': len(re.findall(r'^\|.*\|\s*$', body, re.M)) + body.count('<tr'),
        'details': body.count('<details'),  # quiz solutions converted from the old quiz plugin
        'wp_id': re.search(r'^\s+id:\s*(\d+)', fm, re.M).group(1) if re.search(r'^\s+id:\s*(\d+)', fm, re.M) else None,
        'words': len(re.findall(r'\w+', re.sub(r'```[\s\S]*?```|<[^>]+>|\([^)]*\)', ' ', body))),
    }


async def main():
    async with async_playwright() as p:
        b, page, logs = await start(p)
        for slug in ARTICLES:
            path = f'src/content/blog/hr/{slug}/index.md'
            before = open(os.path.join(REPO, path), encoding='utf8').read()
            title = re.search(r'^title:\s*"?(.*?)"?\s*$', before, re.M).group(1).replace('\\"', '"')
            a = parts(before)
            await open_entry(page, 'blog-hr', title[:40])
            body = await page.inner_text('body')
            check(f'[{slug[:38]}] opens in the editor', title[:20] in body and 'Uredi' in body or 'Edit' in body)
            # edit: title, one more category, a sentence at the end of the text
            t = page.get_by_role('textbox', name='Naslov', exact=True)
            await t.fill(title + ' (uređeno)')
            add = await scroll_to(page, page.get_by_role('button', name=re.compile(r'Add\W*Kategorije')))
            await add.first.click(); await page.wait_for_timeout(300)
            cats = page.get_by_role('textbox', name='Item Value')
            await cats.nth(await cats.count() - 1 if False else 0).wait_for()
            # the new (empty) category input is the last empty one before the tags list
            empty = [i for i in range(await cats.count()) if not await cats.nth(i).input_value()]
            if empty: await cats.nth(empty[0]).fill('Test kategorija')
            ed = page.locator('[contenteditable=true]').first
            await scroll_to(page, ed)
            has_p = await ed.locator(':scope > p').count() > 0
            if has_p:
                last = ed.locator(':scope > p').last
                await last.scroll_into_view_if_needed(); await last.click()
                await ed.focus(); await page.keyboard.press('Control+End')
                await page.keyboard.type(' Dodano u CMS-u – čćžšđ.')
            await save(page)
            after = await page.evaluate(READ_FILE, path)
            open(os.path.join(OUT, f'imported_{slug[:40]}.md'), 'w').write(after)
            b2 = parts(after)
            check(f'[{slug[:38]}] edit saved (title, category{", text" if has_p else ""})', '(uređeno)' in after and re.search(r'^\s+- Test kategorija$', after, re.M) and (not has_p or 'Dodano u CMS-u – čćžšđ.' in after))
            check(f'[{slug[:38]}] chess games byte-identical ({len(a["pgn"])})', a['pgn'] == b2['pgn'], f'{len(a["pgn"])} → {len(b2["pgn"])}')
            check(f'[{slug[:38]}] images kept in order ({len(a["images"])})', a['images'] == b2['images'], f'{a["images"][:3]} → {b2["images"][:3]}')
            check(f'[{slug[:38]}] links kept ({len(a["links"])})', a['links'] == b2['links'], str(set(a['links']) ^ set(b2['links']))[:160])
            check(f'[{slug[:38]}] tables kept ({a["table_rows"]} rows)', a['table_rows'] == b2['table_rows'], f'{a["table_rows"]} → {b2["table_rows"]}')
            if a['details']:
                check(f'[{slug[:38]}] quiz solutions kept ({a["details"]})', a['details'] == b2['details'], f'{a["details"]} → {b2["details"]}')
            check(f'[{slug[:38]}] WordPress ID kept (redirects)', a['wp_id'] == b2['wp_id'])
            check(f'[{slug[:38]}] text complete', b2['words'] >= a['words'] + (3 if has_p else 0), f'{a["words"]} → {b2["words"]} words')
        print('LOGS', [l for l in logs if 'Failed to load resource' not in l][:5])
        await b.close()
    print(f"\n{sum(ok for _, ok in RESULTS)}/{len(RESULTS)} imported-article checks passed")

if __name__ == '__main__':
    asyncio.run(main())
