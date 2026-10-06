# أدوات نشر سلسلة «رفيقي»

هذه نسخة **دائمة** من السكربتات التي استُعملت في إصلاح كتب السلسلة ونشرها
على `rafiqitn.blogspot.com`. الكود هنا تقني بحت (لا ذوق شخصي).

**الوثيقة التي تشرح كل شيء**: `RAFIQI-HANDOVER.md` في جذر المستودع.

## التشغيل

```bash
cmd /c "set PYTHONUTF8=1&& C:\Users\ezedd\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe <script>.py"
```

المتطلّبات: `pymupdf` + `Pillow` + `requests` (لا `fontTools`).

## الأقسام

| الملف | الوظيفة |
|---|---|
| `fileserver.py` | خادم CORS محلّي على `8765` — لفرض الملفات على `input[type=file]` في MediaFire (يتجاوز حدّ 5 ميB) |
| `upload_host.py` | رفع إلى catbox (احتياطي بلا حساب) |
| `mk_pack.py` | حزمة ZIP من الكتب المنشورة + ملفّ «اقرأني.txt» |
| `mk_announce.py` | توليد نصّ إعلان الحزمة مع أزرار المشاركة |
| `peek.py` | قصّ أي منطقة في PDF لفحصها بالعين |
| `prod1_*.py` | إصلاح/تحقّق/مقارنة ترويسة كتاب الإنتاج s1 (مثال مرجعي لمحرّك هندسي) |
| `fix_level.py`, `fix_level_run.py`, `fix_level_scan.py`, `level_scan.py` | محرّك تصحيح «التعليم الأساسي» ← «الابتدائي» |
| `promote.py`, `fix_titles.py` | الترقية إلى `_FIXED` بعد الفحص، وتصحيح البيانات الوصفية |
| `posts/p1.html … p6.html` | النصّ الحرفي لكل مقال منشور |

## مسارات مهمّة

- مصدر النشر: `C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED\`
- السجلّ الكامل: `D:\WORK\03-education\RAFIQI-KNOWLEDGE.md`