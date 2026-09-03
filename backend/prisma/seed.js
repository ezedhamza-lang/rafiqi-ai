import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // ===== Early exit: if demo admin already exists with password, seed was already run =====
  try {
    const adminExists = await prisma.user.findUnique({ where: { email: 'admin@education.tn' } });
    if (adminExists) {
      console.log('Seed already ran (admin exists). Updating demo users only...');
      const demoEmails = ['admin@education.tn', 'student@test.tn', 'parent@test.tn', 'teacher@test.tn', 'director@test.tn', 'super@education.tn'];
      const passwords = { 'admin@education.tn': 'admin123', 'student@test.tn': 'student123', 'parent@test.tn': 'parent123', 'teacher@test.tn': 'teacher123', 'director@test.tn': 'director123', 'super@education.tn': 'super123' };
      for (const email of demoEmails) {
        try {
          await prisma.user.update({ where: { email }, data: { passwordHash: await bcrypt.hash(passwords[email], 10) } });
        } catch (_) {}
      }
      console.log('Quick seed done.');
      return;
    }
  } catch (_) {}

  const delegations = [
    'تونس 1', 'تونس 2', 'أريانة', 'بن عروس', 'بنزرت', 'نابل',
    'زغوان', 'باجة', 'منوبة', 'جندوبة', 'الكاف', 'القصرين',
    'سليانة', 'قفصة', 'سيدي بو زيد', 'قابس', 'مدنين', 'تطاوين',
    'قبلي', 'توزر', 'المهدية', 'المنستير', 'سوسة', 'القيروان',
    'صفاقس 1', 'صفاقس 2'
  ];

  const announcements = [
    {
      title: 'قريبا ... انطلاق عمليات التسجيل عن بعد',
      description: 'سيتم قريبا انطلاق عمليات التسجيل عن بعد بالنسبة للسنة الدراسية 2026-2027',
      category: 'التسجيل',
      imageUrl: 'https://viescolaire.education.tn/assets/images/gallery/inscription.jpg'
    },
    {
      title: 'انطلاق عملية تسجيل تلاميذ السنة الأولى من التعليم الأساسي',
      description: 'تنطلق عملية تسجيل تلاميذ السنة الأولى من التعليم الأساسي للسنة الدراسية 2026-2027 يوم 27 أفريل 2026 عبر بوابة الحياة المدرسية',
      category: 'التسجيل',
      imageUrl: 'https://viescolaire.education.tn/assets/images/gallery/registre.jpg'
    }
  ];

  const articles = [
    {
      title: 'إطلاق منصّة رقمية مُوجّهة لتلاميذ الابتدائي والإعدادي والثانوي',
      description: 'أعلن وزير التربية السيد نور الدين النوري صباح اليوم الثلاثاء، عن إطلاق منصّة رقمية مُوجّهة لتلاميذ الابتدائي والإعدادي والثانوي، توفّر دروس دعم مدرسي مجانية، بمشاركة أساتذة ومعلّمين متطوّعين.',
      category: 'أخبار الوزارة',
      imageUrl: 'https://viescolaire.education.tn/assets/images/gallery/tech.jpg'
    },
    {
      title: 'فعاليات الدورة التكوينية حول استغلال منظومة التصرّف في الحياة المدرسيّة',
      description: 'الدورة التكوينية حول استغلال منظومة التصرّف في الحياة المدرسيّة من تنظيم المركز الوطني للتكنولوجيات في التربية لفائدة المسؤولين الجهويين بالمندوبيات.',
      category: 'دورات تكوينية',
      imageUrl: 'https://viescolaire.education.tn/assets/images/gallery/cenafop.jpg'
    }
  ];

  const faqs = [
    { question: 'ما هي الخدمات التي توفّرها هذه البوابة ؟', answer: 'توفّر بوابة الحياة المدرسية جملة من الخدمات الرقمية للتلاميذ وأوليائهم: التسجيل عن بعد، متابعة الأعداد والغيابات، الاطلاع على التبليغات، التوجيه المدرسي، طلب الوثائق الإدارية وغيرها من الخدمات.', category: 'عام', sort: 1 },
    { question: 'ما هي المعطيات المطلوبة لتسجيل تلميذ؟', answer: 'يتطلب التسجيل توفير البيانات الشخصية للتلميذ (الاسم، اللقب، تاريخ الازدياد، بطاقة التعريف إن وجدت) وبيانات الولي مع بطاقة التعريف الوطنية وصورة شمسية حديثة.', category: 'التسجيل', sort: 2 },
    { question: 'عند تسجيل ابني ماذا أفعل إن لم أتحصل على أي مدرسة؟', answer: 'في صورة عدم التحصل على مدرسة بعد انتهاء آجال التسجيل، يمكن للولي تقديم مطلب عبر البوابة وستتم دراسة الوضعية من طرف المندوبية الجهوية للتربية المعنية.', category: 'التسجيل', sort: 3 },
    { question: 'كيف يمكنني طلب الحصول على شهادة مدرسية؟', answer: 'يمكن طلب الحصول على شهادة مدرسية من خلال فضاء المواطن، قائمة "إجراءات و مطالب" ثم "طلب الحصول على شهادة مدرسية"، مع تعمير البيانات المطلوبة وتحميل الوثائق اللازمة.', category: 'إجراءات', sort: 4 },
    { question: 'هل يمكنني متابعة حالة طلباتي عبر البوابة؟', answer: 'نعم، يمكنك متابعة جميع طلباتك من خلال فضاء "مطالبي" حيث تظهر حالة كل مطلب (قيد الدراسة، مقبول، مرفوض) مع إمكانية تحميل النتائج.', category: 'عام', sort: 5 }
  ];

  const lessons = [
    { subject: 'MATH', order: 1, title: 'الأعداد من 0 إلى 5', description: 'تعرّف على الأعداد من 0 إلى 5 وتمثيلها بطرق مختلفة: العد، الكتابة، التجميع.', fileUrl: '/uploads/lessons/math-book-1.pdf' },
    { subject: 'MATH', order: 2, title: 'الأعداد من 6 إلى 9', description: 'اكتشف الأعداد من 6 إلى 9 والمقارنة بينها باستعمال الرموز أكبر وأصغر.', fileUrl: '/uploads/lessons/math-book-1.pdf' },
    { subject: 'MATH', order: 3, title: 'الأعداد حتى 19', description: 'التعرّف على العشرات والآحاد وتكوين الأعداد من 10 إلى 19.', fileUrl: '/uploads/lessons/math-book-2.pdf' },
    { subject: 'MATH', order: 4, title: 'الجمع', description: 'مفهوم عملية الجمع والتمثيل بمجموعات الأشياء وإنجاز عمليات جمع بسيطة.', fileUrl: '/uploads/lessons/math-book-1.pdf' },
    { subject: 'MATH', order: 5, title: 'الطرح', description: 'مفهوم عملية الطرح وربطها بالمواقف اليومية وإنجاز عمليات طرح بسيطة.', fileUrl: '/uploads/lessons/math-book-2.pdf' },
    { subject: 'MATH', order: 6, title: 'الأشكال الهندسية', description: 'التعرّف على المربع والمستطيل والمثلث والدائرة وتمييزها في المحيط.', fileUrl: '/uploads/lessons/math-book-1.pdf' },
    { subject: 'MATH', order: 7, title: 'القياس: الطول والكتلة والسعة', description: 'مقارنة الأطوال والكتل والسعات باستعمال الأدوات والمقارنات اليومية.', fileUrl: '/uploads/lessons/math-book-2.pdf' },
    { subject: 'MATH', order: 8, title: 'الترتيب والتصنيف', description: 'ترتيب الأشياء وتصنيفها حسب معايير مختلفة: اللون، الشكل، الحجم.', fileUrl: '/uploads/lessons/math-book-1.pdf' },
    { subject: 'READING', order: 1, title: 'الحروف الهجائية', description: 'التعرّف على حروف الهجاء بأشكالها المختلفة وأصواتها في بداية الكلمة ووسطها وآخرها.', fileUrl: '/uploads/lessons/reading-book-1.pdf' },
    { subject: 'READING', order: 2, title: 'أصوات الحروف', description: 'تمييز أصوات الحروف القصيرة والطويلة من خلال الكلمات والصور.', fileUrl: '/uploads/lessons/reading-book-1.pdf' },
    { subject: 'READING', order: 3, title: 'قراءة الكلمات', description: 'قراءة كلمات بسيطة مكوّنة من حروف مدروسة مع فهم معناها.', fileUrl: '/uploads/lessons/reading-book-1.pdf' },
    { subject: 'READING', order: 4, title: 'الجمل القصيرة', description: 'قراءة جمل قصيرة والتعبير عن معناها بالصور والحركات.', fileUrl: '/uploads/lessons/reading-book-1.pdf' },
    { subject: 'READING', order: 5, title: 'نصوص قصيرة', description: 'قراءة نصوص قصيرة مرفوقة بصور والإجابة عن أسئلة الفهم.', fileUrl: '/uploads/lessons/reading-exercises-1.pdf' },
    { subject: 'READING', order: 6, title: 'تمارين القراءة', description: 'كراس تمارين القراءة: تمارين تفاعلية لترسيخ المهارات القرائية.', fileUrl: '/uploads/lessons/reading-exercises-1.pdf' }
  ];

  // ===== Delegations =====
  try {
    for (const name of delegations) {
      await prisma.delegation.upsert({ where: { name }, update: {}, create: { name } });
    }
  } catch (e) { console.warn('Delegations error:', e.message); }

  // ===== Announcements =====
  try {
    for (const a of announcements) {
      await prisma.announcement.upsert({ where: { id: a.id ?? 0 }, update: a, create: a });
    }
  } catch (e) { console.warn('Announcements error:', e.message); }

  // ===== Articles =====
  try {
    for (const a of articles) {
      await prisma.article.upsert({ where: { id: a.id ?? 0 }, update: a, create: a });
    }
  } catch (e) { console.warn('Articles error:', e.message); }

  // ===== FAQs =====
  try {
    for (const f of faqs) {
      await prisma.faq.upsert({ where: { id: f.id ?? 0 }, update: f, create: f });
    }
  } catch (e) { console.warn('FAQs error:', e.message); }

  // ===== Lessons =====
  try {
    await prisma.lesson.deleteMany({});
  } catch (e) { console.warn('Lesson delete:', e.message); }
  for (const l of lessons) {
    try { await prisma.lesson.create({ data: l }); } catch (_) {}
  }

  // ===== Demo Users =====
  const demoUsers = [
    { firstName: 'مدير', lastName: 'المنصة', email: 'admin@education.tn', phone: '70017032', password: 'admin123', role: 'ADMIN' },
    { firstName: 'أحمد', lastName: 'التلميذ', email: 'student@test.tn', phone: '20000001', password: 'student123', role: 'STUDENT' },
    { firstName: 'محمد', lastName: 'الولي', email: 'parent@test.tn', phone: '20000002', password: 'parent123', role: 'PARENT' },
    { firstName: 'فاطمة', lastName: 'المعلمة', email: 'teacher@test.tn', phone: '20000003', password: 'teacher123', role: 'TEACHER' },
    { firstName: 'خالد', lastName: 'مدير المدرسة', email: 'director@test.tn', phone: '20000004', password: 'director123', role: 'SCHOOL_DIRECTOR' },
    { firstName: 'نظامي', lastName: 'المنصة', email: 'super@education.tn', phone: '70017033', password: 'super123', role: 'SUPER_ADMIN' }
  ];

  const users = {};
  let school;
  try {
    school = await prisma.school.upsert({
      where: { code: 'SCH-001' },
      update: {},
      create: { name: 'المدرسة النموذجية', code: 'SCH-001', status: 'ACTIVE' }
    });
  } catch (e) { console.warn('School error:', e.message); school = await prisma.school.findFirst({ where: { code: 'SCH-001' } }); }

  for (const u of demoUsers) {
    try {
      const existing = await prisma.user.findUnique({ where: { email: u.email } });
      if (existing) {
        users[u.email] = await prisma.user.update({ where: { email: u.email }, data: { role: u.role, passwordHash: await bcrypt.hash(u.password, 10) } });
      } else {
        users[u.email] = await prisma.user.create({
          data: { firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone, passwordHash: await bcrypt.hash(u.password, 10), role: u.role }
        });
      }
      console.log(`Demo user: ${u.email} / ${u.password} (${u.role})`);
    } catch (e) { console.warn('User error:', u.email, e.message); }
  }

  if (!school) {
    console.warn('No school available, skipping school-bound operations');
    console.log('Seeding finished (partial).');
    return;
  }

  // ===== Link demo users to school (lightweight — only demo users, not 3000+) =====
  try {
    const demoEmails = demoUsers.map(u => u.email);
    await prisma.user.updateMany({ where: { email: { in: demoEmails }, schoolId: null }, data: { schoolId: school.id } });
  } catch (e) { console.warn('User-school link error:', e.message); }

  // ===== Badges =====
  const badges = [
    { key: 'first_quiz', name: 'أول اختبار', icon: '🏅', description: 'أنجزت أول اختبار لك', condition: { type: 'QUIZ_COUNT', value: 1 } },
    { key: 'quiz_10', name: 'عشر اختبارات', icon: '🌟', description: 'أنجزت 10 اختبارات', condition: { type: 'QUIZ_COUNT', value: 10 } },
    { key: 'xp_100', name: 'مئة نقطة خبرة', icon: '⚡', description: 'تحصّلت على 100 نقطة خبرة', condition: { type: 'XP_TOTAL', value: 100 } },
    { key: 'xp_500', name: 'خمسمئة نقطة', icon: '💎', description: 'تحصّلت على 500 نقطة خبرة', condition: { type: 'XP_TOTAL', value: 500 } },
    { key: 'streak_3', name: 'سلسلة 3 أيام', icon: '🔥', description: '3 أيام متتالية من النشاط', condition: { type: 'STREAK_DAYS', value: 3 } },
    { key: 'streak_7', name: 'سلسلة 7 أيام', icon: '🏆', description: '7 أيام متتالية من النشاط', condition: { type: 'STREAK_DAYS', value: 7 } },
    { key: 'perfect_score', name: 'علامة ممتازة', icon: '🎯', description: 'حصلت على 100% في اختبار', condition: { type: 'PERFECT_SCORE', value: 1 } },
    { key: 'first_lesson', name: 'أول درس', icon: '📚', description: 'أتممت أول درس تفاعلي', condition: { type: 'LESSONS_COMPLETED', value: 1 } },
    { key: 'lessons_10', name: 'عشرة دروس', icon: '📖', description: 'أتممت 10 دروس تفاعلية', condition: { type: 'LESSONS_COMPLETED', value: 10 } },
    { key: 'lessons_50', name: 'خمسون درساً', icon: '🎓', description: 'أتممت 50 درساً تفاعلياً', condition: { type: 'LESSONS_COMPLETED', value: 50 } }
  ];
  try {
    for (const b of badges) {
      await prisma.badge.upsert({ where: { key: b.key }, update: b, create: b });
    }
  } catch (e) { console.warn('Badges error:', e.message); }

  // ===== Classes =====
  const teacherUser = users['teacher@test.tn'];
  if (!teacherUser) { console.warn('No teacher user, skipping classes'); console.log('Seeding finished.'); return; }

  const classes = [
    { name: 'قسم السنة الأولى أ', level: 'السنة الأولى أساسي', teacherId: teacherUser.id },
    { name: 'قسم السنة الأولى ب', level: 'السنة الأولى أساسي', teacherId: teacherUser.id },
    { name: 'قسم السنة الثانية أ', level: 'السنة الثانية أساسي', teacherId: teacherUser.id }
  ];
  const createdClasses = {};
  for (const c of classes) {
    try {
      const existingClass = await prisma.class.findFirst({ where: { name: c.name, level: c.level } });
      if (existingClass) { createdClasses[c.name] = existingClass; continue; }
      createdClasses[c.name] = await prisma.class.create({ data: { ...c, schoolId: school.id } });
    } catch (e) {
      console.warn('Class error:', c.name, e.message);
      try { createdClasses[c.name] = await prisma.class.findFirst({ where: { name: c.name } }); } catch (_) {}
    }
  }

  if (!createdClasses['قسم السنة الأولى أ']) { console.warn('No class, skipping student setup'); console.log('Seeding finished.'); return; }

  // ===== Student =====
  let student;
  try {
    const parent = users['parent@test.tn'];
    const studentAccount = users['student@test.tn'];
    if (parent && studentAccount) {
      const existingStudent = await prisma.student.findUnique({ where: { accountUserId: studentAccount.id } });
      student = existingStudent
        ? await prisma.student.update({ where: { id: existingStudent.id }, data: { userId: parent.id, classId: createdClasses['قسم السنة الأولى أ'].id, firstName: 'أحمد', lastName: 'التلميذ', birthDate: new Date('2019-03-15'), cin: '00000000', gender: 'ذكر', level: 'السنة الأولى أساسي', schoolYear: '2026-2027', schoolName: 'المدرسة الابتدائية النموذجية' } })
        : await prisma.student.create({ data: { userId: parent.id, accountUserId: studentAccount.id, classId: createdClasses['قسم السنة الأولى أ'].id, firstName: 'أحمد', lastName: 'التلميذ', birthDate: new Date('2019-03-15'), cin: '00000000', gender: 'ذكر', level: 'السنة الأولى أساسي', schoolYear: '2026-2027', schoolName: 'المدرسة الابتدائية النموذجية' } });
    }
  } catch (e) { console.warn('Student error:', e.message); }

  // ===== Subscription + Payment =====
  try {
    const studentAccount = users['student@test.tn'];
    if (studentAccount && student) {
      const existingSub = await prisma.subscription.findFirst({ where: { userId: studentAccount.id, schoolYear: '2026-2027' } });
      if (!existingSub) {
        const sub = await prisma.subscription.create({ data: { userId: studentAccount.id, type: 'STUDENT', plan: 'اشتراك تلميذ', schoolYear: '2026-2027', startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30'), status: 'ACTIVE', amount: 147, studentId: student.id } });
        await prisma.payment.create({ data: { subscriptionId: sub.id, amount: 147, method: 'OFFLINE', paidByUserId: users['admin@education.tn']?.id } });
      }
    }
  } catch (e) { console.warn('Subscription error:', e.message); }

  // ===== Subscription Request =====
  try {
    const parent = users['parent@test.tn'];
    if (parent) {
      const pendingReq = await prisma.subscriptionRequest.findFirst({ where: { parentId: parent.id, firstName: 'مريم' } });
      if (!pendingReq) {
        await prisma.subscriptionRequest.create({ data: { parentId: parent.id, firstName: 'مريم', lastName: 'التلميذة', birthDate: new Date('2020-05-10'), cin: '12345678', gender: 'أنثى', level: 'السنة الأولى أساسي', schoolYear: '2026-2027', schoolName: 'المدرسة الابتدائية النموذجية' } });
      }
    }
  } catch (e) { console.warn('SubscriptionRequest error:', e.message); }

  // ===== Assignment =====
  try {
    const demoAssignment = await prisma.assignment.findFirst({ where: { teacherId: teacherUser.id, title: 'واجب: الأعداد من 0 إلى 9' } });
    if (!demoAssignment) {
      await prisma.assignment.create({
        data: {
          teacherId: teacherUser.id, classId: createdClasses['قسم السنة الأولى أ'].id, subject: 'MATH',
          title: 'واجب: الأعداد من 0 إلى 9', description: 'أنجز التمارين المرفقة وارسِل إجاباتك قبل الموعد المحدد.',
          dueDate: new Date('2026-10-15T16:00:00'), status: 'PUBLISHED',
          questions: [
            { id: 'q1', type: 'MCQ', prompt: 'كم عدد الأصابع في اليد الواحدة؟', points: 2, options: ['4', '5', '6'], correctOption: '1' },
            { id: 'q2', type: 'TRUE_FALSE', prompt: 'العدد 9 أكبر من العدد 7.', points: 1, correctAnswer: 'TRUE' },
            { id: 'q3', type: 'FILL_BLANK', prompt: 'أكمل: 3 + 2 = ...', points: 1, correctAnswer: '5' }
          ]
        }
      });
    }
  } catch (e) { console.warn('Assignment error:', e.message); }

  // ===== License =====
  try {
    await prisma.license.upsert({ where: { key: 'R1F1Q1I-2026-DEMO' }, update: { entityName: 'المدرسة النموذجية التجريبية', status: 'ACTIVE' }, create: { key: 'R1F1Q1I-2026-DEMO', entityName: 'المدرسة النموذجية التجريبية', status: 'ACTIVE' } });
  } catch (e) { console.warn('License error:', e.message); }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error('Seed fatal error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
