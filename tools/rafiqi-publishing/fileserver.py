# -*- coding: utf-8 -*-
"""خادم محلي يقدّم ملفات الرفع للمتصفح مع CORS.
   الهدف: تجاوز حدّ 5 MiB في أداة الملفات، إذ يقرأ المتصفح الملف من
   http://127.0.0.1:8765 مباشرةً (لا يمرّ بجسر الأداة).

   التشغيل: python fileserver.py [port]"""
import os, sys, http.server, socketserver

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "posts", "upload")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), H) as httpd:
        sys.stderr.write("serving %s on http://127.0.0.1:%d\n" % (ROOT, PORT))
        httpd.serve_forever()