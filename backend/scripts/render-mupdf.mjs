import * as mupdf from 'mupdf';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, statSync } from 'fs';
import { resolve } from 'path';

const PDF_PATH = 'D:\\livres eleves\\French_Book_Grade2_Tunisia.pdf';
const OUTPUT_DIR = resolve('frontend/public/assets/books/y2french');

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
for (const f of readdirSync(OUTPUT_DIR)) unlinkSync(resolve(OUTPUT_DIR, f));
console.log('Cleaned old files');

console.log('Loading PDF with MuPDF...');
const pdfBytes = readFileSync(PDF_PATH);
const doc = mupdf.Document.openDocument(pdfBytes, 'application/pdf');
const pageCount = doc.countPages();
console.log(`PDF has ${pageCount} pages`);

for (let i = 0; i < pageCount; i++) {
  const page = doc.loadPage(i);
  const stext = page.toStructuredText('preserve-whitespace').asJSON();
  
  // Render page to pixmap
  const pixmap = page.toPixmap([2, 0, 0, 2, 0, 0], mupdf.ColorSpace.DeviceRGB);
  const png = pixmap.asPNG();
  
  const filename = `page-${String(i + 1).padStart(3, '0')}.png`;
  const filepath = resolve(OUTPUT_DIR, filename);
  writeFileSync(filepath, png);
  
  const sz = statSync(filepath).size;
  console.log(`Saved ${filename} (${Math.round(sz / 1024)}KB)`);
  
  page.destroy();
  pixmap.destroy();
}

doc.destroy();
console.log(`\nDone! ${pageCount} pages saved to ${OUTPUT_DIR}`);
