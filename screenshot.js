const puppeteer = require('puppeteer');
const path = require('path');

const SAVE_DIR = 'D:\\mon projet\\rafiqi-كامل-محدث-02-09-2026\\rafiqi';
const URL = 'http://localhost:5173/student-space';
const EMAIL = 'student@test.tn';
const PASSWORD = 'qarn-zeft-7alib-2026!';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // Login first
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    await page.type('input[type="email"], input[name="email"], #email', EMAIL, { delay: 30 });
    await page.type('input[type="password"], input[name="password"], #password', PASSWORD, { delay: 30 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    // Navigate to student dashboard
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 3000));

    // 1. Desktop 1280px - full page
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({
      path: path.join(SAVE_DIR, 'v6-bg-student-desktop.png'),
      fullPage: true,
    });
    console.log('Saved: v6-bg-student-desktop.png');

    // 2. Mobile 390px
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({
      path: path.join(SAVE_DIR, 'v6-bg-student-mobile.png'),
      fullPage: false,
    });
    console.log('Saved: v6-bg-student-mobile.png');

    // 3. Scrolled to bottom - desktop
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({
      path: path.join(SAVE_DIR, 'v6-bg-student-scrolled.png'),
      fullPage: false,
    });
    console.log('Saved: v6-bg-student-scrolled.png');

    console.log('\nAll screenshots saved successfully.');
  } finally {
    await browser.close();
  }
})();
