/**
 * "Dodaj tablicu" – table editor component for the CMS.
 * Editors paste rows straight from Excel / Google Sheets / chess-results (tab-separated) or type them
 * with ";" or "|" between cells. The first row is the header. Saved as a standard Markdown (GFM) table,
 * so the article stays readable and editable on GitHub too.
 */
import { esc } from './validate';

export const TABLE_PATTERN = /^(\|[^\n]*\|)\n(\|(?:\s*:?-{3,}:?\s*\|)+)\n((?:\|[^\n]*\|(?:\n|$))*)/m;

/** "a<TAB>b" / "a;b" / "a|b" rows → cells */
export function parseRows(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = lines.some((l) => l.includes('\t')) ? '\t' : lines.some((l) => l.includes(';')) ? ';' : '|';
  const rows = lines.map((l) => {
    let cells = l.split(sep).map((c) => c.trim());
    if (sep === '|') cells = cells.filter((c, i, a) => !(c === '' && (i === 0 || i === a.length - 1)));
    return cells;
  });
  const width = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => [...r, ...Array(width - r.length).fill('')]);
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ') || ' ';

export function toMarkdown(rows: string[][]): string {
  if (!rows.length) return '';
  const [head, ...body] = rows;
  const line = (r: string[]) => `| ${r.map(cell).join(' | ')} |`;
  return [line(head), `|${head.map(() => ' --- ').join('|')}|`, ...body.map(line)].join('\n');
}

/** GFM table (as matched by TABLE_PATTERN) → tab-separated rows for the editor field */
export function fromMarkdown(m: RegExpMatchArray): string {
  const split = (l: string) =>
    l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
  const body = (m[3] || '').split('\n').filter((l) => l.trim());
  return [split(m[1]), ...body.map(split)].map((r) => r.join('\t')).join('\n');
}

export function tablePreview(text: string): string {
  const rows = parseRows(text);
  if (!rows.length) return '<p style="color:#6b6f75;font:14px system-ui">Zalijepite retke iz Excela ili upišite ćelije odvojene znakom ; (prvi redak je zaglavlje).</p>';
  const [head, ...body] = rows;
  const th = head.map((c) => `<th style="text-align:left;padding:6px 10px;background:#17191c;color:#d9b56d;font-weight:600">${esc(c)}</th>`).join('');
  const tr = body
    .map((r, i) => `<tr style="background:${i % 2 ? '#f5f0e6' : '#fff'}">${r.map((c) => `<td style="padding:6px 10px;border-top:1px solid #e5e0d5">${esc(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<div style="overflow-x:auto"><table style="border-collapse:collapse;font:14px system-ui;min-width:60%"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>
  <p style="color:#6b6f75;font:12px system-ui;margin-top:6px">${body.length} ${body.length === 1 ? 'redak' : body.length < 5 ? 'retka' : 'redaka'} + zaglavlje, ${head.length} stupaca</p></div>`;
}
