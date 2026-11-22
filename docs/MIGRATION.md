# WordPress migration guide

The goal is that every article and image from the old WordPress site ends up in this repository, so the new site doesn't depend on the old one at all.

## 0. Before you start
- The migration only **reads** from WordPress. Nothing there is changed or deleted.
- Do the migration on your own computer (Node.js 22.23+), not in GitHub Actions, so you can review the result before committing.
- Work on a branch: `git checkout -b migracija`.

## 1. Choose a source

| Source | When to use | Command |
|---|---|---|
| **REST API** | The site is online and `https://site/wp-json/` returns JSON (default in every WordPress since 4.7) | `npm run migrate -- --api https://site.hr` |
| **XML export** | REST API disabled by a security plugin, or you'd rather work offline | WordPress admin → *Alati / Tools → Izvoz / Export → All content* → `npm run migrate -- --xml export.xml` |
| **XML + API** | The XML references images that should be fetched from the live media library | `npm run migrate -- --xml export.xml --api https://site.hr` |

Images are always downloaded from the WordPress media library (`/wp-content/uploads/…`), so the old site must be online while you migrate.

`*.xml` is git-ignored on purpose: WordPress exports contain author e-mail addresses.

## 2. Test run
```bash
npm run migrate -- --api https://site.hr --limit 3
npm run dev            # check the 3 articles at http://localhost:4321/novosti/
```
Look at text, Croatian characters (č ć đ š ž), images, captions, galleries and links. If something looks wrong, delete the 3 test folders in `src/content/blog/hr/` and adjust before the full run.

## 3. Full run
```bash
npm run migrate -- --api https://site.hr
```
- It handles hundreds of articles (paged requests, 4 parallel downloads, retries with back-off).
- Running it again is safe: posts that already exist (same WordPress ID in the front matter) are **skipped**. Use `--update` to refresh previously migrated posts only. That overwrites only those article files and never deletes anything.
- Slugs from WordPress are kept. Slugs containing Croatian letters (`šahovska-škola`) become ASCII (`sahovska-skola`), and a redirect is generated.

Other options: `--include-pages` (exports WordPress *pages*, e.g. "O nama", to `migration/pages/` for manual review; they are not published automatically), `--max-width 0` (keep original image sizes), `--old-host stari-domen.hr` (extra domain names of the old site, so links using them are rewritten too).

## 4. Check the result
```bash
npm run verify:migration
```
This fails if any article references a missing image, or still loads images or files from `/wp-content/`. Then read **`migration/report.md`**:

- **Needs attention:** images or files that could not be downloaded (e.g. deleted from the media library). Either find the original and put it in the article folder, or remove the reference.
- **Warnings:**
  - *Unconverted shortcodes*: plugin shortcodes (e.g. contact forms) are left as text. Edit or delete them.
  - *Internal link not mapped*: a link to a WordPress page (not a post) or a deleted post. Fix it by hand.
  - *Embedded iframe kept as HTML*: e.g. Google Maps or chess-results embeds. They keep working, but check them.

## 5. Build, review, publish
```bash
npm run build && npm run preview
git add -A && git commit -m "Migracija WordPress objava" && git push -u origin migracija
```
Open a pull request. The *Check changes* workflow builds it. Merge it and the site deploys.

## 6. Switch the domain (after verification)
Only after the new site has been checked, point the old domain to GitHub Pages (README §1.3). From that moment the generated redirect pages forward old article URLs to the new ones. Keep a backup of the WordPress site (an XML export plus the `wp-content/uploads` folder) for at least a few months.

## Chess games from WordPress

The script finds games in all common forms and turns each into an interactive board:

| On the WordPress site | Becomes |
|---|---|
| `[pgn]…[/pgn]`, `[pgnv]`/`[pgne]`/`[pgnb]` (PgnViewerJS), `[chess]…[/chess]` shortcodes | ```` ```pgn ```` block |
| `[fen]…[/fen]` | diagram (```` ```pgn ```` with a FEN header) |
| PGN pasted directly into the text (3+ header lines followed by moves) | ```` ```pgn ```` block |
| elements with a `data-pgn` attribute, `<textarea>`/`<pre>` containing PGN, PgnViewerJS `pgn:` scripts | ```` ```pgn ```` block |
| pgn4web "Embed Chessboard" iframes (`pgnText=` / `pgnData=`) | ```` ```pgn ```` block / downloaded `.pgn` file |
| lichess.org game or study embeds | PGN downloaded from lichess's public export API (`--no-lichess` to skip) |
| links to `.pgn` files | file saved next to the article + board; inline links stay as download links |
| chess.com embeds | **kept as iframe + warning** – chess.com has no public export for embeds; copy the PGN from chess.com by hand |

WordPress's typography filter (curly quotes `“”`, `1–0` with an en dash, `×`) is undone so the PGN parses. Afterwards `npm run verify:migration` checks every move of every game with chess.js and lists the exact move where a game is broken. The report has a **Chess** column per post, and a warning for posts that mention a chess plugin but where nothing could be converted.

## What is converted

| WordPress | Result |
|---|---|
| Title, publish date (UTC), modified date | front matter `title`, `pubDate`, `updatedDate` |
| Categories, tags | `categories`, `tags` |
| Featured image | `image` (downloaded next to the article); if missing, the first image in the article is used for the card |
| Manual excerpt | `description` (otherwise the first ~200 characters) |
| Images, including `srcset` and lazy-load attributes | the largest/original file, downloaded and scaled to ≤ 2400 px |
| Image captions (Gutenberg `figure`, classic `[caption]`) | `![alt](./file.jpg "Caption")` → rendered as `<figure>` with a caption |
| Galleries (Gutenberg, classic `[gallery]`, Jetpack) | consecutive images → rendered as a gallery grid with lightbox |
| YouTube embeds | URL on its own line → rendered as a privacy-friendly embedded video |
| Tables, lists, headings, quotes | Markdown (GitHub-flavoured) |
| Links to other posts | the new `/novosti/<slug>/` URL |
| Linked PDF/PGN/DOC/XLS files | `public/files/wp/<year>/<month>/…` |
| Post URL and ID | `wordpress.url`, `wordpress.id` (used for redirects and duplicate detection) |

## 7. How the ŠK Odra archive was actually migrated (November 2026)

The old server could not be reached from the build machine, so the content was fetched once through a browser on a club computer and then migrated **offline**. Re-running everything gives the same result (idempotent).

1. **Dump and mirror** (read-only): the REST API (`/wp-json/wp/v2/posts|pages|categories|media`, all pages of results) saved as one `dump.json` (442 published posts, 2012-12-11 → 2026-10-13), and every `/wp-content/uploads/…` file it references saved under `mirror/` with the same paths.
2. **Import:**
   ```bash
   npm run migrate -- --json dump.json --mirror mirror --old-host sahovski-klub.com,www.sahovski-klub.com \
     --galleries foto-galerija,fotogalerija-2 --include-pages --missing-list missing.txt
   ```
   `--ids 123,456 --update` re-imports single posts (e.g. after an importer fix).
3. **Post-steps** (both are idempotent and must be re-run after any `--update`):
   ```bash
   python3 scripts/fix-unavailable-media.py                  # third-party flag icons → emoji, files missing on the old server → visible note
   python3 scripts/convert-quizzes.py --mirror mirror         # old quiz plugin data → readable questions with "Rješenje" boxes
   ```
4. **Checks:** `npm run verify:migration`, `npm test`, `npm run build` (includes the AVIF guard and copies files that articles link to).

Manual edits that an `--update` of the same post would overwrite: post 2279 (*Kamsky – Giri*, image restored from a code block). Everything else is reproducible from the commands above.

The full numbers (articles, images, files, chess games, every item that needs attention) are in `migration/report.md`; content the old site itself no longer had is listed in `migration/unavailable-media.md`.

### Linked files and full-size photos
Imported articles often link a photo to its full-size version (`[Prijava](./prijava.jpg)`) or link a document in the article folder. Astro only processes *embedded* images, so `src/integrations/article-files.mjs` copies every file an article links to from its content folder next to the built page. The build log shows how many were copied and warns about any link that points to a missing file.
