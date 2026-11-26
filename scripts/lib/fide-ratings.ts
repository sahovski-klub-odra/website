/**
 * Monthly FIDE rating update for src/data/members.json.
 *
 * Source: the official FIDE combined rating list (standard, rapid, blitz), published on the 1st of every month:
 *   XML  https://ratings.fide.com/download/players_list_xml.zip  – <player><fideid>…</fideid><rating>…</rating>
 *        <rapid_rating>…</rapid_rating><blitz_rating>…</blitz_rating>…</player>  (used by the workflow)
 *   TXT  https://ratings.fide.com/download/players_list.zip      – fixed-width columns
 *        ID Number | Name | Fed | … | SRtng | SGm | SK | RRtng | RGm | Rk | BRtng | BGm | BK | B-day | Flag
 * Both are read as a stream and only our players are kept (the full list has ~1.5 million players).
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export interface FideRatings { standard: number | null; rapid: number | null; blitz: number | null }

/** Column [start, end) of each header field, from the positions of the header labels. */
export function headerColumns(header: string): Record<string, [number, number]> {
  const labels = ['ID Number', 'Name', 'Fed', 'SRtng', 'SGm', 'RRtng', 'RGm', 'BRtng', 'BGm'];
  const starts = labels
    .map((l) => [l, header.indexOf(l)] as const)
    .filter(([, i]) => i >= 0)
    .sort((a, b) => a[1] - b[1]);
  const cols: Record<string, [number, number]> = {};
  starts.forEach(([l, i], k) => (cols[l] = [i, k + 1 < starts.length ? starts[k + 1][1] : header.length + 10]));
  for (const need of ['ID Number', 'SRtng', 'RRtng', 'BRtng'])
    if (!cols[need]) throw new Error(`FIDE list header has no "${need}" column: ${header.slice(0, 160)}`);
  return cols;
}

const num = (s: string) => {
  const v = Number(s.trim());
  return Number.isInteger(v) && v > 0 ? v : null;
};

export function parseLine(line: string, cols: Record<string, [number, number]>): { id: string; r: FideRatings } | null {
  const id = line.slice(...cols['ID Number']).trim();
  if (!/^\d{3,10}$/.test(id)) return null;
  // a rating value starts at its label and may run into the next (narrow) column, so read up to the games column
  const field = (label: string, games: string) => line.slice(cols[label][0], cols[games]?.[0] ?? cols[label][1]);
  return { id, r: { standard: num(field('SRtng', 'SGm')), rapid: num(field('RRtng', 'RGm')), blitz: num(field('BRtng', 'BGm')) } };
}

/** XML list: collects the fields of one <player> element at a time (tags may share a line or not). */
export function xmlReader(wanted: Set<string>, out: Map<string, FideRatings>) {
  let cur: Record<string, string> = {};
  return (chunk: string) => {
    for (const m of chunk.matchAll(/<(\/?)(player|fideid|rating|rapid_rating|blitz_rating)\b[^>]*>([^<]*)/g)) {
      const [, close, tag, value] = m;
      if (tag === 'player') {
        if (!close) cur = {};
        else if (cur.fideid && wanted.has(cur.fideid))
          out.set(cur.fideid, { standard: num(cur.rating ?? ''), rapid: num(cur.rapid_rating ?? ''), blitz: num(cur.blitz_rating ?? '') });
      } else if (!close) cur[tag] = value.trim();
    }
  };
}

/** Reads the list (XML or TXT) and returns ratings for the wanted FIDE IDs only. */
export async function readRatings(file: string, wanted: Set<string>): Promise<Map<string, FideRatings>> {
  const out = new Map<string, FideRatings>();
  let cols: Record<string, [number, number]> | null = null;
  let xml: ((s: string) => void) | null = null;
  let lines = 0;
  const rl = createInterface({ input: createReadStream(file, { encoding: 'latin1' }), crlfDelay: Infinity });
  for await (const line of rl) {
    lines++;
    if (!cols && !xml && line.trimStart().startsWith('<')) xml = xmlReader(wanted, out);
    if (xml) { xml(line); continue; }
    if (!cols) { cols = headerColumns(line); continue; }
    const id = line.slice(0, cols['ID Number'][1]).trim();
    if (!wanted.has(id)) continue;
    const p = parseLine(line, cols);
    if (p) out.set(p.id, p.r);
  }
  if (!lines) throw new Error('FIDE list is empty');
  return out;
}

export interface Member extends Record<string, unknown> { name: string; fideId?: string }
export interface Change { name: string; field: 'rating' | 'ratingRapid' | 'ratingBlitz'; from: number | null; to: number | null }

/**
 * Applies the ratings to the members (in place). Members whose FIDE ID is not in the list are left untouched;
 * a rating that disappeared from the list (e.g. never rated in that tempo) is cleared.
 */
export function applyRatings(members: Member[], ratings: Map<string, FideRatings>): { changes: Change[]; found: number; missing: string[] } {
  const changes: Change[] = [];
  const missing: string[] = [];
  let found = 0;
  const map = { rating: 'standard', ratingRapid: 'rapid', ratingBlitz: 'blitz' } as const;
  for (const m of members) {
    const id = String(m.fideId ?? '').trim();
    if (!id) continue;
    const r = ratings.get(id);
    if (!r) { missing.push(m.name); continue; }
    found++;
    for (const field of Object.keys(map) as (keyof typeof map)[]) {
      const from = (m[field] as number | null | undefined) ?? null;
      const to = r[map[field]];
      if (from === to) continue;
      changes.push({ name: m.name, field, from, to });
      if (to === null) delete m[field]; else m[field] = to;
    }
  }
  return { changes, found, missing };
}

/** Refuses to write obviously broken results (wrong file, changed format…). */
export function sanityCheck(withId: number, found: number, changes: Change[]): string | null {
  if (withId > 0 && found < Math.ceil(withId * 0.6)) return `only ${found} of ${withId} FIDE IDs were found in the list`;
  const jumps = changes.filter((c) => c.from !== null && c.to !== null && Math.abs(c.to - c.from) > 350);
  if (jumps.length > 2) return `implausible rating jumps: ${jumps.map((c) => `${c.name} ${c.from}→${c.to}`).join(', ')}`;
  const cleared = changes.filter((c) => c.to === null && c.from !== null);
  if (cleared.length > Math.max(3, found * 0.3)) return `${cleared.length} ratings would be cleared`;
  return null;
}
