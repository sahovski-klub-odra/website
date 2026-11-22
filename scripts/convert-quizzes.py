"""
Post-migration step (idempotent): the old site's quiz plugin stored each quiz as one long
zlib+base64 string of PHP-serialized data, which the importer carried over as unreadable text.
This turns it back into the quiz itself – questions, answer choices and the correct answer in a
collapsible "Rješenje" – at the same place in the article. Images in questions are copied from the
media mirror (--mirror, the folder used by the migration) next to the article.

  python3 scripts/convert-quizzes.py --mirror /path/to/mirror
"""
import base64, glob, html, os, re, shutil, sys, zlib

MIRROR = sys.argv[sys.argv.index('--mirror') + 1] if '--mirror' in sys.argv else ''
BLOB = re.compile(r'^(eJ[A-Za-z0-9+/=\\_-]{200,})\s*\n', re.M)
DESC_STATUS = re.compile(r'\s*\{\\"total[ _\\]*questions.*?just[ _\\]*started\\":true\}')
STATUS = re.compile(r'^\{\\?"total\\?_questions[^\n]*\}\s*\n', re.M)  # the plugin's progress counter


def php_unserialize(s: bytes):
    """Minimal PHP unserialize (strings, ints, bools, null, arrays, stdClass objects) → Python."""
    i = 0

    def read_until(ch):
        nonlocal i
        j = s.index(ch, i); v = s[i:j]; i = j + 1; return v

    def val():
        nonlocal i
        t = chr(s[i]); i += 2
        if t == 'N': return None
        if t == 'b': return read_until(b';') == b'1'
        if t == 'i': return int(read_until(b';'))
        if t == 'd': return float(read_until(b';'))
        if t == 's':
            n = int(read_until(b':')); i += 1  # opening quote
            v = s[i:i + n].decode('utf8', 'replace'); i += n + 2; return v
        if t in 'aO':
            if t == 'O':
                read_until(b':'); i += 1; read_until(b'"'); i += 1  # class name
            n = int(read_until(b':')); i += 1  # {
            d = {}
            for _ in range(n):
                k = val(); d[k] = val()
            i += 1  # }
            return d
        raise ValueError(f'unsupported type {t} at {i}')
    return val()


def clean(text: str) -> str:
    t = html.unescape(html.unescape(text or '')).replace('\r', '')
    # bold parts on one line (a line break inside ** … ** would break the formatting)
    t = re.sub(r'<b>\s*([\s\S]*?)\s*</b>', lambda m: '**' + re.sub(r'\s+', ' ', m.group(1)) + '**', t)
    return t.strip()


def convert(folder: str, m: re.Match) -> str:
    raw = base64.b64decode(m.group(1).replace('\\', ''))
    data = php_unserialize(zlib.decompress(raw))
    quiz = data.get('quiz') or {}
    qs = data.get('questions') or {}
    out = []
    desc = (quiz.get('meta') or {}).get('description')
    if desc: out.append(f'*{clean(desc)}*')
    for n, q in enumerate(qs.values(), 1):
        text = clean(q.get('question', ''))
        # images inside the question → local copies
        def img(mm):
            url = mm.group(1); name = os.path.basename(url.split('?')[0]).lower().replace('_', '-')
            src = os.path.join(MIRROR, 'wp-content', 'uploads', url.split('/wp-content/uploads/', 1)[-1]) if MIRROR and '/wp-content/uploads/' in url else ''
            if src and os.path.exists(src):
                shutil.copyfile(src, os.path.join(folder, name)); return f'\n\n![]({"./" + name})\n\n'
            return f' ([slika]({url})) '
        text = re.sub(r'<img[^>]*src="([^"]+)"[^>]*/?>', img, text)
        text = re.sub(r'<[^>]+>', '', text)
        # one paragraph per question (lines starting with "1." would otherwise become a numbered list)
        parts = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]
        body = '\n\n'.join(p if p.startswith('![') else re.sub(r'\s*\n\s*', ' ', p) for p in parts)
        out.append(f'**{n}.** {body}')
        answers = list((q.get('answers') or {}).values())
        letters = 'abcdefghij'
        out.append('\n'.join(f'- {letters[k]}) {clean(a.get("answer", ""))}' for k, a in enumerate(answers)))
        correct = [f'{letters[k]}) {clean(a.get("answer", ""))}' for k, a in enumerate(answers) if a.get('correct')]
        if correct:
            out.append(f'<details><summary>Rješenje</summary>\n\n{", ".join(correct)}\n\n</details>')
    return '\n\n'.join(out) + '\n\n'


done = 0
for f in sorted(glob.glob('src/content/blog/*/*/index.md')):
    s = open(f, encoding='utf8').read()
    if not BLOB.search(s): continue
    s = DESC_STATUS.sub('', s)
    s2 = STATUS.sub('', BLOB.sub(lambda m: convert(os.path.dirname(f), m), s))
    open(f, 'w', encoding='utf8').write(s2); done += 1
    print('quiz converted:', f.split('/')[-2])
print(done, 'article(s) with quizzes converted')
