# -*- coding: utf-8 -*-
"""يقارن أسطر أغلفة كتب أخرى للتحقّق من صياغة «والتلاميذ/التلميذة»."""
import os, sys
import pymupdf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
F = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
OUT = r"C:\Users\ezedd\AppData\Local\Temp\opencode\prod1_sheets"
files = [
    "رفيقي_في_القراءة_س2_كتاب_التلميذ.pdf",
    "رفيقي_في_الإيقاظ_العلمي_س2_كتاب_التلميذ.pdf",
    "رفيقي_في_الرياضيات_س1_كراس_التمارين_كامل.pdf",
]
for fn in files:
    p = os.path.join(F, fn)
    if not os.path.exists(p):
        print("missing", fn); continue
    d = pymupdf.open(p)
    pg = d[0]
    z = 714.0 / pg.rect.width
    pix = pg.get_pixmap(matrix=pymupdf.Matrix(z, z))
    q = os.path.join(OUT, "cmp_" + fn[7:22].replace(" ", "_") + ".png")
    pix.save(q)
    print(q)
    d.close()