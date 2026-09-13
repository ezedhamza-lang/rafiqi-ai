import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'rafiqi');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:5173';

// Step 1: get JWT token
const loginRes = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'student@test.tn', password: 'qarn-zeft-7alib-2026!' }),
});
if (!loginRes.ok) throw new Error('Login failed: ' + loginRes.status + ' ' + await loginRes.text());
const { token, user } = await loginRes.json();
console.log('Token OK, user:', user?.name || user?.email);

// Step 2: launch browser
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});

const wait = (ms = 3000) => new Promise(r => setTimeout(r, ms));

async function authPage(viewport = { width: 1280, height: 900 }) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.evaluateOnNewDocument((tok, usr) => {
    localStorage.setItem('school_token', tok);
    localStorage.setItem('school_refresh_token', tok);
    localStorage.setItem('school_user', JSON.stringify(usr));
  }, token, user);
  return page;
}

const files = [];

try {
  // 1. Dashboard desktop 1280px full page
  const p1 = await authPage({ width: 1280, height: 900 });
  await p1.goto(BASE + '/student-space', { waitUntil: 'networkidle0' });
  await wait(3000);
  const f1 = path.join(OUT, 'v4-dashboard-bubbles.png');
  await p1.screenshot({ path: f1, fullPage: true });
  files.push(f1);
  console.log('1/4 v4-dashboard-bubbles.png');
  await p1.close();

  // 2. Dashboard mobile 390px
  const p2 = await authPage({ width: 390, height: 844 });
  await p2.goto(BASE + '/student-space', { waitUntil: 'networkidle0' });
  await wait(3000);
  const f2 = path.join(OUT, 'v4-dashboard-mobile.png');
  await p2.screenshot({ path: f2, fullPage: true });
  files.push(f2);
  console.log('2/4 v4-dashboard-mobile.png');
  await p2.close();

  // 3. Play Zone desktop 1280px
  const p3 = await authPage({ width: 1280, height: 900 });
  await p3.goto(BASE + '/student-space/play', { waitUntil: 'networkidle0' });
  await wait(3000);
  const f3 = path.join(OUT, 'v4-playzone-cards.png');
  await p3.screenshot({ path: f3, fullPage: true });
  files.push(f3);
  console.log('3/4 v4-playzone-cards.png');
  await p3.close();

  // 4. Books desktop 1280px
  const p4 = await authPage({ width: 1280, height: 900 });
  await p4.goto(BASE + '/student-space/books', { waitUntil: 'networkidle0' });
  await wait(3000);
  const f4 = path.join(OUT, 'v4-books-subjects.png');
  await p4.screenshot({ path: f4, fullPage: true });
  files.push(f4);
  console.log('4/4 v4-books-subjects.png');
  await p4.close();

  console.log('\nAll screenshots:');
  files.forEach(f => console.log(f));

} catch (err) {
  console.error('ERROR:', err.message);
  console.error(err.stack);
} finally {
  await browser.close();
}
