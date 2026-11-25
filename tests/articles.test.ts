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

// ---------- Lichess daily puzzle ----------
import { parseDaily, checkMove } from '../src/lib/lichess-puzzle';

const API_SAMPLE = {
  game: { id: '8gDESBCS', pgn: 'd4 Nf6 c4 g6 Nc3 d5 Nf3 Bg7 Bg5 Ne4 Nxe4 dxe4 Nd2 Qxd4 e3 Qe5 Bf4 Qa5 Qc2 f5 Rb1 O-O a3 Nc6 b4 Qxa3 b5 Ne5 Bxe5 Bxe5 Be2 Be6 O-O Rad8 c5 Bc3' },
  puzzle: {
    id: 'p8UOi', rating: 1911, solution: ['d2c4', 'a3c5', 'c2c3'], themes: ['middlegame', 'short', 'advantage'],
    fen: '3r1rk1/ppp1p2p/4b1p1/1PP2p2/4p3/q1b1P3/2QNBPPP/1R3RK1 w - - 1 1', lastMove: 'e5c3', initialPly: 35,
  },
};

test('daily puzzle: API answer with a FEN is used as is', () => {
  const p = parseDaily(API_SAMPLE);
  assert.equal(p.id, 'p8UOi');
  assert.equal(p.fen.split(' ')[1], 'w');
  assert.deepEqual(p.solution, ['d2c4', 'a3c5', 'c2c3']);
  assert.equal(p.gameUrl, 'https://lichess.org/8gDESBCS');
});

test('daily puzzle: without a FEN the position is replayed from the game', () => {
  const { fen, lastMove, ...rest } = API_SAMPLE.puzzle;
  const p = parseDaily({ game: API_SAMPLE.game, puzzle: rest });
  assert.equal(p.fen.split(' ').slice(0, 2).join(' '), API_SAMPLE.puzzle.fen.split(' ').slice(0, 2).join(' '));
  assert.equal(p.lastMove, 'e5c3');
});

test('daily puzzle: broken data is rejected (the page then shows the Lichess link)', () => {
  assert.throws(() => parseDaily({}));
  assert.throws(() => parseDaily({ puzzle: { id: 'x', solution: [] } }));
});

test('daily puzzle: right, wrong and alternative mating moves', () => {
  const fen = API_SAMPLE.puzzle.fen;
  assert.equal(checkMove(fen, 'd2c4', 'd2c4'), 'correct');
  assert.equal(checkMove(fen, 'c2c3', 'd2c4'), 'wrong');
  // back-rank mate: Ra8# is not the listed move, but any mate counts
  assert.equal(checkMove('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'a1a8', 'a1a7'), 'mate');
});

import { parseBadges, remarkArticleBadges } from '../src/lib/remark-article-badges.mjs';

test('team and round labels are recognised, ordinary sentences are not', () => {
  assert.deepEqual(parseBadges('Seniori – II. ekipa, 6.kolo'), ['Seniori', 'Druga ekipa', '6. kolo']);
  assert.deepEqual(parseBadges('Seniori, 2. kolo'), ['Seniori', '2. kolo']);
  assert.deepEqual(parseBadges('5. kolo, seniori'), ['5. kolo', 'Seniori']);
  assert.deepEqual(parseBadges('III A. liga, 1.-4. kolo'), ['III. A liga', '1.–4. kolo']);
  assert.equal(parseBadges('Seniorska ekipa izgubila je meč'), null);
  assert.equal(parseBadges('Ekipa OŠ Odra osvojila je treće mjesto!'), null);
});

test('the label line leaves the text and becomes badges', () => {
  const file = new VFile({ path: '/tmp/x/index.md', value: '**Seniori – I. ekipa, 11.kolo**  \n[Porazom](https://x.hr) smo završili sezonu.' });
  file.data = { astro: { frontmatter: {} } };
  const html = String(unified().use(remarkParse).use(remarkArticleBadges).use(remarkRehype).use(rehypeStringify).processSync(file));
  assert.deepEqual((file.data as any).astro.frontmatter.badges, ['Seniori', 'Prva ekipa', '11. kolo']);
  assert.ok(!html.includes('Seniori'));
  assert.ok(html.includes('Porazom') && !html.includes('<strong></strong>'));
});

test('a heading that is only a label is removed', () => {
  const file = new VFile({ path: '/tmp/x/index.md', value: '###### Seniori – II. ekipa, 6.kolo\n\nTekst članka.' });
  file.data = { astro: { frontmatter: {} } };
  const html = String(unified().use(remarkParse).use(remarkArticleBadges).use(remarkRehype).use(rehypeStringify).processSync(file));
  assert.equal(html.trim(), '<p>Tekst članka.</p>');
});

test('unpaired WordPress bold markers around the label are removed too', () => {
  const file = new VFile({ path: '/tmp/x/index.md', value: '**Seniori, 11. kolo  \n![](./a.jpg)**Posljednje kolo.' });
  file.data = { astro: { frontmatter: {} } };
  const html = String(unified().use(remarkParse).use(remarkArticleBadges).use(remarkRehype).use(rehypeStringify).processSync(file));
  assert.deepEqual((file.data as any).astro.frontmatter.badges, ['Seniori', '11. kolo']);
  assert.ok(!html.includes('**') && html.includes('Posljednje kolo.') && html.includes('a.jpg'));
});

import { rehypeMatchTables } from '../src/lib/rehype-match-tables.mjs';
const tableHtml = (md: string) => String(unified().use(remarkParse).use(remarkRehype, { allowDangerousHtml: true }).use(rehypeMatchTables).use(rehypeStringify, { allowDangerousHtml: true }).processSync(md));

test('a WordPress match table gets a header row and marked result cells, data unchanged', () => {
  const html = tableHtml('<table><tbody><tr><td>Pl.</td><td><strong>ŠK Oroslavje</strong></td><td>–</td><td><strong>ŠK Odra</strong></td><td><strong>3,5-2,5</strong></td></tr><tr><td>1.</td><td>Jaković, Roko 2181</td><td>–</td><td>Karlić, Zvjezdan 2034</td><td>1-0</td></tr></tbody></table>');
  assert.ok(html.includes('chess-table') && html.includes('<thead>'));
  assert.match(html, /<th scope="col"[^>]*>Pl\.<\/th>/);
  assert.match(html, /<td class="[^"]*cell-score[^"]*">1-0<\/td>/);
  assert.match(html, /<td class="[^"]*cell-rank[^"]*">1\.<\/td>/);
  assert.ok(html.includes('is-odra') && html.includes('Jaković, Roko 2181'));
});

test('board pairings written as text lines become a table with the same text', () => {
  const html = tableHtml('1\\. Ganić Martin – Ljubić Ivan 0:1  \n2\\. Filipović Tomislav – Maravić Stjepan 1/2  \n3\\. Korov Zvonko – Brajdić Danko 0:1');
  assert.ok(html.includes('pairings-table'));
  for (const s of ['Ganić Martin', 'Ljubić Ivan', '0:1', 'Maravić Stjepan', '1/2', 'Brajdić Danko', '3.']) assert.ok(html.includes(s), s);
});

test('ordinary paragraphs and lists are not turned into tables', () => {
  const html = tableHtml('1. prvi korak\n2. drugi korak\n3. treći korak\n\nŠK Odra – ŠK Ina 2:4 bio je dobar meč.');
  assert.ok(!html.includes('<table') && html.includes('<ol>'));
});

test('a one-row table pasted inside a cell is unwrapped, empty columns are dropped, data unchanged', () => {
  const html = tableHtml('<table><tbody><tr><td>Pl.</td><td></td><td><strong>ŠK Odra II</strong></td><td>–</td><td><table class="CRs1"><tbody><tr><th>ŠK Sloga, Novoselec-Križ</th></tr></tbody></table></td><td><b>2:4</b></td></tr><tr><td>1.</td><td></td><td>Šutić, Darko</td><td>–</td><td><table><tbody><tr><td></td><td>Vortel, Damir</td></tr></tbody></table></td><td>0-1</td></tr></tbody></table>');
  assert.equal((html.match(/<table/g) ?? []).length, 1);
  assert.ok(html.includes('<thead>') && html.includes('ŠK Sloga, Novoselec-Križ') && html.includes('Vortel, Damir') && html.includes('0-1'));
  assert.equal((html.match(/<t[dh]\b/g) ?? []).length, 10); // the empty second column is gone
});

// Article photos: responsive widths for local images (srcset is emitted by Astro from these props)
import { rehypeOdra } from '../src/lib/rehype-odra.mjs';
import remarkGfm from 'remark-gfm';
const odraTree = (md: string) => {
  const p = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeOdra, { base: '/website' });
  return p.runSync(p.parse(md)) as any;
};
const findImgs = (n: any, out: any[] = []): any[] => { if (n.tagName === 'img') out.push(n); (n.children ?? []).forEach((c: any) => findImgs(c, out)); return out; };

test('local article photos get responsive widths; gallery photos get gallery sizes', () => {
  const [single] = findImgs(odraTree('![a](./a.jpg)'));
  assert.deepEqual(single.properties.widths, [480, 800, 1200, 1600]);
  assert.match(single.properties.sizes, /720px/);
  const gallery = findImgs(odraTree('![a](./a.jpg) ![b](./b.jpg)'));
  assert.equal(gallery.length, 2);
  for (const g of gallery) assert.match(g.properties.sizes, /240px/);
});

test('remote and table images are left alone', () => {
  const [remote] = findImgs(odraTree('![r](https://example.com/r.jpg)'));
  assert.equal(remote.properties.widths, undefined);
  const [icon] = findImgs(odraTree('| a |\n|---|\n| ![k](./k.png) |'));
  assert.equal(icon?.properties.widths, undefined);
});
