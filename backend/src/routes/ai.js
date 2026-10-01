import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, teacherMiddleware, studentMiddleware } from '../auth.js';
import { notify } from '../services/notify.js';
import {
  saveAiKey,
  deleteAiKey,
  hasAiKey,
  generateQuizQuestions,
  generateStory,
  gradeShortAnswer,
  gradeSuggestion,
  reviewQuality,
  chatRefeeqi,
  chatRefeeqiWithContext,
  resolveLessonContext,
  generateLessonPlan,
  generateSummary,
  generatePresentation,
  batchGradeSubmissions
} from '../services/aiService.js';
import { getLessonPages, getSubjectsForLevel, listBooks, normalizeArabic } from '../services/curriculumService.js';
import { validateBody } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import {
  aiKeySchema,
  aiQuizGenSchema,
  aiStoryGenSchema,
  aiGradeShortSchema,
  aiGradeSuggestionSchema,
  aiReviewSchema,
  aiChatSchema,
  aiLessonPlanSchema,
  aiSummarySchema,
  aiPresentationSchema
} from '../validators/ai.js';

const router = Router();
router.use(authMiddleware);

// يحوّل تسمية مستوى من قاعدة البيانات (مثل «السنة الأولى أساسي»)
// إلى تسمية المنهج (مثل «السنة الأولى ابتدائي») عند التطابق الجزئي.
function levelToCurriculumTitle(level) {
  const s = String(level || '').trim();
  return s.replace(/أساسي/gi, 'ابتدائي').replace(/إعدادي/gi, 'ابتدائي');
}

function aiError(e) {
  if (e.message === 'NO_AI_KEY') return new ApiError(400, 'لم يتم ضبط مفتاح الذكاء الاصطناعي بعد. أضف مفتاحك من إعدادات AI');
  if (e.code === 'AI_PLAN_INVALID') return new ApiError(422, e.message);
  const st = e.providerStatus || Number(String(e.message || '').match(/AI service error:\s*(\d+)/)?.[1] || 0);
  if (st === 400) return new ApiError(400, 'طلب مرفوض من خدمة الذكاء الاصطناعي — تحقق من صياغة الدرس وأعد المحاولة');
  if (st === 401 || st === 403) return new ApiError(401, 'مفتاح الذكاء الاصطناعي مرفوض — تحقق من نسخه كاملاً من Google AI Studio وأعد حفظه');
  if (st === 404) return new ApiError(502, 'نموذج الذكاء غير متاح حالياً — حاول لاحقاً');
  if (st === 429) return new ApiError(429, 'تجاوزت حصة الذكاء المجانية — انتظر قليلاً ثم أعد المحاولة');
  return new ApiError(502, 'تعذر الاتصال بخدمة الذكاء الاصطناعي');
}

/**
 * @swagger
 * /api/ai/key:
 *   get:
 *     summary: هل المفتاح مهيأ؟
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: حالة التهيئة
 */
router.get('/key', teacherMiddleware, asyncHandler(async (req, res) => {
  const key = await hasAiKey(req.user.id);
  res.json({ configured: !!key });
}));

/**
 * @swagger
 * /api/ai/key:
 *   post:
 *     summary: حفظ مفتاح Gemini
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [apiKey]
 *             properties:
 *               apiKey: { type: string }
 *     responses:
 *       200:
 *         description: تم الحفظ
 *       400:
 *         description: المفتاح مطلوب
 */
router.post('/key', teacherMiddleware, validateBody(aiKeySchema), asyncHandler(async (req, res) => {
  const { apiKey } = req.body;
  await saveAiKey(req.user.id, String(apiKey).trim());
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/ai/key:
 *   delete:
 *     summary: حذف مفتاح Gemini
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم الحذف
 */
router.delete('/key', teacherMiddleware, asyncHandler(async (req, res) => {
  await deleteAiKey(req.user.id);
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/ai/generate-quiz:
 *   post:
 *     summary: توليد أسئلة اختبار بالذكاء الاصطناعي
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject: { type: string }
 *               level: { type: string }
 *               lessonTitle: { type: string }
 *               count: { type: integer }
 *     responses:
 *       200:
 *         description: الأسئلة المولدة
 *       400:
 *         description: مفتاح غير مهيأ
 *       502:
 *         description: تعذر الاتصال
 */
router.post('/generate-quiz', teacherMiddleware, validateBody(aiQuizGenSchema), asyncHandler(async (req, res) => {
  const { subject, level, lessonTitle, count } = req.body;
  try {
    const questions = await generateQuizQuestions(req.user.id, {
      subject: subject || 'الرياضيات',
      level: level || 'السنة الأولى',
      lessonTitle,
      count: Number(count) || 5
    });
    res.json({ questions });
  } catch (e) {
    throw aiError(e);
  }
}));

/**
 * @swagger
 * /api/ai/generate-story:
 *   post:
 *     summary: توليد قصة بالذكاء الاصطناعي
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               level: { type: string }
 *               theme: { type: string }
 *     responses:
 *       200:
 *         description: القصة المولدة
 *       400:
 *         description: مفتاح غير مهيأ
 *       502:
 *         description: تعذر الاتصال
 */
router.post('/generate-story', teacherMiddleware, validateBody(aiStoryGenSchema), asyncHandler(async (req, res) => {
  const { level, theme } = req.body;
  try {
    const story = await generateStory(req.user.id, { level: level || 'السنة الأولى', theme });
    res.json({ story });
  } catch (e) {
    throw aiError(e);
  }
}));

/**
 * @swagger
 * /api/ai/grade-short:
 *   post:
 *     summary: تصحيح إجابة قصيرة بالذكاء الاصطناعي
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question, modelAnswer, studentAnswer]
 *             properties:
 *               question: { type: string }
 *               modelAnswer: { type: string }
 *               studentAnswer: { type: string }
 *     responses:
 *       200:
 *         description: نتيجة التصحيح
 *       400:
 *         description: فشل التحقق من البيانات
 *       502:
 *         description: تعذر الاتصال
 */
router.post('/grade-short', teacherMiddleware, validateBody(aiGradeShortSchema), asyncHandler(async (req, res) => {
  const { question, modelAnswer, studentAnswer } = req.body;
  try {
    const result = await gradeShortAnswer(req.user.id, { question, modelAnswer, studentAnswer });
    res.json({ result });
  } catch (e) {
    throw aiError(e);
  }
}));

/**
 * @swagger
 * /api/ai/grade-suggestion:
 *   post:
 *     summary: اقتراح علامة للذكاء الاصطناعي
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question, studentAnswer]
 *             properties:
 *               question: { type: string }
 *               studentAnswer: { type: string }
 *     responses:
 *       200:
 *         description: الاقتراح
 *       400:
 *         description: فشل التحقق من البيانات
 *       502:
 *         description: تعذر الاتصال
 */
router.post('/grade-suggestion', teacherMiddleware, validateBody(aiGradeSuggestionSchema), asyncHandler(async (req, res) => {
  const { question, studentAnswer } = req.body;
  try {
    const suggestion = await gradeSuggestion(req.user.id, { question, studentAnswer });
    res.json({ suggestion });
  } catch (e) {
    throw aiError(e);
  }
}));

/**
 * @swagger
 * /api/ai/review:
 *   post:
 *     summary: مراجعة جودة محتوى
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string }
 *               type: { type: string }
 *     responses:
 *       200:
 *         description: المراجعة
 *       400:
 *         description: فشل التحقق من البيانات
 *       502:
 *         description: تعذر الاتصال
 */
router.post('/review', teacherMiddleware, validateBody(aiReviewSchema), asyncHandler(async (req, res) => {
  const { content, type } = req.body;
  try {
    const review = await reviewQuality(req.user.id, { content, type });
    res.json({ review });
  } catch (e) {
    throw aiError(e);
  }
}));

/**
 * @swagger
 * /api/ai/chat/history:
 *   get:
 *     summary: سجل محادثة التلميذ مع رفيقي
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الرسائل
 */
router.get('/chat/history', studentMiddleware, asyncHandler(async (req, res) => {
  const messages = await prisma.studentChat.findMany({
    where: { studentId: req.user.id },
    orderBy: { createdAt: 'asc' },
    take: 100
  });
  res.json(messages);
}));

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: إرسال رسالة إلى رفيقي
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: رد رفيقي
 *       400:
 *         description: الرسالة مطلوبة
 *       502:
 *         description: تعذر الاتصال
 */
router.post('/chat', studentMiddleware, validateBody(aiChatSchema), asyncHandler(async (req, res) => {
  const { message, gradeId, subjectId, lessonId } = req.body;
  const student = await prisma.student.findFirst({
    where: { accountUserId: req.user.id },
    include: { class: { select: { teacherId: true, level: true } } }
  });
  const userMessage = String(message).trim().slice(0, 500);
  await prisma.studentChat.create({
    data: { studentId: req.user.id, role: 'user', content: userMessage }
  });

  const teacherId = student?.class?.teacherId ?? null;
  const studentName = student ? `${student.firstName} ${student.lastName}` : 'التلميذ';
  const contextText = resolveLessonContext({
    gradeId,
    subjectId,
    lessonId,
    level: student?.class?.level || student?.level,
    subject: subjectId
  });

  try {
    // لا نمنع تلميذًا بلا قسم (مثل حساب الاستكشاف): resolveApiKey ينحدر إلى
    // مفتاح المنصة ثم متغير البيئة، ويرمي NO_AI_KEY بنفسه إن لم يوجد أي مفتاح
    // (نفس الردّ اللطيف أدناه). السطر السابق جمّد الميزة عند «لا مفتاح» أبدًا.
    const reply = contextText
      ? await chatRefeeqiWithContext(req.user.id, teacherId, userMessage, studentName, contextText)
      : await chatRefeeqi(req.user.id, teacherId, userMessage, studentName);
    const saved = await prisma.studentChat.create({
      data: { studentId: req.user.id, role: 'assistant', content: reply }
    });
    res.json(saved);
  } catch (e) {
    if (e.message === 'NO_AI_KEY') {
      const fallback = 'أهلا بك! رفيقي لم يتوفر له مفتاح الذكاء الاصطناعي بعد. اسأل معلمك لتفعيل هذه الخدمة.';
      const saved = await prisma.studentChat.create({
        data: { studentId: req.user.id, role: 'assistant', content: fallback }
      });
      return res.json(saved);
    }
    throw new ApiError(502, 'تعذر الاتصال بخدمة الذكاء الاصطناعي');
  }
}));

/**
 * @swagger
 * /api/ai/student/tutor-context:
 *   get:
 *     summary: سياق رفيقي (المرحلة 7.1) — كتب/دروس متاحة لتلميذ حسب مستواه
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: المستوى + المواد + الدروس المتاحة
 */
router.get('/student/tutor-context', studentMiddleware, asyncHandler(async (req, res) => {
  const student = await prisma.student.findFirst({
    where: { accountUserId: req.user.id },
    include: { class: { select: { level: true } } }
  });
  const level = student?.class?.level || student?.level || '';
  const curriculumLevel = levelToCurriculumTitle(level);

  let subjects = getSubjectsForLevel(curriculumLevel);
  if (!subjects.length) subjects = getSubjectsForLevel(level);

  const books = listBooks();
  const norm = normalizeArabic(curriculumLevel);
  const gradeId = (() => {
    const book = books.find((b) => normalizeArabic(b.grade) === norm);
    if (book) return book.gradeId;
    return books.find((b) => {
      const bg = normalizeArabic(b.grade);
      return bg && norm && (bg.includes(norm) || norm.includes(bg));
    })?.gradeId || null;
  })();

  const enriched = subjects.map((s) => ({
    id: s.id,
    title: s.title,
    lessons: getLessonPages(s.id, level, gradeId || undefined).map((p) => ({ id: p.id, title: p.title }))
  }));

  res.json({ level, gradeId, subjects: enriched });
}));

/**
 * @swagger
 * /api/ai/generate-lesson-plan:
 *   post:
 *     summary: توليد خطة درس كاملة بالذكاء الاصطناعي (المرحلة 7.2)
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lessonTitle]
 *             properties:
 *               subject: { type: string }
 *               level: { type: string }
 *               lessonTitle: { type: string }
 *               duration: { type: integer }
 *               gradeId: { type: string }
 *               subjectId: { type: string }
 *               lessonId: { type: string }
 *     responses:
 *       200:
 *         description: خطة الدرس المولدة
 */
router.post('/generate-lesson-plan', teacherMiddleware, validateBody(aiLessonPlanSchema), asyncHandler(async (req, res) => {
  const { subject, level, lessonTitle, duration, gradeId, subjectId, lessonId } = req.body;
  try {
    const lessonPlan = await generateLessonPlan(req.user.id, {
      subject: subject || 'الرياضيات',
      level: level || 'السنة الأولى أساسي',
      lessonTitle,
      duration: Number(duration) || 45,
      gradeId,
      subjectId,
      lessonId
    });
    if (!lessonPlan) {
      throw new ApiError(502, 'تعذر توليد خطة الدرس — أعد المحاولة أو غيّر صياغة عنوان الدرس');
    }
    res.json({ lessonPlan });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw aiError(e);
  }
}));

/**
 * @swagger
 * /api/ai/generate-summary:
 *   post:
 *     summary: توليد ملخص درس بالذكاء الاصطناعي (المرحلة 7.2)
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lessonTitle]
 *             properties:
 *               subject: { type: string }
 *               level: { type: string }
 *               lessonTitle: { type: string }
 *               maxWords: { type: integer }
 *               gradeId: { type: string }
 *               subjectId: { type: string }
 *               lessonId: { type: string }
 *     responses:
 *       200:
 *         description: الملخص المولد
 */
router.post('/generate-summary', teacherMiddleware, validateBody(aiSummarySchema), asyncHandler(async (req, res) => {
  const { subject, level, lessonTitle, maxWords, gradeId, subjectId, lessonId } = req.body;
  try {
    const summary = await generateSummary(req.user.id, {
      subject: subject || 'الرياضيات',
      level: level || 'السنة الأولى أساسي',
      lessonTitle,
      maxWords: Number(maxWords) || 150,
      gradeId,
      subjectId,
      lessonId
    });
    res.json({ summary });
  } catch (e) {
    throw aiError(e);
  }
}));

/**
 * @swagger
 * /api/ai/generate-presentation:
 *   post:
 *     summary: توليد شرائح عرض تقديمي بالذكاء الاصطناعي (المرحلة 7.2)
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lessonTitle]
 *             properties:
 *               subject: { type: string }
 *               level: { type: string }
 *               lessonTitle: { type: string }
 *               slideCount: { type: integer }
 *               gradeId: { type: string }
 *               subjectId: { type: string }
 *               lessonId: { type: string }
 *     responses:
 *       200:
 *         description: الشرائح المولدة
 */
router.post('/generate-presentation', teacherMiddleware, validateBody(aiPresentationSchema), asyncHandler(async (req, res) => {
  const { subject, level, lessonTitle, slideCount, gradeId, subjectId, lessonId } = req.body;
  try {
    const slides = await generatePresentation(req.user.id, {
      subject: subject || 'الرياضيات',
      level: level || 'السنة الأولى أساسي',
      lessonTitle,
      slideCount: Number(slideCount) || 8,
      gradeId,
      subjectId,
      lessonId
    });
    if (!slides) {
      throw new ApiError(502, 'تعذر توليد الشرائح من الذكاء الاصطناعي — أعد المحاولة أو غيّر صياغة عنوان الدرس');
    }
    res.json({ slides });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw aiError(e);
  }
}));

// ===== التصحيح الذكي الجماعي =====
router.post('/batch-grade', teacherMiddleware, asyncHandler(async (req, res) => {
  const { lessonId } = req.body;
  if (!lessonId) throw new ApiError(400, 'lessonId مطلوب');

  // جلب إرسالات التلاميذ المعلّميonly
  const myClasses = await prisma.class.findMany({
    where: { teacherId: req.user.id },
    select: { id: true }
  });
  const myStudents = await prisma.student.findMany({
    where: { classId: { in: myClasses.map(c => c.id) }, NOT: { accountUserId: null } },
    select: { accountUserId: true, firstName: true, lastName: true }
  });
  const studentIds = myStudents.map(s => s.accountUserId);
  const nameMap = new Map(myStudents.map(s => [s.accountUserId, `${s.firstName} ${s.lastName}`]));

  const submissions = await prisma.lessonSubmission.findMany({
    where: { userId: { in: studentIds }, lessonId, status: 'SUBMITTED' }
  });

  if (!submissions.length) {
    return res.json({ ok: true, message: 'لا توجد إرسالات معلّقة للتصحيح', results: [] });
  }

  // جلب سياق الدرس
  const lessonContext = resolveLessonContext({ lessonId });

  const results = await batchGradeSubmissions(req.user.id, {
    lessonId,
    submissions: submissions.map(s => ({
      id: s.id,
      studentName: nameMap.get(s.userId) || 'تلميذ',
      answers: s.answers
    })),
    lessonContext
  });

  // حفظ الاقتراحات (بدون نشرها)
  for (const r of results) {
    if (r.score !== null) {
      await prisma.lessonSubmission.update({
        where: { id: r.submissionId },
        data: {
          grade: r.score,
          feedback: r.feedback || null,
          status: 'IN_REVIEW'
        }
      });
    }
  }

  res.json({
    ok: true,
    message: `تم تصحيح ${results.length} إرسال بالذكاء الاصطناعي — في انتظار مراجعتك`,
    results
  });
}));

// ===== مراجعة ونشر الدرجات =====
router.post('/publish-grades', teacherMiddleware, asyncHandler(async (req, res) => {
  const { lessonId, approvedIds, rejectedIds } = req.body;
  if (!lessonId) throw new ApiError(400, 'lessonId مطلوب');

  const myClasses = await prisma.class.findMany({
    where: { teacherId: req.user.id },
    select: { id: true }
  });
  const myStudents = await prisma.student.findMany({
    where: { classId: { in: myClasses.map(c => c.id) }, NOT: { accountUserId: null } },
    select: { accountUserId: true }
  });
  const studentIds = myStudents.map(s => s.accountUserId);

  // نشر المقبولين
  const toPublish = approvedIds?.length
    ? await prisma.lessonSubmission.findMany({ where: { id: { in: approvedIds }, userId: { in: studentIds } } })
    : await prisma.lessonSubmission.findMany({ where: { userId: { in: studentIds }, lessonId, status: 'IN_REVIEW' } });

  for (const sub of toPublish) {
    await prisma.lessonSubmission.update({
      where: { id: sub.id },
      data: { status: 'GRADED' }
    });
    await notify([sub.userId], {
      type: 'LESSON_GRADED',
      title: 'تم تصحيح واجبك التفاعلي',
      body: `${sub.lessonTitle || 'الدرس'} — النتيجة ${sub.grade ?? '—'}/20`,
      link: '/student/stories'
    });
  }

  // إرجاع المرفوضين
  if (rejectedIds?.length) {
    await prisma.lessonSubmission.updateMany({
      where: { id: { in: rejectedIds }, userId: { in: studentIds } },
      data: { status: 'SUBMITTED', grade: null, feedback: null }
    });
  }

  res.json({ ok: true, published: toPublish.length, rejected: rejectedIds?.length || 0 });
}));

export default router;
