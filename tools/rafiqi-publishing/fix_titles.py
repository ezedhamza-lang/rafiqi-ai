# -*- coding: utf-8 -*-
"""تصحيح عناوين metadata داخل ملفات _FIXED نفسها (بدون لمس أي صفحة).
   «... من التعليم الأساسي»  ->  «... من التعليم الابتدائي»
   يكتب إلى ملف مؤقت ثم يتحقق أن المحتوى كما هو ثم يستبدل الأصل."""
import os, sys, json, hashlib
import pymupdf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

FIXED = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
BAD = "من التعليم الأساسي"
GOOD = "من التعليم الابتدائي"

def fingerprint(path):
    d = pymupdf.open(path)
    h = hashlib.sha256()
    dims = []
    for i in range(d.page_count):
        pg = d[i]
        h.update(pg.get_text("text").encode("utf-8", "replace"))
        h.update(pg.get_images().__repr__().encode())
        r = pg.rect
        dims.append("%dx%d" % (round(r.width), round(r.height)))
    n = d.page_count
    md = dict(d.metadata or {})
    d.close()
    return {"pages": n, "hash": h.hexdigest(), "dims": "|".join(sorted(set(dims))),
            "meta": md}

report = []
for fn in sorted(os.listdir(FIXED)):
    if not fn.lower().endswith(".pdf"):
        continue
    path = os.path.join(FIXED, fn)
    d = pymupdf.open(path)
    md = dict(d.metadata or {})
    title = md.get("title") or ""
    d.close()
    if BAD not in title:
        continue

    before = fingerprint(path)
    new_title = title.replace(BAD, GOOD)

    d = pymupdf.open(path)
    md = dict(d.metadata or {})
    md["title"] = new_title
    d.set_metadata(md)
    tmp = path + ".tmp.pdf"
    d.save(tmp, garbage=4, deflate=True)
    d.close()

    after = fingerprint(tmp)
    same = (before["pages"] == after["pages"] and
            before["hash"] == after["hash"] and
            before["dims"] == after["dims"])
    if not same:
        os.remove(tmp)
        report.append({"file": fn, "ok": False, "why": "CONTENT CHANGED"})
        continue
    if BAD in (after["meta"].get("title") or ""):
        os.remove(tmp)
        report.append({"file": fn, "ok": False, "why": "TITLE STILL BAD"})
        continue

    os.replace(tmp, path)
    report.append({"file": fn, "ok": True,
                   "before": title, "after": after["meta"].get("title")})

ok_all = bool(report) and all(r["ok"] for r in report)
print(json.dumps({"ALL_OK": ok_all, "fixed": sum(1 for r in report if r["ok"]),
                  "report": report}, ensure_ascii=False, indent=1))
