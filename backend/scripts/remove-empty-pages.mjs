import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';

const PDF_PATH = 'frontend/public/assets/books/y2french.pdf';
const OUTPUT = 'frontend/public/assets/books/y2french.pdf';

console.log('Loading PDF...');
const doc = await PDFDocument.load(readFileSync(PDF_PATH));
console.log(`Before: ${doc.getPageCount()} pages`);

// Remove empty pages in reverse order (page 18 = index 17, page 121 = index 120)
console.log('Removing page 121 (index 120)...');
doc.removePage(120);
console.log('Removing page 18 (index 17)...');
doc.removePage(17);

console.log(`After: ${doc.getPageCount()} pages`);

const bytes = await doc.save();
writeFileSync(OUTPUT, bytes);
console.log(`Saved: ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB`);
