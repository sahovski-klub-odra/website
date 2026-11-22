# CMS integration tests

These tests open the **real Sveltia CMS**, the same files that ship in `/admin/`, in Chrome and click through it like an editor. The only change is the backend: `github` is swapped for Sveltia's built-in `test-repo` backend, which keeps files in the browser and is pre-filled with this repository's content. Nothing is sent to GitHub and no login is needed.

```bash
pip install playwright && python -m playwright install chromium   # once
npm run build
tests/cms/run.sh
```

- `workflow.py` – chess-game component: toolbar button, paste, upload, multi-game files, validation errors,
  positions in the article, save, reopen and re-save.
- `extra.py` – diagram component, training schedule editor, the editor on a phone.
- `admin.py` – every admin section: Croatian interface, new article (address from the title, featured
  image, image in text, YouTube, table, categories, SEO, draft → publish), deleting an article, members
  (photo, reorder, remove), album with several photos at once + category, schedule notice, settings, and
  the coach admin `/admin/trener/`. Everything it saves is copied to `tests/cms/output/saved/`.
- `build-saved.sh` – builds the website from exactly those saved files and checks the pages
  (`check_saved_pages.py`).

Screenshots and saved files land in `tests/cms/output/`.

Environment variables (optional): `CHROME=/path/to/chrome` to use an installed Chrome; `CMS_URL` if port 8800 is taken; `CMS_OFFLINE_DIR=<node_modules>` to serve Sveltia's unpkg/jsdelivr helpers from disk on machines without internet access.

What this cannot test: signing in to GitHub and commits to the real repository. See the manual procedure in `docs/CMS.md`.
