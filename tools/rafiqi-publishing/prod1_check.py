# -*- coding: utf-8 -*-
"""يتحقّق من كتاب الإنتاج الكتابي س1 ويصدّر غلافه: python prod1_check.py"""
import os, sys, json
import pymupdf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
FIXED = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
WORK = r"C:\Users\ezedd\AppData\Local\Temp\opencode\posts\upload"
SRC = os.path.join(FIXED, "رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf")
os.makedirs(WORK, exist_ok=True)

d = pymupdf.open(SRC)
info = {"pages": d.page_count, "mb": round(os.path.getsize(SRC) / 1048576, 2),
        "meta_title": (d.metadata or {}).get("title")}

# الغلاف بدقة 714px
z = 714.0 / d[0].rect.width
pix = d[0].get_pixmap(matrix=pymupdf.Matrix(z, z))
cov = os.path.join(WORK, "rafiqi-production-s1-cover.jpg")
pix.pil_save(cov, "JPEG", quality=92)
info["cover"] = cov
info["cover_px"] = [pix.width, pix.height]

# عيّنات من الداخل: فهرس + صفحات متفرّقة
samples = [1, 2, 3, 10, 40, 80, 120, 155]
info["text"] = {}
for i in samples:
    t = d[i].get_text("text").strip().replace("\n", " / ")
    info["text"][i + 1] = t[:200]

# هل توجد كلمات تدلّ على السنة الأولى؟
full = "\n".join(d[i].get_text("text") for i in range(0, min(30, d.page_count)))
info["kw_s1"] = full.count("الأولى") + full.count("أولى")
info["kw_s2"] = full.count("الثانية") + full.count("ثانية")
info["kw_teacher"] = full.count("حمزة عزالدين")

d.close()
print(json.dumps(info, ensure_ascii=False, indent=1))