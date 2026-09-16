import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'screenshots');

import fs from 'fs';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

const pages = [
  { name: 'home', url: 'http://localhost:5173/', width: 1440, height: 900 },
  { name: 'login', url: 'http://localhost:5173/login', width: 1440, height: 900 },
  { name: 'student-space', url: 'http://localhost:5173/student-space', width: 1440, height: 900 },
  { name: 'teacher-space', url: 'http://localhost:5173/teacher', width: 1440, height: 900 },
  { name: 'student-books', url: 'http://localhost:5173/student-space/books', width: 1440, height: 900 },
  { name: 'student-quizzes', url: 'http://localhost:5173/student-space/quizzes', width: 1440, height: 900 },
  { name: 'student-play', url: 'http://localhost:5173/student-space/play', width: 1440, height: 900 },
  { name: 'teacher-memos', url: 'http://localhost:5173/teacher/memos', width: 1440, height: 900 },
  { name: 'teacher-quizzes', url: 'http://localhost:5173/teacher/quizzes', width: 1440, height: 900 },
];

for (const p of pages) {
  const page = await browser.newPage();
  await page.setViewport({ width: p.width, height: p.height });
  try {
    await page.goto(p.url, { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
  } catch (e) {
    console.log(`Warning: ${p.name} - ${e.message}`);
  }
  const file = path.join(outDir, `${p.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✅ ${p.name} → ${file}`);
  await page.close();
}

await browser.close();
console.log('Done!');
