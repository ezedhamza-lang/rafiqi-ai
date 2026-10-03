// اختبارات مرحلة الإصلاح الحتمي (repair.js) داخل خطّ التوليد.
// المبدأ (Spec §36): ما يمكن ترميمه برمجيًّا يُصلَح في الـPipeline — لا بطلب من
// النموذج في الـPrompt (طلب الإصلاح من الـPrompt = عشوائية في الإخراج)؛ وما لا
// يمكن إصلاحه (نقاء المادة، المنهج) يبقى خطأً صريحًا.

import { describe, it, expect } from 'vitest';
import { buildBlueprint } from '../src/exams/exam-blueprint.js';
import { validateExam } from '../src/exams/exam-pipeline.js';
import { repairExam } from '../src/exams/repair.js';
import { scopeLessonsForTrimester } from '../src/exams/curriculum-index.js';

const LEVEL = 'year3';
const SUBJECT = 'arabic';
const TERM = 1;

/** درس حقيقي من نطاق المنهج (لا اختلاق — §2). */
function lessonFixture() {
  const { lessons } = scopeLessonsForTrimester({ level: LEVEL, subject: SUBJECT, trimester: TERM });
  return lessons.find((l) => (l.competencies || []).length && (l.objectives || []).length) || lessons[0];
}

function bpOf(over = {}) {
  return buildBlueprint({ level: LEVEL, subject: SUBJECT, trimester: TERM, questionCount: 4, targetPoints: 10, durationMinutes: 25, ...over });
}

/** سند نصّي سليم: كل أرقام الأسئلة واردة فيه (§42). */
const STIMULUS = {
  id: 's1',
  title: 'السند 1: مكتبة المدرسة',
  text: 'في مكتبة المدرسة 120 كتابًا و45 دفترًا. رتّب المكتبي 155 كتابًا على الرف الأول و175 كتابًا على الرف الثاني، ثمّ وزّع 165 قلمًا على التلاميذ.',
  purpose: 'قراءة معطيات',
  stimulusType: 'text'
};

/** 4 أسئلة سليمة داخل النطاق بمجموع 10 نقاط (متناسقة مع المادّة §55). */
function questionsFixture() {
  const l = lessonFixture();
  const common = {
    grade: LEVEL, subject: SUBJECT, term: TERM,
    lesson: l.title, competency: l.competencies[0] || l.title,
    objective: l.objectives[0] || l.title, domain: l.domain || null, sindId: 's1'
  };
  return [
    { ...common, id: 'q1', type: 'MCQ', difficulty: 1, points: 2.5, estimatedTime: 2, prompt: 'كم كتابًا رتّب المكتبي على الرف الأول ؟', options: ['155', '175', '45'], correctAnswer: '155' },
    { ...common, id: 'q2', type: 'TRUE_FALSE', difficulty: 2, points: 2.5, estimatedTime: 2, prompt: 'سند يذكر 165 قلمًا وزّعها المكتبي على التلاميذ.', correctAnswer: 'صواب' },
    { ...common, id: 'q3', type: 'FILL_BLANK', difficulty: 2, points: 2.5, estimatedTime: 2, prompt: 'أعاد المكتبي ‏…‏ كتابًا إلى الرف.', correctAnswer: '45' },
    { ...common, id: 'q4', type: 'OPEN', difficulty: 3, points: 2.5, estimatedTime: 4, prompt: 'اشرح بأسلوبك كيف تساعدك المكتبة في تحسين قراءتك.', expectedResponseType: 'جملة', answerLines: 3 }
  ];
}

const validate = (questions, stimuli = [STIMULUS], opts = {}) => {
  const bp = bpOf(opts.bpOver);
  return validateExam({
    blueprint: bp,
    questions,
    stimuli,
    stimulusRequired: true,
    durationMinutes: bp.durationMinutes
  }, opts.flags || {});
};

describe('الإصلاح الحتمي في الـPipeline (repair.js) — لا في الـPrompt', () => {
  it('الأساس: اختبار سليم بلا إصلاحات يبقى ناجحًا', () => {
    const res = validate(questionsFixture());
    expect(res.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(res.approved).toBe(true);
    expect(res.repairNotes).toHaveLength(0);
  });

  it('سند معلّق «s999» ← يُعاد ربطه حتميًّا بلا رفض (§151)', () => {
    const qs = questionsFixture().map((q, i) => (i === 0 ? { ...q, sindId: 's999' } : q));
    const res = validate(qs);
    expect(res.issues.map((i) => i.code)).not.toContain('CROSS_SIND_REFERENCE');
    expect(res.repairNotes.map((n) => n.code)).toContain('SIND_REF_REBOUND');
    expect(res.audit.find((a) => a.id === 'repair').status).toBe('warn');
    expect(res.questions[0].sindId).toBe('s1'); // أُعيد الربط بأقرب سند
    expect(res.approved).toBe(true);
  });

  it('نوع مثير خارج ملف المادة ← يُصلَح لا يُهمل (§14)', () => {
    const res = validate(questionsFixture(), [{ ...STIMULUS, stimulusType: 'equation' }]);
    expect(res.repairNotes.map((n) => n.code)).toContain('STIMULUS_TYPE_FIXED');
    expect(res.stimuli[0].stimulusType).toBe('text');
    expect(res.stimuli[0].requestedStimulusType).toBe('equation'); // ما طلبه النموذج محفوظ للشفافية
    expect(res.issues.some((i) => i.code === 'STIMULUS_TYPE')).toBe(false);
    expect(res.approved).toBe(true);
  });

  it('صيغة صح/خطأ من النموذج «صحيح» ← الصيغة القانونية «صواب» (§27)', () => {
    const qs = questionsFixture().map((q) => (q.id === 'q2' ? { ...q, correctAnswer: 'صحيح' } : q));
    const res = validate(qs);
    expect(res.repairNotes.map((n) => n.code)).toContain('TF_ANSWER_FIXED');
    expect(res.questions.find((q) => q.id === 'q2').correctAnswer).toBe('صواب');
    expect(res.issues.some((i) => i.code === 'TF_ANSWER')).toBe(false);
    expect(res.approved).toBe(true);
  });

  it('إجابة اختيار تطابق خيارًا بعد التطبيع ← تُثبَّت على نص الخيار (§26)', () => {
    const qs = questionsFixture().map((q) => (q.id === 'q1'
      ? { ...q, prompt: 'أيّ مكان يرتّب فيه المكتبي الكتب ؟', options: ['المكتبة', 'المطبخ', 'الحديقة'], correctAnswer: 'المَكتبة' }
      : q));
    const res = validate(qs);
    expect(res.repairNotes.map((n) => n.code)).toContain('MCQ_ANSWER_ALIGNED');
    expect(res.questions.find((q) => q.id === 'q1').correctAnswer).toBe('المكتبة');
    expect(res.issues.some((i) => i.code === 'ANSWER_NOT_OPTION')).toBe(false);
    expect(res.approved).toBe(true);
  });

  it('بدائل متطابقة بعد التطبيع ← تُحذف التكرارات لا تُرفض الورقة (§91)', () => {
    const qs = questionsFixture().map((q) => (q.id === 'q1'
      ? { ...q, options: ['المكتبة', 'المكتبة', 'المطبخ'], correctAnswer: 'المكتبة', prompt: 'أيّ مكان يرتّب فيه المكتبي الكتب ؟' }
      : q));
    const res = validate(qs);
    expect(res.repairNotes.map((n) => n.code)).toContain('OPTIONS_DEDUPE');
    expect(res.questions.find((q) => q.id === 'q1').options).toEqual(['المكتبة', 'المطبخ']);
    expect(res.issues.some((i) => i.code === 'MULTIPLE_CORRECT' || i.code === 'OPTIONS_DUPLICATE')).toBe(false);
    expect(res.approved).toBe(true);
  });

  it('عدّاد المخطّط: «3 من 4» لا تمرّ ناجحة مع requireCount — وبلاها تبقى القديمة (§51)', () => {
    const partial = questionsFixture().slice(0, 3);
    const withFlag = validate(partial, [STIMULUS], { flags: { requireCount: true } });
    expect(withFlag.issues.some((i) => i.code === 'QUESTION_COUNT_MISMATCH' && i.severity === 'error')).toBe(true);
    expect(withFlag.audit.find((a) => a.id === 'count').status).toBe('fail');
    expect(withFlag.approved).toBe(false);

    const withoutFlag = validate(partial);
    expect(withoutFlag.issues.some((i) => i.code === 'QUESTION_COUNT_MISMATCH')).toBe(false);
    expect(withoutFlag.approved).toBe(true);
  });

  it('الإصلاح حتمي وقابل للتكرار: التشغيل الثاني بلا ملاحظات جديدة', () => {
    const bp = bpOf();
    const messy = questionsFixture().map((q, i) => (i === 0 ? { ...q, sindId: 's999' } : q.id === 'q2' ? { ...q, correctAnswer: 'صحيح' } : q));
    const r1 = repairExam({ blueprint: bp, questions: messy, stimuli: [{ ...STIMULUS, stimulusType: 'equation' }] });
    expect(r1.notes.length).toBeGreaterThanOrEqual(3);
    const r2 = repairExam({ blueprint: bp, questions: r1.questions, stimuli: r1.stimuli });
    expect(r2.notes).toHaveLength(0);
    expect(r2.questions).toEqual(r1.questions);
    expect(r2.stimuli).toEqual(r1.stimuli);
  });

  it('نقاء المادة لا يُرمَّم: الاختلاط يبقى خطأً مرفوضًا (§55,§79)', () => {
    const qs = questionsFixture().map((q, i) => (i === 0
      ? { ...q, prompt: 'ما مجموع 120 و 45 ؟', options: ['165', '175', '155'], correctAnswer: '165' }
      : q));
    const res = validate(qs);
    expect(res.issues.some((i) => i.code === 'SUBJECT_MIX' && i.severity === 'error')).toBe(true);
    expect(res.repairNotes.map((n) => n.code)).not.toContain('SUBJECT_MIX');
    expect(res.approved).toBe(false);
  });
});
