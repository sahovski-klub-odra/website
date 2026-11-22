/**
 * Scroll reveal + image fade-in. ~1 KB, no dependencies.
 * Runs only when <html> has the `motion` class (JS on and no reduced-motion preference),
 * which the inline script in BaseLayout sets before first paint.
 */
import { initAmbient } from './ambient';

const root = document.documentElement;

if (root.classList.contains('motion')) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  const loaded = (img: HTMLImageElement) => img.classList.add('is-loaded');
  document.querySelectorAll<HTMLImageElement>('img.img-fade').forEach((img) => {
    if (img.complete && img.naturalWidth) loaded(img);
    else {
      img.addEventListener('load', () => loaded(img), { once: true });
      img.addEventListener('error', () => loaded(img), { once: true });
    }
  });
}

// Continuous decorative motion (ambient backgrounds, cursor light, navigation bar)
if (root.classList.contains('motion')) initAmbient();
