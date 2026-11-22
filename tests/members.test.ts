/** Unit tests for the members-page import (scripts/lib/members-table.ts). Run with: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMembersTable, mergeMembers, displayName, nameKey } from '../scripts/lib/members-table';

// shaped like the "Članovi" table on the old site: empty rating cells are common
const PAGE = `<p>Popis članova</p>
<table><tbody>
<tr><th>Rb.</th><th>MB</th><th>Prezime, ime</th><th>Kat.</th><th>Standard</th><th>Rapid</th><th>Blitz</th><th>Godište</th><th>Funkcija</th></tr>
<tr><td>1.</td><td>10976</td><td><strong>Cvetković, Božo</strong></td><td>III</td><td>1680</td><td>1585</td><td>1797</td><td>2003.</td><td>član predsjedništva</td></tr>
<tr><td>2.</td><td>221</td><td><a href="https://ratings.fide.com/profile/14500001">Bačurin, Juraj</a></td><td>MK</td><td>1976</td><td></td><td>1960</td><td>1969.</td><td></td></tr>
<tr><td>3.</td><td>15226</td><td>Dalić, Dominik</td><td>vk</td><td></td><td></td><td></td><td>1997.</td><td></td></tr>
<tr><td>4.</td><td>99999</td><td>Novak, Ana</td><td>V</td><td></td><td></td><td></td><td>2012.</td><td></td></tr>
</tbody></table>`;

test('header-driven parse keeps empty rating columns empty', () => {
  const { rows, columns, warnings } = parseMembersTable(PAGE);
  assert.deepEqual(warnings, []);
  assert.deepEqual(columns, ['rb', 'mb', 'name', 'category', 'rating', 'ratingRapid', 'ratingBlitz', 'birthYear', 'role']);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], { name: 'Božo Cvetković', registrationNumber: '10976', category: 'III', rating: 1680, ratingRapid: 1585, ratingBlitz: 1797, birthYear: 2003, role: 'član predsjedništva' });
  assert.equal(rows[1].ratingRapid, null);
  assert.equal(rows[1].ratingBlitz, 1960);
  assert.equal(rows[1].fideId, '14500001');
  assert.equal(rows[2].rating, null);
});

test('names and matching ignore order, case and diacritics', () => {
  assert.equal(displayName('Cvetković,  Božo'), 'Božo Cvetković');
  assert.equal(nameKey('Đurđević, Žarko'), nameKey('zarko durdevic'));
});

test('merge updates page fields, keeps CMS-only fields, never deletes', () => {
  const existing = [
    { name: 'Juraj Bačurin', registrationNumber: '221', category: 'I', rating: 1900, bio: 'Biografija iz CMS-a', image: '/images/members/juraj.jpg', roleEn: 'Captain', role: 'kapetan' },
    { name: 'Božo Cvetković', category: 'III', rating: 1680, ratingRapid: 1585, ratingBlitz: 1797, birthYear: 2003, role: 'član predsjedništva', registrationNumber: '10976' },
    { name: 'Stari Član', rating: 1500 },
  ];
  const { rows, columns } = parseMembersTable(PAGE);
  const r = mergeMembers(existing, rows, columns);
  assert.deepEqual(r.added, ['Dominik Dalić', 'Ana Novak']);
  assert.deepEqual(r.updated, ['Juraj Bačurin']);
  assert.deepEqual(r.missing, ['Stari Član']);
  // order follows the page, missing members at the end
  assert.deepEqual(r.members.map((m) => m.name), ['Božo Cvetković', 'Juraj Bačurin', 'Dominik Dalić', 'Ana Novak', 'Stari Član']);
  const juraj = r.members[1];
  assert.equal(juraj.category, 'MK');
  assert.equal(juraj.rating, 1976);
  assert.equal(juraj.ratingBlitz, 1960);
  assert.equal(juraj.bio, 'Biografija iz CMS-a');
  assert.equal(juraj.image, '/images/members/juraj.jpg');
  assert.equal(juraj.roleEn, 'Captain');
  assert.equal(juraj.fideId, '14500001');
  // an empty role cell on the page clears the role (the page is the source for roles)
  assert.equal(juraj.role, undefined);
});

test('a page without a recognisable table changes nothing', () => {
  const { rows, warnings } = parseMembersTable('<p>Članovi kluba: Ivo, Ana.</p>');
  assert.equal(rows.length, 0);
  assert.equal(warnings.length, 1);
});

test('a table without rating headers leaves ratings untouched', () => {
  const html = '<table><tr><th>Ime i prezime</th><th>Kategorija</th></tr><tr><td>Horvat, Ivo</td><td>II</td></tr></table>';
  const { rows, columns, warnings } = parseMembersTable(html);
  assert.equal(rows[0].name, 'Ivo Horvat');
  assert.match(warnings[0], /rating/);
  const r = mergeMembers([{ name: 'Ivo Horvat', rating: 1800 }], rows, columns);
  assert.equal(r.members[0].rating, 1800);
  assert.equal(r.members[0].category, 'II');
});
