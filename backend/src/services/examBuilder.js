import { getLessonPages } from './curriculumService.js';
import { normalizeArabic, loadRegistry } from './curriculumService.js';

/**
 * مجمّع الاختبارات: يبني اختبارات من أسئلة كتب السنة نفسها (تمارين حقيقية
 * مرقمنة: سؤال/خانة عدد/تعبير/رسم/جدول/ربط) — لا يختلق أسئلة ولا إجابات:
 * التصحيح يبقى للتلميذ بالمقارنة أو بيد المعلّم عبر «أرسل للمعلم» القائم.
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EXAM_KINDS = new Set(['question', 'math-input', 'textarea', 'drawing', 'match-pairs', 'table', 'picture-choice']);
export const KIND_FIELD = {
  question: 'حقل كتابة جواب',
  'math-input': 'خانة عدد',
  textarea: 'أسطر إجابة',
  drawing: 'مساحة رسم',
  'match-pairs': 'لوحة ربط',
  table: 'جدول/شبكة خانات',
  'picture-choice': 'اختيار صورة'
};

const PLACEHOLDER = /التحضير|سيظهر هنا|واصل التقدم|لم ينشا/;
const ANSWER_MARK = /(الإجابة|الجواب|الحل)\s*[:：=]|⟵|←/;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

function isLabeledNoise(t) {
  const n = normalizeArabic(t).replace(/[\s\d().,+]+/g, '');
  return /^(اتدرب|اتحدى|اطبق|اراجع|افكر|احكم|اقوم|اتحقق|وضعيت|وضعيه|تذكر|استنتج|لاحظ)/.test(n) && n.length <= 16;
}

function clean(t) {
  return String(t || '')
    .replace(EMOJI, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function foldA(t) {
  return String(t || '')
    .replace(/[\u064B-\u0652\u0670]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي');
}

// صيغة عنصر الامتحان: استفهام أو فراغ أو نقطتين أو «صح/خطأ» أو فعل أمر شائع (في أي موضع)
// أو كلمات مفتاحية امتحانية (جدول الضرب/بالأحرف/العملية العمودية/عبارة حسابية).
// تُجرَّد بادئات التسميات (تمرين/نشاط/حصة…) قبل الفحص. تُرفض جُمل النص الخبرية
// وتعليمات الأسلوب («أبدأ كل جملة…») وحقول العرض الشّرحي («الحل…»، «قائمة التحقق»).
const EXAM_VERBS = ['اقرا','اقراء','اكمل','اكملي','امل','املئي','اربط','اربطي','اختر','اختاري','صحح','صححي','حول','حولي','رتب','رتبي','ارسم','ارسمي','لون','لوني','صنف','صنفي','قارن','قارني','احسب','احسبي','قدر','قدري','بين','اوجد','احسب','قيس','اكتب','اكتبي','عبر','عبري','حرر','حرري','ثبت','علل','عللي','اذكر','اذكري','كون','كوني','فكك','فككي','انجز','أنجز','وزع','وزعي','اطرح','اجمع','اضرب','اقسم','وظف','وظفي','طبق','طبقي','استنتج','اكتشف','ابحث','هات','اعدي','خمن','عملي','ادرس','جرب','جربي','اختبر','اطلبي','اطلب','اركب','ركب','قس','اصف','اقطع','التصميم','صفي','وصف','اكمل','حول'];
const EXAM_VERB_RE = new RegExp('(^|[^\\p{L}])(' + EXAM_VERBS.join('|') + ')', 'u');
const EXAM_WORDS_RE = /(بالأحرف|بالاحرف|بالأرقام|بالارقام|بالأوراق|بالاوراق|بالنقود|بالمليم|بالسنتيمتر|بالمتر\b|بالكيلومتر|بالدينار|جدول الضرب|العملية العمودية|العمودية|العملية|بنفسك|حدّك|حدك|ضرب\s+حر|ضرب\s+سريع|المسافة\s+بين|الزيادة|\d+\s*[+×÷−–-]\s*\d+)/u;
const LABEL_PREFIX = /^\s*(تمرين|التمرين|نشاط|حصة|تدريب|تدرّب|تدرب|ألاحظ\s*و|اقترح)\s*\d*\s*[:：\-—]\s*/;
const ANSWER_LABEL = /^\s*(الحل|الجواب|الإجابة|الاجابة|نموذج\s+الإجابة|قائمة\s+التحقق|مفتاح)\b/;
const DECLARATIVE_PREFIX = /^(بدأ|عليك|علينا|يجب|نحن|انا|هو|هي)\b/;
function isExamForm(raw) {
  const src = String(raw || '').trim();
  if (ANSWER_LABEL.test(foldA(src))) return false;
  const stripped = src.replace(LABEL_PREFIX, '');
  const f = foldA(stripped);
  if (/[؟?]/.test(stripped)) return true;
  if (/\.{2,}|…|_{2,}|٠{2,}/.test(stripped)) return true;
  if (/:\s*$/.test(stripped)) return true;
  if (/(صح|صواب)[^.]*خطأ/.test(f)) return true;
  if (EXAM_WORDS_RE.test(stripped)) return true;
  if (DECLARATIVE_PREFIX.test(f)) return false;
  return EXAM_VERB_RE.test(f);
}

// طيّ أسماء المواد: كل كتب subjectKey المطابق تدخل الفحص (كل كتاب مستقل لا يُحذف)
export function subjectFold(s) {
  const n = foldA(String(s || '')).replace(/[^\p{L}]/gu, '');
  if (n.includes('رياضيات') || /math/i.test(String(s || ''))) return 'رياضيات';
  if (n.includes('قراء') || n.includes('انيس') || n === 'anisi') return 'قراءة';
  if (n.includes('ايقاظ') || n.includes('علوم') || /scienc/i.test(String(s || ''))) return 'ايقاظ علمي';
  if (n.includes('انتاج') || n.includes('كتابي') || /produc|writ/i.test(String(s || ''))) return 'إنتاج كتابي';
  return String(s || '').trim();
}
export const SUBJECT_KEYS = ['رياضيات', 'قراءة', 'ايقاظ علمي', 'إنتاج كتابي'];

export function gradeSubjectBooks(gradeId, subjectKey) {
  const registry = loadRegistry();
  const grade = (registry.grades || []).find((g) => g.id === gradeId);
  if (!grade) return [];
  const want = subjectFold(subjectKey);
  // نشمل كل كتاب مطابق: بعض المواد ترقمن عبر bookFile (كتابات الإيقاع) لا lessonsFile
  return (grade.subjects || [])
    .filter((s) => (s.bookFile || s.lessonsFile) && subjectFold(s.subjectKey || s.title || s.id) === want)
    .map((s) => s.id);
}

export function collectGradeQuestions(gradeId, subjectKey = 'رياضيات') {
  const pool = [];
  const seen = new Set();
  let sids = gradeSubjectBooks(gradeId, subjectKey);
  if (!sids.length && subjectFold(subjectKey) === 'رياضيات') sids = ['math2', 'math'];
  for (const sid of sids) {
    let pages = [];
    try { pages = getLessonPages(sid, null, gradeId); } catch { pages = []; }
    for (const lesson of pages) {
      for (const b of lesson.blocks || []) {
        if (!b || !EXAM_KINDS.has(b.kind)) continue;
        if (b.teacherOnly) continue;
        const raw = clean(b.text || b.title || '');
        if (!raw || raw.length < 8) continue;
        if (PLACEHOLDER.test(normalizeArabic(raw))) continue;
        if (ANSWER_MARK.test(raw)) continue;
        if (isLabeledNoise(raw)) continue;
        if (b.kind === 'question' && /اختر|اختار|اختاري|اختاري/.test(normalizeArabic(raw)) && !(b.options || []).length) continue;
        if (b.kind === 'table' && !(b.rows || []).length) continue;
        if (b.kind === 'match-pairs' && !(b.pairs || []).length) continue;
        // سؤال/تعبير/رسم/عدد: يجب أن يكون بصيغة امتحان — لا جمل النص الخبرية ولا تعليمات الأسلوب
        if (!['table', 'match-pairs', 'picture-choice'].includes(b.kind) && !isExamForm(raw)) continue;
        const key = normalizeArabic(raw);
        if (seen.has(key)) continue;
        seen.add(key);
        pool.push({
          id: `${lesson.id}-${pool.length}`,
          kind: b.kind,
          field: KIND_FIELD[b.kind],
          prompt: raw.slice(0, 240),
          options: (b.options || []).length ? b.options.map(clean).slice(0, 5) : undefined,
          rows: b.kind === 'table' ? (b.rows || []).slice(0, 6) : undefined,
          columns: b.kind === 'table' ? (b.columns || []) : undefined,
          pairs: b.kind === 'match-pairs' ? (b.pairs || []).slice(0, 6) : undefined,
          points: Number(b.points) || (b.kind === 'table' || b.kind === 'match-pairs' ? 4 : b.kind === 'textarea' || b.kind === 'drawing' ? 3 : 2),
          source: `${gradeId}/${sid}/${lesson.id}`,
          period: lesson.period || null
        });
      }
    }
  }
  return pool;
}

export function buildExam(gradeId, seed, size = 8, subjectKey = 'رياضيات') {
  const rng = mulberry32(seed >>> 0);
  const pool = collectGradeQuestions(gradeId, subjectKey);
  if (!pool.length) return null;
  // نفضّل درسًا واحدًا (اختبار منسجم) ثم نكمل من نفس الفترة عند الحاجة
  const lessons = [...new Set(pool.map((q) => q.source.split('/')[2]))];
  const anchorLesson = lessons[Math.floor(rng() * lessons.length) % lessons.length];
  const anchors = pool.filter((q) => q.source.endsWith('/' + anchorLesson));
  const chosen = [];
  const used = new Set();
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  for (const q of shuffle(anchors)) { if (chosen.length >= size) break; chosen.push(q); used.add(q.id); }
  if (chosen.length < size) {
    const others = shuffle(pool).filter((q) => !used.has(q.id));
    for (const q of others) { if (chosen.length >= size) break; chosen.push(q); }
  }
  const periods = chosen.map((q) => q.period).filter(Boolean);
  const period = periods.length ? periods.sort((a, b) => a - b)[0] : null;
  const copy = (x) => ({ ...x });
  const subjectWord = subjectFold(subjectKey);
  return {
    examId: `EX-${gradeId}-${subjectWord}-${seed >>> 0}`,
    gradeId,
    subject: subjectWord,
    period,
    title: `اختبار ${subjectWord}${period ? ` — الفترة ${period}` : ''} — نسخة ${seed % 97 + 1}`,
    items: chosen.map(copy),
    totalPoints: chosen.reduce((s, q) => s + q.points, 0),
    answersExposed: false,
    gradingNote: 'التصحيح: مقارنة بالنموذج الشفوي للدرس أو إرسال للمعلّم عبر «أرسل للمعلم»'
  };
}
