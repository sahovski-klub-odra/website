/**
 * PGN → move tree.
 *
 * chess.js validates every move and gives us the position after it; this file adds what
 * chess.js does not keep: variations (as a tree), comments before/after moves, NAGs,
 * several games in one PGN, and a readable error instead of an exception.
 *
 * Runs in the browser (viewer) and in Node (build-time checks, migration verification).
 */
import { Chess } from 'chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface MoveNode {
  id: number;
  /** SAN, e.g. "Nxe5+" (empty for the root = starting position) */
  san: string;
  from: string;
  to: string;
  /** position AFTER this move */
  fen: string;
  /** 1 = white's first move */
  ply: number;
  color: 'w' | 'b' | '';
  moveNumber: number;
  /** annotation glyphs: "!", "?!", "+-" … */
  nags: string[];
  /** comment shown after the move */
  comment?: string;
  /** comment shown before the move (e.g. at the start of a variation) */
  commentBefore?: string;
  check: boolean;
  parent: MoveNode | null;
  /** children[0] = main continuation, children[1..] = variations */
  children: MoveNode[];
}

export interface ParsedGame {
  headers: Record<string, string>;
  root: MoveNode;
  nodes: MoveNode[];
  result: string;
  /** set when a move could not be played; moves before it are kept */
  error?: string;
}

const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '½-½', '*']);
const NAG_GLYPHS: Record<string, string> = {
  '1': '!', '2': '?', '3': '!!', '4': '??', '5': '!?', '6': '?!', '7': '□', '10': '=', '13': '∞',
  '14': '⩲', '15': '⩱', '16': '±', '17': '∓', '18': '+−', '19': '−+', '22': '⨀', '32': '⟳', '36': '→', '40': '↑',
  '132': '⇆', '138': '⊕', '146': 'N',
};

/** Split a PGN text that may contain several games. */
export function splitGames(text: string): string[] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  if (!clean) return [];
  const games: string[] = [];
  let current: string[] = [];
  let seenMoves = false;
  for (const line of clean.split('\n')) {
    const isHeader = /^\s*\[\s*[A-Za-z0-9_]+\s+"/.test(line);
    if (isHeader && seenMoves) {
      games.push(current.join('\n'));
      current = [];
      seenMoves = false;
    }
    if (!isHeader && line.trim()) seenMoves = true;
    current.push(line);
  }
  if (current.join('').trim()) games.push(current.join('\n'));
  return games;
}

const TAG = /^\s*\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]/;
const TAG_LINE = /^\s*\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]\s*$/gm;

/**
 * Split a game into its tag pairs and movetext. Tolerates what hand-edited files contain:
 * several tags on one line ([Round "3"] [Date "…"]) and moves starting right after the last tag.
 */
export function splitHeaders(text: string): { headers: Record<string, string>; movetext: string } {
  const headers: Record<string, string> = {};
  let rest = text.replace(/^\uFEFF/, '');
  for (let m = rest.match(TAG); m; m = rest.match(TAG)) {
    headers[m[1]] = m[2].replace(/\\(.)/g, '$1');
    rest = rest.slice(m[0].length);
  }
  // stray tag lines further down (e.g. a second block of tags) are still tags, not moves
  rest = rest.replace(TAG_LINE, (_, k: string, v: string) => {
    if (!(k in headers)) headers[k] = v.replace(/\\(.)/g, '$1');
    return '';
  });
  return { headers, movetext: rest };
}

export function parseHeaders(text: string): Record<string, string> {
  return splitHeaders(text).headers;
}

type Token =
  | { t: 'move'; v: string }
  | { t: 'comment'; v: string }
  | { t: 'nag'; v: string }
  | { t: 'open' }
  | { t: 'close' }
  | { t: 'result'; v: string };

function tokenize(movetext: string): Token[] {
  const tokens: Token[] = [];
  const s = movetext;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '{') {
      const end = s.indexOf('}', i + 1);
      const raw = s.slice(i + 1, end === -1 ? s.length : end);
      // strip engine/clock commands such as [%clk 0:10:00] [%eval 0.3] [%cal Ge2e4]
      const v = raw.replace(/\[%[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
      if (v) tokens.push({ t: 'comment', v });
      i = end === -1 ? s.length : end + 1;
      continue;
    }
    if (c === ';') {
      const end = s.indexOf('\n', i);
      const v = s.slice(i + 1, end === -1 ? s.length : end).trim();
      if (v) tokens.push({ t: 'comment', v });
      i = end === -1 ? s.length : end;
      continue;
    }
    if (c === '(') { tokens.push({ t: 'open' }); i++; continue; }
    if (c === ')') { tokens.push({ t: 'close' }); i++; continue; }
    if (c === '$') {
      const m = s.slice(i).match(/^\$(\d+)/);
      if (m) { tokens.push({ t: 'nag', v: NAG_GLYPHS[m[1]] ?? `$${m[1]}` }); i += m[0].length; continue; }
    }
    // a word
    const m = s.slice(i).match(/^[^\s(){};]+/);
    if (!m) { i++; continue; }
    let w = m[0];
    i += w.length;
    if (RESULTS.has(w)) { tokens.push({ t: 'result', v: w === '½-½' ? '1/2-1/2' : w }); continue; }
    // move numbers: "12." "12..." "12…" possibly glued to the move ("12.e4")
    w = w.replace(/^\d+\s*(\.+|…)\s*/, '');
    if (!w || /^\d+$/.test(w)) continue;
    // trailing annotation glyphs "e4!?" → move + NAG
    const ann = w.match(/^(.*?)([!?]{1,2}|[+=∓±−]+[+−=]?)?$/);
    let san = ann?.[1] ?? w;
    let glyph = ann?.[2];
    if (glyph && /^[+#]$/.test(glyph)) { san += glyph; glyph = undefined; }
    if (glyph && /^\+$/.test(glyph)) { san += '+'; glyph = undefined; }
    san = san.replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O').replace(/e\.p\.$/, '');
    if (!san) continue;
    tokens.push({ t: 'move', v: san });
    if (glyph && /^[!?]{1,2}$/.test(glyph)) tokens.push({ t: 'nag', v: glyph });
  }
  return tokens;
}

/**
 * Many sites copy a FEN without the move counters (4 fields) or even only the piece placement.
 * Fill in the missing fields so such positions still display: side "w", no castling, no e.p., 0 1.
 */
export function completeFen(fen: string): string {
  const f = fen.trim().split(/\s+/);
  if (f.length >= 6 || !f[0] || !f[0].includes('/')) return fen.trim();
  const defaults = ['', 'w', '-', '-', '0', '1'];
  return defaults.map((d, i) => f[i] ?? d).join(' ');
}

/** Parse one game. Never throws – problems are reported in `error`. */
export function parseGame(text: string): ParsedGame {
  const { headers, movetext } = splitHeaders(text);
  let startFen = START_FEN;
  if (headers.FEN) headers.FEN = completeFen(headers.FEN);
  if (headers.FEN) {
    try {
      new Chess(headers.FEN);
      startFen = headers.FEN;
    } catch {
      /* invalid FEN – fall back to the start position and report below */
    }
  }
  const [, turn, , , , fullmove] = startFen.split(' ');
  let id = 0;
  const root: MoveNode = {
    id: id++, san: '', from: '', to: '', fen: startFen, color: '',
    ply: (Number(fullmove || 1) - 1) * 2 + (turn === 'b' ? 1 : 0),
    moveNumber: Number(fullmove || 1), nags: [], check: false, parent: null, children: [],
  };
  const nodes: MoveNode[] = [root];
  const game: ParsedGame = { headers, root, nodes, result: headers.Result ?? '*' };
  if (headers.FEN && startFen !== headers.FEN) game.error = `Neispravan FEN: ${headers.FEN}`;

  let current = root;
  const stack: MoveNode[] = [];
  let pendingBefore: string | undefined;
  let skipDepth = 0; // inside a variation whose start move was illegal → ignore until it closes
  let lastWasOpen = false;
  let mainBroken = false;

  for (const tok of tokenize(movetext)) {
    if (skipDepth) {
      if (tok.t === 'open') skipDepth++;
      if (tok.t === 'close') skipDepth--;
      continue;
    }
    switch (tok.t) {
      case 'comment':
        if (lastWasOpen || (current === root && root.children.length === 0 && stack.length > 0)) {
          pendingBefore = pendingBefore ? `${pendingBefore} ${tok.v}` : tok.v;
        } else {
          current.comment = current.comment ? `${current.comment} ${tok.v}` : tok.v;
        }
        break;
      case 'nag':
        if (current !== root) current.nags.push(tok.v);
        break;
      case 'open':
        stack.push(current);
        current = current.parent ?? current; // a variation replaces the move just played
        lastWasOpen = true;
        continue;
      case 'close':
        current = stack.pop() ?? current;
        pendingBefore = undefined;
        break;
      case 'result':
        if (stack.length === 0) game.result = tok.v;
        break;
      case 'move': {
        if (mainBroken && stack.length === 0) break; // main line already broken
        let played;
        try {
          const chess = new Chess(current.fen);
          played = chess.move(tok.v, { strict: false });
        } catch {
          played = null;
        }
        if (!played) {
          const where = current === root ? 'na početku' : `nakon ${moveLabel(current)}`;
          const msg = `Neispravan potez „${tok.v}” ${where}`;
          if (stack.length === 0) {
            game.error = msg;
            mainBroken = true;
          } else {
            // drop the rest of this variation, keep everything else
            game.error ??= `${msg} (u varijanti)`;
            skipDepth = 1;
            current = stack.pop()!;
          }
          break;
        }
        const ply = current.ply + 1;
        const node: MoveNode = {
          id: id++,
          san: played.san,
          from: played.from,
          to: played.to,
          fen: played.after,
          ply,
          color: played.color,
          moveNumber: Math.ceil(ply / 2),
          nags: [],
          check: /[+#]$/.test(played.san),
          commentBefore: pendingBefore,
          parent: current,
          children: [],
        };
        pendingBefore = undefined;
        current.children.push(node);
        nodes.push(node);
        current = node;
        break;
      }
    }
    lastWasOpen = false;
  }
  return game;
}

export function parsePgn(text: string): ParsedGame[] {
  return splitGames(text).map(parseGame);
}

export function moveLabel(n: MoveNode): string {
  if (!n.san) return '';
  return `${n.moveNumber}${n.color === 'w' ? '.' : '...'} ${n.san}`;
}

export function mainline(root: MoveNode): MoveNode[] {
  const out: MoveNode[] = [];
  for (let n = root.children[0]; n; n = n.children[0]) out.push(n);
  return out;
}

/** Headers that are just placeholders in many PGN exports. */
export const isUnknown = (v?: string) => !v || /^\?+$/.test(v) || v === '????.??.??' || v === '-';

export function formatPgnDate(d?: string): string {
  if (isUnknown(d)) return '';
  const [y, m, day] = d!.split('.');
  if (isUnknown(m)) return y;
  if (isUnknown(day)) return `${Number(m)}. ${y}.`;
  return `${Number(day)}. ${Number(m)}. ${y}.`;
}
