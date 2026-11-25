import type { Lang } from '../i18n/ui';
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
      },
    }));
}

export async function firstNewsPage(lang: Lang) {
  return (await newsPages(lang, false))[0].props;
}

export async function categoryPages(lang: Lang) {
  const posts = await postsForListing(lang);
  const cats = await categoriesFor(lang);
  return cats.flatMap((cat) => {
    const inCat = posts.filter((p) => p.data.categories.some((c) => slugify(c) === cat.slug));
    return paginate(inCat).map(({ page, pages, items }) => ({
      params: { category: cat.slug, page: page > 1 ? String(page) : undefined },
      props: {
        lang, posts: items, page, pages, categories: cats, category: { name: cat.name, slug: cat.slug },
      },
    }));
  });
}

export async function postPages(lang: Lang) {
  return (await postsByLang(lang)).map((post) => ({ params: { slug: postSlug(post) }, props: { post } }));
}
