import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n/ui';
import { newsPostPath } from '../i18n/routes';

export type Post = CollectionEntry<'blog'>;
export const PAGE_SIZE = 12;

export const postLang = (p: Post) => p.id.split('/')[0] as Lang;
export const postSlug = (p: Post) => p.id.split('/').slice(1).join('/');
export const postUrl = (p: Post) => newsPostPath(postLang(p), postSlug(p));

/** Production: hide drafts and future posts. `npm run dev`: show everything, so editors can check drafts. */
const isPublished = (p: Post) => import.meta.env.DEV || (!p.data.draft && p.data.pubDate <= new Date());
const byDate = (a: Post, b: Post) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf();

let cache: Post[] | null = null;
export async function allPosts(): Promise<Post[]> {
  cache ??= (await getCollection('blog', isPublished)).sort(byDate);
  return cache;
}

export async function postsByLang(lang: Lang) {
  return (await allPosts()).filter((p) => postLang(p) === lang);
}

/**
 * Posts listed on English pages: every English article, plus every Croatian article
 * that has no English translation (shown with an "In Croatian" badge, linking to the original).
 */
export async function postsForListing(lang: Lang): Promise<Post[]> {
  const posts = await allPosts();
  if (lang === 'hr') return posts.filter((p) => postLang(p) === 'hr');
  const translatedKeys = new Set(
    posts.filter((p) => postLang(p) === 'en' && p.data.translationKey).map((p) => p.data.translationKey),
  );
  return posts.filter(
    (p) => postLang(p) === 'en' || !p.data.translationKey || !translatedKeys.has(p.data.translationKey),
  );
}

export async function translationOf(post: Post): Promise<Post | undefined> {
  const key = post.data.translationKey;
  if (!key) return undefined;
  return (await allPosts()).find((p) => p.data.translationKey === key && postLang(p) !== postLang(post));
}

/** Croatian-aware URL slug: "Ekipno prvenstvo Županije" → "ekipno-prvenstvo-zupanije" */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function categoriesFor(lang: Lang) {
  const map = new Map<string, { name: string; slug: string; count: number }>();
  for (const p of await postsForListing(lang)) {
    for (const c of p.data.categories) {
      const slug = slugify(c);
      const e = map.get(slug) ?? { name: c, slug, count: 0 };
      e.count++;
      map.set(slug, e);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'hr'));
}

export async function relatedPosts(post: Post, limit = 3): Promise<Post[]> {
  const pool = await postsForListing(postLang(post));
  const cats = new Set(post.data.categories.map(slugify));
  const tags = new Set(post.data.tags.map(slugify));
  return pool
    .filter((p) => p.id !== post.id && !(post.data.translationKey && p.data.translationKey === post.data.translationKey))
    .map((p) => {
      let score = 0;
      p.data.categories.forEach((c) => cats.has(slugify(c)) && (score += 2));
      p.data.tags.forEach((t) => tags.has(slugify(t)) && (score += 3));
      const ageDays = Math.abs(p.data.pubDate.valueOf() - post.data.pubDate.valueOf()) / 864e5;
      score += Math.max(0, 1 - ageDays / 365);
      return { p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

export function readingTime(body = ''): number {
  const words = body.replace(/!\[[^\]]*\]\([^)]*\)/g, '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function formatDate(d: Date, lang: Lang) {
  return new Intl.DateTimeFormat(lang === 'hr' ? 'hr-HR' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zagreb',
  }).format(d);
}

/** Plain-text excerpt from Markdown, used for search and fallback descriptions. */
export function plainText(md = '', max = 600): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function describe(p: Post, max = 180): string {
  if (p.data.description) return p.data.description;
  const t = plainText(p.body, max + 40);
  return t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, '')}…` : t;
}

export function paginate<T>(items: T[], size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  return Array.from({ length: pages }, (_, i) => ({ page: i + 1, pages, items: items.slice(i * size, (i + 1) * size) }));
}
