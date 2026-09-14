import * as mupdf from 'mupdf';
import { readFileSync, writeFileSync } from 'fs';

const doc = mupdf.Document.openDocument(readFileSync('frontend/public/assets/books/y2french.pdf'), 'application/pdf');
const emptyPages = [];

for (let i = 0; i < doc.countPages(); i++) {
  const page = doc.loadPage(i);
  const pix = page.toPixmap([1, 0, 0, 1, 0, 0], mupdf.ColorSpace.DeviceRGB);
  const pngBuf = Buffer.from(pix.asPNG());
  
  // Check if page is mostly white by sampling pixels
  const data = pix.getPixels();
  let whiteCount = 0;
  const total = data.length / 4;
  for (let p = 0; p < data.length; p += 4) {
    if (data[p] > 240 && data[p + 1] > 240 && data[p + 2] > 240) whiteCount++;
  }
  const whiteRatio = whiteCount / total;
  
  if (whiteRatio > 0.97) {
    emptyPages.push(i + 1);
    console.log(`Page ${i + 1}: EMPTY (${(whiteRatio * 100).toFixed(1)}% white)`);
  }
  
  page.destroy(); pix.destroy();
}

doc.destroy();
console.log(`\n${emptyPages.length} empty pages found: ${emptyPages.join(', ')}`);
