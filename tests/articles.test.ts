/**
 * Unit tests for article rendering helpers:
 *  - the featured photo is not repeated inside the article text (remark-featured-dedupe)
 *  - Croatian alphabetical sorting of players by surname
 * Run with: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { VFile } from 'vfile';
import { remarkFeaturedDedupe } from '../src/lib/remark-featured-dedupe.mjs';

function render(md: string, frontmatter: Record<string, unknown>, dir: string) {
  const file = new VFile({ path: join(dir, 'index.md'), value: md });
  file.data = { astro: { frontmatter } };
  return String(unified().use(remarkParse).use(remarkFeaturedDedupe).use(remarkRehype).use(rehypeStringify).processSync(file));
}

function articleDir() {
  const dir = mkdtempSync(join(tmpdir(), 'odra-article-'));
  writeFileSync(join(dir, 'naslovna.jpg'), 'photo A');
  copyFileSync(join(dir, 'naslovna.jpg'), join(dir, 'naslovna-kopija.jpg')); // same photo, another name
  writeFileSync(join(dir, 'druga.jpg'), 'photo B');
  return dir;
}

test('featured photo is removed from the text, other photos stay', () => {
  const dir = articleDir();
  const html = render('Uvod\n\n![](./naslovna.jpg)\n\nTekst ![](./druga.jpg)', { image: './naslovna.jpg' }, dir);
  assert.ok(!html.includes('naslovna.jpg'));
  assert.ok(html.includes('druga.jpg'));
  assert.ok(html.includes('Uvod') && html.includes('Tekst'));
});

test('a byte-identical copy under another name and repeated photos are shown once', () => {
  const dir = articleDir();
  const html = render('![](./naslovna-kopija.jpg)\n\n![](./druga.jpg) ![](./druga.jpg)', { image: './naslovna.jpg' }, dir);
  assert.ok(!html.includes('naslovna-kopija.jpg'));
  assert.equal(html.match(/druga\.jpg/g)?.length, 1);
});

test('bold text around a removed photo keeps its formatting', () => {
  const dir = articleDir();
  const html = render('**Seniori, 2. kolo  \n![](./naslovna.jpg)**[Drugo kolo](https://chess-results.com) lige', { image: './naslovna.jpg' }, dir);
  assert.ok(html.includes('<strong>Seniori, 2. kolo'));
  assert.ok(!html.includes('**'));
});

test('articles without a featured photo are unchanged', () => {
  const dir = articleDir();
  const html = render('![](./naslovna.jpg)', {}, dir);
  assert.ok(html.includes('naslovna.jpg'));
});

test('players are sorted by surname with Croatian rules, then by first name', () => {
  const collator = new Intl.Collator('hr', { sensitivity: 'base' });
  const parts = (n: string) => { const p = n.split(' '); return { s: p.at(-1)!, f: p.slice(0, -1).join(' ') }; };
  const names = ['Ivan Šoš', 'Ana Čubrić', 'Marko Cvetković', 'Luka Ćosić', 'Ivo Zec', 'Ana Cvetković', 'Petra Đurić', 'Dino Dalić', 'Lea Ljubić', 'Iva Lukić'];
  const sorted = [...names].sort((a, b) => collator.compare(parts(a).s, parts(b).s) || collator.compare(parts(a).f, parts(b).f));
  assert.deepEqual(sorted, ['Ana Cvetković', 'Marko Cvetković', 'Ana Čubrić', 'Luka Ćosić', 'Dino Dalić', 'Petra Đurić', 'Iva Lukić', 'Lea Ljubić', 'Ivan Šoš', 'Ivo Zec']);
});
