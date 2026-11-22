/**
 * Unit tests for the chess features: PGN parser, FEN handling, CMS validation messages
 * and the Markdown plugin that turns ```pgn / ```fen blocks and .pgn links into viewers.
 * Run with: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import { VFile } from 'vfile';
import { parsePgn, mainline, completeFen, splitGames } from '../src/lib/pgn/parse';
import { validate, validateFen, hrPlural } from '../src/cms/validate';
import { remarkPgn } from '../src/lib/pgn/remark-pgn.mjs';

const GAME = `[Event "Prvenstvo kluba – čćžšđ"]
[White "Đurđević, Žarko"]
[Black "Čubrić, Šime"]
[Result "1-0"]

1. e4 {Najpopularnije otvaranje.} e5 2. Nf3 (2. f4 exf4 {Kraljev gambit}) Nc6 3. Bc4 Nf6?? 4. Ng5 1-0`;

const SECOND = `[White "Horvat, Ivana"]
[Black "Kovač, Ljiljana"]
[Result "1/2-1/2"]

1. d4 d5 2. c4 e6 1/2-1/2`;

test('parses headers, moves, comments, variations, NAGs and Croatian letters', () => {
  const [g] = parsePgn(GAME);
  assert.equal(g.error, undefined);
  assert.equal(g.headers.White, 'Đurđević, Žarko');
  assert.equal(g.headers.Event, 'Prvenstvo kluba – čćžšđ');
  const line = mainline(g.root);
  assert.deepEqual(line.map((n) => n.san), ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5']);
  assert.equal(line[0].comment, 'Najpopularnije otvaranje.');
  assert.deepEqual(line[5].nags, ['??']);
  const variation = line[1].children[1];
  assert.equal(variation.san, 'f4');
  assert.equal(variation.children[0].san, 'exf4');
  assert.equal(variation.children[0].comment, 'Kraljev gambit');
});

test('splits a multi-game file', () => {
  assert.equal(splitGames(`${GAME}\n\n${SECOND}\n`).length, 2);
  const games = parsePgn(`${GAME}\n\n${SECOND}\n`);
  assert.deepEqual(games.map((g) => g.headers.White), ['Đurđević, Žarko', 'Horvat, Ivana']);
});

test('an illegal move is reported with its position, earlier moves are kept', () => {
  const [g] = parsePgn('1. e4 e5 2. Ke3 Nc6');
  assert.match(g.error ?? '', /Ke3/);
  assert.deepEqual(mainline(g.root).map((n) => n.san), ['e4', 'e5']);
});

test('completeFen fills in missing FEN fields', () => {
  assert.equal(completeFen('6k1/5ppp/8/8/8/8/5PPP/3R2K1'), '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1');
  assert.equal(completeFen('6k1/5ppp/8/8/8/8/5PPP/3R2K1 b -'), '6k1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1');
  assert.equal(completeFen('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 3 40'), '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 3 40');
  assert.equal(completeFen('ovo nije FEN'), 'ovo nije FEN');
  const [g] = parsePgn('[SetUp "1"]\n[FEN "6k1/5ppp/8/8/8/8/5PPP/3R2K1 b"]\n\n*');
  assert.equal(g.error, undefined);
  assert.equal(g.root.color, '');
  assert.equal(g.root.ply, 1);
});

test('Croatian plurals', () => {
  const f = (n: number) => hrPlural(n, 'potez', 'poteza', 'poteza');
  assert.deepEqual([1, 2, 4, 5, 11, 12, 21, 22, 25].map(f), ['potez', 'poteza', 'poteza', 'poteza', 'poteza', 'poteza', 'potez', 'poteza', 'poteza']);
  assert.equal(hrPlural(3, 'partija', 'partije', 'partija'), 'partije');
});

test('CMS PGN validation messages', () => {
  assert.equal(validate('').level, 'empty');
  const one = validate(GAME);
  assert.equal(one.level, 'ok');
  assert.match(one.html, /Partija je ispravna/);
  assert.match(one.html, /Đurđević, Žarko – Čubrić, Šime \(4 poteza, 1-0\)/);
  assert.match(validate(`${GAME}\n\n${SECOND}`).html, /Obje partije su ispravne/);
  const three = validate([GAME, SECOND, SECOND].join('\n\n'));
  assert.match(three.html, /Sve 3 partije su ispravne/);
  const five = validate(Array(5).fill(SECOND).join('\n\n'));
  assert.match(five.html, /Svih 5 partija je ispravno/);
  const bad = validate('[White "Pogrešan, Zapis"]\n\n1. e4 e5 2. Ke3');
  assert.equal(bad.level, 'err');
  assert.match(bad.html, /Neispravan potez „Ke3” nakon 1\.\.\. e5/);
  assert.equal(validate('ovo nije šah').level, 'err');
});

test('CMS FEN validation messages', () => {
  assert.equal(validateFen('').level, 'empty');
  assert.match(validateFen('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1').html, /Pozicija je ispravna.*bijeli/s);
  assert.match(validateFen('6k1/5ppp/8/8/8/8/5PPP/3R2K1 b').html, /crni/);
  assert.match(validateFen('8/8/8/8/8/8/8/8 w - - 0 1').html, /nedostaje bijeli kralj/);
  assert.match(validateFen('6kk/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1').html, /previše crnih kraljeva/);
  assert.match(validateFen('6k1/5ppp/8/8/8/8/5PPP/3R2K1 x - - 0 1').html, /strana na potezu/);
  assert.match(validateFen('P5k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1').html, /pješak/);
  assert.equal(validateFen('ovo nije FEN').level, 'err');
});

async function render(md: string, path: string) {
  const file = new VFile({ value: md, path });
  const out = await unified()
    .use(remarkParse)
    .use(remarkPgn, { base: '/sk-odra/' })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)
    .process(file);
  return String(out);
}

test('Markdown: ```pgn, ```fen and .pgn links become viewers in place', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pgn-'));
  writeFileSync(join(dir, 'kolo-3.pgn'), `${GAME}\n\n${SECOND}\n`);
  const md = [
    'Prvi odlomak.',
    '```pgn 1. kolo: Đurđević – Čubrić',
    GAME,
    '```',
    'Drugi odlomak.',
    '[Partije 3. kola](kolo-3.pgn)',
    'Treći odlomak.',
    '```fen',
    '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    '```',
    'Kraj.',
  ].join('\n\n');
  const html = await render(md, join(dir, 'index.md'));
  const order = ['Prvi odlomak.', '1. kolo: Đurđević – Čubrić', 'Drugi odlomak.', 'Partije 3. kola', 'Treći odlomak.', '6k1/5ppp', 'Kraj.'].map((s) => html.indexOf(s));
  assert.ok(order.every((i) => i >= 0), `all parts present: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'viewers are where they were written');
  assert.equal(html.match(/class="pgn-viewer[ "]/g)?.length, 3);
  assert.match(html, /\/sk-odra\/vendor\/cm-chessboard\//);
  // the PGN travels intact for the client-side viewer, and a no-JS fallback lists the moves
  assert.match(html, /Đurđević, Žarko/);
  assert.match(html, /pgnv-fallback/);
});

test('Markdown: a missing .pgn file leaves the link as-is (build does not crash)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pgn-'));
  const html = await render('[Partija](nema.pgn)', join(dir, 'index.md'));
  assert.match(html, /<a href="nema.pgn">Partija<\/a>/);
});

test('Markdown: ordinary code blocks are untouched', async () => {
  const html = await render('```js\nconst a = 1;\n```', '/x/index.md');
  assert.match(html, /<code class="language-js">/);
  assert.doesNotMatch(html, /pgn-viewer/);
});

test('tolerates several tags on one line and moves glued to the last tag', () => {
  const [a] = parsePgn('[Event "London"]\n[Round "3"] [Date "17.03.2013."]\n[White "Gelfand"]\n[Result "0-1"]\n1. d4 Nf6 0-1');
  assert.equal(a.error, undefined);
  assert.equal(a.headers.Date, '17.03.2013.');
  assert.deepEqual(mainline(a.root).map((n) => n.san), ['d4', 'Nf6']);
  const [b] = parsePgn('[White "Anand"]\n[Result "1-0"]1. e4 e5 1-0');
  assert.equal(b.error, undefined);
  assert.equal(mainline(b.root).length, 2);
  const [c] = parsePgn('[Event "x"]\n[SetUp "1"]\n[FEN "3r2k1/1p3pb1/1q2bnpp/pP2p3/P1p1P3/B1Pn1NP1/2QN1PBP/5RK1 b - - 0 22"]22... Ng4 23. Nb1 0-1');
  assert.equal(c.error, undefined);
  assert.equal(mainline(c.root)[0].san, 'Ng4');
});

test('CMS table component: Excel paste → GFM table → back', async () => {
  const { parseRows, toMarkdown, fromMarkdown, TABLE_PATTERN } = await import('../src/cms/table');
  const md = toMarkdown(parseRows('Ploča\tBijeli\tCrni\tRezultat\n1\tĐurđević, Ž.\tČubrić, Š.\t1-0\n2\tA | B\tC\t½-½'));
  assert.equal(md.split('\n').length, 4);
  assert.match(md, /^\| Ploča \| Bijeli \| Crni \| Rezultat \|$/m);
  assert.match(md, /A \\\| B/);
  const m = md.match(TABLE_PATTERN)!;
  assert.ok(m);
  assert.equal(fromMarkdown(m), 'Ploča\tBijeli\tCrni\tRezultat\n1\tĐurđević, Ž.\tČubrić, Š.\t1-0\n2\tA | B\tC\t½-½');
  assert.deepEqual(parseRows('a;b\nc'), [['a', 'b'], ['c', '']]);
});
