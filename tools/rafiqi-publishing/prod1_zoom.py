# -*- coding: utf-8 -*-
"""تكبير أسطر الغلاف لفحصها: python prod1_zoom.py out.png x0 y0 x1 y1 [page]"""
import os, sys
import pymupdf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
FIXED = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
OUT = r"C:\Users\ezedd\AppData\Local\Temp\opencode\prod1_sheets"
os.makedirs(OUT, exist_ok=True)
SRC = os.path.join(FIXED, "رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf")

out = sys.argv[1]
x0, y0, x1, y1 = [float(v) for v in sys.argv[2:6]]
page = int(sys.argv[6]) if len(sys.argv) > 6 else 1
d = pymupdf.open(SRC)
p = d[page - 1]
r = p.rect
clip = pymupdf.Rect(r.x0 + x0 * r.width, r.y0 + y0 * r.height,
                    r.x0 + x1 * r.width, r.y0 + y1 * r.height)
pix = p.get_pixmap(matrix=pymupdf.Matrix(6, 6), clip=clip)
path = os.path.join(OUT, out)
pix.save(path)
d.close()
print(path, pix.width, pix.height)