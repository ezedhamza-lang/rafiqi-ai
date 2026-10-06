# -*- coding: utf-8 -*-
"""يكشف عبارة «من التعليم الأساسي» على غلاف كل كتاب (بعد إزالة التشكيل)."""
import os, sys, glob, re
import pymupdf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

FIXED = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"

_codes = (list(range(0x064B, 0x0653)) + [0x0670, 0x0640]
          + list(range(0x06D6, 0x06EE)) + list(range(0x0610, 0x061A))
          + [0x061C, 0x06DD, 0x06DE, 0x06E9])
MARKS = "".join(chr(c) for c in _codes)
TRANS = dict.fromkeys(map(ord, MARKS), None)

YEARS = ["الاولى", "الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة",
         "الاول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"]

print("%-56s %-8s %-10s %s" % ("FILE", "الأساسي؟", "السنة", "ملاحظة"))
print("-" * 100)

for f in sorted(glob.glob(os.path.join(FIXED, "*.pdf"))):
    base = os.path.basename(f)
    d = pymupdf.open(f)
    raw = (d[0].get_text("text") or "").translate(TRANS)
    raw = re.sub(r"\s+", " ", raw)

    has_asasi = "أساس" in raw or "اساس" in raw
    has_ibtedai = "ابتدائ" in raw

    years = [y for y in YEARS if y in raw]
    md = d.metadata or {}
    note = ""
    if has_asasi and "ابتدائي" in base:
        note = "تعارض: الاسم ابتدائي / الغلاف الأساسي"
    elif has_asasi and "ابتدائي" not in base:
        note = "غلاف يقول الأساسي"
    if "من التعليم الأساسي" in (md.get("title") or "") or "من التعليم الأساسي" in (md.get("title") or "").replace("أساسي", "أساسي"):
        note += " +الميتاداتا"

    print("%-56s %-8s %-10s %s" % (base[:54], "نعم" if has_asasi else "لا",
                                   ",".join(years[:3]) or "-", note))
    d.close()
