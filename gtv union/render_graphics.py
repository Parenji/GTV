#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""GTV Union - generatore grafica piloti quadrata 1080x1080 (Instagram).

Legge listapiloti.csv (col 1 = nome, col 2 = categoria/rank) e genera
un PNG quadrato per ognuna delle categorie reali presenti, con layout
adattivo che si adatta al numero di piloti (categorie piccole = 1-2 colonne).
"""
import csv, math, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
SIZE = 1080

# ----- palette base -----
GTV_YELLOW = (255, 200, 0)
GOLD_T     = (255, 226, 140)
WHITE      = (255, 255, 255)
GREY       = (150, 150, 170)
GREY_L     = (210, 210, 224)
BG_DARK    = (13, 13, 18)
BG_DARK2   = (20, 20, 28)
CARD       = (31, 31, 42)
CARD_HL    = (44, 44, 58)
CARD_EDGE  = (58, 58, 74)

# ----- accenti per categoria (scala di classifica piu' bassa = colore freddo) -----
TIERS = [
    ('STAR',       (255, 208, 60)),
    ('ELITE',      (232, 82, 96)),
    ('PRO GOLD',   (255, 168, 0)),
    ('PRO SILVER', (196, 210, 226)),
    ('PRO AMA',    (212, 140, 60)),
    ('AMA',        (120, 168, 235)),
]
TIER_COLOR = dict(TIERS)
def accent_for(cat):
    return TIER_COLOR.get(cat.strip().upper(), GTV_YELLOW)

LOGO_GTV   = os.path.join(BASE, 'GTV.png')
LOGO_UNION = os.path.join(BASE, 'LEGA_UNION_E-SPORT_2025-800x800.png')

# Font ufficiali della grafica: Formula 1 Regular per la maggior parte dei
# testi e Formula 1 Display Bold per il numero di gara / testi in evidenza.
F1    = os.path.join(BASE, 'Formula1-Regular.otf')
F1BD  = os.path.join(BASE, 'Formula1 Display-Bold.otf')

def fnt(path, size, idx=0):
    try:
        return ImageFont.truetype(path, size, index=idx)
    except Exception:
        return ImageFont.load_default()

def F_BLK(s): return fnt(F1, s)
def F_BLD(s): return fnt(F1BD, s)
def F_COND(s): return fnt(F1, s)
def F_MED(s): return fnt(F1, s)
def F_LGT(s): return fnt(F1, s)
def F_REG(s): return fnt(F1, s)

# ---------- utility ----------
def fit(src, box):
    w, h = src; bw, bh = box
    r = min(bw / w, bh / h)
    return max(1, int(w * r)), max(1, int(h * r))

def load_logo(path, max_w, max_h, circle=False):
    im = Image.open(path).convert('RGBA')
    s = fit(im.size, (max_w, max_h))
    im = im.resize(s, Image.LANCZOS)
    if circle:
        side = min(s)
        c = im.crop(((s[0]-side)//2, (s[1]-side)//2,
                     (s[0]-side)//2+side, (s[1]-side)//2+side))
        m = Image.new('L', (side, side), 0)
        ImageDraw.Draw(m).ellipse([0, 0, side-1, side-1], fill=255)
        out = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        out.paste(c, (0, 0), m)
        return out
    return im

def tsize(im, txt, fnt):
    b = ImageDraw.Draw(im).textbbox((0, 0), txt, font=fnt)
    return b[2]-b[0], b[3]-b[1]

def put_text(im, xy, txt, fnt, fill=WHITE, center=True):
    d = ImageDraw.Draw(im)
    w, h = tsize(im, txt, fnt)
    x = int(xy[0]-w/2) if center else int(xy[0])
    y = int(xy[1]-h/2) if center else int(xy[1])
    d.text((x, y), txt, font=fnt, fill=fill)
    return im

def paste_mid(im, logo, cx, cy):
    im.paste(logo, (int(cx-logo.size[0]/2), int(cy-logo.size[1]/2)), logo)
    return im

def rounded(im, rad):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.size[0]-1, im.size[1]-1], rad, fill=255)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), m)
    return out

def glow_img(cx, cy, rx, ry, alpha=55, color=(255, 215, 25), blur=55):
    grad = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(grad).ellipse([cx-rx, cy-ry, cx+rx, cy+ry], fill=color+(alpha,))
    return grad.filter(ImageFilter.GaussianBlur(blur))

def frame_corners(img, color, t=6, inset=24, rad=44):
    d = ImageDraw.Draw(img)
    L, T = inset, inset; R, B = SIZE-inset, SIZE-inset
    for (cx, cy, sx, sy) in [(L, T, 1, 1), (R, T, -1, 1), (L, B, 1, -1), (R, B, -1, -1)]:
        d.line([(cx, cy+sy*rad), (cx, cy), (cx+sx*rad, cy)], fill=color, width=t)
    return img

# ---------- parsing CSV ----------
def parse_csv(path):
    rows = []
    with open(path, newline='', encoding='utf-8-sig') as f:
        for r in csv.reader(f):
            if not r or not r[0].strip():
                continue
            nome = r[0].strip()
            if nome.lower() == 'username':    # riga di intestazione
                continue
            rows.append({'nome': nome,
                         'cat': r[1].strip() if len(r) > 1 else '',
                         'num': r[2].strip() if len(r) > 2 and r[2].strip() else '0',
                         't1': r[3].strip() if len(r) > 3 else '',
                         't2': r[4].strip() if len(r) > 4 else ''})
    return rows


def draw_header(img, accent):
    """Loghi + titolo condivisi da tutte le categorie."""
    # logo GTV CENTRALE in alto
    gtv = load_logo(LOGO_GTV, 340, 104)
    paste_mid(img, gtv, 540, 76)
    # badge Union in alto a destra
    union = load_logo(LOGO_UNION, 120, 120, circle=True)
    paste_mid(img, union, 962, 84)

    put_text(img, (540, 172), 'PILOTI ISCRITTI', F_BLD(38), WHITE)
    put_text(img, (540, 219), 'LEGA UNION E-SPORT  ·  2026  ·  ROUND 2', F_LGT(20), GREY_L)
    # filo di accento sotto il titolo
    d = ImageDraw.Draw(img)
    d.line([(60, 251), (SIZE-60, 251)], fill=accent+(70,), width=2)
    return img


def render_roster(img, pilots, accent):
    n = len(pilots)
    # colonne in base alla numerosita' (categorie piccole -> poche colonne)
    ncols = 1 if n <= 2 else (2 if n <= 6 else 3)
    nrows = math.ceil(n / ncols)
    cw = {1: 720, 2: 504, 3: 330}[ncols]
    ch = 120
    gap_w, gap_h = 24, 28

    block_w = ncols*cw + (ncols-1)*gap_w
    block_h = nrows*ch + (nrows-1)*gap_h
    left0 = int((SIZE - block_w) / 2)

    band_top = 366
    band_bot = 995
    top0 = int(band_top + (band_bot - band_top - block_h) / 2)

    for i, p in enumerate(pilots):
        r, c = divmod(i, ncols)
        x0 = left0 + c*(cw+gap_w)
        y0 = top0 + r*(ch+gap_h)
        card = Image.new('RGBA', (cw, ch), CARD)
        card = rounded(card, 18)
        img.paste(card, (x0, y0), card)
        # bordo accent
        ImageDraw.Draw(img).rounded_rectangle([x0, y0, x0+cw-1, y0+ch-1], 18,
                                              outline=CARD_EDGE, width=2)
        # numero di gara reale (in evidenza)
        num = p['num'] or '0'
        fn = F_BLD(64)
        put_text(img, (x0+cw/2, y0+42), num, fn, accent)
        # nome
        fname = F_MED(27) if ncols >= 2 else F_MED(31)
        put_text(img, (x0+cw/2, y0+86), p['nome'], fname, WHITE)
        # tempo piccolo sotto il nome (se fornito nel csv)
        if p['t1']:
            put_text(img, (x0+cw/2, y0+112), p['t1'], F_COND(16), GREY)
        # linea sottile di base
        ImageDraw.Draw(img).line([(x0+24, y0+ch-4), (x0+cw-24, y0+ch-4)],
                                 fill=accent+(90,), width=2)
    return img


def render_category(cat, pilots):
    accent = accent_for(cat)
    img = Image.new('RGBA', (SIZE, SIZE), BG_DARK)
    img = Image.alpha_composite(img, glow_img(540, 250, 620, 300, 45, accent))
    d = ImageDraw.Draw(img)
    for i in range(8):
        d.line([(-260+i*170, SIZE), (-60+i*170, 0)], fill=accent+(18,), width=2)
    frame_corners(img, accent)

    draw_header(img, accent)

    # banner categoria
    label = '%s' % cat.upper()
    fl = F_COND(24)
    lw, lh = tsize(img, label, fl)
    bw = max(360, lw + 80)
    bnr = Image.new('RGBA', (bw, 78), CARD_HL)
    bnr = rounded(bnr, 16)
    img.paste(bnr, (int(540-bw/2), 276), bnr)
    # bordino accent
    bd = ImageDraw.Draw(img)
    bd.rounded_rectangle([int(540-bw/2), 276, int(540-bw/2)+bw, 354], 16,
                         outline=accent, width=2)
    put_text(img, (540, 300), label, fl, accent)
    put_text(img, (540, 332), '%d PILOTI IN SQUADRA' % len(pilots), F_REG(15), GREY)

    render_roster(img, pilots, accent)

    put_text(img, (540, 1040), 'UNION 2026  ·  ROUND 2  ·  GTV CORSE',
             F_MED(18), WHITE)
    return img
def main():
    csvp = os.path.join(BASE, 'listapiloti.csv')
    rows = parse_csv(csvp)
    groups = {}
    for r in rows:
        groups.setdefault(r['cat'], []).append(r)
    # ordine categorie secondo la scala classifica (STAR..AMA), il resto alfabetico
    order = {name.upper(): i for i, (name, _) in enumerate(TIERS)}
    def sort_key(k):
        ku = k.strip().upper()
        return (order.get(ku, len(order)), ku)
    for cat in sorted(groups.keys(), key=sort_key):
        pilots = groups[cat]
        cat_upper = cat.strip().upper()
        rank_no = order.get(cat_upper, 99) + 1          # 1=STAR, 2=ELITE, ...
        safe = cat_upper.replace(' ', '_')
        out = os.path.join(BASE, '%d_%s.png' % (rank_no, safe))
        render_category(cat, pilots).convert('RGB').save(out, 'PNG')
        print('salvato', out, '(%d piloti)' % len(pilots))

if __name__ == '__main__':
    main()