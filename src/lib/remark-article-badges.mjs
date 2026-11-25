/**
 * Remark plugin: team and round labels at the very start of an article become badges.
 *
 * Many league reports start with a line such as
 *   **Seniori – II. ekipa, 6.kolo**     ###### Seniori, 2. kolo     **IV. A liga, 3. kolo**
 * That line is taken out of the text and returned as badges ("Seniori", "Druga ekipa", "6. kolo"),
 * which the article page shows under the title (file.data.astro.frontmatter.badges →
 * remarkPluginFrontmatter in ArticleView). Only a line made entirely of such labels is used;
 * anything else is left exactly as written, so ordinary sentences are never touched.
 */

const TEAM = { seniori: 'Seniori', kadeti: 'Kadeti', kadetkinje: 'Kadetkinje', juniori: 'Juniori', juniorke: 'Juniorke' };
const SQUAD = { i: 'Prva ekipa', ii: 'Druga ekipa', iii: 'Treća ekipa' };

/** "Seniori – II. ekipa, 6.kolo" → ['Seniori', 'Druga ekipa', '6. kolo']; null when the text is not only labels */
export function parseBadges(text) {
  const clean = String(text).replace(/ /g, ' ').replace(/\s+/g, ' ').trim().replace(/:$/, '');
  if (!clean || clean.length > 70) return null;
  const parts = clean.split(/\s*,\s*|\s+[–—-]\s+/).filter(Boolean);
  const out = [];
  for (const raw of parts) {
    const p = raw.trim();
    let m;
    if ((m = p.match(/^(seniori|kadeti|kadetkinje|juniori|juniorke)$/i))) out.push(TEAM[m[1].toLowerCase()]);
    else if ((m = p.match(/^(I{1,3})\.\s*ekipa$/i))) out.push(SQUAD[m[1].toLowerCase()]);
    else if ((m = p.match(/^(\d{1,2})\.?\s*(?:[–-]\s*(\d{1,2})\.?)?\s*kolo$/i))) out.push(m[2] ? `${m[1]}.–${m[2]}. kolo` : `${m[1]}. kolo`);
    else if ((m = p.match(/^(I{1,3}|IV|V)\.?\s*([AB])\.?\s*liga$/i))) out.push(`${m[1].toUpperCase()}. ${m[2].toUpperCase()} liga`);
    else if ((m = p.match(/^kadetska liga(?: (\d{4})\.?)?$/i))) out.push(m[1] ? `Kadetska liga ${m[1]}.` : 'Kadetska liga');
    else return null;
  }
  return out.length ? out : null;
}

const isBlank = (n) => (n.type === 'text' && !n.value.trim()) || n.type === 'break';

/** first text node at the start of a block, following leading bold/italic wrappers */
function leading(node, path = []) {
  const first = node.children?.find((c) => !(c.type === 'text' && !c.value.trim()));
  if (!first) return null;
  if (first.type === 'text') return { node: first, parent: node, path };
  if (first.type === 'strong' || first.type === 'emphasis') return leading(first, [...path, node]);
  return null;
}

export function remarkArticleBadges() {
  return (tree, file) => {
    const block = tree.children.find((c) => c.type !== 'html' || c.value.trim());
    if (!block || !['paragraph', 'heading'].includes(block.type)) return;
    const lead = leading(block);
    if (!lead) return;
    // the label ends at the first line break (or with the text node)
    const parent = lead.parent;
    const idx = parent.children.indexOf(lead.node);
    // old WordPress bold markers that Markdown could not pair up stay as literal "**" – ignore them
    const stray = /^\s*(\*\*|__)/.test(lead.node.value);
    const badges = parseBadges(lead.node.value.replace(/^\s*(\*\*|__)/, ''));
    if (!badges) return;
    const next = parent.children[idx + 1];
    // the label must be followed by a line break, a photo, or the end of its wrapper
    if (next && !['break', 'image'].includes(next.type)) return;
    parent.children.splice(idx, next?.type === 'break' ? 2 : 1);

    // …and the literal closing "**" that belonged to the label
    if (stray) {
      const closer = parent.children.find((c) => c.type === 'text' && /^\s*(\*\*|__)/.test(c.value));
      if (closer) closer.value = closer.value.replace(/^\s*(\*\*|__)/, '');
    }

    // remove wrappers and the block itself when nothing is left
    const tidy = (n) => {
      if (!n.children) return;
      n.children.forEach(tidy);
      n.children = n.children.filter((c) => !(['strong', 'emphasis'].includes(c.type) && c.children.every(isBlank)));
      // a leading break left behind
      while (n.children[0] && isBlank(n.children[0]) && n.type !== 'root') n.children.shift();
    };
    tidy(block);
    if (block.children.every(isBlank)) tree.children.splice(tree.children.indexOf(block), 1);

    file.data.astro ??= {};
    file.data.astro.frontmatter ??= {};
    file.data.astro.frontmatter.badges = badges;
  };
}
