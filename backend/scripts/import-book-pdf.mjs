import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';

/**
 * استيراد كتاب PDF كما هو (غلاف ← آخر صفحة): كل صفحة تُرسم صورة WebP وتُحفظ في
 * backend/curriculum/assets-books/<slug>/page-NNN.webp
 * الاستخدام: node scripts/import-book-pdf.mjs "<path.pdf>" <slug> [--zoom 2.2] [--q 74]
 * لا يلمس أي كتاب قائم؛ يُضاف السجل بعد ذلك في registry.json ككتاب مستقل.
 */
const [pdfPath, slug, ...rest] = process.argv.slice(2);
if (!pdfPath || !slug) {
  console.error('usage: node import-book-pdf.mjs <file.pdf> <slug> [--zoom 2.2] [--q 74]');
  process.exit(1);
}
const zoom = Number((rest.find((a) => a.startsWith('--zoom')) || '').split(' ')[1] || rest[rest.indexOf('--zoom') + 1] || 2.2);
const qIdx = rest.indexOf('--q');
const quality = qIdx >= 0 ? Number(rest[qIdx + 1]) : 74;

const dst = path.join(process.cwd(), 'curriculum', 'assets-books', slug);
fs.mkdirSync(dst, { recursive: true });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bookimp-'));
const py = path.join(tmp, 'render.py');
fs.writeFileSync(py, `
import pymupdf, os, sys
from PIL import Image
pdf, outdir, zoom, quality = sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4])
doc = pymupdf.open(pdf)
os.makedirs(outdir, exist_ok=True)
n = 0
for i, pg in enumerate(doc, start=1):
    pix = pg.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    png = os.path.join(outdir, 'page-%03d.png' % i)
    pix.save(png)
    im = Image.open(png).convert('RGB')
    wbp = os.path.join(outdir, 'page-%03d.webp' % i)
    im.save(wbp, 'WEBP', quality=quality, method=5)
    os.remove(png)
    n += 1
print('PAGES:', n)
`, 'utf8');

const out = execFileSync('python', [py, path.resolve(pdfPath), dst, String(zoom), String(quality)], { encoding: 'utf8' });
const pages = fs.readdirSync(dst).filter((f) => /^page-\d+\.webp$/.test(f));
const bytes = pages.reduce((s, f) => s + fs.statSync(path.join(dst, f)).size, 0);
console.log(out.trim());
console.log(`slug=${slug} pages=${pages.length} totalMB=${(bytes / 1048576).toFixed(1)} dir=${path.relative(process.cwd(), dst)}`);
fs.rmSync(tmp, { recursive: true, force: true });
