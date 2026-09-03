// ===== بنك الأسئلة الرسمية التونسية =====
// نظام اوفلاين: أسئلة مخزنة مسبقاً، لا تتكرر في الاختبارات
// يحتوي على أسئلة حقيقية مطابقة للنموذج الرسمي لكل مادة وسنة وثلاثي

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BANK_DIR = path.join(__dirname, '..', '..', 'data', 'question-bank');
const USAGE_FILE = path.join(BANK_DIR, 'usage-log.json');
const SAVED_FILE = path.join(BANK_DIR, 'saved-questions.json');

// Ensure directory exists
try {
  if (!fs.existsSync(BANK_DIR)) {
    fs.mkdirSync(BANK_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[questionBank] Could not create bank directory:', e.message);
}

// ===== بنك الأسئلة الرسمية =====
// كل سؤال له: id, subject, year, trimester, criteria, subCriterion, type, content, answer, points

export const QUESTION_BANK = {
  // ============ الرياضيات - السنة الأولى ============
  math: {
    year1: {
      t3: [
        {
          id: 'mt-y1-t3-001',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'COUNTING',
          content: 'عندنا 145 ولد و 135 بنت في المدرسة. كم عدد التلاميذ الكلي؟',
          answer: 280,
          points: 2
        },
        {
          id: 'mt-y1-t3-002',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'VERTICAL_ADD',
          content: 'أكمل عملية الجمع العمودي:',
          operand1: 145,
          operand2: 135,
          answer: 280,
          points: 2
        },
        {
          id: 'mt-y1-t3-003',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'NUMBER_READ',
          content: 'اكتب العدد 785 بالحروف:',
          answer: 'سبعمئة وخمسة وثمانون',
          points: 1
        },
        {
          id: 'mt-y1-t3-004',
          criteria: 'مع1',
          subCriterion: 'مع1ب',
          type: 'COMPARE',
          content: 'قارن بين: 250 ؟ 205',
          answer: '>',
          points: 1
        },
        {
          id: 'mt-y1-t3-005',
          criteria: 'مع1',
          subCriterion: 'مع1ب',
          type: 'ORDER',
          content: 'رتّب الأعداد التالية من الأصغر إلى الأكبر: 370 - 120 - 250',
          answer: '120 - 250 - 370',
          points: 1
        },
        {
          id: 'mt-y1-t3-006',
          criteria: 'مع1',
          subCriterion: 'مع1ج',
          type: 'SEQUENCE',
          content: 'أكمل السلسلة: 5 - 10 - 15 - ... - 25',
          answer: 20,
          points: 1
        },
        {
          id: 'mt-y1-t3-007',
          criteria: 'مع2',
          subCriterion: 'مع2أ',
          type: 'VERTICAL_ADD',
          content: 'أكمل عملية الجمع العمودي:',
          operand1: 234,
          operand2: 123,
          answer: 357,
          points: 2
        },
        {
          id: 'mt-y1-t3-008',
          criteria: 'مع2',
          subCriterion: 'مع2أ',
          type: 'ADDITION',
          content: 'احسب: 120 + 250 =',
          answer: 370,
          points: 1
        },
        {
          id: 'mt-y1-t3-009',
          criteria: 'مع2',
          subCriterion: 'مع2ب',
          type: 'VERTICAL_ADD',
          content: 'أكمل عملية الجمع العمودي:',
          operand1: 167,
          operand2: 248,
          answer: 415,
          points: 2
        },
        {
          id: 'mt-y1-t3-010',
          criteria: 'مع2',
          subCriterion: 'مع2ب',
          type: 'ADDITION',
          content: 'احسب: 275 + 189 =',
          answer: 464,
          points: 1
        },
        {
          id: 'mt-y1-t3-011',
          criteria: 'مع2',
          subCriterion: 'مع2ج',
          type: 'VERTICAL_SUB',
          content: 'أكمل عملية الطرح العمودي:',
          operand1: 350,
          operand2: 120,
          answer: 230,
          points: 2
        },
        {
          id: 'mt-y1-t3-012',
          criteria: 'مع2',
          subCriterion: 'مع2ج',
          type: 'SUBTRACTION',
          content: 'احسب: 450 - 200 =',
          answer: 250,
          points: 1
        },
        {
          id: 'mt-y1-t3-013',
          criteria: 'مع3',
          subCriterion: 'مع3أ',
          type: 'SHAPE',
          content: 'أي شكل له 4 أضلاع متساوية و4 زوايا قائمة؟',
          options: ['مربع', 'مثلث', 'دائرة', 'مستطيل'],
          answer: 'مربع',
          points: 1
        },
        {
          id: 'mt-y1-t3-014',
          criteria: 'مع3',
          subCriterion: 'مع3أ',
          type: 'SHAPE',
          content: 'الشكل الذي له 3 أضلاع هو:',
          options: ['مربع', 'مثلث', 'دائرة', 'مستطيل'],
          answer: 'مثلث',
          points: 1
        },
        {
          id: 'mt-y1-t3-015',
          criteria: 'مع3',
          subCriterion: 'مع3ب',
          type: 'MEASURE',
          content: 'طول القلم 15 سم، طول الكتاب 20 سم. أيهما أطول؟',
          answer: 'الكتاب',
          points: 1
        },
        {
          id: 'mt-y1-t3-016',
          criteria: 'مع4',
          subCriterion: 'مع4',
          type: 'WORD_PROBLEM',
          content: 'لدى خالد 25 كشك ولدى تامر 15 كشك ولدى حسان 33 كشك. احسب:',
          subQuestions: [
            { text: 'احسب عدد كشكات خالد و حسان:', answer: 58 },
            { text: 'اكتب العملية الحسابية لحساب كشكات حسان وحده:', answer: '33' }
          ],
          points: 3
        },
        {
          id: 'mt-y1-t3-017',
          criteria: 'مع3',
          subCriterion: 'مع3ب',
          type: 'COIN',
          content: 'أكمل الجدول:',
          coins: [
            { value: 50, count: 1 },
            { value: 10, count: 2 },
            { value: 5, count: 3 }
          ],
          total: 85,
          points: 2
        },
        {
          id: 'mt-y1-t3-018',
          criteria: 'مع3',
          subCriterion: 'مع3ب',
          type: 'COIN',
          content: 'احسب المبلغ الذي يمكنك شراء به مرطبة و عصير:',
          coins: [50, 20, 10, 5],
          total: 85,
          points: 2
        }
      ],
      t1: [
        {
          id: 'mt-y1-t1-001',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'COUNTING',
          content: 'عدّ الكتل: ■■■■■■■■■',
          answer: 9,
          points: 1
        },
        {
          id: 'mt-y1-t1-002',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'NUMBER_READ',
          content: 'اكتب العدد 7 بالحروف:',
          answer: 'سبعة',
          points: 1
        },
        {
          id: 'mt-y1-t1-003',
          criteria: 'مع1',
          subCriterion: 'مع1ب',
          type: 'COMPARE',
          content: 'أي عدد أكبر: 5 أو 3؟',
          answer: '5',
          points: 1
        },
        {
          id: 'mt-y1-t1-004',
          criteria: 'مع2',
          subCriterion: 'مع2أ',
          type: 'ADDITION',
          content: 'احسب: 3 + 4 =',
          answer: 7,
          points: 1
        },
        {
          id: 'mt-y1-t1-005',
          criteria: 'مع2',
          subCriterion: 'مع2ب',
          type: 'SUBTRACTION',
          content: 'احسب: 8 - 3 =',
          answer: 5,
          points: 1
        }
      ],
      t2: [
        {
          id: 'mt-y1-t2-001',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'NUMBER_READ',
          content: 'اكتب العدد 15 بالحروف:',
          answer: 'خمسة عشر',
          points: 1
        },
        {
          id: 'mt-y1-t2-002',
          criteria: 'مع2',
          subCriterion: 'مع2أ',
          type: 'VERTICAL_ADD',
          content: 'أكمل عملية الجمع العمودي:',
          operand1: 23,
          operand2: 15,
          answer: 38,
          points: 2
        }
      ]
    },
    year2: {
      t3: [
        {
          id: 'mt-y2-t3-001',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'NUMBER_READ',
          content: 'اكتب العدد 785 بالحروف:',
          answer: 'سبعمئة وخمسة وثمانون',
          points: 2
        },
        {
          id: 'mt-y2-t3-002',
          criteria: 'مع1',
          subCriterion: 'مع1ب',
          type: 'ORDER',
          content: 'رتّب الأعداد: 370 - 120 - 250 من الأصغر إلى الأكبر',
          answer: '120 - 250 - 370',
          points: 2
        },
        {
          id: 'mt-y2-t3-003',
          criteria: 'مع2',
          subCriterion: 'مع2أ',
          type: 'VERTICAL_ADD',
          content: 'أكمل عملية الجمع العمودي:',
          operand1: 250,
          operand2: 130,
          answer: 380,
          points: 2
        },
        {
          id: 'mt-y2-t3-004',
          criteria: 'مع2',
          subCriterion: 'مع2ب',
          type: 'VERTICAL_SUB',
          content: 'أكمل عملية الطرح العمودي:',
          operand1: 450,
          operand2: 230,
          answer: 220,
          points: 2
        },
        {
          id: 'mt-y2-t3-005',
          criteria: 'مع2',
          subCriterion: 'مع2ج',
          type: 'VERTICAL_ADD',
          content: 'أكمل عملية الجمع العمودي:',
          operand1: 167,
          operand2: 248,
          answer: 415,
          points: 2
        },
        {
          id: 'mt-y2-t3-006',
          criteria: 'مع3',
          subCriterion: 'مع3أ',
          type: 'SHAPE',
          content: 'له 4 أضلاع و4 زوايا قائمة، هو:',
          options: ['مربع', 'مثلث', 'دائرة', 'مثلث متساوي الأضلاع'],
          answer: 'مربع',
          points: 1
        },
        {
          id: 'mt-y2-t3-007',
          criteria: 'مع3',
          subCriterion: 'مع3ب',
          type: 'MEASURE',
          content: '3 ملم = ... سم',
          answer: '0.3',
          points: 1
        },
        {
          id: 'mt-y2-t3-008',
          criteria: 'تم',
          subCriterion: 'تمأ',
          type: 'WORD_PROBLEM',
          content: 'لدى أحمد 250 ديناراً، اشترى كتاباً بـ 80 د. وكتاباً بـ 65 د. كم بقي معه؟',
          answer: 105,
          points: 3
        },
        {
          id: 'mt-y2-t3-009',
          criteria: 'مع3',
          subCriterion: 'مع3ب',
          type: 'COIN',
          content: 'احسب المبلغ:',
          coins: [200, 100, 50, 20, 10, 5],
          total: 385,
          points: 2
        }
      ],
      t1: [
        {
          id: 'mt-y2-t1-001',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'NUMBER_READ',
          content: 'اكتب العدد 345 بالحروف:',
          answer: 'ثلاثمئة وخمسة وأربعون',
          points: 2
        }
      ],
      t2: [
        {
          id: 'mt-y2-t2-001',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'COMPARE',
          content: 'قارن: 450 ؟ 540',
          answer: '<',
          points: 2
        }
      ]
    }
  },

  // ============ القراءة ============
  reading: {
    year1: {
      t3: [
        {
          id: 'rd-y1-t3-001',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'LETTER_ID',
          content: 'أي حرفٍ هذا: «ب»؟',
          options: ['ب', 'ت', 'ث', 'ج'],
          answer: 'ب',
          points: 2
        },
        {
          id: 'rd-y1-t3-002',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'SYLLABLE',
          content: 'ما هو هذا المقطع: «با»؟',
          options: ['با', 'تا', 'جا', 'حا'],
          answer: 'با',
          points: 2
        },
        {
          id: 'rd-y1-t3-003',
          criteria: 'مع1',
          subCriterion: 'مع1ب',
          type: 'WORD_READ',
          content: 'أي كلمة تعني: «نقرأ فيه الدروس»؟',
          options: ['كِتَاب', 'قَلَم', 'مِفْتَاح', 'تِفَّاحَة'],
          answer: 'كِتَاب',
          points: 2
        },
        {
          id: 'rd-y1-t3-004',
          criteria: 'مع2',
          subCriterion: 'مع2أ',
          type: 'COMPREHENSION',
          content: 'اقرأ: «يأكلُ الطفلُ التفاحةَ.» — ماذا يأكلُ الطفلُ؟',
          options: ['الخبزَ', 'الحليبَ', 'التفاحةَ'],
          answer: 'التفاحةَ',
          points: 3
        },
        {
          id: 'rd-y1-t3-005',
          criteria: 'مع2',
          subCriterion: 'مع2ب',
          type: 'TRUE_FALSE',
          content: 'صواب أم خطأ: الشمسُ ساطعةٌ.',
          answer: true,
          points: 2
        },
        {
          id: 'rd-y1-t3-006',
          criteria: 'مع2',
          subCriterion: 'مع2ب',
          type: 'MATCHING',
          content: 'أربط:',
          pairs: [
            { left: 'الكتابُ', right: 'نقرأُ فيهِ' },
            { left: 'القلمُ', right: 'نكتبُ بهِ' },
            { left: 'الحقيبةُ', right: 'نحملُ فيها الدروسَ' }
          ],
          points: 3
        }
      ],
      t1: [
        {
          id: 'rd-y1-t1-001',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'LETTER_ID',
          content: 'أي حرفٍ هذا: «م»؟',
          options: ['م', 'ن', 'ه', 'و'],
          answer: 'م',
          points: 2
        }
      ],
      t2: [
        {
          id: 'rd-y1-t2-001',
          criteria: 'مع1',
          subCriterion: 'مع1ب',
          type: 'SYLLABLE',
          content: 'ما هو هذا المقطع: «ما»؟',
          options: ['ما', 'نا', 'ها', 'لا'],
          answer: 'ما',
          points: 2
        }
      ]
    },
    year2: {
      t3: [
        {
          id: 'rd-y2-t3-001',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'READING',
          content: 'اقرأ النص: «ذاتَ صباحٍ مشمسٍ، خرجَ سامي إلى الحديقةِ ليلعبَ معَ أخيه.»',
          question: 'مَن خرجَ إلى الحديقةِ؟',
          options: ['سامي', 'ليلى', 'الأم', 'الأخ'],
          answer: 'سامي',
          points: 2
        },
        {
          id: 'rd-y2-t3-002',
          criteria: 'مع1',
          subCriterion: 'مع1ب',
          type: 'TASHKEEL',
          content: 'أكمل التشكيل: الكتابُ ____',
          options: ['مرفوع', 'منصوب', 'مجرور'],
          answer: 'مرفوع',
          points: 2
        },
        {
          id: 'rd-y2-t3-003',
          criteria: 'مع2',
          subCriterion: 'مع2أ',
          type: 'COMPREHENSION',
          content: 'اقرأ: «ذهبَ كريمٌ إلى المكتبةِ فوجدَ كتاباً عن الحيواناتِ.» — إلى أين ذهبَ كريمٌ؟',
          options: ['المدرسة', 'المكتبة', 'الحديقة', 'البيت'],
          answer: 'المكتبة',
          points: 2
        },
        {
          id: 'rd-y2-t3-004',
          criteria: 'مع2',
          subCriterion: 'مع2ب',
          type: 'SYNONYM',
          content: 'ما مرادف كلمة «سعيد»؟',
          options: ['حزين', 'فرحان', 'غاضب', 'تعبان'],
          answer: 'فرحان',
          points: 2
        },
        {
          id: 'rd-y2-t3-005',
          criteria: 'مع2',
          subCriterion: 'مع2ج',
          type: 'FILL_BLANK',
          content: 'أكمل: ذهبَ سامي إلى ...............',
          options: ['المدرسة', 'البيت', 'السوق', 'الحديقة'],
          answer: 'المدرسة',
          points: 2
        },
        {
          id: 'rd-y2-t3-006',
          criteria: 'تم',
          subCriterion: 'تمأ',
          type: 'OPINION',
          content: 'ما رأيك في تصرف ليلى؟ لماذا؟',
          freeLines: 3,
          points: 5
        }
      ],
      t1: [
        {
          id: 'rd-y2-t1-001',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'READING',
          content: 'اقرأ: «في الفصلِ، يدرسُ التلاميذُ القراءةَ والكتابةَ بجدٍّ.»',
          question: 'ماذا يفعلُ التلاميذُ في الفصلِ؟',
          options: ['يلعبون', 'يدرسون', 'ينامون', 'يأكلون'],
          answer: 'يدرسون',
          points: 2
        }
      ],
      t2: [
        {
          id: 'rd-y2-t2-001',
          criteria: 'مع2',
          subCriterion: 'مع2أ',
          type: 'TRUE_FALSE',
          content: 'صواب أم خطأ: البحرُ أزرقُ.',
          answer: true,
          points: 2
        }
      ]
    }
  },

  // ============ الإيقاظ العلمي ============
  science: {
    year1: {
      t3: [
        {
          id: 'sc-y1-t3-001',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'BODY_PART',
          content: 'نبصر بها:',
          options: ['العينان', 'الأذنان', 'اليدان', 'القدمان'],
          answer: 'العينان',
          points: 2
        },
        {
          id: 'sc-y1-t3-002',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'BODY_PART',
          content: 'نسمع بها:',
          options: ['العينان', 'الأذنان', 'الفم', 'الأنف'],
          answer: 'الأذنان',
          points: 2
        },
        {
          id: 'sc-y1-t3-003',
          criteria: 'مع1',
          subCriterion: 'مع1ب',
          type: 'SENSE',
          content: 'نتذوق بها:',
          options: ['الأنف', 'الفم', 'العينان', 'الأذنان'],
          answer: 'الفم',
          points: 2
        },
        {
          id: 'sc-y1-t3-004',
          criteria: 'مع2',
          subCriterion: 'مع2أ',
          type: 'FOOD',
          content: 'أي من هذه صحي للأكل؟',
          options: ['التفاحة', 'علك النعناع', 'المثلجات', 'الشيبس'],
          answer: 'التفاحة',
          points: 2
        },
        {
          id: 'sc-y1-t3-005',
          criteria: 'مع2',
          subCriterion: 'مع2ب',
          type: 'MOVEMENT',
          content: 'الجري حركة:',
          options: ['سريعة', 'بطيئة', 'ثابتة', 'هادئة'],
          answer: 'سريعة',
          points: 2
        },
        {
          id: 'sc-y1-t3-006',
          criteria: 'مع2',
          subCriterion: 'مع2ج',
          type: 'SEASON',
          content: 'في ____ نلبس معطفاً:',
          options: ['الشتاء', 'الصيف', 'الربيع', 'الخريف'],
          answer: 'الشتاء',
          points: 2
        },
        {
          id: 'sc-y1-t3-007',
          criteria: 'مع3',
          subCriterion: 'مع3أ',
          type: 'TRUE_FALSE',
          content: 'صواب أم خطأ: الماء سائل.',
          answer: true,
          points: 2
        },
        {
          id: 'sc-y1-t3-008',
          criteria: 'مع3',
          subCriterion: 'مع3ب',
          type: 'PLANT',
          content: 'ماذا يحتاج النبات لينمو؟',
          options: ['الماء والشمس', 'الظلام', 'الملح', 'الثلج'],
          answer: 'الماء والشمس',
          points: 2
        },
        {
          id: 'sc-y1-t3-009',
          criteria: 'تم',
          subCriterion: 'تمأ',
          type: 'OPINION',
          content: 'لماذا يجب أن نأكل الطعام الصحي؟',
          freeLines: 3,
          points: 5
        }
      ]
    },
    year2: {
      t3: [
        {
          id: 'sc-y2-t3-001',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'ORGAN',
          content: 'عضو العين يقوم بوظيفة:',
          options: ['الرؤية', 'السمع', 'الشم', 'التذوق'],
          answer: 'الرؤية',
          points: 2
        },
        {
          id: 'sc-y2-t3-002',
          criteria: 'مع1',
          subCriterion: 'مع1ب',
          type: 'CARE',
          content: 'من وسائل العناية بالجسم:',
          options: ['غسل اليدين', 'أكل الحلوى', 'النوم كثيراً', 'عدم الاستحمام'],
          answer: 'غسل اليدين',
          points: 2
        },
        {
          id: 'sc-y2-t3-003',
          criteria: 'مع2',
          subCriterion: 'مع2أ',
          type: 'CLASSIFY',
          content: 'القط ينتمي إلى صنف:',
          options: ['ثديي', 'طائر', 'سمك', 'حشرة'],
          answer: 'ثديي',
          points: 2
        },
        {
          id: 'sc-y2-t3-004',
          criteria: 'مع2',
          subCriterion: 'مع2ب',
          type: 'HABITAT',
          content: 'موطن السمكة الطبيعي هو:',
          options: ['الماء', 'الهواء', 'الصحراء', 'الغابة'],
          answer: 'الماء',
          points: 2
        },
        {
          id: 'sc-y2-t3-005',
          criteria: 'مع3',
          subCriterion: 'مع3أ',
          type: 'MATERIAL',
          content: 'مادة صلب، يعوم على الماء هي:',
          options: ['الخشب', 'الحديد', 'البلاستيك', 'الزجاج'],
          answer: 'الخشب',
          points: 2
        },
        {
          id: 'sc-y2-t3-006',
          criteria: 'مع3',
          subCriterion: 'مع3ب',
          type: 'MOTION',
          content: 'حركة السيارة هي حركة:',
          options: ['الدوران', 'التأرجح', 'التدحرج', 'الخط المستقيم'],
          answer: 'الدوران',
          points: 2
        },
        {
          id: 'sc-y2-t3-007',
          criteria: 'تم',
          subCriterion: 'تمأ',
          type: 'OPINION',
          content: 'صمّم تجربة بسيطة لتعرف أي المواد تعوم وأيها تغوص في الماء.',
          freeLines: 4,
          points: 5
        }
      ]
    }
  },

  // ============ الإنتاج الكتابي ============
  production: {
    year1: {
      t3: [
        {
          id: 'pr-y1-t3-001',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'STORY_ORDER',
          content: 'رتّب الصور التالية لتروي قصة ثم اكتب جملة لكل صورة.',
          freeLines: 4,
          points: 5
        },
        {
          id: 'pr-y1-t3-002',
          criteria: 'مع1',
          subCriterion: 'مع1ب',
          type: 'SENTENCE_COMPLETE',
          content: 'أكمل الجملة: في القسمِ ...............',
          freeLines: 2,
          points: 5
        },
        {
          id: 'pr-y1-t3-003',
          criteria: 'مع2',
          subCriterion: 'مع2أ',
          type: 'PICTURE_DESC',
          content: 'انظر إلى الصورة واكتب جملتين أو ثلاثاً تصف ما تراه.',
          freeLines: 4,
          points: 5
        },
        {
          id: 'pr-y1-t3-004',
          criteria: 'مع2',
          subCriterion: 'مع2ب',
          type: 'STORY_COMPLETE',
          content: 'أكمل القصة: في يومٍ جميلٍ، ذهبَ ساميُّ إلى الغابةِ فوجدَ ...............',
          freeLines: 4,
          points: 5
        }
      ]
    },
    year2: {
      t3: [
        {
          id: 'pr-y2-t3-001',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'STORY_ORDER',
          content: 'رتّب الصور التالية لتروي قصة ثم اكتب جملة لكل صورة.',
          freeLines: 4,
          points: 3
        },
        {
          id: 'pr-y2-t3-002',
          criteria: 'مع1',
          subCriterion: 'مع1ب',
          type: 'STORY_COMPLETE',
          content: 'أكمل القصة: في يومٍ جميلٍ، ذهبَ كريمُ إلى الغابةِ فوجدَ ...............',
          freeLines: 3,
          points: 3
        },
        {
          id: 'pr-y2-t3-003',
          criteria: 'مع2',
          subCriterion: 'مع2أ',
          type: 'PICTURE_DESC',
          content: 'انظر إلى الصورة واكتب فقرة من 4-5 جمل تصف ما تراه.',
          freeLines: 5,
          points: 3
        },
        {
          id: 'pr-y2-t3-004',
          criteria: 'مع2',
          subCriterion: 'مع2ب',
          type: 'PERSONAL_WRITE',
          content: 'اكتب تجربة شخصية عن يومك في المدرسة.',
          freeLines: 4,
          points: 3
        }
      ]
    }
  },

  // ============ الخط والإملاء ============
  handwriting: {
    year1: {
      t3: [
        {
          id: 'hw-y1-t3-001',
          criteria: 'مع1',
          subCriterion: 'مع1أ',
          type: 'COPY',
          content: 'انسخ النص بخط جميل: «الطالبُ المجتهدُ ينجحُ في الحياةِ.»',
          freeLines: 3,
          points: 5
        },
        {
          id: 'hw-y1-t3-002',
          criteria: 'مع1',
          subCriterion: 'مع1ب',
          type: 'LETTERS',
          content: 'اكتب الحروف التالية بشكل واضح: (ح - ض - ط)',
          freeLines: 2,
          points: 5
        },
        {
          id: 'hw-y1-t3-003',
          criteria: 'مع2',
          subCriterion: 'مع2أ',
          type: 'SPELLING',
          content: 'ملء الفراغ بالكلمة الصحيحة: الكتابُ ____',
          options: ['مرفوع', 'منصوب', 'مجرور'],
          answer: 'مرفوع',
          points: 5
        },
        {
          id: 'hw-y1-t3-004',
          criteria: 'مع2',
          subCriterion: 'مع2ب',
          type: 'TASHKEEL',
          content: 'ضع التشكيل: الكتابُ (____)',
          options: ['ضمة', 'فتحة', 'كسرة', 'سكون'],
          answer: 'ضمة',
          points: 5
        }
      ]
    }
  }
};

// ===== نظام تتبع الاستخدام =====
// يتأكد أن نفس السؤال لا يُستخدم مرتين في اختبارات نفس المعلم

function loadUsageLog() {
  try {
    if (fs.existsSync(USAGE_FILE)) {
      return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
    }
  } catch (e) {
    // ignore
  }
  return {};
}

function saveUsageLog(log) {
  try {
    fs.mkdirSync(BANK_DIR, { recursive: true });
    fs.writeFileSync(USAGE_FILE, JSON.stringify(log, null, 2), 'utf8');
  } catch (e) {
    console.warn('[questionBank] Could not save usage log:', e.message);
  }
}

// ===== نظام حفظ الأسئلة المولّدة بالذكاء الاصطناعي =====
// يحفظ الأسئلة المولّدة في ملف JSON ليعاد استخدامها لاحقاً بدون ذكاء اصطناعي

function loadSavedQuestions() {
  try {
    if (fs.existsSync(SAVED_FILE)) {
      return JSON.parse(fs.readFileSync(SAVED_FILE, 'utf8'));
    }
  } catch (e) {
    // ignore
  }
  return {};
}

function saveSavedQuestions(data) {
  try {
    fs.mkdirSync(BANK_DIR, { recursive: true });
    fs.writeFileSync(SAVED_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('[questionBank] Could not save questions:', e.message);
  }
}

/**
 * يحفظ أسئلة مولّدة بالذكاء الاصطناعي في البنك
 * @param {string} subject - المادة
 * @param {string} gradeId - السنة
 * @param {string} trimester - الثلاثي (t1, t2, t3)
 * @param {Array} questions - مصفوفة الأسئلة
 * @returns {number} عدد الأسئلة المحفوظة فعلاً (بعد استبعاد المكررة)
 */
export function addQuestionsToBank(subject, gradeId, trimester, questions) {
  const saved = loadSavedQuestions();
  const key = `${subject}-${gradeId}-${trimester}`;

  if (!saved[key]) {
    saved[key] = [];
  }

  const existingIds = new Set(saved[key].map(q => q.id));
  let added = 0;

  for (const q of questions) {
    if (!existingIds.has(q.id)) {
      saved[key].push({
        ...q,
        source: 'ai',
        savedAt: new Date().toISOString()
      });
      existingIds.add(q.id);
      added++;
    }
  }

  if (added > 0) {
    saveSavedQuestions(saved);
  }

  return added;
}

/**
 * يجلب إحصائيات الأسئلة المحفوظة
 */
export function getSavedStats() {
  const saved = loadSavedQuestions();
  let totalSaved = 0;
  const byCombo = {};
  for (const [key, questions] of Object.entries(saved)) {
    totalSaved += questions.length;
    byCombo[key] = questions.length;
  }
  return { totalSaved, byCombo };
}

/**
 * يجلب أسئلة غير مستخدمة لمادة وسنة وثلاثي محددين
 * @param {string} subject - المادة (math, reading, science, etc.)
 * @param {string} gradeId - السنة (year1, year2, etc.)
 * @param {string} trimester - الثلاثي (t1, t2, t3)
 * @param {number} teacherId - رقم المعلم
 * @param {number} count - عدد الأسئلة المطلوبة
 * @returns {Array} مصفوفة الأسئلة
 */
export function getUnusedQuestions(subject, gradeId, trimester, teacherId, count = 10) {
  // دمج الأسئلة الثابتة + المحفوظة من الذكاء الاصطناعي
  const staticBank = QUESTION_BANK[subject]?.[gradeId]?.[trimester] || [];
  const saved = loadSavedQuestions();
  const savedKey = `${subject}-${gradeId}-${trimester}`;
  const savedBank = saved[savedKey] || [];
  const bank = [...staticBank, ...savedBank];

  if (bank.length === 0) return [];

  const usage = loadUsageLog();
  const teacherKey = String(teacherId);
  const usedIds = new Set(usage[teacherKey] || []);

  // فلترة الأسئلة غير المستخدمة
  const unused = bank.filter(q => !usedIds.has(q.id));

  // إذا لم تبق أسئلة غير مستخدمة، نعيد البدء من الأول
  if (unused.length === 0) {
    if (usage[teacherKey]) {
      usage[teacherKey] = usage[teacherKey].filter(id => {
        const prefix = `${subject.slice(0,2)}-${gradeId.slice(-1)}-${trimester}`;
        return !id.startsWith(prefix) && !id.startsWith('ai-');
      });
      saveUsageLog(usage);
    }
    return getUnusedQuestions(subject, gradeId, trimester, teacherId, count);
  }

  // اختيار عشوائي من الأسئلة غير المستخدمة
  const shuffled = unused.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * يحدد الأسئلة كمستخدمة بعد توليد الاختبار
 * @param {number} teacherId - رقم المعلم
 * @param {string[]} questionIds - مصفوفة أرقام الأسئلة
 */
export function markQuestionsAsUsed(teacherId, questionIds) {
  const usage = loadUsageLog();
  const teacherKey = String(teacherId);

  if (!usage[teacherKey]) {
    usage[teacherKey] = [];
  }

  for (const id of questionIds) {
    if (!usage[teacherKey].includes(id)) {
      usage[teacherKey].push(id);
    }
  }

  saveUsageLog(usage);
}

/**
 * يعيد ضبط سجل الاستخدام لمعلم معين
 * @param {number} teacherId - رقم المعلم
 * @param {string} subject - المادة (اختياري، إذا فارغ يعيد ضبط الكل)
 */
export function resetUsage(teacherId, subject = null) {
  const usage = loadUsageLog();
  const teacherKey = String(teacherId);

  if (subject) {
    if (usage[teacherKey]) {
      usage[teacherKey] = usage[teacherKey].filter(id => !id.startsWith(subject.slice(0, 2)));
      saveUsageLog(usage);
    }
  } else {
    delete usage[teacherKey];
    saveUsageLog(usage);
  }
}

/**
 * يجلب إحصائيات البنك
 * @param {string} subject - المادة
 * @param {string} gradeId - السنة
 * @param {string} trimester - الثلاثي
 * @returns {object} إحصائيات
 */
export function getBankStats(subject, gradeId, trimester) {
  const bank = QUESTION_BANK[subject]?.[gradeId]?.[trimester] || [];
  const byCriteria = {};
  const byType = {};

  for (const q of bank) {
    byCriteria[q.criteria] = (byCriteria[q.criteria] || 0) + 1;
    byType[q.type] = (byType[q.type] || 0) + 1;
  }

  return {
    total: bank.length,
    byCriteria,
    byType,
    available: bank.length > 0
  };
}

/**
 * يجلب جميع المواد والسنوات والثلاثيات المتاحة في البنك
 */
export function getAvailableCombinations() {
  const combinations = [];
  const seen = new Set();

  // الأسئلة الثابتة
  for (const [subject, years] of Object.entries(QUESTION_BANK)) {
    for (const [gradeId, trimesters] of Object.entries(years)) {
      for (const [trimester, questions] of Object.entries(trimesters)) {
        if (questions.length > 0) {
          const key = `${subject}-${gradeId}-${trimester}`;
          seen.add(key);
          combinations.push({
            subject,
            gradeId,
            trimester,
            questionCount: questions.length,
            source: 'static'
          });
        }
      }
    }
  }

  // الأسئلة المحفوظة من الذكاء الاصطناعي
  const saved = loadSavedQuestions();
  for (const [key, questions] of Object.entries(saved)) {
    if (questions.length > 0) {
      const [subject, gradeId, trimester] = key.split('-');
      if (seen.has(key)) {
        // زيادة العدد في الموجود
        const existing = combinations.find(c => c.subject === subject && c.gradeId === gradeId && c.trimester === trimester);
        if (existing) {
          existing.questionCount += questions.length;
          existing.source = 'mixed';
        }
      } else {
        combinations.push({
          subject,
          gradeId,
          trimester,
          questionCount: questions.length,
          source: 'ai'
        });
      }
    }
  }

  return combinations;
}
