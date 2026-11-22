# Administration (CMS): setup, sign-in, roles, testing

The website is static (GitHub Pages). The administration at **`https://<your-site>/admin/`** is
[Sveltia CMS](https://github.com/sveltia/sveltia-cms): a single-page app that runs in the
administrator's browser and saves every change as a commit to the GitHub repository. GitHub Actions
then rebuilds the site (about 2 minutes). There is no server and no database of our own.

- Configuration: generated at build time by `src/pages/admin/config.yml.ts` (main admin) and
  `src/pages/admin/trener/config.yml.ts` (coaches). The build fails if either is not valid YAML
  (`scripts/check-admin-config.mjs`).
- Sveltia is **self-hosted** and pinned (`@sveltia/cms` in `package.json`, now 0.270.0): the build copies
  it, its chunks and its interface translations into `/admin/sveltia/`. Update deliberately with
  `npm install @sveltia/cms@<version> --save-exact`, then run `tests/cms/run.sh`.
  Sveltia still loads a few helper libraries (e.g. for generating web addresses) from unpkg.com and its
  icon font from cdn.jsdelivr.net on first use; that is how upstream ships them.
- The interface is in **Croatian** by default. Anyone can switch it under account menu → Settings →
  Language; the choice is remembered in that browser.
- `/admin/` is excluded from search engines. Visitors never load any CMS code.

---

## 1. One-time setup (repository owner, ~15 minutes)

GitHub's minimal tokens ("fine-grained") **cannot be used by collaborators on a repository owned by a
personal account** (GitHub lists this as a limitation). With a personal repository every other
administrator would need a "classic" token, which can write to *all* their repositories. So:

1. **Create a free GitHub organization for the club** (github.com → + → New organization → Free),
   e.g. `sk-odra`. Transfer the website repository into it (repository Settings → Danger Zone →
   Transfer), or create it there.
2. Organization → Settings → **Member privileges** → *Base permissions*: **No permission**.
   (Members then get only the access you give them per repository.)
3. Organization → Settings → **Personal access tokens** → allow *fine-grained personal access tokens*.
   Optionally *Require administrator approval*: then every new token waits until an owner approves it.
4. Website repository → Settings → **Pages** → Source: **GitHub Actions**.
5. Invite administrators: Organization → People → Invite member; then in the website repository →
   Settings → Collaborators and teams → add them with the **Write** role.

Nothing secret is stored in the repository. Tokens live only in each administrator's browser.

## 2. Signing in

### A. With a personal token (works without any extra service – recommended)

Each administrator, once:

1. GitHub → avatar → **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token**
   - *Token name*: e.g. `ŠK Odra – admin (laptop)`
   - *Expiration*: up to 1 year (add a calendar reminder; on expiry just create a new one)
   - *Resource owner*: **the club organization** (not your own account)
   - *Repository access*: **Only select repositories** → the website repository
   - *Repository permissions*: **Contents → Read and write**. (*Metadata: Read* is added
     automatically.) Nothing else.
2. Copy the token (it is shown only once).
3. Open `https://<your-site>/admin/` → **Prijava pomoću pristupnog tokena** (*Sign In with Token*) → paste → Prijava.

The browser remembers the token until you sign out (account menu → *Odjava*). On a shared or
public computer always sign out. If a device is lost or a token may have leaked, delete it on GitHub
(Fine-grained tokens → the token → Delete); it stops working immediately. Never send a token by
e-mail or chat, and never put it in the repository.

### B. "Sign in with GitHub" button (optional)

For administrators who should not handle tokens at all: deploy the free
[Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth) (Cloudflare Worker), create a
GitHub OAuth App with callback `<WORKER_URL>/callback`, put its client ID/secret into the Worker (see
its README), then in the website repository: Settings → Secrets and variables → Actions → **Variables**
→ `CMS_AUTH_URL` = the Worker URL, and re-run the deploy workflow. `/admin/` then shows a working
GitHub button. (OAuth Apps act with the user's own repository rights, so the organization setup in §1
still determines what each person can change.)

## 3. Roles: administrator and coach

| | Can change | How it is enforced |
|---|---|---|
| **Administrator** | everything | Write access to the website repository |
| **Coach** | the training schedule only | Write access **only** to a separate schedule repository |

**Why a separate repository?** GitHub permissions apply to whole repositories. Within one repository
a person with write access can change any file, whatever the CMS shows them. Hiding menu items in the
CMS would be a fake restriction that a coach's token could bypass. So the schedule (`training.json`)
lives in its own small repository, and a coach's token can only reach that one. This boundary is enforced by
GitHub itself.

Setup (once, by the owner):

1. In the club organization create a repository, e.g. `raspored` (public is fine: the schedule is public
   anyway), and copy into it the three files from `docs/examples/schedule-repo/`
   (`training.json` – start with the current `src/data/training.json` – `README.md` and
   `.github/workflows/notify-site.yml`).
2. Website repository → Settings → Secrets and variables → Actions → **Variables** → `SCHEDULE_REPO` =
   `sk-odra/raspored`. (If the schedule repository is private, also add a **secret**
   `SCHEDULE_REPO_TOKEN`: a fine-grained token with *Contents: Read* on the schedule repository.)
3. Schedule repository → Settings → Secrets and variables → Actions:
   **Variable** `SITE_REPO` = the website repository (e.g. `sk-odra/web`), and **secret**
   `SITE_DISPATCH_TOKEN` = a fine-grained token with *Contents: Read and write* on the **website**
   repository only (GitHub requires that permission to trigger a rebuild). Create this token with an
   administrator's account.
4. Invite each coach to the organization and give them **Write** on the schedule repository only.
5. Re-run the website's deploy workflow.

From then on:

- Coaches open **`/admin/trener/`**, sign in with a token whose *Repository access* is **only the
  schedule repository** (Contents: Read and write), and see only *Raspored treninga*.
- Every save in the schedule repository triggers a rebuild of the website (≈2 minutes).
- The main `/admin/` no longer shows the schedule (it lives in the other repository).
  Administrators who should also edit the schedule get Write on both repositories and use
  `/admin/trener/` for it.

**Simpler alternative (no real restriction):** without `SCHEDULE_REPO`, `/admin/trener/` edits
`src/data/training.json` in the website repository. It shows coaches only the schedule, but their token
could change any file. That is fine for coaches you trust as much as administrators, but it is a
convenience, not a security boundary.

A third option is branch protection with required reviews: coaches' changes then wait as pull
requests until an administrator approves them. It is safe, but changes no longer appear without an
administrator, which defeats the purpose of quick schedule updates.

## 4. Publishing and status

- **Spremi** (*Save*) = a commit to GitHub. The site rebuilds automatically (≈1–3 minutes).
- A small badge at the bottom right of the admin shows the state of the last rebuild:
  *Objavljivanje u tijeku…* → *Objavljeno na stranici ✓ (time)*, or *Objava nije uspjela – otvori detalje*
  (links to GitHub Actions). It reads the public GitHub API, so for a **private** repository it can only
  link to the Actions page.
- **Drafts**: tick *Skica (ne objavljuj)* → saved, but not on the site. Untick and save to publish.
- **Scheduled publishing**: set *Datum objave* in the future. The site rebuilds every morning
  (~04:17), so the article appears that morning.
- If a change would break the site (e.g. an invalid date), the rebuild fails, the old version stays
  online, and the badge shows the error. The live site is never left broken.

## 5. What can be edited where

| Content | Admin section | File(s) |
|---|---|---|
| Articles (HR) | **Novosti (hrvatski)** → *Novo* | `src/content/blog/hr/<address>/index.md` + images next to it |
| English translations | News (English translations) | `src/content/blog/en/<address>/index.md` |
| In an article: headings, bold, links, lists, quotes | text editor toolbar | Markdown |
| … photos / photo gallery | toolbar image button; several photos one below another = gallery | files next to the article |
| … YouTube video | paste the link on its own line | becomes a privacy-friendly embed |
| … table | toolbar **table** button (rows × columns, then type), or *Insert → Dodaj tablicu* to paste from Excel | Markdown table |
| … chess game / diagram | **Dodaj šahovsku partiju** (paste PGN or upload `.pgn`) / **Dodaj šahovski dijagram** (FEN) | ```` ```pgn ````, `.pgn` file, ```` ```fen ```` |
| Featured image, SEO title/description, categories, tags | fields above the text | front matter |
| Photo albums | **Galerija – albumi** (several photos at once: *Dodaj više fotografija odjednom*) | `src/content/gallery/<album>/` |
| Videos | Raspored, članovi… → **Videozapisi** | `src/data/videos.json` |
| Members (add, photo, roles, order, remove) | … → **Članovi kluba** (order = list order, use ↑ ↓ or drag) | `src/data/members.json`, photos in `public/images/members/` |
| Training schedule, one-off changes, notices | … → **Raspored treninga** (or `/admin/trener/`) | `src/data/training.json` |
| Address, e-mail, phone, contacts, map, social links, homepage texts | … → **Postavke kluba i kontakt** | `src/data/site.json` |
| Homepage photo | (upload on GitHub) – use a real photo at least **2400 px wide** (landscape, main subject in the right half); the current one is only 1462 px | `src/assets/hero.jpg` |

Web addresses of new articles are generated from the title without diacritics
(„Božićni turnir, Đurđevac” → `bozicni-turnir-durdevac`). *Adresa (neobavezno)* overrides it.
Don't change the address of a published article (old links would break).

### Image formats (uploads)
Photos uploaded in the admin are converted **in the browser to WebP** (quality 85, at most 2400 px on the longer side) before they are saved, via `media_libraries.default.config.transformations` in `src/pages/admin/config.yml.ts`. Image fields accept JPEG, PNG, WebP and GIF; AVIF and HEIC are not accepted. The build then creates responsive WebP variants. AVIF is never generated anywhere: `scripts/check-build-output.mjs` fails the build if an `.avif` file or reference appears in `dist/`.

### Imported WordPress articles
Imported articles are ordinary Markdown files and open in the same editor. Old content that has no toolbar button is kept as HTML and survives saving unchanged (tested: chess games, images and their order, galleries, raw HTML tables, links, quiz solution boxes, the WordPress ID used for redirects). It is shown as HTML in the editor; edit it carefully or ask the administrator.

## 6. What has been tested, and how

`tests/cms/run.sh` opens **the real Sveltia CMS** (the files that ship in `/admin/`) in Chrome and
clicks through it like an editor. The only difference is the backend: GitHub is swapped for Sveltia's
built-in `test-repo` backend, which keeps files in the browser, pre-filled with this repository's
content. Then `tests/cms/build-saved.sh` builds the website from **exactly the files the CMS saved**
and checks the pages. All checks pass (latest run 2026-11-21):

- **Chess** (`workflow.py`, 20 checks): toolbar button, paste/upload PGN with preview and validation,
  multi-game files, exact error messages, positions in the article, save/reopen/re-save without changes.
- **Diagram, schedule editor, phone** (`extra.py`, 7 checks).
- **Administration** (`admin.py`, 19 checks):
  - Croatian interface by default
  - new article with no address typed: the address comes from the title, diacritics removed
  - featured image, image in the text, heading, list, YouTube line, table, categories, tags, SEO title
  - saved as a draft, then published; deleting an article
  - members: add with a photo, move, remove
  - album with three photos uploaded at once, plus a category
  - schedule notice; site settings (phone, Facebook, map)
  - coach admin shows only the schedule; a coach cancels one training
- **Site built from CMS output** (`build-saved.sh`, 17 checks): every one of those changes appears
  correctly on the built pages (article, album, members, schedule, homepage, contact page).

Bugs these tests found and that are fixed: saving an album without a cover, or site settings without
a homepage text, broke the whole build; an empty SEO title blanked the page title; a photo removed from
an album stayed on the site; the CMS configuration became invalid YAML; the Croatian interface could
not load.

**Not tested here, because it needs your GitHub account:** signing in with a real token or OAuth,
commits to GitHub, the rebuild after a save, the status badge, and the schedule repository's
notification. Sveltia's GitHub backend writes the same files as the test backend, but run the manual
test below once.

### Manual test after the first deploy (≈15 minutes)

1. Open `https://<your-site>/admin/` → **Prijava pomoću pristupnog tokena** → paste your token. You should see
   *Novosti (hrvatski)*, *News (English translations)*, *Galerija – albumi* and
   *Raspored, članovi, videozapisi, postavke*. A configuration error → stop and send a screenshot.
2. *Novosti (hrvatski)* → **Novo**. Title `CMS test – čćžšđ`; leave *Adresa* empty; tick **Skica**.
   Add a photo (*Naslovna fotografija* → Pregledaj → Prenesi), a sentence, a table and a chess game
   (**Dodaj šahovsku partiju**, paste PGN – a green ✓ appears). **Spremi**.
3. On GitHub: a new commit with `src/content/blog/hr/cms-test-cczsd/index.md` and the photo next to it.
   The badge in the admin goes *Objavljivanje u tijeku…* → *Objavljeno ✓*.
4. Reopen the article, untick **Skica**, **Spremi**. After ~2 minutes the article is on the site
   (Novosti). Check it on a phone too.
5. *Članovi kluba*: change one rating, **Spremi** → the Members page shows it after the rebuild.
6. Coach (only if you set up §3): sign in at `/admin/trener/` with a coach token, add a notice under
   *Obavijesti*, **Spremi** → the schedule repository gets a commit, its *Obavijesti web-stranicu* run
   is green, and the notice is on the website's schedule page after ~2 minutes. With the coach token,
   opening `/admin/` must **fail** to save anything (no access to the website repository): that is
   the permission boundary working.
7. Delete the test article (open it → ⋮ → *Izbriši*), **Spremi**.

If something fails, nothing is lost: the content is plain files on GitHub, and the previous version of
the site stays online.

## 7. Custom editor components

`src/cms/cms-chess.ts` is bundled into `/admin/cms-chess.js` at build time. It registers, with
Sveltia's documented `CMS.registerEditorComponent` API: **Dodaj šahovsku partiju** (PGN text or
`.pgn` file), **Dodaj šahovski dijagram** (FEN) and **Dodaj tablicu** (paste from Excel/Google
Sheets). The chess preview uses the same viewer as the public site, with validation above the board.
The output is plain Markdown, so articles stay editable on GitHub.
