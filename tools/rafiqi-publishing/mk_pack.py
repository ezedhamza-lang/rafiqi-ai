# -*- coding: utf-8 -*-
"""يجمع الكتب الخمسة المنشورة في ملف ZIP واحد للتحميل السريع."""
import os, sys, json, zipfile
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

FIXED = r"C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED"
OUT = r"C:\Users\ezedd\AppData\Local\Temp\opencode\posts\upload"
os.makedirs(OUT, exist_ok=True)

BOOKS = [
    ("رفيقي في الإنتاج الكتابي - السنة الاولى ابتدائي.pdf", "1-rafiqi-production-s1.pdf"),
    ("رفيقي_في_الرياضيات_س1_كراس_التمارين_كامل.pdf", "2-rafiqi-maths-s1.pdf"),
    ("رفيقي_في_القراءة_س2_كتاب_التلميذ.pdf", "3-rafiqi-reading-s2.pdf"),
    ("رفيقي_في_القراءة_الشامل_الكتاب_الكامل-للسنة-الثانية.pdf", "4-rafiqi-reading-s2-comprehensive.pdf"),
    ("رفيقي_في_الإيقاظ_العلمي_س2_كتاب_التلميذ.pdf", "5-rafiqi-iqaid-sciences-s2.pdf"),
]

README = """سلسلة «رفيقي» — كتب مجانية
==============================

مؤلّف السلسلة: الأستاذ حمزة عزالدين
الموقع: https://rafiqitn.blogspot.com
المنصة : https://rafiqi-platform.onrender.com

محتوى الملف:
1-rafiqi-production-s1.pdf ............. الإنتاج الكتابي — السنة الأولى (156 صفحة)
2-rafiqi-maths-s1.pdf .................. الرياضيات — كراس التمارين، السنة الأولى
3-rafiqi-reading-s2.pdf ................ القراءة — كتاب التلميذ، السنة الثانية
4-rafiqi-reading-s2-comprehensive.pdf .. القراءة الشامل — السنة الثانية
5-rafiqi-iqaid-sciences-s2.pdf ......... الإيقاظ العلمي — السنة الثانية

كلّ الكتب بصيغة PDF وجودة كاملة، والحلّ مجاني.
شكرًا لكم.
"""

ZIP = os.path.join(OUT, "rafiqi-books-free-pack.zip")
missing = []
with zipfile.ZipFile(ZIP, "w", compression=zipfile.ZIP_STORED) as z:
    z.writestr("اقرأني.txt", README)
    for src, arc in BOOKS:
        p = os.path.join(FIXED, src)
        if not os.path.exists(p):
            missing.append(src)
            continue
        z.write(p, arc)

info = {"zip": ZIP, "mb": round(os.path.getsize(ZIP) / 1048576, 2),
        "missing": missing}
with zipfile.ZipFile(ZIP) as z:
    info["entries"] = [(i.filename, round(i.file_size / 1048576, 2)) for i in z.infolist()]
print(json.dumps(info, ensure_ascii=False, indent=1))