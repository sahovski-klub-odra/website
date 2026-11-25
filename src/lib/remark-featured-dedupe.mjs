/**
 * Remark plugin: the featured photo (front matter `image`) is shown above the article,
 * so the same photo is not shown again inside the text.
 *
 * Removed from the article body:
 *  - an image that points to the same file as the featured photo,
 *  - an image whose file has exactly the same content (the same photo uploaded twice under another name),
 *  - a repeated image (the same file a second time in the text).
 * Files are never deleted, only the duplicate <img> is left out of the page.
 *
 * The 442 migrated articles were cleaned once in Markdown (including resized and cropped copies,
 * see migration/report-images-authors.md); this plugin keeps new CMS articles clean too.
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const hashCache = new Map();
function fileHash(path) {
  if (!hashCache.has(path)) {
    hashCache.set(path, existsSync(path) ? createHash('sha1').update(readFileSync(path)).digest('hex') : null);
  }
  return hashCache.get(path);
}

const isLocal = (url) => typeof url === 'string' && !/^([a-z]+:|\/\/|#|\/)/i.test(url);

export function remarkFeaturedDedupe() {
  return (tree, file) => {
    const filePath = file.path || file.history?.[0];
    if (!filePath) return;
    const dir = dirname(filePath);
    const featured = file.data?.astro?.frontmatter?.image;
    const seen = new Set(); // absolute paths and content hashes already shown
    if (isLocal(featured)) {
      const abs = resolve(dir, featured);
      seen.add(abs);
      const h = fileHash(abs);
      if (h) seen.add(h);
    }

    let removed = false;
    const walk = (node) => {
      if (!node.children) return;
      node.children = node.children.filter((child) => {
        if (child.type === 'image' && isLocal(child.url)) {
          let abs;
          try { abs = resolve(dir, decodeURI(child.url)); } catch { return true; }
          const h = fileHash(abs);
          if (seen.has(abs) || (h && seen.has(h))) return (removed = true), false;
          seen.add(abs);
          if (h) seen.add(h);
          return true;
        }
        walk(child);
        return true;
      });
    };
    walk(tree);
    if (!removed) return;

    // tidy up what the removed image leaves behind: empty bold/italic markers and empty paragraphs
    const blank = (n) => (n.type === 'text' && !n.value.trim()) || n.type === 'break';
    const tidy = (node) => {
      if (!node.children) return;
      node.children.forEach(tidy);
      node.children = node.children.filter(
        (c) => !(['strong', 'emphasis', 'delete', 'paragraph'].includes(c.type) && c.children.every(blank)),
      );
    };
    tidy(tree);
  };
}
