// @ts-check
/**
 * Files linked from an article (not embedded as an image) are copied next to the built page.
 *
 * Astro optimises images that are *embedded* in Markdown (`![](./photo.jpg)`), but a plain *link*
 * to a file in the article folder (`[Prijava](./prijava.jpg)`, `[Raspis](./raspis.pdf)`) is left
 * as-is, so on the built site it would point at a file that does not exist. Imported WordPress
 * articles link many photos to their full-size version this way, and editors can do the same
 * with files uploaded through the CMS.
 *
 * After the build, every relative link in an article page that does not resolve is looked up in
 * that article's content folder; if the file is there, it is copied into the page's folder.
 * Links that still cannot be resolved are listed as warnings (the build does not fail).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

/** article routes: dist folder → content collection language folder */
const ROUTES = [
  { dist: 'novosti', lang: 'hr' },
];

/**
 * slug → content folder, read from the `slug:` front-matter field (folder name as fallback)
 * @param {string} contentDir
 */
function slugMap(contentDir) {
  /** @type {Map<string, string>} */
  const map = new Map();
  if (!existsSync(contentDir)) return map;
  for (const name of readdirSync(contentDir)) {
    const dir = join(contentDir, name);
    if (!statSync(dir).isDirectory()) continue;
    const md = ['index.md', 'index.mdx'].map((f) => join(dir, f)).find((f) => existsSync(f));
    const slug = md ? readFileSync(md, 'utf8').match(/^slug:\s*["']?([^"'\n]+?)["']?\s*$/m)?.[1] : undefined;
    map.set(slug || name, dir);
  }
  return map;
}

/** @returns {import('astro').AstroIntegration} */
export function articleFiles() {
  let root = '';
  return {
    name: 'odra-article-files',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = fileURLToPath(config.root);
      },
      'astro:build:done': ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        let copied = 0;
        /** @type {string[]} */
        const missing = [];
        for (const { dist, lang } of ROUTES) {
          const slugs = slugMap(join(root, 'src/content/blog', lang));
          const base = join(out, dist);
          if (!existsSync(base)) continue;
          for (const slug of readdirSync(base)) {
            const page = join(base, slug, 'index.html');
            const src = slugs.get(slug);
            if (!src || !existsSync(page)) continue;
            const html = readFileSync(page, 'utf8');
            for (const [, raw] of html.matchAll(/\bhref="([^"#?:]+)"/g)) {
              // only links relative to the article itself: ./file.ext or file.ext
              if (raw.startsWith('/') || raw.startsWith('../') || !/\.[a-z0-9]{2,5}$/i.test(raw)) continue;
              let rel;
              try { rel = decodeURIComponent(raw.replace(/&amp;|&#x26;/g, '&')); } catch { rel = raw; }
              rel = normalize(rel).replace(/^(\.\/)+/, '');
              if (rel.startsWith('..')) continue;
              const target = join(base, slug, rel);
              if (existsSync(target)) continue;
              const file = join(src, rel);
              if (existsSync(file) && statSync(file).isFile()) {
                mkdirSync(dirname(target), { recursive: true });
                copyFileSync(file, target);
                copied++;
              } else missing.push(`${dist}/${slug}/ → ${raw}`);
            }
          }
        }
        logger.info(`${copied} linked article file(s) copied next to their pages`);
        for (const m of missing) logger.warn(`linked file not found: ${m}`);
      },
    },
  };
}
