import { describe, it, expect } from 'vitest';
import { generateStandardsExam } from '../src/services/standardsExamService.js';
import { assembleOfficialExam, renderOfficialHtml } from '../src/services/officialExamTemplateService.js';

describe('القالب الرسمي للامتحانات (نمط الوزارة التونسية)', () => {
  const paper = generateStandardsExam({ gradeId: 'year1', subject: 'math', seed: 'official' });
  const exam = assembleOfficialExam(paper, { gradeId: 'year1', trimester: 3 });

  it('الترويسة تحمل عناصر القالب الرسمي', () => {
    expect(exam.header.schoolLine).toMatch(/^مدرسة :/);
    expect(exam.header.titleLine).toContain('اِختبار الثّلاثي');
    expect(exam.header.subjectLine).toContain('النّشاط : رياضيات');
    expect(exam.header.nameLine).toContain('الإسم');
    expect(exam.header.surnameLine).toContain('اللّقب');
  });

  it('السناد والتعليمات مرقمة بصيغة N-M وموسومة بالمعايير', () => {
    expect(exam.senods.length).toBeGreaterThan(0);
    for (const s of exam.senods) {
      expect(s.text).toMatch(/اُلسَّنَدُ/);
      for (const a of s.activities) {
        expect(a.instruction).toMatch(/اُلتَّعْلِيمَةُ \d+-\d+/);
        expect(a.criterion).toMatch(/^(مع|تم)/);
      }
    }
  });

  it('العتبات وجدول إسناد الأعداد موجودان', () => {
    expect(exam.thresholds.length).toBe(2);
    expect(exam.scoringTable.title).toContain('جدول إسناد');
    expect(exam.scoringTable.zeroRow).toContain('انعدام التّملّك');
    expect(exam.scoringTable.columns.length).toBe(paper.criteria.length);
  });

  it('HTML الطباعة يحتوي كل عناصر القالب الرسمي', () => {
    const html = renderOfficialHtml(exam);
    expect(html).toContain('مدرسة :');
    expect(html).toContain('اُلسَّنَدُ');
    expect(html).toContain('اُلتَّعْلِيمَةُ');
    expect(html).toContain('جدول إسناد الأعـــــــــــــداد');
    expect(html).toContain('انعدام التّملّك');
    expect(html).toContain('@page'); // A4 print
    expect(html).toContain('window.print()');
  });
});