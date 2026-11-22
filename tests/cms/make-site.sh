#!/bin/bash
# Builds a local CMS test environment from the PRODUCTION admin files.
# Only difference: backend github -> test-repo (browser-local, no login), seeded with the repo's content.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
OUT="$HERE/site"
rm -rf "$OUT"; mkdir -p "$OUT/admin" "$OUT/seed"
[ -f "$REPO/dist/admin/config.yml" ] || { echo "Run npm run build first (needs dist/admin)"; exit 1; }
cp -r "$REPO/dist/admin/." "$OUT/admin/"
cp "$REPO/public"/admin/cms-chess.js "$OUT/admin/cms-chess.js"  # always test the freshly bundled component
# swap only the backend block (main admin and coach admin)
for cfg in "$OUT/admin/config.yml" "$OUT/admin/trener/config.yml"; do
python3 - "$cfg" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p).read()
s=re.sub(r'^backend:\n(?:  .*\n)+', 'backend:\n  name: test-repo\n', s, count=1, flags=re.M)
open(p,'w').write(s)
PY
done
# seed link so Sveltia fills its test repository with the real content files
for page in "$OUT/admin/index.html" "$OUT/admin/trener/index.html"; do
python3 - "$page" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
s=s.replace('<head>','<head>\n  <link rel="cms-seed-url" href="/seed/manifest.json" />',1)
open(p,'w').write(s)
PY
done
cd "$REPO"
# SEED_ARTICLES="slug1|slug2" seeds only those blog folders (the full archive is ~1,700 files)
if [ -n "$SEED_ARTICLES" ]; then
  FILES=$( (find src/content src/data public/images -type f ! -name '.gitkeep' ! -path 'src/content/blog/*'; find src/content/blog -type f | grep -E "/($SEED_ARTICLES)/") | sort)
else
  FILES=$(find src/content src/data public/images -type f ! -name '.gitkeep' | sort)
fi
for f in $FILES; do mkdir -p "$OUT/seed/$(dirname $f)"; cp "$f" "$OUT/seed/$f"; done
python3 -c "import json,sys; print(json.dumps({'files': sys.argv[1:]}))" $FILES > "$OUT/seed/manifest.json"
# vendor assets the site serves (chess pieces for the preview)
mkdir -p "$OUT/vendor"; cp -r "$REPO/public"/vendor/. "$OUT/vendor/"
echo "seeded $(echo "$FILES" | wc -l) files"
