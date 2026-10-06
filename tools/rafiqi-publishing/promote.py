# -*- coding: utf-8 -*-
"""نقل الكتب المصلحة من _out إلى _FIXED مع تحقق كامل + نسخة أمان."""
import os, sys, json, shutil
import pymupdf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg"
FIXED = os.path.join(ROOT, "_FIXED")
OUT = r"C:\Users\ezedd\AppData\Local\Temp\opencode\_out"
BAK = os.path.join(ROOT, "_FIXED_bak")
os.makedirs(BAK, exist_ok=True)

MAXB = 25 * 1024 * 1024
report = []
for fn in sorted(os.listdir(OUT)):
    if not fn.lower().endswith(".pdf"):
        continue
    src = os.path.join(OUT, fn)
    dst = os.path.join(FIXED, fn)
    r = {"file": fn}
    if not os.path.exists(dst):
        r["ok"] = False
        r["why"] = "TARGET MISSING"
        report.append(r)
        continue
    sz = os.path.getsize(src)
    if sz > MAXB:
        r.update(ok=False, why="TOO BIG %d" % sz)
        report.append(r)
        continue
    a = pymupdf.open(src)
    b = pymupdf.open(dst)
    r["pages_new"] = a.page_count
    r["pages_old"] = b.page_count
    a.close(); b.close()
    if r["pages_new"] != r["pages_old"]:
        r.update(ok=False, why="PAGE COUNT CHANGED")
        report.append(r)
        continue
    # نسخة أمان من النسخة الحالية قبل الاستبدال
    bak = os.path.join(BAK, fn)
    if not os.path.exists(bak):
        shutil.copy2(dst, bak)
    shutil.copy2(src, dst)
    r.update(ok=True, MiB=round(sz / 1048576, 2))
    report.append(r)

ok_all = bool(report) and all(r.get("ok") for r in report)
print(json.dumps({"ALL_OK": ok_all, "moved": sum(1 for r in report if r.get("ok")),
                  "report": report}, ensure_ascii=False, indent=1))
