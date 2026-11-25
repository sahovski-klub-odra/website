/**
 * HTML renderers for schedule widgets. The same functions run at build time
 * (so the page works without JavaScript) and in the browser (so "next training"
 * is always correct for today, even between deployments).
 */
import type { Status, TrainingData } from './schemas';
import {
  timeRange,
  STATUS_DOT, STATUS_STYLES, addDays, expand, formatLongDate, formatShortDate, nextTraining, parseDate, upcoming,
  zagrebNow, type Occurrence,
} from './schedule';

export interface ScheduleStrings {
  lang: 'hr';
  locale: string;
  status: Record<Status, string>;
  none: string;
  empty: string;
  group: string;
  coach: string;
  time: string;
  newTerm: string;
  movedFrom: string;
  prevMonth: string;
  nextMonth: string;
  nextHeld: string;
  weekdaysShort: string[]; // Monday first
}

const esc = (s = '') =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const DARK_BADGE: Record<Status, string> = {
  scheduled: 'bg-chess-green text-ink ring-chess-green',
  cancelled: 'bg-red-500 text-white ring-red-500',
  rescheduled: 'bg-amber-400 text-ink ring-amber-400',
  pending: 'bg-sky-400 text-ink ring-sky-400',
};
/** Capitalise only the first letter – Croatian month names stay lower case ("utorak, 24. studenoga" → "Utorak, 24. studenoga"). */
const ucFirst = (x: string) => x.charAt(0).toLocaleUpperCase() + x.slice(1);

const badge = (status: Status, s: ScheduleStrings, dark = false) =>
  `<span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wider ring-1 ring-inset ${dark ? DARK_BADGE[status] : STATUS_STYLES[status]}">${dark ? '' : `<span class="status-dot status-dot--${status} h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}"></span>`}${esc(s.status[status])}</span>`;

const groupName = (o: Occurrence, _s: ScheduleStrings) => o.group;
const noteOf = (o: Occurrence, _s: ScheduleStrings) => o.note;

function changeLine(o: Occurrence, s: ScheduleStrings) {
  if (o.newDate)
    return `<p class="mt-1 text-sm font-medium text-amber-800">${esc(s.newTerm)}: ${esc(formatShortDate(o.newDate, s.locale))}, ${esc(timeRange(o.newStartTime ?? o.startTime, o.newEndTime, s.locale))}</p>`;
  if (o.movedFrom)
    return `<p class="mt-1 text-sm text-ink/60">${esc(s.movedFrom)} ${esc(formatShortDate(o.movedFrom, s.locale))}</p>`;
  return '';
}

/* ---------- "Next training" widget (dark card) ---------- */
export function renderNext(data: TrainingData, s: ScheduleStrings, now = zagrebNow()): string {
  const { next, nextHeld } = nextTraining(data, now);
  if (!next) return `<p class="text-white/70">${esc(data.sessions.length || data.extra.length ? s.none : s.empty)}</p>`;
  const note = noteOf(next, s);
  return `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="font-display text-2xl font-bold text-white">${esc(ucFirst(formatLongDate(next.date, s.locale)))}</p>
      ${badge(next.status, s, true)}
    </div>
    <dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[0.95rem]">
      <dt class="text-white/55">${esc(s.time)}</dt><dd class="font-semibold text-white ${next.status === 'cancelled' ? 'line-through decoration-red-400' : ''}">${esc(timeRange(next.startTime, next.endTime, s.locale))}</dd>
      <dt class="text-white/55">${esc(s.group)}</dt><dd class="text-white">${esc(groupName(next, s))}</dd>
      ${next.coach ? `<dt class="text-white/55">${esc(s.coach)}</dt><dd class="text-white">${esc(next.coach)}</dd>` : ''}
    </dl>
    ${next.newDate ? `<p class="mt-3 text-sm font-medium text-gold">${esc(s.newTerm)}: ${esc(formatShortDate(next.newDate, s.locale))}, ${esc(timeRange(next.newStartTime ?? next.startTime, next.newEndTime, s.locale))}</p>` : ''}
    ${note ? `<p class="mt-3 text-sm text-white/70">${esc(note)}</p>` : ''}
    ${nextHeld ? `<p class="mt-4 border-t border-white/10 pt-3 text-sm text-white/75">${esc(s.nextHeld)}: <strong class="text-white">${esc(formatShortDate(nextHeld.date, s.locale))}, ${nextHeld.startTime}</strong> · ${esc(groupName(nextHeld, s))}</p>` : ''}
  `;
}

/* ---------- Upcoming list ---------- */
/** sessions on the same calendar day share one card (date shown once, one row per group) */
function groupByDay(list: Occurrence[]): Occurrence[][] {
  const days: Occurrence[][] = [];
  for (const o of list) {
    const last = days.at(-1);
    if (last && last[0].date === o.date) last.push(o);
    else days.push([o]);
  }
  return days;
}

const sessionsLabel = (n: number) => `${n} treninga`; // 2, 3, 4… treninga

export function renderUpcoming(data: TrainingData, s: ScheduleStrings, limit = 8, now = zagrebNow()): string {
  // take whole days: a day is never cut in half by the limit
  const all = upcoming(data, limit + 12, 60, now);
  const days: Occurrence[][] = [];
  let count = 0;
  for (const day of groupByDay(all)) {
    if (count >= limit) break;
    days.push(day);
    count += day.length;
  }
  if (!days.length)
    return `<p class="rounded-xl bg-white p-6 text-ink/70 shadow-card">${esc(data.sessions.length || data.extra.length ? s.none : s.empty)}</p>`;

  const session = (o: Occurrence, multi: boolean) => {
    const note = noteOf(o, s);
    return `<div class="${multi ? 'sched-session' : ''} flex gap-3 sm:items-center">
        <div class="min-w-0 flex-1">
          <div class="mb-1.5 sm:hidden">${badge(o.status, s)}</div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p class="font-semibold text-ink ${o.status === 'cancelled' ? 'line-through decoration-red-500/70' : ''}">${esc(timeRange(o.startTime, o.endTime, s.locale))}</p>
            <p class="text-ink/80">${esc(groupName(o, s))}</p>
          </div>
          ${o.coach ? `<p class="mt-0.5 text-sm text-ink/60">${esc(s.coach)}: ${esc(o.coach)}</p>` : ''}
          ${changeLine(o, s)}
          ${note ? `<p class="mt-1 text-sm text-ink/60">${esc(note)}</p>` : ''}
        </div>
        <div class="hidden shrink-0 sm:block">${badge(o.status, s)}</div>
      </div>`;
  };

  return `<ol class="divide-y divide-ink/10 overflow-hidden rounded-xl bg-white shadow-card ring-1 ring-ink/5">${days
    .map((day, i) => {
      const o = day[0];
      const d = parseDate(o.date);
      const multi = day.length > 1;
      // the card's status colour: shared status, otherwise "scheduled"
      const status = day.every((x) => x.status === o.status) ? o.status : 'scheduled';
      return `<li class="sched-item sched-item--${status}${multi ? ' sched-item--multi' : ''} flex gap-4 p-4 sm:items-center sm:p-5" style="--i:${i}">
        <div class="w-14 shrink-0 self-start rounded-lg bg-ink py-2 text-center text-white sm:self-center">
          <div class="text-[0.65rem] font-semibold uppercase tracking-wider text-gold">${esc(new Intl.DateTimeFormat(s.locale, { weekday: 'short', timeZone: 'UTC' }).format(d))}</div>
          <div class="font-display text-2xl font-bold leading-none">${d.getUTCDate()}</div>
          <div class="text-[0.65rem] uppercase text-white/60">${esc(new Intl.DateTimeFormat(s.locale, { month: 'short', timeZone: 'UTC' }).format(d))}</div>
        </div>
        <div class="min-w-0 flex-1">
          ${multi ? `<p class="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">${esc(ucFirst(new Intl.DateTimeFormat(s.locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d)))}<span class="rounded-full bg-gold/15 px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-gold-deep ring-1 ring-inset ring-gold/40">${esc(sessionsLabel(day.length))}</span></p>` : ''}
          <div class="${multi ? 'grid gap-2.5' : ''}">${day.map((x) => session(x, multi)).join('')}</div>
        </div>
      </li>`;
    })
    .join('')}</ol>`;
}

/* ---------- Monthly calendar ---------- */
export function renderMonth(data: TrainingData, s: ScheduleStrings, year: number, month: number, now = zagrebNow()): string {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
  const occ = expand(data, first, last);
  const byDay = new Map<string, Occurrence[]>();
  occ.forEach((o) => byDay.set(o.date, [...(byDay.get(o.date) ?? []), o]));

  const lead = (parseDate(first).getUTCDay() + 6) % 7; // Monday-first offset
  const title = new Intl.DateTimeFormat(s.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parseDate(first));

  let cells = '';
  for (let i = 0; i < lead; i++) cells += `<div class="hidden min-h-24 bg-cream/60 sm:block" aria-hidden="true"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = addDays(first, day - 1);
    const items = byDay.get(d) ?? [];
    const isToday = d === now.date;
    const isPast = d < now.date;
    cells += `<div class="min-h-24 bg-white p-2 ${items.length ? '' : 'max-sm:hidden'} ${isPast ? 'opacity-60' : ''}">
      <div class="mb-1 flex items-center justify-between">
        <span class="sm:hidden text-xs font-medium capitalize text-ink/60">${esc(new Intl.DateTimeFormat(s.locale, { weekday: 'long', timeZone: 'UTC' }).format(parseDate(d)))}</span>
        <span class="grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${isToday ? 'bg-gold text-ink' : 'text-ink/80'}">${day}</span>
      </div>
      <ul class="space-y-1">${items
        .map(
          (o) => `<li class="cal-item cal-item--${o.status} rounded-md border-l-[3px] ${borderFor(o.status)} bg-cream/70 px-1.5 py-1 text-[0.72rem] leading-tight">
            <span class="font-semibold ${o.status === 'cancelled' ? 'line-through' : ''}">${o.startTime}</span>
            <span class="block truncate text-ink/75" title="${esc(groupName(o, s))}">${esc(groupName(o, s))}</span>
            <span class="sr-only">${esc(s.status[o.status])}</span>
          </li>`,
        )
        .join('')}</ul>
    </div>`;
  }
  const trailing = (7 - ((lead + daysInMonth) % 7)) % 7;
  for (let i = 0; i < trailing; i++) cells += `<div class="hidden min-h-24 bg-cream/60 sm:block" aria-hidden="true"></div>`;

  return `
    <div class="mb-4 flex items-center justify-between gap-3">
      <button type="button" data-cal-nav="-1" class="rounded-md border border-ink/15 bg-white p-2 hover:border-gold" aria-label="${esc(s.prevMonth)}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <h3 class="cal-title font-display text-2xl font-bold" aria-live="polite">${esc(ucFirst(title))}</h3>
      <button type="button" data-cal-nav="1" class="rounded-md border border-ink/15 bg-white p-2 hover:border-gold" aria-label="${esc(s.nextMonth)}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
    <div class="overflow-hidden rounded-xl shadow-card ring-1 ring-ink/10">
      <div class="hidden grid-cols-7 bg-ink text-center text-xs font-semibold uppercase tracking-wider text-gold sm:grid">
        ${s.weekdaysShort.map((w) => `<div class="py-2.5">${esc(w)}</div>`).join('')}
      </div>
      <div class="cal-grid grid gap-px bg-ink/10 sm:grid-cols-7">${cells}</div>
    </div>
    ${occ.length === 0 ? `<p class="mt-4 text-center text-ink/60">${esc(s.none)}</p>` : ''}
    <ul class="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink/70">
      ${(Object.keys(s.status) as Status[]).map((st) => `<li class="flex items-center gap-2"><span class="h-3 w-1 rounded ${STATUS_DOT[st]}"></span>${esc(s.status[st])}</li>`).join('')}
    </ul>`;
}

function borderFor(st: Status) {
  return { scheduled: 'border-chess-green', cancelled: 'border-red-600', rescheduled: 'border-amber-500', pending: 'border-sky-600' }[st];
}
