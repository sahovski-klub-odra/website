import { z } from 'astro/zod';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Vrijeme mora biti u obliku HH:MM, npr. 17:30');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum mora biti u obliku GGGG-MM-DD, npr. 2026-12-01');
// The CMS writes an empty optional field as '' or null – both mean "not set".
const optionalIsoDate = z.union([isoDate, z.literal('')]).nullish().transform((v) => v || undefined);
const optionalTime = z.union([time, z.literal('')]).nullish().transform((v) => v || undefined);
const optionalString = z.string().nullish().transform((v) => v || undefined);
/** a text field that may be left empty (stored as '' or null) → always a string */
const text = () => z.string().nullish().transform((v) => v ?? '');

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export const STATUSES = ['scheduled', 'cancelled', 'rescheduled', 'pending'] as const;
export type Status = (typeof STATUSES)[number];

/* ---------------- Site ---------------- */
export const siteSchema = z.object({
  name: z.string(),
  shortName: z.string(),
  logoLine1: z.string(),
  logoLine2: z.string(),
  about: z.string(),
  /** homepage intro under the big title; falls back to the built-in tagline */
  tagline: optionalString,
  address: z.object({
    street: text(),
    postalCode: text(),
    locality: text(),
    city: text(),
    country: text(),
  }),
  email: text(),
  phone: text(),
  /** venue name shown above the street address, e.g. "Društveni dom Mala Mlaka" */
  venue: text(),
  /** company/association ID (OIB) */
  oib: text(),
  /** people to contact directly (shown on the contact page) */
  contacts: z
    .array(z.object({ name: z.string().min(1), role: text(), phone: text(), email: text() }))
    .default([]),
  map: z.object({ lat: z.number().nullable(), lon: z.number().nullable(), zoom: z.number().nullish().transform((v) => v ?? 16) }),
  social: z.record(z.string(), z.string().nullish().transform((v) => v ?? '')).default({}),
  contactForm: z.object({
    provider: z.enum(['none', 'formspree', 'web3forms', 'custom']).default('none'),
    endpoint: text(),
    accessKey: optionalString,
  }),
  repository: text(),
  wordpressUrl: text(),
});

/* ---------------- Members ---------------- */
export const memberSchema = z.object({
  name: z.string().min(1),
  role: text(),
  title: z
    .enum(['', 'GM', 'IM', 'FM', 'CM', 'WGM', 'WIM', 'WFM', 'WCM', 'NM', 'MK', 'KM'])
    .default('')
    .describe('Šahovska titula'),
  /** national category used by the Croatian Chess Federation: MK (majstorski kandidat), I–V, vk (bez kategorije) */
  category: text(),
  /** standard FIDE rating */
  rating: z.number().int().min(0).max(3500).nullable().default(null),
  ratingRapid: z.number().int().min(0).max(3500).nullable().optional(),
  ratingBlitz: z.number().int().min(0).max(3500).nullable().optional(),
  birthYear: z.number().int().min(1900).max(2100).nullable().optional(),
  /** membership number in the club/federation register ("MB") */
  registrationNumber: z.union([z.string(), z.number()]).optional().transform((v) => (v ? String(v) : undefined)),
  fideId: z.union([z.string(), z.number()]).optional().transform((v) => (v ? String(v) : undefined)),
  image: optionalString,
  bio: optionalString,
  order: z.number().default(100),
  active: z.boolean().default(true),
});
export const membersFileSchema = z.object({
  updated: optionalIsoDate,
  source: optionalString,
  members: z.array(memberSchema).default([]),
});
export type Member = z.infer<typeof memberSchema>;

/* ---------------- Videos ---------------- */
export const videoSchema = z.object({
  title: z.string().min(1),
  description: optionalString,
  youtube: z.string().min(1).describe('YouTube URL ili ID'),
  date: optionalIsoDate,
  thumbnail: optionalString,
});
export const videosFileSchema = z.object({ videos: z.array(videoSchema).default([]) });
export type Video = z.infer<typeof videoSchema>;

/* ---------------- Training ---------------- */
export const sessionSchema = z
  .object({
    id: z.string().min(1),
    day: z.enum(WEEKDAYS),
    startTime: time,
    /** optional – the club often announces only the start ("od 19 sati") */
    endTime: optionalTime,
    group: z.string().min(1),
    coach: text(),
    location: optionalString,
    status: z.enum(STATUSES).default('scheduled'),
    note: optionalString,
    validFrom: optionalIsoDate,
    validUntil: optionalIsoDate,
  })
  .refine((s) => !s.endTime || s.startTime < s.endTime, { message: 'endTime mora biti nakon startTime' });

export const exceptionSchema = z.object({
  date: isoDate,
  sessionId: z.string().min(1),
  status: z.enum(STATUSES),
  newDate: optionalIsoDate,
  newStartTime: optionalTime,
  newEndTime: optionalTime,
  coach: optionalString,
  note: optionalString,
});

export const extraSchema = z.object({
  id: optionalString,
  date: isoDate,
  startTime: time,
  endTime: optionalTime,
  group: z.string().min(1),
  coach: text(),
  location: optionalString,
  status: z.enum(STATUSES).default('scheduled'),
  note: optionalString,
});

/** Short notices shown above the schedule and on the homepage, e.g. "Nema treninga za vrijeme školskih praznika". */
export const announcementSchema = z.object({
  text: z.string().min(1),
  /** first and last day it is shown (inclusive); empty = from now / until removed */
  from: optionalIsoDate,
  until: optionalIsoDate,
  important: z.boolean().default(false),
});

export const trainingFileSchema = z
  .object({
    announcements: z.array(announcementSchema).default([]),
    sessions: z.array(sessionSchema).default([]),
    exceptions: z.array(exceptionSchema).default([]),
    extra: z.array(extraSchema).default([]),
  })
  .superRefine((t, ctx) => {
    const ids = new Set<string>();
    for (const s of t.sessions) {
      if (ids.has(s.id)) ctx.addIssue({ code: 'custom', message: `Dupli id treninga: ${s.id}` });
      ids.add(s.id);
    }
    for (const e of t.exceptions) {
      if (!ids.has(e.sessionId))
        ctx.addIssue({ code: 'custom', message: `Iznimka ${e.date} odnosi se na nepostojeći trening "${e.sessionId}"` });
    }
  });

export type TrainingData = z.infer<typeof trainingFileSchema>;
export type Session = TrainingData['sessions'][number];
export type TrainingException = TrainingData['exceptions'][number];
export type ExtraSession = TrainingData['extra'][number];
export type Announcement = TrainingData['announcements'][number];
