/**
 * Rehype plugin: match and result tables in articles look like proper chess competition tables.
 *
 *  1. Tables written as raw HTML (most tables imported from WordPress) are parsed, so they can be
 *     styled like Markdown tables (only HTML fragments that contain a <table> are touched).
 *  2. Every top-level table gets the class "chess-table". When it has no header but its first row is
 *     clearly a header (all bold, or the "Pl./Ime/Bod." kind), that row becomes <thead> with <th> cells.
 *  3. Cells are marked by what they hold – result ("3,5-2,5", "1-0", "½"), board/rank ("1."), rating or
 *     tie-break number, title/category (MK, FM, II) – and every cell naming ŠK Odra is highlighted.
 *  4. A paragraph that is only a list of board pairings ("1. Ganić Martin – Ljubić Ivan 0:1", one per line)
 *     becomes a table with the same text: board, player, player, result.
 * Nothing is added, removed or reworded: names, scores and links stay exactly as written.
 */
import { raw } from 'hast-util-raw';

const el = (tagName, props = {}, children = []) => ({ type: 'element', tagName, properties: props, children });
const txt = (value) => ({ type: 'text', value });
const text = (n) => (n.type === 'text' ? n.value : (n.children ?? []).map(text).join(''));
const clean = (s) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const isEl = (n, tag) => n?.type === 'element' && (!tag || n.tagName === tag);
const addClass = (n, c) => {
  const cur = n.properties.className;
  n.properties.className = [...(Array.isArray(cur) ? cur : cur ? String(cur).split(/\s+/) : []), c];
};

const SCORE = /^(?:\d+(?:[,.]5)?|½)\s*[-–:]\s*(?:\d+(?:[,.]5)?|½)$/;
/** a single "½" or "1/2" is a game result in a pairing table, but just one of many cells in a cross table */
const HALF = /^(?:½|1\/2)$/;
const RANK = /^\d{1,3}\.$/;
const NUM = /^\d{3,4}(?:[,.]\d{1,2})?$/;
const TITLE = /^(?:GM|IM|FM|CM|WGM|WIM|WFM|WCM|MK|KM|VK|vk|I{1,3}|IV|V)$/;
// typical column names in Croatian and chess-results tables
const HEADER_WORDS = /^(?:pl\.?|mj\.?|rk\.?|bo\.?|br\.?|r\.?\s?br\.?|no\.?|s?no\.?|sbr\.?|#|\.|ime|name|igrač|ekipa|momčad|klub|club\/city|fed|fide\s?id|zemlja|rating|rtg\w*|rtg\s?\+\/-|bod\.?|bodovi|bod\.?\s?ukup\.?|meč\s?bod\.?|mečbodovi|poj\.?\s?bod\.?|partije|tb\d?|rp|n|w|sex|typ|rezultat|kolo|\d{1,2}\.?(?:\s?rd)?|\+|=|–|-|domaćin|gost|kod kuće|u gostima|)$/i;

function rowsOf(table) {
  const out = [];
  for (const c of table.children) {
    if (isEl(c, 'tr')) out.push(c);
    else if (isEl(c) && ['thead', 'tbody', 'tfoot'].includes(c.tagName)) out.push(...c.children.filter((r) => isEl(r, 'tr')));
  }
  return out;
}
const cellsOf = (tr) => tr.children.filter((c) => isEl(c, 'td') || isEl(c, 'th'));

/** a first row made only of bold labels, or of typical column names, is a header row */
function looksLikeHeader(tr) {
  const cells = cellsOf(tr).filter((c) => clean(text(c)));
  if (cells.length < 2) return false;
  const bold = (c) => c.children.filter((k) => !(k.type === 'text' && !clean(k.value))).every((k) => isEl(k, 'strong') || isEl(k, 'b'));
  // every cell is bold or a typical column label; a team line ("Pl. | ŠK Oroslavje – ŠK Odra | 3,5-2,5") counts too
  if (cells.every((c) => bold(c) || HEADER_WORDS.test(clean(text(c))))) return true;
  // a team line without bold: "ŠK Dugo Selo | – | ŠK Odra | 3 : 3" (a dash, a match score, no board number)
  const vals = cells.map((c) => clean(text(c)));
  return vals.includes('–') && vals.some((v) => SCORE.test(v)) && !vals.some((v) => RANK.test(v)) && vals.filter((v) => /[a-zčćžšđ]{3,}/i.test(v)).length >= 2;
}

const NUMERIC = /^[\d½¼¾,.:;\-–+*=/()%\s]+$/;
const isEmptyCell = (c) => !clean(text(c)) && !(c.children ?? []).some((k) => isEl(k, 'img') || isEl(k, 'a'));

/**
 * Old WordPress/chess-results tables: tidy the structure without touching the data.
 *  - a cell that holds a one-row table (chess-results pasted into WordPress) gets that table's content;
 *  - rows with fewer cells are padded, so borders and zebra stripes line up;
 *  - columns that are empty in every row are left out (they only held spacing).
 */
function normalise(table) {
  for (const tr of rowsOf(table)) {
    for (const cell of cellsOf(tr)) {
      cell.children = cell.children.flatMap((k) => {
        if (!isEl(k, 'table')) return [k];
        const inner = rowsOf(k);
        if (inner.length !== 1) return [k];
        const parts = cellsOf(inner[0]).filter((c) => !isEmptyCell(c));
        return parts.flatMap((c, i) => {
          const content = c.tagName === 'th' ? [el('strong', {}, c.children)] : c.children;
          return i ? [txt(' '), ...content] : content;
        });
      });
    }
  }
  for (const tr of rowsOf(table)) {
    for (const cell of cellsOf(tr)) {
      const first = cell.children[0], last = cell.children.at(-1);
      if (first?.type === 'text') first.value = first.value.replace(/^[\s\u00a0]+/, '');
      if (last?.type === 'text') last.value = last.value.replace(/[\s\u00a0]+$/, '');
    }
  }
  const rows = rowsOf(table);
  const spans = rows.some((r) => cellsOf(r).some((c) => Number(c.properties.colSpan ?? 1) > 1 || Number(c.properties.rowSpan ?? 1) > 1));
  if (spans || !rows.length) return;
  const width = Math.max(...rows.map((r) => cellsOf(r).length));
  for (const r of rows) {
    const missing = width - cellsOf(r).length;
    for (let i = 0; i < missing; i++) r.children.push(el(cellsOf(r)[0]?.tagName === 'th' ? 'th' : 'td', {}, []));
  }
  const empty = [...Array(width).keys()].filter((i) => rows.every((r) => isEmptyCell(cellsOf(r)[i])));
  if (empty.length && empty.length < width) {
    for (const r of rows) {
      const cells = cellsOf(r);
      r.children = r.children.filter((c) => !cells.includes(c) || !empty.includes(cells.indexOf(c)));
    }
  }
}

/** numbers, results and points are centred; names and text are left-aligned (decided per column) */
function typeColumns(rows, bodyRows) {
  if (rows.some((r) => cellsOf(r).some((c) => Number(c.properties.colSpan ?? 1) > 1))) return;
  const width = Math.max(...rows.map((r) => cellsOf(r).length));
  for (let i = 0; i < width; i++) {
    const vals = bodyRows.map((r) => cellsOf(r)[i]).filter((c) => c && clean(text(c)));
    if (!vals.length) continue;
    const share = (re) => vals.filter((c) => re.test(clean(text(c)))).length / vals.length;
    const kind = share(TITLE) >= 0.6 ? 'col-title' : share(NUMERIC) >= 0.6 ? 'col-num' : 'col-text';
    for (const r of rows) {
      const c = cellsOf(r)[i];
      if (c) addClass(c, kind);
    }
  }
}

function enhanceTable(table) {
  addClass(table, 'chess-table');
  normalise(table);
  const rows = rowsOf(table);
  if (!rows.length) return;
  const hasHead = table.children.some((c) => isEl(c, 'thead'));
  let bodyRows = rows;
  if (!hasHead && rows.length > 1 && looksLikeHeader(rows[0])) {
    const head = rows[0];
    head.children = head.children.map((c) => (isEl(c, 'td') ? { ...c, tagName: 'th', properties: { ...c.properties, scope: 'col' } } : c));
    // rebuild: <thead>first row</thead><tbody>rest</tbody>
    table.children = [el('thead', {}, [head]), el('tbody', {}, rows.slice(1))];
    bodyRows = rows.slice(1);
  } else if (hasHead) {
    bodyRows = rows.filter((r) => !table.children.find((c) => isEl(c, 'thead'))?.children.includes(r));
  }
  const cols = Math.max(...rows.map((r) => cellsOf(r).length));
  if (cols > 8) addClass(table, 'is-wide');
  typeColumns(rows, bodyRows);
  for (const tr of rows) {
    for (const cell of cellsOf(tr)) {
      const t = clean(text(cell));
      if (/odra/i.test(t)) addClass(cell, 'is-odra');
      if (!bodyRows.includes(tr) || !t) continue;
      if (SCORE.test(t) || (cols <= 8 && HALF.test(t))) addClass(cell, 'cell-score');
      else if (RANK.test(t)) addClass(cell, 'cell-rank');
      else if (NUM.test(t)) addClass(cell, 'cell-num');
      else if (TITLE.test(t)) addClass(cell, 'cell-title');
    }
  }
}

/* ---------- board pairings written as lines of text ---------- */
const PAIR = /^(\d{1,2})\.?\s+(.+?)\s+[–-]\s+(.+?)\s+(\d\s*[:–-]\s*\d|1\/2|½|\d,5\s*[:–-]\s*\d,5|[+−-]\s*[:–-]\s*[+−-])$/;
const INLINE_OK = new Set(['strong', 'b', 'em', 'i', 'span']);

function splitLines(children) {
  const lines = [[]];
  for (const c of children) {
    if (isEl(c, 'br')) lines.push([]);
    else lines.at(-1).push(c);
  }
  return lines.filter((l) => clean(l.map(text).join('')));
}

/** returns a table for a block of pairing lines, or null when any line is something else */
function pairingTable(lines, firstNumber) {
  if (lines.length < 3) return null;
  const rows = [];
  for (const [i, line] of lines.entries()) {
    if (line.some((n) => n.type === 'element' && !INLINE_OK.has(n.tagName))) return null; // links, images…
    let t = clean(line.map(text).join(''));
    if (i === 0 && firstNumber != null) t = `${firstNumber}. ${t}`;
    const m = t.match(PAIR);
    if (!m) return null;
    rows.push(m);
  }
  const td = (v, cls) => el('td', cls ? { className: [cls, ...(/odra/i.test(v) ? ['is-odra'] : [])] } : {}, [txt(v)]);
  return el('div', { className: ['table-wrap'] }, [
    { ...el('table', { className: ['chess-table', 'pairings-table'] }), data: { wrapped: true }, children: [
      el('thead', {}, [el('tr', {}, [
        el('th', { scope: 'col' }, [txt('Ploča')]),
        el('th', { scope: 'col', colSpan: 3 }, [txt('Susret')]),
        el('th', { scope: 'col' }, [txt('Rezultat')]),
      ])]),
      el('tbody', {}, rows.map((m) => el('tr', {}, [
        td(`${m[1]}.`, 'cell-rank'), td(m[2], 'cell-player'), td('–', 'cell-dash'), td(m[3], 'cell-player'), td(m[4], 'cell-score'),
      ]))),
    ] },
  ]);
}

export function rehypeMatchTables() {
  return (tree) => {
    const walk = (node, inCell) => {
      if (!node.children) return;
      node.children = node.children.flatMap((child) => {
        // 1. raw HTML containing a table → real elements
        if (child.type === 'raw' && /<table[\s>]/i.test(child.value) && /<\/table>/i.test(child.value)) {
          try {
            return raw({ type: 'root', children: [child] }).children;
          } catch {
            return [child];
          }
        }
        if (!isEl(child)) return [child];
        // 4. pairing lines
        if (!inCell && child.tagName === 'p') {
          const t = pairingTable(splitLines(child.children), null);
          if (t) return [t];
        }
        if (!inCell && child.tagName === 'ol' && child.children.filter((c) => isEl(c, 'li')).length === 1) {
          // "1. Malada Vinko – Maravić Stjepan 1:0" followed by "2\. …" lines: Markdown made it a one-item list
          const li = child.children.find((c) => isEl(c, 'li'));
          const inner = li.children.length === 1 && isEl(li.children[0], 'p') ? li.children[0].children : li.children;
          const start = Number(child.properties?.start ?? 1);
          const t = pairingTable(splitLines(inner), start);
          if (t) return [t];
        }
        return [child];
      });
      for (const c of node.children) {
        if (!isEl(c)) continue;
        if (c.tagName === 'table' && !inCell && !String(c.properties.className ?? '').includes('pairings-table')) enhanceTable(c);
        walk(c, inCell || c.tagName === 'td' || c.tagName === 'th');
      }
    };
    walk(tree, false);
  };
}
