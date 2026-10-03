// مدقّق السؤال (§50) — يمرّ على سؤال واحد قبل دخوله أي اختبار.
// الفحوصات: عقد السؤال §124، صحّة الإجابة §26، الغموض §54، كشف الإجابة داخل
// السؤال §28، توازن البدائل §91، اللغة وملاءمة العمر §13,§37,§41، النقاط §46.
// كل ملاحظة تحمل كودًا وشدة (error ← REJECT, warn ← تُعرض للمدرس §126) — لا صمت.

import { normalizeArabic } from '../services/curriculumService.js';
import { guardCurriculum } from './curriculum-index.js';

export const QUESTION_TYPES = ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'EXTRACT', 'ORDER', 'OPEN'];
// أنواع قادرة على العرض والتصحيح في ExamPaper + gradeOfficialExam اليوم.
// MATCHING/ORDERING موجودتان في نموذج الإدخال لكنهما غير مُعمَّات — توليد جديد ممنوع منهما (موثّق في التقرير).
export const GENERATABLE_TYPES = ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'EXTRACT', 'ORDER', 'OPEN'];

const issue = (severity, code, message, field) => ({ severity, code, message, ...(field ? { field } : {}) });

// تعليمات المستوى الأول يجب أن تكون قصيرة وواضحة (§40,§41) — لغة تقنية ممنوعة
// على السنة 1-2 حتى («تحليل/استنتاج» تُرفع للسنوات العليا فقط إن كانت مناسبة).
const TECHNICAL_TERMS = ['البنية الصرفية', 'الإعراب', 'الاشتقاق', 'الステ', 'التحليل الدلالي'];

function gradeNumber(grade) {
  const n = Number(grade);
  if (n >= 1 && n <= 6) return n;
  // «year3» ← 3: match(/[1-6]/) ليس فيه مجموعة تحويل، فالعنصر [0] هو الرقم
  // (كانت [1] تُرجع undefined ← Number(undefined)=NaN ← كل سؤال بـGRADE_MISSING)
  const m = String(grade ?? '').match(/[1-6]/);
  return m ? Number(m[0]) : null;
}

/**
 * يدقّق سؤالًا واحدًا.
 * @param {object} q السؤال (§76)
 * @param {object} ctx { examTrimester, requireObjective=true, runGuard=true }
 * @returns {{valid:boolean, issues:Array}} valid = بلا error (التنبيهات لا تمنع)
 */
export function validateQuestion(q, ctx = {}) {
  const issues = [];
  const requireObjective = ctx.requireObjective !== false;
  const type = String(q?.type || '').toUpperCase();

  // — عقد السؤال الإلزامي (§124) —
  if (!q || typeof q !== 'object') return { valid: false, issues: [issue('error', 'EMPTY', 'السؤال فارغ')] };
  const g = gradeNumber(q.grade);
  if (!g) issues.push(issue('error', 'GRADE_MISSING', 'السنة الدراسية مفقودة', 'grade'));
  if (!q.subject) issues.push(issue('error', 'SUBJECT_MISSING', 'المادة مفقودة', 'subject'));
  if (!q.term && q.term !== 1 && q.term !== 2 && q.term !== 3) issues.push(issue('error', 'TERM_MISSING', 'الثلاثي مفقود', 'term'));
  if (!q.prompt || !String(q.prompt).trim()) issues.push(issue('error', 'PROMPT_MISSING', 'نص السؤال فارغ', 'prompt'));
  if (!GENERATABLE_TYPES.includes(type) && !QUESTION_TYPES.includes(type)) {
    issues.push(issue('error', 'TYPE_UNKNOWN', `نوع سؤال غير مدعوم: «${q.type}»`, 'type'));
  }
  const points = Number(q.points);
  if (!(points > 0)) issues.push(issue('error', 'POINTS_INVALID', 'نقاط السؤال يجب أن تكون أكبر من صفر', 'points'));
  else if (Math.round(points * 2) / 2 !== points) issues.push(issue('warn', 'POINTS_STEP', 'النقاط تُكتب بخطوة 0.5 (3، 2.5، 1…)', 'points'));

  if (!q.objective || !String(q.objective).trim()) {
    issues.push(issue(requireObjective ? 'error' : 'warn', 'OBJECTIVE_MISSING', 'لا هدف تعليمي للسؤال — سؤال بلا «يقيس المكتسب X» لا يدخل الاختبار (§123)', 'objective'));
  }

  // — صحّة الإجابة (§26): إجابة واحدة بالضبط في الاختيار الواحد —
  const promptNorm = normalizeArabic(q.prompt);
  if (type === 'MCQ') {
    const options = Array.isArray(q.options) ? q.options : [];
    if (options.length < 2) issues.push(issue('error', 'OPTIONS_FEW', 'الاختيار من متعدد يحتاج خيارين على الأقل', 'options'));
    if (options.length > 5) issues.push(issue('warn', 'OPTIONS_MANY', 'أكثر من 5 بدائل يرهق الطفل', 'options'));
    const normOpts = options.map(normalizeArabic);
    const dupIdx = normOpts.findIndex((o, i) => o && normOpts.indexOf(o) !== i);
    if (dupIdx >= 0) issues.push(issue('error', 'OPTIONS_DUPLICATE', `خياران متطابقان: «${options[dupIdx]}»`, 'options'));
    const correct = String(q.correctAnswer ?? q.correct ?? '').trim();
    if (!correct) issues.push(issue('error', 'ANSWER_MISSING', 'لا إجابة صحيحة لسؤال الاختيار', 'correctAnswer'));
    else {
      const hits = normOpts.filter((o) => o === normalizeArabic(correct)).length;
      if (hits === 0) issues.push(issue('error', 'ANSWER_NOT_OPTION', 'الإجابة الصحيحة ليست ضمن البدائل', 'correctAnswer'));
      else if (hits > 1) issues.push(issue('error', 'MULTIPLE_CORRECT', 'أكثر من خيار صحيح — REJECT (§26)', 'correctAnswer'));
      // كشف الإجابة داخل السؤال (§28)
      const ansNorm = normalizeArabic(correct);
      if (ansNorm.length >= 3 && promptNorm.includes(ansNorm)) {
        issues.push(issue('error', 'ANSWER_LEAKED', 'الإجابة مكتوبة داخل السؤال نفسه (§28)', 'prompt'));
      }
      // توازن البدائل (§91): خيار أطول كثيرًا من البقية إشارة
      if (options.length >= 3) {
        const lens = options.map((o) => String(o).length);
        const max = Math.max(...lens);
        const med = [...lens].sort((a, b) => a - b)[Math.floor(lens.length / 2)];
        if (med > 0 && max > med * 3 && max > 25) {
          issues.push(issue('warn', 'OPTIONS_IMBALANCED', 'طول البدائل غير متوازن — قد تُفضح الإجابة بالشكل (§91)', 'options'));
        }
      }
    }
  } else if (type === 'TRUE_FALSE') {
    const correct = normalizeArabic(q.correctAnswer ?? q.correct);
    if (!['صواب', 'خطا'].includes(correct)) {
      issues.push(issue('error', 'TF_ANSWER', 'إجابة صح/خطأ يجب أن تكون «صواب» أو «خطأ»', 'correctAnswer'));
    }
    if (!/[.؟?]/.test(String(q.prompt || '')) || String(q.prompt || '').trim().length < 10) {
      issues.push(issue('warn', 'TF_STATEMENT', 'جملة الحكم يجب أن تكون كاملة وواضحة (§27)', 'prompt'));
    }
    if (promptNorm.includes('صواب') || promptNorm.includes('خطا')) {
      issues.push(issue('error', 'ANSWER_LEAKED', 'السؤال يحوي «صواب/خطأ» — يكشف الجواب (§28)', 'prompt'));
    }
  } else if (type === 'FILL_BLANK' || type === 'EXTRACT') {
    const correct = String(q.correctAnswer ?? '').trim();
    if (!correct) issues.push(issue('error', 'ANSWER_MISSING', 'لا إجابة نموذجية لسؤال الإكمال/الاستخراج', 'correctAnswer'));
    else {
      const ansNorm = normalizeArabic(correct);
      if (ansNorm.length >= 3 && promptNorm.includes(ansNorm)) {
        issues.push(issue('error', 'ANSWER_LEAKED', 'الإجابة موجودة داخل السؤال (§28)', 'prompt'));
      }
      const blanks = (String(q.prompt).match(/\.{2,}|…|_{2,}/g) || []).length;
      const expected = ansNorm.split('|').filter(Boolean).length;
      if (type === 'FILL_BLANK' && blanks === 0) {
        issues.push(issue('warn', 'NO_BLANK_MARK', 'لا يوجد فراغ مرئي (… أو ___) في السؤال (§33)', 'prompt'));
      }
      if (blanks > 0 && expected > blanks) {
        issues.push(issue('warn', 'BLANK_COUNT', `عدد الفراغات (${blanks}) أقل من الإجابات المتوقعة (${expected})`, 'prompt'));
      }
    }
  } else if (type === 'ORDER') {
    const items = Array.isArray(q.orderItems) ? q.orderItems : [];
    if (items.length < 2) issues.push(issue('error', 'ORDER_FEW', 'سؤال الترتيب يحتاج عنصرين على الأقل', 'orderItems'));
    const answers = Array.isArray(q.correctAnswer) ? q.correctAnswer : items;
    if (!answers.length) issues.push(issue('error', 'ANSWER_MISSING', 'لا ترتيب صحيح محدّد', 'correctAnswer'));
  } else if (type === 'OPEN') {
    if (!q.expectedResponseType && !q.answerLines) {
      issues.push(issue('warn', 'OPEN_SPACE', 'حدّد نوع المنتوج (كلمة/جملة/فقرة) أو عدد الأسطر لحساب مساحة الإجابة (§93,§94)', 'expectedResponseType'));
    }
  }

  // — ملاءمة اللغة والعمر (§13,§37,§41) —
  const prompt = String(q.prompt || '');
  if (g && g <= 2) {
    if (prompt.length > 300) issues.push(issue('error', 'PROMPT_TOO_LONG', `سؤال طويل جدا للسنة ${g === 1 ? 'الأولى' : 'الثانية'} (${prompt.length} حرفًا) — REJECT (§39)`, 'prompt'));
    else if (prompt.length > 130) issues.push(issue('warn', 'PROMPT_LONG', 'نص السؤال طويل على مستوى الصغر — اختصر التعليمية (§40)', 'prompt'));
    for (const t of TECHNICAL_TERMS) {
      if (normalizeArabic(prompt).includes(normalizeArabic(t))) {
        issues.push(issue('error', 'TECHNICAL_LANGUAGE', `لغة تقنية غير مناسبة للسنة الصغرى: «${t}» (§41)`, 'prompt'));
      }
    }
  } else if (prompt.length > 700) {
    issues.push(issue('warn', 'PROMPT_LONG', 'نص السؤال طويل — راجح الحمل المعرفي (§39)', 'prompt'));
  }
  if (prompt && (prompt.includes('undefined') || prompt.includes('null') || /سيظهر هنا|التحضير|لم ينشا/.test(prompt))) {
    issues.push(issue('error', 'PLACEHOLDER', 'السؤال يحوي نصًّا مؤقتًا غير مكتمل', 'prompt'));
  }

  // — الصعوبة (§36): 1 تعرف … 5 إدماج —
  const diff = Number(q.difficulty);
  if (q.difficulty !== undefined && !(diff >= 1 && diff <= 5)) {
    issues.push(issue('warn', 'DIFFICULTY_RANGE', 'الصعوبة تُكتب من 1 (تعرف) إلى 5 (إدماج)', 'difficulty'));
  }

  // — الحارس المنهجي (§55): السنة + المادة + الثلاثي + المكتسب —
  if (ctx.runGuard !== false && g) {
    const guard = guardCurriculum({
      level: q.grade,
      subject: q.subject,
      trimester: ctx.examTrimester ?? q.term,
      competency: q.competency,
      objective: q.objective,
      lessonTitle: q.lesson
    });
    if (guard.status === 'out') {
      issues.push(issue('error', 'OUT_OF_CURRICULUM', guard.reason, 'curriculum'));
    } else if (guard.status === 'unknown') {
      issues.push(issue('warn', 'CURRICULUM_UNKNOWN', guard.reason || 'لا سند منهجي — راجع المخطط يدويًا (§55)', 'curriculum'));
    }
  }

  return { valid: !issues.some((i) => i.severity === 'error'), issues };
}
