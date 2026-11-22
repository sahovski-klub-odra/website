/**
 * After the build: the generated site must not contain AVIF images or references to them.
 * (The artifact/preview sharing service and some e-mail/chat previews reject AVIF; the site uses WebP + JPEG/PNG.)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = 'dist';
const bad = [];
const walk = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (!p.startsWith(join(root, 'admin', 'sveltia'))) walk(p); continue; }
    const ext = extname(n).toLowerCase();
    if (ext === '.avif') bad.push(`${p}: AVIF file`);
    else if (['.html', '.css', '.js', '.json', '.xml'].includes(ext)) {
      const s = readFileSync(p, 'utf8');
      const m = s.match(/[^\s"'(]*\.avif\b|image\/avif/);
      if (m) bad.push(`${p}: references ${m[0]}`);
    }
  }
};
walk(root);
if (bad.length) {
  console.error(`✗ ${bad.length} AVIF problem(s) in ${root}/ – use WebP/JPEG/PNG instead:\n  ` + bad.slice(0, 20).join('\n  '));
  process.exit(1);
}
console.log('✓ no AVIF images or references in the build output');
