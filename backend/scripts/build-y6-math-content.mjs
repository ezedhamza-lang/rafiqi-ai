import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

/**
 * v2 — بناء محتوى كتاب الرياضيات س6 من docx المرجعي بقواعد تربوية صارمة:
 *  1) لا إجابة داخل السؤال: المعادلة المحلولة (= نتيجة بلا فراغ) ⇒ شرح concept وليس سؤالًا.
 *  2) نوع مكان الإجابة يطابق نوع السؤال:
 *     «أكمل الفراغ» ⇒ خانة عدد | «بالوضع العمودي» ⇒ شبكة عموديات | «أكمل الجدول» ⇒ جدول فعلي
 *     «اختر» ⇒ خيارات | «ارسم/أبنِ/مثّل» ⇒ مساحة رسم | «أعبّر/أكتب جملة» ⇒ سطر كتابة.
 *  3) عناوين الأنشطة (✏️ أطبق / 💡 ألاحظ / 📘 أتذكر) ⇒ عناوين أقسام لا محتوى.
 *  4) الجداول تبقى جداولًا (الخلايا الفارغة = خانة كتابة).
 * الاستخدام: node scripts/build-y6-math-content.mjs <repoRoot> [docx]
 */
const ROOT = path.resolve(process.argv[2] || '.');
const DOCX = process.argv[3];
const X = process.env.TEMP || process.env.TMP;
const OUT = path.join(X, 'y6mx');

if (DOCX && fs.existsSync(DOCX)) {
  fs.copyFileSync(DOCX, path.join(X, 'y6m.zip'));
  execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force '${path.join(X, 'y6m.zip')}' '${OUT}'`], { stdio: 'pipe' });
}

const xml = fs.readFileSync(path.join(OUT, 'word/document.xml'), 'utf8');
const rels = fs.readFileSync(path.join(OUT, 'word/_rels/document.xml.rels'), 'utf8');
const relMap = {};
for (const m of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) relMap[m[1]] = m[2];
const MEDIA = path.join(OUT, 'word/media');
const body = xml.match(/<w:body>([\s\S]*)<\/w:body>/)[1];
const tokens = [...body.matchAll(/<w:p [^>]*>[\s\S]*?<\/w:p>|<w:p>[\s\S]*?<\/w:p>|<w:p\/>|<w:tbl>[\s\S]*?<\/w:tbl>/g)];

function decode(t) {
  return t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, ' ').trim();
}
function paraItem(p) {
  const style = (p.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || '';
  const texts = decode([...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''));
  const imgs = [...p.matchAll(/r:embed="([^"]+)"/g)].map((m) => (relMap[m[1]] || m[1]).replace('media/', ''));
  return { type: 'p', style, t: texts, imgs };
}
function tableItem(tbl) {
  const rows = [...tbl.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>|<w:tr>[\s\S]*?<\/w:tr>/g)].map((r) =>
    [...r[0].matchAll(/<w:tc[ >][\s\S]*?<\/w:tc>|<w:tc>[\s\S]*?<\/w:tc>/g)].map((c) => {
      const texts = decode([...c[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''));
      const imgs = [...c[0].matchAll(/r:embed="([^"]+)"/g)].map((m) => (relMap[m[1]] || m[1]).replace('media/', ''));
      return { t: texts, imgs };
    })
  );
  return { type: 'tbl', rows };
}

const PERIOD_WORDS = { 'الأولى': 1, 'الثانية': 2, 'الثالثة': 3, 'الرابعة': 4, 'الخامسة': 5 };
const lessons = [];
let cur = null;
let period = 1;
for (const tk of tokens) {
  const raw = tk[0];
  if (raw.startsWith('<w:tbl>')) { if (cur) cur.items.push(tableItem(raw)); continue; }
  const it = paraItem(raw);
  const pm = it.t.match(/الفترة\s+(الأولى|الثانية|الثالثة|الرابعة|الخامسة)/);
  if (it.style === 'Titre1' && pm) { period = PERIOD_WORDS[pm[1]] || period; continue; }
  const dm = it.style === 'Titre2' && it.t.match(/^الدرس\s*(\d+)\s*[:：]\s*(.+)$/);
  if (dm) { cur = { num: Number(dm[1]), period, title: dm[2].trim(), items: [] }; lessons.push(cur); continue; }
  if (cur && (it.t || it.imgs.length)) cur.items.push({ ...it, sub: it.style === 'Titre3' });
}

const unitsPath = path.join(ROOT, 'backend/curriculum/year6/math-lessons.json');
const units = JSON.parse(fs.readFileSync(unitsPath, 'utf8'));
const FE = path.join(ROOT, 'frontend/public/curriculum/y6/math');
const BE = path.join(ROOT, 'backend/uploads/curriculum/y6/math');
const REPO = path.join(ROOT, 'backend/curriculum/img/y6/math');
for (const d of [FE, BE, REPO]) {
  if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
}

const BLANK = /(\.\.\.+|…+|ـ{2,}|__+)/;
const SOLVED_EQ = /=\s*[\d٠-٩]+([.,][\d٠-٩]+)?\s*($|[.،؛)كلمةمباشرًا])|=\s*[\d٠-٩]+([.,][\d٠-٩]+)?\s+(مي|دج|كغ|غ|ل|ملم|سم|م|كم|°|ساعة|س|دقيقة|ق|نقطة)/;
function stripTashkeel(s) { return String(s).replace(/[\u064B-\u0652\u0670\u0640]/g, ''); }
function norm(s) { return stripTashkeel(String(s || '')).replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[،؛:.!?ـ()\s]+/g, ' ').trim().toLowerCase(); }
function cleanCell(t) {
  const s = String(t || '').trim();
  if (!s || s === '.' || s === '·' || BLANK.test(s) && s.length <= 4) return '';
  return s;
}
function toWestern(s) { return String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)); }

const LETTER_PREFIX = /^[أبتثجحخدذرزس]\s*\)\s*/;
const VERB_DRAW = /^(ارسم|ابن|ابني|مثل|قطع|شبكة|دائرة|زاوية|محور|رسم)/;
const VERB_TABLE = /^(اكمل|أكمل).*(الجدول|جدول)|جدول/;
const VERB_CHOOSE = /^(اختر|اختار)/;
const VERB_VERTICAL = /(الوضع العمودي|عموديا|عموديا|انصب|أُنصُب|بالعمود)/;
const VERB_TEXT = /^(عبر|عَبِّر|اكتب جملة|فسر|قد ر|قدر|علل|ما)/;
const VERB_NUMERIC = /^(احسب|أنجز|انجز|اكمل|أكمل|أوجد|وجد|حسب|اكتب العدد|أكمل العملية)/;

function extractPairs(text) {
  const t = toWestern(stripTashkeel(text));
  const re = /([\d.,]+)\s*([+\-−+×÷])\s*([\d.,]+)/g;
  const pairs = [];
  let m;
  while ((m = re.exec(t)) && pairs.length < 4) {
    const a = m[1].replace(/[.,]$/, '');
    const b = m[3].replace(/[.,]$/, '');
    if (a && b && !/^\d+[.,]?\d*$/.test('') ) pairs.push([a, m[2] === '-' || m[2] === '−' ? '-' : m[2], b]);
  }
  return pairs;
}

let built = 0;
let blocksTotal = 0;
let tablesTotal = 0;
let imgTotal = 0;
let questionsTotal = 0;

for (const L of lessons) {
  const id = `y6m${String(L.num).padStart(2, '0')}`;
  const lesson = units[id];
  if (!lesson) continue;
  const blocks = [];
  const imagesMeta = [];
  let imgSeq = 0;
  let lastText = '';
  let subTitle = '';
  let pendingHint = '';
  let prevNorm = '';

  const copyImg = (im) => {
    const srcFile = path.join(MEDIA, im);
    if (!fs.existsSync(srcFile)) return null;
    imgSeq += 1;
    imgTotal += 1;
    const name = `${id}-${imgSeq}`;
    for (const d of [FE, BE, REPO]) fs.copyFileSync(srcFile, path.join(d, `${name}.png`));
    const imageId = `img-${id}-${imgSeq}`;
    const caption = lastText ? stripTashkeel(lastText).slice(0, 150) : (subTitle || lesson.title);
    imagesMeta.push({ imageId, src: `/curriculum/y6/math/${name}.png`, caption });
    return { imageId, src: `/curriculum/y6/math/${name}.png`, caption };
  };
  const pushImg = (im) => {
    const c = copyImg(im);
    if (c) blocks.push({ kind: 'concept', title: subTitle || lesson.title, image: c.src, imageId: c.imageId, alt: c.caption });
  };
  const pushQuestion = (text, plain) => {
    if (/^(الإجابة|الجواب|الحل|الباحث)\s*[:：]/.test(String(text).trim())) {
      blocks.push({ kind: 'concept', teacherOnly: true, title: '', text });
      return;
    }
    questionsTotal += 1;
    if (VERB_VERTICAL.test(plain)) {
      const pairs = extractPairs(text);
      if (pairs.length) {
        for (const [a, op, b] of pairs) {
          blocks.push({
            kind: 'table',
            title: `${subTitle ? subTitle + ' — ' : ''}أنجز بالوضع العمودي`,
            text: `${a} ${op === '-' ? '−' : op} ${b} = ....`,
            columns: [],
            rows: [['', a], [op === '-' ? '−' : op, b], ['', '']]
          });
          tablesTotal += 1;
        }
        return;
      }
    }
    if (VERB_TABLE.test(plain)) { pendingHint = text; return; }
    if (VERB_CHOOSE.test(plain)) {
      const after = text.split(/[:：]/).slice(1).join(' ');
      const opts = after.split(/[،,]/).map((s) => s.trim()).filter((s) => s && s.length <= 24).slice(0, 5);
      if (opts.length >= 2) { blocks.push({ kind: 'question', title: subTitle || 'اختر الإجابة الصحيحة', text: text.replace(/[:：].*$/, ''), options: opts }); return; }
      pendingHint = text;
      return;
    }
    if (VERB_DRAW.test(plain)) { blocks.push({ kind: 'drawing', title: subTitle || 'أرسم', text }); return; }
    if (VERB_TEXT.test(plain)) { blocks.push({ kind: 'textarea', title: subTitle || 'أُعبّر', text, rows: 2 }); return; }
    const blanks = (toWestern(plain).match(/\.\.\.+/g) || []).length;
    if (VERB_NUMERIC.test(plain) && blanks <= 1) {
      blocks.push({ kind: 'math-input', title: subTitle || 'أُكمل', text, placeholder: 'أُكْتُبُ إجابتي هنا' });
      return;
    }
    blocks.push({ kind: 'question', title: subTitle || 'تمرين', text, placeholder: 'أُكْتُبُ إجابتي هنا' });
  };

  for (const it of L.items) {
    if (it.type === 'p') {
      for (const im of it.imgs || []) pushImg(im);
      const raw = String(it.t || '').replace(/[\u200b-\u200f]/g, '').trim();
      if (!raw || /^\d{1,2}$/.test(raw)) continue;
      const emojiLabel = raw.match(/^[💡✏️📘🎯⚠️🧠📐🔷🔶⭐✨🖊✍️️]+\s*(.+)$/u);
      if (emojiLabel && emojiLabel[1].length <= 24) { subTitle = stripTashkeel(emojiLabel[1]).slice(0, 40); continue; }
      if (it.sub) { subTitle = stripTashkeel(raw).slice(0, 70); continue; }
      let text = raw.replace(/^\d+\.\s*/, '').replace(LETTER_PREFIX, '').replace(/^[•▪◦·]+\s*/, '').trim();
      const emojiInText = text.match(/^[💡✏️📘🎯⚠️🧠📐🔷🔶⭐✨🖊✍️️]+\s*([\u0600-\u06FF]{2,12})\s+/u);
      if (emojiInText) { subTitle = stripTashkeel(emojiInText[1]); text = text.slice(emojiInText[0].length); }
      const plain = norm(text);
      lastText = text;
      const hasBlank = BLANK.test(text);
      const solved = !hasBlank && /=\s*[\d٠-٩]/.test(toWestern(stripTashkeel(text)));
      const qPos = text.search(/[؟?]/);
      const answerShown = qPos >= 0 && /=\s*[\d٠-٩]/.test(text.slice(qPos + 1)) && !hasBlank;
      const ANSWER_PREFIX = /^(الاجابة|الجواب|الحل|الباحث|ف الاجابة|النتيجة الصحيحة|أتحقق|اتحقق|تحقق|نعم|لا،|بلى|تحليل)/;
      const isDirective = /^(احسب|أنجز|انجز|اكمل|أكمل|أوجد|وجد|اختر|اختار|ارسم|أرسم|ابن|ابني|أبنِ|عبر|عَبِّر|أتحقق|حقق|مثل|نص|وزع|املأ|ملأ|صحح|صوب|قارن|رتب|رتّب|حول|حوّل|أكتب|اكتب|أعطي|اعطي|أكمل|كم|أي|أين|هل|ماذا|متى|من|ما )/.test(plain) || /[؟?]$/.test(text.trimEnd()) || VERB_VERTICAL.test(plain);
      const nrm = norm(text);
      if (nrm && nrm === prevNorm) continue;
      prevNorm = nrm || prevNorm;
      const ANS_MARK = /(الإجابة|الجواب|الحل|الباحث)\s*[:：]|⟵|←/;
      const midAnswer = text.match(/^(.{6,}?)\s+((?:الإجابة|الجواب|الحل|الباحث)\s*[:：].{4,})$/);
      if (midAnswer && !BLANK.test(midAnswer[2])) {
        const qPart = midAnswer[1].trim();
        if (!(/\s=\s*[\d٠-٩]/.test(toWestern(stripTashkeel(qPart)))) || BLANK.test(qPart)) pushQuestion(qPart, norm(qPart));
        else blocks.push({ kind: 'concept', title: subTitle || '', text: qPart });
        blocks.push({ kind: 'concept', teacherOnly: true, title: '', text: midAnswer[2].trim() });
        continue;
      }
      const arrowSplit = text.match(/^(.{6,}?)\s*[⟵←]\s+(.{4,})$/);
      if (arrowSplit) {
        const qPart = arrowSplit[1].trim();
        const aPart = arrowSplit[2].trim();
        const qHasBlank = BLANK.test(qPart);
        if (!(/\s=\s*[\d٠-٩]/.test(toWestern(stripTashkeel(qPart)))) && !qHasBlank) pushQuestion(qPart, norm(qPart));
        else if (qHasBlank) pushQuestion(qPart, norm(qPart));
        else blocks.push({ kind: 'concept', title: subTitle || '', text: qPart });
        blocks.push({ kind: 'concept', teacherOnly: true, title: '', text: aPart });
        continue;
      }
      const dashSplit = text.match(/^(.{8,}؟?)\s*[—–]\s+(.{6,})$/);
      if (dashSplit && (ANS_MARK.test(dashSplit[2]) || /=\s*[\d٠-٩]/.test(toWestern(stripTashkeel(dashSplit[2]))) || /\d\s*[><=]/.test(toWestern(dashSplit[2])) || ANSWER_PREFIX.test(norm(dashSplit[2])) || /لأن/.test(dashSplit[2]))) {
        const qPart = dashSplit[1].trim();
        const aPart = dashSplit[2].trim();
        const qHasBlank = BLANK.test(qPart);
        const qSolved = /=\s*[\d٠-٩]/.test(toWestern(stripTashkeel(qPart))) && !qHasBlank;
        if (ANSWER_PREFIX.test(norm(qPart))) blocks.push({ kind: 'concept', teacherOnly: true, title: '', text: qPart + ' — ' + aPart });
        else if (!qSolved) pushQuestion(qPart, norm(qPart));
        blocks.push({ kind: 'concept', teacherOnly: true, title: '', text: aPart });
        continue;
      }
      if ((solved || answerShown) && !hasBlank) {
        blocks.push({ kind: 'concept', teacherOnly: ANSWER_PREFIX.test(plain) || /(الإجابة|الجواب)\s*[:：]/.test(text), title: subTitle || '', text });
      } else if (isDirective || hasBlank) {
        const paren = text.match(/^(.{6,}?)\s*[(（]((?:مثال|توضيح)[^)）]{6,})[)）]\s*$/);
        if (paren && (/لأن|=\s*[\d٠-٩]/.test(paren[2]))) {
          pushQuestion(paren[1].trim(), norm(paren[1]));
          blocks.push({ kind: 'concept', teacherOnly: true, title: '', text: paren[2] });
        } else {
          pushQuestion(text, plain);
        }
      } else {
        blocks.push({ kind: 'concept', teacherOnly: ANSWER_PREFIX.test(plain) || ANS_MARK.test(text), title: subTitle || '', text });
      }
      continue;
    }
    if (it.type === 'tbl') {
      const rows = it.rows;
      const cellImgs = [];
      for (const r of rows) for (const c of r) for (const im of c.imgs || []) cellImgs.push(im);
      for (const im of cellImgs) pushImg(im);
      if (rows.length === 1 && rows[0].length === 1) {
        blocks.push({ kind: 'concept', title: subTitle || '', text: rows[0][0].t });
        continue;
      }
      const firstRowAllFilled = rows[0].every((c) => cleanCell(c.t) !== '');
      const headerTextual = firstRowAllFilled && rows[0].some((c) => /[^\d\s.,٪%]/.test(stripTashkeel(c.t)));
      const cols = headerTextual ? rows[0].map((c) => cleanCell(c.t)) : [];
      const gridRows = (headerTextual ? rows.slice(1) : rows).map((r) => r.map((c) => cleanCell(c.t)));
      blocks.push({
        kind: 'table',
        title: pendingHint ? norm(pendingHint) && stripTashkeel(pendingHint).slice(0, 70) : (subTitle || 'جدول'),
        text: pendingHint || '',
        columns: cols,
        rows: gridRows
      });
      tablesTotal += 1;
      pendingHint = '';
    }
  }

  if (!blocks.length) continue;
  lesson.studentBlocks = blocks;
  lesson.images = imagesMeta;
  if (imagesMeta.length) lesson.image = imagesMeta[0].src;
  built += 1;
  blocksTotal += blocks.length;
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
const pyFile = path.join(X, 'webp_y6v2.py');
fs.writeFileSync(pyFile, py, 'utf8');
try { execFileSync('python', [pyFile], { stdio: 'pipe' }); } catch { console.log('webp step failed'); }

const kinds = {};
for (const [, u] of Object.entries(units)) {
  if (!u || !u.studentBlocks) continue;
  for (const b of u.studentBlocks) kinds[b.kind] = (kinds[b.kind] || 0) + 1;
}
console.log('built:', built, '| blocks:', blocksTotal, '| tables:', tablesTotal, '| questions-ish:', questionsTotal, '| images:', imgTotal);
console.log('kinds:', JSON.stringify(kinds));
