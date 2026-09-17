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

  // Force hard reload
  await page.goto(BASE + '/teacher', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));
  
  await page.screenshot({ path: path.join(outDir, 'live-check.png') });
  console.log('Screenshot taken');

  await browser.close();
})();
