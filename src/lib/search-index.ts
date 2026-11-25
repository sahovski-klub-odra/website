import type { Lang } from '../i18n/ui';
import { withBase } from '../i18n/routes';
import { describe, plainText, postLang, postsForListing, postUrl } from './blog';

/** Compact static search index, loaded only on the search page. */
export async function buildSearchIndex(lang: Lang) {
  const posts = await postsForListing(lang);
  return posts.map((p) => ({
    t: p.data.title,
    d: describe(p, 160),
    u: withBase(postUrl(p)),
    c: p.data.categories,
    g: p.data.tags,
    p: p.data.pubDate.toISOString().slice(0, 10),
    l: postLang(p),
    x: plainText(p.body, 1500),
  }));
}
