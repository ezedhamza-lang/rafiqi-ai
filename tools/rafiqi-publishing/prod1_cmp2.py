# -*- coding: utf-8 -*-
"""ورقة قبل/بعد لترويسة كاملة (السطران) — كتاب الإنتاج s1."""
import os, sys, io
import pymupdf
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "prod1_sheets")
A = os.path.join(FIXED := r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED",
                 "رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf")
B = os.path.join(HERE, "prod1_out", "رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf")
pages = [int(x) for x in sys.argv[1:]] or [10]
clip = pymupdf.Rect(200, 28, 392, 82)
da, db = pymupdf.open(A), pymupdf.open(B)
cells = []
for n in pages:
    ims = []
    for d in (da, db):
        pix = d[n - 1].get_pixmap(matrix=pymupdf.Matrix(5, 5), clip=clip)
        ims.append(Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB"))
    w = max(i.width for i in ims)
    c = Image.new("RGB", (w, sum(i.height for i in ims) + 6), (200, 30, 30))
    y = 0
    for im in ims:
        c.paste(im, (0, y)); y += im.height + 6
    cells.append(c)
W = max(c.width for c in cells) + 16
H = sum(c.height for c in cells) + 8 * (len(cells) + 1)
sheet = Image.new("RGB", (W, H), (235, 235, 235))
y = 8
for c in cells:
    sheet.paste(c, ((W - c.width) // 2, y)); y += c.height + 8
out = os.path.join(OUT, "cmp_header2.png")
sheet.save(out)
print(out, sheet.size)
da.close(); db.close()