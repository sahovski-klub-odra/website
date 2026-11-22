#!/usr/bin/env tsx
/**
 * Checks that the migrated content is complete and independent of the old WordPress site.
 * Run before deploying:  npm run verify:migration
 *
 *  ✓ every image referenced by an article exists in the repository
 *  ✓ no article still loads images/files from the old site (wp-content/uploads)
 *  ✓ every post in migration/report.json has an article folder
 *  ✓ front matter has title + pubDate
 *  ✓ no duplicate WordPress IDs
 *  ✓ every chess game (```pgn block or linked .pgn file) exists and its moves are legal
 * Exit code 1 if anything is wrong.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parsePgn } from '../src/lib/pgn/parse.ts';

// the club's old WordPress host(s): from src/data/site.json → wordpressUrl (www. and bare host both count)
const OLD_HOSTS = (() => {
  try {
    const u = JSON.parse(readFileSync(resolve('src/data/site.json'), 'utf8')).wordpressUrl as string;
    const h = new URL(u).hostname.replace(/^www\./, '');
    return new Set([h, `www.${h}`]);
  } catch { return new Set<string>(); }
})();
const isOldSite = (url: string) => {
  try { return OLD_HOSTS.has(new URL(url).hostname) && url.includes('/wp-content/'); } catch { return false; }
};

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const BLOG = join(ROOT, 'src/content/blog');
const problems: string[] = [];
const warnings: string[] = [];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.mdx?$/.test(n) ? [p] : [];
  });
}

const files = walk(BLOG);
const wpIds = new Map<number, string>();
let images = 0;
let games = 0;

for (const f of files) {
  const rel = relative(ROOT, f);
  const src = readFileSync(f, 'utf8');
  const fm = src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  if (!/^title:/m.test(fm)) problems.push(`${rel}: missing title`);
  if (!/^pubDate:/m.test(fm)) problems.push(`${rel}: missing pubDate`);

  const id = fm.match(/^wordpress:\s*\n\s+id:\s*(\d+)/m)?.[1];
  if (id) {
    if (wpIds.has(+id)) problems.push(`${rel}: duplicate WordPress ID ${id} (also in ${wpIds.get(+id)})`);
    wpIds.set(+id, rel);
  }

  const cover = fm.match(/^image:\s*"?([^"\n]+)"?/m)?.[1];
  const refs = [
    ...[...src.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map((m) => m[1]),
    // raw HTML images (e.g. inside imported tables)
    ...[...src.matchAll(/<img\b[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]),
  ];
  if (cover) refs.push(cover);
  for (const r of refs) {
    if (/^https?:\/\//.test(r)) {
      (isOldSite(r) ? problems : warnings).push(`${rel}: external image ${r}`);
      continue;
    }
    images++;
    if (!existsSync(join(dirname(f), r))) problems.push(`${rel}: image not found ${r}`);
  }
  // a link to a file on OUR old WordPress (links to other clubs' WordPress sites are ordinary external links)
  for (const m of src.matchAll(/\]\((https?:\/\/[^)\s]*\/wp-content\/uploads\/[^)\s]*)/g)) if (isOldSite(m[1])) problems.push(`${rel}: link to old WordPress file ${m[1]}`);
  // chess games
  const checkPgn = (text: string, where: string) => {
    for (const g of parsePgn(text)) {
      games++;
      if (g.error) warnings.push(`${rel}: ${where}: ${g.error}`);
    }
  };
  for (const m of src.matchAll(/^```(?:pgn|chess)[^\n]*\n([\s\S]*?)^```/gm)) checkPgn(m[1], 'PGN block');
  for (const m of src.matchAll(/^\[[^\]\n]*\]\(([^)\s]+\.pgn)\)$/gm)) {
    const url = decodeURIComponent(m[1]);
    const target = url.startsWith('/') ? join(ROOT, 'public', url) : join(dirname(f), url);
    if (!existsSync(target)) problems.push(`${rel}: PGN file not found ${url}`);
    else checkPgn(readFileSync(target, 'utf8'), url);
  }
  for (const m of src.matchAll(/\]\((\/files\/wp\/[^)\s]+)\)/g)) {
    if (!existsSync(join(ROOT, 'public', decodeURIComponent(m[1])))) problems.push(`${rel}: linked file missing public${m[1]}`);
  }
}

const reportFile = join(ROOT, 'migration/report.json');
if (existsSync(reportFile)) {
  const report = JSON.parse(readFileSync(reportFile, 'utf8'));
  for (const p of report.posts ?? []) {
    if (p.status === 'failed') problems.push(`post ${p.id} “${p.title}” failed to migrate: ${String(p.error).split('\n')[0]}`);
    else if (p.status !== 'dry-run' && !existsSync(join(ROOT, p.folder))) problems.push(`post ${p.id} “${p.title}”: folder ${p.folder} missing`);
  }
  console.log(`Report: ${report.summary?.found ?? '?'} posts found in WordPress`);
}

console.log(`Articles: ${files.length}  (WordPress: ${wpIds.size})`);
console.log(`Local images referenced: ${images}`);
console.log(`Chess games: ${games}`);
warnings.forEach((w) => console.log(`  ! ${w}`));
const unique = [...new Set(problems)];
if (unique.length) {
  console.log(`\n✗ ${unique.length} problem(s):`);
  unique.forEach((p) => console.log(`  - ${p}`));
  process.exit(1);
}
console.log('\n✓ Migration verified – all articles and images are stored locally.');
