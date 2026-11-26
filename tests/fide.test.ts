/** Monthly FIDE rating update (scripts/update-fide-ratings.ts). Run with: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyRatings, readRatings, sanityCheck } from '../scripts/lib/fide-ratings';

const dir = mkdtempSync(join(tmpdir(), 'fide-'));
const wanted = new Set(['14515024', '79341004', '999']);

test('reads standard, rapid and blitz from the XML list', async () => {
  const f = join(dir, 'list.xml');
  writeFileSync(f, `<?xml version="1.0" encoding="ISO-8859-1"?>
<playerslist>
<player><fideid>14515024</fideid><name>Cvetkovic, Ivan</name><country>CRO</country><rating>1903</rating><games>4</games><rapid_rating>1810</rapid_rating><rapid_games>0</rapid_games><blitz_rating></blitz_rating><flag></flag></player>
<player>
  <fideid>12345</fideid>
  <rating>2500</rating>
</player>
<player>
  <fideid>79341004</fideid>
  <rating>0</rating>
  <rapid_rating>1450</rapid_rating>
  <blitz_rating>1502</blitz_rating>
</player>
</playerslist>`);
  const r = await readRatings(f, wanted);
  assert.deepEqual(r.get('14515024'), { standard: 1903, rapid: 1810, blitz: null });
  assert.deepEqual(r.get('79341004'), { standard: null, rapid: 1450, blitz: 1502 });
  assert.equal(r.has('12345'), false);
});

test('reads the fixed-width TXT list', async () => {
  const f = join(dir, 'list.txt');
  const header = 'ID Number      Name                                                         Fed Sex Tit  WTit OTit           FOA SRtng SGm SK RRtng RGm Rk BRtng BGm BK B-day Flag';
  const at = (s: string, label: string, v: string) => { const i = header.indexOf(label); return s.padEnd(i).slice(0, i) + v; };
  let row = '14515024';
  row = at(row, 'Name', 'Cvetkovic, Ivan'); row = at(row, 'Fed', 'CRO'); row = at(row, 'SRtng', '1903');
  row = at(row, 'SGm', '4'); row = at(row, 'RRtng', '1810'); row = at(row, 'BRtng', '');
  writeFileSync(f, `${header}\n${row}\n`);
  const r = await readRatings(f, wanted);
  assert.deepEqual(r.get('14515024'), { standard: 1903, rapid: 1810, blitz: null });
});

test('applies ratings, keeps other fields, reports changes; refuses broken results', () => {
  const members: any[] = [
    { name: 'Ivan Cvetković', category: 'MK', fideId: '14515024', rating: 1900, ratingBlitz: 1950 },
    { name: 'Bez FIDE ID', category: 'vk' },
    { name: 'Nema na listi', fideId: '999', rating: 1500 },
  ];
  const ratings = new Map([['14515024', { standard: 1903, rapid: 1810, blitz: null }]]);
  const { changes, found, missing } = applyRatings(members, ratings);
  assert.equal(found, 1);
  assert.deepEqual(missing, ['Nema na listi']);
  assert.equal(members[0].rating, 1903);
  assert.equal(members[0].ratingRapid, 1810);
  assert.equal('ratingBlitz' in members[0], false);
  assert.equal(members[0].category, 'MK');
  assert.equal(members[2].rating, 1500);
  assert.equal(changes.length, 3);
  assert.equal(sanityCheck(1, 1, changes), null);
  assert.match(String(sanityCheck(40, 5, [])), /only 5 of 40/);
});
