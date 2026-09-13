/* Visual QA v2: boot real app + SPA, DOM-probe student lessons and teacher memo preview. */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.NODE_ENV = 'production';
process.env.ALLOWED_ORIGINS = 'http://localhost:4611';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://school_user:school_pass@localhost:5432/school_platform_test';
process.env.JWT_SECRET = 'test-secret-test-secret-32';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || path.join(__dirname, 'qa-shots');
fs.mkdirSync(OUT, { recursive: true });

const { resetDatabase, seedTestData, login } = await import('../tests/helpers.js');
await resetDatabase();
await seedTestData();
const { app } = await import('../src/index.js');
const server = http.createServer(app);
await new Promise((r) => server.listen(4611, r));
const BASE = 'http://localhost:4611';

const st = await login('student@test.tn', 'student123');
const tt = await login('teacher@test.tn', 'teacher123');

const ppt = await import('puppeteer-core');
const EXE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find((c) => fs.existsSync(c));
const browser = await ppt.default.launch({
  executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none', '--lang=ar']
});

async function session(token) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1180, height: 1600 });
  await page.evaluateOnNewDocument((tok) => {
    localStorage.setItem('school_token', tok);
    localStorage.setItem('school_refresh_token', tok);
  }, token);
  return page;
}
const quiet = (ms = 1200) => new Promise((r) => setTimeout(r, ms));
async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
  console.log('shot:', name);
}
async function bodyText(page, n = 2500) { return page.evaluate((k) => document.body.innerText.slice(0, k), n); }
function collect(report, label, ok, note) { report.push(`${ok ? 'PASS' : 'FAIL'} — ${label}${note ? ' :: ' + note : ''}`); }

const report = [];

// ───────── student flow ─────────
const sp = await session(st.body.token);
sp.on('pageerror', (e) => report.push('pageerror: ' + String(e.message).slice(0, 140)));
await sp.goto(BASE + '/student-space/books', { waitUntil: 'networkidle2' });
await quiet(2500);
await shot(sp, '01-student-books');

// if default tab empty: click every subject tab and every level tab until cards appear
for (let round = 0; round < 4; round++) {
  const state = await sp.evaluate(() => ({ cards: document.querySelectorAll('.card').length, empty: !!document.querySelector('.empty') }));
  if (state.cards > 0) break;
  await sp.evaluate(() => {
    const all = document.querySelector('.subject-tabs .subject-tab');
    const tabs = Array.from(document.querySelectorAll('.subject-tab'));
    (tabs.find((t) => /كل/.test(t.textContent || '')) || tabs[0])?.click();
    if (all) all.click();
  });
  await quiet(1200);
  const clicked = await sp.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.subject-tab'));
    for (const t of tabs) t.click();
    return tabs.length;
  });
  report.push(`tab-sweep clicked ${clicked} tabs`);
  await quiet(1500);
  break;
}
await shot(sp, '01b-student-books-tab2');
const cardCount = await sp.evaluate(() => document.querySelectorAll('.card').length);
report.push(`student buttons: ${await sp.evaluate(() => Array.from(document.querySelectorAll('button')).map((b) => (b.textContent || '').trim()).filter((t) => t && t.length < 40).slice(0, 40).join(' | '))}`);

let opened = false;
if (cardCount > 0) {
  // click first "interactive lessons" button that opens LessonViewer
  opened = await sp.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.card button')).find((b) => /\(\d+\)/.test(b.textContent || '') && !/تصفح/.test(b.textContent || ''));
    if (btn) { btn.click(); return true; }
    return false;
  });
}
await quiet(2500);
const viewer = await sp.evaluate(() => !!document.querySelector('.lesson-sheet, .lesson-blocks, .paper-header, .lesson-page-num, .toc-list, .lesson-list'));
collect(report, 'فتح عارض الدروس التفاعلية', !!(opened && viewer), `cards=${cardCount} opened=${opened} viewer=${viewer}`);
await shot(sp, '02-student-lesson-viewer');

if (viewer) {
  // if a lesson list (TOC) is shown first, open the first lesson
  await sp.evaluate(() => {
    const li = document.querySelector('.toc-item, .lesson-list button, .lesson-list .card');
    if (li && !document.querySelector('.lesson-page-num')) li.click();
  });
  await quiet(1800);
  let qNoZone = 0; let qTotal = 0; let tableNoGrid = 0; let pages = 0;
  const probe = () => sp.evaluate(() => {
    let noZone = 0; let total = 0; let noGrid = 0;
    document.querySelectorAll('.lesson-block-question, .paper-exercise').forEach((q) => {
      total++;
      if (!q.querySelector('input,textarea,canvas,.lesson-mcq,.mcq-options,table,.lesson-block-tablezone')) noZone++;
    });
    document.querySelectorAll('.lesson-block-question, .paper-exercise').forEach((tw) => {
      if (/جدول/.test(tw.textContent || '') && !tw.querySelector('table,input,textarea')) noGrid++;
    });
    return { noZone, total, noGrid };
  });
  for (let i = 0; i < 10; i++) {
    const p1 = await probe();
    qTotal += p1.total; qNoZone += p1.noZone; tableNoGrid += p1.noGrid; pages++;
    const moved = await sp.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const next = btns.filter((b) => ['chevron_right', 'arrow_forward', 'navigate_next'].includes((b.querySelector('.material-icons')?.textContent || '').trim())).find((b) => !b.disabled);
      if (next) { next.click(); return true; }
      return false;
    });
    if (!moved) break;
    await quiet(1400);
  }
  collect(report, `أسئلة بلا منطقة إجابة = ${qNoZone} من ${qTotal} (صفحات=${pages})`, qNoZone === 0);
  collect(report, `«جدول» بلا جدول/مكان إجابة = ${tableNoGrid}`, tableNoGrid === 0);
  await shot(sp, '03-student-lessons-end');
}

// ───────── teacher memo flow ─────────
const tp = await session(tt.body.token);
await tp.goto(BASE + '/teacher/memos', { waitUntil: 'networkidle2' });
await quiet(2200);
const gen = await tp.evaluate(async () => {
  const r = await fetch('/api/memos/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('school_token') }, body: JSON.stringify({ subject: 'ايقاظ علمي', level: 'السنة الأولى أساسي', lessonTitle: 'الحواس الخمس ووظائفها' }) });
  const j = await r.json();
  return j.memo ? { ok: true, memo: j.memo } : { ok: false, err: JSON.stringify(j).slice(0, 200) };
});
collect(report, 'توليد مذكرة إيقاظ', !!gen.ok, gen.err || '');
if (gen.ok) {
  const c = gen.memo.content || {};
  const s = c.spec || {};
  const comp = s.competencies || {};
  collect(report, 'مكوّن الكفاية فارغ؟', !!comp.component, String(comp.component).slice(0, 60));
  collect(report, 'لا تسرّب رياضيات في الأيقاظ', !/العمليات على الأعداد/.test((comp.component || '') + (comp.distinctiveObjective || '') + (comp.subject || '')), comp.component);
  collect(report, 'الهدف المميّز غير فارغ', !!(comp.distinctiveObjective || '').trim(), String(comp.distinctiveObjective).slice(0, 60));
  collect(report, 'المحتوى غير فارغ', !!(s.content || '').trim(), String(s.content).slice(0, 60));
  collect(report, 'هدف الحصة غير فارغ', (s.lessonObjectives || []).length > 0, (s.lessonObjectives || [])[0]);
  collect(report, 'لا صور', !(c.images || []).length && !(s.images || []).length && !(s.rows || []).some((r) => (r.images || []).length));
  collect(report, 'لا مراحل فارغة', (s.rows || []).every((r) => (r.teacherActivity || '').trim() && (r.learnerActivity || '').trim()));
  // open in UI
  await tp.goto(BASE + '/teacher/memos', { waitUntil: 'networkidle2' });
  await quiet(2500);
  try {
    await tp.waitForFunction(() => Array.from(document.querySelectorAll('tr')).some((r) => /الحواس/.test(r.textContent || '')), { timeout: 12000 });
  } catch { /* report below */ }
  const rowBtn = await tp.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr'));
    const row = rows.find((r) => /الحواس/.test(r.textContent || ''));
    if (!row) return false;
    const btn = Array.from(row.querySelectorAll('button')).find((b) => /عرض|معاينة|preview/i.test(b.textContent || '')) || row.querySelector('button');
    if (btn) { btn.click(); return true; }
    return false;
  });
  await quiet(1800);
  if (!rowBtn) report.push('memo-list-dump: ' + (await bodyText(tp, 800)).replace(/\n/g, ' | ').slice(0, 400));
  try {
    await tp.waitForFunction(() => /مكوّن الكفاية|مكون الكفاية/.test(document.body.innerText), { timeout: 8000 });
  } catch { /* dump below */ }
  const txt = await tp.evaluate(() => {
    const v = document.querySelector('.memo-view');
    return (v ? v.innerText : document.body.innerText).slice(0, 3500);
  });
  const txtPlain = txt.replace(/[\u064B-\u0652\u0670]/g, '');
  collect(report, 'المعاينة تعرض الحقول الرسمية', /مكون الكفاية/.test(txtPlain) && /الهدف الم/.test(txtPlain) && /هدف الحصة/.test(txtPlain) && /المحتوى/.test(txtPlain), rowBtn ? 'clicked' : 'row-not-found');
  collect(report, 'لا حروف صينية في المعاينة', !/[\u4e00-\u9fff\u3000-\u30ff]/.test(txt));
  collect(report, 'معاينة بلا صور', !(await tp.evaluate(() => document.querySelectorAll('.memo-view img, table img').length)));
  await shot(tp, '04-teacher-memo-science');
}
// math memo check (banner/الهدف المميّز label + dedupe)
const genM = await tp.evaluate(async () => {
  const r = await fetch('/api/memos/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('school_token') }, body: JSON.stringify({ subject: 'رياضيات', level: 'السنة السادسة أساسي', lessonTitle: 'أُوَظّفُ الجمعَ والطّرحَ في مجموعةِ الأعدادِ العشريّةِ' }) });
  const j = await r.json();
  return j.memo ? { ok: true, memo: j.memo } : { err: JSON.stringify(j).slice(0, 160) };
});
if (genM.ok) {
  const s = genM.memo.content.spec || {};
  const lines = new Set();
  let dupes = 0;
  for (const r of s.rows || []) for (const ln of String(r.teacherActivity || '').split('\n')) { const k = ln.trim(); if (k.length > 25 && !/^[.\s]+$/.test(k)) { if (lines.has(k)) dupes++; lines.add(k); } }
  collect(report, 'مذكرة س6 بلا تكرار بين المراحل', dupes === 0, `dupes=${dupes}`);
  collect(report, 'مذكرة س6 خمس مراحل+', (s.rows || []).length >= 5, `rows=${(s.rows || []).length}`);
  collect(report, 'لا تسرب حل داخل نشاطات التلميذ في الرياضيات', !(s.rows || []).some((r) => /الحل\s*[:=]\s*[0-9٠-٩]/.test(r.learnerActivity || '')));
} else {
  collect(report, 'توليد مذكرة س6', false, genM.err);
}

fs.writeFileSync(path.join(OUT, 'qa-report.txt'), report.join('\n'));
console.log('\n===== VISUAL QA REPORT =====\n' + report.join('\n'));
await browser.close();

// ───────── year6 paperStyle (ورقة اختبار حقيقية) probe: promote seeded class, re-open tunsi ─────────
{
  const prisma = (await import('../src/db.js')).default;
  await prisma.class.update({ where: { id: 1 }, data: { level: 'السنة السادسة أساسي' } });
  const st6 = await login('student@test.tn', 'student123');
  let studentPw = 'student123';
  if (st6.status !== 200) {
    const srow = await (await import('../src/db.js')).default.student.findFirst({ where: { account: { email: 'student@test.tn' } } });
    if (srow && srow.tempPassword) {
      studentPw = srow.tempPassword;
      const retry = await login('student@test.tn', studentPw);
      if (retry.status === 200) { st6.status = 200; st6.body = retry.body; }
    }
  }
  report.push('year6 student login status: ' + st6.status + (studentPw !== 'student123' ? ' (bootstrap temp pw)' : ''));
  const meCheck = await fetch(BASE + '/api/auth/me', { headers: { Authorization: 'Bearer ' + st6.body.token } });
  report.push('year6 token probe: login=' + st6.status + ' me=' + meCheck.status + ' (len ' + String(st6.body.token || '').length + ')');
  const b2 = await ppt.default.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const p6 = await b2.newPage();
  await p6.setViewport({ width: 1180, height: 1700 });
  await p6.evaluateOnNewDocument((t) => { localStorage.setItem('school_token', t); localStorage.setItem('school_refresh_token', t); }, st6.body.token);
  await p6.goto(BASE + '/student-space/books', { waitUntil: 'networkidle2' });
  await quiet(3000);
  report.push('year6 page head: ' + (await p6.evaluate(() => document.body.innerText.slice(0, 160))).replace(/\n/g, ' | '));
  // open math tab then the tunsi book's interactive lessons
  const openTunsi = await p6.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.subject-tab')).filter((t) => /رياضيات/.test(t.textContent || ''));
    if (tabs[0]) { tabs[0].click(); return 1; }
    return 0;
  });
  await quiet(1500);
  report.push('year6 tabs clicked: ' + openTunsi + ' | cards: ' + await p6.evaluate(() => Array.from(document.querySelectorAll('.card')).length));
  const opened6 = await p6.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.card'));
    const target = cards.find((c) => /تونس/.test(c.textContent || '')) || cards[cards.length - 1];
    if (!target) return false;
    const btn = Array.from(target.querySelectorAll('button')).find((b) => /الدروس التفاعلية/.test(b.textContent || ''));
    if (btn) { btn.click(); return true; }
    return false;
  });
  report.push('year6 opened6=' + opened6);
  await quiet(2500);
  await p6.evaluate(() => { const li = document.querySelector('.toc-item, .lesson-list button, .lesson-list .card'); if (li && !document.querySelector('.lesson-page-num')) li.click(); });
  await quiet(2000);
  const paper = await p6.evaluate(() => {
    const txt = document.body.innerText;
    let noZone = 0; let total = 0;
    document.querySelectorAll('.paper-exercise').forEach((q) => {
      total++;
      if (!q.querySelector('input,textarea,canvas,table,.mcq-options')) noZone++;
    });
    return {
      isPaper: !!document.querySelector('.paper-header, .paper-title-bar, .paper-body'),
      hasName: /اسم التلميذ|اسم المتعلّم|التلميذ/.test(txt),
      hasDate: /التاريخ|القسم/.test(txt),
      exercises: total, noZone,
      imagesInMemo: 0
    };
  });
  collect(report, 'س6: الصفحة تُعرض كورقة اختبار حقيقية (رأس+اسم+قسم+تاريخ)', paper.isPaper && paper.hasName && paper.hasDate, JSON.stringify(paper));
  collect(report, 'س6: كل تمرين له مكان إجابة مناسب', paper.noZone === 0, `exercises=${paper.exercises} noZone=${paper.noZone}`);
  await p6.screenshot({ path: path.join(OUT, '05-year6-tunsi-paper.png'), fullPage: true });
  const leakedOnScreen = await p6.evaluate(() => {
    const bad = [];
    document.querySelectorAll('.paper-exercise .ex-text').forEach((e) => {
      const t = e.textContent || '';
      const qi = t.search(/[؟?]/);
      if (qi > 0 && /[0-9]\s*[+×*:−-]\s*[0-9]+[^=\n]{0,12}=\s*[0-9]/.test(t.slice(qi))) bad.push(t.slice(0, 70));
    });
    return bad;
  });
  collect(report, 'س6: لا إجابة مكشوفة داخل سؤال معروض', leakedOnScreen.length === 0, leakedOnScreen.join(' || '));
  await b2.close();
  // restore seeded level for repeatability
  await prisma.class.update({ where: { id: 1 }, data: { level: 'السنة الأولى أساسي' } });
  await prisma.$disconnect();
}
fs.writeFileSync(path.join(OUT, 'qa-report.txt'), report.join('\n'));
console.log('\n===== YEAR6 PAPER QA =====\n' + report.slice(-3).join('\n'));
server.close();
process.exit(0);
