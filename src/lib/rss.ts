import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import type { Lang } from '../i18n/ui';
import { site } from './data';
import { describe, postsForListing, postUrl } from './blog';
import { routes, withBase } from '../i18n/routes';

export async function feed(context: APIContext, lang: Lang) {
  const posts = (await postsForListing(lang)).slice(0, 30);
  return rss({
    title: `${site.name} – Novosti`,
    description: site.about,
    site: new URL(withBase(routes.home[lang]), context.site).href,
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.pubDate,
      description: describe(p, 300),
      link: new URL(withBase(postUrl(p)), context.site).href,
      categories: p.data.categories,
    })),
    customData: '<language>hr-hr</language>',
  });
}
