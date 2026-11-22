"""Checks the pages built from CMS output (called by build-saved.sh)."""
import re, sys, os, glob
D = sys.argv[1]
ok_all = True
def read(p):
    return open(os.path.join(D, p), encoding='utf8').read()
def check(name, ok, detail=''):
    global ok_all
    ok_all &= bool(ok)
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))

a = read('novosti/bozicni-turnir-2026-izvjestaj-durdevac/index.html')
check('Article page built with SEO title', '<title>Božićni turnir 2026 | ŠK Odra</title>' in a, re.search(r'<title>[^<]*', a).group(0))
check('Featured image rendered (optimised)', bool(re.search(r'<img[^>]+foto-1[^>]+\.(webp|jpg)', a)))
check('Image in the text rendered', bool(re.search(r'<img[^>]+foto-2', a)))
check('Table rendered', '<table' in a and 'Bodovi' in a)
check('YouTube line became a video embed', 'dQw4w9WgXcQ' in a and ('youtube' in a.lower()))
check('Croatian characters intact', 'čćžšđ' in a)
check('Categories shown', 'Turniri' in a)
check('Deleted demo article not built', not os.path.exists(os.path.join(D, 'novosti/demo-sahovske-partije/index.html')))
g = read('galerija/index.html')
alb = glob.glob(os.path.join(D, 'galerija/*prvenstvo-kluba-2026*/index.html'))
check('Album page built', len(alb) == 1)
if alb:
    h = open(alb[0], encoding='utf8').read()
    n = len(set(re.findall(r'foto-[123]\.[A-Za-z0-9_-]+', h)))
    check('Album shows the 3 uploaded photos', len(set(re.findall(r'foto-([123])', h))) == 3)
check('Album category shown in the gallery', 'Turniri' in g)
m = read('clanovi/index.html')
check('New member shown with photo', 'Novi Član Čćžšđ' in m and '/images/members/foto-3.webp' in m)
check('Removed member gone', 'Ana Predović' not in m)
s = read('raspored/index.html')
check('Announcement shown on the schedule page', 'Za vrijeme školskih praznika nema treninga' in s)
h = read('index.html')
check('Announcement shown on the homepage', 'Za vrijeme školskih praznika nema treninga' in h)
k = read('kontakt/index.html')
check('New phone number on the contact page', '01 234 5678' in k)
check('Facebook link in the footer', 'facebook.com/primjer' in k)
sys.exit(0 if ok_all else 1)
