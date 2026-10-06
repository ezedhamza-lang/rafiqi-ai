# -*- coding: utf-8 -*-
"""تكبير منطقة الترويسة العليا: python prod1_top.py out.png page y0 y1 [x0 x1]"""
import os, sys
import pymupdf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
FIXED = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
OUT = r"C:\Users\ezedd\AppData\Local\Temp\opencode\prod1_sheets"
SRC = os.path.join(FIXED, "رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf")
out, page = sys.argv[1], int(sys.argv[2])
y0, y1 = float(sys.argv[3]), float(sys.argv[4])
x0 = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
x1 = float(sys.argv[6]) if len(sys.argv) > 6 else 595.0
d = pymupdf.open(SRC)
p = d[page - 1]
pix = p.get_pixmap(matrix=pymupdf.Matrix(5, 5), clip=pymupdf.Rect(x0, y0, x1, y1))
path = os.path.join(OUT, out)
pix.save(path)
print(path, pix.width, pix.height)
d.close()