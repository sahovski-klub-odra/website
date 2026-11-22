// Copies third-party browser files from node_modules into public/ so GitHub Pages serves them
// (no runtime CDN dependency, and the deployed version is exactly the tested one).
// Runs automatically before `npm run dev` and `npm run build`. The output folders are git-ignored.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const copy = (from, to, filter = () => true) => {
  const src = new URL(from, import.meta.url);
  const dest = new URL(to, import.meta.url);
  mkdirSync(new URL('./', dest), { recursive: true });
  cpSync(src, dest, { recursive: true, filter: (p) => filter(p) });
};

// chessboard sprites (cm-chessboard)
for (const f of ['pieces/standard.svg', 'extensions/markers/markers.svg'])
  copy(`../node_modules/cm-chessboard/assets/${f}`, `../public/vendor/cm-chessboard/${f}`);

// Sveltia CMS (self-hosted, pinned by package-lock.json) – without source maps
rmSync(new URL('../public/admin/sveltia/', import.meta.url), { recursive: true, force: true });
copy('../node_modules/@sveltia/cms/dist/sveltia-cms.js', '../public/admin/sveltia/sveltia-cms.js');
copy('../node_modules/@sveltia/cms/dist/chunks', '../public/admin/sveltia/chunks', (p) => !p.endsWith('.map'));
// Interface translations (Croatian is the admin default): Sveltia fetches them from unpkg.com at run time.
// Serve them from /admin/sveltia/locales/ instead, next to the self-hosted script.
copy('../node_modules/@sveltia/cms/locales', '../public/admin/sveltia/locales');
{
  const file = new URL('../public/admin/sveltia/sveltia-cms.js', import.meta.url);
  const js = readFileSync(file, 'utf8');
  const re = /`https:\/\/unpkg\.com\/@sveltia\/cms@[^/`]+\/locales`/;
  if (re.test(js)) {
    // resolved against the script's own address, so it works under /admin/ and /admin/trener/
    const local = "(((document.querySelector('script[src*=\"sveltia-cms.js\"]')||{}).src||location.href).replace(/[^/]*$/,'')+'locales')";
    writeFileSync(file, js.replace(re, local));
  } else {
    console.warn('⚠ Sveltia: locale URL not found – translations will load from unpkg.com (check after a Sveltia update)');
  }
}
const n = readdirSync(new URL('../public/admin/sveltia/chunks/', import.meta.url), { recursive: true }).length;
console.log(`♞ vendor assets → public/vendor/cm-chessboard/, public/admin/sveltia/ (${n} chunk files)`);

// CMS editor components (src/cms/cms-chess.ts) → one self-contained script for /admin/
// The chess viewer and PGN parser are the same code the website uses.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cssAsText = {
  name: 'css-as-text',
  setup(b) {
    // `import css from './x.css?raw'` → the file contents as a string
    b.onResolve({ filter: /\.css\?raw$/ }, (args) => ({
      path: args.path.startsWith('.') ? new URL(args.path.replace(/\?raw$/, ''), `file://${args.resolveDir}/`).pathname : require.resolve(args.path.replace(/\?raw$/, '')),
      namespace: 'css-text',
    }));
    b.onLoad({ filter: /.*/, namespace: 'css-text' }, (args) => ({ contents: readFileSync(args.path, 'utf8'), loader: 'text' }));
    // plain `import 'x.css'` (used by the website build) → nothing; the CMS injects the CSS text itself
    b.onResolve({ filter: /\.css$/ }, () => ({ path: 'noop', namespace: 'css-noop' }));
    b.onLoad({ filter: /.*/, namespace: 'css-noop' }, () => ({ contents: '', loader: 'js' }));
  },
};
const result = await build({
  entryPoints: [new URL('../src/cms/cms-chess.ts', import.meta.url).pathname],
  outfile: new URL('../public/admin/cms-chess.js', import.meta.url).pathname,
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  legalComments: 'eof',
  plugins: [cssAsText],
  metafile: true,
  logLevel: 'warning',
});
const bytes = Object.values(result.metafile.outputs)[0].bytes;
console.log(`♞ CMS chess component → public/admin/cms-chess.js (${Math.round(bytes / 1024)} KB)`);
