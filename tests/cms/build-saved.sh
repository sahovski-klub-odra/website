#!/bin/bash
# Builds the website from exactly what the CMS saved in tests/cms/admin.py (tests/cms/output/saved/)
# and checks the resulting pages. Proves that CMS output is valid input for the static build.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
( cd "$REPO" && tar --exclude=node_modules --exclude=dist --exclude=.astro --exclude=tests/cms/site --exclude=tests/cms/output -cf - . ) | tar -xf - -C "$WORK"
ln -s "$REPO/node_modules" "$WORK/node_modules"
cp -r "$HERE/output/saved/." "$WORK/"
rm -rf "$WORK/src/content/blog/hr/demo-sahovske-partije"   # deleted in the CMS during the test
cd "$WORK"
node scripts/copy-vendor-assets.mjs >/dev/null
npx astro build > build.log 2>&1 || { tail -30 build.log; exit 1; }
node scripts/check-admin-config.mjs
node scripts/check-build-output.mjs
python3 "$HERE/check_saved_pages.py" "$WORK/dist"
