/**
 * Loads and validates every editable JSON file at build time.
 * If an administrator or coach makes a typo, the build fails with a readable
 * message and the previously deployed version of the site stays online.
 */
import { z } from 'astro/zod';
import siteRaw from '../data/site.json';
import membersRaw from '../data/members.json';
import trainingRaw from '../data/training.json';
import videosRaw from '../data/videos.json';
import redirectsRaw from '../data/redirects.json';
import { membersFileSchema, siteSchema, trainingFileSchema, videosFileSchema } from './schemas';

function parse<T extends z.ZodType>(schema: T, data: unknown, file: string): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`\n\nGreška u datoteci src/data/${file}:\n${issues}\n`);
  }
  return result.data;
}

export const site = parse(siteSchema, siteRaw, 'site.json');
const membersFile = parse(membersFileSchema, membersRaw, 'members.json');
export const membersUpdated = membersFile.updated;
// order on the page = order in members.json (editors drag items in the CMS list)
export const members = membersFile.members.filter((m) => m.active);
export const training = parse(trainingFileSchema, trainingRaw, 'training.json');
export const videos = parse(videosFileSchema, videosRaw, 'videos.json').videos.sort((a, b) =>
  (b.date ?? '').localeCompare(a.date ?? ''),
);
export const wpRedirects = redirectsRaw as { paths: Record<string, string>; ids: Record<string, string> };

/** One-line address for Google Maps searches and directions, e.g. "Malomlačka ul. 91, 10020 Mala Mlaka, Hrvatska" */
export function addressQuery(): string {
  const a = site.address;
  return [a.street, [a.postalCode, a.locality || a.city].filter(Boolean).join(' '), a.country].filter(Boolean).join(', ');
}
/** Official Google Maps URLs (https://developers.google.com/maps/documentation/urls) – no API key. */
export const googleMapsLink = () => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery())}`;
export const googleDirectionsLink = () => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressQuery())}`;
/** Embedded map: the iframe from Google Maps "Share → Embed a map"; without it, the address search (also keyless). */
export const googleEmbedUrl = () =>
  site.map.googleEmbed || `https://www.google.com/maps?q=${encodeURIComponent(addressQuery())}&output=embed&hl=hr`;
export const hasMap = !!(site.map.googleEmbed || site.address.street);

export function formatAddress(): string[] {
  const a = site.address;
  const line2 = [a.postalCode, a.city].filter(Boolean).join(' ');
  return [a.street, a.locality && a.locality !== a.city ? a.locality : '', line2].filter(Boolean);
}

export function youtubeId(input: string): string | null {
  if (/^[\w-]{11}$/.test(input)) return input;
  try {
    const u = new URL(input);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1, 12) || null;
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{11})/);
    return m ? m[2] : null;
  } catch {
    return null;
  }
}
