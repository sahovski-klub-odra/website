/**
 * Training schedule engine – no dependencies, runs both at build time and in the browser.
 *
 *  sessions   – recurring weekly trainings (e.g. every Tuesday 17:00–19:00)
 *  exceptions – changes to ONE date of a recurring training (cancel / move / announce)
 *  extra      – one-off trainings on a specific date
 *
 * All dates are plain 'YYYY-MM-DD' strings interpreted in Europe/Zagreb time.
 */
import type { Status, TrainingData } from './schemas';

export const TZ = 'Europe/Zagreb';
const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

export interface Occurrence {
  key: string;
  date: string;
  startTime: string;
  endTime?: string;
  group: string;
  groupEn?: string;
  coach: string;
  location?: string;
  status: Status;
  note?: string;
  noteEn?: string;
  sessionId?: string;
  /** set on the ORIGINAL slot of a moved training */
  newDate?: string;
  newStartTime?: string;
  newEndTime?: string;
  /** set on the NEW slot of a moved training */
  movedFrom?: string;
  /** original slot that has a replacement elsewhere – hidden from "next training" */
  superseded?: boolean;
}

/* ---------- date helpers (UTC-based arithmetic on calendar dates) ---------- */
export function parseDate(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(d: string, n: number): string {
  const x = parseDate(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fmtDate(x);
}
export function weekday(d: string): number {
  return parseDate(d).getUTCDay();
}

/** Current date and time in Zagreb, regardless of the visitor's or build server's timezone. */
export function zagrebNow(now: Date = new Date()): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/* ---------- expansion ---------- */
export function expand(data: TrainingData, from: string, to: string): Occurrence[] {
  const out: Occurrence[] = [];
  const exceptions = new Map(data.exceptions.map((e) => [`${e.date}|${e.sessionId}`, e]));

  // Moved trainings may land inside the window even if the original date is outside it,
  // so scan a wider range for originals and filter at the end.
  const scanFrom = addDays(from, -60);
  const scanTo = addDays(to, 60);

  for (let d = scanFrom; d <= scanTo; d = addDays(d, 1)) {
    const wd = weekday(d);
    for (const s of data.sessions) {
      if (WEEKDAY_INDEX[s.day] !== wd) continue;
      if (s.validFrom && d < s.validFrom) continue;
      if (s.validUntil && d > s.validUntil) continue;

      const base: Occurrence = {
        key: `${s.id}-${d}`,
        date: d,
        startTime: s.startTime,
        endTime: s.endTime,
        group: s.group,
        groupEn: s.groupEn,
        coach: s.coach,
        location: s.location,
        status: s.status,
        note: s.note,
        noteEn: s.noteEn,
        sessionId: s.id,
      };

      const ex = exceptions.get(`${d}|${s.id}`);
      if (!ex) {
        out.push(base);
        continue;
      }

      const occ: Occurrence = {
        ...base,
        status: ex.status,
        coach: ex.coach ?? base.coach,
        note: ex.note ?? base.note,
        noteEn: ex.noteEn ?? base.noteEn,
      };

      if (ex.status === 'rescheduled' && (ex.newDate || ex.newStartTime)) {
        const newDate = ex.newDate ?? d;
        const newStart = ex.newStartTime ?? s.startTime;
        const newEnd = ex.newEndTime ?? s.endTime;
        occ.newDate = newDate;
        occ.newStartTime = newStart;
        occ.newEndTime = newEnd;
        occ.superseded = true;
        out.push(occ);
        out.push({
          ...base,
          key: `${s.id}-${d}-moved`,
          date: newDate,
          startTime: newStart,
          endTime: newEnd,
          status: 'rescheduled',
          coach: ex.coach ?? base.coach,
          note: ex.note ?? base.note,
          noteEn: ex.noteEn ?? base.noteEn,
          movedFrom: d,
        });
      } else {
        out.push(occ);
      }
    }
  }

  data.extra.forEach((x, i) => {
    out.push({
      key: x.id ?? `extra-${i}-${x.date}`,
      date: x.date,
      startTime: x.startTime,
      endTime: x.endTime,
      group: x.group,
      groupEn: x.groupEn,
      coach: x.coach,
      location: x.location,
      status: x.status,
      note: x.note,
      noteEn: x.noteEn,
    });
  });

  return out
    .filter((o) => o.date >= from && o.date <= to)
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
}

/** Upcoming occurrences starting from "now" (a training in progress still counts as upcoming). */
export function upcoming(data: TrainingData, limit = 8, days = 60, now = zagrebNow()): Occurrence[] {
  return expand(data, now.date, addDays(now.date, days))
    .filter((o) => o.date > now.date || (o.endTime ?? addHours(o.startTime, 2)) > now.time)
    .slice(0, limit);
}

/** The next training for the homepage widget, plus the next one actually held if that one is cancelled. */
export function nextTraining(data: TrainingData, now = zagrebNow()) {
  const list = upcoming(data, 50, 90, now).filter((o) => !o.superseded);
  const next = list[0] ?? null;
  const nextHeld = next && next.status === 'cancelled' ? (list.find((o) => o.status !== 'cancelled') ?? null) : null;
  return { next, nextHeld };
}

/* ---------- formatting ---------- */
export function formatLongDate(d: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(parseDate(d));
}
export function formatShortDate(d: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(
    parseDate(d),
  );
}

export const STATUS_STYLES: Record<Status, string> = {
  scheduled: 'bg-chess-green/15 text-chess-green-deep ring-chess-green/40',
  cancelled: 'bg-red-600/10 text-red-700 ring-red-600/30',
  rescheduled: 'bg-amber-500/15 text-amber-800 ring-amber-500/40',
  pending: 'bg-sky-600/10 text-sky-800 ring-sky-600/30',
};
export const STATUS_DOT: Record<Status, string> = {
  scheduled: 'bg-chess-green',
  cancelled: 'bg-red-600',
  rescheduled: 'bg-amber-500',
  pending: 'bg-sky-600',
};

/** "19:00" + 2 h → "21:00" (used when a session has no announced end time) */
export function addHours(time: string, h: number): string {
  const [hh, mm] = time.split(':').map(Number);
  return `${String(Math.min(23, hh + h)).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
/** "19:00 – 21:00", or just "od 19:00" / "from 19:00" when no end time was announced */
export function timeRange(start: string, end: string | undefined, locale: string): string {
  if (end) return `${start} – ${end}`;
  return locale.startsWith('hr') ? `od ${start}` : `from ${start}`;
}
