import { describe, it, expect } from 'vitest';
import { gradeOfficialExam } from '../src/services/officialExamService.js';

// عطل قاتل فيTMS: اختبار يدوي بلا جداول إسناد ولا مفاتيح إجابة ⇒ كان يُسجَّل 0/20
// بحالة «مصحَّح» و needsManualGrading=false ⇒ التلميذ يرى صفرًا ظلمًا ولا يُطلب تصحيح يدوي.
describe('gradeOfficialExam — صدق التصحيح الآلي', () => {
  const mastery = { none: 0, below: 2, min: 5, max: 8 };

  const criteria = [{ id: 'مع1', label: 'الجمع والطرح', mastery }];

  it('بلا جداول إسناد: يطلب التصحيح اليدوي ولا يدّعي تصحيحًا', () => {
    const content = {
      questions: [
        { id: 'q1', type: 'MCQ', prompt: '3+4؟', options: ['6', '7'], points: 1, criterion: 'مع1' },
        { id: 'q2', type: 'FILL_BLANK', prompt: '7+...=31', points: 2, criterion: 'مع1' }
      ]
    };
    const r = gradeOfficialExam(content, { q1: '7', q2: '24' });
    expect(r.needsManualGrading).toBe(true);
    expect(r.reason).toBe('NO_CRITERIA');
    expect(r.total).toBe(0);
    expect(r.totalMax).toBe(20);
    expect(r.manualCriteria).toHaveLength(1);
  });

  it('سؤال مقفول بلا مفتاح إجابة: لا يُحتسب صفرًا بل يبقى للتصحيح اليدوي', () => {
    const content = {
      criteria,
      questions: [
        { id: 'q1', type: 'MCQ', prompt: '3+4؟', options: ['6', '7'], points: 1, criterion: 'مع1' },
        { id: 'q2', type: 'FILL_BLANK', prompt: '7+...=31', points: 2, criterion: 'مع1' }
      ]
    };
    const r = gradeOfficialExam(content, { q1: '7', q2: '24' });
    expect(r.needsManualGrading).toBe(true);
    expect(r.reason).toBe('MISSING_ANSWER_KEYS');
    expect(r.unkeyedQuestions).toHaveLength(2);
    expect(r.criteria[0].autoCorrected).toBe(false);
  });

  it('بمفاتيح كاملة: يصحّح آليًّا ويمنح نقاط masteryMax', () => {
    const content = {
      criteria,
      questions: [
        { id: 'q1', type: 'MCQ', prompt: '3+4؟', options: ['6', '7'], points: 1, criterion: 'مع1', correct: '7' },
        { id: 'q2', type: 'FILL_BLANK', prompt: '7+...=31', points: 2, criterion: 'مع1', correctAnswer: '24' }
      ]
    };
    const good = gradeOfficialExam(content, { q1: '7', q2: '24' });
    expect(good.needsManualGrading).toBe(false);
    expect(good.reason).toBeNull();
    expect(good.total).toBe(mastery.max);
    expect(good.percent).toBe(100);
    expect(good.totalMax).toBe(mastery.max);

    const partial = gradeOfficialExam(content, { q1: '6', q2: '31' });
    expect(partial.needsManualGrading).toBe(false);
    expect(partial.total).toBe(mastery.none);
    expect(partial.percent).toBe(0);

    const half = gradeOfficialExam(content, { q1: '7', q2: '31' });
    expect(half.total).toBe(mastery.min);
    expect(half.percent).toBe(Math.round((mastery.min / mastery.max) * 100));
  });

  it('مفتاح بدائل (|) لسؤال الفراغ + الترتيب', () => {
    const content = {
      criteria,
      questions: [
        { id: 'q1', type: 'FILL_BLANK', prompt: '2+2=', points: 1, criterion: 'مع1', correctAnswer: '4|أربعة' },
        { id: 'q2', type: 'ORDER', prompt: 'رتّب', points: 1, criterion: 'مع1', orderItems: ['أ', 'ب', 'ج'] }
      ]
    };
    const r = gradeOfficialExam(content, { q1: 'أربعة', q2: ['أ', 'ب', 'ج'] });
    expect(r.needsManualGrading).toBe(false);
    expect(r.total).toBe(mastery.max);
  });

  it('سؤال مفتوح فقط ⇒ تصحيح يدوي (لا صفر آلي)', () => {
    const content = {
      criteria,
      questions: [{ id: 'q1', type: 'OPEN', prompt: 'اشرح', points: 2, criterion: 'مع1', answerLines: 4 }]
    };
    const r = gradeOfficialExam(content, { q1: 'شرح طويل' });
    expect(r.needsManualGrading).toBe(true);
    expect(r.reason).toBe('OPEN_QUESTIONS');
    expect(r.manualCriteria).toHaveLength(1);
    expect(r.criteria[0].pendingManualCount).toBe(1);
  });

  it('معيار مفتوح + آخر بمفاتيح: يُصحَّح ما له مفتاح ويبقى ما يحتاج يدويًا', () => {
    const content = {
      criteria: [
        { id: 'مع1', label: 'مقروءة', mastery },
        { id: 'مع2', label: 'تعبير', mastery }
      ],
      questions: [
        { id: 'q1', type: 'MCQ', prompt: '؟', points: 1, criterion: 'مع1', correct: 'ب' },
        { id: 'q2', type: 'OPEN', prompt: 'اشرح', points: 2, criterion: 'مع2', answerLines: 4 }
      ]
    };
    const r = gradeOfficialExam(content, { q1: 'ب', q2: 'نص' });
    expect(r.needsManualGrading).toBe(true);
    expect(r.criteria.find((c) => c.criterion === 'مع1').autoCorrected).toBe(true);
    expect(r.criteria.find((c) => c.criterion === 'مع1').earned).toBe(mastery.max);
    expect(r.criteria.find((c) => c.criterion === 'مع2').autoCorrected).toBe(false);
  });
});