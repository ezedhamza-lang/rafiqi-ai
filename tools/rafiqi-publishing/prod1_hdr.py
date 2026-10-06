# -*- coding: utf-8 -*-
"""تكبير ترويسة صفحة داخلية: python prod1_hdr.py out.png page"""
import os, sys
import pymupdf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
FIXED = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
OUT = r"C:\Users\ezedd\AppData\Local\Temp\opencode\prod1_sheets"
SRC = os.path.join(FIXED, "رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf")
out = sys.argv[1]
page = int(sys.argv[2])
d = pymupdf.open(SRC)
p = d[page - 1]
r = p.rect
clip = pymupdf.Rect(r.x0, r.y0, r.x1, r.y0 + 0.075 * r.height)
pix = p.get_pixmap(matrix=pymupdf.Matrix(6, 6), clip=clip)
path = os.path.join(OUT, out)
pix.save(path)
print(path, pix.width, pix.height)
d.close()