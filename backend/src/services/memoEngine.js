import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeArabic } from './curriculumService.js';
import { memoMentalItems, memoPrereqItems } from './mentalMath.js';

/**
 * محرك المذكرة البيداغوجية — وفق «مواصفات تنفيذ المذكرة البيداغوجية في منصة رفيقي».
 * البنية الإجبارية: رأس (المادة/السنة/الفترة/اليوم) + صناديق الكفايات + أهداف الحصة +
 * المضمون + «التمشي البيداغوجي» + جدول RTL بخمسة أعمدة
 * (المراحل | نشاط الأستاذ | نشاط المتعلم | المهارة المستهدفة | الوسائل) + خاتمة
 * (نسبة نجاح الدرس + القرار البيداغوجي). كل المحتوى يُستخرج من الكتاب نفسه
 * (studentBlocks + skills-map الرسمي) ولا يُخترع شيء.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURRICULUM_DIR = path.join(__dirname, '../../curriculum');

const readJson = (abs) => {
  try { return fs.existsSync(abs) ? JSON.parse(fs.readFileSync(abs, 'utf8')) : null; } catch { return null; }
};
const skillsMapCache = {};
function loadSkillsMap(gradeId, subjectId) {
  const code = String(subjectId || '').toLowerCase();
  const file = (code === 'math' || code === 'math2') ? 'skills-map-math.json'
    : (code === 'science') ? 'skills-map-science.json'
      : (code === 'production') ? 'skills-map-production.json'
        : 'skills-map-anisi.json';
  const key = `${gradeId}/${file}`;
  if (!(key in skillsMapCache)) skillsMapCache[key] = readJson(path.join(CURRICULUM_DIR, gradeId, file));
  return skillsMapCache[key];
}

const SEC_KEYS = [
  ['اختبر', 'warmup'], ['استكشف', 'explore'], ['اتذكر', 'recall'], ['اتدرب', 'practice'],
  ['وظف', 'apply'], ['تحد', 'challenge'], ['قوم', 'assessment'], ['تقييم', 'assessment'],
  ['خطوات', 'steps'], ['وضعيت', 'situation']
];
function blockSection(block) {
  if (block.section) return block.section;
  const hay = normalizeArabic(`${block.title || ''} ${block.text || ''}`);
  for (const [k, v] of SEC_KEYS) if (hay.includes(k)) return v;
  return 'intro';
}

// تصنيف دلالي للدور اعتمادًا على محتوى الكتلة نفسه (لا يعتمد على أيقونات المصدر)
function blockRole(block, idx, total) {
  const b = block || {};
  const t = normalizeArabic(`${b.text || ''} ${b.title || ''}`);
  if (/ذهن|سريعا|سريع/.test(t) && (b.kind === 'question' || b.kind === 'math-input')) return 'warmup';
  if (/اتذكر/.test(t)) return 'recall';
  if (b.kind === 'table') return 'practice';
  if (b.kind === 'question') {
    if (/^(انجز|اكمل|اكتب|احسب|رتب|ضع|مثل|ارسم|نصب|وزع|ملء)/.test(t) || /العمليات|الجدول|عمود|افقي|رأسيا/.test(t)) return 'practice';
    const isQuestionWord = /(كم|اين|اي|ايهما|هل|ماذا|اي عدد|اى|أين)/.test(t) || t.includes('؟');
    if (isQuestionWord && idx <= total * 0.45) return 'explore';
    if (isQuestionWord && idx > total * 0.45) return 'apply';
    return 'practice';
  }
  // concept
  if (/^تحد|تحدي/.test(t)) return 'apply';
  if (/حاذي|بذلك|القاعدة|الاستنتاج|نستنتج|نحصل/.test(t)) return 'recall';
  if (/وضع|مشكل|اراد|اشترى|باع|جمع|نفق|معرض|حديقة|مكتبة|قطف|اقتطع|انتج|وفر/.test(t)) return idx <= total * 0.5 ? 'explore' : 'apply';
  return 'misc';
}

function classifyStages(lesson) {
  const blocks = lesson.blocks || [];
  const total = blocks.length;
  const roles = { warmup: [], explore: [], recall: [], practice: [], apply: [] };
  blocks.forEach((b, i) => {
    if (isPlaceholderBlock(b)) return;
    if (b && b.teacherOnly) return;
    let r = blockRole(b, i, total);
    if (r === 'misc') {
      const docSec = b.section ? blockSection(b) : 'intro';
      r = { recall: 'recall', practice: 'practice', apply: 'apply', challenge: 'apply', assessment: 'apply', explore: 'explore', warmup: 'warmup' }[docSec] || 'explore';
    }
    (roles[r] = roles[r] || []).push({ block: b, idx: i });
  });
  return roles;
}
function groupBySection(lesson) {
  const g = {};
  for (const b of lesson.blocks || []) {
    const s = blockSection(b);
    (g[s] = g[s] || []).push(b);
  }
  return g;
}

const STAGE_META = [
  { re: /ذهن/, skill: 'الحساب الذهني وسرعة الإنجاز', tools: ['الألواح'] },
  { re: /استحضار|مكتسبات/, skill: 'تعهّد المكتسبات المستوجبة', tools: ['الألواح', 'السبورة'] },
  { re: /تمهيد|مكتسبات|تهيئة|انطلاق/, skill: 'استرجاع المكتسبات والحساب الذهني', tools: ['الألواح'] },
  { re: /استكشاف|استقر|إشكالي|تصور|فرض|وضعية/, skill: 'حل المشكلات وتنظيم كيفية التعلّم', tools: ['السبورة', 'كراسات المحاولات'] },
  { re: /استنتاج|بناء|تثبيت|مساعد|قاع/, skill: 'التفاوض والحوار', tools: ['السبورة', 'بطاقات'] },
  { re: /تدر|تمرين|ممارس/, skill: 'نقل أثر التعلّم', tools: ['الألواح', 'كراسات المحاولات'] },
  { re: /توظيف|ادماج|إدماج|نقل/, skill: 'التشارك ونقل أثر التعلّم', tools: ['الألواح', 'السبورة', 'كراسات المحاولات'] },
  { re: /تقو|تقييم|ذات/, skill: 'تقدير الذات', tools: ['كراسات المحاولات'] }
];
function metaFor(stageName) {
  const hay = normalizeArabic(stageName || '');
  return STAGE_META.find((m) => m.re.test(hay)) || { skill: 'بناء المعرفة وتثبيتها', tools: ['السبورة', 'كتاب التلميذ'] };
}

function stripT(x) { return String(x).replace(/[\u064B-\u0652\u0670\u0640]/g, ''); }
function toW(x) { return stripT(x).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)); }
function itemText(b) {
  const t = String(b.text || b.title || '').trim();
  if (!t) return '';
  return t.length > 260 ? t.slice(0, 257) + '.' : t;
}

const PLACEHOLDER_TXT = /التحضير|سيظهر هنا|واصل التقدم|لم ينشا/;
function isPlaceholderBlock(b) {
  if (!b || typeof b !== 'object') return true;
  return PLACEHOLDER_TXT.test(normalizeArabic(`${b.text || ''} ${b.title || ''}`));
}

function isLabelNoise(t) {
  const n = normalizeArabic(t).replace(/[\s\d().,+]+/g, '');
  return /^(اتدرب|اتحدى|اطبق|اراجع|افكر|احكم|اقوم|اتحقق|وضعيت|وضعيه|تذكر|استنتج|لاحظ)/.test(n) && n.length <= 16;
}

const LABEL_RE = /^(ألاحظ|أستنتج|استنتج|أتذكر|تذكر|أكتب|اكتب|أتحدّى نفسي|أتحدى نفسي|أُقيّم نفسي|اقوم نفسي|وضعية إدماجية|وضعية|أُطبّق|اطبق|أُراجع)(?=[^\s:：،.])/u;
const EMOJI_RE = /^[💡✏️📘🎯⚠️🧠📐🔷🔶⭐✨🖊✍️️]+\s*/u;
function cleanMemoText(t) {
  return String(t || '')
    .replace(EMOJI_RE, '')
    .replace(/\*\*/g, '')
    .replace(LABEL_RE, '$1 :')
    .replace(/\s+/g, ' ')
    .trim();
}

function domainFields(lesson) {
  const d = normalizeArabic(`${lesson.domain || ''} ${lesson.title || ''}`);
  const m = RANGE_RE.exec(toWestern(lesson.title));
  const to = m ? m[2] : '';
  if (/عشري|كسري/.test(d)) return { component: 'توظيف الأعداد الكسرية والعشرية والعمليات عليها', distinctive: 'التعرّف على الأعداد الكسرية العشرية وكتابتها بمنازلها وتحويلها وإنجاز العمليات عليها.' };
  if (/قياس/.test(d)) return { component: 'استعمال وحدات القيس وتحويلها', distinctive: 'التصرّف في وحدات القياس (الطول والكتلة والسعة) وتحويلها وحل وضعيات من الحياة.' };
  if (/هندس|شكل|زاوية|استقام|متعامد|متوازي/.test(d)) return { component: 'بناء الأشكال واستعمال أدوات الهندسة', distinctive: 'تعرّف الأشكال وخصائصها والبناء بمسطرة والترجية أو المركّب.' };
  if (/احتمال|بيانات|جدول|مخطط/.test(d)) return { component: 'معالجة البيانات وقراءة الجداول والمخططات', distinctive: 'قراءة البيانات وتنظيمها واستخراج النتائج واتخاذ القرار.' };
  if (/نقود|ثمن|اشاري|تسوق/.test(d)) return { component: 'توظيف العمليات في الحساب النقدي', distinctive: 'حساب الأثمان والبواقي وتقييم المعروضات.' };
  if (/طبيعي|ملايين|مليارات/.test(d)) return { component: 'التعرف على بنية الأعداد وترقيم المنازل', distinctive: 'قراءة الأعداد الطبيعية الكبيرة وكتابتها وترتيبها ومقارنتها وتقريبها واستعمالها في وضعيات.' };
  return { component: 'حلّ وضعيات مشكلة دالّة بتوظيف العمليات على الأعداد', distinctive: to ? `التصرّف في الأعداد من 0 إلى ${to} قراءةً وكتابةً وتمثيلًا ومقارنةً وترتيبًا وتفكيكًا وتجميعًا.` : '' };
}

const TEACHER_TPL = {
  warmup: (items, pages) => ({
    teacher: 'يطرح سلسلة عمليات حساب ذهني مرتبطة بتقنية الدرس ويدعوهم إلى إنجازها على الألواح:\n' + items.map((i) => '• ' + i).join('\n') + '\n• ويدعوهم إلى بيان طريقة الحساب.',
    learner: '• يُجري الحساب الذهني سريعًا على اللوح ويبيّن طريقته.'
  }),
  recall: (items, pages) => ({
    teacher: `ينظّم النقاش ويدعوهم إلى مقارنة النتائج واستنتاج القاعدة${pages ? ` (كتاب التلميذ ص. ${pages})` : ''}:\n${items.map((i) => '• ' + i).join('\n')}\n• يثبّت القاعدة على السبورة ويطلب تدوينها.`,
    learner: '• يقارن نتائج الحالات ويبرّر.\n• يستنتج القاعدة وينقلها إلى كراسه.'
  }),
  warmup: (items, pages) => ({
    teacher: `يدعوهم إلى استرجاع المكتسبات السابقة وحساب ما يلي${pages ? ` (كتاب التلميذ ص. ${pages})` : ''}:\n${items.map((i) => '• ' + i).join('\n')}\n• ويدعوهم إلى تفسير طريقة الحساب.`,
    learner: `• يحسب ذهنيًّا ويسترجع مكتسباته ويوضّح طريقته.\n${items.map(() => '').join('') || ''}• يحدّد الخطوات ويصحّح الأخطاء على الألواح.`
  }),
  explore: (items, pages) => ({
    teacher: `يقترح الوضعية التالية${pages ? ` (ص. ${pages})` : ''} ويدعوهم إلى فهمها وتحديد المعطيات والمطلوب:\n${items.map((i) => '• ' + i).join('\n')}\n• يلاحظ الإنتاجات ويدعو إلى المقارنة والمناقشة.`,
    learner: '• يفهم الوضعية ويحدّد المعطيات والمطلوب.\n• يجرّب حلًّا وي ناقش مع زملائه ويدوّن النتيجة.'
  }),
  recall: (items) => ({
    teacher: `ينظّم النقاش حول نتائج الأنشطة ويدعوهم إلى صياغة الاستنتاج:\n${items.map((i) => '• ' + i).join('\n')}`,
    learner: '• يشارك في الحوار ويصوغ القاعدة بكلماته ثم يحفظها.'
  }),
  practice: (items, pages, tableCount) => ({
    teacher: `يدعوهم إلى إنجاز التمارين التالية${pages ? ` (ص. ${pages})` : ''}:\n${items.map((i) => '• ' + i).join('\n')}${tableCount ? `\n• إنجاز ${tableCount} عملية/جدول العمود مع محاذاة المنازل.` : ''}\n• يتفقّد الكراسات ويوجّه ويصحّح.`,
    learner: `• يُنجز العمليات عموديًّا مع احترام محاذاة العشرات والآحاد${tableCount ? ' (يشمل الجداول)' : ''}.\n• يصحّح أخطاءه بدفتر المحاولات.`
  }),
  apply: (items, pages) => ({
    teacher: `يدعوهم إلى توظيف المكتسبات في وضعيات إدماجية${pages ? ` (ص. ${pages})` : ''}:\n${items.map((i) => '• ' + i).join('\n')}`,
    learner: '• يحوّل الوضعية إلى رسم/عملية وينجز المطلوب ويبرّر جوابه بجملة كاملة.'
  }),
  assessment: (items, pages) => ({
    teacher: `يدعوهم إلى إنجاز النشاط التقويمي${pages ? ` ص. ${pages}` : ''}:\n${items.map((i) => '• ' + i).join('\n')}• يوزّع شبكة التصحيح ويدعو إلى التقويم الذاتي.`,
    learner: '• ينجز التقويم فرديًّا ثم يتبادل التصحيح مع زميله ويدوّن ملاحظاته.'
  }),
  steps: (items) => ({
    teacher: `يرافقهم في منهجية حل الوضعيات (أفهم، أخطّط، أنجز، أتحقق):\n${items.map((i) => '• ' + i).join('\n')}`,
    learner: '• يطبّق خطوات المنهجية ويكتب الحل والإجابة اللفظية الكاملة.'
  })
};

function rowRole(stageName) {
  const n = normalizeArabic(stageName || '');
  if (/ذهن/.test(n)) return 'warmup';
  if (/استحضار|تمهيد|مكتسبات/.test(n)) return 'recall';
  if (/استكشاف|استقر|اشكالي|تصور|فرض|وضع/.test(n)) return 'explore';
  if (/منهجي|تدر|تمرين|ممارس|تنفيذ|انجاز/.test(n)) return 'practice';
  if (/توظيف|ادماج|نقل/.test(n)) return 'apply';
  if (/تقو|تقييم/.test(n)) return 'assessment';
  return 'explore';
}

function buildRow(stageName, blocks, ctxPages) {
  const role = rowRole(stageName);
  const texts = blocks.filter((b) => !isPlaceholderBlock(b)).map((b) => cleanMemoText(String(b.text || (b.kind !== 'concept' ? b.title || '' : '')))).filter((x) => x && !isLabelNoise(x));
  const tables = blocks.filter((b) => b.kind === 'table' && !isPlaceholderBlock(b)).length;
  if (!texts.length && !tables) return null;
  const tpl = TEACHER_TPL[role] || TEACHER_TPL.explore;
  const built = tpl(texts.slice(0, 6), ctxPages, tables);
  const meta = metaFor(stageName);
  const images = blocks
    .filter((b) => b.image)
    .slice(0, 2)
    .map((b) => ({ imageId: b.imageId || null, src: b.image, caption: b.alt || b.title || '' }));
  let learner = built.learner.replace('ي ناقش', 'يناقش');
  if (normalizeArabic(learner) === normalizeArabic(built.teacher)) learner = '• يُنجز المطلوب ويبرّر طريقته.';
  return { stage: stageName, teacherActivity: built.teacher, learnerActivity: learner, skill: meta.skill, tools: meta.tools, images };
}

const RANGE_RE = /الأعداد\s+من\s+([\d٠-٩]+)\s+إلى\s+([\d٠-٩]+)/;
function toWestern(s) { return String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)); }

export function buildSpecMemo({ profile, lesson, ctx }) {
  const g = groupBySection(lesson);
  const sMap = loadSkillsMap(ctx.gradeId || '', ctx.subjectId || '');
  const mapLesson = sMap ? ((sMap.lessons && sMap.lessons[lesson.id]) || sMap[lesson.id] || null) : null;
  const pages = lesson.officialRef ? toWestern(lesson.officialRef.pages) : '';

  const concept = normalizeArabic(lesson.title).includes(':')
    ? String(lesson.title).split(':')[1].trim()
    : String(lesson.title).replace(/^\d+\.\s*/, '');
  const rangeM = RANGE_RE.exec(toWestern(lesson.title).replace(/[\u064B-\u0652]/g, ''));
  const rangeTxt = rangeM ? ` في نطاق الأعداد من ${rangeM[1]} إلى ${rangeM[2]}` : '';

  const objectives = (mapLesson && Array.isArray(mapLesson.learningObjectives) && mapLesson.learningObjectives.length)
    ? mapLesson.learningObjectives.filter(Boolean).slice(0, 2)
    : [
        `ينجز المتعلّم «${concept}»${rangeTxt}.`,
        `يحلّ المتعلّم وضعية موظّفًا «${concept}»${rangeTxt}.`
      ];

  const cw = profile.competencyFramework || {};
  const domX = domainFields(lesson);
  const competencies = {
    domain: cw.domainCompetency || (profile.appliesTo?.subject === 'رياضيات' ? 'حلّ وضعيات مشكلة دالّة.' : ''),
    subject: cw.subjectCompetency || (profile.appliesTo?.subject === 'رياضيات' ? 'حلّ وضعيات مشكلة دالّة إسهامًا للتفكير الرياضي.' : ''),
    component: (mapLesson && mapLesson.competencies ? mapLesson.competencies.filter(Boolean).join(' ؛ ') : '') || cw.component || domX.component || '',
    distinctiveObjective: (rangeTxt
      ? `التصرّف في الأعداد بين ${rangeM[1]} و${rangeM[2]} قراءةً وكتابةً وتمثيلًا ومقارنةً وترتيبًا وتفكيكًا وتجميعًا.`
      : '') || cw.distinctiveObjective || (mapLesson && mapLesson.competencies ? mapLesson.competencies[0] : '') || domX.distinctive || ''
  };

  const subjN = normalizeArabic(ctx.subject || '');
  const subjectWord = subjN.includes('رياضيات') ? 'رياضيات' : (ctx.subject || '');
  const headerTitle = `مذكرة بيداغوجية لحصة ${subjectWord} — ${ctx.level || ''}`;

  const subjNorm = normalizeArabic(ctx.subject || '');
  const isMathTemplate = subjNorm.includes('رياضيات');
  const roles = classifyStages(lesson);
  const consumed = new Set();
  const takeRole = (name) => {
    const arr = (roles[name] || []).filter((x) => !consumed.has(x.idx));
    arr.forEach((x) => consumed.add(x.idx));
    return arr.map((x) => x.block);
  };
  const allBlocks = lesson.blocks || [];
  const rows = [];

  if (isMathTemplate) {
    // القالب الرسمي الموحد (مثال فارغ لمذكرة درس رياضيات): خمس مراحل ثابتة لا تُحذف،
    // وفراغات منقّطة للكتابة اليدوية في كل خلية كما في النموذج.
    const MATH_STAGES = [
      { label: 'حساب ذهني', keys: ['warmup'], space: 5, w: 55, tools: ['الألواح'], learner: ['• يُجري الحساب سريعًا على اللوح ويبيّن طريقته.'] },
      { label: 'تعهّد المكتسبات', keys: ['recall'], space: 6, w: 60, tools: ['الألواح', 'السبورة'], learner: ['• يستحضر القواعد والتقنيات المستوجبة ويثبّتها.'] },
      { label: 'الوضعية الاستكشافية\nالتعلّم المنهجي / الآلي', keys: ['explore', 'situation', 'practice', 'steps'], space: 12, w: 68, tools: ['السبورة', 'كراس المحاولات', 'كتاب التلميذ'], learner: ['• يلاحظ ويجرّب ويناقش.', '• يستنتج القاعدة ويضبطها بدفتر محاولاته.'] },
      { label: 'تعلّم إدماجي', keys: ['apply', 'challenge'], space: 9, w: 64, tools: ['كراس القسم', 'السبورة'], learner: ['• يوظّف مكتسباته في الوضعية ويبرّر جوابه.'] },
      { label: 'تقييم', keys: ['assessment'], space: 7, w: 58, tools: ['كراس المحاولات', 'شبكة التصحيح'], learner: ['• ينجز فرديًا ثم يصحّح بشبكة التقويم.'] }
    ];
    const dots = (n, w) => { const out = []; for (let i = 0; i < n; i++) out.push('.'.repeat(w)); return out.join('\n'); };
    const usedPrompts = new Set();
    for (let si = 0; si < MATH_STAGES.length; si++) {
      const st = MATH_STAGES[si];
      let items = [];
      for (const k of st.keys) items = items.concat(takeRole(k));
      if (st.keys[0] === 'assessment') {
        const tail = allBlocks
          .map((b, i) => ({ b, i }))
          .filter((x) => !consumed.has(x.i) && !(x.b && x.b.teacherOnly) && x.i >= allBlocks.length * 0.5)
          .filter((x) => !(/=\s*[\d٠-٩]/.test(toW(stripT((x.b && x.b.text) || ''))) && !/\.\.\.|…/.test((x.b && x.b.text) || '')))
          .slice(0, 3);
        tail.forEach((x) => consumed.add(x.i));
        items = items.concat(tail.map((x) => x.b));
      }
      const texts = items.filter((b) => !isPlaceholderBlock(b) && String(b.text || '').trim()).map((b) => cleanMemoText(b.text)).filter((x) => x && !isLabelNoise(x));
      texts.forEach((x) => usedPrompts.add(x));
      let genTexts = [];
      if (si === 0) {
        memoMentalItems(ctx.gradeId || 'year3', lesson.id, 3, lesson.title).forEach((m) => {
          const s = `${m.prompt} — الطريقة المتوقعة: ${m.strategy}`;
          if (!usedPrompts.has(m.prompt)) { usedPrompts.add(m.prompt); genTexts.push(s); }
        });
      } else if (si === 1) genTexts = memoPrereqItems(ctx.gradeId || 'year3', lesson.id, 3).map((m) => m.prompt);
      else if (si === 4) {
        const extra = memoMentalItems(ctx.gradeId || 'year3', lesson.id + 'T', 4, lesson.title).filter((m) => !usedPrompts.has(m.prompt)).slice(0, 2);
        extra.forEach((m) => usedPrompts.add(m.prompt));
        genTexts = extra.map((m) => m.prompt);
      }
      const merged = (si === 1 ? genTexts : texts).concat((si === 1 ? texts : genTexts).filter((g) => !(si === 1 ? texts : texts).some((t) => t.includes(g.slice(0, 18)))));
      const bullets = merged.slice(0, Math.max(2, st.space - 2)).map((x) => '• ' + x);
      const remain = Math.max(1, st.space - bullets.length);
      const teacherActivity = bullets.join('\n') + (bullets.length ? '\n' : '') + dots(remain, st.w + si);
      const learnerActivity = st.learner.join('\n') + '\n' + dots(Math.max(1, Math.ceil(st.space / 2)), Math.max(26, st.w - 28) + si);
      const images = items.filter((b) => b && b.image).slice(0, 2).map((b) => ({ imageId: b.imageId || null, src: b.image, caption: b.alt || b.title || '' }));
      rows.push({ stage: st.label, teacherActivity, learnerActivity, skill: '', tools: st.tools, images });
    }
  } else {
  const stages = (profile.phases || []).map((p) => p.name);
  const STAGE_KEYS = (name) => {
    const n = normalizeArabic(name);
    if (/ذهن/.test(n)) return ['warmup'];
    if (/استحضار|تمهيد|مكتسبات/.test(n)) return ['recall'];
    if (/استكشاف|استقر|اشكالي|تصور|فرض|وضع/.test(n)) return ['explore', 'situation'];
    if (/منهجي|تدر|تمرين|ممارس|تنفيذ|انجاز/.test(n)) return ['practice', 'steps'];
    if (/توظيف|ادماج|نقل/.test(n)) return ['apply', 'challenge'];
    if (/تقو|تقييم/.test(n)) return [];
    return [];
  };
  for (const name of stages) {
    let items = [];
    for (const k of STAGE_KEYS(name)) items = items.concat(takeRole(k));
    if (/تقو|تقي/.test(normalizeArabic(name))) {
      const tail = allBlocks
        .map((b, i) => ({ b, i }))
        .filter((x) => !consumed.has(x.i) && !(x.b && x.b.teacherOnly) && x.i >= allBlocks.length * 0.5)
        .filter((x) => !(/=\s*[\d٠-٩]/.test(toW(stripT((x.b && x.b.text) || ''))) && !/\.\.\.|…/.test((x.b && x.b.text) || '')))
        .slice(0, 3);
      tail.forEach((x) => consumed.add(x.i));
      items = items.concat(tail.map((x) => x.b));
    }
    if (!items.length) continue;
    const row = buildRow(name, items, pages);
    if (row) rows.push(row);
  }
  if (!rows.length) {
    const flat = (lesson.blocks || []).map(itemText).filter(Boolean).slice(0, 8);
    rows.push({
      stage: stages[0] || 'التمهيد',
      teacherActivity: `يدعوهم إلى ما يلي:\n${flat.map((i) => '• ' + i).join('\n')}`,
      learnerActivity: '• يُنجز ويشارك ويدوّن النتيجة.',
      skill: metaFor(stages[0]).skill,
      tools: metaFor(stages[0]).tools,
      images: []
    });
  }
  }
  const rawLeft = allBlocks.filter((b, i) => !consumed.has(i) && !(b && b.teacherOnly));
  const solvedLeft = rawLeft.filter((b) => /=\s*[\d٠-٩]/.test(toW(stripT(b.text || ''))) && !/\.\.\.|…/.test(b.text || ''));
  const leftoverBlocks = rawLeft.filter((b) => !solvedLeft.includes(b));
  const extraAnswers = solvedLeft.map((b) => b.text).filter(Boolean);
  const answerBlocks = allBlocks.filter((b) => b && b.teacherOnly && !isPlaceholderBlock(b));
  if (answerBlocks.length || extraAnswers.length) {
    const ansText = answerBlocks.map((b) => '• ' + itemText(b)).concat(extraAnswers.map((x) => '• ' + x)).filter((x) => x.length > 2).slice(0, 8).join('\n');
    rows.push({
      stage: 'نموذج الإجابة والتحقّق',
      teacherActivity: 'يعرض النموذج ويدعوهم إلى المقارنة والتصحيح الذاتي:\n' + ansText,
      learnerActivity: '• يقارن إنتاجه بالنموذج ويصحّح بدفتره ويدوّن نسبة نجاحه.',
      skill: 'تقدير الذات',
      tools: ['كراسات المحاولات', 'شبكة التصحيح'],
      images: []
    });
  }
  if (!isMathTemplate && leftoverBlocks.length) {
    const practiceRow = rows.find((r) => /تدر|تمرين/.test(normalizeArabic(r.stage)));
    const extra = buildRow('تمارين إضافية من الكتاب', leftoverBlocks, pages);
    if (extra && practiceRow) {
      practiceRow.teacherActivity += `\n${extra.teacherActivity}`;
      practiceRow.learnerActivity += `\n${extra.learnerActivity}`;
      practiceRow.images = practiceRow.images.concat(extra.images).slice(0, 2);
    } else if (extra) {
      rows.push(extra);
    }
  }

  const assessmentItems = [];
  const contentBox = (g.recall && g.recall.map(itemText).filter(Boolean).join(' ') ||
    (mapLesson && mapLesson.competencies ? mapLesson.competencies.join(' ؛ ') : '') ||
    `${lesson.title}${lesson.domain ? ' — ' + lesson.domain : ''}`);

  const allImages = (lesson.blocks || [])
    .filter((b) => b && b.image)
    .slice(0, 6)
    .map((b) => ({ imageId: b.imageId || `img-${lesson.id}-x`, src: b.image, caption: b.alt || b.title || '' }));

  return {
    specVersion: 2,
    mathTemplate: isMathTemplate,
    banner: isMathTemplate ? { duration: 'التوقيت: 60 دق', title: 'مذكرة رياضيات', level: ctx.level || '' } : null,
    headerTitle,
    period: lesson.period ? String(lesson.period).padStart(2, '0') : '',
    day: '',
    competencies,
    lessonObjectives: objectives,
    content: contentBox,
    rows,
    images: allImages,
    assessment: assessmentItems.length ? assessmentItems : (rows[rows.length - 1] ? undefined : undefined) || '',
    successRateLine: 'نسبة نجاح الدرس من خلال التمرين التطبيقي: ',
    pedagogicalDecision: 'القرار البيداغوجي: ',
    decisionHints: 'إعادة شرح — دعم مجموعة — أنشطة علاجية — إثراء'
  };
}
