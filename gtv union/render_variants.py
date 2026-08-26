#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""GTV Union - VARIANTI STILISTICHE della grafica piloti (1080x1080).

Genera, per ogni categoria reale in listapiloti.csv, quattro skin grafici
alternativi (NEON / CARBON / DYNAMIC / LUX) mantenendo le STESSE informazioni
della grafica originale render_graphics.py:
  - logo GTV + badge Union + titolo "PILOTI ISCRITTI"
  - sottotitolo LEGA UNION E-SPORT · 2026 · ROUND 2
  - banner categoria + "N PILOTI IN SQUADRA"
  - roster piloti (numero di gara, nome, eventuale tempo)
  - footer UNION 2026 · ROUND 2 · GTV CORSE

Dipendenze: Pillow + importa utility/colori condivisi da render_graphics.py.
"""
import math, os
from PIL import Image, ImageDraw, ImageFilter

import render_graphics as G

BASE = G.BASE
SIZE = G.SIZE

WHITE  = G.WHITE
GRAY   = G.GREY
GRAY_L = G.GREY_L

BAND_TOP, BAND_BOT = 390, 990   # fascia verticale in cui cadono le card roster


def roof_cols(n):
    return 1 if n <= 2 else (2 if n <= 8 else 3)


def _round(im, rad):
    return G.rounded(im, rad)


def _clip(img, mask):
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def disco(img, x, y, r, fill):
    ImageDraw.Draw(img).ellipse([x - r, y - r, x + r, y + r], fill=fill)


def draw_header(img, accent):
    gtv = G.load_logo(G.LOGO_GTV, 360, 112)
    G.paste_mid(img, gtv, 540, 76)
    uni = G.load_logo(G.LOGO_UNION, 130, 130, circle=True)
    G.paste_mid(img, uni, 962, 84)


def draw_footer(img):
    G.put_text(img, (540, 1040), 'UNION 2026  ·  ROUND 2  ·  GTV CORSE', G.F_MED(18), WHITE)


# ---------------------------------------------------------------------------
# ROSTER: griglia comune, card "skin-aware"
# ---------------------------------------------------------------------------
def draw_roster(img, pilots, accent, style):
    n = len(pilots)
    ncols = roof_cols(n)
    nrows = math.ceil(n / ncols)
    cw = {1: 720, 2: 500, 3: 330}[ncols]
    ch = 116
    gap_w, gap_h = 24, 26
    block_w = ncols * cw + (ncols - 1) * gap_w
    block_h = nrows * ch + (nrows - 1) * gap_h
    left0 = int((SIZE - block_w) / 2)
    top0 = int(BAND_TOP + (BAND_BOT - BAND_TOP - block_h) / 2)

    for i, p in enumerate(pilots):
        r, c = divmod(i, ncols)
        x0 = left0 + c * (cw + gap_w)
        y0 = top0 + r * (ch + gap_h)
        _card(img, style, accent, x0, y0, cw, ch, p)
    return img


def _card(img, style, accent, x0, y0, cw, ch, p):
    num = p['num'] or '0'
    nome = p['nome']
    tempo = p['t1']
    d = ImageDraw.Draw(img)

    if style == 'neon':
        card = Image.new('RGBA', (cw, ch), (16, 16, 26, 242))
        card = _round(card, 20)
        img.paste(card, (x0, y0), card)
        d.rounded_rectangle([x0, y0, x0 + cw - 1, y0 + ch - 1], 20, outline=accent, width=3)
        d.rounded_rectangle([x0 + 5, y0 + 5, x0 + cw - 6, y0 + ch - 6], 16, outline=accent + (90,), width=1)
        G.put_text(img, (x0 + cw / 2, y0 + 44), num, G.F_BLD(58), accent)
        G.put_text(img, (x0 + cw / 2, y0 + 96), nome, G.F_MED(25), WHITE)
        if tempo:
            G.put_text(img, (x0 + cw / 2, y0 + 70), tempo, G.F_COND(14), GRAY_L)

    elif style == 'carbon':
        card = Image.new('RGBA', (cw, ch), (22, 24, 32, 255))
        card = _round(card, 6)
        img.paste(card, (x0, y0), card)
        d.rectangle([x0, y0, x0 + cw - 1, y0 + ch - 1], outline=(255, 255, 255, 30), width=1)
        d.rectangle([x0 + 24, y0 + 20, x0 + 104, y0 + ch - 20], outline=accent, width=2)
        G.put_text(img, (x0 + 64, y0 + ch / 2), num, G.F_BLD(48), accent)
        # nome innestato a destra del blocco numero, con auto-fit
        name_x = x0 + 128
        space_x = x0 + cw - name_x - 18
        fs = 24
        f = G.F_MED(fs)
        while fs > 12 and G.tsize(img, nome, f)[0] > space_x:
            fs -= 1
            f = G.F_MED(fs)
        G.put_text(img, (name_x + space_x / 2.0, y0 + ch / 2), nome, f, WHITE, center=False)
        if tempo:
            G.put_text(img, (name_x + space_x / 2.0, y0 + ch / 2 + 24), tempo, G.F_REG(14), GRAY_L, center=False)
        d.line([(x0 + cw - 24, y0 + ch - 22), (x0 + cw - 60, y0 + ch - 22)], fill=accent, width=4)

    elif style == 'dynamic':
        card = Image.new('RGBA', (cw, ch), (26, 21, 44, 255))
        m = Image.new('L', (cw, ch), 0)
        ImageDraw.Draw(m).polygon([(22, 0), (cw - 22, 0), (cw, ch), (0, ch)], fill=255)
        card = _clip(card, m)
        img.paste(card, (x0, y0), card)
        d.polygon([(x0 + 22, y0), (x0 + cw - 22, y0), (x0 + cw, y0 + ch), (x0, y0 + ch)],
                  outline=accent, width=3)
        G.put_text(img, (x0 + cw / 2, y0 + 44), num, G.F_BLD(60), WHITE)
        G.put_text(img, (x0 + cw / 2, y0 + 96), nome, G.F_MED(25), accent)
        if tempo:
            G.put_text(img, (x0 + cw / 2, y0 + 72), tempo, G.F_COND(15), GRAY_L)

    else:  # lux
        card = Image.new('RGBA', (cw, ch), (24, 26, 34, 255))
        card = _round(card, 14)
        img.paste(card, (x0, y0), card)
        d.rounded_rectangle([x0, y0, x0 + cw - 1, y0 + ch - 1], 14, outline=(255, 255, 255, 28), width=1)
        d.line([(x0 + 24, y0 + ch - 30), (x0 + 92, y0 + ch - 30)], fill=accent, width=3)
        G.put_text(img, (x0 + cw / 2, y0 + 44), num, G.F_BLD(52), WHITE)
# ---------------------------------------------------------------------------
# STYLE 1 - NEON AUDIENCE (night-club racing)
# ---------------------------------------------------------------------------
def skin_neon(cat, pilots, accent):
    img = Image.new('RGBA', (SIZE, SIZE), (8, 8, 14))
    glow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    disco(glow, 540, 250, 680, accent + (80,))
    disco(glow, 140, 960, 520, (90, 200, 255, 55))
    disco(glow, 940, 960, 500, (210, 120, 255, 55))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(90)))
    d = ImageDraw.Draw(img)
    for x in range(0, SIZE, 60):
        d.line([(x, 0), (x, SIZE)], fill=(255, 255, 255, 9), width=1)
    for y in range(0, SIZE, 60):
        d.line([(0, y), (SIZE, y)], fill=(255, 255, 255, 9), width=1)

    draw_header(img, accent)
    G.put_text(img, (540, 172), 'PILOTI ISCRITTI', G.F_BLD(40), WHITE)
    G.put_text(img, (540, 219), 'LEGA UNION E-SPORT  ·  2026  ·  ROUND 2', G.F_REG(20), GRAY_L)

    label = cat.upper()
    fl = G.F_BLD(26)
    pw = max(400, G.tsize(img, label, fl)[0] + 110)
    xL = int(540 - pw / 2)
    pan = _round(Image.new('RGBA', (pw, 82), (18, 18, 30, 235)), 22)
    img.paste(pan, (xL, 276), pan)
    pd = ImageDraw.Draw(img)
    pd.rounded_rectangle([xL - 8, 268, xL + pw + 7, 366], 28, outline=accent + (70,), width=2)
    pd.rounded_rectangle([xL, 276, xL + pw - 1, 358], 22, outline=accent, width=3)
    G.put_text(img, (540, 300), label, fl, accent)
    G.put_text(img, (540, 333), '%d PILOTI IN SQUADRA' % len(pilots), G.F_REG(15), GRAY_L)

    draw_roster(img, pilots, accent, 'neon')
    draw_footer(img)
    return img


# ---------------------------------------------------------------------------
# STYLE 2 - CARBON / PIT-WALL (look tecnico)
# ---------------------------------------------------------------------------
def skin_carbon(cat, pilots, accent):
    img = Image.new('RGBA', (SIZE, SIZE), (9, 10, 13))
    d = ImageDraw.Draw(img)
    for x in range(-SIZE, SIZE, 90):
        d.polygon([(x, 0), (x + 45, 0), (x - 90, SIZE), (x - 135, SIZE)], fill=(14, 15, 19, 255))
    for yy, col in ((0, (0, 210, 255)), (SIZE - 14, (255, 180, 0))):
        d.rectangle([0, yy, SIZE, yy + 14], fill=col)
    d.rectangle([0, 46, SIZE, 52], fill=(255, 255, 255, 40))

    draw_header(img, accent)
    G.put_text(img, (540, 172), 'PILOTI ISCRITTI', G.F_BLD(40), WHITE)
    G.put_text(img, (540, 219), 'LEGA UNION E-SPORT  ·  2026  ·  ROUND 2', G.F_REG(20), GRAY_L)
    d.rectangle([60, 252, 1020, 253], fill=(255, 255, 255, 40))
    for xx in (46, 1035):
        for i in range(8):
            d.line([(xx, 120 + i * 26), (xx + 20, 120 + i * 26)], fill=(255, 255, 255, 30), width=2)

    label = cat.upper()
    fl = G.F_BLD(24)
    pw = max(400, G.tsize(img, label, fl)[0] + 130)
    xL, xR = int(540 - pw / 2), int(540 - pw / 2) + pw
    pan = Image.new('RGBA', (pw, 84), (18, 20, 26, 255))
    ImageDraw.Draw(pan).polygon([(0, 0), (pw, 0), (pw, 0), (pw - 30, 84), (0, 84)], fill=(26, 29, 37, 255))
    img.paste(pan, (xL, 275), pan)
    d.polygon([(xL, 275), (xR, 275), (xR - 30, 359), (xL, 359)], outline=accent, width=2)
    G.put_text(img, (540, 298), label, fl, accent)
    G.put_text(img, (540, 333), '%d PILOTI IN SQUADRA' % len(pilots), G.F_REG(15), GRAY_L)

    draw_roster(img, pilots, accent, 'carbon')
    draw_footer(img)
    return img
# ---------------------------------------------------------------------------
# STYLE 3 - DYNAMIC / PISTA (strisce, card angolate)
# ---------------------------------------------------------------------------
def skin_dynamic(cat, pilots, accent):
    img = Image.new('RGBA', (SIZE, SIZE), (12, 10, 22))
    d = ImageDraw.Draw(img)
    for i in range(-1, 16):
        x0 = i * 160
        d.polygon([(x0, 0), (x0 + 70, 0), (x0 - 90, SIZE), (x0 - 160, SIZE)], fill=accent + (14,))
    # leggero velo centrale per leggibilita'
    img = Image.alpha_composite(img, Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0)))

    draw_header(img, accent)
    G.put_text(img, (540, 172), 'PILOTI ISCRITTI', G.F_BLD(42), WHITE)
    G.put_text(img, (540, 219), 'LEGA UNION E-SPORT  ·  2026  ·  ROUND 2', G.F_REG(20), GRAY_L)
    d = ImageDraw.Draw(img)
    for i, t in enumerate(range(0, 60, 12)):
        d.line([(540 - 30, 242 + t), (540 + 30, 242 + t)], fill=accent + (120 - i * 10,), width=3)

    label = cat.upper()
    fl = G.F_BLD(28)
    pw = max(430, G.tsize(img, label, fl)[0] + 130)
    xL, yT = int(540 - pw / 2), 276
    pan = Image.new('RGBA', (pw, 84), (28, 22, 48, 255))
    m = Image.new('L', (pw, 84), 0)
    ImageDraw.Draw(m).polygon([(16, 0), (pw - 16, 0), (pw, 42), (pw - 16, 84), (16, 84), (0, 42)], fill=255)
    pan = _clip(pan, m)
    img.paste(pan, (xL, yT), pan)
    d.line([(xL + 16, yT), (xL + pw - 16, yT), (xL + pw, yT + 42), (xL + pw - 16, yT + 84),
            (xL + 16, yT + 84), (xL, yT + 42)], fill=accent, width=3)
    G.put_text(img, (540, 300), label, fl, WHITE)
    G.put_text(img, (540, 334), '%d PILOTI IN SQUADRA' % len(pilots), G.F_REG(15), GRAY_L)

    draw_roster(img, pilots, accent, 'dynamic')
    draw_footer(img)
    return img


# ---------------------------------------------------------------------------
# STYLE 4 - LUX (minimal scuro, pulito ed elegante)
# ---------------------------------------------------------------------------
def skin_lux(cat, pilots, accent):
    img = Image.new('RGBA', (SIZE, SIZE), (16, 17, 22))
    gl = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    disco(gl, 540, 620, 520, accent + (30,))
    img = Image.alpha_composite(img, gl.filter(ImageFilter.GaussianBlur(80)))

    draw_header(img, accent)
    G.put_text(img, (540, 172), 'PILOTI ISCRITTI', G.F_BLD(36), WHITE)
    G.put_text(img, (540, 216), 'LEGA UNION E-SPORT  ·  2026  ·  ROUND 2', G.F_REG(18), GRAY_L)
    d = ImageDraw.Draw(img)
    d.line([(260, 250), (820, 250)], fill=accent + (90,), width=2)

    label = cat.upper()
    fl = G.F_BLD(26)
    pw = max(380, G.tsize(img, label, fl)[0] + 100)
    xL = int(540 - pw / 2)
    d.rounded_rectangle([xL, 280, xL + pw, 358], 40, outline=accent, width=2)
    d.ellipse([xL + 34, 300, xL + 62, 328], fill=accent)
    G.put_text(img, (540, 300), label, fl, WHITE)
    G.put_text(img, (540, 342), '%d PILOTI IN SQUADRA' % len(pilots), G.F_REG(15), GRAY)

    draw_roster(img, pilots, accent, 'lux')
    draw_footer(img)
    return img
# ---------------------------------------------------------------------------
# MAIN - genera tutti gli skin per ogni categoria
# ---------------------------------------------------------------------------
def main():
    csvp = os.path.join(G.BASE, 'listapiloti.csv')
    rows = G.parse_csv(csvp)
    groups = {}
    for r in rows:
        groups.setdefault(r['cat'], []).append(r)
    order = {name.upper(): i for i, (name, _) in enumerate(G.TIERS)}

    def sort_key(k):
        ku = k.strip().upper()
        return (order.get(ku, len(order)), ku)

    skins = [
        ('NEON',    skin_neon),
        ('CARBON',  skin_carbon),
        ('DYNAMIC', skin_dynamic),
        ('LUX',     skin_lux),
    ]
    for cat in sorted(groups.keys(), key=sort_key):
        pilots = groups[cat]
        accent = G.accent_for(cat)
        rank_no = order.get(cat.strip().upper(), 99) + 1
        safe = cat.strip().upper().replace(' ', '_')
        for sname, fn in skins:
            img = fn(cat, pilots, accent).convert('RGB')
            out = os.path.join(G.BASE, '%s_%d_%s.png' % (sname, rank_no, safe))
            img.save(out, 'PNG')
            print('salvato', out, '(%d piloti)' % len(pilots))


if __name__ == '__main__':
    main()