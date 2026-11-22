/**
 * HTML shell for the Sveltia CMS pages (/admin/ and /admin/trener/).
 *
 * Besides loading the CMS it adds a small "publishing status" badge: after a save, Sveltia commits to
 * GitHub and GitHub Actions rebuilds the site (~1–3 min). The badge polls the public GitHub API for the
 * latest "Deploy to GitHub Pages" run and shows "Objavljivanje u tijeku… / Objavljeno ✓ / Greška".
 * For a private repository the API needs a token, so the badge then only links to the Actions page.
 */
export function adminPage(opts: { title: string; assets: string; repo: string; workflowFile?: string }): string {
  const { title, assets, repo, workflowFile = 'deploy.yml' } = opts;
  return `<!doctype html>
<html lang="hr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${title}</title>
  <link rel="icon" href="${assets}../favicon.svg" type="image/svg+xml" />
  <style>
    #odra-publish{position:fixed;right:12px;bottom:12px;z-index:2147483000;font:600 13px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:#17191c;color:#f5f0e6;box-shadow:0 6px 24px -8px rgba(0,0,0,.6);text-decoration:none;opacity:.94}
    #odra-publish[hidden]{display:none}
    #odra-publish i{width:9px;height:9px;border-radius:50%;background:#9aa0a6;flex:none}
    #odra-publish[data-s=running] i{background:#d9b56d;animation:odra-p 1.2s ease-in-out infinite}
    #odra-publish[data-s=ok] i{background:#81b64c}
    #odra-publish[data-s=fail] i{background:#e5484d}
    @keyframes odra-p{50%{opacity:.25}}
    @media (prefers-reduced-motion:reduce){#odra-publish i{animation:none!important}}
  </style>
</head>
<body>
  <!-- Croatian interface by default (Sveltia ships a Croatian translation). Anyone can still switch the
       language in the CMS under account menu → Settings → Language; that choice is kept. -->
  <script>
  try {
    var k = 'sveltia-cms.prefs', p = JSON.parse(localStorage.getItem(k) || '{}') || {};
    if (!p.locale) { p.locale = 'hr'; localStorage.setItem(k, JSON.stringify(p)); }
  } catch (e) {}
  </script>
  <!-- Sveltia CMS, self-hosted (version pinned in package.json, copied by scripts/copy-vendor-assets.mjs) -->
  <script src="${assets}sveltia/sveltia-cms.js"></script>
  <!-- custom editor components: chess game, chess diagram, table -->
  <script src="${assets}cms-chess.js"></script>
  <a id="odra-publish" href="https://github.com/${repo}/actions/workflows/${workflowFile}" target="_blank" rel="noopener" hidden aria-live="polite"><i></i><span>Status objave</span></a>
  <script>
  (function () {
    var repo = ${JSON.stringify(repo)}, file = ${JSON.stringify(workflowFile)};
    var el = document.getElementById('odra-publish'), txt = el.querySelector('span');
    if (!/^[\\w.-]+\\/[\\w.-]+$/.test(repo) || repo === 'OWNER/REPO') return;
    var labels = { running: 'Objavljivanje u tijeku…', ok: 'Objavljeno na stranici ✓', fail: 'Objava nije uspjela – otvori detalje', none: 'Status objave' };
    var timer, fast = false;
    function show(state, when) {
      el.hidden = false; el.dataset.s = state;
      txt.textContent = labels[state] + (when && state === 'ok' ? ' (' + when + ')' : '');
      el.title = 'Otvara GitHub Actions – zadnja izgradnja stranice';
    }
    function poll() {
      if (document.hidden) return schedule();
      fetch('https://api.github.com/repos/' + repo + '/actions/workflows/' + file + '/runs?per_page=1', { headers: { Accept: 'application/vnd.github+json' } })
        .then(function (r) { if (!r.ok) throw r.status; return r.json(); })
        .then(function (d) {
          var run = d.workflow_runs && d.workflow_runs[0];
          if (!run) return show('none');
          if (run.status !== 'completed') { fast = true; return show('running'); }
          fast = false;
          var t = new Date(run.updated_at);
          show(run.conclusion === 'success' ? 'ok' : 'fail', t.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' }));
        })
        .catch(function () { show('none'); })
        .finally(schedule);
    }
    function schedule() { clearTimeout(timer); timer = setTimeout(poll, fast ? 15000 : 60000); }
    // a save in the CMS = a commit; check soon after the user clicks Save
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (b && /^(Save|Spremi|Publish|Objavi)/i.test((b.textContent || '').trim())) { fast = true; clearTimeout(timer); timer = setTimeout(poll, 8000); }
    }, true);
    poll();
  })();
  </script>
</body>
</html>`;
}
