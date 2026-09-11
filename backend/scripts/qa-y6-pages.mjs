import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

/**
 * Visual QA: يبني HTML يطابق عرض AssessmentPaper (ورقة الاختبار) لدروس س6
 * ويصوّره بـ Chromium إلى PNG لفحصه بصريًا كما يراه التلميذ.
 * الاستخدام: node scripts/qa-y6-pages.mjs <repoRoot> [y6m01 y6m07 ...]
 */
const ROOT = path.resolve(process.argv[2] || '.');
const ids = process.argv.slice(3);
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const units = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend/curriculum/year6/math-lessons.json'), 'utf8'));
const IMG_DIRS = [path.join(ROOT, 'frontend/public'), path.join(ROOT, 'backend/uploads')];

function imgDataUri(src) {
  for (const base of IMG_DIRS) {
    for (const ext of ['.webp', '.png']) {
      const p = path.join(base, src.replace(/^\//, '') .replace(/\.(png|jpe?g)$/i, '') + ext);
      if (fs.existsSync(p)) return `data:image/webp;base64,${fs.readFileSync(p).toString('base64')}`;
    }
    const direct = path.join(base, src.replace(/^\//, ''));
    if (fs.existsSync(direct)) return `data:image/png;base64,${fs.readFileSync(direct).toString('base64')}`;
  }
  return null;
}

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function renderBlock(b, num) {
  const img = b.image ? imgDataUri(b.image) : null;
  const imgTag = img ? `<div class="bimg"><img src="${img}" style="max-width:70%;max-height:220px;border:1px solid #bbb;border-radius:8px"/></div>` : '';
  if (b.kind === 'concept') {
    if (!b.text && !img) return '';
    return `<div class="passage">${b.title ? `<h4>${esc(b.title)}</h4>` : ''}${imgTag}<p>${esc(b.text || '')}</p></div>`;
  }
  let ans = '';
  if (b.kind === 'table') {
    const cols = (b.columns || []).map((c) => `<th>${esc(c)}</th>`).join('');
    const rows = (b.rows || []).map((r) => `<tr>${r.map((c) => (c === '' ? '<td><span class="cellbox"></span></td>' : `<td class="filled">${esc(c)}</td>`)).join('')}</tr>`).join('');
    ans = `<table class="ptab">${cols ? `<thead><tr>${cols}</tr></thead>` : ''}<tbody>${rows}</tbody></table>`;
  } else if (b.kind === 'math-input') {
    ans = `<div class="ansline">أُكْتُبُ إجابتي: <span class="inbox"></span></div>`;
  } else if (b.kind === 'question') {
    ans = (b.options && b.options.length)
      ? `<div class="opts">${b.options.map((o) => `<span class="opt">◯ ${esc(o)}</span>`).join(' ')}</div>`
      : `<div class="ansline">أُكْتُبُ إجابتي: <span class="inbox"></span></div>`;
  } else if (b.kind === 'textarea') {
    ans = `<div class="writebox"></div>`;
  } else if (b.kind === 'drawing') {
    ans = `<div class="drawbox">مساحة الرسم</div>`;
  } else if (b.kind === 'match-pairs') {
    ans = `<div class="match"><div>${(b.pairs || []).map((p) => `<div class="ml">${esc(p.left?.text || '')}</div>`).join('')}</div><div>${(b.pairs || []).map((p) => `<div class="mr">${esc(p.right?.text || '')}</div>`).join('')}</div></div>`;
  }
  return `<div class="exercise"><div class="exhead"><span class="exnum">التمرين ${num}</span> <span class="extitle">${esc(b.title || '')}</span></div><div class="extext">${esc(b.text || '')}</div>${imgTag}${ans}</div>`;
}

function pageHtml(lesson) {
  const blocks = (lesson.studentBlocks || []).filter((b) => b && !b.teacherOnly && (b.kind !== 'concept' || b.text || b.image));
  let n = 0;
  const body = blocks.map((b) => (b.kind === 'concept' ? renderBlock(b, 0) : renderBlock(b, ++n))).join('');
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><style>
    body{font-family:"Noto Naskh Arabic","Amiri",Tahoma,sans-serif;margin:0;background:#eee;color:#222}
    .paper{max-width:800px;margin:16px auto;background:#fff;padding:18px 22px;box-shadow:0 2px 10px rgba(0,0,0,.15)}
    .phead{border:2px solid #333;border-bottom:none;padding:10px 14px;background:#f9f9f9;display:flex;justify-content:space-between;font-size:13px}
    .ptitle{border:2px solid #333;padding:8px;text-align:center;font-weight:900;font-size:19px;background:#f3e9d2}
    .passage{margin:10px 0;font-size:14.5px;line-height:1.9}
    .passage h4{margin:6px 0 2px;color:#7a4b1f}
    .exercise{border:1.5px solid #444;border-radius:8px;padding:10px 12px;margin:12px 0;font-size:14.5px;line-height:1.9}
    .exhead{display:flex;gap:10px;align-items:center;margin-bottom:4px}
    .exnum{background:#233863;color:#fff;border-radius:6px;padding:2px 10px;font-weight:800;font-size:13px}
    .extitle{font-weight:800;color:#233863}
    .ansline{margin-top:8px;font-size:14px}
    .inbox{display:inline-block;min-width:120px;border-bottom:2px solid #333;height:22px}
    .writebox{border:1.5px dashed #888;height:64px;margin-top:8px;border-radius:6px}
    .drawbox{border:1.5px dashed #888;height:150px;margin-top:8px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#aaa}
    table.ptab{border-collapse:collapse;margin:8px 0;font-size:15px}
    .ptab th{background:#e8e6df;border:2px solid #333;padding:6px 12px}
    .ptab td{border:2px solid #333;padding:8px 12px;text-align:center}
    .cellbox{display:inline-block;min-width:44px;height:24px;border-bottom:2px solid #000;background:#fbfbf4}
    .opts{margin-top:8px;font-size:15px}
    .opt{margin-inline-end:14px}
    .match{display:flex;justify-content:space-around;margin-top:8px}
    .ml,.mr{border:1px solid #999;border-radius:6px;padding:4px 14px;margin:4px 0;background:#fafafa}
    .bimg{margin:6px 0}
  </style></head><body><div class="paper">
    <div class="phead"><span>المادة: رياضيات — الفترة ${lesson.period || ''}</span><span>الاسم: ........... القسم: ..... التاريخ: ..../..../....</span></div>
    <div class="ptitle">${esc(lesson.title)}</div>
    ${body}
  </div></body></html>`;
}

const targets = ids.length ? ids : ['y6m01', 'y6m07', 'y6m10', 'y6m18', 'y6m50'];
const outDir = path.join(process.env.TEMP || process.env.TMP, 'qa-y6');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const { browserPdfStatus } = require(path.join(ROOT, 'backend/src/services/browserPdf.js'));
  const exec = browserPdfStatus().executable;
  const browser = await puppeteer.launch({
    executablePath: exec,
    args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'],
    headless: 'new'
  });
  for (const id of targets) {
    const lesson = units[id];
    if (!lesson) { console.log('skip', id); continue; }
    const page = await browser.newPage();
    await page.setViewport({ width: 860, height: 1100, deviceScaleFactor: 1.5 });
    await page.setContent(pageHtml(lesson), { waitUntil: 'networkidle0' });
    const h = await page.evaluate(() => document.body.scrollHeight);
    await page.screenshot({ path: path.join(outDir, `${id}.png`), fullPage: h < 8000 });
    await page.close();
    console.log('shot', id, 'h=', h);
  }
  await browser.close();
  console.log('QA dir:', outDir);
})();
