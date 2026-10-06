# -*- coding: utf-8 -*-
"""يفحص لون الخلفية حول كلمة «الأساسي» في الترويسة."""
import os, sys, json
import pymupdf
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
F = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED\رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf"
d = pymupdf.open(F)
p = d[9]
out = {}
for name, r in (("above", pymupdf.Rect(206, 30, 238, 34)),
                ("left", pymupdf.Rect(204, 35, 211, 52)),
                ("right", pymupdf.Rect(237, 35, 244, 52)),
                ("below", pymupdf.Rect(206, 53, 238, 54.5)),
                ("below2", pymupdf.Rect(206, 74, 238, 78))):
    pix = p.get_pixmap(matrix=pymupdf.Matrix(1, 1), clip=r)
    n, s = pix.n, pix.samples
    cols = {}
    for k in range(0, len(s), n):
        c = (s[k], s[k + 1], s[k + 2])
        cols[c] = cols.get(c, 0) + 1
    top = sorted(cols.items(), key=lambda kv: -kv[1])[:3]
    out[name] = [(c, n2) for c, n2 in top]
print(json.dumps(out, ensure_ascii=False, indent=1))
d.close()