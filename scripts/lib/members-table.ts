/**
 * Members page ("Članovi") of the old WordPress site → src/data/members.json.
 *
 * The page is a table: Rb. · MB · Prezime, Ime · Kat. · ratings… · Godište · Funkcija.
 * Columns are identified by their header text, never by position, because the rating columns
 * (standard / rapid / blitz) are often partly empty and a positional guess would put a rating in
 * the wrong column. If a column can't be identified, that value is left as it was.
 *
 * Merging rules (existing members.json is the base):
 *  - a member is matched by registration number (MB), otherwise by name (case/diacritics-insensitive)
 *  - values from the page replace: category, ratings, birth year, club role, MB, FIDE ID
 *  - values that only exist in the CMS are kept: photo, biography, English role, title, "active"
 *  - order follows the page; members missing from the page are kept at the end and reported,
 *    never deleted (removing someone is an editor's decision)
 */
// @ts-expect-error – no usable type declarations
import domino from '@mixmark-io/domino';

export interface MemberRow {
  name: string;
  registrationNumber?: string;
  category?: string;
  rating?: number | null;
  ratingRapid?: number | null;
  ratingBlitz?: number | null;
  birthYear?: number | null;
  role?: string;
  fideId?: string;
}

type Field = 'rb' | 'mb' | 'name' | 'category' | 'rating' | 'ratingRapid' | 'ratingBlitz' | 'birthYear' | 'role' | 'fideId';

const HEADERS: [RegExp, Field][] = [
  [/(fide\s*id|id\s*fide)/i, 'fideId'],
  [/^(r\.?\s*b\.?|br\.?|#|redni)/i, 'rb'],
  [/^(mb|mat|matični|reg)/i, 'mb'],
  [/(ime|prezime|igrač|name)/i, 'name'],
  [/^(kat|kategorija|cat)/i, 'category'],
  [/(rapid|ubrz)/i, 'ratingRapid'],
  [/(blitz|brzopot)/i, 'ratingBlitz'],
  [/(standard|std|klasič|fide|elo|rejting|rating)/i, 'rating'],
  [/(god|rođ|born|year)/i, 'birthYear'],
  [/(funkc|uloga|role|dužnost)/i, 'role'],
];

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const int = (s: string) => {
  const m = s.replace(/\./g, ' ').match(/\b(\d{3,4})\b/);
  return m ? Number(m[1]) : null;
};

/** "Cvetković, Božo" → "Božo Cvetković" */
export function displayName(raw: string): string {
  const s = raw.replace(/\s+/g, ' ').trim();
  const m = s.match(/^([^,]+),\s*(.+)$/);
  return m ? `${m[2]} ${m[1]}` : s;
}

export const nameKey = (s: string) =>
  displayName(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().split(' ').sort().join(' ');

function headerFields(cells: string[]): (Field | null)[] {
  const used = new Set<Field>();
  return cells.map((c) => {
    const hit = HEADERS.find(([re, f]) => re.test(c) && !used.has(f));
    if (!hit) return null;
    used.add(hit[1]);
    return hit[1];
  });
}

export interface ParseResult { rows: MemberRow[]; columns: (Field | null)[]; warnings: string[] }

/** Find the members table in the page HTML and turn it into rows. */
export function parseMembersTable(html: string): ParseResult {
  const doc: Document = domino.createDocument(`<body>${html}</body>`);
  const warnings: string[] = [];
  const tables = Array.from(doc.querySelectorAll('table'));
  // the members table is the one with a name column and the most rows
  let best: { table: Element; cols: (Field | null)[]; rows: Element[] } | null = null;
  for (const table of tables) {
    const trs = Array.from(table.querySelectorAll('tr'));
    const headIdx = trs.findIndex((tr) => tr.querySelector('th') || headerFields(Array.from(tr.children).map(text)).includes('name'));
    if (headIdx < 0) continue;
    const cols = headerFields(Array.from(trs[headIdx].children).map(text));
    if (!cols.includes('name')) continue;
    const rows = trs.slice(headIdx + 1).filter((tr) => tr.querySelectorAll('td').length >= 2);
    if (!best || rows.length > best.rows.length) best = { table, cols, rows };
  }
  if (!best) return { rows: [], columns: [], warnings: ['No table with a name column was found on the members page.'] };

  const { cols } = best;
  if (!cols.some((c) => c === 'rating' || c === 'ratingRapid' || c === 'ratingBlitz'))
    warnings.push('No rating column could be identified from the table headers – ratings are left unchanged.');

  const rows: MemberRow[] = [];
  for (const tr of best.rows) {
    const cells = Array.from(tr.querySelectorAll('td'));
    const row: MemberRow = { name: '' };
    cells.forEach((td, i) => {
      const f = cols[i];
      const v = text(td);
      // a link to ratings.fide.com anywhere in the row gives the FIDE ID
      const fide = td.querySelector('a[href*="fide.com"]')?.getAttribute('href')?.match(/(\d{4,10})/)?.[1];
      if (fide) row.fideId = fide;
      switch (f) {
        case 'name': row.name = displayName(v); break;
        case 'mb': if (v) row.registrationNumber = v.replace(/\D/g, '') || v; break;
        case 'category': row.category = v; break;
        case 'rating': case 'ratingRapid': case 'ratingBlitz': row[f] = int(v); break;
        case 'birthYear': row.birthYear = int(v); break;
        case 'role': row.role = v; break;
        case 'fideId': if (v.replace(/\D/g, '')) row.fideId = v.replace(/\D/g, ''); break;
      }
    });
    if (row.name) rows.push(row);
  }
  return { rows, columns: cols, warnings };
}

export interface Member extends Record<string, unknown> { name: string }
export interface MergeResult { members: Member[]; added: string[]; updated: string[]; missing: string[] }

const PAGE_FIELDS = ['registrationNumber', 'category', 'rating', 'ratingRapid', 'ratingBlitz', 'birthYear', 'role', 'fideId'] as const;

export function mergeMembers(existing: Member[], rows: MemberRow[], columns: (Field | null)[]): MergeResult {
  const has = (f: Field) => columns.includes(f) || (f === 'fideId');
  const byMb = new Map(existing.filter((m) => m.registrationNumber).map((m) => [String(m.registrationNumber), m]));
  const byName = new Map(existing.map((m) => [nameKey(m.name), m]));
  const used = new Set<Member>();
  const added: string[] = [], updated: string[] = [];
  const out: Member[] = [];

  for (const r of rows) {
    const old = (r.registrationNumber && byMb.get(r.registrationNumber)) || byName.get(nameKey(r.name));
    const m: Member = old ? { ...old } : { name: r.name };
    let changed = false;
    for (const f of PAGE_FIELDS) {
      const colField: Field = f === 'registrationNumber' ? 'mb' : (f as Field);
      if (!has(colField)) continue;
      const v = r[f];
      if (f === 'fideId' && v === undefined) continue; // no link on the page ≠ no FIDE ID
      const next = v === '' ? undefined : v ?? (f.startsWith('rating') ? null : undefined);
      if (m[f] !== next && !(m[f] == null && next == null)) { changed = true; }
      if (next === undefined) delete m[f]; else m[f] = next;
    }
    if (old) { used.add(old); if (changed) updated.push(r.name); } else added.push(r.name);
    out.push(m);
  }
  const missing = existing.filter((m) => !used.has(m));
  return { members: [...out, ...missing], added, updated, missing: missing.map((m) => m.name) };
}
