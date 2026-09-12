import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';

/**
 * رقمنة «كتاب الرياضيات — السنة السادسة (تونس)» الرسمي (docx) إلى دروس تفاعلية:
 * 61 سندًا × 5 محاور، لكل سند مراحل: أستحضر/أستكشف/أتدرّب/أوظّف/أعمل مكتسابي.
 * قواعد صارمة: لا إجابة داخل سؤال (المحلول ⇒ شرح)، الفراغ ⇒ خانة إجابة مطابقة،
 * الجداول تبقى جداولًا، العمليات العمودية شبكات خانات، «أتحقق» teacherOnly.
 * الاستخدام: node scripts/build-y6-rasmi-content.mjs <repoRoot> [docx]
 */
const ROOT = path.resolve(process.argv[2] || '.');
const DOCX = process.argv[3] || path.join(os.tmpdir(), 'y6rasmi.docx');
const X = process.env.TEMP || process.env.TMP;
const OUT = path.join(X, 'y6rasmi-build');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(DOCX, path.join(OUT, 'b.zip'));
execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force '${path.join(OUT, 'b.zip')}' '${path.join(OUT, 'u')}'`], { stdio: 'pipe' });

const xml = fs.readFileSync(path.join(OUT, 'u', 'word/document.xml'), 'utf8');
const body = xml.match(/<w:body>([\s\S]*)<\/w:body>/)[1];
const tokens = [...body.matchAll(/<w:p [^>]*>[\s\S]*?<\/w:p>|<w:p>[\s\S]*?<\/w:p>|<w:p\/>|<w:tbl>[\s\S]*?<\/w:tbl>/g)];

function decodeEnt(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
// نص فقرة/خلية مع إحياء صيغ OMML: الكسور a/b والأسس ^n
function richText(chunk) {
  let s = String(chunk);
  s = s.replace(/<\/m:num>/g, '<m:t>/</m:t>').replace(/<m:sup(\s[^>]*)?>/g, '<m:t>^</m:t><m:sup$1>');
  const parts = [...s.matchAll(/<(?:w|m):t(?:\s[^>]*)?>([^<]*)<\/(?:w|m):t>/g)].map((m) => decodeEnt(m[1]));
  return parts.join('').replace(/\s+/g, ' ').trim();
}

function paraTok(raw) {
  const style = (raw.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || 'default';
  return { type: 'p', style, t: richText(raw) };
}
function tblTok(raw) {
  const rows = [...raw.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map((r) =>
    [...r[0].matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)].map((c) => {
      const cellParas = [...c[0].matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((p) => richText(p[0])).filter(Boolean);
      return cellParas.join(' ');
    })
  );
  return { type: 'tbl', rows };
}

const STRIP_T = (s) => String(s).replace(/[\u064B-\u0652\u0670]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
const SECTION_BY_STAGE = {
  'أستحضر': 'recall', 'استحضر': 'recall',
  'أستكشف': 'explore', 'استكشف': 'explore',
  'أتدرب': 'practice', 'اتدرب': 'practice',
  'أوظف': 'apply', 'اوظف': 'apply',
  'أعمل مكتسابي': 'assessment', 'اعمل مكتسابي': 'assessment', 'أعمل مكتسباتي': 'assessment', 'اعمل مكتسباتي': 'assessment'
};
const STAGE_RE = /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\s]*((أستحضر|أستكشف|أتدر[ّ]?ب|أوظ[ّ]?ف|أعمل\s*مكتس[اب][ابي]+)([\s\S]{0,14}))$/u;
const FRONT = /^(سندات هذا المحور|مراحل التعلم|مرحبا بك|كتابك في|يتكون كتابك|الفهرس|مؤشر السندات|هيا نبدأ|ملاحظة: هذا الفهرس|نقر بالزر)/;
const CONCEPT_HEAD = /^(اعلم ان|اعلم أنَّ|أعلم|لاحظ ان|لاحظنا|خطط:|فأكتب|فأحصل|في الجمع|في الطرح|يمكننا|يمكنني|لجمع|لطرح|لضرب|لقسمة|نستعمل|القاعدة|بما ان|باستعمال|تذكر ان|نستنتج|الملاحظة|توضيح|مثال|امثلة|اليكم|نلاحظ)/;
const TEACHER_ONLY_HEAD = /^(اتحقق|أتحقق|التصحيح|الحل الصحيح|نموذج الإجابة|الجواب الصحيح|خطأ شائع)/;
const DRAW_VERB = /^(ارسم|أرسم|ابن|أبن|أُنشئ|انشئ|لون|لوّن|قص|ركب (شكل|مربع)|مثّل|مثل (الشكل|المخ)|اسحب|أتمم الشكل|كمل الرسم)/;
const TEXT_VERB = /^(عبر|عبّر|اكتب جملة|اكتب سطر|فسر|فسّر|علل|علّل|اشرح|وضعية مشكلة|تحدى|تحدي|ما رأيك|قدّر|اقترح|اكتَب ما|حرر)/;
const NUM_HEAD = /^(احسب|أنجز|انجز|أوجد|وجد|أكمل|اكمل|رتب|رتّب|حوّل|حول|قارن|صحح|قدّر|احسب mental)/;
const SOLVED_EQ = /=\s*[\d.,]+/;
const EX_NO = /^(\d{1,2})\s*[)\-.–]\s+/;
const LETTER_OPT = /([أبتجح])\s*\)\s*([^أبتجح()]{1,40}?)(?=\s+[أبتجح]\s*\)|\s*$)/g;

function isGridRow(cells) {
  const ne = cells.filter((c) => c.trim());
  if (!ne.length) return true;
  return ne.length >= 2 && ne.every((c) => c.replace(/\s/g, '').length <= 2 && /^[\d.,+\u2212\u00d7\u00f7:=\s-]+$/.test(c));
}

const out = { _meta: { subject: 'رياضيات', grade: 'السنة السادسة', status: 'digitized-official-rasmi', generatedFrom: 'كتاب_الرياضيات_السنة_السادسة_تونس.docx (فهرس رسمي 61 سندًا)', note: 'رقمنة حرفية عن الكتاب الرسمي — لا تُضاف إجابات من عندنا' } };

let cur = null;
let curSection = 'intro';
let axis = { num: 0, title: '' };
let pendingAxisHeading = null;
let stats = { lessons: 0, blocks: 0, tables: 0, questions: 0, teacherOnly: 0 };

function flushLesson() { if (cur && cur.studentBlocks.length) out[cur.id] = cur; }

const toks = tokens.map((tk) => (tk[0].startsWith('<w:tbl>') ? tblTok(tk[0]) : paraTok(tk[0])));
for (let i = 0; i < toks.length; i++) {
  const tk = toks[i];

  if (tk.type === 'p') {
    const t = tk.t;
    if (!t || FRONT.test(STRIP_T(t))) continue;
    if (tk.style === 'Heading1') {
      axis.num += 1;
      axis.title = t.replace(/\s*[（(]\s*السندات[^）)]*[)）]\s*$/, '').trim();
      continue;
    }
    const sm = t.match(/^السند\s*(\d{1,2})\s*$/);
    if (sm) {
      flushLesson();
      const num = Number(sm[1]);
      const titleP = toks[i + 1];
      const title = titleP && titleP.type === 'p' && titleP.style === 'Heading2' ? titleP.t : `السند ${num}`;
      if (titleP && titleP.type === 'p' && titleP.style === 'Heading2') i += 1;
      cur = { id: `r6s${String(num).padStart(2, '0')}`, unitId: `axis${axis.num || 1}`, num, title, domain: axis.title || 'رياضيات', period: null, axisId: axis.num || null, officialRef: { source: 'كتاب الرياضيات الرسمي س6', snd: num }, objective: '', studentBlocks: [] };
      curSection = 'intro';
      stats.lessons++;
      continue;
    }
    if (!cur) continue;
    const om = t.match(/^هدف السند[:：]\s*(.+)$/);
    if (om) { cur.objective = om[1].trim(); continue; }
    if (tk.style === 'Heading2') continue;
    pushPara(t);
    continue;
  }

  // جداول
  if (!cur) continue;
  const rows = tk.rows;
  if (rows.length === 1) {
    const cells = rows[0].map((c) => c.trim()).filter(Boolean);
    const one = cells.length === 1 ? cells[0] : null;
    if (one) {
      const stg = one.match(STAGE_RE);
      if (stg) {
        const key = STRIP_T(stg[2].replace(/[\s\u0640]+/g, ' ').trim());
        curSection = SECTION_BY_STAGE[key] || SECTION_BY_STAGE[key.replace(/ّ/g, '')] || curSection;
        continue;
      }
      pushPara(one);
      continue;
    }
  }
  const grid = rows.every((r) => isGridRow(r));
  if (grid && rows.length >= 3 && rows[0].length >= 4) {
    const clean = rows.map((r) => r.map((c) => c.trim().replace(/\u00a0/g, ' ')));
    cur.studentBlocks.push({ kind: 'table', section: curSection, title: 'العملية بالوضع العمودي', text: '', columns: [], rows: clean });
    stats.blocks++; stats.tables++;
    continue;
  }
  const header = rows[0];
  const hasHeader = header.filter(Boolean).length >= 2 && header.some((c) => c.replace(/\s/g, '').length > 2);
  cur.studentBlocks.push({
    kind: 'table', section: curSection, title: hasHeader ? header.filter(Boolean)[0] : 'جدول', text: '',
    columns: hasHeader ? header.map((c) => c.trim()) : [],
    rows: (hasHeader ? rows.slice(1) : rows).map((r) => r.map((c) => c.trim()))
  });
  stats.blocks++; stats.tables++;
}
flushLesson();

function pushPara(t) {
  const st = STRIP_T(t);
  if (STAGE_RE.test(t)) {
    const key = st.replace(/[\s\u0640]+/g, ' ').trim();
    curSection = SECTION_BY_STAGE[key] || curSection;
    return;
  }
  if (st.length < 2) return;
  // سطر كشف/تصحيح يُظهر نتيجة عددية ⇒ معلم (لا يُرسل للتلميذ)؛ مجرد «أتحقق بالحساب» يبقى درسًا
  const ANSWER_SHOWN = (/اتحقق/.test(st) || /^(التصحيح|الحل الصحيح|نموذج الاجابة)/.test(st)) && /=\s*[\d.,]+/.test(st);
  if (TEACHER_ONLY_HEAD.test(st) || ANSWER_SHOWN) {
    cur.studentBlocks.push({ kind: 'concept', section: curSection, title: '', text: t, teacherOnly: true });
    stats.blocks++; stats.teacherOnly++;
    return;
  }
  const exM = t.match(EX_NO);
  const exText = exM ? t.replace(EX_NO, '') : t;
  const exSt = STRIP_T(exText);
  if (exM) {
    if (/^اختر/.test(exSt)) {
      const opts = [...t.matchAll(LETTER_OPT)].map((m) => m[2].trim()).filter(Boolean).slice(0, 4);
      cur.studentBlocks.push({ kind: opts.length >= 2 ? 'question' : 'concept', section: curSection, title: '', text: exText.trim(), options: opts.length >= 2 ? opts : undefined });
      stats.blocks++; if (opts.length >= 2) stats.questions++;
      return;
    }
    if (DRAW_VERB.test(exSt)) { cur.studentBlocks.push({ kind: 'drawing', section: curSection, title: '', text: exText.trim() }); stats.blocks++; return; }
    if (TEXT_VERB.test(exSt)) { cur.studentBlocks.push({ kind: 'textarea', section: curSection, title: '', text: exText.trim() }); stats.blocks++; return; }
    const single = exSt.match(/^(احسب|أنجز|انجز|أوجد)\s*[:：]?\s*([\d.,+−×÷:()^ -]{2,40})$/);
    if (single && /\d\s*[+−×÷:]\s*\d/.test(single[2])) {
      cur.studentBlocks.push({ kind: 'math-input', section: curSection, title: '', text: exText.trim() });
      stats.blocks++; stats.questions++;
      return;
    }
    if (SOLVED_EQ.test(exSt) && !/[…_.]{2,}|ه؟|\?/.test(exSt)) {
      cur.studentBlocks.push({ kind: 'concept', section: curSection, title: '', text: t });
      stats.blocks++; return;
    }
    cur.studentBlocks.push({ kind: 'question', section: curSection, title: '', text: exText.trim() });
    stats.blocks++; stats.questions++;
    return;
  }
  if (CONCEPT_HEAD.test(st) || (SOLVED_EQ.test(st) && st.length > 16)) {
    cur.studentBlocks.push({ kind: 'concept', section: curSection, title: '', text: t });
    stats.blocks++; return;
  }
  if (/^(أتذكر|اتذكر|تذكير|معلومة|هل تعلم)/.test(st)) {
    cur.studentBlocks.push({ kind: 'concept', section: curSection, title: 'أتذكّر', text: t.replace(/^[\s\p{Emoji_Presentation}\u{FE0F}]+/u, '') });
    stats.blocks++; return;
  }
  if (/[؟?]$/.test(st) || /[…_.]{2,}|٠\.\.\.|_{2,}/.test(t)) {
    if (DRAW_VERB.test(st)) { cur.studentBlocks.push({ kind: 'drawing', section: curSection, title: '', text: t }); stats.blocks++; return; }
    cur.studentBlocks.push({ kind: 'question', section: curSection, title: '', text: t });
    stats.blocks++; stats.questions++; return;
  }
  cur.studentBlocks.push({ kind: 'concept', section: curSection, title: '', text: t });
  stats.blocks++;
}

const dest = path.join(ROOT, 'backend', 'curriculum', 'year6', 'rasmi-math6-lessons.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 1), 'utf8');
console.log(`rasmi lessons: ${Object.keys(out).length - 1} | blocks=${stats.blocks} tables=${stats.tables} questions=${stats.questions} teacherOnly=${stats.teacherOnly}`);
