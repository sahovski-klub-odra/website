/**
 * Updates FIDE ratings (standard, rapid, blitz) of all club members in src/data/members.json.
 *   tsx scripts/update-fide-ratings.ts <players_list_foa.txt> [--dry-run]
 * Run monthly by .github/workflows/fide-ratings.yml. Nothing else in members.json is changed.
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { applyRatings, readRatings, sanityCheck, type Member } from './lib/fide-ratings';

const file = process.argv[2];
const dry = process.argv.includes('--dry-run');
if (!file) { console.error('usage: update-fide-ratings.ts <players_list_foa.txt> [--dry-run]'); process.exit(2); }

const path = new URL('../src/data/members.json', import.meta.url);
const raw = readFileSync(path, 'utf8');
const data = JSON.parse(raw) as { updated?: string; members: Member[] };
const ids = new Set(data.members.map((m) => String(m.fideId ?? '').trim()).filter(Boolean));

const ratings = await readRatings(file, ids);
const { changes, found, missing } = applyRatings(data.members, ratings);
const problem = sanityCheck(ids.size, found, changes);

const label = { rating: 'standard', ratingRapid: 'rapid', ratingBlitz: 'blitz' };
const lines = changes.map((c) => `- ${c.name} (${label[c.field]}): ${c.from ?? '–'} → ${c.to ?? '–'}`);
const summary = [
  `FIDE IDs: ${ids.size}, found in the list: ${found}${missing.length ? ` (not found: ${missing.join(', ')})` : ''}`,
  `Changed ratings: ${changes.length}`,
  ...lines,
].join('\n');
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### FIDE ratings\n\n${summary}\n`);

if (problem) { console.error(`Not saved: ${problem}`); process.exit(1); }
if (dry || changes.length === 0) process.exit(0);

data.updated = new Date().toISOString().slice(0, 10);
writeFileSync(path, JSON.stringify(data, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
console.log('members.json updated');
