import type { Lang } from './ui';

/** Route segments. The website is Croatian only and lives at the root. */
export const routes = {
  home: { hr: '/' },
  news: { hr: '/novosti/' },
  search: { hr: '/novosti/pretraga/' },
  members: { hr: '/clanovi/' },
  gallery: { hr: '/galerija/' },
  schedule: { hr: '/raspored/' },
  contact: { hr: '/kontakt/' },
} as const;

export type RouteKey = keyof typeof routes;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefix a root-relative path with the configured base path (GitHub Pages project sites). */
export function withBase(path: string): string {
  if (/^(https?:|mailto:|tel:|#|\/\/)/.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${p}`;
}

/** Remove the base path again, e.g. to compare against Astro.url.pathname. */
export function stripBase(pathname: string): string {
  if (BASE && pathname.startsWith(BASE)) return pathname.slice(BASE.length) || '/';
  return pathname;
}

export const r = (key: RouteKey, lang: Lang) => routes[key][lang];

export const newsPostPath = (lang: Lang, slug: string) => `${routes.news[lang]}${slug}/`;
export const newsPagePath = (lang: Lang, page: number) =>
  page <= 1 ? routes.news[lang] : `${routes.news[lang]}stranica/${page}/`;
export const categoryPath = (lang: Lang, cat: string, page = 1) =>
  `${routes.news[lang]}kategorija/${cat}/${page > 1 ? `${page}/` : ''}`;
export const albumPath = (lang: Lang, album: string) => `${routes.gallery[lang]}${album}/`;
export const rssPath = (_lang: Lang) => '/rss.xml';
export const searchIndexPath = (_lang: Lang) => '/search-index.json';
