import { PDFDocument, rgb, StandardFonts, PDFName } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';

const PDF_PATH = 'D:\\livres eleves\\French_Book_Grade2_Tunisia.pdf';
const COVER_PATH = 'C:\\Users\\ezedd\\Downloads\\page-de-garde.png';
const OUTPUT = 'frontend/public/assets/books/y2french.pdf';

console.log('Loading original PDF...');
const pdfBytes = readFileSync(PDF_PATH);
const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

const pageCount = doc.getPageCount();
console.log(`Original: ${pageCount} pages`);

// 1. Replace first page with cover image
console.log('\nReplacing page 1 with cover...');
const coverBytes = readFileSync(COVER_PATH);
const coverImg = await doc.embedPng(coverBytes);
const firstPage = doc.getPage(0);
const { width, height } = firstPage.getSize();
firstPage.drawImage(coverImg, {
  x: 0, y: 0,
  width, height,
});

// 2. Add watermark on all pages
console.log('Adding watermark...');
const font = await doc.embedFont(StandardFonts.Helvetica);
const watermarkText = 'Enseignant : Ezeddine Hamza';

for (let i = 0; i < doc.getPageCount(); i++) {
  const page = doc.getPage(i);
  const { width: pw, height: ph } = page.getSize();
  
  // Watermark at bottom center
  const fontSize = 9;
  const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
  page.drawText(watermarkText, {
    x: (pw - textWidth) / 2,
    y: 18,
    size: fontSize,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
  
  // Small watermark top-right corner
  const cornerText = 'Ezeddine Hamza';
  const cw = font.widthOfTextAtSize(cornerText, 7);
  page.drawText(cornerText, {
    x: pw - cw - 20,
    y: ph - 16,
    size: 7,
    font,
    color: rgb(0.7, 0.7, 0.7),
  });
}

// 3. Detect and remove empty pages
console.log('Checking for empty pages...');
const pagesToRemove = [];
for (let i = 0; i < doc.getPageCount(); i++) {
  const page = doc.getPage(i);
  const { width: pw, height: ph } = page.getSize();
  
  const contentRef = page.node.get(PDFName.of('Contents'));
  if (!contentRef) {
    pagesToRemove.push(i);
    console.log(`  Page ${i + 1}: empty (no content stream)`);
    continue;
  }
  
  if (pw < 50 || ph < 50) {
    pagesToRemove.push(i);
    console.log(`  Page ${i + 1}: empty (too small ${pw}x${ph})`);
  }
}

if (pagesToRemove.length > 0) {
  console.log(`Removing ${pagesToRemove.length} empty pages...`);
  for (let i = pagesToRemove.length - 1; i >= 0; i--) {
    doc.removePage(pagesToRemove[i]);
  }
} else {
  console.log('  No empty pages found');
}

// 4. Save
console.log('\nSaving modified PDF...');
const modifiedBytes = await doc.save();
writeFileSync(OUTPUT, modifiedBytes);

const finalCount = doc.getPageCount();
const sizeMB = (modifiedBytes.byteLength / 1024 / 1024).toFixed(1);
console.log(`\nDone! ${finalCount} pages, ${sizeMB}MB saved to ${OUTPUT}`);
