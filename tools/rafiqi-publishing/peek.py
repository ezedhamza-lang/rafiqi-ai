# -*- coding: utf-8 -*-
"""قصّ منطقة من أي PDF: python peek.py file.pdf page x0 y0 x1 y1 [zoom] [out]"""
import os, sys
import pymupdf
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
OUT = r"C:\Users\ezedd\AppData\Local\Temp\opencode\prod1_sheets"
f = sys.argv[1]
page = int(sys.argv[2])
x0, y0, x1, y1 = [float(v) for v in sys.argv[3:7]]
z = float(sys.argv[7]) if len(sys.argv) > 7 else 6.0
out = sys.argv[8] if len(sys.argv) > 8 else "peek.png"
d = pymupdf.open(f)
p = d[page - 1]
pix = p.get_pixmap(matrix=pymupdf.Matrix(z, z), clip=pymupdf.Rect(x0, y0, x1, y1))
path = os.path.join(OUT, out)
pix.save(path)
print(path, pix.width, pix.height)
d.close()