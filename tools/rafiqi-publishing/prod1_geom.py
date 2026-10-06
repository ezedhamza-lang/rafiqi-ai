# -*- coding: utf-8 -*-
"""يقيس موضع ترويسة كتاب الإنتاج س1 في أعلى كل صفحة عيّنة."""
import os, sys, json
import pymupdf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fix_level as FL

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
F = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
SRC = os.path.join(F, "رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf")

d = pymupdf.open(SRC)
for i in [1, 2, 3, 4, 9, 20, 49, 99, 149, 154, 155]:
    p = d[i]
    R = p.rect
    win = pymupdf.Rect(R.x0, R.y0, R.x1, R.y0 + 0.13 * R.height)
    cl = FL.ink_clusters(p, win, delta=60)
    print(json.dumps({
        "page": i + 1,
        "clusters": [{"x0": round(c["x0"], 1), "x1": round(c["x1"], 1),
                      "y0": round(c["y0"], 1), "y1": round(c["y1"], 1),
                      "px": c["px"]} for c in cl],
    }, ensure_ascii=False))
d.close()