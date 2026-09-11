import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

/**
 * v2 — يبني studentBlocks لكتاب «رياضياتي 2» من docs/y2-math-source-seq.json
 * (استخراج متسلسل أمين يشمل الجداول). القواعد:
 *  - المثال المحلول (= رقم بلا فراغ) ⇒ concept وليس سؤالًا.
 *  - كل سؤال/مطلوب ⇒ كتلة تفاعلية (سؤال/ملء فراغ/تعبير) فيها موضع كتابة للجواب.
 *  - جدول المصدر ⇒ كتلة table بخانات فارغة قابلة للكتابة (تشمل العمليات العمودية).
 *  - جداول الربط ⇒ match-pairs. قوائم الاختيار ⇒ options.
 *  - الصور (حتى داخل الجدول) ⇒ كتل image بـ imageId.
 */
const ROOT = process.argv[2];
const X = process.env.TEMP || process.env.TMP;
const MEDIA = path.join(X, 'mg2x/word/media');
const seq = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/y2-math-source-seq.json'), 'utf8'));
const unitsPath = path.join(ROOT, 'backend/curriculum/year2/math-units.json');
const units = JSON.parse(fs.readFileSync(unitsPath, 'utf8'));

const FE = path.join(ROOT, 'frontend/public/curriculum/y2/math');
const BE = path.join(ROOT, 'backend/uploads/curriculum/y2/math');
const REPO = path.join(ROOT, 'backend/curriculum/img/y2/math');
for (const d of [FE, BE, REPO]) {
  if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
}

const BLANK = /(\.\.|…|ـ{2,}|\b__+\b)/;
const SOLVED = /=\s*[\d٠-٩]+/;
const DIRECT = /^(أُ?حسِب|أُ?حسب|أُ?جيب|أُ?كْمِل|أُ?كمل|أُ?جمع|أُ?طرح|أُ?كوِّن|أُ?كون|أُ?رتب|أُ?رتِّب|أُ?ختار|أَ?ختار|أُ?ربط|أَ?ربِط|أَ?ربط|صِل|صِلْ|أُ?وزع|أُ?عيد|أُ?ملأ|أُ?ملِئ|أَ?كتب|أُ?كتب|أَ?ملأ|أُنجز|أُ?نجز|أُ?صحح|أَ?صح|أُ?قدِّر|أَ?قدِّر|أُ?ميِّز|أَ?ميز|أميِّز|أُ?وظِّف|أُوَظِّف|أُ?كمل العمليات|أُنصِّب|أُنصِب|عَبِّر|سَمِّ|بِس|قارن|قارن|رتِّب|أُتمم|أتمِّم)/;
const WRITABLE = /^(عَبِّر|اكتب وأرسم|أُكوِّن جملة|أُجيب بجملة|فسِّر|علّل|لخّص)/;
const SEC = [
  [/أختبر/iu, 'warmup'], [/استكشف/iu, 'explore'], [/أتذكر/iu, 'recall'], [/أتدرَّب|أتدرب/iu, 'practice'],
  [/أوظف/iu, 'apply'], [/تحد/iu, 'challenge'], [/أقوِّم|أقوم/iu, 'assessment'], [/خطوات/iu, 'steps'], [/الوضعي|وضعيت/iu, 'situation']
];
function secLabel(t) {
  const n = String(t).replace(/[\u064B-\u0652\u0670]/g, '');
  for (const [re, label] of SEC) if (re.test(n)) return label;
  return null;
}
const SECTION_TITLES = {
  warmup: 'أختبرُ ذهنيًّا', explore: 'أستكشفُ', recall: 'أتذكَّرُ', practice: 'أتدرَّبُ',
  apply: 'أوظِّفُ', challenge: 'تحدٍّ', assessment: 'أقوِّمُ', steps: 'خطواتي', situation: 'الوضعيّةُ'
};

const usage = {};
for (const l of seq.lessons) for (const it of l.items) {
  for (const im of it.imgs || []) usage[im] = (usage[im] || 0) + 1;
  if (it.type === 'tbl') for (const r of it.rows) for (const c of r) for (const im of c.imgs || []) usage[im] = (usage[im] || 0) + 1;
}
const ICONS = new Set(Object.keys(usage).filter((k) => usage[k] >= 5));
const LEGEND = seq.legendIcons || {};
for (const im of Object.keys(LEGEND)) ICONS.add(im);

function cleanCell(t) {
  const s = String(t || '').trim();
  if (!s || s === '.' || s === '·' || BLANK.test(s) && s.length <= 3) return '';
  if (s === '..' || s === '…' || s === '.') return '';
  return s;
}
function normDigits(s) {
  return String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[\u064B-\u0652\u0670]/g, '');
}
function isVerticalTable(rows) {
  if (rows.length < 3 || rows[0].length < 2 || rows[0].length > 4) return false;
  const opCell = normDigits(rows[1] && rows[1][0] ? rows[1][0].t : '');
  return /^\+|^-|−|×|÷/.test(opCell) || opCell === '+' || opCell === '-';
}
function stripTashkeel(s) { return String(s).replace(/[\u064B-\u0652\u0670\u0640]/g, ''); }

let totalLessons = 0;
let totalBlocks = 0;
let totalTables = 0;
let totalImgCopies = 0;

// ربط الدرس بمنصّة: نفس مطابقة الموضع المعتمدة في docs/BOOK_Y2_MATH_MAPPING.json
const mapping = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/BOOK_Y2_MATH_MAPPING.json'), 'utf8'));
const codeToY2 = {};
for (const m of mapping.mapping) if (m.code && m.y2) codeToY2[m.code] = m.y2;

for (const sl of seq.lessons) {
  const y2 = codeToY2[sl.code];
  if (!y2 || !units[y2]) continue;
  const lesson = units[y2];
  const blocks = [];
  const imagesMeta = [];
  let imgSeq = 0;
  let section = 'intro';
  let lastText = '';
  let prevQuestionHint = '';

  const copyImg = (im) => {
    const srcFile = path.join(MEDIA, im);
    if (!fs.existsSync(srcFile)) return null;
    imgSeq += 1;
    totalImgCopies += 1;
    const name = `${y2}-${imgSeq}`;
    for (const d of [FE, BE, REPO]) fs.copyFileSync(srcFile, path.join(d, `${name}.png`));
    const imageId = `img-${y2}-${imgSeq}`;
    const caption = lastText ? stripTashkeel(lastText).slice(0, 150) : (SECTION_TITLES[section] || lesson.title);
    imagesMeta.push({ imageId, src: `/curriculum/y2/math/${name}.png`, section, caption });
    return { imageId, src: `/curriculum/y2/math/${name}.png`, caption };
  };

  const pushImgBlock = (im) => {
    if (LEGEND[im]) { section = LEGEND[im]; return; }
    if (ICONS.has(im)) return;
    const c = copyImg(im);
    if (c) blocks.push({ kind: 'concept', section, title: SECTION_TITLES[section] || lesson.title, image: c.src, imageId: c.imageId, alt: c.caption });
  };

  for (const it of sl.items) {
    if (it.type === 'p') {
      const raw = String(it.t || '').trim();
      for (const im of it.imgs || []) pushImgBlock(im);
      if (!raw || /^\d{1,2}$/.test(raw)) continue;
      const sl0 = secLabel(raw);
      if (sl0 && raw.length <= 40) { section = sl0; continue; }
      const text = raw.replace(/^\d+\.\s*/, '').replace(/\u200f|\u200e/g, '');
      const plain = stripTashkeel(text);
      const isSolvedExample = SOLVED.test(plain) && !BLANK.test(plain);
      const showsComputation = !BLANK.test(plain) && (plain.match(/[+−+-]\s*\d/g) || []).length >= 2;
      const qPos = plain.search(/[؟?]/);
      const questionWithShownAnswer = qPos >= 0 && /\d\s*[><=＋+−-]/.test(plain.slice(qPos + 1));
      const isDirective = DIRECT.test(plain) || (/[؟?]$/.test(plain.trimEnd()) && !questionWithShownAnswer);
      if (lastText) { /* keep */ }
      lastText = text;
      if (isSolvedExample || showsComputation || questionWithShownAnswer) {
        if (!BLANK.test(plain)) {
          blocks.push({ kind: 'concept', section, title: SECTION_TITLES[section] || lesson.title, text });
        }
      } else if (isDirective && WRITABLE.test(plain) && !/[0-9٠-٩]/.test(plain)) {
        blocks.push({ kind: 'textarea', section, title: text.split(':')[0].slice(0, 60), text, rows: 2 });
      } else if (isDirective) {
        blocks.push({ kind: 'question', section, title: SECTION_TITLES[section] || 'تمرين', text, placeholder: BLANK.test(plain) ? 'أُكْمِلُ الفراغ هنا' : 'أُكْتُبُ إجابتي هنا' });
        prevQuestionHint = plain;
      } else {
        blocks.push({ kind: 'concept', section, title: SECTION_TITLES[section] || lesson.title, text });
      }
      continue;
    }

    if (it.type === 'tbl') {
      const rows = it.rows;
      if (rows.length <= 2 && rows.length >= 1 && rows[0][1] && (stripTashkeel(rows[0][1].t).includes(stripTashkeel(lesson.title).slice(0, 10)) || stripTashkeel(lesson.title).includes(stripTashkeel(rows[0][1].t).slice(0, 10)))) continue;
      const cellImgs = [];
      for (const r of rows) for (const c of r) for (const im of c.imgs || []) cellImgs.push(im);
      for (const im of cellImgs) pushImgBlock(im);
      const oneRowNums = rows.length === 1 && rows[0].every((c) => c.t && /[\d٠-٩]/.test(normDigits(c.t)));
      if (oneRowNums && prevQuestionHint && (prevQuestionHint.includes('أختار') || prevQuestionHint.includes('خار'))) {
        blocks.push({ kind: 'question', section, title: 'أختار الإجابة الصحيحة', text: prevQuestionHint, options: rows[0].map((c) => c.t.trim()) });
        continue;
      }
      if (isVerticalTable(rows) || (rows.length >= 2 && rows[0].length >= 2)) {
        const isLink = /أربط|ربط|صِل|صلة/.test(prevQuestionHint || '') || /أربط|صِل/.test(stripTashkeel(rows[0][0] ? rows[0][0].t : ''));
        const body = rows.slice(1);
        if (isLink && rows[0].length === 2 && body.length >= 3 && body.every((r) => r[0].t && r[1].t && r[0].t.length <= 40 && r[1].t.length <= 40)) {
          blocks.push({
            kind: 'match-pairs', section,
            title: prevQuestionHint ? stripTashkeel(prevQuestionHint).slice(0, 70) : 'أربط كل عنصر بما يناسبه',
            text: prevQuestionHint || '',
            pairs: body.map((r) => ({ left: { text: r[0].t.trim() }, right: { text: r[1].t.trim() } }))
          });
          continue;
        }
        const firstRowAllFilled = rows[0].every((c) => cleanCell(c.t) !== '');
        const headerLooksTextual = firstRowAllFilled && rows[0].some((c) => /[^\d\s.,٪%]/.test(stripTashkeel(c.t)));
        const cols = headerLooksTextual ? rows[0].map((c) => cleanCell(c.t)) : [];
        const gridRows = (headerLooksTextual ? rows.slice(1) : rows).map((r) => r.map((c) => cleanCell(c.t)));
        const hasEmpty = gridRows.some((r) => r.some((c) => c === ''));
        if (!hasEmpty) {
          blocks.push({ kind: 'concept', section, title: SECTION_TITLES[section] || 'جدول', text: rows.map((r) => r.map((c) => c.t.trim()).filter(Boolean).join(' | ')).join('\n') });
          totalTables += 1;
          continue;
        }
        blocks.push({
          kind: 'table', section,
          title: (SECTION_TITLES[section] || '') + (prevQuestionHint ? `: ${stripTashkeel(prevQuestionHint).slice(0, 60)}` : ''),
          text: prevQuestionHint || '',
          columns: cols,
          rows: gridRows
        });
        totalTables += 1;
        if (prevQuestionHint && /عمودي|العمليات/.test(stripTashkeel(prevQuestionHint))) {
          blocks.push({ kind: 'question', section, title: 'الناتج أفقيًّا', text: 'أُكْتُبُ الناتجَ بعد إتمام العملية العمودية:', placeholder: 'الناتج =' });
        }
        continue;
      }
      blocks.push({ kind: 'concept', title: SECTION_TITLES[section] || lesson.title, text: rows.map((r) => r.map((c) => c.t.trim()).join(' | ')).join('\n') });
    }
  }

  if (!blocks.length) continue;
  lesson.studentBlocks = blocks;
  lesson.images = imagesMeta;
  if (imagesMeta.length) lesson.image = imagesMeta[0].src;
  else delete lesson.image;
  totalLessons += 1;
  totalBlocks += blocks.length;
}

fs.writeFileSync(unitsPath, JSON.stringify(units, null, 1) + '\n', 'utf8');

const py = `
from PIL import Image
import os
for d in [r"${FE}", r"${BE}", r"${REPO}"]:
    if not os.path.isdir(d): continue
    for f in os.listdir(d):
        if f.endswith('.png'):
            im = Image.open(os.path.join(d, f)).convert('RGB')
            im.save(os.path.join(d, f[:-4] + '.webp'), 'WEBP', quality=82)
`;
const pyFile = path.join(X, 'webp_y2v2.py');
fs.writeFileSync(pyFile, py, 'utf8');
try { execFileSync('python', [pyFile], { stdio: 'pipe' }); } catch { console.log('webp step failed'); }

const kinds = {};
for (const [, u] of Object.entries(units)) {
  if (!u || !u.studentBlocks) continue;
  for (const b of u.studentBlocks) kinds[b.kind] = (kinds[b.kind] || 0) + 1;
}
console.log('lessons rebuilt:', totalLessons, '| blocks:', totalBlocks, '| tables:', totalTables, '| images copied:', totalImgCopies);
console.log('kinds:', JSON.stringify(kinds));
