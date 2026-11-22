# Šahovski klub Odra – web stranica

A fully static website for Šahovski klub Odra (Zagreb), built with **Astro 7 + TypeScript + Tailwind CSS 4** and hosted for free on **GitHub Pages**. There's no database, no server, and no WordPress. Every page is plain HTML generated at build time.

| | |
|---|---|
| Languages | Croatian (default, at `/`) and English (at `/en/`) |
| Content | Markdown articles, JSON data files, and images stored in this repository |
| Editing | Browser CMS at `/admin/`, GitHub's web editor, or any text editor |
| Deployment | Automatic, via GitHub Actions on every change to `main` |
| JavaScript | About 10 KB in total for the menu, search, lightbox, schedule and tabs; the chess viewer (~50 KB gzipped) loads only on articles that contain a game |
| Chess games | Interactive PGN viewer in articles – see §5a |

**Guide for editors and coaches (Croatian):** [docs/UPUTE-ZA-UREDNIKE.md](docs/UPUTE-ZA-UREDNIKE.md)

---

## 1. First-time setup

### 1.1 Create the repository
1. On GitHub, click **New repository** and name it, for example, `sk-odra` (public or private, either works).
2. Upload this project:
   ```bash
   cd sk-odra
   git init -b main
   git add .
   git commit -m "Initial site"
   git remote add origin https://github.com/<OWNER>/sk-odra.git
   git push -u origin main
   ```
3. In `src/data/site.json`, set `"repository": "<OWNER>/sk-odra"`. This is only used for local builds. On GitHub the CMS detects the repository automatically.

### 1.2 Enable GitHub Pages
1. Go to **Repository → Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open the **Actions** tab. The *Deploy to GitHub Pages* workflow runs on every push to `main`. You can also start it by hand with **Run workflow**.
4. The site appears at `https://<OWNER>.github.io/sk-odra/`.

You don't need to configure paths. The workflow reads the correct URL and base path from `actions/configure-pages` and passes them to Astro as `SITE_URL` and `BASE_PATH`. All internal links, images and redirects get the `/sk-odra/` prefix automatically.

### 1.3 Connect a custom domain (e.g. `www.sk-odra.hr`)
1. **Settings → Pages → Custom domain**: enter `www.sk-odra.hr` and save.
2. Set up DNS with your domain provider:
   - `www` → **CNAME** → `<OWNER>.github.io`
   - apex domain (`sk-odra.hr`) → **A** records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
3. Once DNS works, tick **Enforce HTTPS**.
4. Run the workflow again (Actions → Run workflow). The base path becomes `/` automatically and nothing else changes.

If you later move the old WordPress domain to GitHub Pages, all old article URLs keep working (see §4).

### 1.4 Local development
Requires Node.js 22.23 or newer (see `.nvmrc`).
```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # type check + static build into dist/ (fails if any AVIF file or reference is produced)
npm test             # unit tests (PGN parser, FEN, CMS validation, Markdown plugin, members import)
tests/cms/run.sh     # drives the real CMS in Chrome, then builds the site from what it saved (needs Playwright)
SEED_ARTICLES="slug-a|slug-b" tests/cms/make-site.sh && python3 tests/cms/imported.py   # edit imported articles in the CMS (serve tests/cms/site on :8800)
npm run verify:migration   # every article and image stored locally, nothing loaded from the old WordPress
npm run preview      # serve dist/ locally
```
To test a project-site build locally: `BASE_PATH=/sk-odra/ npm run build`.

---

## 2. Migrating the WordPress content

Detailed guide: [docs/MIGRATION.md](docs/MIGRATION.md). Short version:

```bash
# Option A – live site via the REST API (no WordPress login needed)
npm run migrate -- --api https://old-club-site.hr --limit 3     # test run with 3 posts
npm run migrate -- --api https://old-club-site.hr               # everything

# Option B – export file (WordPress admin → Tools → Export → All content)
npm run migrate -- --xml ./wordpress-export.xml

# Also refresh the member list (ratings, categories, roles) from the old "Članovi" page
npm run migrate -- --api https://old-club-site.hr --members clanovi

npm run verify:migration     # fails if any image is missing or still points to WordPress
npm run build
```

No access to the old site from your machine? Run it on GitHub instead: **Actions → Import from WordPress →
Run workflow** (`.github/workflows/import-wordpress.yml`). It imports on GitHub's servers and opens a pull
request with the result and the report, so nothing is published until you merge it.

The script:
- reads WordPress only and never changes anything there
- never overwrites existing content; posts already imported (same WordPress ID) are skipped
- downloads every image (original size, scaled down to at most 2400 px) next to its article, so images are optimised to WebP/AVIF at build time and hosted on GitHub Pages
- downloads linked PDFs, PGNs and documents into `public/files/wp/`
- converts galleries, captions, YouTube embeds, tables and `[caption]`/`[gallery]` shortcodes
- rewrites links between articles to the new URLs
- keeps the original publication dates, categories, tags and slugs (Croatian diacritics in slugs become plain ASCII)
- writes `src/data/redirects.json` and a report in `migration/report.md`

---

## 3. Project structure

```text
src/
  content/
    blog/hr/<slug>/index.md        Croatian articles (images in the same folder)
    blog/en/<slug>/index.md        optional English translations (same translationKey)
    gallery/<album>/index.md       photo albums (+ photos in the same folder)
  data/
    site.json                      club name, address, e-mail, phone, map, social links
    training.json                  training schedule (weekly sessions + exceptions + one-offs)
    members.json                   club members
    videos.json                    YouTube videos
    redirects.json                 old WordPress URLs → new URLs (generated by the migration)
  assets/hero.jpg                  homepage hero photo – replace with a real club photo
  components/  layouts/  views/    UI (views are shared by the HR and EN pages)
  i18n/ui.ts                       all interface texts in both languages
  i18n/routes.ts                   URL structure per language
  lib/schedule.ts                  training schedule engine (recurring + exceptions)
  lib/rehype-odra.mjs              Markdown extras (galleries, captions, YouTube, base path)
  pages/                           routes (thin wrappers around views)
  pages/admin/                     CMS at /admin/ (config generated at build)
scripts/
  migrate-wordpress.ts             WordPress → Markdown migration
  verify-migration.ts              pre-deploy content check
docs/                              guides + example data files
.github/workflows/
  deploy.yml                       build + deploy to GitHub Pages (push to main, daily, manual)
  check.yml                        builds every pull request, so broken edits are caught before merge
```

### URLs
| Croatian | English |
|---|---|
| `/` | `/en/` |
| `/novosti/`, `/novosti/stranica/2/` | `/en/news/`, `/en/news/page/2/` |
| `/novosti/<slug>/` | `/en/news/<slug>/` (translated articles only) |
| `/novosti/kategorija/<kategorija>/` | `/en/news/category/<category>/` |
| `/novosti/pretraga/?q=…` | `/en/news/search/?q=…` |
| `/clanovi/`, `/galerija/`, `/galerija/<album>/`, `/raspored/`, `/kontakt/` | `/en/members/`, `/en/gallery/…`, `/en/schedule/`, `/en/contact/` |

Historical WordPress articles are **not** machine-translated. English pages list them with an **"In Croatian"** badge and link to the Croatian original. To add a translation, create `src/content/blog/en/<slug>/index.md` with the same `translationKey` as the Croatian article (migrated posts already have `translationKey: "wp-<id>"`). Both versions then link to each other and get `hreflang` tags.

---

## 4. Redirects from old WordPress URLs – and their limits

GitHub Pages is a plain file host. It **cannot send HTTP 301 redirects**, and it has no `.htaccess` or server rules. The site does the best a static host allows:

1. **Redirect pages.** For every old article URL (e.g. `/2024/02/turnir/`) the build creates a small HTML page with `<meta http-equiv="refresh">` and a `rel="canonical"` link to the new address. Google treats an instant meta refresh much like a permanent redirect.
2. **Smart 404 page.** `404.html` catches anything else, such as different letter case, URL-encoded Croatian letters, `/category/…`, `/tag/…` and `/feed/`, and forwards it with JavaScript.
3. **Short links.** `/?p=123` and `/?page_id=123` are forwarded from the homepage.

**Important:** these redirects only help if visitors actually reach the new site at the old address, which means the **old WordPress domain must be pointed to GitHub Pages** (§1.3) once the migration is verified. Until then the old site keeps serving its own URLs. Keep the WordPress site online (unchanged) until you've switched DNS and checked the new site.

---

## 5. Content management

See [docs/CMS.md](docs/CMS.md) for the full evaluation. In short:

| Who | How | Needs |
|---|---|---|
| Administrators | **`/admin/`** (Sveltia CMS, Croatian interface): articles, albums, members, videos, schedule, settings | GitHub account in the club organization + a fine-grained token (Contents: read & write, this repository only) |
| Coaches (schedule only) | **`/admin/trener/`** – only the schedule. A real permission boundary when the schedule lives in its own repository (`SCHEDULE_REPO`, see docs/CMS.md §3) | token for the schedule repository only |
| Developers | Git + any editor | – |

**Why not plain Decap CMS?** Decap CMS's GitHub login requires an OAuth server, which GitHub Pages cannot provide. Without an external service such as Netlify or a Cloudflare Worker, Decap's login button simply doesn't work. Sveltia CMS reads the same configuration format but can also **sign in with a personal access token** without any server. The optional OAuth helper for a one-click "Sign in with GitHub" button is described in docs/CMS.md.

Every saved change is a Git commit. The deploy workflow rebuilds the site and it goes live within about 1–2 minutes. If an edit contains an error (e.g. `25:00` as a time), the build fails with a readable Croatian message and **the previous version of the site stays online**.

---

## 5a. Chess games in articles

Write PGN in a ```` ```pgn ```` block, link a `.pgn` file in its own paragraph, or click **Dodaj šahovsku partiju** in the CMS editor (live preview and validation before saving). Every game becomes an interactive board: move list (beside the board on desktop, below it on phones), first/previous/next/last buttons, ← → Home End keys, autoplay with adjustable speed, board flip, last-move and check highlighting, comments, nested variations, several games per article and several games per `.pgn` file, and PGN download.

| Part | File |
|---|---|
| PGN → move tree (comments, variations, NAGs, multi-game, error messages) | `src/lib/pgn/parse.ts` (uses **chess.js**, BSD-2) |
| Markdown → viewer placeholder + plain-text fallback for SEO/no-JS | `src/lib/pgn/remark-pgn.mjs` |
| Interactive viewer | `src/scripts/pgn-viewer.ts` (board: **cm-chessboard**, MIT) – loaded only on pages with a game |
| CMS buttons "Dodaj šahovsku partiju" / "Dodaj šahovski dijagram" with live preview | `src/cms/cms-chess.ts` → bundled to `/admin/cms-chess.js` at build time; integration tests in `tests/cms/` |
| Piece/marker sprites | copied to `public/vendor/cm-chessboard/` automatically before `dev`/`build` |

The pieces are the Wikimedia "Cburnett" set (CC BY-SA 3.0); the viewer shows the required credit. **chessground** (Lichess's board) was not used because it is GPL-3.0, which would require releasing the whole site under the GPL.

Everything runs in the browser: no backend, no external chess service at runtime.

---

## 6. Things to fill in before launch

The site deliberately contains **no invented club information**. Before launch:

- [ ] `src/data/site.json`: address, e-mail, phone, map coordinates, social links, `repository`. The locality "Mala Mlaka" comes from the club's chess-results.com listing ("ŠK Odra, Mala Mlaka - Zagreb"); please confirm it.
- [ ] `src/assets/hero.jpg`: replace the placeholder (cropped from the design reference) with a real club photo, landscape, at least 2000 px wide.
- [ ] Run the WordPress migration and `npm run verify:migration`.
- [ ] `src/data/training.json`: the real schedule (format: `docs/examples/training.example.json`).
- [ ] `src/data/members.json`: club members, with their consent for name and photo (GDPR; for minors, parental consent).
- [ ] Optional: `src/data/videos.json`, photo albums, a contact form service (`contactForm` in site.json; Formspree and Web3Forms both have free plans).

---

## 7. Technical notes

- **Performance:** static HTML, self-hosted fonts (no Google Fonts requests), responsive AVIF/WebP images, lazy loading, and YouTube loaded only after a click (`youtube-nocookie.com`). There are no client frameworks.
- **SEO:** sitemap (`/sitemap-index.xml`), `robots.txt`, canonical URLs, meta descriptions, Open Graph images (generated per article), `hreflang` (only where a translation exists), JSON-LD `SportsOrganization` + `BlogPosting`, and RSS (`/rss.xml`, `/en/rss.xml`).
- **Accessibility:** skip link, landmarks, keyboard-navigable menu, tabs and lightbox, visible focus styles, `aria-current`, colour contrast checked for gold on cream (`gold-deep` is used for text), and `prefers-reduced-motion` support.
- **Schedule:** rendered at build time (works without JavaScript) and recalculated in the browser for today's date in Europe/Zagreb time. The deploy workflow also rebuilds daily.
- **Data validation:** every JSON file is validated with Zod at build time (`src/lib/schemas.ts`).
