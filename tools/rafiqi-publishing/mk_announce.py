# -*- coding: utf-8 -*-
"""يبني نصّ الإعلان عن حزمة الكتب (ZIP) مع أزرار المشاركة."""
import sys, urllib.parse
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BLOG = "https://rafiqitn.blogspot.com"
ZIP = "https://files.catbox.moe/omwuvz.zip"
TEXT = ("📚 كتب «رفيقي» للتحميل المجاني — السنة الأولى والثانية ابتدائي: "
        "الإنتاج الكتابي، الرياضيات، القراءة، القراءة الشامل، الإيقاظ العلمي. "
        "حمّلها من: " + BLOG)


def btn(url, label, color):
    return ('<a class="rfq-btn rfq-share-btn" href="%s" target="_blank" '
            'rel="nofollow noopener" style="background:%s">%s</a>' % (url, color, label))


wa = "https://wa.me/?text=" + urllib.parse.quote(TEXT)
fb = "https://www.facebook.com/sharer/sharer.php?u=" + urllib.parse.quote(BLOG)
tg = "https://t.me/share/url?url=" + urllib.parse.quote(BLOG) + "&text=" + urllib.parse.quote(TEXT)
sh = "\n".join([btn(wa, "واتساب", "#25D366"),
                btn(fb, "فيسبوك", "#1877F2"),
                btn(tg, "تيليغرام", "#229ED9"),
                btn(BLOG, "الموقع", "#444444")])

HTML = """<div class="rfq-post" dir="rtl">
<p class="rfq-kicker">سلسلة رفيقي · <span>تحميل مجاني</span></p>
<h2 class="rfq-title">حمّل كتب «رفيقي» كلّها في ملفّ واحد</h2>
<p class="rfq-lead">جمعنا لك الكتب الخمسة في ملفّ واحد تسهّل التنزيل والمشاركة مع الأهل والمعلّمين. كلّ كتاب بصيغة PDF وبجودة كاملة، والحلّ مجاني بالكامل.</p>
<div class="rfq-facts">
<div class="rfq-fact"><span>المحتوى</span><b>5 كتب + دليل</b></div>
<div class="rfq-fact"><span>الحجم</span><b>36 م.ب</b></div>
<div class="rfq-fact"><span>الصيغة</span><b>ZIP</b></div>
<div class="rfq-fact"><span>السعر</span><b>مجاني</b></div>
</div>
<h3 class="rfq-h3">ما في الملفّ؟</h3>
<ul class="rfq-list">
<li>رفيقي في الإنتاج الكتابي — السنة الأولى (156 صفحة).</li>
<li>رفيقي في الرياضيات — كرّاس التمارين، السنة الأولى.</li>
<li>رفيقي في القراءة — كتاب التلميذ، السنة الثانية.</li>
<li>رفيقي في القراءة الشامل — السنة الثانية.</li>
<li>رفيقي في الإيقاظ العلمي — السنة الثانية.</li>
<li>ملفّ «اقرأني.txt» فيه شرح كلّ كتاب وروابط الموقع.</li>
</ul>
<div class="rfq-cta">
<a class="rfq-btn rfq-btn-main" href="__ZIP__" target="_blank" rel="nofollow noopener">تحميل كلّ الكتب معًا (ZIP · 36 م.ب)</a>
</div>
<p class="rfq-note">وإذا أردت كتابًا واحدًا فقط، فكلّ كتاب له زرّ تحميل في الصفحة الرئيسية.</p>
<h3 class="rfq-h3">ساعدنا نشر الخير — شارك الروابط</h3>
<p class="rfq-note">زرّ واحد يفتح لك واتساب أو فيسبوك لتضع الرابط في حالتك أو في مجموعتك.</p>
<div class="rfq-share">
__SHARE__
</div>
<div class="rfq-meta">سلسلة رفيقي · كتب مجانية · __BLOG__</div>
</div>""".replace("__ZIP__", ZIP).replace("__SHARE__", sh).replace("__BLOG__", BLOG)

open(r"C:\Users\ezedd\AppData\Local\Temp\opencode\posts\upload\p6.html", "w",
     encoding="utf-8").write(HTML)
print("len=%d" % len(HTML))
print(HTML)