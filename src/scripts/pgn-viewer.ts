/**
 * Interactive chess game viewer (client side).
 *
 * Every <div data-pgn-viewer data-pgn="…"> produced by remark-pgn.mjs becomes a board with
 * a move list, navigation, autoplay, flip and PGN download. Several viewers per page are
 * independent of each other. The board is only created when the viewer scrolls near the
 * viewport, so long tournament reports with many games stay fast.
 *
 * Board: cm-chessboard (MIT) · moves: chess.js (BSD-2) via ../lib/pgn/parse.ts
 */
import { Chessboard, COLOR, BORDER_TYPE } from 'cm-chessboard/src/Chessboard.js';
import { Markers } from 'cm-chessboard/src/extensions/markers/Markers.js';
import 'cm-chessboard/assets/chessboard.css';
import 'cm-chessboard/assets/extensions/markers/markers.css';
import { parsePgn, formatPgnDate, isUnknown, type MoveNode, type ParsedGame } from '../lib/pgn/parse';

type Lang = 'hr';
const T = {
  hr: {
    viewer: 'Prikaz šahovske partije', nav: 'Kretanje kroz partiju', first: 'Početna pozicija', prev: 'Prethodni potez', next: 'Sljedeći potez',
    last: 'Zadnji potez', play: 'Automatska reprodukcija', pause: 'Zaustavi reprodukciju', flip: 'Okreni ploču',
    speed: 'Brzina reprodukcije', game: 'Odaberite partiju', moves: 'Popis poteza', download: 'Preuzmi PGN',
    start: 'Početna pozicija', round: 'kolo', white: 'Bijeli', black: 'Crni', illegal: 'Greška u zapisu partije',
    hint: '← → potezi · razmaknica reprodukcija · F okreni', hintTouch: 'Povucite ploču ulijevo ili udesno za sljedeći ili prethodni potez', noMoves: 'Pozicija', seconds: 's', info: 'Podaci o partiji', event: 'Natjecanje', roundLabel: 'Kolo', site: 'Lokacija', date: 'Datum', opening: 'Otvaranje',
  },
} as const;

const SPEEDS = [0.5, 1, 1.5, 2, 3, 5];
const REDUCED_MOTION = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const FIGURINE: Record<string, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' };
const LASTMOVE = { class: 'marker-lastmove', slice: 'markerSquare' };
const CHECK = { class: 'marker-check', slice: 'markerSquare' };

const esc = (s = '') =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** "Nxe5+" → "♘xe5+" (U+FE0E keeps the symbol as text instead of an emoji on phones) */
const VS = '\uFE0E';
const fig = (p: string) => `<span class="pgnv-fig">${FIGURINE[p]}${VS}</span>`;
/** HTML version for the move list (bigger piece symbols) */
const figurine = (san: string) => san.replace(/^[KQRBN]/, fig).replace(/=([QRBN])/, (_, p) => `=${fig(p)}`);
/** plain-text version for the status line */
const figurineText = (san: string) => san.replace(/^[KQRBN]/, (p) => FIGURINE[p] + VS).replace(/=([QRBN])/, (_, p) => `=${FIGURINE[p]}${VS}`);

const icons = {
  first: '<path d="M18 6 10 12l8 6V6zM6 6h2v12H6z"/>',
  prev: '<path d="M16 6 8 12l8 6V6z"/>',
  next: '<path d="m8 6 8 6-8 6V6z"/>',
  last: '<path d="M6 6l8 6-8 6V6zm10 0h2v12h-2z"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  pause: '<path d="M7 5h4v14H7zm6 0h4v14h-4z"/>',
  flip: '<path d="M7 4v13H4l4.5 4L13 17h-3V4H7zm10 16V7h3l-4.5-4L11 7h3v13h3z"/>',
  download: '<path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};
const svg = (d: string) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">${d}</svg>`;

export class GameViewer {
  private games: ParsedGame[];
  private game!: ParsedGame;
  private current!: MoveNode;
  private byId = new Map<number, MoveNode>();
  private board: any = null;
  private orientation: 'w' | 'b' = 'w';
  private timer = 0;
  private playing = false;
  private speed = 1;
  private t: (typeof T)[Lang];
  private el: Record<string, HTMLElement> = {};

  constructor(
    private root: HTMLElement,
    private pgn: string,
    private lang: Lang,
    private assets: string,
  ) {
    this.t = T[lang];
    this.games = parsePgn(pgn);
    this.render();
    this.load(0);
  }

  /* ---------------- DOM ---------------- */
  private render() {
    const t = this.t;
    const multi = this.games.length > 1;
    const label = this.root.dataset.title;
    this.root.innerHTML = `
      <div class="pgnv" tabindex="0" role="group" aria-label="${esc(label || t.viewer)}" aria-describedby="${this.uid('hint')}">
        <div class="pgnv-head">
          ${label ? `<p class="pgnv-label">${esc(label)}</p>` : ''}
          ${multi ? `<label class="pgnv-select-wrap"><span class="sr-only">${t.game}</span><select class="pgnv-select" data-el="select">${this.games
            .map((g, i) => `<option value="${i}">${i + 1}. ${esc(this.playerName(g, 'White'))} – ${esc(this.playerName(g, 'Black'))}${!isUnknown(g.headers.Result) ? ` (${esc(g.headers.Result.replace('1/2-1/2', '½–½'))})` : ''}</option>`)
            .join('')}</select></label>` : ''}
        </div>
        <div class="pgnv-body">
          <div class="pgnv-main">
            <div class="pgnv-player" data-el="top"></div>
            <div class="pgnv-board" data-el="board"></div>
            <div class="pgnv-player" data-el="bottom"></div>
            <div class="pgnv-controls">
              <div class="pgnv-nav" role="group" aria-label="${t.nav}">
                <button type="button" data-act="first" aria-label="${t.first}" title="${t.first}">${svg(icons.first)}</button>
                <button type="button" data-act="prev" aria-label="${t.prev}" title="${t.prev}">${svg(icons.prev)}</button>
                <button type="button" data-act="play" class="pgnv-play" aria-label="${t.play}" title="${t.play}" aria-pressed="false" data-el="play">${svg(icons.play)}</button>
                <button type="button" data-act="next" aria-label="${t.next}" title="${t.next}">${svg(icons.next)}</button>
                <button type="button" data-act="last" aria-label="${t.last}" title="${t.last}">${svg(icons.last)}</button>
              </div>
              <div class="pgnv-tools">
                <label class="pgnv-speed" title="${t.speed}"><span class="sr-only">${t.speed}</span>
                  <select data-el="speed">${SPEEDS.map((s) => `<option value="${s}"${s === this.speed ? ' selected' : ''}>${String(s).replace('.', ',')} ${t.seconds}</option>`).join('')}</select>
                </label>
                <button type="button" data-act="flip" aria-label="${t.flip}" title="${t.flip}">${svg(icons.flip)}</button>
                <button type="button" data-act="download" aria-label="${t.download}" title="${t.download}">${svg(icons.download)}</button>
              </div>
            </div>
            <p class="pgnv-note" data-el="note" aria-live="polite"></p>
            <p class="pgnv-hint" id="${this.uid('hint')}"><span class="pgnv-hint-keys">${t.hint}</span><span class="pgnv-hint-touch">${t.hintTouch}</span></p>
          </div>
          <div class="pgnv-side">
            <div class="pgnv-moves" data-el="moves" role="group" aria-label="${t.moves}"></div>
            <dl class="pgnv-info" data-el="meta" aria-label="${t.info}"></dl>
          </div>
        </div>
        <p class="pgnv-error" data-el="error" role="alert" hidden></p>
      </div>`;
    this.root.querySelectorAll<HTMLElement>('[data-el]').forEach((e) => (this.el[e.dataset.el!] = e));

    const box = this.root.querySelector<HTMLElement>('.pgnv')!;
    box.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act) return this.action(act);
      const mv = target.closest<HTMLElement>('[data-id]');
      if (mv) {
        this.stop();
        this.goTo(this.byId.get(Number(mv.dataset.id))!);
      }
    });
    box.addEventListener('keydown', (e) => this.onKey(e));
    this.el.select?.addEventListener('change', () => {
      this.stop();
      this.load(Number((this.el.select as HTMLSelectElement).value));
    });
    this.el.speed.addEventListener('change', () => {
      this.speed = Number((this.el.speed as HTMLSelectElement).value);
      if (this.playing) { clearTimeout(this.timer); this.schedule(); }
    });
  }

  private uid(s: string) {
    this.root.dataset.uid ??= Math.random().toString(36).slice(2, 8);
    return `pgnv-${this.root.dataset.uid}-${s}`;
  }

  private playerName(g: ParsedGame, side: 'White' | 'Black') {
    const v = g.headers[side];
    return isUnknown(v) ? (side === 'White' ? this.t.white : this.t.black) : v;
  }

  /* ---------------- game ---------------- */
  private load(i: number) {
    this.game = this.games[i];
    this.byId = new Map(this.game.nodes.map((n) => [n.id, n]));
    const h = this.game.headers;
    // match information card under the move list: only the fields the PGN actually contains
    const known = (v?: string) => (v && !isUnknown(v) ? v.trim() : '');
    // "Site" often holds the club's web address instead of a place – that is not a location
    const site = known(h.Site);
    const place = /^(https?:\/\/)?(www[.,])?[\w-]+\.(com|hr|org|net)\b/i.test(site) ? '' : site;
    const round = known(h.Round);
    const meta: [string, string, string][] = [
      ['event', this.t.event, known(h.Event)],
      ['round', this.t.roundLabel, round ? (/^\d+$/.test(round) ? `${round}.` : round) : ''],
      ['site', this.t.site, place],
      ['date', this.t.date, formatPgnDate(h.Date)],
      ['opening', this.t.opening, h.Opening ? (h.ECO ? `${h.ECO} ${h.Opening}` : h.Opening) : known(h.ECO)],
    ].filter((r): r is [string, string, string] => !!r[2]) as [string, string, string][];
    this.el.meta.innerHTML = meta
      .map(([k, label, v]) => `<div class="pgnv-info-row" data-k="${k}"><dt>${label}</dt><dd>${esc(v)}</dd></div>`)
      .join('');
    this.el.meta.hidden = meta.length === 0;
    this.el.error.hidden = !this.game.error;
    if (this.game.error)
      this.el.error.textContent = `⚠ ${this.t.illegal}: ${this.game.error}`;
    this.el.moves.innerHTML = this.renderMoves();
    this.orientation = /^(b|black)$/i.test(this.root.dataset.orientation ?? '') ? 'b' : 'w';
    this.renderPlayers();
    if (this.board) this.board.setOrientation(this.orientation === 'w' ? COLOR.white : COLOR.black);
    this.goTo(this.game.root, false);
  }

  private renderPlayers() {
    const h = this.game.headers;
    const res = this.game.result;
    const score = (side: 'w' | 'b') =>
      res === '1-0' ? (side === 'w' ? '1' : '0') : res === '0-1' ? (side === 'w' ? '0' : '1') : res === '1/2-1/2' ? '½' : '';
    const bar = (side: 'w' | 'b') => {
      const key = side === 'w' ? 'White' : 'Black';
      const elo = h[`${key}Elo`];
      const title = h[`${key}Title`];
      return `<span class="pgnv-dot ${side === 'w' ? 'is-white' : 'is-black'}" aria-hidden="true"></span>
        <span class="pgnv-name">${title && !isUnknown(title) ? `<abbr class="pgnv-title">${esc(title)}</abbr> ` : ''}${esc(this.playerName(this.game, key))}</span>
        ${elo && !isUnknown(elo) && elo !== '0' ? `<span class="pgnv-elo">${esc(elo)}</span>` : ''}
        ${score(side) ? `<span class="pgnv-score">${score(side)}</span>` : ''}`;
    };
    // a bare position (diagram) without player names: no name bars
    const diagram = isUnknown(h.White) && isUnknown(h.Black) && !this.game.root.children.length;
    this.el.top.hidden = this.el.bottom.hidden = diagram;
    if (diagram) return;
    const bottom = this.orientation;
    this.el.bottom.innerHTML = bar(bottom);
    this.el.top.innerHTML = bar(bottom === 'w' ? 'b' : 'w');
  }

  /** Main line as a two-column table, comments and variations as full-width rows. */
  private renderMoves(): string {
    const root = this.game.root;
    let out = root.comment ? `<div class="pgnv-row pgnv-intro">${esc(root.comment)}</div>` : '';
    let col = 0; // 0 = start of row, 1 = white placed, waiting for black
    for (let n = root.children[0]; n; n = n.children[0]) {
      const interrupt = this.interrupt(n);
      if (n.color === 'w') {
        out += `<span class="pgnv-num">${n.moveNumber}.</span>${this.moveBtn(n, 'pgnv-cell')}`;
        col = 1;
        if (interrupt) {
          out += `<span class="pgnv-cell pgnv-empty">…</span>${interrupt}`;
          col = 2;
        }
      } else {
        if (col !== 1) out += `<span class="pgnv-num">${n.moveNumber}.</span><span class="pgnv-cell pgnv-empty">…</span>`;
        out += this.moveBtn(n, 'pgnv-cell');
        if (interrupt) out += interrupt;
        col = 0;
      }
    }
    if (col === 1) out += `<span class="pgnv-cell pgnv-empty"></span>`;
    if (!isUnknown(this.game.result) && this.game.result !== '*')
      out += `<div class="pgnv-row pgnv-result">${esc(this.game.result.replace('1/2-1/2', '½–½'))}</div>`;
    if (!root.children.length && !root.comment) out = `<div class="pgnv-row pgnv-intro">${this.t.noMoves}</div>`;
    return `<div class="pgnv-grid">${out}</div>`;
  }

  /** comment after a main-line move + alternatives to it */
  private interrupt(n: MoveNode): string {
    const alts = n.parent && n.parent.children[0] === n ? n.parent.children.slice(1) : [];
    if (!n.comment && !alts.length && !n.commentBefore) return '';
    return `<div class="pgnv-row">${n.comment ? `<p class="pgnv-c">${esc(n.comment)}</p>` : ''}${alts
      .map((a) => `<p class="pgnv-var">${this.renderLine(a)}</p>`)
      .join('')}</div>`;
  }

  /** Inline notation for a variation, with nested sub-variations in parentheses. */
  private renderLine(start: MoveNode): string {
    let s = '';
    let needNumber = true;
    for (let n: MoveNode | undefined = start; n; n = n.children[0]) {
      if (n.commentBefore) s += `<span class="pgnv-c">${esc(n.commentBefore)}</span> `;
      if (n.color === 'w') s += `${n.moveNumber}.&nbsp;`;
      else if (needNumber) s += `${n.moveNumber}…&nbsp;`;
      s += this.moveBtn(n, 'pgnv-inline') + ' ';
      needNumber = false;
      if (n.comment) { s += `<span class="pgnv-c">${esc(n.comment)}</span> `; needNumber = true; }
      if (n !== start && n.parent && n.parent.children[0] === n && n.parent.children.length > 1) {
        for (const alt of n.parent.children.slice(1)) s += `<span class="pgnv-sub">(${this.renderLine(alt).trim()})</span> `;
        needNumber = true;
      }
    }
    return s.trim();
  }

  private moveBtn(n: MoveNode, cls: string) {
    return `<button type="button" class="pgnv-mv ${cls}" data-id="${n.id}">${figurine(esc(n.san))}${n.nags.length ? `<span class="pgnv-nag">${esc(n.nags.join(''))}</span>` : ''}</button>`;
  }

  /* ---------------- board ---------------- */
  private ensureBoard() {
    if (this.board) return;
    this.board = new Chessboard(this.el.board, {
      position: this.current?.fen ?? this.game.root.fen,
      orientation: this.orientation === 'w' ? COLOR.white : COLOR.black,
      assetsUrl: this.assets,
      style: { cssClass: 'odra', borderType: BORDER_TYPE.frame, showCoordinates: true, animationDuration: REDUCED_MOTION ? 0 : 220 },
      extensions: [{ class: Markers, props: { autoMarkers: null } }],
    });
    this.drawMarkers();
  }

  private drawMarkers() {
    if (!this.board) return;
    this.board.removeMarkers();
    const n = this.current;
    if (n.from) {
      this.board.addMarker(LASTMOVE, n.from);
      this.board.addMarker(LASTMOVE, n.to);
    }
    if (n.check) {
      const king = kingSquare(n.fen);
      if (king) this.board.addMarker(CHECK, king);
    }
  }

  /* ---------------- navigation ---------------- */
  goTo(n: MoveNode, animate = true) {
    if (!n) return;
    this.current = n;
    if (this.board) {
      this.board.setPosition(n.fen, animate);
      this.drawMarkers();
    }
    this.root.querySelectorAll('.pgnv-mv.is-current').forEach((b) => { b.classList.remove('is-current'); b.removeAttribute('aria-current'); });
    const btn = this.root.querySelector<HTMLElement>(`.pgnv-mv[data-id="${n.id}"]`);
    if (btn) {
      btn.classList.add('is-current');
      btn.setAttribute('aria-current', 'step');
      // keep the current move visible inside the move list without scrolling the page
      const list = this.el.moves;
      const top = btn.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top + btn.offsetHeight > list.scrollTop + list.clientHeight)
        list.scrollTo({ top: top - list.clientHeight / 2, behavior: animate && !REDUCED_MOTION ? 'smooth' : 'auto' });
    } else if (n === this.game.root) this.el.moves.scrollTo({ top: 0 });
    const label = n.san ? `${n.moveNumber}${n.color === 'w' ? '.' : '…'} ${figurineText(n.san)}${n.nags.join('')}` : n === this.game.root && !n.children.length ? this.t.noMoves : this.t.start;
    const comment = [n.commentBefore, n.comment].filter(Boolean).join(' ');
    this.el.note.innerHTML = `<strong>${esc(label)}</strong>${comment ? ` — ${esc(comment)}` : ''}`;
  }

  private lastOfLine(n: MoveNode) {
    while (n.children[0]) n = n.children[0];
    return n;
  }

  private action(act: string) {
    if (act === 'play') return this.playing ? this.stop() : this.play();
    if (act === 'flip') return this.flip();
    if (act === 'download') return this.download();
    this.stop();
    const c = this.current;
    if (act === 'first') this.goTo(this.game.root);
    if (act === 'prev' && c.parent) this.goTo(c.parent);
    if (act === 'next' && c.children[0]) this.goTo(c.children[0]);
    if (act === 'last') this.goTo(this.lastOfLine(c));
  }

  private onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'SELECT' || e.altKey || e.ctrlKey || e.metaKey) return;
    const map: Record<string, string> = { ArrowLeft: 'prev', ArrowRight: 'next', Home: 'first', End: 'last', ArrowUp: 'first', ArrowDown: 'last' };
    if (map[e.key]) { e.preventDefault(); this.action(map[e.key]); return; }
    if ((e.key === ' ' || e.key === 'k') && tag !== 'BUTTON') { e.preventDefault(); this.action('play'); }
    if (e.key === 'f' || e.key === 'F') this.action('flip');
  }

  private play() {
    if (!this.current.children[0]) this.goTo(this.game.root, false);
    this.playing = true;
    this.el.play.innerHTML = svg(icons.pause);
    this.el.play.setAttribute('aria-pressed', 'true');
    this.el.play.setAttribute('aria-label', this.t.pause);
    this.el.play.title = this.t.pause;
    this.el.note.setAttribute('aria-live', 'off');
    this.schedule();
  }
  private schedule() {
    this.timer = window.setTimeout(() => {
      const next = this.current.children[0];
      if (!next) return this.stop();
      this.goTo(next);
      if (next.children[0]) this.schedule();
      else this.stop();
    }, this.speed * 1000);
  }
  private stop() {
    if (!this.playing) return;
    clearTimeout(this.timer);
    this.playing = false;
    this.el.play.innerHTML = svg(icons.play);
    this.el.play.setAttribute('aria-pressed', 'false');
    this.el.play.setAttribute('aria-label', this.t.play);
    this.el.play.title = this.t.play;
    this.el.note.setAttribute('aria-live', 'polite');
  }

  private flip() {
    this.orientation = this.orientation === 'w' ? 'b' : 'w';
    // not animated: a second tap during the rotation animation left board and labels out of sync
    this.board?.setOrientation(this.orientation === 'w' ? COLOR.white : COLOR.black, false);
    this.board?.setPosition(this.current.fen, false);
    this.drawMarkers();
    this.renderPlayers();
  }

  private download() {
    const h = this.game.headers;
    const name = [h.White, h.Black].filter((v) => !isUnknown(v)).join('-').replace(/[^\p{L}\p{N}]+/gu, '_') || 'partija';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([this.pgn], { type: 'application/x-chess-pgn' }));
    a.download = `${name}.pgn`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /** Horizontal swipe on the board: left = next move, right = previous. Vertical scrolling stays native. */
  private bindSwipe() {
    const el = this.el.board;
    let x0 = 0, y0 = 0, t0 = 0, tracking = false;
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) { tracking = false; return; }
      tracking = true; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
    }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - t0 > 800) return;
      this.action(dx < 0 ? 'next' : 'prev');
    }, { passive: true });
    el.addEventListener('touchcancel', () => (tracking = false), { passive: true });
  }

  /** create the board lazily */
  activate() {
    if (this.board) return;
    this.ensureBoard();
    this.bindSwipe();
  }
}

function kingSquare(fen: string): string | null {
  const [placement, turn] = fen.split(' ');
  const king = turn === 'w' ? 'K' : 'k';
  const ranks = placement.split('/');
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of ranks[r]) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        if (ch === king) return `${'abcdefgh'[f]}${8 - r}`;
        f++;
      }
    }
  }
  return null;
}

export function mountAll() {
  const els = [...document.querySelectorAll<HTMLElement>('[data-pgn-viewer]:not([data-ready])')];
  const viewers = new Map<Element, GameViewer>();
  for (const el of els) {
    el.dataset.ready = '';
    try {
      const v = new GameViewer(el, el.dataset.pgn ?? '', (el.dataset.lang as Lang) ?? 'hr', el.dataset.assets ?? '/vendor/cm-chessboard/');
      viewers.set(el, v);
    } catch (err) {
      console.error('PGN viewer failed', err);
      el.classList.add('pgnv-failed'); // the plain-text fallback stays visible
    }
  }
  if (!('IntersectionObserver' in window)) return viewers.forEach((v) => v.activate());
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        viewers.get(e.target)?.activate();
        io.unobserve(e.target);
      }
    },
    { rootMargin: '400px 0px' },
  );
  viewers.forEach((_, el) => io.observe(el));
}
