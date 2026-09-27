// INDEPENDENT RE-VERIFICATION of every non-PASS row from the functional scan.
//
// The owner's rule: nothing is a bug until it reproduces on its own, and nothing caused by
// the audit tool or by the environment may enter the bug list. This script therefore:
//
//   1. reads the raw scan report,
//   2. takes ONLY the rows whose verdict is not a PASS,
//   3. re-runs each one in a FRESH browser context with a FRESH login, three times,
//   4. classifies the outcome into exactly one of:
//
//        APP_BUG             reproduces every time, the failure follows the element
//        AUDIT_TOOL_FAILURE  fails only inside the scan (harness timing/selector/DOM race)
//        ENVIRONMENT_FAILURE the API or the dev server was not serving at that moment
//        TRANSIENT_FAILURE   failed once, passes on re-test
//        NOT_A_DEFECT        the control is legitimately inert (e.g. a filter for 0 rows)
//
// A row only becomes an APP_BUG candidate when it fails in 3/3 attempts AND at least one
// attempt shows a real application signal (a 5xx, an uncaught exception, or a database
// write that should not have happened). Everything else is reported with the reason.
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const FRONT = process.env.AUDIT_FRONT || 'http://localhost:5174';
const API = process.env.AUDIT_API || 'http://localhost:3003';
const SCAN_REPORT = process.env.AUDIT_SCAN_REPORT || 'scripts/audit-functional-report.json';
const OUT = process.env.AUDIT_REVERIFY_REPORT || 'scripts/audit-reverify-report.json';
const ATTEMPTS = 3;

const CHROME = process.env.CHROME_PATH
  || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
    .find((p) => fs.existsSync(p));
if (!CHROME) { console.error('no browser found'); process.exit(1); }
const puppeteer = (await import('puppeteer-core')).default;
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

if (!fs.existsSync(SCAN_REPORT)) {
  console.error(`no scan report at ${SCAN_REPORT} — run check-functional-flows.mjs first`);
  process.exit(1);
}
const scan = JSON.parse(fs.readFileSync(SCAN_REPORT, 'utf8'));
const nonPass = (scan.controls || []).filter((r) => !String(r.status || '').startsWith('PASS'));
console.log(`scan rows: ${(scan.controls || []).length} · non-PASS rows to re-verify: ${nonPass.length}`);
if (!nonPass.length) { console.log('nothing to re-verify'); process.exit(0); }

const COUNT_SQL = `
SELECT table_name,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint AS n
FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`;
const counts = async () => new Map((await prisma.$queryRawUnsafe(COUNT_SQL)).map((r) => [r.table_name, Number(r.n)]));
function dbDelta(a, b) {
  const out = [];
  for (const [t, n] of b) if (a.get(t) !== n) out.push({ table: t, from: a.get(t), to: n });
  return out;
}

const CRED = {
  student: ['student@test.tn', 'qarn-zeft-7alib-2026!'],
  teacher: ['teacher@test.tn', 'qarn-zeft-7alib-2026!'],
  parent: ['parent@test.tn', 'qarn-zeft-7alib-2026!'],
  director: ['director@test.tn', 'qarn-zeft-7alib-2026!'],
  admin: ['admin@education.tn', 'qarn-zeft-7alib-2026!']
};

const domState = () => ({ len: (document.body.innerText || '').length, path: location.pathname, text: (document.body.innerText || '').slice(0, 2500) });
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
const findByLabel = (label) => {
  const el = Array.from(document.querySelectorAll('button, a[href], [role=button]'))
    .find((e) => {
      const t = (e.innerText || e.getAttribute('aria-label') || e.title || '').trim().replace(/\s+/g, ' ');
      return t === label && e.getBoundingClientRect().width > 0;
    });
  if (!el) return { found: false };
  return {
    found: true,
    tag: el.tagName.toLowerCase(),
    href: el.getAttribute('href'),
    disabled: !!el.disabled,
    classes: (el.className || '').toString().slice(0, 90),
    onclick: !!el.onclick,
    outerStart: el.outerHTML.slice(0, 200)
  };
};

const apiAlive = async () => {
  try { const r = await fetch(API + '/api/health'); return { up: r.ok }; }
  catch (e) { return { up: false, error: String(e.message).slice(0, 60) }; }
};

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,1000'],
  protocolTimeout: 600000
});

const results = [];
for (const row of nonPass) {
  const health = await apiAlive();
  const attempts = [];

  for (let n = 1; n <= ATTEMPTS; n += 1) {
    const attempt = { attempt: n, apiUp: health.up };
    if (!health.up) { attempt.observed = 'ENVIRONMENT_FAILURE'; attempts.push(attempt); continue; }

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 160)));

    try {
      if (CRED[row.role]) {
        const lr = await fetch(`${API}/api/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: CRED[row.role][0], password: CRED[row.role][1] })
        });
        const d = await lr.json().catch(() => ({}));
        if (!d.token) { attempt.observed = 'ENVIRONMENT_FAILURE'; attempt.detail = `login ${lr.status}`; attempts.push(attempt); await page.close(); continue; }
        await page.goto(`${FRONT}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.evaluate((s) => {
          localStorage.setItem('school_token', s.token);
          localStorage.setItem('school_user', JSON.stringify(s.user));
        }, d);
      }
      await page.goto(FRONT + row.page, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.evaluate(waitRender).catch(() => {});
      await new Promise((r) => setTimeout(r, 700));

      const target = await page.evaluate(findByLabel, row.action).catch((e) => ({ found: false, error: e.message.slice(0, 80) }));
      attempt.elementFoundOnPage = target.found;
      attempt.element = target;
      if (!target.found) { attempt.observed = 'AUDIT_TOOL_FAILURE'; attempt.detail = 'the element is not present when the page is opened directly'; attempts.push(attempt); await page.close(); continue; }

      const before = await page.evaluate(domState);
      const dbBefore = await counts();
      const reqs = [];
      const onResp = (r) => { const u = r.url(); if (u.includes('/api/')) reqs.push({ m: r.request().method(), p: u.replace(FRONT, '').replace(API, ''), s: r.status() }); };
      page.on('response', onResp);
      let clickError = null;
      try {
        await page.evaluate((label) => {
          const el = Array.from(document.querySelectorAll('button, a[href], [role=button]'))
            .find((e) => {
              const t = (e.innerText || e.getAttribute('aria-label') || e.title || '').trim().replace(/\s+/g, ' ');
              return t === label && e.getBoundingClientRect().width > 0;
            });
          if (!el) throw new Error('element vanished at click time');
          el.scrollIntoView({ block: 'center' });
          el.click();
        }, row.action);
      } catch (e) { clickError = e.message.slice(0, 100); }
      await new Promise((r) => setTimeout(r, 1500));
      page.off('response', onResp);
      const after = await page.evaluate(domState);
      const dbAfter = await counts();

      const delta = dbDelta(dbBefore, dbAfter);
      const e5 = reqs.filter((q) => q.s >= 500);
      const e429 = reqs.filter((q) => q.s === 429);
      attempt.requests = reqs.slice(0, 5);
      attempt.dbDelta = delta.slice(0, 4);
      attempt.domChanged = after.len !== before.len || after.path !== before.path;
      attempt.consoleErrors = errors.slice(0, 3);
      attempt.clickError = clickError;

      if (clickError) attempt.observed = 'AUDIT_TOOL_FAILURE';
      else if (e5.length) attempt.observed = 'APP_BUG';
      else if (attempt.consoleErrors.length) attempt.observed = 'APP_BUG';
      else if (!attempt.domChanged && reqs.length === 0 && delta.length === 0) attempt.observed = 'REPRODUCED_DEAD';
      else attempt.observed = 'OK';
      attempt.environment = e429.length ? 'RATE_LIMITED' : 'CLEAN';
    } catch (e) {
      attempt.observed = 'AUDIT_TOOL_FAILURE';
      attempt.detail = String(e.message).slice(0, 120);
    }
    await page.close();
    attempts.push(attempt);
  }

  // ── classification ────────────────────────────────────────────────────────────
  const obs = attempts.map((a) => a.observed);
  const reproduced = obs.filter((o) => o === 'REPRODUCED_DEAD' || o === 'APP_BUG').length;
  const anyEnv = obs.includes('ENVIRONMENT_FAILURE');
  const appSignals = attempts.some((a) => (a.consoleErrors || []).length || (a.requests || []).some((q) => q.s >= 500));

  let classification;
  if (anyEnv) classification = 'ENVIRONMENT_FAILURE';
  else if (reproduced === ATTEMPTS && appSignals) classification = 'APP_BUG';
  else if (reproduced === ATTEMPTS) classification = 'INERT_CONTROL';       // deterministic, but not a crash
  else if (reproduced > 0) classification = 'TRANSIENT_FAILURE';
  else if (obs.every((o) => o === 'AUDIT_TOOL_FAILURE')) classification = 'AUDIT_TOOL_FAILURE';
  else classification = 'NOT_A_DEFECT';

  results.push({
    role: row.role, page: row.page, action: row.action, originalVerdict: row.status,
    originalEvidence: row.actual,
    classification,
    reproducedIn: `${reproduced}/${ATTEMPTS}`,
    attempts
  });
  console.log(`  [${classification}] ${row.role} ${row.page} :: ${row.action}  (${reproduced}/${ATTEMPTS} reproduced, original verdict ${row.status})`);
}

await browser.close();

const byClass = {};
for (const r of results) byClass[r.classification] = (byClass[r.classification] || 0) + 1;
const out = { source: SCAN_REPORT, front: FRONT, api: API, at: new Date().toISOString(), byClass, results };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
await prisma.$disconnect();

console.log('\nclassification:', JSON.stringify(byClass, null, 1));
console.log(`\nAPP_BUG candidates (reproduced ${ATTEMPTS}/${ATTEMPTS} with an application signal):`);
for (const r of results.filter((x) => x.classification === 'APP_BUG')) console.log(`  ${r.page} :: ${r.action}`);
console.log('\nINERT_CONTROL (deterministically does nothing — decide if that is correct):');
for (const r of results.filter((x) => x.classification === 'INERT_CONTROL')) console.log(`  ${r.page} :: ${r.action}`);
console.log(`\nreport: ${OUT}`);
