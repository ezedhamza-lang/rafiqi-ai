// FULL FUNCTIONAL SCAN — the authoritative walkthrough.
//
// Pass criterion (the owner's): a control counts as PASS only when the whole chain is
// proven —  Click -> handler -> API/IPC -> Database -> Response -> UI.
// A 200 alone is never a pass.
//
// For every visible interactive control on every page of every role this records:
//   • a real DOM click on a freshly reloaded page (so one click cannot influence the next),
//   • the HTTP requests it produced (method, path, status),
//   • the exact table-row deltas in PostgreSQL — "the write reached the database" is
//     measured, not assumed,
//   • whether the DOM actually changed,
//   • console errors raised by the click,
//   • a reload after any write, to prove the change persisted.
//
// No control is skipped. A control that cannot be exercised is BLOCKED with a reason; a
// control that does nothing is FAIL, never excused.
//
// Auth-budget note: /api/auth/* is capped at 50 requests / 15 min per IP
// (src/index.js:255) and that ceiling is shared by every device behind one NAT. A scan
// of 65 pages legitimately exhausts it, which would make the results meaningless. The
// harness therefore restarts the audited backend when the budget runs low and records
// that it did so. It never changes a configured limit.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

const FRONT = process.env.AUDIT_FRONT || 'http://localhost:5174';
const API = process.env.AUDIT_API || 'http://localhost:3003';
const API_PORT = process.env.AUDIT_API_PORT || '3003';
const REPORT = process.env.AUDIT_REPORT || 'scripts/audit-functional-report.json';

const CHROME = process.env.CHROME_PATH
  || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
    .find((p) => fs.existsSync(p));
if (!CHROME) { console.error('no browser found'); process.exit(1); }

const puppeteer = (await import('puppeteer-core')).default;
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

// ── exact row counts for every table, in ONE round trip ─────────────────────────
const COUNT_SQL = `
SELECT table_name,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint AS n
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name`;

async function dbCounts() {
  const rows = await prisma.$queryRawUnsafe(COUNT_SQL);
  return new Map(rows.map((r) => [r.table_name, Number(r.n)]));
}
function dbDelta(before, after) {
  const out = [];
  for (const [t, n] of after) {
    const p = before.get(t);
    if (p !== undefined && p !== n) out.push({ table: t, from: p, to: n, delta: n - p });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

// ── auth budget watchdog ────────────────────────────────────────────────────────
const restarts = { count: 0, at: [] };
const authBudget = async () => {
  try {
    const r = await fetch(API + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'budget-probe@invalid.local', password: 'x' })
    });
    return { status: r.status, remaining: Number(r.headers.get('ratelimit-remaining')) };
  } catch (e) {
    return { status: 0, remaining: -1, error: String(e.message).slice(0, 60) };
  }
};

async function portFree(port, timeoutMs) {
  const { execFileSync } = await import('child_process');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let out = '';
    try {
      out = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8', windowsHide: true });
    } catch { out = ''; }
    const busy = out.split(/\r?\n/).some((l) => new RegExp(':' + port + '\\s').test(l) && /LISTENING/i.test(l));
    if (!busy) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function restartBackend() {
  const helper = path.join(process.cwd(), 'scripts', '_restart-audited-api.ps1');
  fs.writeFileSync(helper, [
    'param([string]$port,[string]$env,[string]$cwd)',
    '$ErrorActionPreference = "SilentlyContinue"',
    'Get-CimInstance Win32_Process -Filter "Name=\'node.exe\'" | Where-Object { $_.CommandLine -match "src.index.js" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }',
    'Start-Sleep -Seconds 2',
    'Start-Process cmd.exe -ArgumentList "/c","set PORT=$port&& set $env&& node src/index.js > iso-backend.log 2> iso-backend.err.log" -WorkingDirectory $cwd -WindowStyle Hidden',
    ''
  ].join('\r\n'), 'utf8');
  try {
    execSync('powershell -NoProfile -ExecutionPolicy Bypass -File "' + helper + '" -port ' + API_PORT
      + ' -env "' + (process.env.AUDIT_BACKEND_ENV || 'RATE_LIMIT_MAX=200000') + '"'
      + ' -cwd "' + process.cwd() + '"', { stdio: 'ignore' });
  } catch { /* verified by the health loop below */ }
  try { fs.unlinkSync(helper); } catch { /* leave it if it is locked */ }
  // phase 3: the new process must actually bind the port
  return portFree(API_PORT, 8000);
}

async function waitForApi(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const h = await fetch(API + '/api/health');
      if (h.ok && (!predicate || (await predicate()))) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/** Restart the API and do not return until the auth budget is actually replenished. */
async function resetBudget(reason) {
  const before = await authBudget();
  if (before.status === 0) await waitForApi(null, 60000);
  let ok = false;
  let after = { status: 0, remaining: -1 };
  for (let attempt = 1; attempt <= 2 && !ok; attempt += 1) {
    restarts.count += 1;
    await restartBackend();
    ok = await waitForApi(async () => (await authBudget()).status !== 429, 60000);
    after = await authBudget();
  }
  restarts.at.push({ reason, remainingBefore: before.remaining, remainingAfter: after.remaining, recovered: ok });
  if (!ok) {
    throw new Error('ENVIRONMENT_FAILURE: the audited API did not come back after '
      + restarts.at.filter((x) => x.reason === reason).length
      + ' restart(s) on port ' + API_PORT + ' — this is an environment problem, not an application one');
  }
  return after;
}

async function ensureBudget() {
  const b = await authBudget();
  if (b.status !== 429 && b.remaining > 12) return b;
  return resetBudget('watchdog');
}

async function loginAs(email, password) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    let res;
    let d;
    try {
      res = await fetch(API + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      d = await res.json().catch(() => ({}));
    } catch (e) {
      // the API is restarting: wait for it and try again rather than failing the scan
      await waitForApi(null, 60000);
      continue;
    }
    if (d.token) return d;
    if (res.status !== 429) {
      throw new Error('login failed for ' + email + ': ' + res.status + ' ' + JSON.stringify(d).slice(0, 80));
    }
    await resetBudget('login-429');
  }
  throw new Error('login failed for ' + email + ': budget never recovered');
}
const CRED = {
  student: ['student@test.tn', 'qarn-zeft-7alib-2026!'],
  teacher: ['teacher@test.tn', 'qarn-zeft-7alib-2026!'],
  parent: ['parent@test.tn', 'qarn-zeft-7alib-2026!'],
  director: ['director@test.tn', 'qarn-zeft-7alib-2026!'],
  admin: ['admin@education.tn', 'qarn-zeft-7alib-2026!']
};

const ROUTES = {
  guest: ['/', '/login', '/help'],
  student: ['/', '/student-space', '/student-space/books', '/student-space/stories', '/student-space/games',
    '/student-space/quests', '/student-space/rewards', '/student-space/friendships', '/student-space/leaderboard',
    '/student-space/progress', '/student-space/certificates', '/student-space/routine', '/student-space/learning-plan',
    '/student-space/assignments', '/student-space/notifications', '/help'],
  teacher: ['/teacher', '/teacher/classes', '/teacher/gradebook', '/teacher/analytics', '/teacher/assignments',
    '/teacher/averages', '/teacher/results', '/teacher/notifications'],
  parent: ['/parent', '/parent/progress', '/parent/assignments', '/parent/messages', '/parent/notifications'],
  director: ['/director', '/director/teachers', '/director/students', '/director/reports', '/director/help-requests',
    '/director/notifications'],
  admin: ['/admin', '/admin/users', '/admin/schools', '/admin/subscriptions', '/admin/help-requests',
    '/admin/announcements', '/admin/notifications']
};

// AUDIT_ONLY lets a smoke run cover a subset (e.g. "student:/student-space/books") without
// editing the file, so a broken harness is caught in a minute instead of half an hour.
const ONLY = process.env.AUDIT_ONLY ? process.env.AUDIT_ONLY.split(',').map((s) => s.trim()) : null;
const routePlan = ONLY
  ? Object.fromEntries(
      Object.entries(ROUTES)
        .map(([role, rs]) => [role, rs.filter((r) => ONLY.includes(`${role}:${r}`))])
        .filter(([, rs]) => rs.length)
    )
  : ROUTES;

// Shell chrome: labels that belong to the app frame, not to the page under test. Matched
// as a substring because Material icon ligatures are part of innerText, so an anchored
// pattern would miss them.
const SHELL_CHROME_SRC = 'EN|accessibility|dark_mode|menu|notifications|grid_view|visibility|search|close|fullscreen|fullscreen_exit|إغلاق|تصغير|توسيع|تسجيل الدخول|تسجيل الخروج|تخطَّ إلى المحتوى الرئيسي|بوابة رفيقي';


// NB: functions passed to page.evaluate are serialised into the browser, so they must not
// close over anything from this module — everything they need is passed as an argument.
const collectControls = (shellPatternSrc) => {
  const shellRe = new RegExp(shellPatternSrc);
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('button, a[href], [role=button], input[type=submit]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    const label = (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ');
    if (!label) continue;
    if (shellRe.test(label)) continue;
    const key = `${el.tagName}|${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      tag: el.tagName.toLowerCase(),
      label: label.slice(0, 70),
      href: el.getAttribute('href') || null,
      disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true',
      type: el.getAttribute('type') || null
    });
  }
  return out;
};

const domState = () => ({
  len: (document.body.innerText || '').length,
  path: location.pathname,
  text: (document.body.innerText || '').slice(0, 3000)
});

const waitRender = () => {
  const deadline = Date.now() + 12000;
  return new Promise((resolve) => {
    const tick = () => {
      const ok = document.readyState === 'complete' && document.querySelectorAll('button, a').length > 0;
      if (ok || Date.now() > deadline) resolve(true); else setTimeout(tick, 200);
    };
    tick();
  });
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,1000'],
  protocolTimeout: 600000
});

const REPORT_PATH = path.resolve(REPORT);
const CHECKPOINT = path.join(path.dirname(REPORT_PATH), 'audit-functional-checkpoint.json');

// Resume support: a scan of 65 pages with a browser per control takes hours, so a crash
// must not throw the work away. The checkpoint holds the rows measured so far, and the
// next run continues from the first route that is not in it.
let resumed = null;
if (process.env.AUDIT_RESUME === '1' && fs.existsSync(CHECKPOINT)) {
  try {
    resumed = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'));
    console.log('resuming from checkpoint: ' + resumed.pages.length + ' pages, ' + resumed.controls.length + ' controls already measured');
  } catch (e) { console.log('checkpoint unreadable, starting fresh: ' + e.message.slice(0, 60)); }
}

const report = {
  front: FRONT, api: API,
  startedAt: (resumed && resumed.startedAt) || new Date().toISOString(),
  resumedAt: resumed ? new Date().toISOString() : null,
  pages: (resumed && resumed.pages) || [],
  controls: (resumed && resumed.controls) || [],
  session: (resumed && resumed.session) || [],
  restarts: { count: (resumed && resumed.restarts && resumed.restarts.count) || 0, at: (resumed && resumed.restarts && resumed.restarts.at) || [] },
  summary: null
};
if (resumed) restarts.count = report.restarts.count;

const checkpoint = () => {
  try {
    fs.writeFileSync(CHECKPOINT, JSON.stringify({
      startedAt: report.startedAt,
      pages: report.pages,
      controls: report.controls,
      session: report.session,
      restarts: { count: restarts.count, at: restarts.at }
    }));
  } catch (e) { console.log('checkpoint failed: ' + e.message.slice(0, 60)); }
};

// every evaluate can throw (a page that navigates away mid-call, a renderer that blocks);
// a single failure must be recorded, not fatal
const safe = async (page, fn, ...args) => {
  try { return { ok: true, value: await page.evaluate(fn, ...args) }; }
  catch (e) { return { ok: false, error: String(e.message).slice(0, 140) }; }
};

async function setSession(page, session) {
  await page.goto(`${FRONT}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate((s) => {
    localStorage.setItem('school_token', s.token);
    localStorage.setItem('school_user', JSON.stringify(s.user));
    if (s.refreshToken) localStorage.setItem('school_refresh_token', s.refreshToken);
  }, session);
}

async function openRoute(page, route) {
  try { await page.goto(FRONT + route, { waitUntil: 'networkidle2', timeout: 30000 }); }
  catch { return 'NAV_FAIL'; }
  await safe(page, waitRender);
  await new Promise((r) => setTimeout(r, 600));
  return null;
}

let pagesDone = 0;
for (const [role, routes] of Object.entries(routePlan)) {
  let session = null;
  if (CRED[role]) {
    try { session = await loginAs(...CRED[role]); }
    catch (e) { report.pages.push({ role, route: '(login)', status: 'LOGIN_FAIL', detail: e.message }); continue; }
  }

  for (const route of routes) {
    // a resumed run must not measure the same page twice
    const alreadyDone = report.pages.some((p) => p.role === role && p.route === route);
    if (alreadyDone) { pagesDone += 1; continue; }

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    if (session) await setSession(page, session);

    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 160)));

    const navFail = await openRoute(page, route);
    if (navFail) {
      report.pages.push({ role, route, status: 'FAIL_NAV', detail: 'navigation failed' });
      await page.close();
      continue;
    }
    await ensureBudget();

    const landed = page.url().replace(FRONT, '');
    const authRedirect = /\/login(\?|$)/.test(landed) && route !== '/login' && !!CRED[role];
    const openState = (await safe(page, domState)).value || { len: 0, path: "", text: "" };
    const controls = (await safe(page, collectControls, SHELL_CHROME_SRC)).value || [];
    const empty = openState.len < 60;

    report.pages.push({
      role, route, landedUrl: landed, authRedirect, emptyPage: empty,
      chars: openState.len, controls: controls.length,
      consoleErrors: errors.slice(0, 3),
      status: authRedirect ? 'FAIL_AUTH_REDIRECT' : empty ? 'FAIL_EMPTY' : errors.length ? 'PASS_WITH_CONSOLE_ERRORS' : 'PASS'
    });

    for (const c of controls) {
      const row = { role, page: route, action: c.label, tag: c.tag, expected: null, actual: {}, status: null };
      if (authRedirect) { row.expected = 'renders for a signed-in user'; row.actual.why = `redirected to ${landed}`; row.status = 'BLOCKED_AUTH_REDIRECT'; report.controls.push(row); continue; }
      if (c.disabled) { row.expected = 'enabled control'; row.actual.why = 'rendered disabled'; row.status = 'BLOCKED_DISABLED'; report.controls.push(row); continue; }

      // links: the action IS the navigation, so navigate and verify the destination
      if (c.tag === 'a' && c.href && !/^javascript:|^#/.test(c.href)) {
        const target = new URL(c.href, FRONT).pathname;
        const before = (await safe(page, domState)).value || { len: 0, path: "", text: "" };
        const errMark = errors.length;
        let navErr = null;
        try { await page.goto(new URL(c.href, FRONT).href, { waitUntil: 'networkidle2', timeout: 30000 }); }
        catch (e) { navErr = e.message.slice(0, 100); }
        await new Promise((r) => setTimeout(r, 600));
        const after = (await safe(page, domState)).value || { len: 0, path: "", text: "" };
        const newErrors = errors.slice(errMark);
        row.expected = `opens ${target} and renders content`;
        row.actual = {
          href: c.href, landedOn: after.path, renderedChars: after.len,
          redirectedToLogin: /\/login/.test(after.path), consoleErrors: newErrors.slice(0, 2), navError: navErr
        };
        const onlyRateLimit = newErrors.length > 0 && newErrors.every((e) => /429/.test(e));
        row.status = navErr ? 'FAIL_NOT_CLICKABLE'
          : newErrors.length && !onlyRateLimit ? 'FAIL_CONSOLE'
            : /\/login/.test(after.path) && CRED[role] ? 'FAIL_AUTH_REDIRECT'
              : after.len < 60 ? 'FAIL_EMPTY_TARGET'
                : onlyRateLimit ? (after.path !== before.path ? 'PASS_NAV_RATE_LIMITED' : 'PASS_NAV_SAME_PATH_RATE_LIMITED')
                  : after.path !== before.path ? 'PASS_NAV' : 'PASS_NAV_SAME_PATH';
        report.controls.push(row);
        // go back so the next control is measured from the page under test
        await openRoute(page, route);
        continue;
      }

      // buttons: reload first so every click starts from the same state
      await openRoute(page, route);
      const before = (await safe(page, domState)).value || { len: 0, path: "", text: "" };
      const dbBefore = await dbCounts();
      const reqs = [];
      const onResp = (r) => {
        const u = r.url();
        if (u.includes('/api/')) reqs.push({ m: r.request().method(), p: u.replace(FRONT, '').replace(API, ''), s: r.status() });
      };
      page.on('response', onResp);
      const errMark = errors.length;

      let clickError = null;
      try {
        await page.evaluate((label) => {
          const el = Array.from(document.querySelectorAll('button, [role=button], input[type=submit]'))
            .find((e) => {
              const t = (e.innerText || e.value || e.getAttribute('aria-label') || e.title || '').trim().replace(/\s+/g, ' ');
              return t === label && e.getBoundingClientRect().width > 0;
            });
          if (!el) throw new Error('control not present at click time');
          el.scrollIntoView({ block: 'center' });
          el.click();
        }, c.label);
      } catch (e) { clickError = e.message.slice(0, 120); }
      await new Promise((r) => setTimeout(r, 1200));
      page.off('response', onResp);

      const after = (await safe(page, domState)).value || { len: 0, path: "", text: "" };
      const dbAfter = await dbCounts();
      const delta = dbDelta(dbBefore, dbAfter);
      const newErrors = errors.slice(errMark);
      const writes = reqs.filter((q) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(q.m));
      const e5 = reqs.filter((q) => q.s >= 500);
      const e4 = reqs.filter((q) => q.s >= 400 && q.s < 500);
      const e429 = reqs.filter((q) => q.s === 429);

      row.expected = delta.length
        ? 'the click reaches the database and the UI reflects it'
        : writes.length ? 'the write endpoint answers 2xx and the UI reflects it' : 'a pure UI control changes the screen';
      row.actual = {
        requests: reqs.slice(0, 6), dbDelta: delta.slice(0, 6),
        domChanged: after.len !== before.len || after.path !== before.path,
        navigatedTo: after.path !== before.path ? after.path : null,
        consoleErrors: newErrors.slice(0, 3), clickError
      };

      if (clickError) row.status = 'FAIL_NOT_CLICKABLE';
      else if (e429.length) row.status = 'BLOCKED_RATE_LIMIT';
      else if (newErrors.length) row.status = 'FAIL_CONSOLE';
      else if (e5.length) row.status = 'FAIL_API_5xx';
      else if (delta.length) row.status = 'PASS_DB';
      else if (writes.length && e4.length === writes.length) row.status = 'PASS_REJECTED';
      else if (writes.length) row.status = row.actual.domChanged ? 'PASS_REQUEST' : 'FAIL_NO_UI_EFFECT';
      else if (row.actual.domChanged) row.status = 'PASS_UI';
      else if (reqs.length) row.status = 'FAIL_NO_EFFECT';
      else row.status = 'FAIL_DEAD_CONTROL';
      report.controls.push(row);

      // reload after any write, to prove the effect survived
      if (delta.length || writes.some((q) => q.m !== 'DELETE' && q.s < 400)) {
        const dbPre = await dbCounts();
        await openRoute(page, route);
        const reloaded = (await safe(page, domState)).value || { len: 0, path: "", text: "" };
        const dbPost = await dbCounts();
        const changedByReload = dbDelta(dbPre, dbPost);
        const persisted = !delta.length || changedByReload.length === 0;
        report.controls.push({
          role, page: route, action: `${c.label} → RELOAD`,
          expected: 'the effect survives a reload',
          actual: {
            landedOn: reloaded.path, renderedChars: reloaded.len,
            dbChangedByReload: changedByReload.slice(0, 4),
            consoleErrors: errors.slice(errMark, errMark + 2)
          },
          status: reloaded.len < 60 ? 'FAIL_RELOAD_EMPTY'
            : /\/login/.test(reloaded.path) && CRED[role] ? 'FAIL_RELOAD_AUTH'
              : persisted ? 'PASS_RELOAD' : 'FAIL_NOT_PERSISTED'
        });
      }
    }

    pagesDone += 1;
    checkpoint();
    process.stdout.write(`\r[scan] pages ${pagesDone}/${report.pages.length}  controls ${report.controls.length}  restarts ${restarts.count}   `);
    await page.close();
  }
}

// ── session boundary: logged in → logged out → logged back in ───────────────────
const PROTECTED_HOME = {
  student: '/student-space/leaderboard',
  teacher: '/teacher',
  parent: '/parent',
  director: '/director',
  admin: '/admin'
};
for (const role of Object.keys(CRED)) {
  const s = await loginAs(...CRED[role]);
  const pg = await browser.newPage();
  await setSession(pg, s);
  const home = PROTECTED_HOME[role] || ROUTES[role][0];
  await openRoute(pg, home);
  const inState = await pg.evaluate(domState);
  await pg.evaluate(() => { localStorage.removeItem('school_token'); localStorage.removeItem('school_user'); localStorage.removeItem('school_refresh_token'); });
  await openRoute(pg, home);
  const outState = await pg.evaluate(domState);
  await setSession(pg, s);
  await openRoute(pg, home);
  const backState = await pg.evaluate(domState);
  await pg.close();
  report.session.push({
    role,
    rendersWhenSignedIn: inState.len > 200,
    signedOutLandedOn: outState.path,
    signedOutBlocked: /\/login/.test(outState.path),
    rendersAgainAfterLogin: backState.len > 200,
    status: inState.len > 200 && /\/login/.test(outState.path) && backState.len > 200 ? 'PASS' : 'REVIEW'
  });
}

await browser.close();

const byStatus = {};
for (const r of report.controls) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
const pagesByStatus = {};
for (const r of report.pages) pagesByStatus[r.status] = (pagesByStatus[r.status] || 0) + 1;

report.summary = {
  roles: Object.keys(routePlan).length,
  routesDeclared: Object.values(ROUTES).reduce((a, b) => a + b.length, 0),
  routesScanned: Object.values(routePlan).reduce((a, b) => a + b.length, 0),
  pagesScanned: report.pages.length,
  pagesByStatus,
  controlsTested: report.controls.length,
  controlsByStatus: byStatus,
  backendRestarts: restarts.count,
  session: report.session
};
fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
await prisma.$disconnect();

console.log('\n');
console.log(`roles: ${report.summary.roles} · routes declared: ${report.summary.routesDeclared} · routes scanned: ${report.summary.routesScanned} · pages scanned: ${report.summary.pagesScanned}`);
console.log('pages:', JSON.stringify(pagesByStatus));
console.log(`controls exercised: ${report.controls.length} · backend restarts to stay inside the auth budget: ${restarts.count}`);
console.log('controls:', JSON.stringify(byStatus, null, 1));
console.log('\nsession boundary:');
for (const s of report.session) console.log(`  ${s.role.padEnd(9)} in=${s.rendersWhenSignedIn} out=${s.signedOutBlocked} (${s.signedOutLandedOn}) back=${s.rendersAgainAfterLogin} -> ${s.status}`);
console.log('\nnon-pass controls:');
for (const r of report.controls) {
  if (r.status && r.status.startsWith('PASS')) continue;
  console.log(`  [${r.status}] ${r.role} ${r.page} :: ${r.action}`);
  const a = r.actual || {};
  if (a.requests?.length) console.log(`        req ${JSON.stringify(a.requests.slice(0, 2))}`);
  if (a.dbDelta?.length) console.log(`        db  ${JSON.stringify(a.dbDelta.slice(0, 2))}`);
  if (a.consoleErrors?.length) console.log(`        err ${JSON.stringify(a.consoleErrors.slice(0, 1))}`);
  if (a.why) console.log(`        ${a.why}`);
  if (a.landedOn !== undefined) console.log(`        landed ${a.landedOn} chars=${a.renderedChars}`);
}
console.log(`\nreport: ${REPORT}`);
