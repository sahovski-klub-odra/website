import type { Lang } from './ui';

/** Language-specific route segments. Croatian lives at the root, English under /en/. */
export const routes = {
  home: { hr: '/', en: '/en/' },
  news: { hr: '/novosti/', en: '/en/news/' },
  search: { hr: '/novosti/pretraga/', en: '/en/news/search/' },
  members: { hr: '/clanovi/', en: '/en/members/' },
  gallery: { hr: '/galerija/', en: '/en/gallery/' },
  schedule: { hr: '/raspored/', en: '/en/schedule/' },
  contact: { hr: '/kontakt/', en: '/en/contact/' },
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
  page <= 1 ? routes.news[lang] : `${routes.news[lang]}${lang === 'hr' ? 'stranica' : 'page'}/${page}/`;
export const categoryPath = (lang: Lang, cat: string, page = 1) =>
  `${routes.news[lang]}${lang === 'hr' ? 'kategorija' : 'category'}/${cat}/${page > 1 ? `${page}/` : ''}`;
export const albumPath = (lang: Lang, album: string) => `${routes.gallery[lang]}${album}/`;
export const rssPath = (lang: Lang) => (lang === 'hr' ? '/rss.xml' : '/en/rss.xml');
export const searchIndexPath = (lang: Lang) => (lang === 'hr' ? '/search-index.json' : '/en/search-index.json');

/** Alternate URLs for every language, used by the language switcher and hreflang tags. */
export type Alternates = Partial<Record<Lang, string>>;
export const alternatesFor = (key: RouteKey): Alternates => ({ ...routes[key] });
