// ===== بحث رفيقي داخل دروس المنصة — يعمل دائمًا بلا مفتاح ذكاء اصطناعي =====
//
// مسار أول لمحادثة التلميذ `/api/ai/chat`: سؤال «ما هو الجمع؟» يجد الدرس
// المطابق في محتوى المنهج ويُعيد مقتطفًا حقيقيًا منه — بلا مفتاح، بلا حصة،
// بلا اتصال خارجي وبلا أي تكلفة. إن لم يجد مطابقة يسقط المسار تلقائيًا إلى
// الذكاء الاصطناعي (إن وُجد مفتاح) أو إلى الرسالة اللطيفة المعتادة.
//
// مرونة الصيغ (طلب صريح من صاحب المنصة): جمع = الجمع = الجموع = الجامع.
// الطريقة: normalizeArabic (الهمزات/التاء/التشكيل) ثم lightStem يجرّد السوابق
// (ال/وال/بال/كال/…) واللواحق (ات/ون/ية/…) ثم الحروف العلة (ا/و/ي) فيبقى
// «الجذع» نفسه مهما تغيّرت صيغة الكلمة. السؤال والدرس يمرّان بالمخفّف ذاته،
// فالتطابق = تساوي الجذور — تغيّر أي طرف لا يكسر الاتساق.

import {
  getLessonPages,
  getSubjectsForLevel,
  listBooks,
  normalizeArabic,
  levelToCurriculumTitle
} from './curriculumService.js';
import { lessonTextOf } from './aiService.js';

// كلمات بلا محتوى درسي (أدوات/أسئلة/تحيات). «مرحبا» إلزامية هنا:
// بدونها يصير التحية مطابقة لدرس ويقحم نفسه في كل محادثة.
const STOPWORDS = new Set([
  'ما', 'هو', 'هي', 'هل', 'كيف', 'لماذا', 'متى', 'اين', 'ماذا', 'كم', 'لمن',
  'هذا', 'هذه', 'ذلك', 'تلك', 'هنا', 'هناك', 'مع', 'عند', 'كل', 'بعض', 'شيء', 'اشياء',
  'قد', 'كان', 'كانت', 'ان', 'اذا', 'التي', 'الذي', 'ليست', 'ليس',
  'عرف', 'عرفي', 'اشرح', 'وضح', 'قل', 'اعطني', 'اعطيني', 'اخبر', 'اخبرني',
  'اريد', 'ارجو', 'راجع', 'اريدان',
  'مرحبا', 'اهلا', 'سهلا', 'سلام', 'عليكم', 'كيفك', 'حالك', 'حالكم', 'رفيقي',
  'شكرا', 'تمام', 'نعم', 'ممتاز', 'بالفعل', 'جدا', 'فقط', 'ايضا', 'مثلا'
]);

// سوابق وعواصم عربية شائعة — الأطول أولًا.
const PREFIXES = ['وال', 'فال', 'بال', 'كال', 'لال', 'لل', 'ال'];
// لواحق — الأطول أولًا، والشرط في الاستعمال: البقيّة ≥ 3 حتى لا نجرّد الكلمة
// إلى حرفين.
const SUFFIXES = [
  'اتها', 'ونها', 'اتون', 'وات', 'تان', 'تين', 'يات', 'ون', 'ين', 'ان', 'ات',
  'ية', 'ها', 'هم', 'كم', 'نا', 'ني', 'يه', 'ي', 'ه', 'ك'
];

// كل ما ليس حرفًا عربيًّا (لاتيني/أرقام/ترقيم) فاصل — يُرمى مع التنقية.
const NOT_ARABIC = /[^ا-ي]/g;

/**
 * جذع خفيف للكلمة العربية بعد التطبيع.
 * جمع → جمع · الجمع → جمع · الجموع → جمع (حذف و) · الجامع → جمع (حذف ا).
 */
export function lightStem(token) {
  let w = normalizeArabic(token).replace(NOT_ARABIC, '');
  if (w.length < 3) return w;

  for (const p of PREFIXES) {
    if (w.startsWith(p) && w.length - p.length >= 3) {
      w = w.slice(p.length);
      break;
    }
  }
  // عواصم أحادية (و/ف/ب/ل/ك/س/ي/ت/ن) بشرط بقاء ≥ 3.
  if (w.length >= 4 && 'وفبلكسين'.includes(w[0])) {
    const rest = w.slice(1);
    if (rest.length >= 3) w = rest;
  }
  for (const s of SUFFIXES) {
    if (w.length - s.length >= 3 && w.endsWith(s)) {
      w = w.slice(0, -s.length);
      break;
    }
  }
  // الحروف العلة: الجامع → جمع · الجموع → جمع. إن نتج أقل من 3 نرجع ما قبلها.
  const weak = w.replace(/[اوي]/g, '');
  return weak.length >= 3 ? weak : w;
}

/** جذور صالحة للمطابقة من نص السؤال (بعد إسقاط التكرار والحروف العلة). */
export function questionRoots(message) {
  const words = normalizeArabic(message).split(NOT_ARABIC).filter(Boolean);
  const roots = new Set();
  for (const w of words) {
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    const r = lightStem(w);
    if (r.length >= 3 && !STOPWORDS.has(r)) roots.add(r);
  }
  return Array.from(roots);
}

// محتوى المنهج لا يتغيّر وقت التشغيل (نفس افتراض ذاكرة curriculumService)
// فنخزّن جذور الصفحات بعد أول مسح.
const _stemSetCache = new Map();
function stemsOf(key, text) {
  const cacheKey = `${key}|${text.length}`;
  let set = _stemSetCache.get(cacheKey);
  if (!set) {
    set = new Set();
    for (const w of normalizeArabic(text).split(NOT_ARABIC).filter(Boolean)) {
      set.add(lightStem(w));
    }
    _stemSetCache.set(cacheKey, set);
  }
  return set;
}

// نفس منطق tutor-context: مطابقة مستوى قاعدة البيانات بكتاب المنهج.
function deriveGradeId(curriculumLevel, country) {
  const norm = normalizeArabic(curriculumLevel);
  if (!norm) return null;
  const books = listBooks(country);
  const hit = books.find((b) => normalizeArabic(b.grade) === norm)
    || books.find((b) => {
      const bg = normalizeArabic(b.grade);
      return bg && (bg.includes(norm) || norm.includes(bg));
    });
  return hit ? hit.gradeId : null;
}

function normChar(c) {
  if (c === 'أ' || c === 'إ' || c === 'آ') return 'ا';
  if (c === 'ة') return 'ه';
  if (c === 'ى') return 'ي';
  return c;
}

// إيجاد أول ظهور حرفي لعبارة داخل نصّ فيه تشكيل: نبني نسخة مطبّعة مع خريطة
// مواضع الأحرف الأصلية حتى لا يزيح التشكيل المؤشرات.
function rawIndexOf(raw, query) {
  const map = [];
  const buf = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch >= '\u064B' && ch <= '\u0652') continue;
    buf.push(normChar(ch));
    map.push(i);
  }
  const qi = buf.join('').indexOf(query);
  return qi === -1 ? -1 : map[qi];
}

function buildReply(best, roots) {
  const body = best.body || '';
  // نافذة القراءة: حول أول ظهور لأي جذر من السؤال، وإلا من بداية النص.
  let at = -1;
  for (const r of roots) {
    at = rawIndexOf(body, r);
    if (at !== -1) break;
  }
  const start = at > 240 ? at - 200 : 0;
  const WIN = 900;
  const windowed = body.slice(start, start + WIN);
  const excerpt = `${start > 0 ? '…' : ''}${windowed}${start + WIN < body.length ? '…' : ''}`;

  return `🦉 وجدتُ لك هذا في درس «${best.page.title}» — مادة ${best.subject.title}:\n\n${excerpt}\n\n💡 هذه إجابة من دروس منصتي مباشرة — اسألني عن درس آخر، أو حدّد المادة والدرس من الأعلى.`;
}

/**
 * ابحث عن جواب سؤال التلميذ داخل دروس المنهج.
 * @returns {null} لا مطابقة (أو بلا مستوى معلوم) — يسقط النداء للمسار التالي
 * @returns {{ reply, lessonTitle, subjectTitle, score }} مطابقة مع مقتطف جاهز للعرض
 */
export function searchLessonAnswer({ message, level = '', gradeId, subjectCode, lessonId, country } = {}) {
  const roots = questionRoots(message);
  if (!roots.length) return null;

  const lv = String(level || '').trim();
  // بلا مستوى معلوم (مثل حساب الاستكشاف): لا نخمّن درسًا لطالب لا نعرف صفّه.
  if (!lv) return null;

  const curriculumLevel = levelToCurriculumTitle(lv);
  let subjects = getSubjectsForLevel(curriculumLevel, country);
  if (!subjects.length) subjects = getSubjectsForLevel(lv, country);
  if (!subjects.length) return null;

  const gid = gradeId || deriveGradeId(curriculumLevel, country);
  let best = null;

  for (const s of subjects) {
    if (subjectCode && s.id !== subjectCode) continue;
    let pages = getLessonPages(s.id, lv, gid || undefined, country);
    if (lessonId) pages = pages.filter((p) => String(p.id) === String(lessonId));
    for (const p of pages) {
      const prefixKey = `${gid || ''}:${s.id}:${p.id}`;
      const titleStems = stemsOf(`${prefixKey}:t`, p.title || '');
      const body = lessonTextOf(p, 8000);
      if (!body) continue;
      const bodyStems = stemsOf(`${prefixKey}:b`, body);
      let score = 0;
      for (const r of roots) {
        if (titleStems.has(r)) score += 3; // تطابق في العنوان = الأقوى
        else if (bodyStems.has(r)) score += 1;
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { page: p, subject: s, score, body };
      }
    }
  }

  if (!best) return null;
  return {
    reply: buildReply(best, roots),
    lessonTitle: best.page.title,
    subjectTitle: best.subject.title,
    score: best.score
  };
}
