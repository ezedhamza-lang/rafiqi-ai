# -*- coding: utf-8 -*-
"""يفحص مرشّحي الإنتاج الكتابي س1: python prod1_cands.py"""
import os, sys, json
import pymupdf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
CANDS = [
    (r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_DO_NOT_PUBLISH\_FIXED\writing-book-grade1-tunisia.pdf", "DN_writing_g1"),
    (r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_DO_NOT_PUBLISH\writing-book-grade1-tunisia.pdf", "DN_raw_writing_g1"),
    (r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED\رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf", "FIXED_prod_s1"),
]
OUT = r"C:\Users\ezedd\AppData\Local\Temp\opencode\prod1_sheets"
for p, tag in CANDS:
    if not os.path.exists(p):
        print("MISSING", p); continue
    d = pymupdf.open(p)
    m = d.metadata or {}
    pg = d[0]
    z = 714.0 / pg.rect.width
    pix = pg.get_pixmap(matrix=pymupdf.Matrix(z, z))
    q = os.path.join(OUT, "cand_%s.png" % tag)
    pix.save(q)
    print(json.dumps({"tag": tag, "pages": d.page_count,
                      "mb": round(os.path.getsize(p) / 1048576, 2),
                      "title": m.get("title"), "author": m.get("author"),
                      "creator": m.get("creator"), "producer": m.get("producer"),
                      "created": m.get("creationDate"), "cover": q}, ensure_ascii=False))
    d.close()