/**
 * Ambient layer controller (~1 KB). Works together with styles/ambient.css.
 *  - pauses every animation of a decorative section while it is off-screen, and all of them
 *    while the browser tab is hidden (saves battery, no work the visitor cannot see);
 *  - on devices with a precise pointer (mouse/trackpad) feeds the cursor position to
 *    [data-pointer] sections (gold glow, board glint, piece parallax) and to .card-light cards;
 *  - shows a thin gold progress bar when an internal link is followed.
 * Touch devices and reduced-motion visitors get none of the pointer work.
 */
const root = document.documentElement;

export function initAmbient() {
  const layers = document.querySelectorAll<HTMLElement>('[data-ambient]');

  // 1. pause off-screen sections
  if (layers.length) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) (e.target as HTMLElement).toggleAttribute('data-paused', !e.isIntersecting);
    }, { rootMargin: '80px' });
    layers.forEach((el) => io.observe(el));
  }
  // 2. pause everything in a background tab
  const vis = () => root.classList.toggle('is-hidden', document.visibilityState === 'hidden');
  document.addEventListener('visibilitychange', vis);
  vis();

  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finePointer) {
    // 3. cursor-reactive sections: one rAF-throttled update per frame at most
    document.querySelectorAll<HTMLElement>('[data-pointer]').forEach((layer) => {
      const host = layer.parentElement!;
      let frame = 0;
      let x = 0, y = 0;
      const apply = () => {
        frame = 0;
        const r = host.getBoundingClientRect();
        const lx = x - r.left, ly = y - r.top;
        layer.style.setProperty('--mx', `${lx}px`);
        layer.style.setProperty('--my', `${ly}px`);
        layer.style.setProperty('--gx', `${lx}px`);
        layer.style.setProperty('--gy', `${ly}px`);
        layer.style.setProperty('--px', ((lx / r.width) * 2 - 1).toFixed(3));
        layer.style.setProperty('--py', ((ly / r.height) * 2 - 1).toFixed(3));
      };
      host.addEventListener('pointermove', (e) => {
        x = e.clientX; y = e.clientY;
        layer.classList.add('is-tracking');
        if (!frame) frame = requestAnimationFrame(apply);
      }, { passive: true });
      host.addEventListener('pointerleave', () => {
        layer.classList.remove('is-tracking');
        layer.style.setProperty('--px', '0');
        layer.style.setProperty('--py', '0');
      });
    });

    // 4. cards: a soft light follows the cursor across the card
    let card: HTMLElement | null = null, cx = 0, cy = 0, cf = 0;
    document.addEventListener('pointermove', (e) => {
      const c = (e.target as Element | null)?.closest?.<HTMLElement>('.card-light') ?? null;
      if (!c) return;
      card = c; cx = e.clientX; cy = e.clientY;
      if (!cf) cf = requestAnimationFrame(() => {
        cf = 0;
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--cx', `${cx - r.left}px`);
        card.style.setProperty('--cy', `${cy - r.top}px`);
      });
    }, { passive: true });
  }

  // 5. gentle feedback when leaving the page through an internal link
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
    root.classList.add('is-navigating');
  });
  addEventListener('pageshow', () => root.classList.remove('is-navigating'));
}
