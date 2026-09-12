import { describe, it, expect } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'x';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://x:x@localhost:5/x';

const { buildExam, collectGradeQuestions, KIND_FIELD } = await import('../src/services/examBuilder.js');
const { normalizeArabic } = await import('../src/services/curriculumService.js');

const YEARS = ['year1', 'year2', 'year3', 'year4', 'year5', 'year6'];
const ANSWER_MARK = /(الإجابة|الجواب|الحل)\s*[:：=]|⟵|←/;

describe('مجمّع الاختبارات — 60 اختبارًا (10 لكل سنة)', () => {
  it('كل سنة تملك بنك أسئلة حقيقيًا من كتبها', () => {
    for (const grade of YEARS) {
      const pool = collectGradeQuestions(grade);
      expect(pool.length, grade).toBeGreaterThanOrEqual(20);
      expect(pool.every((q) => q.source.startsWith(grade + '/'))).toBe(true);
    }
  });

  it('لا تسريب إجابات ولا مكرر ولا «اختر» بلا خيارات في 10 اختبارات لكل سنة', () => {
    for (const grade of YEARS) {
      for (let i = 0; i < 10; i++) {
        const exam = buildExam(grade, 1000 + i * 137, 8);
        expect(exam, `${grade}/${i}`).toBeTruthy();
        expect(exam.items.length).toBeGreaterThanOrEqual(5);
        const seen = new Set();
        for (const q of exam.items) {
          expect(ANSWER_MARK.test(q.prompt), q.prompt.slice(0, 30)).toBe(false);
          expect(q.field).toBe(KIND_FIELD[q.kind]);
          if (q.kind === 'table') expect(q.rows.length).toBeGreaterThan(0);
          if (q.kind === 'match-pairs') expect(q.pairs.length).toBeGreaterThanOrEqual(2);
          if (/اختر|اختار/.test(q.prompt) && q.kind === 'question') {
            expect(q.options && q.options.length).toBeGreaterThanOrEqual(2);
          }
          const k = normalizeArabic(q.prompt);
          expect(seen.has(k), 'تكرار: ' + k.slice(0, 30)).toBe(false);
          seen.add(k);
        }
      }
    }
  });

  it('كل الاختبارات مختلفة العينة مع حتمية البذرة', () => {
    const a = buildExam('year6', 777, 8);
    const b = buildExam('year6', 777, 8);
    expect(a.items.map((x) => x.id)).toEqual(b.items.map((x) => x.id));
    const c = buildExam('year6', 778, 8);
    expect(c.items.map((x) => x.id).join()).not.toBe(a.items.map((x) => x.id).join());
  });
});
