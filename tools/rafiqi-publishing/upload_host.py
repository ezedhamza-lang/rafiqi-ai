# -*- coding: utf-8 -*-
"""رفع ملفات إلى catbox.moe (مجاني، بلا حساب، رابط مباشر ثابت).
   الاستعمال: python upload_host.py <ملف.pdf> [ملف2 ...]
   النتيجة تُكتب في posts/links.json  {اسم_الملف: الرابط}"""
import os, sys, json, time
import requests

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
LINKS = os.path.join(HERE, "posts", "links.json")
API = "https://catbox.moe/user/api.php"
MIME = {".pdf": "application/pdf", ".png": "image/png",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}


def load():
    if os.path.exists(LINKS):
        return json.load(open(LINKS, encoding="utf-8"))
    return {}


def upload(path):
    ext = os.path.splitext(path)[1].lower()
    name = os.path.basename(path).replace(" ", "_")
    with open(path, "rb") as fh:
        r = requests.post(API, data={"reqtype": "fileupload"},
                          files={"fileToUpload": (name, fh,
                                                  MIME.get(ext, "application/octet-stream"))},
                          timeout=600)
    txt = r.text.strip()
    if r.status_code != 200 or not txt.startswith("http"):
        raise RuntimeError("HTTP %s: %s" % (r.status_code, txt[:200]))
    return txt


def main(files):
    links = load()
    report = []
    for p in files:
        key = os.path.basename(p)
        if key in links:
            report.append({"file": key, "url": links[key], "cached": True})
            continue
        t = time.time()
        try:
            u = upload(p)
        except Exception as e:
            report.append({"file": key, "error": str(e)})
            continue
        links[key] = u
        json.dump(links, open(LINKS, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        report.append({"file": key, "url": u,
                       "MiB": round(os.path.getsize(p) / 1048576, 2),
                       "sec": round(time.time() - t)})
    print(json.dumps({"done": len(report), "report": report},
                     ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1:])
