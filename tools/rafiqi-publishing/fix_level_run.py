# -*- coding: utf-8 -*-
"""مشغّل محرك الإصلاح: pilot / apply + التحقق + ورقة المقارنة قبل/بعد."""
import os, sys, io, json, shutil, hashlib, argparse
import pymupdf
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fix_level as FL

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = FL.HERE
FIXED = FL.FIXED
SHOTS = FL.SHOTS

PILOT_BOOKS = [
    "رفيقي في الإنتاج الكتابي - السنة الرابعة ابتدائي.pdf",
    "رفيقي في الرياضيات - السنة الرابعة ابتدائي.pdf",
    FL.M1,
    FL.IQ,
    FL.BK1,
]
MAXROWS = 9


def render_hash(page, zoom=0.6):
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
    return hashlib.md5(pix.samples).hexdigest()


def sample_jobs(jobs):
    if len(jobs) <= MAXROWS:
        return list(jobs)
    p0 = [j for j in jobs if j["page"] == 0]
    rest = [j for j in jobs if j["page"] != 0]
    picks = p0[:3]
    if rest:
        step = max(1, len(rest) // (MAXROWS - len(picks)))
        picks += rest[::step][:MAXROWS - len(picks)]
    return picks


def crop(job, page, redact, pad=8, zoom=3.0):
    r = pymupdf.Rect(*redact)
    clip = pymupdf.Rect(r.x0 - pad, r.y0 - pad, r.x1 + pad, r.y1 + pad)
    clip.intersect(page.rect)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip)
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")


def sheet(before, after, rows, out):
    A = pymupdf.open(before)
    B = pymupdf.open(after)
    cells = []
    for pno, job, redact in rows:
        a = crop(job, A[pno], redact)
        b = crop(job, B[pno], redact)
        w = max(a.width, b.width)
        c = Image.new("RGB", (w, a.height + b.height + 8), (200, 30, 30))
        c.paste(a, ((w - a.width) // 2, 0))
        c.paste(b, ((w - b.width) // 2, a.height + 8))
        cells.append(c)
    A.close()
    B.close()
    if not cells:
        return None
    W = max(c.width for c in cells) + 24
    H = sum(c.height for c in cells) + 12 * (len(cells) + 1)
    s = Image.new("RGB", (W, H), (235, 235, 235))
    y = 12
    for c in cells:
        s.paste(c, ((W - c.width) // 2, y))
        y += c.height + 12
    s.save(out)
    return s.size


def leftover_px(A, B, i, redact, tgt, zoom=3.0):
    """بكسلات من النص القديم بقيت مرئية خارج مستطيل الإخفاء (أطراف لم تُحذف)."""
    r = pymupdf.Rect(tgt["x0"] - 1, tgt["y0"] - 1, tgt["x1"] + 1, tgt["y1"] + 1)
    r.intersect(A[i].rect)
    if r.is_empty:
        return 0
    strips = []
    if r.x0 < redact.x0 - 1.0:
        strips.append(pymupdf.Rect(r.x0, r.y0, redact.x0 - 1.0, r.y1))
    if r.x1 > redact.x1 + 1.0:
        strips.append(pymupdf.Rect(redact.x1 + 1.0, r.y0, r.x1, r.y1))
    n = 0
    for s in strips:
        if s.width < 1 or s.height < 1:
            continue
        s.intersect(A[i].rect)
        pa = A[i].get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=s)
        pb = B[i].get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=s)
        sa, sb, nn = pa.samples, pb.samples, pa.n
        lums = [0.299 * sa[k] + 0.587 * sa[k + 1] + 0.114 * sa[k + 2]
                for k in range(0, len(sa), nn)]
        med = sorted(lums)[len(lums) // 2]
        for k in range(0, len(sa), nn):
            La = 0.299 * sa[k] + 0.587 * sa[k + 1] + 0.114 * sa[k + 2]
            Lb = 0.299 * sb[k] + 0.587 * sb[k + 1] + 0.114 * sb[k + 2]
            if abs(La - med) > 50 and abs(Lb - med) > 50:
                n += 1
    return n


def verify(before, after, edited, full):
    A = pymupdf.open(before)
    B = pymupdf.open(after)
    errs = []
    if A.page_count != B.page_count:
        errs.append("page count %d -> %d" % (A.page_count, B.page_count))
    n = min(A.page_count, B.page_count)
    for i in range(n):
        ha = render_hash(A[i])
        hb = render_hash(B[i])
        if ha == hb:
            if i in edited:
                errs.append("p%d: لم يتغير رغم الإصلاح" % i)
            continue
        if i not in edited:
            errs.append("p%d: تغيّر دون أن يكون هدفًا" % i)
            continue
        zoom = 1.5
        pa = A[i].get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
        pb = B[i].get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
        if pa.width != pb.width or pa.height != pb.height:
            errs.append("p%d: حجم الصفحة تغيّر" % i)
            continue
        allowed = [e["allowed"] for e in edited[i]]
        sa, sb, nn = pa.samples, pb.samples, pa.n
        bad, bx0, by0, bx1, by1 = 0, 1e9, 1e9, -1e9, -1e9
        for y in range(pa.height):
            py = y / zoom
            for x in range(pa.width):
                px = x / zoom
                skip = False
                for r in allowed:
                    if r.x0 <= px <= r.x1 and r.y0 <= py <= r.y1:
                        skip = True
                        break
                if skip:
                    continue
                i0 = (y * pa.width + x) * nn
                if (abs(sa[i0] - sb[i0]) > 26 or abs(sa[i0 + 1] - sb[i0 + 1]) > 26
                        or abs(sa[i0 + 2] - sb[i0 + 2]) > 26):
                    bad += 1
                    if px < bx0:
                        bx0 = px
                    if px > bx1:
                        bx1 = px
                    if py < by0:
                        by0 = py
                    if py > by1:
                        by1 = py
        if bad > 40:
            errs.append("p%d: %d بكس خارج المستطيل عند x=%.1f..%.1f y=%.1f..%.1f"
                        % (i, bad, bx0, bx1, by0, by1))
        for e in edited[i]:
            if not e.get("tgt"):
                continue
            nl = leftover_px(A, B, i, e["redact"], e["tgt"])
            if nl > 25:
                errs.append("p%d: %d بكس من النص القديم بقي خارج المستطيل"
                            % (i, nl))
    bad_txt, new_ok = [], False
    for i in range(n):
        t = B[i].get_text("text")
        if "الأساسي" in t or "الأساس " in t:
            bad_txt.append(i)
        if "الابتدائي" in t:
            new_ok = True
    A.close()
    B.close()
    return errs, bad_txt, new_ok


def run(mode):
    jobs_all, skipped = FL.build_jobs()
    fdir = FL.prep_fonts()
    log = ["جرد: %d سطرًا مطلوبًا، %d لا يحتاج إصلاحًا"
           % (sum(len(v) for v in jobs_all.values()), skipped)]
    books = PILOT_BOOKS if mode == "pilot" else sorted(jobs_all)
    outdir = FL.PILOT if mode == "pilot" else os.path.join(HERE, "_out")
    os.makedirs(outdir, exist_ok=True)
    ok_books = []
    for bk in books:
        src = os.path.join(FIXED, bk)
        jobs = jobs_all.get(bk, [])
        if not os.path.exists(src) or not jobs:
            log.append("!! missing/no-jobs %s" % bk[:50])
            continue
        dst = os.path.join(outdir, bk)
        d = pymupdf.open(src)
        edited, res, rows = {}, [], []
        sampled = set(id(j) for j in sample_jobs(jobs))
        fails = 0
        for j in sorted(jobs, key=lambda x: (x["page"], x["bbox"][1])):
            st, info = FL.fix_page(d[j["page"]], j, fdir)
            res.append((j["page"], st))
            if not st.startswith("OK"):
                fails += 1
            if info is None:
                continue
            rr = pymupdf.Rect(info["redact"])
            t = info.get("tgt")
            allowed = pymupdf.Rect(rr)
            if t:
                allowed = allowed | pymupdf.Rect(t["x0"], t["y0"], t["x1"], t["y1"])
            nu = info.get("new")
            if nu:
                allowed = allowed | pymupdf.Rect(nu["x0"], nu["y0"],
                                                 nu["x1"], nu["y1"])
            allowed = pymupdf.Rect(allowed.x0 - 2, allowed.y0 - 2,
                                   allowed.x1 + 2, allowed.y1 + 2)
            edited.setdefault(j["page"], []).append(
                dict(allowed=allowed, redact=rr, tgt=t))
            if id(j) in sampled:
                rows.append((j["page"], j, allowed))
        d.save(dst, garbage=4, deflate=True)
        d.close()
        errs, bad_txt, new_ok = verify(src, dst, edited, mode == "apply")
        size = os.path.getsize(dst) / 1048576.0
        good = (fails == 0 and not errs and size <= 25.0)
        if good:
            ok_books.append(dst)
        log.append("%-46s jobs=%-3d fail=%d errs=%d بقي_أساسي=%d جديد=%s %.1fMiB %s"
                   % (bk[:44], len(jobs), fails, len(errs), len(bad_txt),
                      new_ok, size, "OK" if good else "<<<"))
        for e in errs[:5]:
            log.append("      ERR " + e)
        if bad_txt:
            log.append("      بقي «الأساسي» في الصفحات: %s" % bad_txt[:8])
        badst = [x for x in res if not x[1].startswith("OK")]
        for p, st in badst[:5]:
            log.append("      job p%d -> %s" % (p, st[:150]))
        d0 = [x for x in res if x[1].startswith("OK")][:3]
        for p, st in d0:
            log.append("      %s" % st[:170])
        if mode == "pilot":
            nm = "".join(c for c in bk if c.isalnum())[:26]
            out = os.path.join(SHOTS, "pilot_%s.png" % nm)
            sz = sheet(src, dst, rows, out)
            log.append("      sheet %s %s" % (os.path.basename(out), sz))
    with open(os.path.join(HERE, "fixlog_%s.txt" % mode), "w",
              encoding="utf-8") as fh:
        fh.write("\n".join(log))
    print("\n".join(log))
    print("\nOK books: %d" % len(ok_books))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["pilot", "apply"])
    a = ap.parse_args()
    run(a.mode)
