/**
 * PGN validation messages for the CMS preview (Croatian). Pure functions – no DOM, no CSS –
 * so they can be unit-tested in Node (tests/chess.test.ts, `npm test`).
 */
import { validateFen as chessValidateFen } from 'chess.js';
import { parsePgn, mainline, isUnknown, completeFen } from '../lib/pgn/parse';

export const esc = (s = '') =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Croatian plural: 1 (21, 31…) / 2–4 (22–24…) / 5+ and 11–14 */
export function hrPlural(n: number, one: string, few: string, many: string): string {
  const d = n % 10, dd = n % 100;
  if (d === 1 && dd !== 11) return one;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few;
  return many;
}
const allValid = (n: number) =>
  n === 1 ? 'Partija je ispravna' : n === 2 ? 'Obje partije su ispravne' : hrPlural(n, `${n} partija je ispravna`, `Sve ${n} partije su ispravne`, `Svih ${n} partija je ispravno`);
const someInvalid = (n: number) =>
  n === 1 ? 'jedna partija ima grešku' : hrPlural(n, `${n} partija ima grešku`, `${n} partije imaju greške`, `${n} partija ima greške`);

/** Validation summary shown above the board in the CMS preview. */
export function validate(pgn: string): { level: 'ok' | 'err' | 'empty'; html: string } {
  if (!pgn.trim()) return { level: 'empty', html: 'Zalijepite PGN zapis ili učitajte <b>.pgn</b> datoteku.' };
  const games = parsePgn(pgn);
  if (!games.length) return { level: 'err', html: 'U tekstu nije pronađena nijedna šahovska partija.' };
  const lines = games.map((g, i) => {
    const w = isUnknown(g.headers.White) ? 'Bijeli' : g.headers.White;
    const b = isUnknown(g.headers.Black) ? 'Crni' : g.headers.Black;
    const moves = mainline(g.root).length;
    const full = Math.ceil(moves / 2);
    const what = moves ? `${full} ${hrPlural(full, 'potez', 'poteza', 'poteza')}` : g.headers.FEN ? 'pozicija' : 'bez poteza';
    const label = `${games.length > 1 ? `${i + 1}. ` : ''}${esc(w)} – ${esc(b)} (${what}${!isUnknown(g.result) && g.result !== '*' ? `, ${esc(g.result)}` : ''})`;
    return { label, error: g.error, empty: !moves && !g.headers.FEN };
  });
  const bad = lines.filter((l) => l.error || l.empty);
  if (bad.length) {
    return {
      level: 'err',
      html: `<b>⚠ Provjerite zapis – ${someInvalid(bad.length)}:</b><ul>${bad
        .map((l) => `<li>${l.label}: ${esc(l.error ?? 'nije pronađen nijedan potez')}</li>`)
        .join('')}</ul><small>Na stranici će se prikazati svi potezi do mjesta greške.</small>`,
    };
  }
  return {
    level: 'ok',
    html: `<b>✓ ${allValid(games.length)}</b><ul>${lines.map((l) => `<li>${l.label}</li>`).join('')}</ul>`,
  };
}


/** Validation summary for the "Dodaj šahovski dijagram" component (a single FEN position). */
export function validateFen(fen: string): { level: 'ok' | 'err' | 'empty'; html: string } {
  const f = fen.trim();
  if (!f) return { level: 'empty', html: 'Upišite FEN poziciju, npr. <code>6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1</code>.' };
  const full = completeFen(f.replace(/"/g, ''));
  const r = chessValidateFen(full);
  if (!r.ok) {
    return {
      level: 'err',
      html: `<b>⚠ Neispravna FEN pozicija</b><ul><li>${esc(fenReason(r.error ?? ''))}</li></ul><small>Kopirajte FEN iz Lichessa (Analiza → FEN) ili ChessBasea. Dijagram se neće prikazati dok pozicija nije ispravna.</small>`,
    };
  }
  const side = full.split(' ')[1] === 'b' ? 'crni' : 'bijeli';
  return { level: 'ok', html: `<b>✓ Pozicija je ispravna</b><ul><li>Na potezu je ${side}.</li></ul>` };
}

const FEN_REASONS: [RegExp, string][] = [
  [/missing white king/, 'nedostaje bijeli kralj'],
  [/missing black king/, 'nedostaje crni kralj'],
  [/too many white kings/, 'previše bijelih kraljeva'],
  [/too many black kings/, 'previše crnih kraljeva'],
  [/six space-delimited|1st field|piece data|squares in rank|8 rows|consecutive numbers|invalid piece/, 'raspored figura nije ispravan (svaki od 8 redova mora imati točno 8 polja, redovi se odvajaju znakom /)'],
  [/side-to-move/, 'strana na potezu mora biti „w” (bijeli) ili „b” (crni)'],
  [/castling/, 'neispravna oznaka rokade'],
  [/en-passant/, 'neispravno en passant polje'],
  [/edge rows|pawns? on the first or last rank/i, 'pješak ne može stajati na prvom ili posljednjem redu'],
  [/move number|half move/, 'brojevi poteza na kraju FEN-a nisu ispravni'],
];
function fenReason(err: string): string {
  return FEN_REASONS.find(([re]) => re.test(err))?.[1] ?? err.replace(/^Invalid FEN:\s*/, '');
}
