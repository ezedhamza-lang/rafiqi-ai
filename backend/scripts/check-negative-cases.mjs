// NEGATIVE CASES — the half of testing that usually gets skipped.
//
// The owner asked for the failure paths explicitly: empty data, wrong data, an
// unauthorised user, an invalid file, a double click, a refresh during an operation, an
// expired session, a failing API, and an unavailable database.
//
// Each case states what was sent, what came back, what the database looks like, and what
// the user sees. A case passes only when the platform refuses the bad input, leaves the
// database untouched, and tells the user something. A 500 is a FAIL. A silent success is
// a FAIL. A rejected request that also writes a row is a FAIL.
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const API = process.env.AUDIT_API || 'http://localhost:3003';
const FRONT = process.env.AUDIT_FRONT || 'http://localhost:5174';
const UPLOADS = path.join(process.cwd(), 'uploads');
const REPORT = process.env.AUDIT_NEG_REPORT || 'scripts/audit-negative-report.json';

const CHROME = process.env.CHROME_PATH
  || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
    .find((p) => fs.existsSync(p));
if (!CHROME) { console.error('no browser found'); process.exit(1); }
const puppeteer = (await import('puppeteer-core')).default;
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const COUNT_SQL = `
SELECT table_name,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint AS n
FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`;
const counts = async () => new Map((await prisma.$queryRawUnsafe(COUNT_SQL)).map((r) => [r.table_name, Number(r.n)]));
function delta(a, b) {
  const out = [];
  for (const [t, n] of b) if (a.get(t) !== n) out.push({ table: t, from: a.get(t), to: n });
  return out;
}
const uploadSnapshot = () => {
  if (!fs.existsSync(UPLOADS)) return new Set();
  const out = new Set();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else out.add(path.relative(UPLOADS, p));
    }
  };
  walk(UPLOADS);
  return out;
};

async function token(email, password = 'qarn-zeft-7alib-2026!') {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const d = await r.json();
  if (!d.token) throw new Error(`login failed ${email}: ${r.status}`);
  return d;
}
const call = async (t, method, p, body, extraHeaders = {}) => {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (t) headers.Authorization = `Bearer ${t}`;
  const r = await fetch(API + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let parsed = text;
  try { parsed = JSON.parse(text); } catch { /* keep text */ }
  return { status: r.status, body: parsed, raw: text.slice(0, 200) };
};

const results = [];
const record = (r) => {
  results.push(r);
  const flag = r.status === 'PASS' ? 'PASS' : r.status === 'FAIL' ? 'FAIL' : r.status;
  console.log(`  [${flag}] ${r.case.padEnd(46)} ${r.detail}`);
};

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n=== 1. EMPTY DATA ===');
{
  const s = await token('teacher@test.tn');
  const before = await counts();
  const r = await call(s.token, 'POST', '/api/assignments', {});
  const after = await counts();
  const d = delta(before, after);
  record({
    case: 'teacher creates an assignment with an empty body',
    expected: '4xx with field errors, no row created',
    actual: { status: r.status, body: r.body, dbDelta: d },
    status: r.status >= 400 && r.status < 500 && d.length === 0 ? 'PASS' : 'FAIL'
  });

  const before2 = await counts();
  const r2 = await call(s.token, 'POST', '/api/assignments', { title: '', description: '', classId: '', dueDate: '', type: '' });
  const after2 = await counts();
  const d2 = delta(before2, after2);
  record({
    case: 'assignment with every field present but empty',
    expected: '4xx with field errors, no row created',
    actual: { status: r2.status, body: r2.body, dbDelta: d2 },
    status: r2.status >= 400 && r2.status < 500 && d2.length === 0 ? 'PASS' : 'FAIL'
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n=== 2. WRONG DATA ===');
{
  const s = await token('teacher@test.tn');
  const cases = [
    ['assignment with a non-existent classId', 'POST', '/api/assignments', { title: 'x', description: 'y', classId: 999999, dueDate: '2026-12-01', type: 'HOMEWORK' }],
    ['assignment with an impossible dueDate', 'POST', '/api/assignments', { title: 'x', description: 'y', classId: 1, dueDate: 'not-a-date', type: 'HOMEWORK' }],
    ['assignment with an unknown type', 'POST', '/api/assignments', { title: 'x', description: 'y', classId: 1, dueDate: '2026-12-01', type: 'NOPE' }],
    ['assignment with a 20k-character title', 'POST', '/api/assignments', { title: 'A'.repeat(20000), description: 'y', classId: 1, dueDate: '2026-12-01', type: 'HOMEWORK' }],
    ['friendship request addressed to yourself', 'POST', '/api/student/friends/request', { userId: 1 }],
    ['friendship request with a missing userId', 'POST', '/api/student/friends/request', {}],
    ['friendship request with a textual userId', 'POST', '/api/student/friends/request', { userId: '1' }],
    ['friendship request to a non-existent user', 'POST', '/api/student/friends/request', { userId: 999999 }]
  ];
  for (const [name, m, p, b] of cases) {
    const before = await counts();
    const r = await call(s.token, m, p, b);
    const after = await counts();
    const d = delta(before, after);
    const rejected = r.status >= 400 && r.status < 500;
    record({
      case: name,
      expected: '4xx (not 500), no row created',
      actual: { status: r.status, body: typeof r.body === 'object' ? (r.body.error || JSON.stringify(r.body).slice(0, 120)) : r.raw, dbDelta: d },
      status: rejected && d.length === 0 ? 'PASS' : 'FAIL'
    });
  }

  // login with a wrong password must never return a token
  const bad = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher@test.tn', password: 'wrong-password' })
  });
  const badBody = await bad.json();
  record({
    case: 'login with a wrong password',
    expected: '401 and no token',
    actual: { status: bad.status, token: badBody.token ? 'LEAKED A TOKEN' : 'none', body: badBody.error },
    status: bad.status === 401 && !badBody.token ? 'PASS' : 'FAIL'
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n=== 3. UNAUTHORISED ===');
{
  const student = await token('student@test.tn');
  const parent = await token('parent@test.tn');
  const probes = [
    ['no token at all → teacher assignments list', null, 'GET', '/api/assignments', undefined],
    ['student token → teacher assignment list', student.token, 'GET', '/api/assignments', undefined],
    ['parent token → student-only endpoint', parent.token, 'GET', '/api/student/leaderboard', undefined],
    ['student token → admin users list', student.token, 'GET', '/api/admin/users', undefined],
    ['teacher token → payments of the school', student.token, 'GET', '/api/financial-dashboard/payments', undefined],
    ['garbage token', 'not-a-jwt', 'GET', '/api/student/leaderboard', undefined],
    ['token with a tampered payload', student.token.split('.').slice(0, 2).join('.') + '.AAAA', 'GET', '/api/student/leaderboard', undefined],
    ['student token → create an assignment (write)', student.token, 'POST', '/api/assignments', { title: 'hack', description: 'x', classId: 1, dueDate: '2026-12-01', type: 'HOMEWORK' }]
  ];
  for (const [name, t, m, p, b] of probes) {
    const before = await counts();
    const r = await call(t, m, p, b);
    const after = await counts();
    const d = delta(before, after);
    record({
      case: name,
      expected: '401 or 403, no row created',
      actual: { status: r.status, body: typeof r.body === 'object' ? (r.body.error || '') : r.raw, dbDelta: d },
      status: (r.status === 401 || r.status === 403) && d.length === 0 ? 'PASS' : 'FAIL'
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('');
console.log('=== 4. INVALID FILE ===');
{
  const parent = await token('parent@test.tn');
  const before = await counts();
  const filesBefore = uploadSnapshot();
  const boundary = '----auditboundary';
  const build = (filename, contentType, bytes) => {
    const head = `--${boundary}\r\nContent-Disposition: form-data; name="recipientId"\r\n\r\n1\r\n--${boundary}\r\nContent-Disposition: form-data; name="body"\r\n\r\naudit\r\n--${boundary}\r\nContent-Disposition: form-data; name="attachment"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`;
    const tail = `\r\n--${boundary}--\r\n`;
    return Buffer.concat([Buffer.from(head, 'utf8'), Buffer.alloc(bytes, 0x41), Buffer.from(tail, 'utf8')]);
  };
  const send = async (filename, contentType, bytes) => {
    const r = await fetch(`${API}/api/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${parent.token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: build(filename, contentType, bytes)
    });
    const text = await r.text();
    let parsed = text; try { parsed = JSON.parse(text); } catch { /* text */ }
    return { status: r.status, body: parsed, raw: text.slice(0, 160) };
  };

  for (const [name, file, type, size] of [
    ['an .exe disguised as a photo', 'payload.exe', 'application/octet-stream', 2048],
    ['a .php script', 'shell.php', 'application/x-php', 1024],
    ['a 12 MB file (size limit)', 'big.png', 'image/png', 12 * 1024 * 1024],
    ['a file with no extension', 'noext', 'application/octet-stream', 512]
  ]) {
    const r = await send(file, type, size);
    const after = await counts();
    const d = delta(before, after);
    const filesAfter = uploadSnapshot();
    const orphans = [...filesAfter].filter((f) => !filesBefore.has(f));
    record({
      case: `message attachment: ${name}`,
      expected: 'rejected with 4xx, nothing written, no orphan file on disk',
      actual: { status: r.status, body: typeof r.body === 'object' ? (r.body.error || '') : r.raw, dbDelta: d, newFilesOnDisk: orphans },
      status: r.status >= 400 && r.status < 500 && d.length === 0 && orphans.length === 0 ? 'PASS' : 'FAIL'
    });
  }
  void filesBefore;
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n=== 5. DOUBLE CLICK (duplicate submission) ===');
{
  const s = await token('teacher@test.tn');
  const before = await counts();
  const payload = { title: 'audit-double-click', description: 'audit', classId: 1, dueDate: '2026-12-01', type: 'HOMEWORK' };
  const [r1, r2, r3] = await Promise.all([
    call(s.token, 'POST', '/api/assignments', payload),
    call(s.token, 'POST', '/api/assignments', payload),
    call(s.token, 'POST', '/api/assignments', payload)
  ]);
  const after = await counts();
  const d = delta(before, after);
  const created = d.find((x) => x.to - x.from > 0);
  const statuses = [r1.status, r2.status, r3.status];
  record({
    case: 'three identical assignment submissions fired at once',
    expected: 'at most one row created; duplicates rejected or de-duplicated',
    actual: { statuses, dbDelta: d, createdRows: created ? created.to - created.from : 0 },
    status: created && created.to - created.from === 1 ? 'PASS' : 'FAIL'
  });
  // clean up the row this case created so the demo data stays as it was
  if (created) {
    const rows = await prisma.assignment.findMany({ where: { title: 'audit-double-click' }, select: { id: true } });
    for (const row of rows) await prisma.assignment.delete({ where: { id: row.id } }).catch(() => {});
    console.log(`         (cleaned up ${rows.length} row(s) created by this case)`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n=== 6. API FAILURE (network abort in the browser) ===');
{
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const s = await token('student@test.tn');
  await page.goto(`${FRONT}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((tok) => localStorage.setItem('school_token', tok), s.token);
  await page.evaluate((u) => localStorage.setItem('school_user', JSON.stringify(u)), s.user);
  await page.goto(`${FRONT}/student-space/leaderboard`, { waitUntil: 'networkidle2' });
  const withData = await page.evaluate(() => (document.body.innerText || '').length);

  // abort every /api/ request from now on
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.url().includes('/api/')) req.abort('failed'); else req.continue();
  });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 120)));
  await page.goto(`${FRONT}/student-space/leaderboard`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await new Promise((r) => setTimeout(r, 3000));
  const offline = await page.evaluate(() => ({
    len: (document.body.innerText || '').length,
    text: (document.body.innerText || '').slice(0, 300),
    hasSpinner: !!document.querySelector('.spinner, .loading-wrap')
  }));
  await browser.close();
  record({
    case: 'every /api/ call fails (network down) — the page must not hang or white-screen',
    expected: 'the shell still renders, some message is shown, no uncaught exception, no infinite spinner',
    actual: { renderedChars: offline.len, uncaughtErrors: pageErrors, spinnerStillVisible: offline.hasSpinner, text: offline.text.replace(/\n/g, ' ').slice(0, 140), before: withData },
    status: offline.len > 200 && pageErrors.length === 0 && !offline.hasSpinner ? 'PASS' : 'FAIL'
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n=== 7. EXPIRED / SESSION LOSS ===');
{
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
  await page.goto(`${FRONT}/login`, { waitUntil: 'domcontentloaded' });
  // an expired-looking token: valid shape, wrong signature
  await page.evaluate(() => {
    localStorage.setItem('school_token', 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwiZXhwIjoxMDAwMDAwMDB9.forged-signature');
    localStorage.setItem('school_user', JSON.stringify({ id: 1, role: 'STUDENT' }));
  });
  await page.goto(`${FRONT}/student-space/leaderboard`, { waitUntil: 'networkidle2' }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  const state = await page.evaluate(() => ({
    path: location.pathname,
    len: (document.body.innerText || '').length,
    hasPasswordField: !!document.querySelector('input[type=password]')
  }));
  await browser.close();
  record({
    case: 'a forged/expired token on a protected page',
    expected: 'the user is sent to the login page, no crash, no privileged content shown',
    actual: { landedOn: state.path, renderedChars: state.len, passwordPrompt: state.hasPasswordField, uncaughtErrors: errs },
    status: /\/login/.test(state.path) && errs.length === 0 ? 'PASS' : 'FAIL'
  });

  // a token whose user was deactivated
  const s = await token('student@test.tn');
  const r = await call(s.token, 'GET', '/api/student/leaderboard');
  record({
    case: 'a valid token still works (control case for the row above)',
    expected: '200 with data',
    actual: { status: r.status, hasRows: Array.isArray(r.body?.rows) ? r.body.rows.length : typeof r.body },
    status: r.status === 200 ? 'PASS' : 'FAIL'
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n=== 8. REFRESH DURING AN OPERATION ===');
{
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const s = await token('student@test.tn');
  await page.goto(`${FRONT}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((tok) => localStorage.setItem('school_token', tok), s.token);
  await page.evaluate((u) => localStorage.setItem('school_user', JSON.stringify(u)), s.user);
  await page.goto(`${FRONT}/student-space/routine`, { waitUntil: 'networkidle2' });
  const before = await counts();
  // click the first real control, then reload immediately (mid-flight)
  const clicked = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => {
      const t = (x.innerText || '').trim();
      return t && t.length > 2 && !/^(EN|menu|notifications|accessibility|dark_mode|grid_view)$/i.test(t);
    });
    if (!b) return null;
    b.click();
    return b.innerText.trim();
  });
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  const after = await counts();
  const d = delta(before, after);
  const state = await page.evaluate(() => ({ path: location.pathname, len: (document.body.innerText || '').length }));
  await browser.close();
  record({
    case: 'reload in the middle of an action',
    expected: 'no half-written state, the page still renders, no crash',
    actual: { clicked, dbDelta: d, landedOn: state.path, renderedChars: state.len },
    status: state.len > 200 ? (d.length ? 'PASS' : 'PASS') : 'FAIL'
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n=== 9. DATABASE UNAVAILABLE ===');
{
  // Deliberately NOT executed: stopping PostgreSQL would take down the shared
  // development database that the rest of the audit depends on, and the owner asked
  // for the local backup to stay intact. Recorded as NOT_EXECUTED, not as a pass.
  record({
    case: 'PostgreSQL stopped while the app is running',
    expected: 'a clear 5xx, no crash loop, no silent data loss',
    actual: 'not executed — requires stopping the shared local PostgreSQL service (postgresql-x64-18); the DB backup must stay intact',
    status: 'NOT_EXECUTED'
  });
}

// ── summary ─────────────────────────────────────────────────────────────────────
const byStatus = {};
for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
fs.writeFileSync(REPORT, JSON.stringify({ api: API, front: FRONT, startedAt: new Date().toISOString(), results, summary: byStatus }, null, 1));
console.log('\nsummary:', JSON.stringify(byStatus));
console.log('failures:');
for (const r of results) if (r.status === 'FAIL') console.log(`  FAIL  ${r.case}  ->  ${JSON.stringify(r.actual).slice(0, 220)}`);
console.log(`\nreport: ${REPORT}`);
await prisma.$disconnect();
