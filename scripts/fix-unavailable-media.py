"""
Post-migration fixes for media the old site no longer serves (run after `npm run migrate`; idempotent).

 - flag icons hot-linked from third-party chess sites that are offline (2700chess.com, russiachess.org)
   → the equivalent emoji flag (country taken from the file name), so result tables stay readable
 - images/documents that return 404 on the old WordPress server itself
   → a visible note in the article, never a silent removal (listed in migration/unavailable-media.md)
"""
import re, glob, os, json

NAMES = {'United-States': 'us', 'Ukraine': 'ua', 'Uzbekistan': 'uz', 'Russia': 'ru', 'Italy': 'it', 'Bulgaria': 'bg',
         'France': 'fr', 'Armenia': 'am', 'Azerbaijan': 'az', 'Norway': 'no', 'India': 'in', 'Israel': 'il', 'Netherlands': 'nl',
         'China': 'cn', 'Hungary': 'hu', 'England': 'gb', 'Germany': 'de', 'Spain': 'es', 'Poland': 'pl', 'Croatia': 'hr'}
emoji = lambda cc: ''.join(chr(0x1F1E6 + ord(c) - 97) for c in cc.lower())

FLAG = re.compile(r'!\[([^\]]*)\]\((https?://(?:www\.2700chess\.com/countries/([A-Za-z-]+)\.gif|online\.russiachess\.org/content/flags/([a-z]{2})\.png))\)')
# images that 404 on the old server (or are not images at all)
DEAD_IMG = re.compile(r'\[?!\[([^\]]*)\]\((https?://(?:www\.)?sahovski-klub\.com/wp-content/uploads/[^)\s]+)\)\]?(?:\([^)\s]*\))?|\[\]\((https?://(?:www\.)?sahovski-klub\.com/wp-content/uploads/[^)\s]+\.(?:jpe?g|png|gif|bmp))\)')
NOTE_IMG = '*(fotografija {0} nije dostupna ni na staroj stranici)*'
NOTE_FILE = '{0} *(dokument nije dostupan ni na staroj stranici)*'

log = []
for f in sorted(glob.glob('src/content/blog/*/*/index.md')):
    s = open(f, encoding='utf8').read(); o = s
    def flag(m):
        cc = m.group(4) or NAMES.get(m.group(3) or '', '')
        if not cc: return m.group(0)
        log.append((f, 'flag', m.group(2)))
        name = m.group(3) or cc.upper()
        return f'<span role="img" aria-label="{name}">{emoji(cc)}</span>'
    s = FLAG.sub(flag, s)
    # the same icons inside HTML tables: <img title="Russia" src="http://www.2700chess.com/countries/Russia.gif" …>
    def flag_html(m):
        cc = m.group(2) or NAMES.get(m.group(1) or '', '')
        if not cc: return m.group(0)
        log.append((f, 'flag', m.group(0)[:80]))
        return f'<span role="img" aria-label="{m.group(1) or cc.upper()}">{emoji(cc)}</span>'
    s = re.sub(r'<img\b[^>]*src="https?://(?:www\.2700chess\.com/countries/([A-Za-z-]+)\.gif|online\.russiachess\.org/content/flags/([a-z]{2})\.png)"[^>]*>', flag_html, s)
    def dead(m):
        url = m.group(2) or m.group(3); alt = m.group(1) or os.path.basename(url)
        log.append((f, 'image', url))
        return NOTE_IMG.format(f'„{alt}”' if alt else '')
    s = DEAD_IMG.sub(dead, s)
    # documents linked to public/files/wp/… that could not be downloaded
    def doc(m):
        text, path = m.group(1), m.group(2)
        if os.path.exists('public' + path) or 'nije dostupan' in s[m.end():m.end() + 60]: return m.group(0)
        log.append((f, 'file', path))
        return NOTE_FILE.format(text)
    s = re.sub(r'(?<!!)\[([^\]]+)\]\((/files/wp/[^)\s]+)\)', doc, s)
    if s != o: open(f, 'w', encoding='utf8').write(s)

if log:
    os.makedirs('migration', exist_ok=True)
    with open('migration/unavailable-media.md', 'a', encoding='utf8') as out:
        out.write('\n## Media not available on the old website (handled by fix-unavailable-media.py)\n\n| Article | Type | Original | Now |\n|---|---|---|---|\n')
        for f, kind, url in log:
            now = 'emoji flag' if kind == 'flag' else 'visible note in the article'
            out.write(f'| {f.split("/")[-2]} | {kind} | {url} | {now} |\n')
print(len(log), 'references handled:', {k: sum(1 for x in log if x[1] == k) for k in ('flag', 'image', 'file')})
