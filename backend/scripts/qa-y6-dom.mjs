import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

/**
 * QA آلي على الصفحة كما تُعرض: يبني HTML كل درس (نفس qa-y6-pages)، يفتحه في
 * Chromium، ويفحص DOM: كل تمرين له عنصر إجابة من نوعه، لا إجابة ظاهرة،
 * لا تسرب من سنوات أخرى، ترقيم متسلسل، جداول حقيقية عند الطلب.
 */
const ROOT = path.resolve(process.argv[2] || '.');
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const { makePageHtml } = await import('./qa-y6-lib.mjs');
const pageHtml = makePageHtml(ROOT);

const units = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend/curriculum/year6/math-lessons.json'), 'utf8'));
const ids = Object.keys(units).filter((k) => units[k] && units[k].studentBlocks);

const FOREIGN = ['آلة الجمع', 'التموضع', 'أصابع اليد', 'كتابي في الرياضيات', 'رياضياتي 2', 'حرف الميم'];
const ANSWER_WORDS = ['الإجابة: ', 'الجواب: ', 'الباحث '];

(async () => {
  const { browserPdfStatus } = require(path.join(ROOT, 'backend/src/services/browserPdf.js'));
  const browser = await puppeteer.launch({ executablePath: browserPdfStatus().executable, args: ['--no-sandbox', '--disable-gpu'], headless: 'new' });
  const page = await browser.newPage();
  const problems = [];
  let checked = 0;
  for (const id of ids) {
    const lesson = units[id];
    await page.setContent(pageHtml(lesson), { waitUntil: 'domcontentloaded' });
    const res = await page.evaluate((foreign, answerWords) => {
      const text = document.body.innerText;
      const out = { missingAns: [], foreign: [], answerShown: [], exCount: 0, tableCount: 0, emptyEx: [] };
      document.querySelectorAll('.exercise').forEach((ex, i) => {
        out.exCount++;
        const kind = ex.querySelector('table.ptab') ? 'table' : ex.querySelector('.inbox') ? 'input' : ex.querySelector('.drawbox') ? 'draw' : ex.querySelector('.writebox') ? 'text' : ex.querySelector('.opts') ? 'opts' : ex.querySelector('.match') ? 'match' : 'none';
        if (kind === 'none') out.missingAns.push(i + 1);
        if (ex.querySelector('.extext') && !ex.querySelector('.extext').textContent.trim() && !(ex.querySelector('.extitle') && ex.querySelector('.extitle').textContent.trim())) out.emptyEx.push(i + 1);
      });
      out.tableCount = document.querySelectorAll('table.ptab').length;
      for (const f of foreign) if (text.includes(f)) out.foreign.push(f);
      for (const a of answerWords) {
        const idx = text.indexOf(a);
        if (idx >= 0) { const exEl = [...document.querySelectorAll('.exercise')].find((e) => e.innerText.includes(a)); if (exEl) out.answerShown.push(a.trim() + ' @' + exEl.innerText.slice(Math.max(0, exEl.innerText.indexOf(a) - 20), exEl.innerText.indexOf(a) + 45).replace(/\n/g, ' ')); }
      }
      return out;
    }, FOREIGN, ANSWER_WORDS);
    checked++;
    if (res.missingAns.length) problems.push(`${id}: تمارين بلا عنصر إجابة ${res.missingAns.join(',')}`);
    if (res.emptyEx.length) problems.push(`${id}: تمارين بنص فارغ ${res.emptyEx.join(',')}`);
    if (res.foreign.length) problems.push(`${id}: تسرب سنوات أخرى: ${res.foreign.join(' | ')}`);
    if (res.answerShown.length) problems.push(`${id}: إجابة ظاهرة: ${res.answerShown.slice(0, 2).join(' || ')}`);
  }
  await browser.close();
  console.log(`QA on ${checked} lessons — problems: ${problems.length}`);
  problems.slice(0, 25).forEach((p) => console.log(' -', p));
  fs.writeFileSync(path.join(process.env.TEMP || process.env.TMP, 'qa-y6-report.txt'), problems.join('\n') || 'CLEAN', 'utf8');
})();
