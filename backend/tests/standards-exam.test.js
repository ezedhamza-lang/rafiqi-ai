import { describe, it, expect } from 'vitest';
import { generateStandardsExam, CRITERIA_PRESETS } from '../src/services/standardsExamService.js';
import { generateOfflineQuiz } from '../src/services/offlineQuizGeneratorService.js';

describe('مولّد الامتحانات حسب المعايير الرسمية', () => {
  it('جداول المعايير مجموعها 20 لكل مادة', () => {
    for (const [grade, subjects] of Object.entries(CRITERIA_PRESETS)) {
      for (const [subject, criteria] of Object.entries(subjects)) {
        const total = criteria.reduce((s, c) => s + c.max, 0);
        expect(total, `${grade}/${subject}`).toBe(20);
        for (const c of criteria) {
          expect(c.code).toBeTruthy();
          expect(c.label).toBeTruthy();
          expect(c.standards.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('امتحان رياضيات س1: أسئلة موسومة بالمعايير ومجموع النقاط 20', () => {
    const paper = generateStandardsExam({ gradeId: 'year1', subject: 'math', seed: 't1' });
    expect(paper.error).toBeUndefined();
    expect(paper.totalScore).toBe(20);
    expect(paper.criteria.length).toBe(3);
    // كل سؤال موسوم بمعيار ومعياره المرجعي
    for (const q of paper.questions) {
      expect(q.criterion).toMatch(/^(مع|تم)/);
      expect(q.standardId).toMatch(/^std-/);
      expect(q.prompt).toBeTruthy();
      if (q.type === 'MCQ') {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.correctOption).toBeGreaterThanOrEqual(0);
        expect(q.correctOption).toBeLessThan(q.options.length);
        // الإجابة الصحيحة موجودة فعلاً في الخيارات
        expect(q.options).toContain(q.options[q.correctOption]);
      }
    }
    const objectiveSum = paper.questions.filter((q) => q.type === 'MCQ').reduce((s, q) => s + q.points, 0);
    const freeSum = paper.questions.filter((q) => q.type === 'FREE').reduce((s, q) => s + q.points, 0);
    expect(Math.round((objectiveSum + freeSum) * 2) / 2).toBe(20);
  });

  it('الأسئلة مولّدة إجرائياً: بذرتان مختلفتان تعيدان أسئلة مختلفة غالباً', () => {
    const a = generateStandardsExam({ gradeId: 'year1', subject: 'math', seed: 'aaa' });
    const b = generateStandardsExam({ gradeId: 'year1', subject: 'math', seed: 'bbb' });
    const pa = a.questions.map((q) => q.prompt).join('|');
    const pb = b.questions.map((q) => q.prompt).join('|');
    expect(pa).not.toBe(pb);
  });

  it('نفس البذرة تعيد نفس الامتحان (حتمية للطباعة)', () => {
    const a = generateStandardsExam({ gradeId: 'year1', subject: 'science', seed: 'same' });
    const b = generateStandardsExam({ gradeId: 'year1', subject: 'science', seed: 'same' });
    // نستثني الطابع الزمني (بيانات وصفية لا تخص محتوى الامتحان)
    delete a.generatedAt;
    delete b.generatedAt;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('الإيقاظ العلمي يتبع التقسيم الرسمي الموثق (6+9+5)', () => {
    const paper = generateStandardsExam({ gradeId: 'year1', subject: 'science' });
    const byCode = {};
    for (const c of paper.criteria) byCode[c.code] = c.max;
    expect(byCode['مع1']).toBe(6);
    expect(byCode['مع2']).toBe(9);
    expect(byCode['تم']).toBe(5);
  });

  it('الإنتاج الكتابي: أسئلة حرة بعدد أسطر (تصحيح يدوي)', () => {
    const paper = generateStandardsExam({ gradeId: 'year1', subject: 'production' });
    expect(paper.questions.every((q) => q.type === 'FREE')).toBe(true);
    for (const q of paper.questions) expect(q.freeLines).toBeGreaterThan(0);
  });
});

describe('المولّد المحلي العام (بنك + إجرائي)', () => {
  it('يولّد رياضيات س1 بأسئلة صالحة', () => {
    const paper = generateOfflineQuiz({ gradeId: 'year1', subject: 'math', count: 10 });
    expect(paper.count).toBeGreaterThan(0);
    for (const q of paper.questions) {
      if (q.type === 'MCQ') {
        expect(q.options[q.correctOption]).toBeTruthy();
      }
    }
  });
});