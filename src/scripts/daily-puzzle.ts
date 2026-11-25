/**
 * "Zadatak dana" – the Lichess daily puzzle, solved on our own board.
 *
 * Data: the official public Lichess API, GET https://lichess.org/api/puzzle/daily
 * (no key, CORS allowed; Lichess puzzles are published under CC0). Fetched in the visitor's
 * browser, so the puzzle changes every day without rebuilding the site. One request per visit
 * at most: the answer is kept in sessionStorage for the rest of the day.
 *
 * Board: cm-chessboard + chess.js, the same libraries as the article game viewer.
 * If the API cannot be reached, the static fallback card (link to Lichess) simply stays visible.
 */
import { Chessboard, COLOR, BORDER_TYPE, INPUT_EVENT_TYPE } from 'cm-chessboard/src/Chessboard.js';
import { Markers } from 'cm-chessboard/src/extensions/markers/Markers.js';
import 'cm-chessboard/assets/chessboard.css';
import 'cm-chessboard/assets/extensions/markers/markers.css';
import { Chess, type Square } from 'chess.js';
import { parseDaily, checkMove, type DailyPuzzle } from '../lib/lichess-puzzle';

const API = 'https://lichess.org/api/puzzle/daily';
const LASTMOVE = { class: 'marker-lastmove', slice: 'markerSquare' };
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC' }).format(new Date());

async function loadPuzzle(): Promise<DailyPuzzle> {
  const key = `odra-daily-puzzle-${today()}`;
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) return JSON.parse(cached);
  } catch { /* storage unavailable */ }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(API, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const puzzle = parseDaily(await res.json());
    try { sessionStorage.setItem(key, JSON.stringify(puzzle)); } catch { /* ignore */ }
    return puzzle;
  } finally {
    clearTimeout(timer);
  }
}

class PuzzleBoard {
  private puzzle!: DailyPuzzle;
  private chess!: Chess;
  private board: any;
  private step = 0;
  private busy = false;
  private el: Record<string, HTMLElement> = {};

  constructor(private root: HTMLElement) {}

  async start() {
    const q = (n: string) => this.root.querySelector<HTMLElement>(`[data-dp="${n}"]`)!;
    for (const n of ['board', 'status', 'turn', 'retry', 'solution', 'open', 'live', 'fallback']) this.el[n] = q(n);
    try {
      this.puzzle = await loadPuzzle();
    } catch {
      this.root.dataset.state = 'error';
      return; // fallback card stays visible
    }
    const p = this.puzzle;
    const color = p.fen.split(' ')[1] === 'b' ? 'b' : 'w';
    (this.el.open as HTMLAnchorElement).href = `https://lichess.org/training/${encodeURIComponent(p.id)}`;
    this.el.turn.textContent = color === 'w' ? 'Bijeli na potezu' : 'Crni na potezu';
    this.board = new Chessboard(this.el.board, {
      position: p.fen,
      orientation: color === 'w' ? COLOR.white : COLOR.black,
      assetsUrl: this.root.dataset.assets,
      style: { cssClass: 'odra', borderType: BORDER_TYPE.frame, showCoordinates: true, animationDuration: REDUCED ? 0 : 220 },
      extensions: [{ class: Markers, props: { autoMarkers: null } }],
    });
    this.root.dataset.state = 'ready';
    this.el.retry.addEventListener('click', () => this.reset());
    this.el.solution.addEventListener('click', () => this.showSolution());
    this.reset();
  }

  private say(text: string, tone: 'info' | 'good' | 'bad' | 'done' = 'info') {
    this.el.status.textContent = text;
    this.el.status.dataset.tone = tone;
  }

  private mark(uci?: string) {
    this.board.removeMarkers();
    if (uci) {
      this.board.addMarker(LASTMOVE, uci.slice(0, 2));
      this.board.addMarker(LASTMOVE, uci.slice(2, 4));
    }
  }

  reset() {
    this.chess = new Chess(this.puzzle.fen);
    this.step = 0;
    this.busy = false;
    this.board.setPosition(this.puzzle.fen, false);
    this.mark(this.puzzle.lastMove);
    this.root.dataset.result = '';
    this.say('Pronađite najbolji potez – povucite ili kliknite figuru.');
    this.enableInput();
  }

  private enableInput() {
    const color = this.chess.turn() === 'w' ? COLOR.white : COLOR.black;
    this.board.disableMoveInput();
    this.board.enableMoveInput((e: any) => {
      if (e.type === INPUT_EVENT_TYPE.moveInputStarted) {
        const piece = this.chess.get(e.squareFrom as Square);
        return !this.busy && !!piece && piece.color === this.chess.turn();
      }
      if (e.type === INPUT_EVENT_TYPE.validateMoveInput) return this.onMove(e.squareFrom, e.squareTo);
      return true;
    }, color);
  }

  private apply(uci: string) {
    return this.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? 'q' });
  }

  private onMove(from: string, to: string): boolean {
    const expected = this.puzzle.solution[this.step];
    // promotion: use the piece from the solution when the squares match, otherwise a queen
    const promo = expected.slice(0, 4) === from + to ? expected[4] ?? '' : '';
    const legal = this.chess.moves({ verbose: true }).find((m) => m.from === from && m.to === to);
    if (!legal) return false;
    const uci = from + to + (legal.promotion ? promo || 'q' : '');
    const verdict = checkMove(this.chess.fen(), uci, expected);
    if (verdict === 'wrong') {
      this.busy = true;
      this.root.dataset.result = 'wrong';
      this.say('Nije točno. Pokušajte ponovno.', 'bad');
      // show the wrong move briefly, then take it back
      const before = this.chess.fen();
      const wrong = new Chess(before);
      wrong.move({ from, to, promotion: uci[4] ?? 'q' });
      setTimeout(() => this.board.setPosition(wrong.fen(), !REDUCED), 0);
      setTimeout(() => {
        this.board.setPosition(before, !REDUCED);
        this.busy = false;
      }, 900);
      return false;
    }
    this.apply(uci);
    setTimeout(() => this.board.setPosition(this.chess.fen(), false), 0); // castling, en passant, promotion
    this.mark(uci);
    this.step++;
    if (verdict === 'mate' || this.step >= this.puzzle.solution.length) return this.solved(), true;
    this.say('Točno! Nastavite…', 'good');
    this.busy = true;
    const reply = this.puzzle.solution[this.step];
    setTimeout(() => {
      this.apply(reply);
      this.board.setPosition(this.chess.fen(), !REDUCED);
      this.mark(reply);
      this.step++;
      this.busy = false;
      this.say('Vaš potez.', 'info');
    }, REDUCED ? 150 : 600);
    return true;
  }

  private solved() {
    this.board.disableMoveInput();
    this.root.dataset.result = 'solved';
    this.say('Riješeno! Bravo.', 'done');
  }

  private async showSolution() {
    this.reset();
    this.board.disableMoveInput();
    this.busy = true;
    this.say('Rješenje…');
    for (const uci of this.puzzle.solution) {
      await new Promise((r) => setTimeout(r, REDUCED ? 200 : 750));
      this.apply(uci);
      this.board.setPosition(this.chess.fen(), !REDUCED);
      this.mark(uci);
    }
    this.root.dataset.result = 'shown';
    this.say('Ovo je rješenje. Kliknite „Pokušaj ponovno” i odigrajte ga sami.', 'info');
  }
}

export function mountDailyPuzzle(root: HTMLElement) {
  new PuzzleBoard(root).start();
}
