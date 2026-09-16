const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const outDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const BASE = 'https://rafiqi-platform.onrender.com';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const resp = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher@test.tn', password: 'qarn-zeft-7alib-2026!' })
  });
  const data = await resp.json();

  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));
  await page.evaluate((token, user) => {
    localStorage.setItem('school_token', token);
    localStorage.setItem('school_user', JSON.stringify(user));
  }, data.token, data.user);

  // 1) Default view
  await page.goto(BASE + '/teacher', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(outDir, 'sidebar-default.png') });
  console.log('1. Sidebar default');

  // 2) Scroll sidebar to bottom
  await page.evaluate(() => {
    const sidebar = document.querySelector('.student-sidebar');
    if (sidebar) sidebar.scrollTop = sidebar.scrollHeight;
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outDir, 'sidebar-bottom.png') });
  console.log('2. Sidebar bottom');

  await browser.close();
  console.log('Done!');
})();
