# -*- coding: utf-8 -*-
"""
محرك إصلاح «التعليم الأساسي» <- «التعليم الابتدائي» داخل ملفات _FIXED.

خطوات الإصلاح لكل سطر:
  1) نجد السطر المستهدف ثم نقيس **حبره الحقيقي** بالبكسل
     (الصناديق النصية مُكبَّرة ٣ مرات في بعض الكتب فلا تصلح مرجعًا).
  2) نقيس حجم/مواضع النص الجديد على صفحة تجريبية (بخلفية رمادية
     تباين مع أي لون) — فلا حاجة لتخمين المحاذاة أو موقع السطر.
  3) نبني مستطيل إخفاء لا يمسّ أي سطر آخر (فحص الجيران بالبكسل).
  4) نخفي النص القديم fill=None → الخلفية والرسوم تبقى كما هي تمامًا.
  5) نُدرج النص الجديد ونتحقق بالقياس (وليس بالتخمين).
  6) عند التعويض عن خط Type3 نقارن كثافة الحبر لنختار الوزن المناسب.

ملاحظة: في MuPDF مع dir="rtl" قيمتا left/right مقلوبتان عالميًا،
        ولذلك نمرّر القيمة المعكوسة (css_align).
"""
import os, sys, re, json, shutil
import pymupdf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
FIXED = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
FDIR = r"C:\Users\ezedd\AppData\Local\Temp\opencode\fontcandidates"
WORK = os.path.join(HERE, "fixwork")
PILOT = os.path.join(HERE, "pilot")
SHOTS = os.path.join(HERE, "bookshots")

# ------------------------------------------------------------------ الخطوط --
FONTS = {
    "amiri_bold": "Amiri-Bold.ttf",
    "amiri_reg": "Amiri-Regular.ttf",
    "noto_bold": "DL_NotoNaskhArabic-Bold.ttf",
    "noto_reg": "DL_NotoNaskhArabic-Regular.ttf",
}
FILEMAP = {"amiri_bold": "fb.ttf", "amiri_reg": "fr.ttf",
           "noto_bold": "nb.ttf", "noto_reg": "nr.ttf"}
_ARCHIVE = None


def prep_fonts():
    global _ARCHIVE
    d = os.path.join(WORK, "fonts")
    os.makedirs(d, exist_ok=True)
    for key, src in FONTS.items():
        s = os.path.join(FDIR, src)
        if not os.path.exists(s):
            raise SystemExit("font missing: " + s)
        shutil.copy(s, os.path.join(d, FILEMAP[key]))
    _ARCHIVE = pymupdf.Archive(d)
    return d


def archive():
    global _ARCHIVE
    if _ARCHIVE is None:
        prep_fonts()
    return _ARCHIVE


# ------------------------------------------------------------------ الكاشف --
KEEP = re.compile(r"[^\u0621-\u064A]+")
A2A = {"\u0623": "\u0627", "\u0625": "\u0627", "\u0622": "\u0627"}


def cfold(text):
    t = KEEP.sub("", text)
    for a, b in A2A.items():
        t = t.replace(a, b)
    return re.sub(r"(.)\1+", r"\1", t)


def is_target(c, pno):
    levelish = any(x in c for x in ("الاساس", "الاسايس", "السايس"))
    if pno == 0:
        yeared = ("السنة" in c) and ("منالتعليم" in c) and ("ابتدائ" not in c)
        return levelish or yeared
    return levelish


# -------------------------------------------------------------- نصوص جديدة --
G = {"الاولى": "الأُولَى", "الثانية": "الثَّانِيَةُ", "الثالثة": "الثَّالِثَةُ",
     "الرابعة": "الرَّابِعَةُ", "الخامسة": "الخَامِسَةُ", "السادسة": "السَّادِسَةُ"}


def year_line(g):
    return "السَّنَةُ %s مِنَ التَّعْلِيمِ الأَبْتِدَائِيِّ" % G[g]


FOOT_IQ = "سلسلة رفيقي • الإيقاظ العلمي • السنة الثانية من التعليم الابتدائي"
FOOT_QR = "سلسلة رفيقي • القراءة • السنة الثانية من التعليم الابتدائي"
BANNER = "سلسلةُ رفيقي • الإنتاجُ الكتابي • " + year_line("الثانية")
BODY1 = ("وَيُوافِقُ مَعَ كَفَايَاتِ الإِنْتاجِ الكِتابِيِّ لِلسَّنَةِ الثَّانِيَةِ "
         "مِنَ التَّعْلِيمِ الأَبْتِدَائِيِّ بِالجُمْهُورِيَّةِ التُّونِسِيَّةِ.")
LVL_IQ = "المستوى: " + year_line("الثانية") + " • الدورةُ الأولى"
LVL_AB = "المستوى: " + year_line("الثانية") + " • الدورةُ الثانية"

M1 = "رفيقي_في_الرياضيات_س1_كراس_التمارين_كامل.pdf"
IQ = "رفيقي_في_الإيقاظ_العلمي_س2_كتاب_التلميذ.pdf"
QR = "رفيقي_في_القراءة_س2_كتاب_التلميذ.pdf"
BK1 = "كتاب_1_رفيقي_في_الإنتاج_الكتابي_أخطو_بقلمي.pdf"
BK2 = "كتاب_2_رفيقي_في_الإنتاج_الكتابي_أبني_جملتي.pdf"

TYPE3_BOOKS = (IQ, QR, M1)


def grade_of(name):
    for g in G:
        if ("السنة " + g) in name:
            return g
    return None


def enrich(h):
    book, page, size = h["book"], h["page"], float(h["size"])
    g = grade_of(book)
    j = dict(h)
    j["size"] = size
    j["align"] = None
    j["text"] = None
    j["fonts"] = []
    j["x_left_min"] = None
    j["x_right_max"] = None
    j["hex"] = h.get("color")            # لون النص الأصلي (دقيق، من الجرد)

    if book in (BK1, BK2):                                   # أخطو / أبني
        if page == 0 and size == 12.0:
            j.update(align="center", text=BANNER, fonts=["noto_bold"])
        elif size == 11.0:
            j.update(align="center", text=(LVL_IQ if book == BK1 else LVL_AB),
                     fonts=["noto_reg"])
        else:
            j.update(align="center", text=BODY1, fonts=["noto_reg"])
    elif "الإيقاظ" in book:
        if page == 0:
            j.update(align="right", text=year_line("الثانية"),
                     fonts=["noto_bold", "noto_reg"])
        else:
            j.update(align="center", text=FOOT_IQ, fonts=["noto_reg"],
                     x_left_min=110.0, x_right_max=364.0)
    elif "القراءة" in book:
        if page == 0:
            j.update(align="right", text=year_line("الثانية"),
                     fonts=["noto_bold", "noto_reg"])
        else:
            j.update(align="center", text=FOOT_QR, fonts=["noto_reg"],
                     x_left_min=110.0, x_right_max=364.0)
    elif "رياضيات" in book:
        if book == M1:
            if page == 0:
                j.update(align="center", text=year_line("الاولى"),
                         fonts=["noto_bold", "noto_reg"])
            else:
                j.update(align="left", text=year_line("الاولى"),
                         fonts=["noto_reg", "noto_bold"])
        elif page == 0:
            j.update(align="center", text=year_line(g), fonts=["amiri_bold"])
        elif page == 4:
            j.update(align="right", text="التَّعْلِيمِ الأَبْتِدَائِيِّ.",
                     fonts=["amiri_reg"])
        else:
            j.update(align="right", text="التَّعْلِيمِ الأَبْتِدَائِيِّ.",
                     fonts=["amiri_reg"])
    elif book.startswith("رفيقي في الإنتاج الكتابي"):
        j.update(align="center", text=year_line(g), fonts=["amiri_bold"])
    return j if j["text"] else None


def build_jobs():
    with open(os.path.join(HERE, "level_manifest.json"), encoding="utf-8") as fh:
        man = json.load(fh)
    jobs, skipped = {}, 0
    for h in man:
        j = enrich(h)
        if j is None:
            skipped += 1
            continue
        jobs.setdefault(h["book"], []).append(j)
    return jobs, skipped


# --------------------------------------------------------------- القياسات --
def ink_clusters(page, win, zoom=3.0, delta=60, gap=2, min_h=0.7,
                 mode="global", min_col=None):
    """تكشف مناطق الحبر.

    mode="global": مرجع واحد لكل النافذة (سريع، يعمل حيث التباين عالٍ).
    mode="row":    مرجع لكل صفيّ على حدة — يُلغي تأثير التدرّج اللوني في
                   الخلفية (صفحات التذييل ذات الشريط المتدرّج منخفض التباين).
                   معه يُستبعد عمود الحبر إن لم يثبت في >=3 صفوف، حتى لا
                   يدخل ضجيج التدرّج في حدود العرض فيهتز مركز القياس.
    """
    clip = pymupdf.Rect(win)
    clip.intersect(page.rect)
    if clip.is_empty or clip.width < 2 or clip.height < 2:
        return []
    if min_col is None:
        min_col = 3 if mode == "row" else 0
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip)
    w, h, n, s = pix.width, pix.height, pix.n, pix.samples
    lums = [0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]
            for i in range(0, len(s), n)]
    if mode == "row":
        refs = []
        for y in range(h):
            b = y * w * n
            row = sorted(0.299 * s[b + x * n] + 0.587 * s[b + x * n + 1] +
                         0.114 * s[b + x * n + 2] for x in range(w))
            refs.append(row[len(row) // 2])
    else:
        refs = [sorted(lums)[len(lums) // 2]] * h
    mask = [bytearray(w) for _ in range(h)] if min_col >= 1 else None
    rows = []
    for y in range(h):
        cnt, xs = 0, []
        b = y * w * n
        med = refs[y]
        for x in range(w):
            i = b + x * n
            L = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]
            if abs(L - med) > delta:
                cnt += 1
                xs.append(x)
                if mask is not None:
                    mask[y][x] = 1
        rows.append((cnt, (min(xs), max(xs)) if xs else None))
    out, cur = [], None
    for y, (cnt, xr) in enumerate(rows):
        if cnt >= 3:
            if cur is None:
                cur = [y, y, xr[0], xr[1], cnt]
            else:
                cur[1] = y
                cur[2] = min(cur[2], xr[0])
                cur[3] = max(cur[3], xr[1])
                cur[4] += cnt
        else:
            if cur is not None:
                out.append(cur)
                cur = None
    if cur is not None:
        out.append(cur)
    if mask is not None:
        # إعادة ضبط حدود العرض: أعمدة ثابتة فقط (>= min_col صفوف)
        fixed = []
        for y0, y1, x0, x1, cnt in out:
            col = [0] * w
            for yy in range(y0, y1 + 1):
                mrow = mask[yy]
                for xx in range(x0, x1 + 1):
                    if mrow[xx]:
                        col[xx] += 1
            keep = [xx for xx in range(x0, x1 + 1) if col[xx] >= min_col]
            if keep:
                x0, x1 = keep[0], keep[-1]
            fixed.append([y0, y1, x0, x1, cnt])
        out = fixed
    res = []
    for y0, y1, x0, x1, cnt in out:
        if (y1 - y0) / zoom < min_h:
            continue
        if res and (y0 - res[-1][1]) / zoom <= gap:
            p = res[-1]
            p[1] = y1
            p[2] = min(p[2], x0)
            p[3] = max(p[3], x1)
            p[4] += cnt
        else:
            res.append([y0, y1, x0, x1, cnt])
    return [dict(y0=clip.y0 + r[0] / zoom, y1=clip.y0 + r[1] / zoom,
                 x0=clip.x0 + r[2] / zoom, x1=clip.x0 + r[3] / zoom,
                 px=r[4]) for r in res]


def union(cl):
    return dict(y0=min(c["y0"] for c in cl), y1=max(c["y1"] for c in cl),
                x0=min(c["x0"] for c in cl), x1=max(c["x1"] for c in cl),
                px=sum(c["px"] for c in cl))


def density(page, rect, mode="global", delta=60):
    cl = ink_clusters(page, rect, mode=mode, delta=delta)
    if not cl:
        return 0.0
    u = union(cl)
    area = max(1.0, (u["y1"] - u["y0"]) * (u["x1"] - u["x0"]) * 9.0)
    return u["px"] / area


def color_in(page, rect, zoom=3.0, delta=45):
    clip = pymupdf.Rect(rect)
    clip.intersect(page.rect)
    if clip.is_empty:
        return None
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip)
    w, h, n, s = pix.width, pix.height, pix.n, pix.samples
    lums = [0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]
            for i in range(0, len(s), n)]
    med = sorted(lums)[len(lums) // 2]
    dev = []
    for i in range(0, len(s), n):
        L = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]
        if abs(L - med) > delta:
            dev.append((s[i], s[i + 1], s[i + 2]))
    if len(dev) < 8:
        return None
    dev.sort()
    m = dev[len(dev) // 2]
    return (m[0] / 255.0, m[1] / 255.0, m[2] / 255.0)


def _hexcol(hx):
    """'#8A9792' -> (0.54, 0.59, 0.56) أو None."""
    if not hx or not isinstance(hx, str) or not hx.startswith("#"):
        return None
    try:
        hx = hx.strip()
        if len(hx) != 7:
            return None
        return tuple(int(hx[i:i + 2], 16) / 255.0 for i in (1, 3, 5))
    except Exception:
        return None


def find_line(page, job):
    hits = []
    for b in page.get_text("dict")["blocks"]:
        if b.get("type") != 0:
            continue
        for l in b.get("lines", []):
            txt = "".join(sp["text"] for sp in l["spans"])
            if not is_target(cfold(txt), page.number):
                continue
            if abs(l["spans"][0]["size"] - job["size"]) > 0.6:
                continue
            hits.append((abs(l["bbox"][1] - job["bbox"][1]), l))
    if not hits:
        return None
    hits.sort(key=lambda t: t[0])
    return hits[0][1]


# --------------------------------------------------- قياس النص على صفحة تجريبية --
_SMCACHE = {}
SW, SH, SX, SY = 1400, 400, 50, 60


def _css(font, size, color):
    return ("@font-face{font-family:nb;src:url(%s);}"
            "*{font-family:nb;font-size:%.2fpx;line-height:1.0;white-space:nowrap;"
            "color:%s;}") % (FILEMAP[font], size,
                             "#%02X%02X%02X" % tuple(
                                 int(round(min(1.0, max(0.0, c)) * 255))
                                 for c in color))


def css_align(align):
    # MuPDF يعكس left/right مع dir="rtl"
    return {"center": "center", "right": "left", "left": "right"}[align]


def _html(text, align):
    return '<div dir="rtl" style="text-align:%s">%s</div>' % (
        css_align(align), text)


def measure_text(text, font, size, color, align, mode="global", delta=60):
    """يرجع حجم الحبر ومواضعه بالنسبة لصندوق القياس (عرض SW).

    mode/delta يجب أن يطابقا طريقة قياس الهدف في الصفحة الحقيقية وإلا
    انحراف المقاس المحسوب عن المقاس المطلوب.
    """
    key = (text, font, round(size, 2), align, mode, delta)
    if key in _SMCACHE:
        return _SMCACHE[key]
    d = pymupdf.open()
    p = d.new_page(width=SW + 100, height=SH + 100)
    # خلفية تباين مع لون النص (أبيض لنص داكن، أسود لنص فاتح)
    Lc = 0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]
    bg = 1.0 if Lc < 0.5 else 0.0
    p.draw_rect(p.rect, color=(bg, bg, bg), fill=(bg, bg, bg))
    box = pymupdf.Rect(SX, SY, SX + SW, SY + SH)
    p.insert_htmlbox(box, _html(text, align), css=_css(font, size, color),
                     archive=archive(), scale_low=0.0)
    cl = ink_clusters(p, box, mode=mode, delta=delta)
    d.close()
    if not cl:
        raise RuntimeError("measure failed for %r" % text[:30])
    u = union(cl)
    res = dict(w=u["x1"] - u["x0"], h=u["y1"] - u["y0"],
               lx0=u["x0"] - box.x0, lx1=u["x1"] - box.x0,
               ly0=u["y0"] - box.y0, ly1=u["y1"] - box.y0)
    _SMCACHE[key] = res
    return res


# ------------------------------------------------------------------ التحديد --
def _avoid_lines(page, redact, target_line, tgt):
    """يقيّد ارتفاع مستطيل الإخفاء حتى لا يلامس مربع أي سطر آخر.

    PyMuPDF يبني مربع السطر من صعود/هبوط الخط (أكبر من الحبر الظاهر)،
    فإذا تقاطع مستطيلنا مع مربع جار فإنه يحذف كلمات الجار ضمن نطاق عرضنا
    حتى لو كان حبرها خارج المستطيل عموديًا. الملاذ الآمن: شريط أفقي
    خالٍ بين مربعات الأسطر ويحتوي مركز حبر الهدف.

    نُصنّف «الجوار» بالحبر لا بمربع السطر: ما يقع حبره داخل نطاق حبر الهدف
    فهو من السطر البصري نفسه (نقاط • والطبقة المزدوجة) ولا يُتجنّب.
    """
    tl = target_line["bbox"]
    tt = "".join(sp["text"] for sp in target_line["spans"])
    iv0, iv1 = tl[1] - 1.0, tl[3] + 1.0
    blocks = []
    for b in page.get_text("dict")["blocks"]:
        if b.get("type") != 0:
            continue
        for l in b.get("lines", []):
            bb = l["bbox"]
            if list(bb) == list(tl):
                continue
            if "".join(sp["text"] for sp in l["spans"]) == tt:
                continue                      # الطبقة المزدوجة للهدف نفسه
            if bb[2] < redact.x0 or bb[0] > redact.x1:
                continue                      # لا تقاطع أفقيًا
            if bb[3] <= iv0 or bb[1] >= iv1:
                continue                      # خارج النطاق الرأسي
            # مركز حبر هذا السطر داخل نطاق حبر الهدف؟ إذن هو من سطرنا البصري
            cl = ink_clusters(page, pymupdf.Rect(bb))
            if not cl:
                continue
            cy = (min(c["y0"] for c in cl) + max(c["y1"] for c in cl)) / 2.0
            if tgt["y0"] - 1.0 <= cy <= tgt["y1"] + 1.0:
                continue
            blocks.append([max(bb[1], iv0), min(bb[3], iv1)])
    if not blocks:
        return redact
    blocks.sort()
    merged = []
    for a, b in blocks:
        if merged and a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    gaps, cur = [], iv0
    for a, b in merged:
        if a > cur:
            gaps.append((cur, a))
        cur = max(cur, b)
    if cur < iv1:
        gaps.append((cur, iv1))
    if not gaps:
        return None
    ink_cy = (tgt["y0"] + tgt["y1"]) / 2.0
    win = None
    for a, b in gaps:
        if a <= ink_cy <= b:
            win = (a, b)
            break
    if win is None:
        win = max(gaps, key=lambda g: g[1] - g[0])
    y0, y1 = max(redact.y0, win[0]), min(redact.y1, win[1])
    if y1 - y0 < 1.0 or y0 >= tl[3] or y1 <= tl[1]:
        return None
    return pymupdf.Rect(redact.x0, y0, redact.x1, y1)


def derive(page, job):
    line = find_line(page, job)
    if line is None:
        return None
    bbox = pymupdf.Rect(line["bbox"])
    origins = [sp["origin"][1] for sp in line["spans"]]
    bl_min, bl_max = min(origins), max(origins)
    size = job["size"]

    win = pymupdf.Rect(bbox.x0 - 12, bbox.y0 - 16, bbox.x1 + 12, bbox.y1 + 16)
    win.intersect(page.rect)
    if job["x_left_min"] is not None:          # تذييل: نستبعد الشارة من القياس
        win.x0 = max(win.x0, job["x_left_min"])
    cl = ink_clusters(page, win)
    # يجب أن يقع حبر الهدف داخل مربع السطر نفسه؛ وإلا فحبر غير مرئي للطريقة
    # العادية (خلفية متدرّجة منخفضة التباين) → نعيد الكشف بمرجع لكل صفيّ.
    ink = ("global", 60)
    if not any(c["y1"] > bbox.y0 - 2.5 and c["y0"] < bbox.y1 + 2.5 for c in cl):
        cl2 = ink_clusters(page, win, delta=10, mode="row")
        if not any(c["y1"] > bbox.y0 - 2.5 and c["y0"] < bbox.y1 + 2.5
                   for c in cl2):
            return None
        cl = cl2
        ink = ("row", 10)
    base = bl_max
    ordered = sorted(cl, key=lambda c: abs((c["y0"] + c["y1"]) / 2 - base))
    sel = [ordered[0]]
    changed = True
    while changed:
        changed = False
        top = min(c["y0"] for c in sel)
        bot = max(c["y1"] for c in sel)
        for c in cl:
            if c in sel:
                continue
            if c["y1"] <= top and (top - c["y1"]) <= 4.0:
                sel.append(c)
                changed = True
            elif c["y0"] >= bot and (c["y0"] - bot) <= 4.0:
                sel.append(c)
                changed = True
    tgt = union(sel)
    prev_max = max([c["y1"] for c in cl if c["y1"] <= tgt["y0"]] or [-1e9])
    next_min = min([c["y0"] for c in cl if c["y0"] >= tgt["y1"]] or [1e9])

    col = color_in(page, pymupdf.Rect(tgt["x0"], tgt["y0"], tgt["x1"], tgt["y1"]))
    if col is None:
        col = _hexcol(job.get("hex")) or (0, 0, 0)
    dens0 = density(page, pymupdf.Rect(tgt["x0"], tgt["y0"],
                                       tgt["x1"], tgt["y1"]),
                    mode=ink[0], delta=ink[1])

    fonts = list(job["fonts"])
    # نقيس النص بكل خط مرشّح ونختار الأقرب عرضًا للنص الأصلي
    # (لا نغيّر المقاس ولا نبدّل الخط أثناء التنفيذ حتى لا تتذبذب المحاولات)
    tw = max(tgt["x1"] - tgt["x0"], 1.0)
    best_f, best_m, best_e = None, None, None
    for f in fonts:
        try:
            mm = measure_text(job["text"], f, size, col, job["align"])
        except Exception:
            continue
        e = abs(mm["w"] - tw) / tw
        if best_e is None or e < best_e:
            best_f, best_m, best_e = f, mm, e
    if best_f is None:
        return None
    fonts = [best_f] + [f for f in fonts if f != best_f]
    m = best_m
    # نضبط المقاس مرة واحدة هنا، حتى يُحسب عرض المستطيل بمقاسه النهائي
    th = tgt["y1"] - tgt["y0"]
    for _ in range(4):
        if m["h"] <= 0:
            return None
        if abs(m["h"] - th) <= 0.05 * th:
            break
        ns = size * th / m["h"]
        ns = max(job["size"] * 0.7, min(job["size"] * 1.5, ns))
        if abs(ns - size) < 0.08:
            break
        size = round(ns, 2)
        m = measure_text(job["text"], best_f, size, col, job["align"])

    # ---- المستطيل ----
    y0 = max(tgt["y0"] - 2.5, prev_max + 1.5)
    y1 = min(tgt["y1"] + 2.5, next_min - 1.5)
    grow = max(0.0, (m["h"] - (tgt["y1"] - tgt["y0"])) / 2.0) + 1.5
    y0 = min(y0, tgt["y0"] - grow)
    y1 = max(y1, tgt["y1"] + grow)
    if y1 - y0 < size * 0.7:
        return None

    if job["align"] == "center":
        anchor = (tgt["x0"] + tgt["x1"]) / 2
    elif job["align"] == "right":
        anchor = bbox.x1
    else:
        anchor = bbox.x0
    if job["x_left_min"] is not None:                      # تذييل: نتجنّب الشارة
        xs = [sp["bbox"] for sp in line["spans"]
              if sp["bbox"][2] >= job["x_left_min"]
              and sp["bbox"][0] <= job["x_right_max"]]
        anchor = (min(b[0] for b in xs) + max(b[2] for b in xs)) / 2
        # يجب أن يغطي المستطيل النص القديم كاملًا وإلا بقيت أطرافه
        span = max(tgt["x1"] - tgt["x0"], m["w"]) + 8
        x0 = max(job["x_left_min"],
                 min(anchor - span / 2, tgt["x0"] - 2.0))
        x1 = min(job["x_right_max"],
                 max(anchor + span / 2, tgt["x1"] + 2.0))
    else:
        need = max(tgt["x1"] - tgt["x0"], m["w"]) + 14
        if job["align"] == "center":
            x0, x1 = anchor - need / 2, anchor + need / 2
        elif job["align"] == "right":
            x0, x1 = anchor - need, anchor + 3
        else:
            x0, x1 = anchor - 3, anchor + need
    x0 = max(3.0, x0)
    x1 = min(page.rect.x1 - 3.0, x1)
    redact = pymupdf.Rect(x0, y0, x1, y1)

    # فحص الأمان: لا يجوز أن يحتوي المستطيل حبرًا خارج نطاق الهدف
    for _ in range(5):
        cl2 = ink_clusters(page, redact)
        bad = []
        for c in cl2:
            if c["y1"] - c["y0"] < 0.8:
                continue
            if (c["y1"] < tgt["y0"] - 2.0) or (c["y0"] > tgt["y1"] + 2.0) or \
               (c["x1"] < tgt["x0"] - 12.0) or (c["x0"] > tgt["x1"] + 12.0):
                bad.append(c)
        if not bad:
            break
        for c in bad:
            if c["y1"] < tgt["y0"]:
                redact.y1 = min(redact.y1, c["y0"] - 1.0)
            elif c["y0"] > tgt["y1"]:
                redact.y0 = max(redact.y0, c["y1"] + 1.0)
            elif c["x1"] < tgt["x0"]:
                redact.x1 = min(redact.x1, c["x0"] - 1.5)
            else:
                redact.x0 = max(redact.x0, c["x1"] + 1.5)
        if redact.width < m["w"] + 3 or redact.height < size * 0.7:
            return None
    else:
        return None

    # لا يجوز أن يتقاطع المستطيل مع مربع أي سطر غير الهدف
    redact = _avoid_lines(page, redact, line, tgt)
    if redact is None:
        return None

    # نافذة القياس: خالية من حبر أي سطر آخر (بالحبر لا بمربع السطر)
    mx0 = min(redact.x0, tgt["x0"]) - 4.0
    mx1 = max(redact.x1, tgt["x1"]) + 4.0
    my0, my1 = tgt["y0"] - 3.0, tgt["y1"] + 3.0
    for c in ink_clusters(page, pymupdf.Rect(mx0, my0, mx1, my1)):
        if c["y1"] < tgt["y0"]:
            my0 = max(my0, c["y1"] + 1.0)
        elif c["y0"] > tgt["y1"]:
            my1 = min(my1, c["y0"] - 1.0)
    if my1 - my0 < 2.0:
        return None
    mwin = pymupdf.Rect(mx0, my0, mx1, my1)

    return dict(line=line, bbox=bbox, tgt=tgt, redact=redact, anchor=anchor,
                mwin=mwin, ink=ink,
                align=job["align"], baseline=bl_max, color=col, dens0=dens0,
                size=size, fonts=fonts, meas=m, text=job["text"],
                win=win, margin=(prev_max, next_min))


# ------------------------------------------------------------------ التنفيذ --
def _place_box(d0, pad_x=40, pad_y=60):
    """يحسب صندوق الإدراج من القياس المسبق فيَقِع الحبر مكانه من أول محاولة."""
    m, a, ax = d0["meas"], d0["align"], d0["anchor"]
    W = max(m["w"] + 2 * pad_x, 60)
    H = m["h"] + pad_y
    if a == "center":
        x0 = ax - W / 2
    elif a == "right":                       # الفجوة اليمنى ثابتة
        gap_r = SW - m["lx1"]
        x0 = ax + gap_r - W
    else:
        x0 = ax - m["lx0"]
    y0 = (d0["tgt"]["y0"] + d0["tgt"]["y1"]) / 2 - m["h"] / 2 - m["ly0"]
    box = pymupdf.Rect(x0, y0, x0 + W, y0 + H)
    box.intersect(d0["page_rect"])
    return box


def fix_page(page, job, fdir):
    d0 = derive(page, job)
    if d0 is None:
        return "NOT_FOUND", None
    d0["page_rect"] = page.rect
    redact = d0["redact"]
    mwin = d0["mwin"]
    tgt = d0["tgt"]
    size = d0["size"]
    color = d0["color"]
    fonts = d0["fonts"]
    text = d0["text"]
    align = d0["align"]
    fi, dy, dx, log = 0, 0.0, 0.0, []
    imode, idelta = d0.get("ink", ("global", 60))
    dens = 0.0
    u = None

    for attempt in range(6):
        font = fonts[fi]
        m = measure_text(text, font, size, color, align)
        d0["meas"] = m
        box = _place_box(d0)
        box.y0 += dy
        box.y1 += dy
        box.x0 += dx
        box.x1 += dx

        page.add_redact_annot(redact, fill=None)
        page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE,
                              graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)
        spare, scale = page.insert_htmlbox(box, _html(text, align),
                                           css=_css(font, size, color),
                                           archive=archive(), scale_low=0.0)
        new = ink_clusters(page, mwin, mode=imode, delta=idelta)
        if not new:
            return "NO_NEW_INK|sc=%.3f spare=%.1f" % (scale, spare), \
                   dict(redact=redact, mwin=mwin, tgt=tgt)
        u = union(new)
        nc, oc = (u["y0"] + u["y1"]) / 2, (tgt["y0"] + tgt["y1"]) / 2
        nh, oh = (u["y1"] - u["y0"]), (tgt["y1"] - tgt["y0"])
        dens = density(page, mwin, mode=imode, delta=idelta)
        dcy, dh = oc - nc, oh - nh
        if align == "center":
            dcx = (tgt["x0"] + tgt["x1"]) / 2 - (u["x0"] + u["x1"]) / 2
        elif align == "right":
            dcx = tgt["x1"] - u["x1"]
        else:
            dcx = tgt["x0"] - u["x0"]
        log.append("%s a%d dy=%.2f dx=%.2f dh=%.2f sc=%.2f d=%.2f/%.2f"
                   % (font[:4], attempt, dcy, dcx, dh, scale, dens, d0["dens0"]))
        # عتبة الارتفاع: تُراعي ضجيج القياس. على الخلفية المتدرّجة يُقدَّر
        # الحبر ±2 نقطة (2 بكسل) فتكون العتبة أوسع، أما عتبة الموضع فصارمة.
        htol = max(1.2, 0.10 * oh) if imode == "global" \
            else max(2.5, 0.20 * oh)
        if abs(dcy) <= 0.7 and abs(dcx) <= 1.2 and \
                abs(dh) <= htol and scale > 0.995:
            return "OK|" + " ".join(log), dict(tgt=tgt, new=u, redact=redact,
                                               mwin=mwin,
                                               dens=(dens, d0["dens0"]),
                                               size=size)
        dy += dcy
        dx += dcx
    return "UNSTABLE|" + " ".join(log), dict(tgt=tgt, new=u, redact=redact,
                                             mwin=mwin, dens=(dens, d0["dens0"]),
                                             size=size)
