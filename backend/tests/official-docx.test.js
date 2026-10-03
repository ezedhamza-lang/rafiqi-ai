// تصدير Word الرسمي (§D12,§B3,§105): فحص الملف المُنتَج فعلًا (zip → word/document.xml).
//
// ثلاث ضمانات شكاوى المعلّم الحقيقية من exam-20:
//   1) السند المحفوظ يُطبع في الورقة (لا ورقة «تحكي على السند بلا سند»).
//   2) المساحات §D12/§B3 موجودة: layout «vertical» ← إطار معماري، «drawing» ← إطار رسم.
//   3) سؤال الترتيب بلا عناصر ← أسطر مرقّمة بدل فراغ يُفقد التلميذ مكان إجابته.
// بلا قاعدة بيانات وبلا شبكة — JSZip يقرأ الـdocx نفسه.

import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildOfficialDocx, prepareExamForDocx } from '../src/services/officialDocxService.js';

const CONTEXT = { level: 'year4', trimester: 1, title: 'اختبار تجريبي', teacherName: 'أستاذ' };

async function docxParts(examContent) {
  const examData = prepareExamForDocx(examContent, CONTEXT);
  const buf = await buildOfficialDocx(examData, CONTEXT);
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml').async('string');
  return { xml, text: xml.replace(/<[^>]+>/g, '') };
}

function fixture() {
  return {
    title: 'اختبار الرياضيات',
    subject: 'math',
    level: 'year4',
    trimester: 1,
    durationMinutes: 60,
    criteria: [{ id: 'مع1', label: 'المهارة الأساسية', mastery: { max: 3, min: 2, none: 0, below: 1 } }],
    passages: [
      { id: 's1', title: 'السند 1: مكتبة المدرسة', text: 'تحتوي المكتبة المدرسية على 3500 كتاب عربي.' }
    ],
    questions: [
      { id: 'q1', type: 'MCQ', prompt: 'ما العدد الجملي للكتب حسب السند 1 ؟', options: ['3500', '2500', '4500'], correct: 'أ', points: 2, criterion: 'مع1' },
      { id: 'q2', type: 'ORDER', prompt: 'رتّب خطوات المسار على الشبكة.', points: 3, criterion: 'مع1' },
      { id: 'q3', type: 'OPEN', prompt: 'أنجز العملية الآتية عموديًّا: 4200 + 1800.', points: 3, criterion: 'مع1', layout: 'vertical' },
      { id: 'q4', type: 'OPEN', prompt: 'ارسم مسارًا من النقطة أ إلى ب.', points: 2, criterion: 'مع1', layout: 'drawing' }
    ]
  };
}

describe('تصدير Word الرسمي: سند + مساحات + بديل ترتيب', () => {
  it('السند المحفوظ يُطبع في الورقة (لا ورقة بلا سند)', async () => {
    const { text } = await docxParts(fixture());
    expect(text).toContain('السند 1: مكتبة المدرسة');
    expect(text).toContain('3500 كتاب عربي');
  });

  it('layout «vertical» و«drawing» ← إطاران مقفولان للحل والرسم (§D12,§B3)', async () => {
    const { xml, text } = await docxParts(fixture());
    // جدول الترويسة + جدول إسناد الأعداد + إطار العمودي + إطار الرسم = 4 على الأقل
    const tables = (xml.match(/<w:tbl>/g) || []).length;
    expect(tables, 'إطار العملية العمودية + إطار الرسم مضافان إلى جدولَي الترويسة والمعايير').toBeGreaterThanOrEqual(4);
    expect(text).toContain('أنجز العملية الآتية عموديًّا');
    expect(text).toContain('ارسم مسارًا');
  });

  it('سؤال ترتيب بلا عناصر ← أسطر مرقّمة بدل الفراغ (مكان للإجابة دائمًا)', async () => {
    const { text } = await docxParts(fixture());
    expect(text).toContain('رتّب خطوات المسار');
    expect(text, 'أسطر مرقّمة 1) 2) 3) 4)').toMatch(/1\)\s*\.{10,}/);
    expect(text).toMatch(/4\)\s*\.{10,}/);
  });

  it('ترتيب بعناصر ← مربّعات مرتبة كما كانت تُطبع (سلوك قائم لا ينكسر)', async () => {
    const content = fixture();
    content.questions[1].orderItems = ['الانطلاق', 'تقاطع الشبكة', 'الوصول'];
    const { text } = await docxParts(content);
    expect(text).toContain('□');
    expect(text).toContain('تقاطع الشبكة');
    expect(text).not.toMatch(/1\)\s*\.{10,}/);
  });

  it('ورقة بلا سند ولا مساحات خاصة ← تُطبع بلا انهيار (سلوك التصدير عام)', async () => {
    const content = {
      title: 'اختبار صغير',
      subject: 'arabic',
      level: 'year3',
      trimester: 1,
      criteria: [{ id: 'مع1', label: 'الفهم', mastery: { max: 3, min: 2, none: 0, below: 1 } }],
      passages: [],
      questions: [
        { id: 'q1', type: 'TRUE_FALSE', prompt: 'العين عضو الإبصار.', correct: 'صواب', points: 1 }
      ]
    };
    const { text } = await docxParts(content);
    expect(text).toContain('العين عضو الإبصار.');
    expect(text).toContain('صحيح');
    expect(text).toContain('خطأ');
  });
});
