import type { Lang } from '../i18n/ui';
import { categoryPath, newsPagePath, type Alternates } from '../i18n/routes';
import { categoriesFor, paginate, postsByLang, postsForListing, postSlug, slugify } from './blog';

export async function newsPages(lang: Lang, skipFirst = true) {
  const posts = await postsForListing(lang);
  const cats = await categoriesFor(lang);
  return paginate(posts)
    .filter((p) => !skipFirst || p.page > 1)
    .map(({ page, pages, items }) => ({
      params: { page: String(page) },
      props: {
        lang, posts: items, page, pages, categories: cats,
        alternates: { hr: newsPagePath('hr', 1), en: newsPagePath('en', 1), [lang]: newsPagePath(lang, page) } as Alternates,
      },
    }));
}

export async function firstNewsPage(lang: Lang) {
  return (await newsPages(lang, false))[0].props;
}

export async function categoryPages(lang: Lang) {
  const posts = await postsForListing(lang);
  const cats = await categoriesFor(lang);
  const otherLang: Lang = lang === 'hr' ? 'en' : 'hr';
  const otherCats = new Set((await categoriesFor(otherLang)).map((c) => c.slug));
  return cats.flatMap((cat) => {
    const inCat = posts.filter((p) => p.data.categories.some((c) => slugify(c) === cat.slug));
    return paginate(inCat).map(({ page, pages, items }) => ({
      params: { category: cat.slug, page: page > 1 ? String(page) : undefined },
      props: {
        lang, posts: items, page, pages, categories: cats, category: { name: cat.name, slug: cat.slug },
        alternates: {
          [lang]: categoryPath(lang, cat.slug, page),
          ...(otherCats.has(cat.slug) ? { [otherLang]: categoryPath(otherLang, cat.slug) } : {}),
        } as Alternates,
      },
    }));
  });
}

export async function postPages(lang: Lang) {
  return (await postsByLang(lang)).map((post) => ({ params: { slug: postSlug(post) }, props: { post } }));
}
