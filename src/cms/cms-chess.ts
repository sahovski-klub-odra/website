/**
 * Sveltia CMS editor components for chess (bundled to public/admin/cms-chess.js by
 * scripts/copy-vendor-assets.mjs – do not edit the bundled file).
 *
 *  ♞ "Dodaj šahovsku partiju" – paste PGN or upload a .pgn file (one or more games)
 *  ♜ "Dodaj šahovski dijagram" – a single position from a FEN string
 *
 * Both write plain Markdown that the website already understands (src/lib/pgn/remark-pgn.mjs):
 *
 *   ```pgn Optional title           ← pasted PGN
 *   1. e4 e5 …
 *   ```
 *   [Optional title](round-1.pgn)   ← uploaded file, stored next to the article
 *   ```fen                          ← diagram
 *   6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1
 *   ```
 *
 * The preview pane shows the SAME interactive viewer as the website, plus a validation box
 * that explains exactly which move is wrong, so editors see problems before publishing.
 */
import { GameViewer } from '../scripts/pgn-viewer';
import { parsePgn } from '../lib/pgn/parse';
import { validate, validateFen } from './validate';
import { TABLE_PATTERN, parseRows, toMarkdown, fromMarkdown, tablePreview } from './table';
import viewerCss from '../styles/pgn-viewer.css?raw';
import boardCss from 'cm-chessboard/assets/chessboard.css?raw';
import markersCss from 'cm-chessboard/assets/extensions/markers/markers.css?raw';

declare global {
  interface Window {
    CMS?: { registerEditorComponent: (def: Record<string, unknown>) => void };
  }
}

const FENCE = '```';
const CSS = `${boardCss}\n${markersCss}\n${viewerCss}\n
.cms-chess { font-family: system-ui, sans-serif; margin: 1rem 0; }
.cms-chess-status { border-radius: .5rem; padding: .6rem .8rem; font-size: .9rem; line-height: 1.45; margin-bottom: .6rem; }
.cms-chess-status.ok { background: #ecfdf3; color: #14532d; border: 1px solid #86efac; }
.cms-chess-status.err { background: #fef2f2; color: #7f1d1d; border: 1px solid #fca5a5; }
.cms-chess-status.empty { background: #f4f4f5; color: #3f3f46; border: 1px dashed #a1a1aa; }
.cms-chess-status ul { margin: .3rem 0 0 1.1rem; padding: 0; }
.cms-chess .pgnv { max-width: 100%; }`;

/** chessboard sprites are served by the website: <site>/vendor/cm-chessboard/ (admin lives at <site>/admin/) */
const assetsUrl = () => new URL('../vendor/cm-chessboard/', location.href.split('#')[0]).href;
/** Preview element: validation box + the real interactive viewer. */
function preview(
  pgnSource: string | Promise<string>,
  title: string,
  check: (pgn: string) => ReturnType<typeof validate> = validate,
  renderOnError = true,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'cms-chess';
  const style = document.createElement('style');
  style.textContent = CSS;
  const status = document.createElement('div');
  status.className = 'cms-chess-status empty';
  status.textContent = 'Učitavanje…';
  const host = document.createElement('div');
  host.className = 'pgn-viewer';
  if (title) host.dataset.title = title;
  wrap.append(style, status, host);

  Promise.resolve(pgnSource)
    .then((pgn) => {
      const v = check(pgn);
      status.className = `cms-chess-status ${v.level}`;
      status.innerHTML = v.html;
      if (v.level === 'empty' || (v.level === 'err' && !renderOnError) || !parsePgn(pgn).length) return;
      // the board needs a measurable size: wait until the preview is in the page
      const start = () => {
        if (!wrap.isConnected) return requestAnimationFrame(start);
        try {
          new GameViewer(host, pgn, 'hr', assetsUrl()).activate();
        } catch (e) {
          status.className = 'cms-chess-status err';
          status.textContent = `Prikaz partije nije uspio: ${(e as Error).message}`;
        }
      };
      start();
    })
    .catch((e) => {
      status.className = 'cms-chess-status err';
      status.textContent = `PGN datoteka se ne može učitati: ${e?.message ?? e}`;
    });
  return wrap;
}

/** Sveltia passes getAsset(path) to toPreview; it may return a URL, an object with .url/.toString(), or a promise. */
async function readUploadedFile(getAsset: unknown, path: string): Promise<string> {
  if (/^blob:/.test(path)) return (await fetch(path)).text(); // fresh upload, not saved yet
  let asset: unknown = typeof getAsset === 'function' ? (getAsset as (p: string) => unknown)(path) : undefined;
  asset = await asset;
  const a = asset as { url?: string; blobURL?: string; file?: Blob; toString?: () => string } | string | undefined;
  if (a && typeof a === 'object' && a.file instanceof Blob) return a.file.text();
  const url = typeof a === 'string' ? a : (a?.blobURL ?? a?.url ?? (a?.toString && a.toString() !== '[object Object]' ? a.toString() : ''));
  if (!url) throw new Error(`datoteka „${path}” nije pronađena`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function register() {
  const CMS = window.CMS;
  if (!CMS) return;

  CMS.registerEditorComponent({
    id: 'chess-game',
    label: 'Dodaj šahovsku partiju',
    icon: 'chess_knight',
    trigger: 'button',
    collapsed: false,
    fields: [
      {
        name: 'title',
        label: 'Naslov iznad ploče (neobavezno)',
        widget: 'string',
        required: false,
        hint: 'npr. „3. kolo: Horvat – Kovač”',
      },
      {
        name: 'pgn',
        label: 'PGN zapis – zalijepite partiju (ili više partija)',
        widget: 'text',
        required: false,
        hint: 'Kopirajte PGN iz ChessBasea, Lichessa, Chess.coma ili s chess-results.com. Pregled s pločom i provjerom zapisa vidi se desno. Ostavite prazno ako učitavate datoteku.',
      },
      {
        name: 'file',
        label: '… ili učitajte .pgn datoteku',
        widget: 'file',
        required: false,
        media_folder: '',
        public_folder: '',
        accept: '.pgn,application/x-chess-pgn,application/vnd.chess-pgn,text/plain',
        hint: 'Datoteka se sprema uz članak. Ako sadrži više partija (npr. cijelo kolo), posjetitelji ih biraju iz izbornika iznad ploče.',
      },
    ],
    // a .pgn link on its own line; before the first save Sveltia keeps a fresh upload as a temporary
    // blob: URL (it is replaced by the real file name when the entry is saved)
    pattern: /^(?:```pgn[^\S\n]*([^\n]*)\n([\s\S]*?)\n```|\[([^\]\n]*)\]\(([^)\s]+\.pgn|blob:[^)\s]+)\))$/m,
    fromBlock: (m: RegExpMatchArray) =>
      m[4] ? { title: m[3] || '', file: m[4], pgn: '' } : { title: (m[1] || '').trim(), pgn: m[2] || '', file: '' },
    toBlock: (data: Record<string, string> = {}) => {
      const title = String(data.title || '').replace(/\s+/g, ' ').trim();
      if (data.file) return `[${title.replace(/[[\]]/g, '') || 'Partija'}](${data.file})`;
      // a ``` line inside the PGN would end the block early – PGN never needs one
      const pgn = String(data.pgn || '').replace(/^```.*$/gm, '').trim();
      return `${FENCE}pgn${title ? ` ${title}` : ''}\n${pgn}\n${FENCE}`;
    },
    toPreview: (data: Record<string, string> = {}, getAsset?: unknown) =>
      data.file ? preview(readUploadedFile(getAsset, data.file), data.title || '') : preview(data.pgn || '', data.title || ''),
  });

  CMS.registerEditorComponent({
    id: 'chess-diagram',
    label: 'Dodaj šahovski dijagram',
    icon: 'chess',
    fields: [
      {
        name: 'fen',
        label: 'Pozicija (FEN)',
        widget: 'string',
        hint: 'npr. 6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1 – FEN kopirajte iz Lichessa (Analiza → FEN) ili ChessBasea.',
      },
    ],
    pattern: /^```fen\n([^\n]*)\n```$/m,
    fromBlock: (m: RegExpMatchArray) => ({ fen: (m[1] || '').trim() }),
    toBlock: (data: Record<string, string> = {}) => `${FENCE}fen\n${String(data.fen || '').trim()}\n${FENCE}`,
    toPreview: (data: Record<string, string> = {}) =>
      preview(
        data.fen ? `[SetUp "1"]\n[FEN "${data.fen.trim().replace(/"/g, '')}"]\n\n*` : '',
        '',
        () => validateFen(data.fen || ''),
        false,
      ),
  });

  CMS.registerEditorComponent({
    id: 'table',
    label: 'Dodaj tablicu',
    icon: 'table',
    fields: [
      {
        name: 'rows',
        label: 'Tablica – prvi redak je zaglavlje',
        widget: 'text',
        hint: 'Zalijepite retke iz Excela, Google tablica ili chess-results.com, ili upišite ćelije odvojene znakom ; (npr. Ploča;Bijeli;Crni;Rezultat).',
      },
    ],
    pattern: TABLE_PATTERN,
    fromBlock: (m: RegExpMatchArray) => ({ rows: fromMarkdown(m) }),
    toBlock: (data: Record<string, string> = {}) => toMarkdown(parseRows(String(data.rows || ''))),
    toPreview: (data: Record<string, string> = {}) => tablePreview(String(data.rows || '')),
  });
}

register();
