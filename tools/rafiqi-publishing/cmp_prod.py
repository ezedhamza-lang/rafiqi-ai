# -*- coding: utf-8 -*-
"""يلتقط الصفحة الأولى من كتب الإنتاج (كل المستويات) لمقارنة الأغلفة."""
import os, sys
import pymupdf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
F = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
OUT = r"C:\Users\ezedd\AppData\Local\Temp\opencode\prod1_sheets"
files = [
    "رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf",
    "رفيقي في الإنتاج الكتابي - السنة الرابعة ابتدائي.pdf",
    "كتاب_1_رفيقي_في_الإنتاج_الكتابي_أخطو_بقلمي.pdf",
    "رفيقي_في_الرياضيات_س1_كراس_التمارين_كامل.pdf",
]
for i, fn in enumerate(files, 1):
    p = os.path.join(F, fn)
    d = pymupdf.open(p)
    pg = d[0]
    z = 714.0 / pg.rect.width
    pix = pg.get_pixmap(matrix=pymupdf.Matrix(z, z))
    q = os.path.join(OUT, "c%d_%s.png" % (i, fn[:16].replace(" ", "_")))
    pix.save(q)
    print(q)
    d.close()