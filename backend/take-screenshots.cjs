const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, 'screenshots', 'all');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const BASE = 'https://rafiqi-platform.onrender.com';

async function shot(page, name, url, scrollY) {
  try {
    await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    if (scrollY) {
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      await new Promise(r => setTimeout(r, 1000));
    }
    await page.screenshot({ path: path.join(outDir, name + '.png') });
    console.log('  ' + name);
  } catch (e) {
    console.log('  FAIL: ' + name);
  }
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // ===== PUBLIC =====
  console.log('=== PUBLIC ===');
  await shot(page, '01-home', '/');
  await shot(page, '02-home-scroll1', '/', 900);
  await shot(page, '03-home-scroll2', '/', 1800);
  await shot(page, '04-home-scroll3', '/', 2700);
  await shot(page, '05-home-scroll4', '/', 3600);
  await shot(page, '06-login', '/login');
  await shot(page, '07-register', '/register');

  // ===== TEACHER LOGIN =====
  console.log('Logging in as teacher...');
  await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
  const emailInput = await page.$('input[type="email"]');
  const passInput = await page.$('input[type="password"]');
  if (emailInput && passInput) {
    await emailInput.click({ clickCount: 3 });
    await emailInput.type('teacher@test.tn', { delay: 10 });
    await passInput.click({ clickCount: 3 });
    await passInput.type('qarn-zeft-7alib-2026!', { delay: 10 });
    const btn = await page.$('button[type="submit"]');
    if (btn) await btn.click();
    await new Promise(r => setTimeout(r, 5000));
  }

  // ===== TEACHER ALL PAGES =====
  console.log('=== TEACHER ALL ===');
  const teacherPages = [
    ['10-dash', '/teacher'],
    ['11-memos', '/teacher/memos'],
    ['12-quizzes', '/teacher/quizzes'],
    ['13-exams', '/teacher/exams'],
    ['14-assignments', '/teacher/assignments'],
    ['15-results', '/teacher/results'],
    ['16-averages', '/teacher/averages'],
    ['17-gradebook', '/teacher/gradebook'],
    ['18-class-grades', '/teacher/grades'],
    ['19-lesson-progress', '/teacher/lesson-progress'],
    ['20-notes', '/teacher/notes'],
    ['21-attendance', '/teacher/attendance'],
    ['22-health', '/teacher/health'],
    ['23-lesson-plan', '/teacher/lesson-plan'],
    ['24-plans', '/teacher/plans'],
    ['25-schedules', '/teacher/schedules'],
    ['26-resources', '/teacher/resources'],
    ['27-library', '/teacher/library'],
    ['28-ai', '/teacher/ai'],
    ['29-live', '/teacher/live'],
    ['30-suggestions', '/teacher/suggestions'],
    ['31-analytics', '/teacher/analytics'],
    ['32-worksheets', '/teacher/worksheets'],
    ['33-correction', '/teacher/correction'],
    ['34-class-subjects', '/teacher/class-subjects'],
  ];
  for (const [name, url] of teacherPages) {
    await shot(page, name, url);
  }

  // ===== STUDENT PAGES =====
  console.log('=== STUDENT ALL ===');
  const studentPages = [
    ['40-student-twin', '/student-space/twin'],
    ['41-student-books', '/student-space/books'],
    ['42-student-stories', '/student-space/stories'],
    ['43-student-subjects', '/student-space/subjects'],
    ['44-student-quizzes', '/student-space/quizzes'],
    ['45-student-assignments', '/student-space/assignments'],
    ['46-student-play', '/student-space/play'],
    ['47-student-flashcards', '/student-space/flashcards'],
    ['48-student-refeeqi', '/student-space/refeeqi'],
    ['49-student-routine', '/student-space/routine'],
    ['50-student-live', '/student-space/live'],
    ['51-student-schedule', '/student-space/schedule'],
    ['52-student-calendar', '/student-space/calendar'],
    ['53-student-official-exams', '/student-space/official-exams'],
    ['54-student-paper-exam', '/student-space/paper-exam'],
    ['55-student-plan', '/student-space/plan'],
    ['56-student-adaptive', '/student-space/adaptive'],
    ['57-student-videos', '/student-space/videos'],
  ];
  for (const [name, url] of studentPages) {
    await shot(page, name, url);
  }

  // ===== OTHER PAGES =====
  console.log('=== OTHER ===');
  await shot(page, '60-account', '/account');
  await shot(page, '61-messages', '/messages');
  await shot(page, '62-help', '/help');

  await browser.close();
  console.log('\nAll done!');
})();
