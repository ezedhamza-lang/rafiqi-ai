import mammoth from 'mammoth';
import { writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';

const DOCX_PATH = 'D:\\livres eleves\\French_Book_Grade2_Tunisia.docx';
const OUTPUT_DIR = resolve('frontend/public/assets/books/y2french');
const TEMP_HTML = resolve('backend/scripts/y2french-full.html');

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

console.log('Step 1: Convert DOCX to HTML...');
const result = await mammoth.convertToHtml({ path: DOCX_PATH });
const html = result.value;
writeFileSync(TEMP_HTML, html, 'utf-8');
console.log('HTML saved:', html.length, 'chars');

console.log('\nStep 2: Launch Puppeteer and render pages...');
const puppeteer = await import('puppeteer');
const browser = await puppeteer.default.launch({ 
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
});

const page = await browser.newPage();
await page.setViewport({ width: 800, height: 1100, deviceScaleFactor: 2 });

await page.goto('file:///' + TEMP_HTML.replace(/\\/g, '/'), { 
  waitUntil: 'domcontentloaded', 
  timeout: 60000 
});

await new Promise(r => setTimeout(r, 3000));

// Add styling
await page.evaluate(() => {
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap');
    * { box-sizing: border-box; }
    body {
      font-family: 'Noto Sans Arabic', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.7;
      direction: ltr;
      background: white;
      color: #333;
      padding: 30px;
      max-width: 750px;
      margin: 0 auto;
    }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    td, th { border: 1px solid #ccc; padding: 6px; text-align: center; }
  `;
  document.head.appendChild(style);
});

await new Promise(r => setTimeout(r, 2000));

const totalHeight = await page.evaluate(() => document.body.scrollHeight);
console.log('Total page height:', totalHeight, 'px');

const PAGE_HEIGHT = 1100;
const totalPages = Math.ceil(totalHeight / PAGE_HEIGHT);
console.log('Total pages to render:', totalPages);

for (let i = 0; i < totalPages; i++) {
  const filename = `page-${String(i + 1).padStart(3, '0')}.webp`;
  const filepath = resolve(OUTPUT_DIR, filename);
  
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), i * PAGE_HEIGHT);
  await new Promise(r => setTimeout(r, 300));
  
  await page.screenshot({
    path: filepath,
    type: 'webp',
    quality: 85,
    clip: {
      x: 0,
      y: i * PAGE_HEIGHT,
      width: 800,
      height: Math.min(PAGE_HEIGHT, totalHeight - i * PAGE_HEIGHT)
    }
  });
  
  const sz = statSync(filepath).size;
  console.log(`Saved ${filename} (${Math.round(sz/1024)}KB)`);
}

await browser.close();
console.log(`\nDone! ${totalPages} pages saved to ${OUTPUT_DIR}`);
