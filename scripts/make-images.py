"""Generates the illustrated placeholder artwork in public/assets/images.
Replace any file with a real photograph (same name/path, or upload to Supabase Storage and change the URL in Admin)."""
import os, sys, re
sys.path.insert(0, os.path.dirname(__file__))
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'images')
LIME, INK, WHITE = '#c5f82a', '#0c0d0b', '#ffffff'

def svg(w, h, body, defs=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-hidden="true"><defs>{defs}</defs>{body}</svg>'
def save(path, s):
    p = os.path.join(OUT, path); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w').write(s)
def grad(id, a, b, x2='1', y2='1'):
    return f'<linearGradient id="{id}" x1="0" y1="0" x2="{x2}" y2="{y2}"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>'

def window(x, y, w, h, fill=WHITE, op=.96, dark=False):
    line = '#2a2c27' if dark else '#e7e9e2'
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="{fill}" opacity="{op}"/>'
            f'<rect x="{x}" y="{y}" width="{w}" height="40" rx="22" fill="{line}" opacity=".7"/>'
            + ''.join(f'<circle cx="{x+24+i*20}" cy="{y+20}" r="6" fill="{c}"/>' for i, c in enumerate(['#ff6b5e', '#ffc542', LIME])))

# motifs draw in the window content region x 150..650, y 190..450
def m_design():
    return (f'<circle cx="300" cy="320" r="74" fill="{LIME}"/><circle cx="380" cy="320" r="74" fill="{INK}" opacity=".9"/><circle cx="340" cy="270" r="74" fill="#8a7bff" opacity=".85"/>'
            f'<path d="M470 400 C520 250 560 430 610 260" stroke="{INK}" stroke-width="10" fill="none" stroke-linecap="round"/><circle cx="610" cy="260" r="12" fill="{LIME}" stroke="{INK}" stroke-width="5"/>')
def m_code():
    rows = [(0, 200, LIME), (30, 140, '#8a7bff'), (60, 260, INK), (60, 90, '#ffb020'), (30, 180, '#3ad6c5'), (0, 120, INK), (0, 220, LIME)]
    return ''.join(f'<rect x="{170+i2}" y="{210+n*32}" width="{w}" height="14" rx="7" fill="{c}"/>' for n, (i2, w, c) in enumerate(rows)) + f'<text x="520" y="350" font-family="monospace" font-size="120" font-weight="700" fill="{INK}" opacity=".85">&lt;/&gt;</text>'
def m_server():
    return ''.join(f'<rect x="200" y="{200+i*80}" width="400" height="60" rx="16" fill="{INK if i!=1 else LIME}"/><circle cx="235" cy="{230+i*80}" r="8" fill="{LIME if i!=1 else INK}"/><rect x="270" y="{223+i*80}" width="{200-i*30}" height="14" rx="7" fill="{WHITE if i!=1 else INK}" opacity=".5"/>' for i in range(3))
def m_stack():
    return ''.join(f'<path d="M400 {200+i*70} l150 55 l-150 55 l-150 -55 z" fill="{c}" opacity=".95" stroke="{INK}" stroke-width="3"/>' for i, c in enumerate(['#8a7bff', LIME, INK][::-1]))
def m_ux():
    return (f'<rect x="180" y="205" width="200" height="230" rx="14" fill="#f1f3ee" stroke="{INK}" stroke-width="3"/><rect x="196" y="222" width="168" height="70" rx="10" fill="{LIME}"/><rect x="196" y="306" width="100" height="12" rx="6" fill="{INK}"/><rect x="196" y="330" width="150" height="12" rx="6" fill="#c9ccc3"/><rect x="196" y="380" width="168" height="38" rx="19" fill="{INK}"/>'
            f'<rect x="420" y="205" width="200" height="110" rx="14" fill="#f1f3ee" stroke="{INK}" stroke-width="3" stroke-dasharray="10 8"/><rect x="420" y="330" width="200" height="105" rx="14" fill="#f1f3ee" stroke="{INK}" stroke-width="3" stroke-dasharray="10 8"/><path d="M560 300 l0 60 l16 -14 l14 30 l12 -6 l-14 -28 l22 -2 z" fill="{INK}" stroke="{WHITE}" stroke-width="3"/>')
def m_assist():
    cells = ''.join(f'<rect x="{190+c*62}" y="{240+r*52}" width="50" height="40" rx="10" fill="{LIME if (r,c) in [(0,2),(1,4),(2,1)] else "#eceee7"}"/>' for r in range(3) for c in range(7))
    return f'<rect x="180" y="200" width="440" height="24" rx="12" fill="{INK}"/>' + cells + f'<circle cx="590" cy="420" r="26" fill="{INK}"/><path d="M578 420 l9 9 l17 -19" stroke="{LIME}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
def m_pm():
    cols = ''
    for i in range(3):
        cols += f'<rect x="{170+i*158}" y="205" width="146" height="235" rx="14" fill="#eceee7"/>'
        for j in range(3 - i % 2):
            cols += f'<rect x="{182+i*158}" y="{222+j*68}" width="122" height="56" rx="10" fill="{[LIME, INK, "#8a7bff"][(i+j)%3]}" opacity=".95"/>'
    return cols
def m_data():
    bars = ''.join(f'<rect x="{190+i*62}" y="{440-h}" width="42" height="{h}" rx="10" fill="{LIME if i==4 else INK}"/>' for i, h in enumerate([70, 110, 90, 160, 210, 140]))
    return bars + '<path d="M200 330 L262 290 L324 310 L386 240 L448 210 L510 260" stroke="#8a7bff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
def m_shield():
    return (f'<path d="M400 195 L520 240 V330 C520 400 470 440 400 465 C330 440 280 400 280 330 V240 Z" fill="{INK}"/><path d="M400 220 L500 256 V330 C500 386 462 418 400 440 C338 418 300 386 300 330 V256 Z" fill="{LIME}"/>'
            f'<rect x="368" y="320" width="64" height="52" rx="10" fill="{INK}"/><path d="M380 320 v-18 a20 20 0 0 1 40 0 v18" stroke="{INK}" stroke-width="10" fill="none"/>')
def m_heart():
    return (f'<circle cx="400" cy="330" r="120" fill="none" stroke="{INK}" stroke-width="3" stroke-dasharray="6 10"/><circle cx="400" cy="330" r="80" fill="{LIME}"/><path d="M400 372 C340 330 350 285 380 285 C392 285 400 295 400 300 C400 295 408 285 420 285 C450 285 460 330 400 372 Z" fill="{INK}"/>')
def m_care():
    return (f'<circle cx="330" cy="290" r="46" fill="{INK}"/><circle cx="450" cy="322" r="32" fill="{LIME}"/><path d="M250 440 C250 370 410 370 410 440 Z" fill="{INK}"/><path d="M400 440 C400 395 500 395 500 440 Z" fill="{LIME}"/><path d="M540 250 C520 236 508 214 526 204 C536 199 544 205 548 212 C552 205 560 199 570 204 C588 214 576 236 556 250 Z" fill="#ff6b5e"/>')
MOTIFS = dict(design=m_design, code=m_code, server=m_server, stack=m_stack, ux=m_ux, assist=m_assist, pm=m_pm, data=m_data, shield=m_shield, heart=m_heart, care=m_care)
PAL = [('#0c0d0b', '#2b3a12'), ('#e9ffb0', '#c5f82a'), ('#161a10', '#3c5a0d'), ('#f3f5ee', '#dfe8c8')]

def cover(slug, motif, i, w=800, h=600):
    a, b = PAL[i % 4]; dark = i % 4 in (0, 2)
    body = f'<rect width="{w}" height="{h}" fill="url(#g)"/><circle cx="700" cy="90" r="180" fill="{LIME}" opacity="{.25 if dark else .5}"/><circle cx="90" cy="540" r="150" fill="#8a7bff" opacity=".22"/>'
    body += window(120, 130, 560, 360) + MOTIFS[motif]()
    save(f'courses/{slug}.svg', svg(w, h, body, grad('g', a, b)))

def tutor(slug, name, i):
    a, b = [('#dff9a0', '#b8ee1d'), ('#171a12', '#3b4d18'), ('#efe9ff', '#b9a9ff'), ('#0c0d0b', '#28331a'), ('#f4f6ef', '#d5e2b0'), ('#ffe9d6', '#ffc199'), ('#e6f7f4', '#9fe5da')][i]
    dark = a.startswith('#1') or a.startswith('#0')
    fg = WHITE if dark else INK
    ini = ''.join(w[0] for w in name.split()[:2])
    body = (f'<rect width="480" height="560" fill="url(#g)"/><circle cx="400" cy="90" r="120" fill="{LIME}" opacity=".35"/>'
            f'<circle cx="240" cy="220" r="92" fill="{fg}" opacity=".92"/><path d="M60 560 C60 380 140 330 240 330 C340 330 420 380 420 560 Z" fill="{fg}" opacity=".92"/>'
            f'<text x="240" y="245" text-anchor="middle" font-family="Plus Jakarta Sans,Arial,sans-serif" font-size="64" font-weight="800" fill="{a}">{ini}</text>')
    save(f'tutors/{slug}.svg', svg(480, 560, body, grad('g', a, b)))

def blog(slug, i):
    a, b = PAL[(i + 1) % 4]
    dots = ''.join(f'<circle cx="{60+c*70}" cy="{60+r*70}" r="4" fill="{INK}" opacity=".18"/>' for r in range(7) for c in range(12))
    shapes = [f'<rect x="420" y="90" width="300" height="300" rx="90" fill="{LIME}"/><circle cx="330" cy="330" r="110" fill="{INK}"/>',
              f'<circle cx="520" cy="230" r="150" fill="{INK}"/><rect x="300" y="250" width="240" height="120" rx="60" fill="{LIME}"/>',
              f'<path d="M520 90 L680 170 V290 C680 380 610 430 520 460 C430 430 360 380 360 290 V170 Z" fill="{INK}"/><path d="M520 130 L640 188 V290 C640 356 590 396 520 420 C450 396 400 356 400 290 V188 Z" fill="{LIME}"/>',
              f'<rect x="360" y="90" width="320" height="220" rx="24" fill="{INK}"/><rect x="390" y="120" width="120" height="16" rx="8" fill="{LIME}"/><rect x="390" y="150" width="240" height="12" rx="6" fill="{WHITE}" opacity=".5"/><rect x="390" y="176" width="200" height="12" rx="6" fill="{WHITE}" opacity=".5"/><circle cx="300" cy="360" r="90" fill="{LIME}"/>'][i]
    save(f'blog/{slug}.svg', svg(800, 500, f'<rect width="800" height="500" fill="url(#g)"/>{dots}{shapes}', grad('g', a, b)))

def hero():
    body = (f'<rect width="900" height="1000" fill="url(#g)"/><circle cx="740" cy="180" r="260" fill="{LIME}" opacity=".55"/><circle cx="120" cy="860" r="240" fill="#8a7bff" opacity=".35"/>'
            + f'<rect x="120" y="250" width="660" height="430" rx="34" fill="{INK}"/><rect x="146" y="276" width="608" height="378" rx="20" fill="#1a1d15"/>'
            + ''.join(f'<rect x="{180+ind}" y="{320+n*40}" width="{w}" height="16" rx="8" fill="{c}"/>' for n, (ind, w, c) in enumerate([(0, 240, LIME), (40, 300, '#8a7bff'), (40, 200, WHITE), (80, 260, '#3ad6c5'), (40, 340, WHITE), (0, 120, LIME), (0, 220, '#ffb020')]))
            + f'<path d="M60 700 H840 L800 740 H100 Z" fill="#2a2d24"/>'
            + f'<circle cx="640" cy="520" r="70" fill="{LIME}"/><path d="M618 520 l16 16 l30 -34" stroke="{INK}" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
            + f'<circle cx="250" cy="850" r="64" fill="{INK}"/><circle cx="380" cy="850" r="64" fill="{LIME}"/><circle cx="510" cy="850" r="64" fill="{WHITE}"/><circle cx="640" cy="850" r="64" fill="#8a7bff"/>')
    save('hero.svg', svg(900, 1000, body, grad('g', '#f7ffe0', '#dff9a0')))

def talent():
    body = (f'<rect width="800" height="900" fill="url(#g)"/><circle cx="640" cy="140" r="200" fill="{LIME}" opacity=".5"/>'
            + f'<rect x="90" y="150" width="620" height="380" rx="30" fill="{WHITE}"/><rect x="120" y="180" width="330" height="200" rx="18" fill="{INK}"/><path d="M250 240 l90 40 l-90 40 z" fill="{LIME}"/>'
            + f'<rect x="480" y="190" width="190" height="14" rx="7" fill="{INK}"/><rect x="480" y="222" width="150" height="12" rx="6" fill="#c9ccc3"/><rect x="480" y="250" width="170" height="12" rx="6" fill="#c9ccc3"/><rect x="480" y="300" width="120" height="42" rx="21" fill="{LIME}"/>'
            + ''.join(f'<circle cx="{170+i*110}" cy="700" r="56" fill="{c}"/><path d="M{114+i*110} 800 C{114+i*110} 740 {226+i*110} 740 {226+i*110} 800" fill="{c}"/>' for i, c in enumerate([INK, LIME, '#8a7bff', INK, '#3ad6c5'][:5])))
    save('talent.svg', svg(800, 900, body, grad('g', '#171a10', '#2f420f')))

def logo():
    mark = f'<rect width="64" height="64" rx="18" fill="{LIME}"/><path d="M42 22 A15 15 0 1 0 42 42" stroke="{INK}" stroke-width="8" fill="none" stroke-linecap="round"/><circle cx="46" cy="32" r="4.5" fill="{INK}"/>'
    save('logo-mark.svg', svg(64, 64, mark)); save('favicon.svg', svg(64, 64, mark))
    og = f'<rect width="1200" height="630" fill="{INK}"/><circle cx="1050" cy="90" r="260" fill="{LIME}" opacity=".9"/><g transform="translate(80 90) scale(1.4)">{mark}</g><text x="80" y="330" font-family="Arial,sans-serif" font-size="74" font-weight="800" fill="#fff">Practical tech skills,</text><text x="80" y="415" font-family="Arial,sans-serif" font-size="74" font-weight="800" fill="#fff">taught by professionals.</text><text x="80" y="520" font-family="Arial,sans-serif" font-size="34" fill="{LIME}">Courssins Technology Institute</text>'
    save('og-image.svg', svg(1200, 630, og))

sys.path.insert(0, '.')
import json, subprocess
data = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
    "import('file://" + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'public/assets/js/data.js')) + "').then(m=>console.log(JSON.stringify({c:m.courses.map(x=>[x.slug,x.icon]),t:m.tutors.map(x=>[x.slug,x.full_name]),p:m.posts.map(x=>x.slug)})))"]))
for i, (s, ic) in enumerate(data['c']): cover(s, ic, i)
for i, (s, n) in enumerate(data['t']): tutor(s, n, i)
for i, s in enumerate(data['p']): blog(s, i)
hero(); talent(); logo()
print('ok', len(data['c']), len(data['t']), len(data['p']))
