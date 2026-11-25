/**
 * Rehype plugin for article Markdown.
 *  1. Root-relative links ("/novosti/...") get the deployment base path prepended,
 *     so migrated internal links keep working under https://user.github.io/repo/.
 *  2. External links open in a new tab.
 *  3. A paragraph that contains only images (2+) becomes an image gallery grid.
 *  4. A single image with a title  ![alt](./a.jpg "Caption")  becomes <figure> with <figcaption>.
 *  5. A paragraph that contains only a YouTube link becomes a privacy-friendly embedded video.
 *  6. Tables are wrapped so they scroll horizontally on phones.
 *  7. Local article photos get responsive widths + sizes, so Astro emits a WebP srcset and phones
 *     do not download the full-resolution original (the lightbox still opens the full-size src).
 */

// Widths larger than the original are dropped by Astro, so small photos stay as they are.
const PHOTO_WIDTHS = [480, 800, 1200, 1600];
const SIZES_SINGLE = '(min-width: 1024px) 720px, calc(100vw - 2rem)';
const SIZES_GALLERY = '(min-width: 1024px) 240px, (min-width: 440px) 50vw, calc(100vw - 2rem)';

const isWs = (n) => n.type === 'text' && !n.value.trim();
const isEl = (n, tag) => n && n.type === 'element' && (!tag || n.tagName === tag);
const text = (n) => (n.type === 'text' ? n.value : (n.children ?? []).map(text).join(''));

function youtubeId(href) {
  try {
    const u = new URL(href);
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$|youtube-nocookie\.com$/.test(u.hostname)) return null;
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1, 12);
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{11})/);
    return m ? m[2] : null;
  } catch {
    return null;
  }
}

export function rehypeOdra(options = {}) {
  const base = (options.base ?? '/').replace(/\/$/, '');

  return (tree) => {
    walk(tree);
    responsive(tree, false);

    function walk(node) {
      if (!node.children) return;
      node.children = node.children.map((child) => transform(child));
      node.children.forEach(walk);
    }

    function responsive(node, inGallery) {
      for (const child of node.children ?? []) {
        if (!isEl(child)) continue;
        if (child.tagName === 'table') continue; // piece icons etc. inside result tables
        const gallery = inGallery || (child.properties?.className ?? []).includes('post-gallery');
        if (child.tagName === 'img') {
          const src = String(child.properties?.src ?? '');
          const local = src && !/^(https?:|data:|\/\/|\/)/.test(src);
          if (local && !child.properties.widths) {
            child.properties.widths = PHOTO_WIDTHS;
            child.properties.sizes = gallery ? SIZES_GALLERY : SIZES_SINGLE;
          }
          continue;
        }
        responsive(child, gallery);
      }
    }

    function transform(node) {
      if (!isEl(node)) return node;
      const props = (node.properties ??= {});

      if (node.tagName === 'a' && typeof props.href === 'string') {
        const href = props.href;
        if (base && href.startsWith('/') && !href.startsWith('//') && !href.startsWith(`${base}/`)) {
          props.href = base + href;
        } else if (/^https?:\/\//.test(href)) {
          props.target = '_blank';
          props.rel = ['noopener', 'noreferrer'];
        }
        return node;
      }

      if (node.tagName === 'table' && !node.data?.wrapped) {
        node.data = { ...node.data, wrapped: true };
        return { type: 'element', tagName: 'div', properties: { className: ['table-wrap'] }, children: [node] };
      }

      if (node.tagName !== 'p') return node;
      const kids = node.children.filter((c) => !isWs(c) && !isEl(c, 'br'));

      // 5. YouTube link alone in a paragraph
      if (kids.length === 1 && isEl(kids[0], 'a')) {
        const href = String(kids[0].properties?.href ?? '');
        const id = youtubeId(href);
        if (id && text(kids[0]).trim() === href.trim()) {
          return {
            type: 'element',
            tagName: 'div',
            properties: { className: ['video-embed'] },
            children: [
              {
                type: 'element',
                tagName: 'iframe',
                properties: {
                  src: `https://www.youtube-nocookie.com/embed/${id}`,
                  title: 'YouTube video',
                  loading: 'lazy',
                  allow: 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                  allowFullScreen: true,
                  referrerPolicy: 'strict-origin-when-cross-origin',
                },
                children: [],
              },
            ],
          };
        }
      }

      const imgs = kids.filter((c) => isEl(c, 'img'));
      if (imgs.length === 0 || imgs.length !== kids.length) return node;

      // 3. gallery
      if (imgs.length >= 2) {
        return {
          type: 'element',
          tagName: 'div',
          properties: { className: ['post-gallery'], dataGallery: '' },
          children: imgs.map((img) => ({
            type: 'element',
            tagName: 'span',
            properties: { className: ['g-item'] },
            children: [img],
          })),
        };
      }

      // 4. captioned single image
      const img = imgs[0];
      const title = img.properties?.title;
      if (title) {
        return {
          type: 'element',
          tagName: 'figure',
          properties: {},
          children: [img, { type: 'element', tagName: 'figcaption', properties: {}, children: [{ type: 'text', value: String(title) }] }],
        };
      }
      return node;
    }
  };
}
