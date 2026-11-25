import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';
import { readFileSync } from 'node:fs';
import type { Lang } from '../i18n/ui';

export type AlbumEntry = CollectionEntry<'albums'>;
export interface Photo { image: ImageMetadata; caption?: string; featured?: boolean }
export interface Album {
  id: string;
  title: string;
  description?: string;
  date: Date;
  /** year or season shown with the album, e.g. "2024." or "2023./2024." */
  season?: string;
  category?: string;
  cover: ImageMetadata | undefined;
  photos: Photo[];
}

/**
 * Every image inside src/content/gallery/<album>/. Used only for albums whose index.md lists no photos
 * (e.g. photos dropped into the folder on GitHub). Albums edited in the CMS list their photos, and then
 * exactly those are shown: when a photo is removed in the CMS its file stays in the folder, and it must
 * not reappear on the site.
 */
const files = import.meta.glob<ImageMetadata>('/src/content/gallery/*/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  import: 'default',
});

function folderImages(folder: string): { name: string; image: ImageMetadata }[] {
  return Object.entries(files)
    .filter(([path]) => path.split('/').at(-2) === folder)
    .map(([path, image]) => ({ name: path.split('/').at(-1)!, image }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** Photos inside article folders – used for articles linked to an album (article field "Album u galeriji"). */
const articleFiles = import.meta.glob<ImageMetadata>('/src/content/blog/hr/*/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  import: 'default',
});
const MD_IMAGE = /!\[([^\]]*)\]\(\.\/([^)\s]+)(?:\s+"([^"]*)")?\)/g;

/** Featured photo + photos in the text of every published article that names this album. */
async function linkedArticlePhotos(folder: string): Promise<Photo[]> {
  const posts = await getCollection('blog', (p) => p.data.album === folder && !p.data.draft);
  return posts
    .sort((a, b) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf())
    .flatMap((p) => {
      const dir = p.filePath ? p.filePath.replace(/\/index\.mdx?$/, '') : '';
      const fromText: Photo[] = [...(p.body ?? '').matchAll(MD_IMAGE)].flatMap((m) => {
        const image = articleFiles[`/${dir}/${decodeURI(m[2])}`];
        return image ? [{ image, caption: m[3] || undefined }] : [];
      });
      // the featured photo is usually also in the text: list it once, first
      const featuredFile = p.filePath ? readFileSync(p.filePath, 'utf8').match(/^image:\s*["']?\.\/([^"'\n]+?)["']?\s*$/m)?.[1] : undefined;
      const featured = featuredFile ? articleFiles[`/${dir}/${featuredFile}`] : undefined;
      const seen = new Set<ImageMetadata>();
      return [...(featured ? [{ image: featured, caption: p.data.imageCaption }] : []), ...fromText].filter(
        (x) => !seen.has(x.image) && !!seen.add(x.image),
      );
    });
}

export async function getAlbums(_lang?: Lang): Promise<Album[]> {
  const entries = await getCollection('albums', (a) => !a.data.draft);
  const linked = new Map(await Promise.all(entries.map(async (e) => {
    const folder = e.filePath ? e.filePath.split('/').at(-2)! : e.id;
    return [folder, await linkedArticlePhotos(folder)] as const;
  })));
  return entries
    .map((e) => {
      const folder = e.filePath ? e.filePath.split('/').at(-2)! : e.id;
      const listed: Photo[] = [
        ...e.data.photos.map((p) => ({
          image: p.image,
          caption: p.caption,
          featured: p.featured,
        })),
        ...e.data.images.map((image) => ({ image })),
        ...(linked.get(folder) ?? []),
      ];
      // the same file listed twice (e.g. in both lists) is shown once
      // compare the image objects themselves: reading `.src` would make Astro copy every original file into the build
      const seen = new Set<ImageMetadata>();
      const unique = listed.filter((p) => !seen.has(p.image) && seen.add(p.image));
      const photos = unique.length ? unique : folderImages(folder).map((f) => ({ image: f.image }));
      return {
        id: e.id,
        title: e.data.title,
        description: e.data.description,
        date: e.data.date,
        season: e.data.season,
        category: e.data.category,
        cover: e.data.cover ?? photos[0]?.image,
        photos,
      };
    })
    .filter((a) => a.photos.length > 0)
    .sort((a, b) => b.date.valueOf() - a.date.valueOf());
}

export interface SlidePhoto extends Photo { album: Album }

/**
 * Photos for the homepage slideshow, taken from the gallery itself (no copies):
 *  1. photos marked "Istakni na naslovnici" in the CMS, newest albums first;
 *  2. filled up automatically from the newest albums – landscape photos at least 1000 px wide
 *     (sharp on large screens), at most `perAlbum` from one album so several events are shown.
 * New albums therefore appear on the homepage with the next build (the site rebuilds daily).
 */
export async function homepagePhotos(count = 10, perAlbum = 2): Promise<SlidePhoto[]> {
  const albums = await getAlbums();
  const good = (p: Photo) => p.image.width >= 1000 && p.image.width >= p.image.height * 1.25;
  const picked: SlidePhoto[] = [];
  const seen = new Set<ImageMetadata>();
  const take = (p: Photo, album: Album) => {
    if (picked.length >= count || seen.has(p.image)) return;
    seen.add(p.image);
    picked.push({ ...p, album });
  };
  for (const a of albums) for (const p of a.photos) if (p.featured) take(p, a);
  for (const a of albums) {
    let n = picked.filter((x) => x.album.id === a.id).length;
    for (const p of a.photos) {
      if (n >= perAlbum || picked.length >= count) break;
      if (good(p) && !seen.has(p.image)) { take(p, a); n++; }
    }
  }
  return picked;
}
