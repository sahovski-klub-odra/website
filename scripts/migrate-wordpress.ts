#!/usr/bin/env tsx
/**
 * WordPress → Astro migration for Šahovski klub Odra
 * ===================================================
 * Reads posts from the WordPress REST API and/or a WordPress XML export (WXR),
 * downloads every image into the repository, converts HTML to Markdown and writes
 *   src/content/blog/hr/<slug>/index.md   (+ images next to it)
 *   public/files/wp/…                     (PDF/PGN/DOC attachments linked from posts)
 *   src/data/redirects.json               (old URL → new URL)
 *   migration/report.md + report.json     (what happened, what needs attention)
 *
 * The WordPress site is only READ – nothing is changed there.
 * Existing content in this repository is never deleted or overwritten:
 * posts that were already imported (same WordPress ID) are skipped, unless --update is given,
 * in which case only those previously migrated files are refreshed.
 *
 * Usage:
 *   npm run migrate -- --api https://www.example.hr
 *   npm run migrate -- --xml ./wordpress-export.xml
 *   npm run migrate -- --xml ./export.xml --api https://www.example.hr   (XML content, API as media fallback)
 *
 * Options:
 *   --api <url>          WordPress site URL (REST API at /wp-json/ or ?rest_route=)
 *   --xml <file>         WordPress export file (Tools → Export → All content)
 *   --json <file>        JSON dump of the public REST API (posts, pages, categories, tags, media),
 *                        e.g. saved from the browser when this machine cannot reach the old site
 *   --mirror <dir>       serve old-site files (wp-content/uploads/…) from a local folder instead of
 *                        downloading them; missing files are reported like failed downloads
 *   --missing-list <f>   write every file URL that could not be obtained (not in the mirror, or the
 *                        download failed) to this text file, one per line – e.g. to fetch them elsewhere
 *   --ids <list>         import only these WordPress post IDs (comma separated) – for test runs
 *   --since <date>       import only posts published on/after this date (YYYY-MM-DD)
 *   --galleries <slugs>  WordPress pages that are photo galleries (comma separated, e.g.
 *                        foto-galerija,fotogalerija-2) → albums in src/content/gallery/. Each text
 *                        paragraph followed by photos becomes one album.
 *   --lang <hr|en>       target language folder (default hr)
 *   --limit <n>          import only the first n posts (for a test run)
 *   --dry-run            fetch and convert, but write nothing
 *   --update             re-import posts that were migrated before (overwrites only those folders)
 *   --members <slug>     update src/data/members.json from the members page (e.g. clanovi). Ratings, categories,
 *                        roles and birth years come from the page; photos and biographies entered in the CMS
 *                        are kept; nobody is deleted (members missing from the page are listed in the report)
 *   --include-pages      also export WordPress *pages* to migration/pages/ for manual review
 *   --max-width <px>     downscale images wider than this (default 2400, 0 = keep originals)
 *   --concurrency <n>    parallel downloads (default 4)
 *   --old-host <host>    extra host name(s) of the old site, comma separated (e.g. old domain aliases)
 *   --no-lichess         do not download PGNs of embedded lichess.org games
 *
 * Chess games: [pgn]/[pgnv]/[fen]/[chess] shortcodes, pasted PGN text, data-pgn attributes,
 * PgnViewerJS scripts, pgn4web iframes, lichess.org embeds and links to .pgn files are converted
 * into ```pgn blocks / .pgn files next to the article, which the site shows as interactive boards.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import TurndownService from 'turndown';
// @ts-expect-error – no type declarations
import { gfm } from 'turndown-plugin-gfm';
// @ts-expect-error – no type declarations
import domino from '@mixmark-io/domino';
import { XMLParser } from 'fast-xml-parser';
import { parseMembersTable, mergeMembers, type Member } from './lib/members-table';

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string, d?: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
if (flag('help') || (!opt('api') && !opt('xml') && !opt('json'))) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]);
  process.exit(opt('api') || opt('xml') || opt('json') ? 0 : 1);
}

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const API = opt('api')?.replace(/\/+$/, '');
const XML = opt('xml');
const JSON_DUMP = opt('json');
const MIRROR = opt('mirror') ? resolve(opt('mirror')!) : '';
const MISSING_LIST = opt('missing-list') ? resolve(opt('missing-list')!) : '';
const missingUrls = new Set<string>();
process.on('exit', () => {
  if (MISSING_LIST) writeFileSync(MISSING_LIST, [...missingUrls].sort().join('\n') + (missingUrls.size ? '\n' : ''));
});
const IDS = new Set((opt('ids') ?? '').split(',').map((s) => Number(s.trim())).filter(Boolean));
const SINCE = opt('since') ?? '';
const GALLERIES = (opt('galleries') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const GALLERY_OUT = join(ROOT, 'src/content/gallery');
/** attachment pages of the old site (…/?attachment_id=12, …/post-slug/file-slug/) → the file itself */
const ATTACH_BY_ID = new Map<string, string>();
const ATTACH_BY_SLUG = new Map<string, string>();
/** WordPress pages that have a counterpart on the new site (matched by slug) */
const PAGE_ROUTES: Record<string, string> = {
  kontakt: '/kontakt/', contact: '/kontakt/',
  clanovi: '/clanovi/', members: '/clanovi/',
  raspored: '/raspored/', treninzi: '/raspored/', 'raspored-treninga': '/raspored/',
  'foto-galerija': '/galerija/', fotogalerija: '/galerija/', 'fotogalerija-2': '/galerija/', galerija: '/galerija/', video: '/galerija/#videozapisi',
};
/** host names of the old site, filled in main() – used by --mirror */
const OLD_SITE_HOSTS = new Set<string>();
const LANG = opt('lang', 'hr')!;
const LIMIT = Number(opt('limit', '0'));
const DRY = flag('dry-run');
const UPDATE = flag('update');
const PAGES = flag('include-pages');
const MEMBERS_SLUG = flag('members') ? opt('members', 'clanovi')! : '';
const MAX_W = Number(opt('max-width', '2400'));
const CONC = Math.max(1, Number(opt('concurrency', '4')));
const OUT = join(ROOT, 'src/content/blog', LANG);
const FILES_DIR = join(ROOT, 'public/files/wp');
const REPORT_DIR = join(ROOT, 'migration');
const REDIRECTS = join(ROOT, 'src/data/redirects.json');
const NEWS_BASE = LANG === 'hr' ? '/novosti/' : '/en/news/';
const CAT_BASE = LANG === 'hr' ? '/novosti/kategorija/' : '/en/news/category/';
const UA = 'SK-Odra-Migration/1.0 (+static site migration; read-only)';
const LICHESS = flag('no-lichess') ? '' : (opt('lichess-base', 'https://lichess.org') as string).replace(/\/$/, '');

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
interface Media { url: string; alt?: string; caption?: string }
interface WPPost {
  id: number;
  type: 'post' | 'page';
  slug: string;
  title: string;
  date: string; // ISO, UTC
  modified?: string;
  link: string;
  html: string;
  excerpt: string;
  categories: { name: string; slug: string }[];
  tags: string[];
  featured?: Media;
  status: string;
  needsAutop: boolean;
}
interface PostReport {
  id: number;
  title: string;
  oldUrl: string;
  newPath: string;
  folder: string;
  status: 'imported' | 'updated' | 'skipped-existing' | 'failed' | 'dry-run';
  images: number;
  files: number;
  games: number;
  warnings: string[];
  error?: string;
}

const report = {
  startedAt: new Date().toISOString(),
  source: { api: API ?? null, xml: XML ?? null, json: JSON_DUMP ?? null, mirror: MIRROR || null },
  posts: [] as PostReport[],
  pages: [] as { id: number; title: string; file: string }[],
  albums: [] as { title: string; folder: string; photos: number; failed: number }[],
  imagesDownloaded: 0,
  imagesFailed: [] as { post: number; url: string; error: string }[],
  filesDownloaded: 0,
  filesFailed: [] as { post: number; url: string; error: string }[],
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchRetry(url: string, init: RequestInit = {}, tries = 4): Promise<Response> {
  if (MIRROR) {
    let u: URL | undefined;
    try { u = new URL(url); } catch { /* not a URL */ }
    if (u && OLD_SITE_HOSTS.has(u.hostname)) {
      const file = join(MIRROR, safeDecode(u.pathname));
      if (file.startsWith(MIRROR) && existsSync(file) && statSync(file).isFile())
        return new Response(readFileSync(file), { status: 200 });
      missingUrls.add(url);
      return new Response('not in mirror', { status: 404 });
    }
  }
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) }, redirect: 'follow' });
      if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`);
      if (res.status >= 400) missingUrls.add(url);
      return res;
    } catch (e) {
      last = e;
      await sleep(500 * 2 ** i);
    }
  }
  missingUrls.add(url);
  throw last instanceof Error ? last : new Error(String(last));
}

async function getJson<T>(url: string): Promise<{ data: T; res: Response }> {
  const res = await fetchRetry(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return { data: (await res.json()) as T, res };
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', bdquo: '„', sbquo: '‚', euro: '€', copy: '©',
};
function decodeEntities(s = ''): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
const stripTags = (s = '') => decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/, '');
}
function safeDecode(s: string) {
  try { return decodeURIComponent(s); } catch { return s; }
}
/** WordPress path normalised for lookup: decoded, lower case, trailing slash. */
function normPath(url: string): string {
  try {
    const u = new URL(url);
    let p = safeDecode(u.pathname).toLowerCase();
    if (!p.endsWith('/') && !extname(p)) p += '/';
    return p;
  } catch {
    return url;
  }
}

const IMG_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?)$/i;
const FILE_EXT = /\.(pdf|pgn|docx?|xlsx?|pptx?|odt|ods|zip|txt|csv|cbv|che|rtf|odp)$/i;

/** "foto-1024x768.jpg" → "foto.jpg" (WordPress resized copy → original) */
const originalOf = (url: string) => url.replace(/-\d{2,5}x\d{2,5}(?=\.[a-z]{3,4}(\?|$))/i, '').replace(/-scaled(?=\.[a-z]{3,4}(\?|$))/i, '');

function largestFromSrcset(srcset?: string | null): string | undefined {
  if (!srcset) return undefined;
  return srcset
    .split(',')
    .map((s) => s.trim().split(/\s+/))
    .map(([u, w]) => ({ u, w: parseInt(w ?? '0', 10) || 0 }))
    .sort((a, b) => b.w - a.w)[0]?.u;
}

function sniffImage(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8) return '.jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buf.subarray(0, 3).toString() === 'GIF') return '.gif';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return '.webp';
  if (buf.subarray(4, 12).toString().startsWith('ftypavif')) return '.avif';
  if (buf.subarray(0, 2).toString() === 'BM') return '.bmp';
  return null;
}

/** Uncompressed 24/32-bit Windows BMP → raw RGB(A) pixels (sharp cannot read BMP). */
function decodeBmp(buf: Buffer): { data: Buffer; width: number; height: number; channels: 3 | 4 } | null {
  const offset = buf.readUInt32LE(10);
  const width = buf.readInt32LE(18);
  const rawH = buf.readInt32LE(22);
  const bpp = buf.readUInt16LE(28);
  const compression = buf.readUInt32LE(30);
  if ((bpp !== 24 && bpp !== 32) || (compression !== 0 && compression !== 3) || width <= 0) return null;
  const height = Math.abs(rawH);
  const bottomUp = rawH > 0;
  const bytes = bpp / 8;
  const stride = Math.ceil((width * bytes) / 4) * 4;
  const channels = bpp === 32 ? 4 : 3;
  const data = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    const row = offset + (bottomUp ? height - 1 - y : y) * stride;
    for (let x = 0; x < width; x++) {
      const i = row + x * bytes, o = (y * width + x) * channels;
      data[o] = buf[i + 2]; data[o + 1] = buf[i + 1]; data[o + 2] = buf[i];
      if (channels === 4) data[o + 3] = buf[i + 3];
    }
  }
  return { data, width, height, channels };
}

/**
 * Formats the website cannot or should not serve are converted on import:
 *  BMP → JPEG (sharp/Astro cannot process BMP), AVIF → WebP (AVIF is not accepted everywhere the site is
 *  shared). Everything else is kept as it is.
 */
async function normaliseImage(buf: Buffer, ext: string): Promise<{ buf: Buffer; ext: string }> {
  if (!sharp) return { buf, ext };
  if (ext === '.bmp') {
    const raw = decodeBmp(buf);
    if (!raw) throw new Error('unsupported BMP variant');
    return { buf: await sharp(raw.data, { raw: { width: raw.width, height: raw.height, channels: raw.channels } }).jpeg({ quality: 90 }).toBuffer(), ext: '.jpg' };
  }
  if (ext === '.avif') return { buf: await sharp(buf).webp({ quality: 85 }).toBuffer(), ext: '.webp' };
  return { buf, ext };
}

async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

let sharp: any = null;
try { sharp = (await import('sharp')).default; } catch { /* optional */ }

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */
let restBase = '';
async function detectRest(site: string) {
  const candidates: [string, string][] = [
    [`${site}/wp-json/wp/v2`, `${site}/wp-json/wp/v2/types`],
    [`${site}/?rest_route=/wp/v2`, `${site}/?rest_route=/wp/v2/types`],
  ];
  for (const [base, probe] of candidates) {
    try {
      const res = await fetchRetry(probe, { headers: { Accept: 'application/json' } }, 2);
      if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) return base;
    } catch { /* try next */ }
  }
  throw new Error(`WordPress REST API not reachable at ${site} (tried /wp-json/ and ?rest_route=)`);
}
const restUrl = (path: string, params: Record<string, string | number>) => {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  return restBase.includes('?') ? `${restBase}${path}&${qs}` : `${restBase}${path}?${qs}`;
};

async function restAll<T>(path: string, params: Record<string, string | number> = {}): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const { data, res } = await getJson<T[]>(restUrl(path, { per_page: 100, page, ...params }));
    all.push(...data);
    const total = Number(res.headers.get('x-wp-totalpages') ?? '1');
    process.stdout.write(`\r  ${path}: ${all.length}${res.headers.get('x-wp-total') ? ` / ${res.headers.get('x-wp-total')}` : ''}   `);
    if (page >= total || data.length === 0) break;
    if (LIMIT && all.length >= LIMIT && path === '/posts') break;
  }
  process.stdout.write('\n');
  return all;
}

async function fromRest(site: string, type: 'posts' | 'pages'): Promise<WPPost[]> {
  restBase ||= await detectRest(site);
  const [cats, tags] = type === 'posts'
    ? await Promise.all([restAll<any>('/categories'), restAll<any>('/tags')])
    : [[], []];
  const catMap = new Map(cats.map((c: any) => [c.id, { name: decodeEntities(c.name), slug: safeDecode(c.slug) }]));
  const tagMap = new Map(tags.map((t: any) => [t.id, decodeEntities(t.name)]));
  if (type === 'posts' && !ATTACH_BY_ID.size) {
    try {
      for (const m of await restAll<any>('/media', { _fields: 'id,slug,source_url' }))
        if (m.source_url) { ATTACH_BY_ID.set(String(m.id), m.source_url); ATTACH_BY_SLUG.set(safeDecode(m.slug), m.source_url); }
    } catch { /* media endpoint disabled – attachment links stay as they are */ }
  }
  const items = await restAll<any>(`/${type}`, { _embed: 1, orderby: 'date', order: 'asc' });
  return items.map((p) => {
    const fm = p._embedded?.['wp:featuredmedia']?.[0];
    return {
      id: p.id,
      type: type === 'posts' ? 'post' : 'page',
      slug: safeDecode(p.slug),
      title: decodeEntities(p.title?.rendered ?? ''),
      date: p.date_gmt ? `${p.date_gmt}Z` : p.date,
      modified: p.modified_gmt ? `${p.modified_gmt}Z` : undefined,
      link: p.link,
      html: p.content?.rendered ?? '',
      excerpt: p.excerpt?.rendered ?? '',
      categories: (p.categories ?? []).map((id: number) => catMap.get(id)).filter(Boolean),
      tags: (p.tags ?? []).map((id: number) => tagMap.get(id)).filter(Boolean),
      featured: fm?.source_url
        ? { url: fm.source_url, alt: fm.alt_text, caption: stripTags(fm.caption?.rendered) }
        : undefined,
      status: p.status,
      needsAutop: false,
    } satisfies WPPost;
  });
}

/** Same data as fromRest, but read from a saved JSON dump of the REST API (see --json). */
function fromJson(file: string, type: 'posts' | 'pages'): WPPost[] {
  const d = JSON.parse(readFileSync(file, 'utf8'));
  const catMap = new Map<number, { name: string; slug: string }>((d.categories ?? []).map((c: any) => [c.id, { name: decodeEntities(c.name), slug: safeDecode(c.slug) }]));
  const tagMap = new Map<number, string>((d.tags ?? []).map((t: any) => [t.id, decodeEntities(t.name)]));
  const media = new Map<number, any>((d.media ?? []).map((m: any) => [m.id, m]));
  for (const m of d.media ?? []) if (m.source_url) { ATTACH_BY_ID.set(String(m.id), m.source_url); if (m.slug) ATTACH_BY_SLUG.set(safeDecode(m.slug), m.source_url); }
  const items: any[] = [...(d[type] ?? [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return items.map((p) => {
    const fm = p.featured_media ? media.get(p.featured_media) : undefined;
    return {
      id: p.id,
      type: type === 'posts' ? 'post' : 'page',
      slug: safeDecode(p.slug),
      title: decodeEntities(p.title?.rendered ?? ''),
      date: p.date_gmt ? `${p.date_gmt}Z` : p.date,
      modified: p.modified_gmt ? `${p.modified_gmt}Z` : undefined,
      link: p.link,
      html: p.content?.rendered ?? '',
      excerpt: p.excerpt?.rendered ?? '',
      categories: (p.categories ?? []).map((id: number) => catMap.get(id)).filter(Boolean),
      tags: (p.tags ?? []).map((id: number) => tagMap.get(id)).filter(Boolean),
      featured: fm?.source_url ? { url: fm.source_url, alt: fm.alt_text, caption: stripTags(fm.caption?.rendered) } : undefined,
      status: p.status,
      needsAutop: false,
    } satisfies WPPost;
  });
}

let xmlAttachments = new Map<string, Media>();
function fromXml(file: string, type: 'post' | 'page'): WPPost[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    cdataPropName: false as any,
    isArray: (name) => ['item', 'category', 'wp:postmeta', 'wp:category', 'wp:tag'].includes(name),
    processEntities: true,
    htmlEntities: true,
    parseTagValue: false,
    trimValues: false,
  });
  const doc = parser.parse(readFileSync(file, 'utf8'));
  const items: any[] = doc.rss.channel.item ?? [];
  const meta = (it: any, key: string) => (it['wp:postmeta'] ?? []).find((m: any) => m['wp:meta_key'] === key)?.['wp:meta_value'];
  const str = (v: any) => (v == null ? '' : typeof v === 'object' ? (v['#text'] ?? '') : String(v));

  xmlAttachments = new Map(
    items
      .filter((it) => str(it['wp:post_type']) === 'attachment')
      .map((it) => [
        str(it['wp:post_id']),
        { url: str(it['wp:attachment_url']), alt: str(meta(it, '_wp_attachment_image_alt')), caption: stripTags(str(it['excerpt:encoded'])) },
      ]),
  );
  for (const it of items.filter((x) => str(x['wp:post_type']) === 'attachment')) {
    const url = str(it['wp:attachment_url']);
    if (!url) continue;
    ATTACH_BY_ID.set(str(it['wp:post_id']), url);
    if (str(it['wp:post_name'])) ATTACH_BY_SLUG.set(safeDecode(str(it['wp:post_name'])), url);
  }

  return items
    .filter((it) => str(it['wp:post_type']) === type && str(it['wp:status']) === 'publish')
    .map((it) => {
      const cats = (it.category ?? []) as any[];
      const thumb = meta(it, '_thumbnail_id');
      const gmt = str(it['wp:post_date_gmt']);
      const local = str(it['wp:post_date']);
      return {
        id: Number(str(it['wp:post_id'])),
        type,
        slug: safeDecode(str(it['wp:post_name'])) || slugify(str(it.title)),
        title: decodeEntities(str(it.title)),
        date: gmt && !gmt.startsWith('0000') ? `${gmt.replace(' ', 'T')}Z` : `${local.replace(' ', 'T')}+01:00`,
        modified: str(it['wp:post_modified_gmt']) ? `${str(it['wp:post_modified_gmt']).replace(' ', 'T')}Z` : undefined,
        link: str(it.link),
        html: str(it['content:encoded']),
        excerpt: str(it['excerpt:encoded']),
        categories: cats.filter((c) => c['@_domain'] === 'category').map((c) => ({ name: decodeEntities(str(c)), slug: safeDecode(c['@_nicename']) })),
        tags: cats.filter((c) => c['@_domain'] === 'post_tag').map((c) => decodeEntities(str(c))),
        featured: thumb ? xmlAttachments.get(String(thumb)) : undefined,
        status: 'publish',
        needsAutop: true, // WXR content is stored raw, without <p> tags
      } satisfies WPPost;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ------------------------------------------------------------------ */
/* Chess games                                                         */
/* ------------------------------------------------------------------ */
/** Undo WordPress "wptexturize" and HTML so the PGN parses again: “” → ", 1–0 → 1-0, <br> → newline … */
function cleanPgn(raw: string): string {
  return decodeEntities(
    raw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[\u201C\u201D\u201E\u2033\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u00D7/g, 'x')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
const looksLikePgn = (t: string) =>
  /\[\s*(White|Black|Event|FEN)\s+"/.test(t) || /(^|\s)1\.\s*(\.\.\.)?\s*[a-hNBRQKO][a-h1-8x=O+#-]/.test(t);
/** placeholder element, base64 so autop and turndown leave the PGN untouched */
const pgnMarker = (pgn: string, title = '') =>
  `<pre data-pgn-viewer="${Buffer.from(pgn, 'utf8').toString('base64')}" data-title="${title.replace(/"/g, '&quot;')}">♞</pre>`;
const fenToPgn = (fen: string) => `[SetUp "1"]\n[FEN "${fen.trim()}"]\n\n*`;

function convertChessShortcodes(html: string, rep: { games: number }): string {
  // [pgn]…[/pgn], [pgnv …]…[/pgnv] (PgnViewerJS: pgnv/pgne/pgnb/pgnp/pgnm), [chess]…[/chess], [fen]…[/fen]
  html = html.replace(/\[(pgn[a-z]?|pgnviewer|chess(?:game|board)?|fen)\b([^\]]*)\]([\s\S]*?)\[\/\1\]/gi, (m, tag: string, _attrs: string, body: string) => {
    const text = cleanPgn(body);
    if (!text) return m;
    rep.games++;
    return `\n\n${pgnMarker(/^fen$/i.test(tag) ? fenToPgn(text) : text)}\n\n`;
  });
  // PGN pasted straight into the post: at least 3 header lines followed by moves and a result
  const headerLine = String.raw`\[\s*[A-Z][A-Za-z]+\s+(?:"|&quot;|&#822[01];|&#8222;|[\u201C\u201D\u201E])[^\]\n]*\]`;
  const sep = String.raw`(?:\s|<br\s*/?>|</?p[^>]*>)*`;
  const raw = new RegExp(`(?:${headerLine}${sep}){3,}[\\s\\S]{0,20000}?(?:1-0|0-1|1/2-1/2|\u00BD-\u00BD|1[\u2013-]0|0[\u2013-]1|1/2[\u2013-]1/2|(?:1|0|1/2)&#821[12];(?:1|0|1/2)|\\*)(?=\\s|<|$)`, 'g');
  html = html.replace(raw, (m: string, offset: number, whole: string) => {
    // the RPB Chessboard plugin repeats its game inside <noscript> – that copy is handled with the plugin block
    const before = whole.slice(0, offset);
    if (before.lastIndexOf('<noscript') > before.lastIndexOf('</noscript>')) return m;
    const text = cleanPgn(m);
    if (!looksLikePgn(text)) return m;
    rep.games++;
    return `\n\n${pgnMarker(text)}\n\n`;
  });
  return html;
}

/* ------------------------------------------------------------------ */
/* HTML preprocessing (shortcodes, autop)                              */
/* ------------------------------------------------------------------ */
function autop(html: string): string {
  if (/<p[\s>]/i.test(html)) return html;
  const block = /^\s*<(div|figure|table|ul|ol|h[1-6]|blockquote|pre|iframe|hr|p|!--)/i;
  return html
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((chunk) => (block.test(chunk) ? chunk : `<p>${chunk.trim().replace(/\n/g, '<br>\n')}</p>`))
    .join('\n');
}

function expandShortcodes(html: string, warnings: string[], rep: { games: number } = { games: 0 }): string {
  html = convertChessShortcodes(html, rep);
  // [caption id="" align="" width=""]<img …> Caption text[/caption]
  html = html.replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/gi, (_, inner: string) => {
    const img = inner.match(/<a[^>]*>\s*<img[^>]*>\s*<\/a>|<img[^>]*>/i)?.[0] ?? '';
    const text = inner.replace(img, '').trim();
    return `<figure>${img}<figcaption>${text}</figcaption></figure>`;
  });
  // [gallery ids="1,2,3"]
  html = html.replace(/\[gallery([^\]]*)\]/gi, (m, attrs: string) => {
    const ids = attrs.match(/ids=["']?([\d,\s]+)/)?.[1]?.split(',').map((s) => s.trim()) ?? [];
    const imgs = ids.map((id) => xmlAttachments.get(id)).filter(Boolean) as Media[];
    if (!imgs.length) {
      warnings.push(`Gallery shortcode without resolvable images: ${m}`);
      return '';
    }
    return `<figure class="wp-block-gallery">${imgs.map((i) => `<figure><img src="${i.url}" alt="${i.alt ?? ''}">${i.caption ? `<figcaption>${i.caption}</figcaption>` : ''}</figure>`).join('')}</figure>`;
  });
  // [youtube]url[/youtube] / [youtube id="…"] (old Jetpack-style / plugin shortcodes)
  // emitted as a link to the canonical watch URL: as plain text, Markdown would escape "_" in the video ID and break it
  const ytLink = (id: string) => `\n\n<p><a href="https://www.youtube.com/watch?v=${id}">https://www.youtube.com/watch?v=${id}</a></p>\n\n`;
  html = html.replace(/\[youtube[^\]]*\]\s*(\S+?)\s*\[\/youtube\]/gi, (_m, url) => {
    const id = decodeEntities(url).match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1];
    return id ? ytLink(id) : `\n\n<p>${url.trim()}</p>\n\n`;
  });
  html = html.replace(/\[youtube[^\]]*?(?:id|v)=["'\u201D\u2033]?([\w-]{11})[^\]]*\]/gi, (_, id) => ytLink(id));
  // [embed]url[/embed] and bare oEmbed URLs on their own line
  html = html.replace(/\[embed[^\]]*\]([\s\S]*?)\[\/embed\]/gi, (_, url) => `\n\n<p>${url.trim()}</p>\n\n`);
  html = html.replace(/^\s*(https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/\S+)\s*$/gim, '<p>$1</p>');
  // anything else that still looks like a shortcode
  const left =
    html
      .match(/\[(\/?[a-z_][\w-]*)(\s[^\]]*)?\]/gi)
      ?.filter((s) => !/^\[\d+\]$/.test(s) && !/^\[[A-Z][A-Za-z]+\s+(\\?"|&quot;|&#822[01];)/.test(s)) ?? [];
  if (left.length) warnings.push(`Unconverted shortcodes kept as text: ${[...new Set(left)].slice(0, 5).join(' ')}`);
  return html;
}

/** Chess content that only exists in the rendered HTML (plugins, embeds, links). Runs before turndown. */
async function convertChessEmbeds(doc: any, base: string, rep: PostReport, originalHtml: string): Promise<void> {
  const all = (sel: string): any[] => Array.from(doc.querySelectorAll(sel));
  const swap = (el: any, html: string) => {
    const tmp = doc.createElement('div');
    tmp.innerHTML = html;
    while (tmp.firstChild) el.parentNode.insertBefore(tmp.firstChild, el);
    el.parentNode.removeChild(el);
  };
  const insertAfter = (el: any, html: string) => {
    const tmp = doc.createElement('div');
    tmp.innerHTML = html;
    const next = el.nextSibling;
    while (tmp.firstChild) el.parentNode.insertBefore(tmp.firstChild, next);
  };
  const up = (n: any, test: (a: any) => boolean) => {
    for (let a = n; a && a.nodeType === 1; a = a.parentNode) if (test(a)) return a;
    return null;
  };
  const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const fileMarker = (url: string, title: string) => `<pre data-pgn-file="${attr(url)}" data-title="${attr(title)}">♞</pre>`;
  const before = rep.games;

  // 0. RPB Chessboard (WordPress plugin "rpb-chessboard"): <div class="rpbchessboard-chessgame|chessboard">
  //    with the PGN/FEN in a <noscript> block and in the jQuery init call; spacer paragraphs around it.
  for (const sp of all('p.rpbchessboard-spacerBefore, p.rpbchessboard-spacerAfter')) sp.parentNode?.removeChild(sp);
  for (const el of all('div.rpbchessboard-chessgame, div.rpbchessboard-chessboard')) {
    const isDiagram = /(^|\s)rpbchessboard-chessboard(\s|$)/.test(el.className);
    let text = '';
    const script = (el.querySelector('script')?.textContent ?? '') as string;
    const json = script.match(/\.(?:chessgame|chessboard)\((\{[\s\S]*\})\)\s*;/);
    if (json) {
      try {
        const cfg = JSON.parse(json[1]);
        text = String(isDiagram ? cfg.position ?? '' : cfg.pgn ?? '');
      } catch { /* fall back to the noscript text */ }
    }
    if (!text) {
      const ns = el.querySelector('noscript');
      const raw = (ns ? ns.innerHTML || ns.textContent : '') as string;
      const block = raw.match(/rpbchessboard-noJavascriptBlock">([\s\S]*?)<\/div>/);
      text = decodeEntities((block ? block[1] : raw).replace(/<[^>]+>/g, ''));
    }
    text = text.replace(/\r\n?/g, '\n').trim();
    if (isDiagram) {
      if (/^[pnbrqkPNBRQK1-8]+(\/[pnbrqkPNBRQK1-8]+){7}(\s|$)/.test(text)) { swap(el, pgnMarker(fenToPgn(text))); rep.games++; }
      else rep.warnings.push(`RPB Chessboard diagram without a readable position, removed: ${text.slice(0, 60)}`);
    } else if (looksLikePgn(text) || /^\s*\[/.test(text)) {
      swap(el, pgnMarker(cleanPgn(text)));
      rep.games++;
    } else {
      rep.warnings.push('RPB Chessboard game without readable PGN – kept as text');
      swap(el, `<pre>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`);
    }
  }

  // 1. any element carrying the game in a data attribute (RPB Chessboard, custom themes …)
  for (const el of all('[data-pgn]')) {
    const t = cleanPgn(el.getAttribute('data-pgn') || '');
    if (looksLikePgn(t)) { swap(el, pgnMarker(t)); rep.games++; }
  }
  // 2. viewer scripts such as PgnViewerJS: PGNV.pgnView('id', { pgn: '1. e4 …' })
  for (const sc of all('script')) {
    const m = (sc.textContent || '').match(/\bpgn\s*:\s*(["'`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1/);
    if (!m) continue;
    const js = m[2].replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\(["'`\\/])/g, '$1');
    const t = cleanPgn(js);
    if (looksLikePgn(t)) { swap(sc, pgnMarker(t)); rep.games++; }
  }
  // 3. PGN text inside <textarea>/<pre>, or inside elements whose class/id mentions pgn/chess
  for (const el of all('textarea, pre, code, div, span').reverse()) {
    if (!el.parentNode || el.hasAttribute('data-pgn-viewer') || el.hasAttribute('data-pgn-file')) continue;
    if (el.querySelector && el.querySelector('[data-pgn-viewer],[data-pgn-file]')) continue;
    const plain = el.nodeName === 'TEXTAREA' || el.nodeName === 'PRE' || el.nodeName === 'CODE';
    if (!plain && !/pgn|chess/i.test(`${el.className || ''} ${el.id || ''}`)) continue;
    const t = cleanPgn(el.nodeName === 'TEXTAREA' ? el.textContent : el.innerHTML);
    if (!/^(\[|1\.)/.test(t) || !looksLikePgn(t)) continue;
    const target = el.nodeName === 'CODE' && el.parentNode?.nodeName === 'PRE' ? el.parentNode : el;
    swap(target, pgnMarker(t));
    rep.games++;
  }
  // 4. embedded boards
  for (const f of all('iframe')) {
    const src = f.getAttribute('src') || f.getAttribute('data-src') || '';
    let u: URL;
    try { u = new URL(src, base); } catch { continue; }
    const wrapper = up(f, (a) => /(^|\s)(wp-block-embed|wp-block-embed__wrapper)(\s|$)/.test(a.className || '') && a.nodeName === 'FIGURE') ?? f;
    if (/(^|\.)lichess\.org$/.test(u.hostname)) {
      if (!LICHESS) { rep.warnings.push(`lichess embed kept (--no-lichess): ${src}`); continue; }
      const study = u.pathname.match(/\/study\/(?:embed\/)?([A-Za-z0-9]{8})\/([A-Za-z0-9]{8})/);
      const game = u.pathname.match(/^\/(?:embed\/)?(?:game\/)?([A-Za-z0-9]{8})(?:[A-Za-z0-9]{4})?(?:\/|$)/);
      const api = study ? `${LICHESS}/api/study/${study[1]}/${study[2]}.pgn` : game ? `${LICHESS}/game/export/${game[1]}?clocks=false&evals=false` : '';
      if (!api) continue;
      try {
        const res = await fetchRetry(api, { headers: { Accept: 'application/x-chess-pgn' } }, 2);
        const text = res.ok ? (await res.text()).trim() : '';
        if (!looksLikePgn(text)) throw new Error(`HTTP ${res.status}`);
        swap(wrapper, pgnMarker(text));
        rep.games++;
      } catch (e) {
        rep.warnings.push(`lichess game could not be downloaded, embed kept: ${src} (${(e as Error).message})`);
      }
      continue;
    }
    if (/pgn4web|board\.html/i.test(u.pathname) || u.searchParams.has('pgnText') || u.searchParams.has('pgnData')) {
      const text = u.searchParams.get('pgnText');
      const data = u.searchParams.get('pgnData');
      if (text && looksLikePgn(cleanPgn(text))) { swap(wrapper, pgnMarker(cleanPgn(text))); rep.games++; }
      else if (data) { swap(wrapper, fileMarker(new URL(data, base).href, '')); rep.games++; }
      else rep.warnings.push(`pgn4web board without readable PGN, kept as iframe: ${src}`);
      continue;
    }
    if (/(^|\.)chess\.com$/.test(u.hostname))
      rep.warnings.push(`chess.com embed kept as iframe – export its PGN on chess.com and paste it into the article: ${src}`);
  }
  // 5. links to .pgn files → interactive board (the link itself stays as a download link)
  const seenPgn = new Set<string>(all('[data-pgn-file]').map((e: any) => e.getAttribute('data-pgn-file')));
  for (const a of all('a[href]')) {
    let u: URL;
    try { u = new URL(a.getAttribute('href'), base); } catch { continue; }
    if (!/\.pgn$/i.test(u.pathname)) continue;
    if (seenPgn.has(u.href)) continue; // one board per file, even if the article links it twice
    seenPgn.add(u.href);
    const label = (a.textContent || '').trim();
    const block = up(a, (n) => /^(P|LI|DIV|TD)$/.test(n.nodeName));
    if (block && block.nodeName === 'P' && (block.textContent || '').trim() === label) swap(block, fileMarker(u.href, label));
    else insertAfter(block ?? a, fileMarker(u.href, label));
    rep.games++;
  }

  if (rep.games === before && /pgn|chessboard|chess-?game|pgn4web|lichess\.org\/|chess\.com\/(emboard|embed)/i.test(originalHtml) && !/data-pgn-viewer/.test(originalHtml))
    rep.warnings.push('Possible chess content (plugin/embed) that was not converted – please check this article');
}

/* ------------------------------------------------------------------ */
/* Conversion                                                          */
/* ------------------------------------------------------------------ */
interface Asset { url: string; file: string; kind: 'image' | 'file' | 'pgn' }

function makeTurndown(ctx: {
  oldHosts: Set<string>;
  linkMap: Map<string, string>;
  assets: Map<string, Asset>;
  addImage: (url: string) => string;
  addFile: (url: string) => string;
  addPgnFile?: (url: string) => string;
  warnings: string[];
  base: string;
}) {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    hr: '---',
  });
  td.use(gfm);
  td.remove(['script', 'style', 'noscript', 'form', 'button']);

  const all = (n: any, sel: string): any[] => Array.from(n.querySelectorAll(sel));
  const GALLERY = /(^|\s)(wp-block-gallery|gallery|tiled-gallery|blocks-gallery-grid)(\s|$)/;
  const insideGallery = (n: any) => {
    for (let a = n.parentNode; a && a.nodeType === 1; a = a.parentNode) if (GALLERY.test(a.className || '')) return true;
    return false;
  };
  const up = (n: any, test: (a: any) => boolean) => {
    for (let a = n; a && a.nodeType === 1; a = a.parentNode) if (test(a)) return a;
    return null;
  };
  const imgSrc = (img: any): string | undefined => {
    const raw =
      img.getAttribute('data-orig-file') ||
      largestFromSrcset(img.getAttribute('srcset') || img.getAttribute('data-srcset')) ||
      img.getAttribute('data-src') ||
      img.getAttribute('data-lazy-src') ||
      img.getAttribute('src');
    if (!raw || raw.startsWith('data:')) return undefined;
    return raw;
  };
  const md = (s = '') => s.replace(/([\[\]"])/g, '\\$1').replace(/\s+/g, ' ').trim();
  const imageMd = (img: any, caption?: string) => {
    const src = imgSrc(img);
    if (!src) return '';
    const local = ctx.addImage(src);
    const alt = md(img.getAttribute('alt') || caption || '');
    return `![${alt}](${local}${caption ? ` "${md(caption)}"` : ''})`;
  };

  // Chess games (markers created by convertChessShortcodes / convertChessEmbeds)
  td.addRule('pgnViewer', {
    filter: (node: any) => node.nodeName === 'PRE' && node.hasAttribute('data-pgn-viewer'),
    replacement: (_c: string, node: any) => {
      const pgn = Buffer.from(node.getAttribute('data-pgn-viewer'), 'base64').toString('utf8');
      const title = (node.getAttribute('data-title') || '').replace(/\s+/g, ' ').trim();
      return `\n\n\`\`\`pgn${title ? ` ${title}` : ''}\n${pgn}\n\`\`\`\n\n`;
    },
  });
  td.addRule('pgnFile', {
    filter: (node: any) => node.nodeName === 'PRE' && node.hasAttribute('data-pgn-file'),
    replacement: (_c: string, node: any) => {
      const url = node.getAttribute('data-pgn-file');
      const local = ctx.addPgnFile ? ctx.addPgnFile(url) : url;
      return `\n\n[${md(node.getAttribute('data-title') || 'Partija')}](${local})\n\n`;
    },
  });

  // Galleries (Gutenberg, classic [gallery] HTML, Jetpack tiled galleries)
  td.addRule('gallery', {
    filter: (node: any) => GALLERY.test(node.className || '') && node.querySelectorAll('img').length > 0 && !insideGallery(node),
    replacement: (_c: string, node: any) => {
      const lines = all(node, 'img').map((img: any) => {
        const fig = up(img, (a) => a.nodeName === 'FIGURE' || a.nodeName === 'LI' || /gallery-item/.test(a.className || ''));
        const cap = fig?.querySelector('figcaption, .gallery-caption, .wp-caption-text')?.textContent?.trim();
        return imageMd(img, cap);
      });
      return `\n\n${lines.filter(Boolean).join('\n')}\n\n`;
    },
  });

  // <figure><img><figcaption> and classic .wp-caption
  td.addRule('figure', {
    filter: (node: any) =>
      (node.nodeName === 'FIGURE' || /(^|\s)wp-caption(\s|$)/.test(node.className || '')) &&
      node.querySelectorAll('img').length === 1 &&
      !node.querySelector('iframe'),
    replacement: (_c: string, node: any) => {
      const cap = node.querySelector('figcaption, .wp-caption-text')?.textContent?.trim();
      return `\n\n${imageMd(node.querySelector('img'), cap)}\n\n`;
    },
  });

  td.addRule('image', {
    filter: 'img',
    replacement: (_c: string, node: any) => imageMd(node),
  });

  // Embeds: YouTube iframes / Gutenberg embed blocks → URL on its own line (rendered as video by the site)
  td.addRule('embed', {
    filter: (node: any) =>
      node.nodeName === 'IFRAME' || /(^|\s)wp-block-embed(\s|$)/.test(node.className || ''),
    replacement: (_c: string, node: any) => {
      const src: string = node.getAttribute?.('src') || node.querySelector?.('iframe')?.getAttribute('src') || '';
      const text = (node.querySelector?.('.wp-block-embed__wrapper')?.textContent ?? '').trim();
      const url = text.startsWith('http') ? text : src;
      const yt = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/);
      if (yt) return `\n\nhttps://www.youtube.com/watch?v=${yt[1]}\n\n`;
      if (node.nodeName === 'IFRAME' && src && /^http:\/\//i.test(src)) {
        // an http:// iframe is blocked on an https site – keep a link to the original instead
        let host = '';
        try { host = new URL(src).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
        ctx.warnings.push(`Embedded http:// iframe replaced by a link (would be blocked on https): ${src}`);
        return `\n\n[Videozapis / ugrađeni sadržaj (${host || 'vanjska stranica'})](${src})\n\n`;
      }
      if (node.nodeName === 'IFRAME' && src) {
        ctx.warnings.push(`Embedded iframe kept as HTML: ${src}`);
        return `\n\n<iframe src="${src}" loading="lazy" width="100%" height="${node.getAttribute('height') || 450}" style="border:0"></iframe>\n\n`;
      }
      return url ? `\n\n<${url}>\n\n` : '';
    },
  });

  td.addRule('links', {
    filter: (node: any) => node.nodeName === 'A' && node.getAttribute('href'),
    replacement: (content: string, node: any) => {
      let href: string = node.getAttribute('href');
      const onlyImg = node.querySelectorAll('img').length > 0 && !node.textContent.trim();
      try {
        const u = new URL(href, 'http://x.invalid');
        const internal = ctx.oldHosts.has(u.hostname);
        if (internal || u.hostname === 'x.invalid') {
          const path = u.pathname;
          // image wrapped in a link to itself / attachment page → keep just the image
          if (onlyImg) return content;
          if (/\/wp-content\/uploads\//.test(path) && FILE_EXT.test(path)) href = ctx.addFile(new URL(href, ctx.base).href);
          else if (/\/wp-content\/uploads\//.test(path) && IMG_EXT.test(path)) href = ctx.addImage(href);
          else {
            const mapped = ctx.linkMap.get(normPath(u.href)) ?? ctx.linkMap.get(`id:${u.searchParams.get('p')}`) ?? ctx.linkMap.get(`page:${u.searchParams.get('page_id')}`);
            if (mapped) href = mapped + u.hash;
            else if (internal) ctx.warnings.push(`Internal link not mapped (page or deleted post?): ${href}`);
          }
        }
      } catch { /* leave as is */ }
      if (onlyImg) return content;
      const title = node.getAttribute('title');
      return `[${content}](${href}${title ? ` "${md(title)}"` : ''})`;
    },
  });

  return td;
}

/* ------------------------------------------------------------------ */
/* Downloads                                                           */
/* ------------------------------------------------------------------ */
const downloadCache = new Map<string, { buf: Buffer; ext: string } | Error>();

async function download(url: string, kind: 'image' | 'file'): Promise<{ buf: Buffer; ext: string }> {
  const key = `${kind}:${url}`;
  const cached = downloadCache.get(key);
  if (cached instanceof Error) throw cached;
  if (cached) return cached;
  const candidates = kind === 'image' && originalOf(url) !== url ? [originalOf(url), url] : [url];
  let lastErr: Error = new Error('unknown');
  for (const c of candidates) {
    try {
      const res = await fetchRetry(c);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      let ext = extname(new URL(c).pathname).toLowerCase() || '';
      if (kind === 'image') {
        const sniffed = sniffImage(buf);
        if (!sniffed) throw new Error('not an image (HTML error page?)');
        const norm = await normaliseImage(buf, sniffed);
        const out = norm;
        downloadCache.set(key, out);
        return out;
      }
      const out = { buf, ext };
      downloadCache.set(key, out);
      return out;
    } catch (e) {
      lastErr = e as Error;
    }
  }
  downloadCache.set(key, lastErr);
  throw lastErr;
}

async function maybeResize(buf: Buffer, ext: string): Promise<Buffer> {
  if (!sharp || !MAX_W || !['.jpg', '.png', '.webp'].includes(ext)) return buf;
  try {
    const img = sharp(buf, { failOn: 'none' });
    const meta = await img.metadata();
    if ((meta.width ?? 0) <= MAX_W) return buf;
    const r = img.rotate().resize({ width: MAX_W, withoutEnlargement: true });
    return ext === '.png' ? await r.png({ compressionLevel: 9 }).toBuffer()
      : ext === '.webp' ? await r.webp({ quality: 85 }).toBuffer()
      : await r.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  } catch {
    return buf;
  }
}

function safeFileName(url: string, fallback: string): string {
  const base = safeDecode(new URL(url).pathname.split('/').pop() ?? fallback).replace(/\.[^.]+$/, '');
  return slugify(originalOf(`${base}.jpg`).replace(/\.jpg$/, '')) || fallback;
}

/* ------------------------------------------------------------------ */
/* Existing content (duplicate protection)                             */
/* ------------------------------------------------------------------ */
const previousLinks = new Map<string, string>(); // old URL → folder, from earlier runs
function existingByWpId(): Map<number, string> {
  const map = new Map<number, string>();
  if (!existsSync(OUT)) return map;
  for (const entry of readdirSync(OUT)) {
    const f = [join(OUT, entry, 'index.md'), join(OUT, entry, 'index.mdx'), join(OUT, entry)].find(
      (p) => existsSync(p) && statSync(p).isFile() && /\.mdx?$/.test(p),
    );
    if (!f) continue;
    const src = readFileSync(f, 'utf8');
    const m = src.match(/^wordpress:\s*\n\s+id:\s*(\d+)/m);
    if (m) map.set(Number(m[1]), entry);
    const url = src.match(/^wordpress:[\s\S]*?\n\s+url:\s*"?([^"\n]+)"?/m)?.[1];
    if (url && m) { previousLinks.set(normPath(url), entry); previousLinks.set(`id:${m[1]}`, entry); }
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Front matter                                                        */
/* ------------------------------------------------------------------ */
const y = (s: string) => JSON.stringify(s); // JSON strings are valid YAML scalars (keeps č ć š đ ž intact)
function frontmatter(p: WPPost, slug: string, description: string, cover: string | null, coverAlt: string | undefined) {
  const lines = [
    '---',
    `title: ${y(p.title)}`,
    `slug: ${y(slug)}`,
    `description: ${y(description)}`,
    `pubDate: ${p.date}`,
    ...(p.modified && p.modified.slice(0, 10) !== p.date.slice(0, 10) ? [`updatedDate: ${p.modified}`] : []),
    ...(cover ? [`image: ${y(cover)}`] : []),
    ...(cover && coverAlt ? [`imageAlt: ${y(coverAlt)}`] : []),
    `categories: [${p.categories.map((c) => y(c.name)).join(', ')}]`,
    `tags: [${p.tags.map(y).join(', ')}]`,
    `translationKey: ${y(`wp-${p.id}`)}`,
    'wordpress:',
    `  id: ${p.id}`,
    `  url: ${y(p.link)}`,
    `  slug: ${y(p.slug)}`,
    '---',
    '',
  ];
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
async function main() {
  console.log(`\n♞  WordPress → Astro migration ${DRY ? '(DRY RUN – nothing is written)' : ''}`);
  console.log(`   source: ${[API && `REST ${API}`, XML && `XML ${XML}`].filter(Boolean).join(' + ')}`);
  console.log(`   target: ${relative(ROOT, OUT)}/\n`);

  let posts: WPPost[] = [];
  let pages: WPPost[] = [];
  if (XML) {
    posts = fromXml(XML, 'post');
    if (PAGES || GALLERIES.length || MEMBERS_SLUG) pages = fromXml(XML, 'page');
  } else if (JSON_DUMP) {
    posts = fromJson(JSON_DUMP, 'posts');
    if (PAGES || GALLERIES.length || MEMBERS_SLUG) pages = fromJson(JSON_DUMP, 'pages');
  } else if (API) {
    posts = await fromRest(API, 'posts');
    if (PAGES || GALLERIES.length || MEMBERS_SLUG) pages = await fromRest(API, 'pages');
  }
  posts = posts.filter((p) => p.status === 'publish');
  const totalPublished = posts.length;
  if (IDS.size) posts = posts.filter((p) => IDS.has(p.id));
  if (SINCE) posts = posts.filter((p) => p.date.slice(0, 10) >= SINCE);
  (report as any).totalPublishedAtSource = totalPublished;
  if (LIMIT) posts = posts.slice(0, LIMIT);
  console.log(`   found ${posts.length} published posts${PAGES ? ` and ${pages.length} pages` : ''}\n`);
  if (!posts.length && !pages.length) throw new Error('No posts found – check the URL / export file.');

  const oldHosts = new Set<string>(
    [API, ...posts.slice(0, 5).map((p) => p.link), ...pages.slice(0, 1).map((p) => p.link), ...(opt('old-host')?.split(',') ?? [])]
      .filter(Boolean)
      .flatMap((u) => { try { const h = new URL(u!.includes('://') ? u! : `https://${u}`).hostname; return [h, h.startsWith('www.') ? h.slice(4) : `www.${h}`]; } catch { return []; } }),
  );
  for (const h of oldHosts) OLD_SITE_HOSTS.add(h);

  // ---- pass 1: decide slugs/folders and build the link map ----
  const existing = existingByWpId();
  const usedFolders = new Set(existsSync(OUT) ? readdirSync(OUT) : []);
  const plan = posts.map((p) => {
    let slug = /[^\x00-\x7f]/.test(p.slug) || !p.slug ? slugify(p.slug || p.title) : p.slug.toLowerCase();
    slug ||= `objava-${p.id}`;
    const prev = existing.get(p.id);
    let folder = prev ?? slug;
    if (!prev) {
      while (usedFolders.has(folder)) folder = `${slug}-${p.id}`;
      usedFolders.add(folder);
    }
    return { p, slug: folder, folder, prev };
  });
  const linkMap = new Map<string, string>();
  for (const [k, folder] of previousLinks) linkMap.set(k, `${NEWS_BASE}${folder}/`);
  for (const { p, slug } of plan) {
    linkMap.set(normPath(p.link), `${NEWS_BASE}${slug}/`);
    linkMap.set(`id:${p.id}`, `${NEWS_BASE}${slug}/`);
  }
  for (const pg of pages) {
    const route = PAGE_ROUTES[pg.slug];
    if (!route) continue;
    const target = LANG === 'hr' ? route : `/en${route}`;
    linkMap.set(normPath(pg.link), target);
    linkMap.set(`page:${pg.id}`, target);
    try { linkMap.set(normPath(new URL(`/${pg.slug}/`, pg.link).href), target); } catch { /* ignore */ }
  }

  // ---- pass 2: convert + download ----
  for (const [n, { p, slug, folder, prev }] of plan.entries()) {
    const dir = join(OUT, folder);
    const rep: PostReport = {
      id: p.id, title: p.title, oldUrl: p.link, newPath: `${NEWS_BASE}${slug}/`, folder: relative(ROOT, dir),
      status: 'imported', images: 0, files: 0, games: 0, warnings: [],
    };
    report.posts.push(rep);
    const label = `[${String(n + 1).padStart(3)}/${plan.length}] ${p.title.slice(0, 60)}`;

    if (prev && !UPDATE) {
      rep.status = 'skipped-existing';
      console.log(`${label}  → already migrated (${prev}), skipped`);
      continue;
    }
    if (prev) rep.status = 'updated';

    try {
      const assets = new Map<string, Asset>();
      const usedNames = new Set<string>();
      const addImage = (url: string) => {
        const abs = new URL(url, p.link).href;
        const key = originalOf(abs); // same photo in different WordPress sizes → one file
        if (!assets.has(key)) {
          let name = safeFileName(abs, `slika-${assets.size + 1}`);
          while (usedNames.has(name)) name = `${name}-${assets.size + 1}`;
          usedNames.add(name);
          assets.set(key, { url: abs, file: name, kind: 'image' }); // extension added after download
        }
        return `__IMG__${assets.get(key)!.file}__`;
      };
      const addFile = (url: string) => {
        const abs = new URL(url, p.link).href;
        const m = new URL(abs).pathname.match(/\/uploads\/(.+)$/);
        const rel = m ? safeDecode(m[1]).split('/').map((s) => s.replace(/[^\w.\-]+/g, '-')).join('/') : safeFileName(abs, 'datoteka');
        assets.set(abs, { url: abs, file: rel, kind: 'file' });
        return `/files/wp/${rel}`;
      };

      const addPgnFile = (url: string) => {
        const abs = new URL(url, p.link).href;
        if (!assets.has(`pgn:${abs}`)) {
          let name = safeFileName(abs, `partija-${assets.size + 1}`);
          while (usedNames.has(name)) name = `${name}-${assets.size + 1}`;
          usedNames.add(name);
          assets.set(`pgn:${abs}`, { url: abs, file: name, kind: 'pgn' });
        }
        return `__PGN__${assets.get(`pgn:${abs}`)!.file}__`;
      };
      const td = makeTurndown({ oldHosts, linkMap, assets, addImage, addFile, addPgnFile, warnings: rep.warnings, base: p.link });
      let html = p.html.replace(/<!--[\s\S]*?-->/g, '');
      html = expandShortcodes(html, rep.warnings, rep);
      if (p.needsAutop) html = autop(html);
      const dom = domino.createDocument(`<!doctype html><html><body>${html}</body></html>`);
      // links to attachment pages → the attached file (so .pgn attachments become boards, PDFs get downloaded)
      for (const a of Array.from(dom.querySelectorAll('a[href]')) as any[]) {
        let u: URL;
        try { u = new URL(a.getAttribute('href'), p.link); } catch { continue; }
        if (!oldHosts.has(u.hostname) || /\/wp-content\//.test(u.pathname)) continue;
        const byId = u.searchParams.get('attachment_id');
        const segs = u.pathname.split('/').filter(Boolean);
        const file = byId ? ATTACH_BY_ID.get(byId) : segs.length >= 2 && !linkMap.has(normPath(u.href)) ? ATTACH_BY_SLUG.get(safeDecode(segs[segs.length - 1])) : undefined;
        if (file) a.setAttribute('href', file);
      }
      // an embed wrapped in <code> by an old plugin would end up as literal code text
      for (const code of Array.from(dom.querySelectorAll('code')) as any[]) {
        if (!code.querySelector('iframe, embed, object')) continue;
        const frag = dom.createDocumentFragment();
        while (code.firstChild) frag.appendChild(code.firstChild);
        code.replaceWith(frag);
      }
      await convertChessEmbeds(dom, p.link, rep, p.html);
      // presentational attributes from the old editor (fixed widths, inline styles) would fight the new design
      for (const el of Array.from(dom.querySelectorAll('table, thead, tbody, tr, td, th, p, span, div')) as any[])
        for (const a of ['style', 'width', 'height', 'border', 'cellpadding', 'cellspacing', 'align', 'valign']) el.removeAttribute(a);
      // paragraphs/blocks inside table cells (<td><p>½</p></td>, <td><div>½</div></td>) would split a Markdown table row over several lines
      // and break the whole table: keep the cell on one line, separate several paragraphs with <br>
      for (const cell of Array.from(dom.querySelectorAll('td, th')) as any[]) {
        const ps = Array.from(cell.querySelectorAll('p, div')) as any[];
        ps.forEach((pEl, i) => {
          const frag = dom.createDocumentFragment();
          while (pEl.firstChild) frag.appendChild(pEl.firstChild);
          if (i < ps.length - 1 && pEl.textContent !== null) frag.appendChild(dom.createElement('br'));
          pEl.replaceWith(frag);
        });
        // whitespace-only text nodes with line breaks inside a cell
        cell.innerHTML = cell.innerHTML.replace(/\s*\n\s*/g, ' ').trim();
      }
      let markdown = td.turndown(dom.body as any).replace(/\n{3,}/g, '\n\n').trim();

      // featured image (or first image in the article as card image)
      let coverToken: string | null = null;
      if (p.featured?.url) coverToken = addImage(p.featured.url);

      // download assets
      const resolved = new Map<string, string>(); // token-name → final relative path or remote url
      await pool([...assets.values()], CONC, async (a) => {
        try {
          if (a.kind === 'image') {
            const { buf, ext } = await download(a.url, 'image');
            const file = `${a.file}${ext === '.jpeg' ? '.jpg' : ext}`;
            resolved.set(a.file, `./${file}`);
            if (!DRY) {
              mkdirSync(dir, { recursive: true });
              writeFileSync(join(dir, file), await maybeResize(buf, ext));
            }
            rep.images++;
            report.imagesDownloaded++;
          } else if (a.kind === 'pgn') {
            const { buf } = await download(a.url, 'file');
            const text = buf.toString('utf8');
            if (!/\[\s*\w+\s+"|\d\.\s*[a-hNBRQKO]/.test(text)) throw new Error('not a PGN file');
            resolved.set(`pgn:${a.file}`, `./${a.file}.pgn`);
            if (!DRY) {
              mkdirSync(dir, { recursive: true });
              writeFileSync(join(dir, `${a.file}.pgn`), text.replace(/^\uFEFF/, ''));
            }
            rep.files++;
          } else {
            const { buf } = await download(a.url, 'file');
            if (!DRY) {
              const target = join(FILES_DIR, a.file);
              mkdirSync(dirname(target), { recursive: true });
              if (!existsSync(target)) writeFileSync(target, buf);
            }
            rep.files++;
            report.filesDownloaded++;
          }
        } catch (e) {
          const err = (e as Error).message;
          (a.kind === 'image' ? report.imagesFailed : report.filesFailed).push({ post: p.id, url: a.url, error: err });
          if (a.kind === 'pgn') rep.games--;
          rep.warnings.push(`FAILED ${a.kind}: ${a.url} (${err})`);
          if (a.kind === 'image') resolved.set(a.file, a.url); // keep remote URL so nothing is lost; verify step flags it
        }
      });

      markdown = markdown.replace(/__IMG__(.+?)__/g, (_, name) => resolved.get(name) ?? '');
      // .pgn files that could not be downloaded: drop the board, the report lists the failure
      markdown = markdown.replace(/^\[[^\]\n]*\]\(__PGN__(.+?)__\)$/gm, (m, name) => {
        const local = resolved.get(`pgn:${name}`);
        return local ? m.replace(`__PGN__${name}__`, local) : '';
      });
      markdown = markdown.replace(/!\[[^\]]*\]\(\)/g, ''); // images that could not be resolved at all

      let cover = coverToken ? (resolved.get(coverToken.replace(/^__IMG__|__$/g, '')) ?? null) : null;
      if (cover && !cover.startsWith('./')) cover = null;
      if (!cover) {
        const first = markdown.match(/!\[[^\]]*\]\((\.\/[^)\s]+)/);
        cover = first ? first[1] : null;
      }

      const excerpt = stripTags(p.excerpt)
        .replace(/\s*\[(…|&hellip;|\.\.\.)\]\s*$/, '')
        .replace(/\s*(Continue reading|Pročitaj(te)? više).*$/i, '')
        // shortcodes that WordPress left in the excerpt (e.g. "[youtube width=600]…[/youtube]")
        .replace(/\[(youtube|embed|video|audio|caption|gallery|pgn|fen)\b[^\]]*\][\s\S]*?\[\/\1\]/gi, ' ')
        .replace(/\[\/?(youtube|embed|video|audio|caption|gallery|pgn|fen)\b[^\]]*\]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const descSrc =
        excerpt ||
        markdown
          .replace(/```[\s\S]*?```/g, ' ')
          .replace(/^\[[^\]\n]*\]\([^)\s]*\.pgn\)$/gm, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
          .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
          .replace(/[#>*_|`\\]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      const description = descSrc.length > 200 ? `${descSrc.slice(0, 200).replace(/\s+\S*$/, '')}…` : descSrc;

      const fileContent = frontmatter(p, slug, description, cover, p.featured?.alt) + markdown + '\n';
      if (!DRY) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'index.md'), fileContent, 'utf8');
      } else rep.status = 'dry-run';

      console.log(`${label}  ✓ ${rep.images} img${rep.files ? `, ${rep.files} files` : ''}${rep.games ? `, ♞ ${rep.games} chess` : ''}${rep.warnings.length ? `, ${rep.warnings.length} warnings` : ''}`);
    } catch (e) {
      rep.status = 'failed';
      rep.error = (e as Error).stack ?? String(e);
      console.log(`${label}  ✗ ${(e as Error).message}`);
    }
  }

  // ---- photo gallery pages → albums ----
  if (GALLERIES.length) await importGalleries(pages.filter((pg) => GALLERIES.includes(pg.slug)), oldHosts);

  // ---- members page → src/data/members.json ----
  if (MEMBERS_SLUG) importMembers(pages.find((pg) => pg.slug === MEMBERS_SLUG || decodeURIComponent(pg.slug) === MEMBERS_SLUG));

  // ---- pages (for manual review, not published) ----
  if (PAGES && pages.length) {
    const td = makeTurndown({ oldHosts, linkMap, assets: new Map(), addImage: (u) => new URL(u, API ?? 'http://x').href, addFile: (u) => u, warnings: [], base: API ?? 'http://x.invalid' });
    for (const pg of pages) {
      const file = join(REPORT_DIR, 'pages', `${slugify(pg.slug || pg.title) || pg.id}.md`);
      const html = pg.needsAutop ? autop(expandShortcodes(pg.html, [])) : pg.html;
      const md = td.turndown(domino.createDocument(`<body>${html}</body>`).body);
      if (!DRY) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, `# ${pg.title}\n\n<!-- ${pg.link} -->\n\n${md}\n`); }
      report.pages.push({ id: pg.id, title: pg.title, file: relative(ROOT, file) });
    }
  }

  // ---- redirects ----
  const redirects = existsSync(REDIRECTS) ? JSON.parse(readFileSync(REDIRECTS, 'utf8')) : { paths: {}, ids: {} };
  redirects.paths ??= {};
  redirects.ids ??= {};
  for (const r of report.posts) {
    if (r.status === 'failed') continue;
    const old = normPath(r.oldUrl);
    if (old !== r.newPath && old !== '/' && !old.startsWith('/?')) redirects.paths[old] = r.newPath;
    redirects.ids[String(r.id)] = r.newPath;
  }
  for (const p of posts) for (const c of p.categories) {
    const from = `/category/${c.slug.toLowerCase()}/`;
    redirects.paths[from] ??= `${CAT_BASE}${slugify(c.name)}/`;
  }
  if (!DRY) writeFileSync(REDIRECTS, JSON.stringify(redirects, null, 2) + '\n');

  // ---- report ----
  const count = (s: PostReport['status']) => report.posts.filter((r) => r.status === s).length;
  const summary = {
    found: posts.length,
    imported: count('imported'),
    updated: count('updated'),
    skipped: count('skipped-existing'),
    failed: count('failed'),
    imagesDownloaded: report.imagesDownloaded,
    imagesFailed: report.imagesFailed.length,
    filesDownloaded: report.filesDownloaded,
    filesFailed: report.filesFailed.length,
    chessGames: report.posts.reduce((n, r) => n + (r.games ?? 0), 0),
    redirects: Object.keys(redirects.paths).length,
  };
  const md = [
    `# Migration report`,
    ``,
    `- Started: ${report.startedAt}`,
    `- Source: ${[API && `REST API ${API}`, XML && `XML ${XML}`].filter(Boolean).join(', ')}`,
    `- Mode: ${DRY ? 'dry run' : UPDATE ? 'update' : 'import'}`,
    ``,
    `| | |`, `|---|---|`,
    ...Object.entries(summary).map(([k, v]) => `| ${k} | ${v} |`),
    ``,
    summary.failed || summary.imagesFailed || summary.filesFailed ? `## ⚠️ Needs attention` : `## ✅ No failures`,
    ...report.posts.filter((r) => r.status === 'failed').map((r) => `- **FAILED** post ${r.id} “${r.title}”: ${r.error?.split('\n')[0]}`),
    ...report.imagesFailed.map((f) => `- Image not downloaded (post ${f.post}): ${f.url} – ${f.error}`),
    ...report.filesFailed.map((f) => `- File not downloaded (post ${f.post}): ${f.url} – ${f.error}`),
    ``,
    `## Warnings`,
    ...report.posts.flatMap((r) => r.warnings.filter((w) => !w.startsWith('FAILED')).map((w) => `- post ${r.id} (${r.folder}): ${w}`)),
    ``,
    `## Posts`,
    `| ID | Status | Old URL | New path | Images | Chess |`, `|---|---|---|---|---|---|`,
    ...report.posts.map((r) => `| ${r.id} | ${r.status} | ${r.oldUrl} | ${r.newPath} | ${r.images} | ${r.games || ''} |`),
    ...(report.albums.length ? [``, `## Photo albums (from gallery pages)`, `| Album | Photos | Failed | Folder |`, `|---|---|---|---|`, ...report.albums.map((a) => `| ${a.title} | ${a.photos} | ${a.failed} | ${a.folder} |`)] : []),
    ...(report.pages.length ? [``, `## Pages exported for review (not published)`, ...report.pages.map((p) => `- ${p.title} → ${p.file}`)] : []),
    membersReport,
    ``,
  ].join('\n');
  if (!DRY) {
    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(join(REPORT_DIR, 'report.md'), md);
    writeFileSync(join(REPORT_DIR, 'report.json'), JSON.stringify({ summary, ...report }, null, 2));
  }

  console.log('\n' + Object.entries(summary).map(([k, v]) => `   ${k.padEnd(18)} ${v}`).join('\n'));
  console.log(`\n   Report: ${relative(ROOT, join(REPORT_DIR, 'report.md'))}`);
  console.log(`   Next:   npm run verify:migration && npm run build\n`);
  if (summary.failed || summary.imagesFailed) process.exitCode = 2;
}

/** WordPress "gallery" pages: text paragraphs act as album titles, the photos after them form the album. */
function importMembers(page: WPPost | undefined) {
  const file = join(ROOT, 'src/data/members.json');
  const md: string[] = ['', '## Members (src/data/members.json)', ''];
  if (!page) {
    md.push(`⚠ The page "${MEMBERS_SLUG}" was not found among the WordPress pages – members.json is unchanged.`);
    console.log(`   members: page "${MEMBERS_SLUG}" not found – unchanged`);
    membersReport = md.join('\n');
    return;
  }
  const { rows, columns, warnings } = parseMembersTable(page.html);
  const data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { members: [] };
  if (!rows.length) {
    md.push(`⚠ No members table could be read from ${page.link} – members.json is unchanged.`, ...warnings.map((w) => `- ${w}`));
    console.log('   members: no table found – unchanged');
    membersReport = md.join('\n');
    return;
  }
  const res = mergeMembers(data.members as Member[], rows, columns);
  md.push(
    `Source: ${page.link}`,
    `Columns recognised: ${columns.map((c) => c ?? '–').join(' · ')}`,
    '',
    `| On the page | Added | Updated | Not on the page (kept) |`,
    `|---|---|---|---|`,
    `| ${rows.length} | ${res.added.length} | ${res.updated.length} | ${res.missing.length} |`,
    '',
    ...warnings.map((w) => `⚠ ${w}`),
    ...(res.added.length ? ['', `Added: ${res.added.join(', ')}`] : []),
    ...(res.missing.length ? ['', `Not on the old page (kept – remove them in the CMS if they left the club): ${res.missing.join(', ')}`] : []),
  );
  if (!DRY) writeFileSync(file, JSON.stringify({ ...data, updated: new Date().toISOString().slice(0, 10), source: page.link, members: res.members }, null, 2) + '\n');
  console.log(`   members: ${rows.length} on the page – ${res.added.length} added, ${res.updated.length} updated, ${res.missing.length} kept (not on page)`);
  membersReport = md.join('\n');
}
let membersReport = '';

async function importGalleries(pages: WPPost[], oldHosts: Set<string>) {
  const MONTHS: Record<string, string> = { siječ: '01', velja: '02', ožuj: '03', trav: '04', svib: '05', lip: '06', srp: '07', kolov: '08', ruj: '09', listop: '10', studen: '11', prosin: '12' };
  for (const pg of pages) {
    const dom = domino.createDocument(`<!doctype html><html><body>${pg.html}</body></html>`);
    type Album = { title: string; description: string[]; photos: { url: string; caption: string }[] };
    const albums: Album[] = [];
    let cur: Album | null = null;
    for (const block of Array.from(dom.body.children) as any[]) {
      const imgs = Array.from(block.querySelectorAll('img')) as any[];
      const text = (block.textContent || '').replace(/\s+/g, ' ').trim();
      if (!imgs.length) {
        if (!text) continue;
        if (!cur || cur.photos.length) albums.push((cur = { title: text, description: [], photos: [] }));
        else cur.description.push(text);
        continue;
      }
      // a paragraph with text *and* photos: the text names the album.
      // A photo-only paragraph continues the current album (albums are often several rows of 4 photos).
      if (!cur || (text && cur.photos.length)) albums.push((cur = { title: text || pg.title, description: [], photos: [] }));
      else if (text && cur.title === pg.title) cur.title = text;
      for (const img of imgs) {
        const a = img.closest('a');
        const href = a?.getAttribute('href') || '';
        let url = IMG_EXT.test(href) ? href : originalOf(largestFromSrcset(img.getAttribute('srcset')) || img.getAttribute('src') || '');
        if (!url) continue;
        try { url = new URL(url, pg.link).href; } catch { continue; }
        if (!oldHosts.has(new URL(url).hostname)) continue;
        cur.photos.push({ url, caption: (img.getAttribute('alt') || '').trim() });
      }
    }
    for (const al of albums.filter((x) => x.photos.length)) {
      const year = al.title.match(/\b(20\d{2}|19\d{2})\b/)?.[1] ?? pg.date.slice(0, 4);
      const lower = al.title.toLowerCase();
      const month = Object.entries(MONTHS).find(([k]) => lower.includes(k))?.[1] ?? '01';
      const title = al.title.replace(/[.:\s]+$/, '');
      const folder = `${year}-${slugify(title)}`.slice(0, 80).replace(/-+$/, '');
      const dir = join(GALLERY_OUT, folder);
      const rec = { title, folder: relative(ROOT, dir), photos: 0, failed: 0 };
      report.albums.push(rec);
      if (existsSync(join(dir, 'index.md')) && !UPDATE) { console.log(`   album ${title} → already there, skipped`); continue; }
      if (DRY) continue;
      mkdirSync(dir, { recursive: true });
      const used = new Set<string>();
      const lines: string[] = [];
      for (const ph of al.photos) {
        try {
          const { buf, ext } = await download(ph.url, 'image');
          let name = safeFileName(ph.url, `foto-${used.size + 1}`);
          while (used.has(name)) name = `${name}-${used.size + 1}`;
          used.add(name);
          writeFileSync(join(dir, `${name}${ext}`), await maybeResize(buf, ext));
          report.imagesDownloaded++;
          rec.photos++;
          // WordPress file names ("ivan", "kadeti") are not captions – keep only real alt texts
          const cap = ph.caption && !/^[\w-]+$/.test(ph.caption) ? ph.caption : '';
          lines.push(`  - image: ./${name}${ext}${cap ? `\n    caption: ${JSON.stringify(cap)}` : ''}`);
        } catch (e) {
          rec.failed++;
          report.imagesFailed.push({ post: pg.id, url: ph.url, error: (e as Error).message });
        }
      }
      if (!lines.length) { try { rmSync(dir, { recursive: true }); } catch { /* ignore */ } continue; }
      const fm = [
        '---',
        `title: ${JSON.stringify(title)}`,
        `date: ${year}-${month}-01`,
        ...(al.description.length ? [`description: ${JSON.stringify(al.description.join(' '))}`] : []),
        'photos:',
        ...lines,
        `# imported from ${pg.link}`,
        '---',
        '',
      ].join('\n');
      writeFileSync(join(dir, 'index.md'), fm, 'utf8');
      console.log(`   album ${title} → ${rec.photos} photos${rec.failed ? `, ${rec.failed} failed` : ''}`);
    }
  }
}

main().catch((e) => {
  console.error(`\n✗ Migration stopped: ${e.message}\n`);
  process.exit(1);
});
