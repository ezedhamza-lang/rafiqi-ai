# -*- coding: utf-8 -*-
"""تحقّق شامل: لا تغيير خارج مستطيل الإصلاح، وعدد الصفحات ثابت."""
import os, sys, json, hashlib
import pymupdf
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
A = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED\رفيقي في الإنتاج الكتابي - السنةQhPSS booktitle"
A = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED\رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf"
B = os.path.join(HERE, "prod1_out", "رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf")
ALLOW = pymupdf.Rect(208.0, 30.0, 238.0, 55.0)      # مستطيل المسح المسموح
ZOOM = 1.5

da, db = pymupdf.open(A), pymupdf.open(B)
errs = []
if da.page_count != db.page_count:
    errs.append("عدد الصفحات %d -> %d" % (da.page_count, db.page_count))
changed = 0
for i in range(min(da.page_count, db.page_count)):
    pa = da[i].get_pixmap(matrix=pymupdf.Matrix(0.6, 0.6))
    pb = db[i].get_pixmap(matrix=pymupdf.Matrix(0.6, 0.6))
    ha = hashlib.md5(pa.samples).hexdigest()
    hb = hashlib.md5(pb.samples).hexdigest()
    if ha == hb:
        if i > 0:
            errs.append("p%d: لم يتغير" % (i + 1))
        continue
    changed += 1
    pa = da[i].get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM))
    pb = db[i].get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM))
    sa, sb, n = pa.samples, pb.samples, pa.n
    bad, bb = 0, [1e9, 1e9, -1e9, -1e9]
    for y in range(pa.height):
        py = y / ZOOM
        for x in range(pa.width):
            px = x / ZOOM
            if ALLOW.x0 <= px <= ALLOW.x1 and ALLOW.y0 <= py <= ALLOW.y1:
                continue
            k = (y * pa.width + x) * n
            if (abs(sa[k] - sb[k]) > 26 or abs(sa[k + 1] - sb[k + 1]) > 26
                    or abs(sa[k + 2] - sb[k + 2]) > 26):
                bad += 1
                bb = [min(bb[0], px), min(bb[1], py), max(bb[2], px), max(bb[3], py)]
    if bad > 30:
        errs.append("p%d: %d بكس خارج المستطيل عند x=%.1f..%.1f y=%.1f..%.1f"
                    % (i + 1, bad, bb[0], bb[2], bb[1], bb[3]))
print(json.dumps({"pages": db.page_count, "changed": changed,
                  "n_errors": len(errs), "errors": errs[:12]}, ensure_ascii=False, indent=1))
da.close(); db.close()