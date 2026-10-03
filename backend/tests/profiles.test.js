// اختبارات بنية الملفّات (Profiles) والمحقّقات المتخصصة (Spec §2-§10,§33-§34).
// المرجع: كل ملف مادة/سنة/وضع ملف بيانات — والبرومبت والتحقّق يقرآن منه معًا
// (صدق مرجعي واحد). ونمنع هنا أن يَعِد البرومبت بمهمة لا يقبلها التوليد (§31,§51).

import { describe, it, expect } from 'vitest';
import { SUBJECT_PROFILES, getSubjectProfile, forbidsArithmetic, EVIDENCE_KINDS } from '../src/exams/profiles/subject-profiles.js';
import { resolveProfiles, defaultStimulusType, getGradeProfile, getModeProfile } from '../src/exams/profiles/index.js';
import { GENERATABLE_TYPES } from '../src/exams/question-validator.js';
import { runSubjectValidators, arithmeticSignal } from '../src/exams/subject-validators.js';
import { buildBlueprint } from '../src/exams/exam-blueprint.js';
import { buildExamPrompt } from '../src/exams/generation.js';

const SUBJECT_CODES = Object.keys(SUBJECT_PROFILES);

describe('ملفات المواد (subject-profiles)', () => {
  it('المهام المفضّلة كلها قابلة للتوليد — لا نَعِد بمهمة تُسقط (§31,§51)', () => {
    for (const code of SUBJECT_CODES) {
      const sp = SUBJECT_PROFILES[code];
      const extra = sp.preferredTaskTypes.filter((t) => !GENERATABLE_TYPES.includes(t));
      expect(extra, `${code}: أنواع غير قابلة للتوليد ${extra.join(',')}`).toEqual([]);
    }
  });

  it('نوع المثير الافتراضي مشتقّ من ملف المادة ومقبول فيه (§14)', () => {
    for (const code of SUBJECT_CODES) {
      const sp = SUBJECT_PROFILES[code];
      expect(sp.stimulusTypes, code).toContain(defaultStimulusType(code));
    }
  });

  it('الحساب: ممنوع في غير الرياضيات ومسموح فيها (§79)', () => {
    expect(forbidsArithmetic('math')).toBe(false);
    expect(forbidsArithmetic('MATH')).toBe(false);
    expect(forbidsArithmetic('الرياضيات')).toBe(false);
    for (const code of SUBJECT_CODES.filter((c) => c !== 'math' && c !== 'default')) {
      expect(forbidsArithmetic(code), code).toBe(true);
    }
    expect(forbidsArithmetic('مادة مجهولة')).toBe(true); // الرمز المجهول ← الملف العام الحذِر
  });

  it('ملف مجهول يقع على default ولا يرمي (لا اختراق مسار §58)', () => {
    const sp = getSubjectProfile('كيمياء-غير-معرّفة');
    expect(sp.id).toBe('default');
    expect(sp.forbidArithmetic).not.toBe(false);
  });

  it('لكل مادة دليلها ومحدّقها المتخصص', () => {
    expect(getSubjectProfile('math').evidenceKind).toBe('numeric');
    expect(getSubjectProfile('reading').evidenceKind).toBe('text');
    expect(getSubjectProfile('science').evidenceKind).toBe('visual');
    expect(getSubjectProfile('arabic').evidenceKind).toBe('linguistic');
    expect(getSubjectProfile('production').evidenceKind).toBe('rubric');
    for (const kind of Object.values(EVIDENCE_KINDS)) expect(typeof kind).toBe('string');

    expect(getSubjectProfile('math').validators).toEqual(['math']);
    expect(getSubjectProfile('reading').validators).toEqual(['reading']);
    expect(getSubjectProfile('science').validators).toEqual(['science']);
    expect(getSubjectProfile('arabic').validators).toEqual(['language']);
    expect(getSubjectProfile('production').validators).toEqual(['writing']);
  });
});

describe('ملفات السنوات والأوضاع + resolveProfiles', () => {
  it('ملف السنة يعطي تسمية وطول تعليمية (§39)', () => {
    const y1 = getGradeProfile('year1');
    const y5 = getGradeProfile('year5');
    expect(y1.label).toContain('الأولى');
    expect(y5.label).toContain('الخامسة');
    expect(y1.maxPrompt).toBeGreaterThan(0);
    expect(y1.maxPrompt).toBeLessThanOrEqual(y5.maxPrompt); // السنة الصغيرة تعليمية أقصر
  });

  it('ملف وضع التقييم يعطي تسمية وقواعد', () => {
    const term = getModeProfile('term');
    expect(term.label).toBeTruthy();
    expect(Array.isArray(term.promptRules)).toBe(true);
  });

  it('resolveProfiles يجمع المادة + السنة + الوضع + الدليل في تعبير واحد', () => {
    const r = resolveProfiles({ subject: 'math', grade: 'year5', assessmentType: 'term' });
    expect(r.subject.id).toBe('math');
    expect(r.grade.id).toBe('year5');
    expect(r.mode.id).toBe('term');
    expect(r.evidenceKind).toBe(EVIDENCE_KINDS.numeric);
    expect(r.stimulusHint).toBe(r.subject.stimulusHint);
  });
});

describe('البرومبت لا يَعِد بما لا يقبله التوليد', () => {
  it('لا «MATCHING/ORDERING» في برومبت أي مادة (§31,§51)', () => {
    for (const subject of ['math', 'reading', 'science', 'arabic', 'production', 'french', 'english']) {
      const bp = buildBlueprint({ level: 'year3', subject, trimester: 1, questionCount: 6, targetPoints: 20 });
      const p = buildExamPrompt(bp, {});
      const all = `${p.system}\n${p.user}`;
      expect(all, subject).not.toMatch(/MATCHING|ORDERING/);
      // المهام المفضّلة المعلنة كليًّا قابلة للتوليد
      const declared = all.match(/أنواع المهام المفضّلة: ([^\n]+)/);
      expect(declared, subject).toBeTruthy();
      declared[1].split('،').forEach((t) => expect(GENERATABLE_TYPES, subject).toContain(t.trim()));
    }
  });
});

describe('المحقّقات المتخصصة (PASS AND PASS)', () => {
  const bp = (subject) => buildBlueprint({ level: 'year3', subject, trimester: 1, questionCount: 4, targetPoints: 10 });
  const q = (over = {}) => ({ type: 'MCQ', prompt: 'سؤال عام', options: ['أ', 'ب', 'ج'], correctAnswer: 'أ', ...over });

  it('رياضيات بلا معطيات رقمية ولا شكل ← رفض MATH_NO_DATA (§42,§79)', () => {
    const r = runSubjectValidators({ blueprint: bp('math'), questions: [q()], stimuli: [{ id: 's1', text: 'نص بلا أرقام إطلاقًا' }] });
    expect(r.ran).toEqual(['math']);
    expect(r.issues.some((i) => i.code === 'MATH_NO_DATA' && i.severity === 'error')).toBe(true);
  });

  it('رياضيات فيها أرقام ← بلا MATH_NO_DATA', () => {
    const r = runSubjectValidators({
      blueprint: bp('math'),
      questions: [q({ prompt: 'ما مجموع 120 و 45 ؟', options: ['165', '155', '175'], correctAnswer: '165' })],
      stimuli: [{ id: 's1', text: 'في السوق 120 كتابًا و45 دفترًا.' }]
    });
    expect(r.issues.some((i) => i.code === 'MATH_NO_DATA')).toBe(false);
  });

  it('قراءة بلا نصّ مرجعي ← READING_NO_TEXT (§42)', () => {
    const r = runSubjectValidators({ blueprint: bp('reading'), questions: [q()], stimuli: [] });
    expect(r.issues.some((i) => i.code === 'READING_NO_TEXT')).toBe(true);
  });

  it('إيقاظ بلا مشهد مرصود ← SCIENCE_NO_STIMULUS (§3-4)', () => {
    const r = runSubjectValidators({ blueprint: bp('science'), questions: [q()], stimuli: [] });
    expect(r.issues.some((i) => i.code === 'SCIENCE_NO_STIMULUS')).toBe(true);
  });

  it('إنتاج بلا مهمة إنتاج ← WRITING_NO_PRODUCTION (§26)', () => {
    const r = runSubjectValidators({ blueprint: bp('production'), questions: [q()], stimuli: [{ id: 's1', text: 'محفّز ما' }] });
    expect(r.ran).toEqual(['writing']);
    expect(r.issues.some((i) => i.code === 'WRITING_NO_PRODUCTION' && i.severity === 'error')).toBe(true);
  });

  it('سؤال لغوي لا يستند إلى السند ← LANG_NOT_GROUNDED تنبيه لا رفض (§42)', () => {
    const r = runSubjectValidators({
      blueprint: bp('arabic'),
      // لا جذر مشترك إطلاقًا مع نصّ الحديقة («حديق/مدرس») ← غير مستند فعلًا
      questions: [q({ prompt: 'كم مرّة ينام القطّ في اليوم الواحد ؟' })],
      stimuli: [{ id: 's1', text: 'حديقة مدرستنا صغيرة لكنّها جميلة.' }]
    });
    expect(r.ran).toEqual(['language']);
    expect(r.issues.some((i) => i.code === 'LANG_NOT_GROUNDED' && i.severity === 'warn')).toBe(true);
  });
});

describe('إشارة الحساب §55,§79', () => {
  it('عملية حسابية صريحة تُمسك، والذكر العادي لا', () => {
    expect(arithmeticSignal('ما مجموع 120 و 45 ؟')).toBeTruthy();
    expect(arithmeticSignal('أكمل: 3 + … =')).toBeTruthy();
    expect(arithmeticSignal('24/4 =')).toBeTruthy();
    expect(arithmeticSignal('في المكتبة 135 كتابًا')).toBeNull(); // «الجمعية 12» منطق نفسه: بلا عملية
    expect(arithmeticSignal('ترتّب المكتبي 155 كتابًا على الرف')).toBeNull();
  });
});
