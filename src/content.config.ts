import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * The CMS writes empty optional fields as '' (e.g. `image: ''`, `seoTitle: ''`). Treat those as "not set",
 * otherwise an empty image breaks the build and an empty SEO title would blank the <title>.
 */
const blank = (v: unknown) => (v === '' || v === null ? undefined : v);
const optString = () => z.preprocess(blank, z.string().optional());

/** "hr/turnir-odra/index.md" → "turnir-odra";  "hr/turnir-odra.md" → "turnir-odra" */
function slugFromEntry(entry: string): string {
  const parts = entry.replace(/\.(md|mdx)$/i, '').split('/');
  const last = parts.pop()!;
  return last === 'index' ? parts.pop()! : last;
}

/**
 * Blog articles (Croatian only).
 *  src/content/blog/hr/<slug>/index.md   (images next to the file)
 * Entry id = "hr/<slug>".
 */
const blog = defineCollection({
  loader: glob({
    pattern: ['hr/**/*.{md,mdx}'],
    base: './src/content/blog',
    generateId: ({ entry, data }) => {
      const lang = entry.split('/')[0];
      const slug = typeof data.slug === 'string' && data.slug ? data.slug : slugFromEntry(entry);
      return `${lang}/${slug}`;
    },
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      slug: z.string().optional(),
      description: z.string().default(''),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      image: z.preprocess(blank, image().optional()),
      imageAlt: optString(),
      /** caption shown under the featured photo */
      imageCaption: optString(),
      /** who wrote the article, as they signed it (e.g. "Darko", "Ivan M") */
      author: optString(),
      /** optional gallery album (folder name) whose photos belong to this article */
      album: optString(),
      categories: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      /** optional title for search engines / browser tab (set in the CMS) */
      seoTitle: optString(),
      seo: z
        .object({
          title: optString(),
          description: optString(),
          noindex: z.boolean().optional(),
        })
        .optional(),
      /** Filled by the migration script – used for redirects and duplicate detection. */
      wordpress: z
        .object({
          id: z.number(),
          url: z.string(),
          slug: z.string().optional(),
        })
        .optional(),
    }),
});

/**
 * Photo albums. One folder per album:
 *  src/content/gallery/<album>/index.md  (title, date, captions…)
 *  src/content/gallery/<album>/*.jpg      (photos – any photo in the folder is shown,
 *                                          even if it is not listed in index.md)
 */
const albums = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/gallery' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      description: optString(),
      /** year or season shown with the album, e.g. "2024." or "2023./2024." */
      season: optString(),
      category: optString(),
      cover: z.preprocess(blank, image().optional()),
      photos: z.preprocess(
        // a list item whose photo was removed in the CMS has `image: ''` – skip it
        (v) => (Array.isArray(v) ? v.filter((p) => p && typeof p === 'object' && blank((p as { image?: unknown }).image) !== undefined) : v),
        z
          .array(
            z.object({
              image: image(),
              caption: optString(),
            }),
          )
          .default([]),
      ),
      /** several photos uploaded at once (CMS "Dodaj više fotografija odjednom") – no captions */
      images: z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => blank(x) !== undefined) : v), z.array(image()).default([])),
      draft: z.boolean().default(false),
    }),
});

export const collections = { blog, albums };
