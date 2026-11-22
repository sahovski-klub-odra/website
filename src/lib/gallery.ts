import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';
import type { Lang } from '../i18n/ui';

export type AlbumEntry = CollectionEntry<'albums'>;
export interface Photo { image: ImageMetadata; caption?: string }
export interface Album {
  id: string;
  title: string;
  description?: string;
  date: Date;
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

export async function getAlbums(lang: Lang): Promise<Album[]> {
  const entries = await getCollection('albums', (a) => !a.data.draft);
  return entries
    .map((e) => {
      const folder = e.filePath ? e.filePath.split('/').at(-2)! : e.id;
      const listed: Photo[] = [
        ...e.data.photos.map((p) => ({
          image: p.image,
          caption: lang === 'en' ? (p.captionEn ?? p.caption) : p.caption,
        })),
        ...e.data.images.map((image) => ({ image })),
      ];
      // the same file listed twice (e.g. in both lists) is shown once
      // compare the image objects themselves: reading `.src` would make Astro copy every original file into the build
      const seen = new Set<ImageMetadata>();
      const unique = listed.filter((p) => !seen.has(p.image) && seen.add(p.image));
      const photos = unique.length ? unique : folderImages(folder).map((f) => ({ image: f.image }));
      return {
        id: e.id,
        title: lang === 'en' ? (e.data.titleEn ?? e.data.title) : e.data.title,
        description: lang === 'en' ? (e.data.descriptionEn ?? e.data.description) : e.data.description,
        date: e.data.date,
        category: e.data.category,
        cover: e.data.cover ?? photos[0]?.image,
        photos,
      };
    })
    .filter((a) => a.photos.length > 0)
    .sort((a, b) => b.date.valueOf() - a.date.valueOf());
}
