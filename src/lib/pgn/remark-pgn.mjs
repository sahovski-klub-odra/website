/**
 * Remark plugin: chess games in Markdown articles.
 *
 * 1. A code block with language "pgn" (or "chess"):
 *      ```pgn
 *      [White "…"] …
 *      1. e4 e5 …
 *      ```
 * 2. A link to a .pgn file alone in its own paragraph:
 *      [Partije 1. kola](runda-1.pgn)          ← file next to the article (uploaded via CMS)
 *      [Partije](/files/wp/2024/03/kolo.pgn)    ← file in public/
 * 3. A code block with language "fen" → a static position diagram.
 *
 * Each becomes <div class="pgn-viewer" data-pgn="…"> with a plain-text fallback.
 * The PGN is embedded at build time, so the page needs no extra request, and the
 * interactive board is added in the browser by src/scripts/pgn-viewer.ts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function headers(game) {
  const h = {};
  for (const m of game.matchAll(/^\s*\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]/gm)) h[m[1]] = m[2];
  return h;
}
function splitGames(text) {
  const games = [];
  let cur = [];
  let seen = false;
  for (const line of text.replace(/\r\n?/g, '\n').trim().split('\n')) {
    const isHeader = /^\s*\[\s*[A-Za-z0-9_]+\s+"/.test(line);
    if (isHeader && seen) { games.push(cur.join('\n')); cur = []; seen = false; }
    if (!isHeader && line.trim()) seen = true;
    cur.push(line);
  }
  if (cur.join('').trim()) games.push(cur.join('\n'));
  return games;
}
const known = (v) => v && !/^\?+$/.test(v) && !v.startsWith('????');

function viewerHtml(pgn, { lang, assets, title }) {
  const games = splitGames(pgn);
  const fallback = games
    .map((g) => {
      const h = headers(g);
      const players = known(h.White) || known(h.Black) ? `${esc(h.White ?? '?')} – ${esc(h.Black ?? '?')}` : '';
      const meta = [h.Event, h.Round && known(h.Round) ? `kolo ${h.Round}` : '', h.Date]
        .filter(known)
        .map(esc)
        .join(', ');
      const moves = g.replace(/^\s*\[[^\]]*\]\s*$/gm, '').trim();
      return `<div class="pgnv-fallback-game">${players ? `<p class="pgnv-fallback-title"><strong>${players}</strong>${known(h.Result) ? ` <span>${esc(h.Result)}</span>` : ''}</p>` : ''}${meta ? `<p class="pgnv-fallback-meta">${meta}</p>` : ''}${moves ? `<pre class="pgnv-fallback-moves">${esc(moves)}</pre>` : ''}</div>`;
    })
    .join('');
  return (
    `<div class="pgn-viewer not-prose" data-pgn-viewer data-pgn="${esc(pgn)}" data-lang="${lang}" data-assets="${esc(assets)}"${title ? ` data-title="${esc(title)}"` : ''}>` +
    `<div class="pgnv-fallback">${title ? `<p class="pgnv-fallback-label">${esc(title)}</p>` : ''}${fallback}</div></div>`
  );
}

export function remarkPgn(options = {}) {
  const base = (options.base ?? '/').replace(/\/?$/, '/');
  const assets = `${base}vendor/cm-chessboard/`;
  const publicDir = options.publicDir ?? resolve('public');

  return (tree, file) => {
    const filePath = file.path || file.history?.[0] || '';
    const lang = 'hr';

    const visit = (node) => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        // ```pgn / ```chess / ```fen
        if (child.type === 'code' && /^(pgn|chess|fen)$/i.test(child.lang ?? '')) {
          if (!child.value.trim()) return { type: 'html', value: '' }; // empty block from the CMS dialog
          const pgn = /^fen$/i.test(child.lang) ? `[SetUp "1"]\n[FEN "${child.value.trim()}"]\n\n*` : child.value;
          return { type: 'html', value: viewerHtml(pgn, { lang, assets, title: child.meta ?? '' }) };
        }
        // paragraph containing only a link to a .pgn file
        if (child.type === 'paragraph') {
          const kids = child.children.filter((k) => !(k.type === 'text' && !k.value.trim()));
          const link = kids.length === 1 && kids[0].type === 'link' ? kids[0] : null;
          if (link && /\.pgn(\?.*)?$/i.test(link.url) && !/^https?:/i.test(link.url)) {
            const url = decodeURIComponent(link.url.split('?')[0]);
            const target = url.startsWith('/') ? join(publicDir, url) : resolve(dirname(filePath), url);
            if (!existsSync(target)) {
              file.message(`PGN file not found: ${url}`, child);
              console.warn(`[pgn] ${filePath}: PGN file not found: ${url}`);
              return child;
            }
            const title = link.children.map((c) => c.value ?? '').join('').trim();
            return { type: 'html', value: viewerHtml(readFileSync(target, 'utf8'), { lang, assets, title }) };
          }
        }
        visit(child);
        return child;
      });
    };
    visit(tree);
  };
}
