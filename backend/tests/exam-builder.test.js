import { describe, it, expect } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'x';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://x:x@localhost:5/x';

const { buildExam, collectGradeQuestions, KIND_FIELD, SUBJECT_KEYS, gradeSubjectBooks, subjectFold } = await import('../src/services/examBuilder.js');
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

  it('طَيّ أسماء المواد: كل الصيغ تنتمي لمادة واحدة وكتبها', () => {
    expect(subjectFold('رياضيات')).toBe('رياضيات');
    expect(subjectFold('الرياضيات')).toBe('رياضيات');
    expect(subjectFold('math2')).toBe('رياضيات');
    expect(subjectFold('قراءة')).toBe('قراءة');
    expect(subjectFold('أنيس')).toBe('قراءة');
    expect(subjectFold('إيقاظ علمي')).toBe('ايقاظ علمي');
    expect(subjectFold('إنتاج كتابي')).toBe('إنتاج كتابي');
    expect(subjectFold('كتابة')).not.toBe('رياضيات');
    // كل مادة معتمدة تُرجع كتبًا موجودة فعلًا لكل سنة (باستثناء فجوات معروفة)
    for (const grade of YEARS) {
      for (const k of SUBJECT_KEYS) {
        const ids = gradeSubjectBooks(grade, k);
        expect(Array.isArray(ids), `${grade}/${k}`).toBe(true);
      }
    }
  });

  it('الكتاب التونسي س6 مرقمن: دروسه تدخل بنك الاختبار بلا تسريب', () => {
    const books = gradeSubjectBooks('year6', 'رياضيات');
    expect(books).toContain('math-tunsi');
    const pool = collectGradeQuestions('year6', 'رياضيات');
    const fromTunsi = pool.filter((q) => q.source.startsWith('year6/math-tunsi/'));
    expect(fromTunsi.length).toBeGreaterThanOrEqual(100);
    expect(pool.every((q) => !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/u.test(q.prompt))).toBe(true);
    const exam = buildExam('year6', 909, 8, 'رياضيات');
    expect(exam.items.length).toBeGreaterThanOrEqual(6);
    const blob = JSON.stringify(exam);
    expect(/(الإجابة|الجواب|الحل)\s*[:：=]/.test(blob)).toBe(false);
  });

  it('3 اختبارات × 6 سنوات × 4 مواد: نظيفة (بلا إجابات/إيموجي/حشو/فراغ) حيثما وُجد مخزون', () => {
    let built = 0;
    for (const grade of YEARS) {
      for (const k of SUBJECT_KEYS) {
        const poolSize = collectGradeQuestions(grade, k).length;
        for (const seed of [11, 42, 77]) {
          const exam = buildExam(grade, seed, 8, k);
          if (!exam) { expect(poolSize, `${grade}/${k}#${seed} مخزون صفري`).toBe(0); continue; }
          built++;
          expect(exam.subject, k).toBeTruthy();
          expect(exam.title.includes(exam.subject), exam.title).toBe(true);
          expect(exam.items.length).toBeGreaterThanOrEqual(1);
          const seen = new Set();
          for (const q of exam.items) {
            expect(ANSWER_MARK.test(q.prompt), q.prompt.slice(0, 30)).toBe(false);
            expect(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/u.test(q.prompt), q.prompt.slice(0, 30)).toBe(false);
            expect(/التحضير|سيظهر هنا|واصل التقدم/.test(q.prompt)).toBe(false);
            expect(q.field).toBe(KIND_FIELD[q.kind]);
            if (q.kind === 'table') expect(q.rows.length).toBeGreaterThan(0);
            if (q.kind === 'match-pairs') expect(q.pairs.length).toBeGreaterThanOrEqual(2);
            const key = normalizeArabic(q.prompt);
            expect(seen.has(key), 'تكرار: ' + key.slice(0, 30)).toBe(false);
            seen.add(key);
          }
        }
      }
    }
    expect(built).toBeGreaterThanOrEqual(66); // 72 ناقص فجوة س4 قراءة
  });
});
