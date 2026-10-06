# -*- coding: utf-8 -*-
"""يصدّر عيّنات مرئيّة من كتاب الإنتاج الكتابي س1: python prod1_pages.py"""
import os, sys
import pymupdf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
FIXED = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
OUT = r"C:\Users\ezedd\AppData\Local\Temp\opencode\prod1_sheets"
os.makedirs(OUT, exist_ok=True)
SRC = os.path.join(FIXED, "رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf")

d = pymupdf.open(SRC)
pages = [1, 4, 8, 20, 45, 70, 95, 120, 145, 156]
made = []
for n in pages:
    p = d[n - 1]
    pix = p.get_pixmap(matrix=pymupdf.Matrix(1.15, 1.15))
    path = os.path.join(OUT, "p%03d.png" % n)
    pix.save(path)
    made.append(path)
d.close()
print("\n".join(made))