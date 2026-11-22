#!/bin/bash
# Runs the real Sveltia CMS (from dist/admin) against a browser-local test repository and
# drives it with Playwright. Nothing is sent to GitHub. Usage: npm run build && tests/cms/run.sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
"$HERE/make-site.sh"
python3 -m http.server 8800 --directory "$HERE/site" >/dev/null 2>&1 &
SERVER=$!; trap 'kill $SERVER' EXIT; sleep 1
python3 "$HERE/workflow.py"
python3 "$HERE/extra.py"
python3 "$HERE/admin.py"
kill $SERVER; trap - EXIT
# build the website from exactly what the CMS saved and check the pages
"$HERE/build-saved.sh"
python3 "$HERE/admin.py"
echo "Screenshots and saved files: $HERE/output/"
