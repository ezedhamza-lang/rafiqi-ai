# -*- coding: utf-8 -*-
"""يصدّر أغلفة الكتب لمن review بصري: python covers.py out_dir"""
import os, sys, json
import pymupdf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
FIXED = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
OUT = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\ezedd\AppData\Local\Temp\opencode\covers"
os.makedirs(OUT, exist_ok=True)

names = [
    "سلسلة رفيقي في عالم القصص-قراءة-رياضيات-انتاج.pdf",
    "English_book_5th_Tunisia.pdf",
    "English_Book_Year6_2026-09-11.pdf",
    "My_English_Book_Year3_Tunisia_2026-09-11.pdf",
    "French_Book_Grade2_Tunisia.pdf",
    "رفيقي_في_القراءة_الشامل_الكتاب_الكامل-للسنة-الثانية.pdf",
    "كتاب_1_رفيقي_في_الإنتاج_الكتابي_أخطو_بقلمي.pdf",
]
out = []
for i, fn in enumerate(names):
    p = os.path.join(FIXED, fn)
    if not os.path.exists(p):
        out.append({"name": fn, "missing": True})
        continue
    d = pymupdf.open(p)
    pix = d[0].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5))
    n = i + 1
    path = os.path.join(OUT, "cover%02d.png" % n)
    pix.save(path)
    d.close()
    out.append({"n": n, "name": fn, "path": path})
print(json.dumps(out, ensure_ascii=False, indent=1))