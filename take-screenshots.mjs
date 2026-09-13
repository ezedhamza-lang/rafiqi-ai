import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'rafiqi');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:5173';

// ── Step 1: get JWT token from API ──
const loginRes = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'student@test.tn', password: 'qarn-zeft-7alib-2026!' }),
});
if (!loginRes.ok) throw new Error('Login failed: ' + loginRes.status + ' ' + await loginRes.text());
const loginData = await loginRes.json();
const token = loginData.token;
const user = loginData.user;
console.log('Got token, user:', user?.name || user?.email);

// ── Step 2: launch browser ──
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'],
});

const quiet = (ms = 1500) => new Promise((r) => setTimeout(r, ms));

async function authenticatedPage(viewport = { width: 1280, height: 900 }) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  // Inject token into localStorage before page loads
  await page.evaluateOnNewDocument((tok, usr) => {
    localStorage.setItem('school_token', tok);
    localStorage.setItem('school_refresh_token', tok);
    localStorage.setItem('school_user', JSON.stringify(usr));
  }, token, user);
  return page;
}

async function shot(page, name, fullPage = true) {
  await quiet(1800);
  const filePath = path.join(OUT, name + '.png');
  await page.screenshot({ path: filePath, fullPage });
  console.log('✓ ' + name);
  return filePath;
}

const files = [];

try {
  // ════════════════════════════════════════════════
  // 1. Student Dashboard - desktop 1280px - full page
  // ════════════════════════════════════════════════
  const p1 = await authenticatedPage({ width: 1280, height: 900 });
  await p1.goto(BASE + '/student-space', { waitUntil: 'networkidle0' });
  await quiet(3500);
  files.push(await shot(p1, '01-student-dashboard-desktop-1280px', true));

  // ════════════════════════════════════════════════
  // 2. Student Dashboard - scroll down (services, games etc.)
  // ════════════════════════════════════════════════
  await p1.evaluate(() => window.scrollTo(0, 1200));
  await quiet(1500);
  files.push(await shot(p1, '02-student-dashboard-scrolled-services-games', false));

  // ════════════════════════════════════════════════
  // 3. Student Dashboard - mobile 390px
  // ════════════════════════════════════════════════
  const p3 = await authenticatedPage({ width: 390, height: 844 });
  await p3.goto(BASE + '/student-space', { waitUntil: 'networkidle0' });
  await quiet(3500);
  files.push(await shot(p3, '03-student-dashboard-mobile-390px', true));
  await p3.close();

  // ════════════════════════════════════════════════
  // 4. Student Courses / Books page - full page
  // ════════════════════════════════════════════════
  const p4 = await authenticatedPage({ width: 1280, height: 900 });
  await p4.goto(BASE + '/student-space/books', { waitUntil: 'networkidle0' });
  await quiet(3500);
  files.push(await shot(p4, '04-student-courses-books-page', true));

  // ════════════════════════════════════════════════
  // 5. Student Lessons page (click first course)
  // ════════════════════════════════════════════════
  // Try clicking interactive lessons button
  const lessonOpened = await p4.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const lessonBtn = btns.find(b => /\d+/.test(b.textContent || '') && !/تصفح/.test(b.textContent || ''));
    if (lessonBtn) { lessonBtn.click(); return true; }
    // Try subject tabs
    const tabBtns = Array.from(document.querySelectorAll('.subject-tab'));
    if (tabBtns.length > 0) { tabBtns[0].click(); return 'tab'; }
    return false;
  });
  await quiet(3000);
  if (lessonOpened === 'tab') {
    // After tab click, try opening lessons
    await p4.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const lessonBtn = btns.find(b => /\d+/.test(b.textContent || '') && !/تصفح/.test(b.textContent || ''));
      if (lessonBtn) lessonBtn.click();
    });
    await quiet(3000);
  }
  // Try to open first lesson
  await p4.evaluate(() => {
    const item = document.querySelector('.toc-item, .lesson-list button, .lesson-list .card');
    if (item && !document.querySelector('.lesson-page-num')) item.click();
  });
  await quiet(2000);
  files.push(await shot(p4, '05-student-lessons-page', true));
  await p4.close();

  // ════════════════════════════════════════════════
  // 6. Student Practice / Quizzes page - full page
  // ════════════════════════════════════════════════
  const p6 = await authenticatedPage({ width: 1280, height: 900 });
  await p6.goto(BASE + '/student-space/quizzes', { waitUntil: 'networkidle0' });
  await quiet(3500);
  files.push(await shot(p6, '06-student-practice-quizzes-page', true));
  await p6.close();

  // ════════════════════════════════════════════════
  // 7. Student Profile page - full page
  // ════════════════════════════════════════════════
  const p7 = await authenticatedPage({ width: 1280, height: 900 });
  await p7.goto(BASE + '/student-space', { waitUntil: 'networkidle0' });
  await quiet(3500);
  files.push(await shot(p7, '07-student-profile-page', true));

  // ════════════════════════════════════════════════
  // 8. Sidebar / Navigation elements - desktop
  // ════════════════════════════════════════════════
  await p7.goto(BASE + '/student-space', { waitUntil: 'networkidle0' });
  await quiet(2500);
  files.push(await shot(p7, '08-student-sidebar-navigation-desktop', true));
  await p7.close();

  // ════════════════════════════════════════════════
  // 9. Play Zone page - full page
  // ════════════════════════════════════════════════
  const p9 = await authenticatedPage({ width: 1280, height: 900 });
  await p9.goto(BASE + '/student-space/play', { waitUntil: 'networkidle0' });
  await quiet(3500);
  files.push(await shot(p9, '09-student-play-zone-page', true));
  await p9.close();

  // ════════════════════════════════════════════════
  // 10. Stories page - full page
  // ════════════════════════════════════════════════
  const p10 = await authenticatedPage({ width: 1280, height: 900 });
  await p10.goto(BASE + '/student-space/stories', { waitUntil: 'networkidle0' });
  await quiet(3500);
  files.push(await shot(p10, '10-student-stories-page', true));
  await p10.close();

  // ════════════════════════════════════════════════
  // 11. Twin / Dashboard main view - full page
  // ════════════════════════════════════════════════
  const p11 = await authenticatedPage({ width: 1280, height: 900 });
  await p11.goto(BASE + '/student-space/twin', { waitUntil: 'networkidle0' });
  await quiet(3500);
  files.push(await shot(p11, '11-student-twin-dashboard', true));
  await p11.close();

  // Close the first page too
  await p1.close();

  console.log('\n===== ALL SCREENSHOTS =====');
  files.forEach(f => console.log(f));
  console.log('\nTotal:', files.length, 'screenshots');

} catch (err) {
  console.error('ERROR:', err.message);
  console.error(err.stack);
} finally {
  await browser.close();
}
