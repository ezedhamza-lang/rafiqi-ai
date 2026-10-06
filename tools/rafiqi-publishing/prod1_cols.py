# -*- coding: utf-8 -*-
"""ملف أعمدة الحبر في ترويسة الإنتاج س1 لكشف حدود الكلمات."""
import os, sys, json
import pymupdf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fix_level as FL
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
F = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
SRC = os.path.join(F, "رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf")
d = pymupdf.open(SRC)
p = d[int(sys.argv[1]) - 1] if len(sys.argv) > 1 else d[9]
band = pymupdf.Rect(205, 33, 392, 54)
pix = p.get_pixmap(matrix=pymupdf.Matrix(1, 1), clip=band)
w, n, s = pix.width, pix.n, pix.samples
cols = []
for x in range(w):
    cnt = 0
    for y in range(pix.height):
        i = (y * w + x) * n
        L = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]
        if L < 200:
            cnt += 1
    cols.append(cnt)
# كلمات = مجمّعات أعمدة بفجوة >= 2
words, cur = [], None
gap = 0
for x, c in enumerate(cols):
    if c > 0:
        if cur is None:
            cur = [x, x]
        else:
            cur[1] = x
        gap = 0
    else:
        if cur is not None:
            gap += 1
            if gap >= 2:
                words.append((band.x0 + cur[0], band.x0 + cur[1]))
                cur = None
                gap = 0
if cur:
    words.append((band.x0 + cur[0], band.x0 + cur[1]))
print(json.dumps([[round(a, 1), round(b, 1)] for a, b in words], ensure_ascii=False))
d.close()