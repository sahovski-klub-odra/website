/** Upcoming trainings: several groups on the same day share one card. Run with: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderUpcoming } from '../src/lib/schedule-render';
import { scheduleStrings } from '../src/lib/schedule-strings';
import { trainingFileSchema } from '../src/lib/schemas';

const data = trainingFileSchema.parse({
  sessions: [
    { id: 'm', day: 'tuesday', startTime: '19:00', endTime: '20:00', group: 'Mlađa skupina', status: 'scheduled' },
    { id: 's', day: 'tuesday', startTime: '20:00', endTime: '21:00', group: 'Starija skupina', status: 'scheduled' },
    { id: 'f', day: 'friday', startTime: '19:00', group: 'Mlađa skupina', status: 'scheduled' },
  ],
  exceptions: [], extra: [], announcements: [],
});

test('two groups on the same day are one card, other days stay single', () => {
  const html = renderUpcoming(data as any, scheduleStrings('hr'), 6, { date: '2026-11-23', time: '10:00' });
  const cards = html.match(/<li class="sched-item/g) ?? [];
  const multi = html.match(/sched-item--multi/g) ?? [];
  assert.ok(cards.length >= 3);
  assert.ok(multi.length >= 1);
  // the Tuesday card lists both groups with their own times
  const tue = html.split('<li ').find((c) => c.includes('sched-item--multi'))!;
  for (const s of ['Mlađa skupina', 'Starija skupina', '19:00', '20:00', '2 treninga']) assert.ok(tue.includes(s), s);
  // no date is split across cards
  assert.equal((html.match(/>24</g) ?? []).length, 1);
});

import { expand, lastCalendarMonth, nextTraining } from '../src/lib/schedule';
import { renderMonth, renderNext } from '../src/lib/schedule-render';

const withOff = trainingFileSchema.parse({
  sessions: [
    { id: 'm', day: 'friday', startTime: '19:00', group: 'Mlađa skupina' },
    { id: 's', day: 'friday', startTime: '20:00', group: 'Starija skupina' },
  ],
  cancelledDays: [{ date: '2026-11-27' }],
});

test('a day without training cancels every regular training that day', () => {
  const occ = expand(withOff, '2026-11-27', '2026-12-04');
  assert.deepEqual(occ.filter((o) => o.date === '2026-11-27').map((o) => o.status), ['cancelled', 'cancelled']);
  assert.ok(occ.filter((o) => o.date === '2026-12-04').every((o) => o.status === 'scheduled'));
  const now = { date: '2026-11-26', time: '14:00' };
  const { next, nextHeld } = nextTraining(withOff, now);
  assert.equal(next?.status, 'cancelled');
  assert.equal(nextHeld?.date, '2026-12-04');
  assert.match(renderNext(withOff, scheduleStrings('hr'), now), /Trening se ne održava/);
  assert.match(renderMonth(withOff, scheduleStrings('hr'), 2026, 11, now), /cal-day--off/);
});

test('the calendar goes at most calendarMonthsAhead months forward (default 2)', () => {
  assert.equal(withOff.calendarMonthsAhead, 2);
  assert.deepEqual(lastCalendarMonth('2026-11-26', 2), { year: 2027, month: 1 });
  const s = scheduleStrings('hr'), now = { date: '2026-11-26', time: '14:00' };
  const nextBtn = (html: string) => html.match(/<button[^>]*data-cal-nav="1"[^>]*>/)![0];
  assert.doesNotMatch(nextBtn(renderMonth(withOff, s, 2026, 12, now)), /"\s+disabled\s*>/);
  assert.match(nextBtn(renderMonth(withOff, s, 2027, 1, now)), /"\s+disabled\s*>/);
});
