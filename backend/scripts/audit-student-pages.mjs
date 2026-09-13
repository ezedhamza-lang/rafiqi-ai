/* Visual/data QA for student-facing book pages — as sanitizeStudentPages serves them.
   Checks (per user spec):
   A. Answer embedded in task-block visible text (finished calc: = digit, no ellipsis)
   B. Task text contains الحل/الإجابة/الجواب : ... (answer spelled out)
   C. "أكمل الجدول/الجدول" wording without actual table block in lesson
   D. "اكتب إجابتك" in a place without an answer zone (concept etc.)
   E. Duplicate blocks within the same lesson (same normalized text)
   F. question with no options and no answer (no zone, nothing to check)
   G. year-mixing: text mentions a different grade level explicitly
*/
import path from 'path';
import { fileURLToPath } from 'url';
import { listBooks, getLessonPages } from '../src/services/curriculumService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NUM = '[0-9٠-٩]';
// ثوابط معطاة في السؤال (π، تحويلات وحدات) — ليست إجابات مكشوفة
const GIVEN_CONST = /π\s*=|=\s*3[,.]14\b|= 1000 مل|= 1000م/;
// إجابة محسوبة مكشوفة داخل نص السؤال: (أ) حل داخل قوسين «(... = رقم»، (ب) تلميح رقمي بعد ؟ بين قوسين،
// (ج) عملية مكتملة بعد علامة الاستفهام «؟ 5 × 4 = 20»، (د) عملية كاملة بلا أي فراغ في نص بلا ؟
const PAREN_SOL = /\((?![^)]*π)[^)]*=\s*[0-9٠-٩]/;
const PAREN_HINT = /[؟?]\s*\(\s*[0-9٠-٩.,\sو،–—-]*[0-9٠-٩][0-9٠-٩.,\sو،–—-]*\)\s*[.!]?\s*$/;
const FULL_CALC = /[0-9٠-٩]\s*[+×*:−–-]\s*[0-9٠-٩]+\s*=\s*[0-9٠-٩]/;
const HAS_BLANK = /(…|\.\.\.|\?|؟|_+|\.\.)/;
// إجابة مكتوبة صراحة: «الحل: ... = رقم». العناوين التكليفية مثل «الحل: 15 × 6 عمودياً» (بلا =) لا تُحتسب
const ANSWER_MARK = /(الحل|الإجابة|الاجابة|الجواب)\s*[:=][^؟?]{0,60}=\s*[0-9٠-٩]/;
const TF_OPTS = /^(صح|صحيح|صواب|خطا|خطأ|نعم|لا|✓|✕|✗)/;
const TASK_KINDS = new Set(['question', 'math-input', 'textarea']);
const YEAR_WORDS = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة'];

function isTrueFalse(b) {
  return (b.options || []).length === 2 && (b.options || []).every((o) => TF_OPTS.test(normalize(o)));
}

function normalize(s) {
  return String(s || '').replace(/[\u064B-\u0652\u0670]/g, '').replace(/[إأآا]/g, 'ا')
    .replace(/[ةه]/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ').trim().toLowerCase();
}
function stripTashkeel(t) {
  return String(t || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
}

const issues = [];
const info = [];
function add(code, gradeId, subjectId, lessonId, blockIdx, detail, text) {
  issues.push({ code, gradeId, subjectId, lessonId, blockIdx, detail, text: String(text || '').slice(0, 160) });
}

const books = listBooks();
let nLessons = 0, nBlocks = 0;
for (const b of books) {
  let pages = [];
  try { pages = getLessonPages(b.subjectId, b.grade, b.gradeId); } catch { continue; }
  for (const lesson of pages) {
    nLessons++;
    const blocks = lesson.blocks || [];
    const seen = new Map();
    const hasTableBlock = blocks.some((x) => x && (x.kind === 'table' || (Array.isArray(x.rows) && x.rows.length)));
    blocks.forEach((bl, i) => {
      if (!bl) return;
      nBlocks++;
      const text = `${bl.title || ''} ${bl.text || ''}`;
      const ntext = normalize(text);
      const isTask = TASK_KINDS.has(bl.kind);
      if (isTask) {
        // A. إجابة محسوبة مكشوفة داخل نص السؤال نفسه
        if (!isTrueFalse(bl)) {
          const t = stripTashkeel(String(bl.text || ''));
          // سؤال يطلب الإجابة بعد = أو ينتهي بفراغ => ليس تسرّب إجابة
          const asksAfterEq = /=\s*(…|\.\.+|\?|؟)\s*$/.test(t.trim()) || /=\s*$/.test(t.trim());
          const hasPremise = /إذا كان|اذا كان|بما ان|بما أن|فإن|فان/.test(t);
          const lastQ = /؟|\?/.test(t) ? t.split(/[؟?]/).slice(-1)[0] : '';
          const afterQ = /؟|\?/.test(t) ? FULL_CALC.test(lastQ) && !HAS_BLANK.test(lastQ) : false;
          const leaked = !asksAfterEq && !hasPremise && (
            PAREN_SOL.test(t) ||
            PAREN_HINT.test(t) ||
            (afterQ) ||
            (!/؟|\?/.test(t) && !HAS_BLANK.test(t) && FULL_CALC.test(t)));
          if (leaked) add('A', b.gradeId, b.subjectId, lesson.id, i, 'إجابة محسوبة مكشوفة داخل السؤال', bl.text);
        }
        // B. spelled-out answer
        if (ANSWER_MARK.test(ntext)) add('B', b.gradeId, b.subjectId, lesson.id, i, 'علامة «الحل:/الإجابة:» داخل نص السؤال', text);
        // C. يطلب تعبئة جدول فعلي ولا يوجد جدول (الكتلة) في الدرس — لا يشمل «اكتب جدولًا» (حفظًا) أو «أي جدول يحوي» (قراءة)
        const fillTable = /(أكمل|أكمل|املأ|اتمم|أتمم)[^ج]{0,10}الجدول|جدول المنازل|الجدول التالي|جدول[^ج]{0,3}التالي/.test(ntext);
        const readTable = /اكتب جدول|اكتب الجدول|أي جدول|جدول الضرب|أكتب جدول/.test(ntext);
        if (fillTable && !readTable && !hasTableBlock) add('C', b.gradeId, b.subjectId, lesson.id, i, 'يطلب تعبئة جدول ولا يوجد جدول', text);
        // F. سؤال مفتوح بلا مفتاح إجابة — تُغطّيه الواجهة الآن بمنطقة إجابة تلقائية (رسم/عملية/كتابة)
        //    يُحسب معلوماتيًا لا كخطأ، لأن هذه أسئلة مقالية يصحّ تصحيحها يدويًا من المعلم.
        if (bl.kind === 'question' && !(bl.options && bl.options.length) && bl.answer === undefined) {
          info.push({ code: 'F', gradeId: b.gradeId, subjectId: b.subjectId, lessonId: lesson.id, blockIdx: i, text });
        }
      }
      // D. "اكتب إجابتك" in non-task block
      if (!isTask && /اكتب اجابتك|اكتب إجابتك|اكتب جوابك/.test(ntext) && !(bl.answer !== undefined)) {
        add('D', b.gradeId, b.subjectId, lesson.id, i, 'عبارة «اكتب إجابتك» في كتلة غير تفاعلية', text);
      }
        // H. نصّ يطرح سؤالًا صريحًا ثم يكشف جوابه في نفس الكتلة: «…؟ 11 + 3 = 14»
        //    لا يشمل القصص الحوارية التعليمية («سألت الأستاذه… أجابت فاطمة…») فهي أسلوب الكتاب.
        if (bl.kind === 'concept' && !bl.teacherOnly && i > 0 && stripTashkeel(String(bl.text || '')).length <= 200) {
          const s = stripTashkeel(String(bl.text || ''));
          if (!/سالت|كتبت|اجاب|اجابت|قالت|الاستاذه|نلاحظ|نجمع|نطرح/.test(s)) {
            const qm = [...s.matchAll(/[؟?]/g)].map((m) => m.index);
            const leakInSame = qm.some((idx) => FULL_CALC.test(s.slice(idx + 1, idx + 80)));
            if (leakInSame) add('H', b.gradeId, b.subjectId, lesson.id, i, 'سؤال صريح وجوابه المحسوب في النص نفسه', bl.text);
          }
        }
        // E. duplicates in the same lesson (blocks differing only by image/art are distinct pages)
      const key = `${ntext}§${bl.image || bl.art || ''}§${JSON.stringify(bl.rows || '')}§${JSON.stringify(bl.options || '')}`;
      if (ntext.length > 25) {
        if (seen.has(key)) add('E', b.gradeId, b.subjectId, lesson.id, i, `تكرار مع الكتلة #${seen.get(key)}`, text);
        else seen.set(key, i);
      }
      // G. explicit wrong-grade mention
      for (let yi = 0; yi < YEAR_WORDS.length; yi++) {
        const want = parseInt(String(b.gradeId).replace(/\D/g, ''), 10);
        if (want && yi + 1 !== want && new RegExp(`السنة\\s+${YEAR_WORDS[yi]}`).test(ntext)) {
          add('G', b.gradeId, b.subjectId, lesson.id, i, `ذكر «السنة ${YEAR_WORDS[yi]}» في ${b.gradeId}`, text);
        }
      }
    });
  }
}

const byCode = {};
for (const it of issues) byCode[it.code] = (byCode[it.code] || 0) + 1;
const infoByCode = {};
for (const it of info) infoByCode[it.code] = (infoByCode[it.code] || 0) + 1;
console.log(`lessons=${nLessons} blocks=${nBlocks} ERRORS=${issues.length} ${JSON.stringify(byCode)}  (info: أسئلة مفتوحة مغطّاة آليًا=${info.length})`);
for (const c of Object.keys(byCode).sort()) {
  console.log(`\n=== CODE ${c} (${byCode[c]}) ===`);
  const items = issues.filter((i) => i.code === c);
  for (const it of items.slice(0, 60)) console.log(`${it.gradeId}/${it.subjectId}/${it.lessonId}#${it.blockIdx} [${it.detail}] ${it.text}`);
}
import fs from 'fs';
fs.writeFileSync(path.join(__dirname, 'audit-student-pages-report.json'), JSON.stringify(issues, null, 1));
