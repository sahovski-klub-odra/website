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
