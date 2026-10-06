# -*- coding: utf-8 -*-
"""يُصلح كلمة «الأساسي» في ترويسة كل صفحات كتاب الإنتاج الكتابي س1.

الطبقة النصية في هذا الكتاب مشوّشة (الحروف متباعدة/مقلوبة) فلا يصلح
الاعتماد على `find_line`؛ لذلك نعتمد على الهندسة: الترويسة ثابتة الموضع
على كل الصفحات (حبرها x=212..383.3، y=35..52)، ونستبدل الكلمة الأخيرة
(«الأساسي») فقط بـ«الأَبْتِدَائِيِّ» مع الحفاظ على بقية السطر.

python prod1_fix_header.py [out.pdf]
"""
import os, sys, json
import pymupdf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fix_level as FL

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
FIXED = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
NAME = "رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf"
SRC = os.path.join(FIXED, NAME)
OUTDIR = os.path.join(HERE, "prod1_out")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(OUTDIR, NAME)
if os.path.dirname(OUT):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)

TEXT = "الأَبْتِدَائِيِّ"
FONT = "amiri_bold"
OLD_RIGHT = 235.0          # نهاية الكلمة القديمة (يمينها في RTL)
BAND = (205.0, 33.0, 392.0, 54.0)

FL.prep_fonts()


def col_profile(page, band, thresh=200, gap=2):
    pix = page.get_pixmap(matrix=pymupdf.Matrix(1, 1), clip=pymupdf.Rect(*band))
    w, n, s = pix.width, pix.n, pix.samples
    out, cur, gp = [], None, 0
    for x in range(w):
        cnt = 0
        for y in range(pix.height):
            i = (y * w + x) * n
            L = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]
            if L < thresh:
                cnt += 1
        if cnt > 0:
            if cur is None:
                cur = [x, x]
            else:
                cur[1] = x
            gp = 0
        elif cur is not None:
            gp += 1
            if gp >= gap:
                out.append((band[0] + cur[0], band[0] + cur[1]))
                cur, gp = None, 0
    if cur:
        out.append((band[0] + cur[0], band[0] + cur[1]))
    return out


def row_profile(page, rect, thresh=200):
    r = pymupdf.Rect(rect)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(1, 1), clip=r)
    w, h, n, s = pix.width, pix.height, pix.n, pix.samples
    rows = []
    for y in range(h):
        cnt = 0
        for x in range(w):
            i = (y * w + x) * n
            L = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]
            if L < thresh:
                cnt += 1
        rows.append((r.y0 + y, cnt))
    ys = [y for y, c in rows if c > 0]
    return (min(ys), max(ys)) if ys else None


log, done, skipped, errs = [], 0, [], []
ONLY = [int(x) for x in sys.argv[2:] if x.isdigit()] or None
d = pymupdf.open(SRC)
for i in range(d.page_count):
    if ONLY and (i + 1) not in ONLY:
        continue
    p = d[i]
    words = col_profile(p, BAND)
    ok = (len(words) >= 8 and abs(words[0][0] - 212.0) < 1.5
          and abs(words[0][1] - OLD_RIGHT) < 1.5)
    if not ok:
        skipped.append(i + 1)
        continue
    wr = pymupdf.Rect(words[0][0] - 1.5, BAND[1], words[0][1] + 1.5, BAND[3])
    ys = row_profile(p, wr)
    if ys is None:
        skipped.append(i + 1)
        continue
    y0, y1 = ys
    redact = pymupdf.Rect(words[0][0] - 2.0, y0 - 2.5, words[0][1] + 2.0, y1 + 2.5)
    if redact.y1 > 54.2:                       # لا نلمس سطر «الأستاذ:»
        redact.y1 = 54.2
    oldrect = pymupdf.Rect(words[0][0] - 1.0, BAND[1], words[0][1] + 1.0, BAND[3])
    dens0 = FL.density(p, oldrect, delta=60)
    col = FL.color_in(p, pymupdf.Rect(words[0][0], y0, words[0][1], y1)) \
        or FL.color_in(p, pymupdf.Rect(212, 35, 384, 52)) or (0.11, 0.16, 0.20)
    th = y1 - y0
    size, m = 9.0, None
    for _ in range(6):
        try:
            m = FL.measure_text(TEXT, FONT, size, col, "center")
        except Exception as exc:
            print("measure failed p%d: %s" % (i + 1, exc))
            errs.append("p%d: قياس فشل" % (i + 1))
            continue
        if abs(m["h"] - th) <= 0.05 * th:
            break
        ns = max(6.0, min(14.0, size * th / max(m["h"], 0.1)))
        if abs(ns - size) < 0.05:
            break
        size = round(ns, 2)
    # وضع الحبر: مركزه أفقيًا عند نهاية الكلمة القديمة، رأسيًا في منتصفها
    ax = words[0][1] + 0.5          # wants: ink right edge
    ay = (y0 + y1) / 2.0
    cx_off = (m["lx0"] + m["lx1"]) / 2.0
    cy_off = (m["ly0"] + m["ly1"]) / 2.0
    W, H = m["w"] + 80.0, m["h"] + 80.0
# insert_htmlbox يوسّط النص داخل الصندوق: موضع الحبر = box.x0 + (W-w)/2
    x0 = ax - m["w"] - (W - m["w"]) / 2.0
    y0b = ay - m["h"] / 2.0 - m["ly0"]
    box = pymupdf.Rect(x0, y0b, x0 + W, y0b + H)
    if box.intersect(p.rect).is_empty or box.width < 5 or box.height < 5:
        errs.append("p%d: صندوق الإدراج خارج الصفحة" % (i + 1))
        continue
    vwin = pymupdf.Rect(box.x0 - 4.0, BAND[1], OLD_RIGHT + 2.0, BAND[3])
    dens0 = FL.density(p, vwin, delta=60)
    # الخلفية هنا بيضاء خالصة (تمّ الفحص: 255,255,255) فنمسح بمستطيل أبيض.
    # الإعادة (redaction) غير صالحة هنا: صندوق السطر الثاني يبدأ y=48.5
    # بينما حبره يبدأ y=55.3، فالمحرك كان يمسح أعلى السطر الثاني أيضًا.
    p.draw_rect(redact, color=None, fill=(1, 1, 1), width=0)
    p.insert_htmlbox(box, FL._html(TEXT, "center"), css=FL._css(FONT, size, col),
                     archive=FL.archive(), scale_low=0.0)
    # تحقّق: نفس النافذة تُقاس قبل وبعد
    cl = FL.ink_clusters(p, vwin, delta=60)
    new = None
    for c in cl:
        if c["y1"] <= 54.5:
            if new is None or (c["x1"] - c["x0"]) > (new["x1"] - new["x0"]):
                new = c
    if new is None:
        errs.append("p%d: لا حبر جديد" % (i + 1))
        continue
    dr = new["x1"] - (words[0][1] + 0.5)
    dc = (new["y0"] + new["y1"]) / 2.0 - ay
    dh = (new["y1"] - new["y0"]) - th
    dens1 = FL.density(p, vwin, delta=60)
    if abs(dr) > 1.6 or abs(dc) > 0.9 or abs(dh) > 0.18 * th:
        errs.append("p%d: dx=%.2f dy=%.2f dh=%.2f" % (i + 1, dr, dc, dh))
        continue
    # كثافة الحبر: الكلمة الجديدة فيها حروف وتشكيل أكثر، فنسمح +-45%
    if dens0 > 0 and not (0.55 <= dens1 / dens0 <= 1.45):
        errs.append("p%d: كثافة %.3f مقابل %.3f" % (i + 1, dens1, dens0))
        continue
    done += 1
    log.append("p%-4d size=%-5s w=%-6.1f dx=%+.2f dy=%+.2f dh=%+.2f d=%.2f/%.2f"
               % (i + 1, size, new["x1"] - new["x0"], dr, dc, dh, dens1, dens0))

d.save(OUT, garbage=4, deflate=True)
d.close()
print(json.dumps({"out": OUT, "fixed": done, "skipped_pages": skipped,
                  "errors": errs[:15], "n_errors": len(errs),
                  "mb": round(os.path.getsize(OUT) / 1048576, 2)}, ensure_ascii=False, indent=1))
print("\n".join(log[:6]))