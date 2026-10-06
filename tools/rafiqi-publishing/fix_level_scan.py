# -*- coding: utf-8 -*-
"""المرحلة 1: جرد كل سطر فيه «من التعليم الأساسي» + النص الكامل + الموضع والخط."""
import os, sys, re, json, glob
import pymupdf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

FIXED = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
HERE = os.path.dirname(os.path.abspath(__file__))

KEEP = re.compile(r"[^ء-ي]+")
A2A = {"\u0623": "\u0627", "\u0625": "\u0627", "\u0622": "\u0627"}


def cfold(text):
    t = KEEP.sub("", text)
    for a, b in A2A.items():
        t = t.replace(a, b)
    return re.sub(r"(.)\1+", r"\1", t)


def detect(c, pno):
    levelish = any(x in c for x in ("الاساس", "الاسايس", "السايس"))
    if pno == 0:
        yeared = ("السنة" in c) and ("منالتعليم" in c) and ("ابتدائ" not in c)
        return levelish or yeared
    return levelish


manifest = []
for f in sorted(glob.glob(os.path.join(FIXED, "*.pdf"))):
    base = os.path.basename(f)
    d = pymupdf.open(f)
    for i in range(d.page_count):
        page = d[i]
        ftypes = {}
        for x in page.get_fonts(full=True):
            ftypes[x[3]] = x[2]
            if len(x) > 4:
                ftypes[x[4]] = x[2]
        for b in page.get_text("dict")["blocks"]:
            if b.get("type") != 0:
                continue
            for l in b.get("lines", []):
                txt = "".join(s["text"] for s in l["spans"])
                c = cfold(txt)
                if not detect(c, i):
                    continue
                sp = l["spans"][0]
                manifest.append({
                    "book": base,
                    "page": i,
                    "bbox": [round(v, 2) for v in l["bbox"]],
                    "size": round(sp["size"], 1),
                    "color": "#%06X" % (sp["color"] & 0xFFFFFF),
                    "font": sp["font"],
                    "ftype": ftypes.get(sp["font"], "?"),
                    "raw": txt,
                })
    d.close()

with open(os.path.join(HERE, "level_manifest.json"), "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, ensure_ascii=False, indent=1)

lines = []
cur = None
for h in manifest:
    if h["book"] != cur:
        cur = h["book"]
        lines.append("")
        lines.append("===== " + cur)
    lines.append("  p%-4d sz=%-5s %-22s %-6s %s" % (
        h["page"], h["size"], h["font"], h["ftype"], h["color"]))
    lines.append("      bbox=%s" % h["bbox"])
    lines.append("      RAW=%r" % h["raw"])
lines.append("")
lines.append("TOTAL: %d lines / %d books" % (
    len(manifest), len(set(h["book"] for h in manifest))))

with open(os.path.join(HERE, "level_manifest.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines))
print("candidates:", len(manifest))
