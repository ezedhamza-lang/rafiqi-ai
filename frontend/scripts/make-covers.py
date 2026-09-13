# -*- coding: utf-8 -*-
"""Shrink book covers to webp for the homepage showcase."""
from PIL import Image
import os, shutil

SRC = r"D:\livres eleves\صور-غلاف-الكتب"
DST = r"D:\mon projet\rafiqi-كامل-محدث-02-09-2026\rafiqi\frontend\public\covers"
os.makedirs(DST, exist_ok=True)

mapping = {
    "كتاب-قراءة.png": "qiraat",
    "كتاب-الرياضيات.png": "math",
    "كتاب-في-الانتاج-الكتابي.png": "intaj",
    "كتاب-ايقاظ.png": "iyqa",
    "كتاب-اللغة-العربية.png": "arabe",
    "كتاب-رفيقي-في-الرياضيات.png": "rafiqi-math",
    "كتاب-في-الانجليزية.png": "anglais",
    "كتاب-الفرنسية.png": "francais",
}

for src, out in mapping.items():
    p = os.path.join(SRC, src)
    if not os.path.exists(p):
        print("MISSING", src)
        continue
    im = Image.open(p).convert("RGB")
    w, h = im.size
    tw = 640
    im = im.resize((tw, int(h * tw / w)), Image.LANCZOS)
    dst = os.path.join(DST, out + ".webp")
    im.save(dst, "WEBP", quality=82)
    print(out, im.size, round(os.path.getsize(dst) / 1024), "KB")
