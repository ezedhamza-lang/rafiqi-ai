const puppeteer = require('puppeteer');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = 'D:\\mon projet\\rafiqi-كامل-محدث-02-09-2026\\rafiqi';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Go to login page
  await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  // Fill login form
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.type('input[type="email"]', 'student@test.tn', { delay: 50 });
  await page.type('input[type="password"]', 'qarn-zeft-7alib-2026!', { delay: 50 });

  // Submit the form
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 5000));
  
  // Wait until we're past login
  await page.waitForFunction(
    () => !window.location.href.includes('/login'),
    { timeout: 15000 }
  ).catch(() => console.log('Still on login page after submit'));
  
  console.log('After login URL:', page.url());

  // Screenshot 1: Homepage full page - desktop 1280px - footer
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'v5-footer-fixed.png'),
    fullPage: true,
  });
  console.log('Screenshot 1 saved: v5-footer-fixed.png');

  // Screenshot 2: Student dashboard - desktop 1280px - header owl
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE_URL + '/student/dashboard', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'v5-header-owl.png'),
    fullPage: true,
  });
  console.log('Screenshot 2 saved: v5-header-owl.png');

  // Screenshot 3: Student dashboard - mobile 390px
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(BASE_URL + '/student/dashboard', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'v5-mobile-header-footer.png'),
    fullPage: true,
  });
  console.log('Screenshot 3 saved: v5-mobile-header-footer.png');

  await browser.close();
  console.log('\nAll screenshots saved to:', OUTPUT_DIR);
})();
