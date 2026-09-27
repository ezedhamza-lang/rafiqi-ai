// READ-ONLY responsive + RTL audit: every route × 3 viewports, measured in a real
// browser. Writes a JSON report; changes nothing.
import fs from 'fs';
import puppeteer from 'puppeteer-core';

// Targets are overridable: point the audit at an isolated backend (AUDIT_API /
// AUDIT_FRONT) to measure cleanly. The platform limiter (500 req / 15 min per IP)
// is otherwise exhausted by the audit itself — which is itself the finding ISS-020.
const FRONT = process.env.AUDIT_FRONT || 'http://localhost:5173';
const API = process.env.AUDIT_API || 'http://localhost:3001';
const EXEC = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
].find((p) => fs.existsSync(p));
if (!EXEC) { console.error('no browser found'); process.exit(1); }

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 }
];

const ROUTES = {
  student: [
    '/student-space', '/student-space/dashboard', '/student-space/books', '/student-space/subjects',
    '/student-space/stories', '/student-space/progress', '/student-space/leaderboard',
    '/student-space/friendships', '/student-space/routine', '/student-space/plan',
    '/student-space/quizzes', '/student-space/assignments', '/student-space/official-exams',
    '/student-space/certificates', '/student-space/daily-challenge', '/student-space/weekly-challenge',
    '/student-space/play', '/student-space/twin', '/student-space/live', '/student-space/calendar',
    '/student-space/messages', '/student-space/portfolio', '/student-space/adaptive',
    '/student-space/flashcards', '/student-space/paper-exam', '/student-space/virtual-friend'
  ],
  teacher: [
    '/teacher', '/teacher/assignments', '/teacher/quizzes', '/teacher/gradebook', '/teacher/results',
    '/teacher/averages', '/teacher/correction', '/teacher/lesson-plan', '/teacher/memos',
    '/teacher/class-subjects', '/teacher/schedules', '/teacher/library', '/teacher/resources',
    '/teacher/attendance', '/teacher/lesson-progress', '/teacher/exams', '/teacher/worksheets'
  ],
  parent: ['/parent', '/parent/children', '/parent/progress', '/parent/attendance', '/parent/messages', '/parent/documents', '/parent/payments'],
  director: ['/director', '/director/classes', '/director/registrations', '/director/documents', '/director/attendance'],
  admin: ['/admin', '/admin/users', '/admin/subscriptions', '/admin/help-requests', '/admin/finance'],
  public: ['/', '/login', '/register', '/help', '/privacy']
};

const CRED = {
  student: ['student@test.tn', 'qarn-zeft-7alib-2026!'],
  teacher: ['teacher@test.tn', 'qarn-zeft-7alib-2026!'],
  parent: ['parent@test.tn', 'qarn-zeft-7alib-2026!'],
  director: ['director@test.tn', 'qarn-zeft-7alib-2026!'],
  admin: ['admin@education.tn', 'qarn-zeft-7alib-2026!']
};

const browser = await puppeteer.launch({
  executablePath: EXEC,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--font-render-hinting=none']
});

const report = { generatedAt: new Date().toISOString(), viewports: VIEWPORTS, results: [] };
const consoleErrors = [];

async function loginAs(email, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const d = await res.json();
  if (!d.token) throw new Error(`login failed for ${email}: ${res.status}`);
  return { token: d.token, user: d.user };
}

// measure inside the page
const MEASURE = (expectedRole) => {
  const de = document.documentElement;
  const vw = window.innerWidth;
  const offenders = [];
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 2 || r.left < -2) {
      const style = getComputedStyle(el);
      // an element that scrolls its own content is not a page-level overflow
      const scrolls = style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
      let parentScrolls = false;
      let p = el.parentElement;
      for (let i = 0; i < 4 && p; i += 1) {
        const ps = getComputedStyle(p);
        if (ps.overflowX === 'auto' || ps.overflowX === 'scroll' || ps.overflow === 'hidden') { parentScrolls = true; break; }
        p = p.parentElement;
      }
      if (scrolls || parentScrolls) continue;
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && String(el.className).slice(0, 60)) || '',
        w: Math.round(r.width),
        left: Math.round(r.left),
        right: Math.round(r.right),
        text: (el.textContent || '').trim().slice(0, 40)
      });
    }
  }
  // clipped text: element whose text is wider than its box and is not scrollable
  const clipped = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (!t) continue;
    const style = getComputedStyle(el);
    if (style.overflow === 'visible' && style.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0) {
      clipped.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 50), text: t.slice(0, 40) });
    }
  }
  return {
    dir: de.getAttribute('dir'),
    lang: de.getAttribute('lang'),
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    hOverflow: de.scrollWidth > de.clientWidth + 1,
    bodyScrollW: document.body.scrollWidth,
    vScroll: de.scrollHeight > de.clientHeight,
    text: (document.body.innerText || '').slice(0, 60).replace(/\n/g, ' '),
    hasContent: (document.body.innerText || '').trim().length > 40,
    offenders: offenders.slice(0, 6),
    offenderCount: offenders.length,
    clipped: clipped.slice(0, 5),
    clippedCount: clipped.length
  };
};

for (const [role, routes] of Object.entries(ROUTES)) {
  let session = null;
  if (CRED[role]) session = await loginAs(...CRED[role]);

  for (const vp of VIEWPORTS) {
    for (const route of routes) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height });
      const errs = [];
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
      page.on('pageerror', (e) => errs.push('pageerror: ' + String(e.message).slice(0, 160)));
      // The session MUST exist before the first navigation: without it every protected
      // route redirects to /login, the client then spams POST /api/auth/refresh, the
      // auth limiter (50 / 15 min) trips and the whole run is measured against 429
      // pages instead of the real ones (this is what polluted the first runs).
      if (session) {
        await page.goto(`${FRONT}/login`, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.evaluate((s) => {
          localStorage.setItem('school_token', s.token);
          localStorage.setItem('school_user', JSON.stringify(s.user));
        }, session);
      }
      try {
        await page.goto(FRONT + route, { waitUntil: 'networkidle2', timeout: 25000 });
      } catch (e) {
        report.results.push({ role, route, vp: vp.name, error: 'nav: ' + e.message.slice(0, 120) });
        await page.close();
        continue;
      }
      await new Promise((r) => setTimeout(r, 400));
      const landedUrl = page.url();
      // A protected route that bounced to /login means the session never landed —
      // every number for that row would describe the login page, not the route.
      const authRedirect = /\/login(\?|$)/.test(landedUrl) && route !== '/login';
      const m = await page.evaluate(MEASURE, role);
      // RTL sanity: Arabic pages must be dir=rtl
      const isArabicPage = /[؀-ۿ]/.test(m.text);
      m.dirOk = isArabicPage ? m.dir === 'rtl' : true;
      report.results.push({ role, route, vp: vp.name, landedUrl, authRedirect, ...m, consoleErrors: errs.slice(0, 4) });
      if (errs.length) consoleErrors.push({ role, route, vp: vp.name, errs });
      await page.close();
    }
  }
}

await browser.close();
fs.writeFileSync(process.env.AUDIT_REPORT || 'scripts/audit-responsive-report.json', JSON.stringify(report, null, 1));

// ---- summary ----
const byVp = {};
for (const r of report.results) {
  byVp[r.vp] ||= { total: 0, overflow: [], noContent: [], consoleErr: [], navErr: [], dirBad: [], authBounce: [], clipped: [] };
  const s = byVp[r.vp];
  if (r.error) { s.navErr.push(r); continue; }
  s.total += 1;
  if (r.hOverflow) s.overflow.push(r);
  if (!r.hasContent) s.noContent.push(r);
  if (!r.dirOk) s.dirBad.push(r);
  if (r.authRedirect) s.authBounce.push(r);
  if (r.clippedCount) s.clipped.push(r);
  if ((r.consoleErrors || []).length) s.consoleErr.push(r);
}
for (const [vp, s] of Object.entries(byVp)) {
  console.log(`\n### ${vp}: checked ${s.total}`);
  console.log(`  horizontal overflow : ${s.overflow.length}`);
  s.overflow.slice(0, 12).forEach((r) => console.log(`     ${r.role} ${r.route}  scrollW=${r.scrollWidth} clientW=${r.clientWidth} offenders=${r.offenderCount} :: ${JSON.stringify(r.offenders.slice(0, 2))}`));
  console.log(`  empty page          : ${s.noContent.length}`);
  s.noContent.slice(0, 6).forEach((r) => console.log(`     ${r.role} ${r.route}`));
  console.log(`  nav errors          : ${s.navErr.length}`);
  s.navErr.slice(0, 6).forEach((r) => console.log(`     ${r.role} ${r.route} :: ${r.error}`));
  console.log(`  bounced to /login   : ${s.authBounce.length}`);
  s.authBounce.slice(0, 6).forEach((r) => console.log(`     ${r.role} ${r.route} -> ${r.landedUrl}`));
  console.log(`  dir != rtl (arabic) : ${s.dirBad.length}`);
  s.dirBad.slice(0, 6).forEach((r) => console.log(`     ${r.role} ${r.route} dir=${r.dir}`));
  console.log(`  clipped text nodes  : ${s.clipped.length}`);
  s.clipped.slice(0, 6).forEach((r) => console.log(`     ${r.role} ${r.route} (${r.clippedCount}) :: ${JSON.stringify(r.clipped.slice(0, 2))}`));
  console.log(`  console errors      : ${s.consoleErr.length}`);
  s.consoleErr.slice(0, 6).forEach((r) => console.log(`     ${r.role} ${r.route} :: ${(r.consoleErrors || [])[0]}`));
}
const limiter = report.results.filter((r) => (r.consoleErrors || []).some((e) => /429/.test(e)));
const bounced = report.results.filter((r) => r.authRedirect);
console.log(`\n${limiter.length ? `✗ ${limiter.length} measurement(s) hit HTTP 429 — the run is NOT clean` : '✓ no 429 in this run'}`);
console.log(`${bounced.length ? `✗ ${bounced.length} measurement(s) were measured on the login page` : '✓ no route bounced to /login'}`);
console.log(`\nreport: scripts/audit-responsive-report.json (${report.results.length} measurements)`);
process.exit(limiter.length || bounced.length ? 1 : 0);
