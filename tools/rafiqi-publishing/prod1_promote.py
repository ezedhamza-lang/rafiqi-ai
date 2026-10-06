# -*- coding: utf-8 -*-
"""يرفع النسخة المُصلَحة إلى _FIXED بعد فحص السلامة (النسخة الأصلية محفوظة في _FIXED_bak)."""
import os, sys, json, shutil, hashlib
import pymupdf
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
NAME = "رفيقي في الإنتاج الكتابي - السنةcheeja"
NAME = "رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf"
FIXED = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
BAK = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED_bak"
OUT = r"C:\Users\ezedd\AppData\Local\Temp\opencode\prod1_out"

src = os.path.join(OUT, NAME)
dst = os.path.join(FIXED, NAME)
bak = os.path.join(BAK, NAME)

for p in (src, dst, bak):
    if not os.path.exists(p):
        print("MISSING", p); raise SystemExit(1)

ds = pymupdf.open(src)
info = {"pages": ds.page_count,
        "mb": round(os.path.getsize(src) / 1048576, 2),
        "meta_title": (ds.metadata or {}).get("title"),
        "meta_author": (ds.metadata or {}).get("author")}
ds.close()

db = pymupdf.open(bak)
info["bak_pages"] = db.page_count
info["bak_title"] = (db.metadata or {}).get("title")
db.close()

cur = pymupdf.open(dst)
info["cur_pages"] = cur.page_count
cur.close()

assert info["pages"] == info["bak_pages"] == info["cur_pages"], "page count mismatch"
assert info["mb"] <= 25.0, "too big"
shutil.copy2(src, dst)
info["promoted"] = True
info["dst_mb"] = round(os.path.getsize(dst) / 1048576, 2)
print(json.dumps(info, ensure_ascii=False, indent=1))