# -*- coding: utf-8 -*-
"""يعرض صناديق الأسطر (bboxes) في أعلى الصفحة — النص مشوّش لكن المواضع صحيحة."""
import os, sys, json
import pymupdf
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
F = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
SRC = os.path.join(F, "رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf")
d = pymupdf.open(SRC)
for pno in [int(x) for x in (sys.argv[1:] or ["10"])]:
    p = d[pno - 1]
    print("== page", pno)
    for b in p.get_text("dict")["blocks"]:
        if b.get("type") != 0:
            continue
        for l in b["lines"]:
            bb = l["bbox"]
            if bb[1] > 120:
                continue
            txt = "".join(s["text"] for s in l["spans"])
            print("  bbox=[%.1f %.1f %.1f %.1f] size=%.1f dir=%s | %s"
                  % (bb[0], bb[1], bb[2], bb[3], l["spans"][0]["size"],
                     l.get("dir"), txt[:70]))
d.close()