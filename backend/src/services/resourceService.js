import prisma from '../db.js';

const TYPES = {
  WORKSHEET: {
    label: 'ورقة عمل',
    build: (input) => ({
      title: `ورقة عمل: ${input.lessonTitle}`,
      instructions: input.instructions || 'أنجز التمارين التالية بتركيز ثم تحقق من إجاباتك.',
      exercises: input.exercises || [
        { type: 'MCQ', prompt: 'سؤال اختيار من متعدد؟', options: ['أ', 'ب', 'ج', 'د'], answer: 'أ' },
        { type: 'FILL', prompt: 'أكمل الفراغ: ......', answer: 'الجواب' },
        { type: 'OPEN', prompt: 'اشرح بأسلوبك الخاص مفهوم الدرس.' }
      ]
    })
  },
  HOMEWORK: {
    label: 'واجب منزلي',
    build: (input) => ({
      title: `واجب منزلي: ${input.lessonTitle}`,
      dueDays: input.dueDays || 3,
      tasks: input.tasks || [
        'راجع درس اليوم لمدة 10 دقائق',
        'أنجز التمارين الموجودة في الكتاب',
        'أجب عن أسئلة المراجعة المرفقة'
      ],
      parentSignature: true
    })
  },
  FLASHCARDS: {
    label: 'بطاقات مراجعة',
    build: (input) => ({
      title: `بطاقات مراجعة: ${input.lessonTitle}`,
      cards: input.cards || [
        { front: 'مفهوم 1', back: 'تعريف المفهوم 1' },
        { front: 'مصطلح 2', back: 'معنى المصطلح 2' },
        { front: 'مثال', back: 'مثال توضيحي' }
      ]
    })
  },
  PRESENTATION: {
    label: 'عرض تقديمي',
    build: (input) => ({
      title: `عرض تقديمي: ${input.lessonTitle}`,
      slides: input.slides || [
        { title: `درس: ${input.lessonTitle}`, body: 'مرحبًا بكم في هذا الدرس' },
        { title: 'الأهداف', body: 'سنتمكن في نهاية هذا الدرس من فهم المفاهيم الأساسية.' },
        { title: 'المحتوى', body: 'شرح المفاهيم مع أمثلة.' },
        { title: 'التقويم', body: 'أسئلة للمراجعة الذاتية.' }
      ]
    })
  },
  LESSON_PLAN: {
    label: 'خطة درس',
    build: (input) => ({
      title: `خطة درس: ${input.lessonTitle}`,
      duration: input.duration || 45,
      stages: input.stages || [
        { time: 5, name: 'تمهيد', goal: 'تهيئة التلميذ للدرس', activity: 'مناقشة سريعة' },
        { time: 15, name: 'شرح', goal: 'تقديم المحتوى', activity: 'شرح + عرض أمثلة' },
        { time: 15, name: 'تطبيق', goal: 'ترسيخ المفاهيم', activity: 'تمارين موجهة' },
        { time: 10, name: 'تقويم', goal: 'قياس التعلم', activity: 'اختبار قصير + ملخص' }
      ]
    })
  }
};

export async function buildResource({ teacherId, kind, subject, level, lessonTitle, input = {} }) {
  if (!TYPES[kind]) throw new Error('نوع مورد غير معروف');
  const content = TYPES[kind].build({ lessonTitle, ...input });
  return prisma.teachingResource.create({
    data: {
      teacherId,
      kind,
      subject,
      level,
      lessonTitle: String(lessonTitle),
      title: content.title,
      content
    }
  });
}

export async function rebuildResource(id, teacherId) {
  const existing = await prisma.teachingResource.findFirst({ where: { id: Number(id), teacherId } });
  if (!existing) return null;
  await prisma.teachingResource.delete({ where: { id: existing.id } });
  return buildResource({
    teacherId,
    kind: existing.kind,
    subject: existing.subject,
    level: existing.level,
    lessonTitle: existing.lessonTitle,
    input: existing.content
  });
}
