// ===== مولّد الامتحانات الرسمية حسب المعايير الرسمية التونسية =====
//
// يبني امتحاناً مطابقاً للنموذج الرسمي:
// - جدول معايير رسمي مع تجزئة (مع1أ، مع1ب، مع2أ1، مع2ب، إلخ)
// - أسئلة متنوعة: اختيار من متعدد، صواب/خطأ، ربط، إكمال، عمليات عمودية، قطع نقدية
// - جدول إسناد الأعداد مع 4 مستويات تملك
//
// مبني على تحليل نماذج حقيقية من مدرسة قصر بحير

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STANDARDS_PATH = path.join(__dirname, '..', '..', 'data', 'standards.json');

// ============ جداول المعايير الرسمية ============
// كل معيار له: code, label, max (أقصى درجة), subCriteria (تجزئة)
// المجموع الكلي لكل مادة = 20 نقطة

export const CRITERIA_PRESETS = {
  // ============ السنة الأولى (س1) ============
  year1: {
    math: [
      { code: 'مع1', label: 'الأعداد والعمليات الأساسية', max: 6, subCriteria: [
        { code: 'مع1أ', label: 'العد والقراءة والكتابة', max: 2 },
        { code: 'مع1ب', label: 'مقارنة الأعداد', max: 2 },
        { code: 'مع1ج', label: 'إكمال سلسلة أعداد', max: 2 }
      ]},
      { code: 'مع2', label: 'الجمع والطرح', max: 9, subCriteria: [
        { code: 'مع2أ', label: 'جمع بدون احتفاظ', max: 3 },
        { code: 'مع2ب', label: 'جمع مع احتفاظ', max: 3 },
        { code: 'مع2ج', label: 'طرح بدون زيادة', max: 3 }
      ]},
      { code: 'تم', label: 'الفضاء والقياس والأشكال (تميّز)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'تحديد الأشكال الهندسية', max: 2 },
        { code: 'تمب', label: 'القياس والمطابقة', max: 3 }
      ]}
    ],
    science: [
      { code: 'مع1', label: 'جسم الإنسان والحواس', max: 6, subCriteria: [
        { code: 'مع1أ', label: 'أعضاء الجسم ووظائفها', max: 3 },
        { code: 'مع1ب', label: 'الحواس الخمس', max: 3 }
      ]},
      { code: 'مع2', label: 'التغذية والحركة والزمن', max: 9, subCriteria: [
        { code: 'مع2أ', label: 'الغذاء الصحي والغير صحي', max: 3 },
        { code: 'مع2ب', label: 'الحركة والaleza', max: 3 },
        { code: 'مع2ج', label: 'الزمن وال Frm', max: 3 }
      ]},
      { code: 'تم', label: 'الكفايات المتقدمة (تميّز)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'البيئة والivalonement', max: 2 },
        { code: 'تمب', label: 'التجربة العلمية', max: 3 }
      ]}
    ],
    reading: [
      { code: 'مع1', label: 'الحروف والمقاطع', max: 8, subCriteria: [
        { code: 'مع1أ', label: 'تمييز الحروف', max: 4 },
        { code: 'مع1ب', label: 'تكوينمقاطع', max: 4 }
      ]},
      { code: 'مع2', label: 'قراءة الكلمات وفهم الجمل', max: 12, subCriteria: [
        { code: 'مع2أ', label: 'قراءة الكلمات', max: 6 },
        { code: 'مع2ب', label: 'فهم الجمل واستخراج المعنى', max: 6 }
      ]}
    ],
    production: [
      { code: 'مع1', label: 'ترتيب الصور وإكمال الجمل', max: 10, subCriteria: [
        { code: 'مع1أ', label: 'ترتيب الصور', max: 5 },
        { code: 'مع1ب', label: 'إكمال الجمل', max: 5 }
      ]},
      { code: 'مع2', label: 'التعبير عن صورة', max: 10, subCriteria: [
        { code: 'مع2أ', label: 'كتابة جمل', max: 5 },
        { code: 'مع2ب', label: 'التعبير الحر', max: 5 }
      ]}
    ],
    handwriting: [
      { code: 'مع1', label: 'جودة الخط', max: 10, subCriteria: [
        { code: 'مع1أ', label: 'وضوح الحروف', max: 4 },
        { code: 'مع1ب', label: 'التناسق والجمالية', max: 6 }
      ]},
      { code: 'مع2', label: 'الإملاء', max: 10, subCriteria: [
        { code: 'مع2أ', label: 'الكلمات الصحيحة', max: 5 },
        { code: 'مع2ب', label: 'التشكيل', max: 5 }
      ]}
    ]
  },

  // ============ السنة الثانية (س2) ============
  year2: {
    reading: [
      { code: 'مع1', label: 'القراءة الجهرية', max: 6, subCriteria: [
        { code: 'مع1أ', label: 'القراءة المسترسلة', max: 3 },
        { code: 'مع1ب', label: 'التنغيم والتشكيل', max: 3 }
      ]},
      { code: 'مع2', label: 'معالجة النص', max: 9, subCriteria: [
        { code: 'مع2أ', label: 'الإجابة عن أسئلة الفهم', max: 3 },
        { code: 'مع2ب', label: 'استخراج المرادف', max: 3 },
        { code: 'مع2ج', label: 'إكمال كلمات', max: 3 }
      ]},
      { code: 'تم', label: 'إبداء الرأي (تميّز)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'إبداء رأي شخصي', max: 5 }
      ]}
    ],
    grammar: [
      { code: 'مع1', label: 'الجملة والاسم والفعل', max: 7, subCriteria: [
        { code: 'مع1أ', label: 'تحديد الفعل', max: 3 },
        { code: 'مع1ب', label: 'تحديد الاسم', max: 4 }
      ]},
      { code: 'مع2', label: 'الإعراب والبناء', max: 8, subCriteria: [
        { code: 'مع2أ', label: 'إعراب الكلمة', max: 4 },
        { code: 'مع2ب', label: 'المفرد والمثنى والجمع', max: 4 }
      ]},
      { code: 'تم', label: 'التميز في التحليل (تميّز)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'تحليل جملة', max: 5 }
      ]}
    ],
    production: [
      { code: 'مع1', label: 'المقروئية والملاءمة', max: 6, subCriteria: [
        { code: 'مع1أ', label: 'قراءة النص', max: 3 },
        { code: 'مع1ب', label: 'ملاءمة المنتوج', max: 3 }
      ]},
      { code: 'مع2', label: 'سلامة بناء النص', max: 9, subCriteria: [
        { code: 'مع2أ', label: 'اكتمال البنية السردية', max: 3 },
        { code: 'مع2ب', label: 'استعمال الروابط', max: 3 },
        { code: 'مع2ج', label: 'احترام قواعد الرسم', max: 3 }
      ]},
      { code: 'تم', label: 'ثراء اللغة والطرافة (تميّز)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'ثراء المفردات', max: 3 },
        { code: 'تمب', label: 'الطرافة والإبداع', max: 2 }
      ]}
    ],
    handwriting: [
      { code: 'مع1', label: 'جودة الخط', max: 10, subCriteria: [
        { code: 'مع1أ', label: 'وضوح الحروف', max: 4 },
        { code: 'مع1ب', label: 'التناسق والاسترسال', max: 6 }
      ]},
      { code: 'مع2', label: 'الإملاء', max: 10, subCriteria: [
        { code: 'مع2أ', label: 'الكلمات الصحيحة', max: 5 },
        { code: 'مع2ب', label: 'التشكيل والتمييز الصوتي', max: 5 }
      ]}
    ],
    french: [
      { code: 'مع1', label: 'الاستماع والفهم الشفوي', max: 7, subCriteria: [
        { code: 'مع1أ', label: 'فهم الشفوي', max: 4 },
        { code: 'مع1ب', label: 'التفاعل الشفوي', max: 3 }
      ]},
      { code: 'مع2', label: 'القراءة والفهم الكتابي', max: 8, subCriteria: [
        { code: 'مع2أ', label: 'فهم مقروء', max: 4 },
        { code: 'مع2ب', label: 'تحليل نص', max: 4 }
      ]},
      { code: 'تم', label: 'التعبير الكتابي (تميّز)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'كتابة جمل', max: 3 },
        { code: 'تمب', label: 'فقرة قصيرة', max: 2 }
      ]}
    ],
    math: [
      { code: 'مع1', label: 'الأعداد حتى 999', max: 6, subCriteria: [
        { code: 'مع1أ', label: 'قراءة وكتابة الأعداد', max: 3 },
        { code: 'مع1ب', label: 'مقارنة وترتيب', max: 3 }
      ]},
      { code: 'مع2', label: 'الجمع والطرح', max: 7, subCriteria: [
        { code: 'مع2أ', label: 'جمع بدون احتفاظ', max: 3 },
        { code: 'مع2ب', label: 'طرح بدون زيادة', max: 2 },
        { code: 'مع2ج', label: 'جمع مع احتفاظ', max: 2 }
      ]},
      { code: 'مع3', label: 'الهندسة والقياس', max: 4, subCriteria: [
        { code: 'مع3أ', label: 'تحديد الأشكال', max: 2 },
        { code: 'مع3ب', label: 'القياس (سم/ملم)', max: 2 }
      ]},
      { code: 'تم', label: 'وضعيات إدماجية (تميّز)', max: 3, subCriteria: [
        { code: 'تمأ', label: 'مشكلة كتابية', max: 3 }
      ]}
    ],
    science: [
      { code: 'مع1', label: 'جسم الإنسان والحواس', max: 5, subCriteria: [
        { code: 'مع1أ', label: 'أعضاء الجسم', max: 3 },
        { code: 'مع1ب', label: 'العناية بالجسم', max: 2 }
      ]},
      { code: 'مع2', label: 'الكائنات الحية والبيئة', max: 5, subCriteria: [
        { code: 'مع2أ', label: 'تصنيف الكائنات', max: 3 },
        { code: 'مع2ب', label: 'الموطن الطبيعي', max: 2 }
      ]},
      { code: 'مع3', label: 'المادة والطاقة والحركة', max: 5, subCriteria: [
        { code: 'مع3أ', label: 'خصائص المواد', max: 3 },
        { code: 'مع3ب', label: 'أنواع الحركة', max: 2 }
      ]},
      { code: 'تم', label: 'التميز العلمي (تميّز)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'التجربة العلمية', max: 3 },
        { code: 'تمب', label: 'التفكير العلمي', max: 2 }
      ]}
    ],
    islamic: [
      { code: 'مع1', label: 'الحفظ والتلاوة', max: 6, subCriteria: [
        { code: 'مع1أ', label: 'حفظ السور', max: 3 },
        { code: 'مع1ب', label: 'تلاوة صحيحة', max: 3 }
      ]},
      { code: 'مع2', label: 'الفهم والتطبيق', max: 9, subCriteria: [
        { code: 'مع2أ', label: 'فهم المعنى', max: 3 },
        { code: 'مع2ب', label: 'الصواب والخطأ', max: 3 },
        { code: 'مع2ج', label: 'الربط والتطبيق', max: 3 }
      ]},
      { code: 'تم', label: 'إبداء الرأي (تميّز)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'إبداء رأي شخصي', max: 5 }
      ]}
    ],
    civics: [
      { code: 'مع1', label: 'القواعد والواجبات', max: 10, subCriteria: [
        { code: 'مع1أ', label: 'فهم القواعد', max: 5 },
        { code: 'مع1ب', label: 'تطبيق القواعد', max: 5 }
      ]},
      { code: 'مع2', label: 'المواطنة والتعاون', max: 10, subCriteria: [
        { code: 'مع2أ', label: 'فهم المفاهيم', max: 5 },
        { code: 'مع2ب', label: 'المبادئ والقيم', max: 5 }
      ]}
    ],
    technology: [
      { code: 'مع1', label: 'الأدوات والمواد', max: 10, subCriteria: [
        { code: 'مع1أ', label: 'تعريف الأدوات', max: 5 },
        { code: 'مع1ب', label: 'استعمال الأدوات', max: 5 }
      ]},
      { code: 'مع2', label: 'التصميم والإنجاز', max: 10, subCriteria: [
        { code: 'مع2أ', label: 'التخطيط', max: 5 },
        { code: 'مع2ب', label: 'الإنجاز', max: 5 }
      ]}
    ],
    ict: [
      { code: 'مع1', label: 'المكونات والوظائف', max: 10, subCriteria: [
        { code: 'مع1أ', label: 'تعريف المكونات', max: 5 },
        { code: 'مع1ب', label: 'وظيفة كل مكون', max: 5 }
      ]},
      { code: 'مع2', label: 'التعامل مع الحاسوب', max: 10, subCriteria: [
        { code: 'مع2أ', label: 'فتح برامج', max: 5 },
        { code: 'مع2ب', label: 'حفظ وفتح ملفات', max: 5 }
      ]}
    ],
    art: [
      { code: 'مع1', label: 'الرسم والتعبير', max: 10, subCriteria: [
        { code: 'مع1أ', label: 'جودة الرسم', max: 5 },
        { code: 'مع1ب', label: 'التعبير', max: 5 }
      ]},
      { code: 'مع2', label: 'التلوين والتركيب', max: 10, subCriteria: [
        { code: 'مع2أ', label: 'اختيار الألوان', max: 5 },
        { code: 'مع2ب', label: 'التركيب', max: 5 }
      ]}
    ],
    music: [
      { code: 'مع1', label: 'الأناشيد والإيقاع', max: 10, subCriteria: [
        { code: 'مع1أ', label: 'الغناء', max: 5 },
        { code: 'مع1ب', label: 'الإيقاع', max: 5 }
      ]},
      { code: 'مع2', label: 'الآلات والغناء', max: 10, subCriteria: [
        { code: 'مع2أ', label: 'تعريف الآلات', max: 5 },
        { code: 'مع2ب', label: 'العزف', max: 5 }
      ]}
    ],
    pe: [
      { code: 'مع1', label: 'الحركات الأساسية', max: 10, subCriteria: [
        { code: 'مع1أ', label: 'الحركات', max: 5 },
        { code: 'مع1ب', label: 'الإحماء', max: 5 }
      ]},
      { code: 'مع2', label: 'الألعاب والتعاون', max: 10, subCriteria: [
        { code: 'مع2أ', label: 'فهم القواعد', max: 5 },
        { code: 'مع2ب', label: 'المشاركة', max: 5 }
      ]}
    ]
  },

  // ============ السنة الثالثة (س3) ============
  year3: {
    reading: [
      { code: 'مع1', label: 'القراءة الجهرية المسترسلة', max: 6, subCriteria: [
        { code: 'مع1أ', label: 'القراءة السليمة', max: 3 },
        { code: 'مع1ب', label: 'التنغيم والتعبير', max: 3 }
      ]},
      { code: 'مع2', label: 'فهم النص', max: 9, subCriteria: [
        { code: 'مع2أ', label: 'استخراج المعلومات', max: 3 },
        { code: 'مع2ب', label: 'فهم المعنى العام', max: 3 },
        { code: 'مع2ج', label: 'تحليل الشخصيات', max: 3 }
      ]},
      { code: 'تم', label: 'إبداء الرأي والتميّز', max: 5, subCriteria: [
        { code: 'تمأ', label: 'إبداء رأي شخصي', max: 3 },
        { code: 'تمب', label: 'مقارنة وتقييم', max: 2 }
      ]}
    ],
    math: [
      { code: 'مع1', label: 'الأعداد حتى 10000', max: 6, subCriteria: [
        { code: 'مع1أ', label: 'قراءة وكتابة', max: 3 },
        { code: 'مع1ب', label: 'مقارنة وترتيب', max: 3 }
      ]},
      { code: 'مع2', label: 'العمليات الحسابية', max: 7, subCriteria: [
        { code: 'مع2أ', label: 'جمع وطرح', max: 3 },
        { code: 'مع2ب', label: 'الضرب', max: 2 },
        { code: 'مع2ج', label: 'القسمة', max: 2 }
      ]},
      { code: 'مع3', label: 'الهندسة والقياس', max: 4, subCriteria: [
        { code: 'مع3أ', label: 'الأشكال الهندسية', max: 2 },
        { code: 'مع3ب', label: 'المساحة والقياس', max: 2 }
      ]},
      { code: 'تم', label: 'المشكلات الكتابية (تميّز)', max: 3, subCriteria: [
        { code: 'تمأ', label: 'حل مشكلة', max: 3 }
      ]}
    ],
    science: [
      { code: 'مع1', label: 'علوم الحياة', max: 5, subCriteria: [
        { code: 'مع1أ', label: 'الكائنات الحية', max: 3 },
        { code: 'مع1ب', label: 'البيئة وال ecosystem', max: 2 }
      ]},
      { code: 'مع2', label: 'علوم الأرض', max: 5, subCriteria: [
        { code: 'مع2أ', label: 'الطبقات الأرضية', max: 3 },
        { code: 'مع2ب', label: 'الcuaca والمناخ', max: 2 }
      ]},
      { code: 'مع3', label: 'الفيزياء والكيمياء', max: 5, subCriteria: [
        { code: 'مع3أ', label: 'ال力学 الأساسية', max: 3 },
        { code: 'مع3ب', label: 'المواد والخصائص', max: 2 }
      ]},
      { code: 'تم', label: 'التفكير العلمي (تميّز)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'التجربة العلمية', max: 3 },
        { code: 'تمب', label: 'الاستنتاج', max: 2 }
      ]}
    ],
    production: [
      { code: 'مع1', label: 'المقروئية', max: 6, subCriteria: [
        { code: 'مع1أ', label: 'فهم النص', max: 3 },
        { code: 'مع1ب', label: 'ملاءمة الإجابة', max: 3 }
      ]},
      { code: 'مع2', label: 'سلامة بناء النص', max: 9, subCriteria: [
        { code: 'مع2أ', label: 'البنية السردية', max: 3 },
        { code: 'مع2ب', label: 'الروابط والاسترسال', max: 3 },
        { code: 'مع2ج', label: 'قواعد الرسم', max: 3 }
      ]},
      { code: 'تم', label: 'ثراء اللغة (تميّز)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'المفردات والتعبيرات', max: 3 },
        { code: 'تمب', label: 'الإبداع والطرافة', max: 2 }
      ]}
    ],
    handwriting: [
      { code: 'مع1', label: 'جودة الخط', max: 10, subCriteria: [
        { code: 'مع1أ', label: 'وضوح وتناسق', max: 5 },
        { code: 'مع1ب', label: 'استرسال وجمالية', max: 5 }
      ]},
      { code: 'مع2', label: 'الإملاء', max: 10, subCriteria: [
        { code: 'مع2أ', label: 'كلمات صحيحة', max: 5 },
        { code: 'مع2ب', label: 'تشكيل وهمزة', max: 5 }
      ]}
    ],
    islamic: [
      { code: 'مع1', label: 'الحفظ والتلاوة', max: 6, subCriteria: [
        { code: 'مع1أ', label: 'حفظ متقن', max: 3 },
        { code: 'مع1ب', label: 'تلاوة بتجويد', max: 3 }
      ]},
      { code: 'مع2', label: 'الفهم والتطبيق', max: 9, subCriteria: [
        { code: 'مع2أ', label: 'فهم النصوص', max: 3 },
        { code: 'مع2ب', label: 'التطبيق في الحياة', max: 3 },
        { code: 'مع2ج', label: 'الربط بين النصوص', max: 3 }
      ]},
      { code: 'تم', label: 'إبداء الرأي (تميّز)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'تحليل ونقد', max: 3 },
        { code: 'تمب', label: 'رأي شخصي', max: 2 }
      ]}
    ],
    french: [
      { code: 'مع1', label: 'F compréhension orale', max: 7, subCriteria: [
        { code: 'مع1أ', label: 'compréhension', max: 4 },
        { code: 'مع1ب', label: 'expression orale', max: 3 }
      ]},
      { code: 'مع2', label: 'F compréhension écrite', max: 8, subCriteria: [
        { code: 'مع2أ', label: 'lecture et compréhension', max: 4 },
        { code: 'مع2ب', label: 'analyse de texte', max: 4 }
      ]},
      { code: 'تم', label: 'expression écrite (différenciation)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'phrases simples', max: 3 },
        { code: 'تمب', label: 'paragraphe', max: 2 }
      ]}
    ]
  },

  // ============ السنة الرابعة (س4) ============
  year4: {
    reading: [
      { code: 'مع1', label: 'القراءة والتعبير', max: 6, subCriteria: [
        { code: 'مع1أ', label: 'القراءة الجهرية', max: 3 },
        { code: 'مع1ب', label: 'التنغيم', max: 3 }
      ]},
      { code: 'مع2', label: 'فهم النص وتحليله', max: 9, subCriteria: [
        { code: 'مع2أ', label: 'استخراج المعلومات', max: 3 },
        { code: 'مع2ب', label: 'تحليل الأفكار', max: 3 },
        { code: 'مع2ج', label: 'ربط الأحداث', max: 3 }
      ]},
      { code: 'تم', label: 'إبداء الرأي والتميّز', max: 5, subCriteria: [
        { code: 'تمأ', label: 'نقد شخصي', max: 3 },
        { code: 'تمب', label: 'مقارنة', max: 2 }
      ]}
    ],
    math: [
      { code: 'مع1', label: 'الأعداد الكبيرة', max: 6, subCriteria: [
        { code: 'مع1أ', label: 'قراءة وكتابة', max: 3 },
        { code: 'مع1ب', label: 'تقريب وتقييم', max: 3 }
      ]},
      { code: 'مع2', label: 'العمليات المتقدمة', max: 7, subCriteria: [
        { code: 'مع2أ', label: 'الجمع والطرح', max: 3 },
        { code: 'مع2ب', label: 'الضرب والقسمة', max: 4 }
      ]},
      { code: 'مع3', label: 'الهندسة والقياس', max: 4, subCriteria: [
        { code: 'مع3أ', label: 'الأشكال والخصائص', max: 2 },
        { code: 'مع3ب', label: 'المساحة والمحيط', max: 2 }
      ]},
      { code: 'تم', label: 'المشكلات (تميّز)', max: 3, subCriteria: [
        { code: 'تمأ', label: 'مشكلة متعددة الخطوات', max: 3 }
      ]}
    ],
    science: [
      { code: 'مع1', label: 'علوم الحياة', max: 5, subCriteria: [
        { code: 'مع1أ', label: 'الكائنات الحية', max: 3 },
        { code: 'مع1ب', label: 'الوظائف الحيوية', max: 2 }
      ]},
      { code: 'مع2', label: 'علوم الأرض والكون', max: 5, subCriteria: [
        { code: 'مع2أ', label: 'النظام الشمسي', max: 3 },
        { code: 'مع2ب', label: 'الطبقات الأرضية', max: 2 }
      ]},
      { code: 'مع3', label: 'الفيزياء', max: 5, subCriteria: [
        { code: 'مع3أ', label: 'القوى والحركات', max: 3 },
        { code: 'مع3ب', label: 'الطاقة', max: 2 }
      ]},
      { code: 'تم', label: 'التفكير العلمي (تميّز)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'التجربة', max: 3 },
        { code: 'تمب', label: 'الاستنتاج', max: 2 }
      ]}
    ]
  },

  // ============ السنة الخامسة (س5) ============
  year5: {
    reading: [
      { code: 'مع1', label: 'القراءة والإبداع', max: 6, subCriteria: [
        { code: 'مع1أ', label: 'القراءة السليمة', max: 3 },
        { code: 'مع1ب', label: 'التعبير', max: 3 }
      ]},
      { code: 'مع2', label: 'تحليل النص الأدبي', max: 9, subCriteria: [
        { code: 'مع2أ', label: 'فهم عميق', max: 3 },
        { code: 'مع2ب', label: 'تحليل لغوي', max: 3 },
        { code: 'مع2ج', label: 'تحليل بلاغي', max: 3 }
      ]},
      { code: 'تم', label: 'النقد الأدبي (تميّز)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'نقد شخصي', max: 3 },
        { code: 'تمب', label: 'مقارنة نصوص', max: 2 }
      ]}
    ],
    math: [
      { code: 'مع1', label: 'الأعداد والحساب', max: 6, subCriteria: [
        { code: 'مع1أ', label: 'أعداد عشرية', max: 3 },
        { code: 'مع1ب', label: 'العمليات على الأعداد العشرية', max: 3 }
      ]},
      { code: 'مع2', label: 'النسبة المئوية والكسور', max: 7, subCriteria: [
        { code: 'مع2أ', label: 'النسبة المئوية', max: 3 },
        { code: 'مع2ب', label: 'الكسور', max: 4 }
      ]},
      { code: 'مع3', label: 'الهندسة', max: 4, subCriteria: [
        { code: 'مع3أ', label: 'الأشكال المتشابهة', max: 2 },
        { code: 'مع3ب', label: 'الإحداثيات', max: 2 }
      ]},
      { code: 'تم', label: 'المشكلات (تميّز)', max: 3, subCriteria: [
        { code: 'تمأ', label: 'مشكلة واقعية', max: 3 }
      ]}
    ],
    science: [
      { code: 'مع1', label: 'علوم الحياة والبيئة', max: 5, subCriteria: [
        { code: 'مع1أ', label: 'البيئة والتلوث', max: 3 },
        { code: 'مع1ب', label: 'الكائنات الحية', max: 2 }
      ]},
      { code: 'مع2', label: 'علوم الأرض والكون', max: 5, subCriteria: [
        { code: 'مع2أ', label: 'الرواسب المعدنية', max: 3 },
        { code: 'مع2ب', label: 'حركة الأرض', max: 2 }
      ]},
      { code: 'مع3', label: 'الفيزياء', max: 5, subCriteria: [
        { code: 'مع3أ', label: 'ال电流 والدارات', max: 3 },
        { code: 'مع3ب', label: 'الضوء والصوت', max: 2 }
      ]},
      { code: 'تم', label: 'التفكير العلمي (تميّز)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'البحث العلمي', max: 3 },
        { code: 'تمب', label: 'التطبيق', max: 2 }
      ]}
    ]
  },

  // ============ السنة السادسة (س6) ============
  year6: {
    reading: [
      { code: 'مع1', label: 'القراءة والنقد', max: 6, subCriteria: [
        { code: 'مع1أ', label: 'القراءة النقدية', max: 3 },
        { code: 'مع1ب', label: 'التأويل', max: 3 }
      ]},
      { code: 'مع2', label: 'تحليل النصوص', max: 9, subCriteria: [
        { code: 'مع2أ', label: 'تحليل المضمون', max: 3 },
        { code: 'مع2ب', label: 'تحليل الأسلوب', max: 3 },
        { code: 'مع2ج', label: 'ربط النص بالسياق', max: 3 }
      ]},
      { code: 'تم', label: 'الإبداع الأدبي (تميّز)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'كتابة إبداعية', max: 3 },
        { code: 'تمب', label: 'نقد بناء', max: 2 }
      ]}
    ],
    math: [
      { code: 'مع1', label: 'الأعداد المركبة', max: 6, subCriteria: [
        { code: 'مع1أ', label: 'الكسور والأعداد العشرية', max: 3 },
        { code: 'مع1ب', label: 'النسبة المئوية', max: 3 }
      ]},
      { code: 'مع2', label: 'الجبر والمعادلات', max: 7, subCriteria: [
        { code: 'مع2أ', label: 'تمثيل بمعادلة', max: 3 },
        { code: 'مع2ب', label: 'حل معادلة', max: 4 }
      ]},
      { code: 'مع3', label: 'الهندسة والقياس', max: 4, subCriteria: [
        { code: 'مع3أ', label: 'الأشكال ثلاثية الأبعاد', max: 2 },
        { code: 'مع3ب', label: 'التحويلات الهندسية', max: 2 }
      ]},
      { code: 'تم', label: 'المشكلات (تميّز)', max: 3, subCriteria: [
        { code: 'تمأ', label: 'مشكلة تكاملية', max: 3 }
      ]}
    ],
    science: [
      { code: 'مع1', label: 'علوم الحياة', max: 5, subCriteria: [
        { code: 'مع1أ', label: 'الوراثة', max: 3 },
        { code: 'مع1ب', label: 'التطور', max: 2 }
      ]},
      { code: 'مع2', label: 'علوم الأرض والكون', max: 5, subCriteria: [
        { code: 'مع2أ', label: 'الceuwe والمناخ', max: 3 },
        { code: 'مع2ب', label: 'التنقلات الجوية', max: 2 }
      ]},
      { code: 'مع3', label: 'الفيزياء والكيمياء', max: 5, subCriteria: [
        { code: 'مع3أ', label: 'الغوص والطفو', max: 3 },
        { code: 'مع3ب', label: 'الخواص الفيزيائية', max: 2 }
      ]},
      { code: 'تم', label: 'البحث العلمي (تميّز)', max: 5, subCriteria: [
        { code: 'تمأ', label: 'تصميم تجربة', max: 3 },
        { code: 'تمب', label: 'تحليل نتائج', max: 2 }
      ]}
    ]
  }
};

// مستويات التملك (4 مستويات)
export const PROFICIENCY_LEVELS = [
  { code: '---', label: 'انعدام التملك', description: '0 نقطة' },
  { code: '+--', label: 'دون التملك الأدنى', description: '0.5 - 1.5 نقطة' },
  { code: '++-', label: 'التملك الأدنى', description: '2 - 2.5 نقطة' },
  { code: '+++', label: 'التملك الأقصى', description: '3 - 5 نقطة' }
];

function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(...parts) {
  let h = 2166136261;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

function loadStandards(level) {
  if (!fs.existsSync(STANDARDS_PATH)) return [];
  const data = JSON.parse(fs.readFileSync(STANDARDS_PATH, 'utf8'));
  return (data.standards || []).filter((s) => s.level === level);
}

/**
 * يولّد امتحاناً رسمياً كاملاً حسب المعايير الرسمية التونسية.
 * يعيد ورقة ببنية النظام الرسمي: criteria[] مع subCriteria + questions[]
 */
export function generateStandardsExam({ gradeId = 'year1', subject = 'math', seed = null } = {}) {
  const preset = CRITERIA_PRESETS[gradeId]?.[subject];
  if (!preset) {
    return { error: `لا توجد جداول معايير مولِّدة بعد لـ ${gradeId}/${subject}.` };
  }

  const rand = seededRandom(hashSeed(seed ?? Date.now(), gradeId, subject));
  const criteria = [];
  const questions = [];
  let qNum = 0;

  for (const crit of preset) {
    const subCriteriaWithQuestions = [];

    if (crit.subCriteria) {
      for (const sub of crit.subCriteria) {
        qNum += 1;
        const question = generateQuestionForSubCriterion(rand, gradeId, subject, sub.code, sub.label, sub.max);
        if (question) {
          question.id = `q${qNum}`;
          question.num = qNum;
          question.criterion = crit.code;
          question.subCriterion = sub.code;
          question.subCriterionLabel = sub.label;
          question.points = sub.max;
          questions.push(question);
        }
        subCriteriaWithQuestions.push({
          code: sub.code,
          label: sub.label,
          max: sub.max
        });
      }
    }

    criteria.push({
      code: crit.code,
      label: crit.label,
      max: crit.max,
      subCriteria: subCriteriaWithQuestions
    });
  }

  const totalMax = criteria.reduce((s, c) => s + c.max, 0);

  return {
    gradeId,
    subject,
    totalScore: totalMax,
    criteria,
    questions,
    proficiencyLevels: PROFICIENCY_LEVELS,
    blueprintNote: 'امتحان مبني على المعايير الرسمية التونسية: كل سؤال موسوم بمعياره وتجزئته.',
    generatedAt: new Date().toISOString()
  };
}

/**
 * يولّد سؤالاً مناسباً حسب تجزئة المعيار
 */
function generateQuestionForSubCriterion(rand, gradeId, subject, subCode, subLabel, maxPoints) {
  const questionTypes = getQuestionTypesForSubject(subject, gradeId);
  const availableTypes = questionTypes.filter(t => t.appliesTo(subCode, subLabel));

  if (availableTypes.length === 0) {
    return generateGenericQuestion(rand, subject, subCode, subLabel, maxPoints);
  }

  const selectedType = availableTypes[Math.floor(rand() * availableTypes.length)];
  return selectedType.generate(rand, gradeId, maxPoints);
}

/**
 * يحدد أنواع الأسئلة المتاحة لكل مادة
 */
function getQuestionTypesForSubject(subject, gradeId) {
  const types = {
    math: [
      { code: 'vertical_add', appliesTo: (sub) => sub.includes('جمع'), generate: generateVerticalAddition },
      { code: 'vertical_sub', appliesTo: (sub) => sub.includes('طرح'), generate: generateVerticalSubtraction },
      { code: 'coin_count', appliesTo: (sub) => sub.includes('مبلغ') || sub.includes('نقد'), generate: generateCoinCounting },
      { code: 'number_read', appliesTo: (sub) => sub.includes('قراءة') && sub.includes('أعداد'), generate: generateNumberReading },
      { code: 'compare', appliesTo: (sub) => sub.includes('مقارنة'), generate: generateComparison },
      { code: 'shape_id', appliesTo: (sub) => sub.includes('أشكال') || sub.includes('هندس'), generate: generateShapeIdentification },
      { code: 'sequence', appliesTo: (sub) => sub.includes('سلسلة'), generate: generateNumberSequence },
      { code: 'word_problem', appliesTo: (sub) => sub.includes('مشكلة'), generate: generateWordProblem }
    ],
    reading: [
      { code: 'true_false', appliesTo: (sub) => sub.includes('فهم') || sub.includes('صواب'), generate: generateTrueFalse },
      { code: 'matching', appliesTo: (sub) => sub.includes('ربط'), generate: generateMatching },
      { code: 'fill_blank', appliesTo: (sub) => sub.includes('إكمال'), generate: generateFillBlank },
      { code: 'synonym', appliesTo: (sub) => sub.includes('مرادف'), generate: generateSynonym },
      { code: 'opinion', appliesTo: (sub) => sub.includes('رأي'), generate: generateOpinion },
      { code: 'comprehension', appliesTo: (sub) => sub.includes('استخراج') || sub.includes('معلومات'), generate: generateComprehension }
    ],
    science: [
      { code: 'true_false', appliesTo: (sub) => true, generate: generateScienceTrueFalse },
      { code: 'fill_blank', appliesTo: (sub) => sub.includes('إكمال'), generate: generateScienceFillBlank },
      { code: 'matching', appliesTo: (sub) => sub.includes('ربط'), generate: generateScienceMatching },
      { code: 'correction', appliesTo: (sub) => sub.includes('أصلح'), generate: generateScienceCorrection },
      { code: 'opinion', appliesTo: (sub) => sub.includes('رأي'), generate: generateScienceOpinion }
    ],
    production: [
      { code: 'story_complete', appliesTo: (sub) => sub.includes('سرد') || sub.includes('قصة'), generate: generateStoryComplete },
      { code: 'picture_describe', appliesTo: (sub) => sub.includes('وصف') || sub.includes('صورة'), generate: generatePictureDescription },
      { code: 'personal_write', appliesTo: (sub) => sub.includes('شخصي') || sub.includes('تعبير'), generate: generatePersonalWriting }
    ],
    handwriting: [
      { code: 'copy_text', appliesTo: () => true, generate: generateCopyText },
      { code: 'write_letters', appliesTo: (sub) => sub.includes('حروف'), generate: generateLetterWriting }
    ]
  };

  return types[subject] || types.reading;
}

/**
 * يولّد سؤالاً عاماً لأي معيار
 */
function generateGenericQuestion(rand, subject, subCode, subLabel, maxPoints) {
  const prompts = {
    math: [
      'أكمل العمليات التالية:',
      'احسب الناتج:',
      'أكمل بالعدد المناسب:'
    ],
    reading: [
      'اقرأ النص ثم أجب عن الأسئلة:',
      'أكمل بالكلمة المناسبة:',
      'ضع دائرة حول الإجابة الصحيحة:'
    ],
    science: [
      'أكمل بما يناسب:',
      'صواب أم خطأ:',
      'أربط العنصر بالوظيفة المناسبة:'
    ]
  };

  const subjectPrompts = prompts[subject] || prompts.reading;
  const prompt = subjectPrompts[Math.floor(rand() * subjectPrompts.length)];

  return {
    type: 'MCQ',
    prompt,
    options: ['خيار 1', 'خيار 2', 'خيار 3'],
    correctOption: 0,
    subCode,
    subLabel,
    maxPoints
  };
}

// ============ مولّدات الأسئلة الرياضية ============

function generateVerticalAddition(rand, gradeId, maxPoints) {
  const maxNum = gradeId === 'year1' ? 99 : gradeId === 'year2' ? 999 : 9999;
  const a = Math.floor(rand() * maxNum) + 10;
  const b = Math.floor(rand() * maxNum) + 10;
  const answer = a + b;

  return {
    type: 'VERTICAL_OP',
    prompt: `أكمل عملية الجمع العمودي:`,
    operation: 'add',
    operand1: a,
    operand2: b,
    answer,
    points: maxPoints,
    subCode: 'مع2أ',
    subLabel: 'جمع'
  };
}

function generateVerticalSubtraction(rand, gradeId, maxPoints) {
  const maxNum = gradeId === 'year1' ? 99 : gradeId === 'year2' ? 999 : 9999;
  let a = Math.floor(rand() * maxNum) + 20;
  let b = Math.floor(rand() * (a - 10)) + 5;
  const answer = a - b;

  return {
    type: 'VERTICAL_OP',
    prompt: `أكمل عملية الطرح العمودي:`,
    operation: 'subtract',
    operand1: a,
    operand2: b,
    answer,
    points: maxPoints,
    subCode: 'مع2ب',
    subLabel: 'طرح'
  };
}

function generateCoinCounting(rand, gradeId, maxPoints) {
  const coinValues = [5, 10, 20, 50, 100, 200];
  const numCoins = Math.floor(rand() * 4) + 2;
  const coins = [];

  for (let i = 0; i < numCoins; i++) {
    coins.push(coinValues[Math.floor(rand() * coinValues.length)]);
  }

  const total = coins.reduce((sum, c) => sum + c, 0);

  return {
    type: 'COIN_COUNT',
    prompt: `احسب المبلغ الإجمالي من القطع النقدية التالية:`,
    coins,
    total,
    points: maxPoints,
    subCode: 'مع3',
    subLabel: 'القطع النقدية'
  };
}

function generateNumberReading(rand, gradeId, maxPoints) {
  const maxNum = gradeId === 'year1' ? 20 : gradeId === 'year2' ? 999 : 10000;
  const number = Math.floor(rand() * maxNum) + 1;

  const numberWords = convertToArabicNumberWords(number);

  return {
    type: 'MCQ',
    prompt: `اكتب العدد ${number} بالحروف:`,
    options: shuffle([numberWords, numberWords + ' (خطأ)', 'خطأ آخر'], rand),
    correctOption: 0,
    points: maxPoints,
    subCode: 'مع1',
    subLabel: 'قراءة الأعداد'
  };
}

function generateComparison(rand, gradeId, maxPoints) {
  const maxNum = gradeId === 'year1' ? 20 : gradeId === 'year2' ? 999 : 10000;
  const a = Math.floor(rand() * maxNum) + 1;
  let b = Math.floor(rand() * maxNum) + 1;
  while (b === a) b = Math.floor(rand() * maxNum) + 1;

  const answer = a > b ? '>' : a < b ? '<' : '=';

  return {
    type: 'MCQ',
    prompt: `قارن بين: ${a} ؟ ${b}`,
    options: ['>', '<', '='],
    correctOption: answer === '>' ? 0 : answer === '<' ? 1 : 2,
    points: maxPoints,
    subCode: 'مع1',
    subLabel: 'مقارنة الأعداد'
  };
}

function generateShapeIdentification(rand, gradeId, maxPoints) {
  const shapes = [
    { name: 'مربع', sides: 4, rightAngles: 4 },
    { name: 'مستطيل', sides: 4, rightAngles: 4 },
    { name: 'مثلث', sides: 3, rightAngles: 0 },
    { name: 'دائرة', sides: 0, rightAngles: 0 },
    { name: 'شبه منحرف', sides: 4, rightAngles: 0 }
  ];

  const shape = shapes[Math.floor(rand() * shapes.length)];
  const otherShapes = shapes.filter(s => s.name !== shape.name).map(s => s.name);

  return {
    type: 'MCQ',
    prompt: `له ${shape.sides} أضلاع ${shape.rightAngles > 0 ? 'و' + shape.rightAngles + ' زاوية قائمة' : ''}، هو:`,
    options: shuffle([shape.name, ...otherShapes.slice(0, 2)], rand),
    correctOption: 0,
    points: maxPoints,
    subCode: 'مع3',
    subLabel: 'الأشكال الهندسية'
  };
}

function generateNumberSequence(rand, gradeId, maxPoints) {
  const start = Math.floor(rand() * 20) + 1;
  const step = Math.floor(rand() * 5) + 2;
  const sequence = [start, start + step, start + 2 * step, start + 3 * step];
  const missing = sequence[2];
  sequence[2] = '.......';

  return {
    type: 'MCQ',
    prompt: `أكمل السلسلة: ${sequence.join(' - ')}`,
    options: shuffle([String(missing), String(missing + 1), String(missing - 1)], rand),
    correctOption: 0,
    points: maxPoints,
    subCode: 'مع1',
    subLabel: 'إكمال سلسلة'
  };
}

function generateWordProblem(rand, gradeId, maxPoints) {
  const problems = [
    { text: 'لدى أحمد 15 ديناراً، اشترى كتاباً بـ 8 دينارات. كم بقي معه؟', answer: 7 },
    { text: 'في الفصل 24 تلميذاً، 14 بنين. كم عدد البنات؟', answer: 10 },
    { text: 'جمع سامي 35 ورقةً و12 ورقةً أخريات. كم ورقةً جمع؟', answer: 47 }
  ];

  const problem = problems[Math.floor(rand() * problems.length)];

  return {
    type: 'MCQ',
    prompt: problem.text,
    options: shuffle([String(problem.answer), String(problem.answer + 2), String(problem.answer - 1)], rand),
    correctOption: 0,
    points: maxPoints,
    subCode: 'مع4',
    subLabel: 'مشكلة كتابية'
  };
}

// ============ مولّدات أسئلة القراءة ============

function generateTrueFalse(rand, gradeId, maxPoints) {
  const items = [
    { statement: 'الشمسُ ساطعةٌ.', answer: true },
    { statement: 'القمرُ ينيرُ الأرضَ بالنهارِ.', answer: false },
    { statement: 'الماءُ يسيلُ من الأعلى إلى الأسفلِ.', answer: true },
    { statement: 'الشتاءُ فصلٌ حارٌّ.', answer: false }
  ];

  const item = items[Math.floor(rand() * items.length)];

  return {
    type: 'TRUE_FALSE',
    prompt: `صواب أم خطأ: ${item.statement}`,
    answer: item.answer,
    points: maxPoints,
    subCode: 'مع2',
    subLabel: 'صواب/خطأ'
  };
}

function generateMatching(rand, gradeId, maxPoints) {
  const pairs = [
    { left: 'الكتابُ', right: 'نقرأُ فيهِ' },
    { left: 'القلمُ', right: 'نكتبُ بهِ' },
    { left: 'الحقيبةُ', right: 'نحملُ فيها الدروسَ' },
    { left: 'الحذاءُ', right: 'نمشيُ عليهِ' }
  ];

  const selected = pairs.slice(0, 3);

  return {
    type: 'MATCHING',
    prompt: 'أربط كل كلمة بالوظيفة المناسبة:',
    pairs: selected,
    points: maxPoints,
    subCode: 'مع2',
    subLabel: 'ربط'
  };
}

function generateFillBlank(rand, gradeId, maxPoints) {
  const sentences = [
    { text: 'ذهبَ سامي إلى .........', answer: 'المدرسة' },
    { text: 'ترسمُ ليلى ......... جميلةً.', answer: 'وردةً' },
    { text: 'الطائرُ يغردُ على .........', answer: 'الشجرة' }
  ];

  const sentence = sentences[Math.floor(rand() * sentences.length)];

  return {
    type: 'FILL_BLANK',
    prompt: sentence.text,
    answer: sentence.answer,
    points: maxPoints,
    subCode: 'مع2',
    subLabel: 'إكمال'
  };
}

function generateSynonym(rand, gradeId, maxPoints) {
  const words = [
    { word: 'سعيد', synonym: 'فرحان' },
    { word: 'كبير', synonym: 'ضخم' },
    { word: 'صغير', synonym: 'قليل' },
    { word: 'جميل', synonym: 'حلو' }
  ];

  const word = words[Math.floor(rand() * words.length)];
  const others = words.filter(w => w.word !== word.word).map(w => w.synonym);

  return {
    type: 'MCQ',
    prompt: `ما مرادف كلمة «${word.word}»؟`,
    options: shuffle([word.synonym, ...others.slice(0, 2)], rand),
    correctOption: 0,
    points: maxPoints,
    subCode: 'مع2',
    subLabel: 'مرادف'
  };
}

function generateOpinion(rand, gradeId, maxPoints) {
  const prompts = [
    'ما رأيك في تصرف الطفل؟ لماذا؟',
    'لو كنت مكانه، ماذا كنت ستفعل؟',
    'ما العمل الذي يحبه أصدقاؤك؟ ولماذا؟'
  ];

  return {
    type: 'FREE',
    prompt: prompts[Math.floor(rand() * prompts.length)],
    freeLines: 3,
    points: maxPoints,
    subCode: 'تم',
    subLabel: 'إبداء الرأي'
  };
}

function generateComprehension(rand, gradeId, maxPoints) {
  const texts = [
    { text: 'ذات صباح مشمس، خرج سامي إلى الحديقة ليلعب مع أخيه.', question: 'متى خرج سامي؟', answer: 'صباحاً مشمساً' },
    { text: 'ذهبت ليلى إلى السوق مع أمها لشراء الفاكهة.', question: 'إلى أين ذهبت ليلى؟', answer: 'السوق' },
    { text: 'في الفصل، يدرس التلاميذ القراءة والكتابة بجد.', question: 'ماذا يفعل التلاميذ في الفصل؟', answer: 'يدرسون' }
  ];

  const item = texts[Math.floor(rand() * texts.length)];

  return {
    type: 'MCQ',
    prompt: `اقرأ: «${item.text}» — ${item.question}`,
    options: shuffle([item.answer, 'إجابة أخرى', 'إجابة ثالثة'], rand),
    correctOption: 0,
    points: maxPoints,
    subCode: 'مع2',
    subLabel: 'استخراج معلومات'
  };
}

// ============ مولّدات أسئلة العلوم ============

function generateScienceTrueFalse(rand, gradeId, maxPoints) {
  const items = [
    { statement: 'الإنسان يحتاج إلى الطعام والماء للبقاء.', answer: true },
    { statement: 'الحيوانات تأكل النباتات فقط.', answer: false },
    { statement: 'الماء يتحول إلى بخار عند تسخينه.', answer: true },
    { statement: 'الكوكب الأرضي هو الأقرب إلى الشمس.', answer: false }
  ];

  const item = items[Math.floor(rand() * items.length)];

  return {
    type: 'TRUE_FALSE',
    prompt: `صواب أم خطأ: ${item.statement}`,
    answer: item.answer,
    points: maxPoints,
    subCode: 'مع2',
    subLabel: 'صواب/خطأ'
  };
}

function generateScienceFillBlank(rand, gradeId, maxPoints) {
  const sentences = [
    { text: 'النبات يحتاج إلى ......... و ......... لينمو.', answer: 'الماء، الشمس' },
    { text: 'الإنسان يتنفس بال.........', answer: 'رئتين' },
    { text: 'الماء في الطبيعة يتحول إلى ......... عند التبخر.', answer: 'بخار' }
  ];

  const sentence = sentences[Math.floor(rand() * sentences.length)];

  return {
    type: 'FILL_BLANK',
    prompt: sentence.text,
    answer: sentence.answer,
    points: maxPoints,
    subCode: 'مع1',
    subLabel: 'إكمال'
  };
}

function generateScienceMatching(rand, gradeId, maxPoints) {
  const pairs = [
    { left: 'العين', right: 'الرؤية' },
    { left: 'الأذن', right: 'السمع' },
    { left: 'الأنف', right: 'الشم' },
    { left: 'اللسان', right: 'التذوق' }
  ];

  const selected = pairs.slice(0, 3);

  return {
    type: 'MATCHING',
    prompt: 'أربط العضو بالوظيفة المناسبة:',
    pairs: selected,
    points: maxPoints,
    subCode: 'مع1',
    subLabel: 'ربط'
  };
}

function generateScienceCorrection(rand, gradeId, maxPoints) {
  const corrections = [
    { wrong: 'الشمس تدور حول الأرض.', correct: 'الأرض تدور حول الشمس.' },
    { wrong: 'الإنسان يتنفس بالأنف فقط.', correct: 'الإنسان يتنفس بالأنف والفم.' },
    { wrong: 'السمكة تعيش على اليابسة.', correct: 'السمكة تعيش في الماء.' }
  ];

  const item = corrections[Math.floor(rand() * corrections.length)];

  return {
    type: 'CORRECTION',
    prompt: `أصلح الخطأ: ${item.wrong}`,
    answer: item.correct,
    points: maxPoints,
    subCode: 'مع3',
    subLabel: 'أصلح الخطأ'
  };
}

function generateScienceOpinion(rand, gradeId, maxPoints) {
  const prompts = [
    'لماذا يجب أن نحافظ على البيئة؟',
    'ما فائدة النباتات للإنسان؟',
    'كيف يمكننا توفير الطاقة في المنزل؟'
  ];

  return {
    type: 'FREE',
    prompt: prompts[Math.floor(rand() * prompts.length)],
    freeLines: 3,
    points: maxPoints,
    subCode: 'تم',
    subLabel: 'إبداء رأي'
  };
}

// ============ مولّدات أسئلة الإنتاج الكتابي ============

function generateStoryComplete(rand, gradeId, maxPoints) {
  const prompts = [
    'في يومٍ جميلٍ، ذهبَ ساميُّ إلى الغابةِ فوجدَ ...............',
    'كانتْ ليلىٌ تلعبُ في الحديقةِ فسمعتْ ...............',
    'خرجَ الطفلُ من المدرسةِ ووجدَ ...............'
  ];

  return {
    type: 'FREE',
    prompt: prompts[Math.floor(rand() * prompts.length)],
    freeLines: 4,
    points: maxPoints,
    subCode: 'مع2',
    subLabel: 'إكمال قصة'
  };
}

function generatePictureDescription(rand, gradeId, maxPoints) {
  const prompts = [
    'انظر إلى الصورة واكتب جملتين أو ثلاثاً تصف ما تراه.',
    'صف المشهد الذي تراه في الصورة.',
    'اكتب فقرة قصيرة تصف الصورة.'
  ];

  return {
    type: 'FREE',
    prompt: prompts[Math.floor(rand() * prompts.length)],
    freeLines: 4,
    points: maxPoints,
    subCode: 'مع2',
    subLabel: 'وصف صورة'
  };
}

function generatePersonalWriting(rand, gradeId, maxPoints) {
  const prompts = [
    'اكتب جملة أو جملتين عن يومك في المدرسة.',
    'صف صديقك المفضل.',
    'اكتب عن نشاط تحبه.'
  ];

  return {
    type: 'FREE',
    prompt: prompts[Math.floor(rand() * prompts.length)],
    freeLines: 3,
    points: maxPoints,
    subCode: 'تم',
    subLabel: 'تعبير شخصي'
  };
}

// ============ مولّدات أسئلة الخط والإملاء ============

function generateCopyText(rand, gradeId, maxPoints) {
  const texts = [
    'الطالبُ المجتهدُ ينجحُ في الحياةِ.',
    'العلمُ نورٌ والجهلُ ظلامٌ.',
    'القراءةُ מפתחُ المعرفةِ.'
  ];

  return {
    type: 'COPY',
    prompt: 'انسخ النص التالي بخط جميل:',
    text: texts[Math.floor(rand() * texts.length)],
    freeLines: 3,
    points: maxPoints,
    subCode: 'مع1',
    subLabel: 'نسخ النص'
  };
}

function generateLetterWriting(rand, gradeId, maxPoints) {
  const letters = ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'];
  const selected = letters.sort(() => rand() - 0.5).slice(0, 5);

  return {
    type: 'LETTERS',
    prompt: `اكتب الحروف التالية بشكل واضح: (${selected.join(' - ')})`,
    letters: selected,
    freeLines: 2,
    points: maxPoints,
    subCode: 'مع1',
    subLabel: 'كتابة حروف'
  };
}

// ============ دوال مساعدة ============

function shuffle(array, rand) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function convertToArabicNumberWords(num) {
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];

  if (num === 0) return 'صفر';
  if (num < 10) return ones[num];
  if (num === 10) return 'عشرة';
  if (num < 20) {
    const onesDigit = num % 10;
    if (onesDigit === 0) return 'عشرة';
    return ones[onesDigit] + ' عشر';
  }
  if (num < 100) {
    const tensDigit = Math.floor(num / 10);
    const onesDigit = num % 10;
    if (onesDigit === 0) return tens[tensDigit];
    return ones[onesDigit] + ' و' + tens[tensDigit];
  }
  if (num < 1000) {
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;
    let result = '';
    if (hundreds === 1) result = 'مئة';
    else if (hundreds === 2) result = 'مئتان';
    else result = ones[hundreds] + ' مئة';
    if (remainder > 0) result += ' و' + convertToArabicNumberWords(remainder);
    return result;
  }
  return String(num);
}