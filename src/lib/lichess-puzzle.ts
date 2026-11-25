/** Lichess daily puzzle: parsing the public API answer and checking moves (pure functions, unit-tested). */
import { Chess } from 'chess.js';

export interface DailyPuzzle {
  id: string;
  rating?: number;
  themes: string[];
  /** position the player has to solve (after the opponent's last move) */
  fen: string;
  lastMove?: string;
  /** UCI moves: player, opponent, player, … */
  solution: string[];
  gameUrl?: string;
}

/** Normalises the API answer. Older answers have no `fen`: then the position is replayed from the game PGN. */
export function parseDaily(json: any): DailyPuzzle {
  const p = json?.puzzle;
  if (!p?.id || !Array.isArray(p.solution) || !p.solution.length) throw new Error('unexpected puzzle data');
  let fen: string | undefined = p.fen;
  let lastMove: string | undefined = p.lastMove;
  if (!fen) {
    const chess = new Chess();
    const sans = String(json.game?.pgn ?? '').split(/\s+/).filter(Boolean);
    // initialPly = index of the opponent's move that sets up the puzzle
    const upto = Number(p.initialPly) + 1;
    let last;
    for (const san of sans.slice(0, upto)) last = chess.move(san);
    if (!last) throw new Error('cannot replay puzzle game');
    fen = chess.fen();
    lastMove = last.from + last.to;
  }
  return {
    id: String(p.id),
    rating: typeof p.rating === 'number' ? p.rating : undefined,
    themes: Array.isArray(p.themes) ? p.themes.map(String) : [],
    fen,
    lastMove,
    solution: p.solution.map(String),
    gameUrl: json.game?.id ? `https://lichess.org/${json.game.id}` : undefined,
  };
}

/**
 * Checks a player move against the solution at step `ply`.
 * Like Lichess, any move that gives checkmate is accepted even if it is not the listed one.
 */
export function checkMove(fen: string, uci: string, expected: string): 'correct' | 'mate' | 'wrong' {
  if (uci.slice(0, 4) === expected.slice(0, 4)) return 'correct';
  const chess = new Chess(fen);
  try {
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? 'q' });
  } catch {
    return 'wrong';
  }
  return chess.isCheckmate() ? 'mate' : 'wrong';
}

