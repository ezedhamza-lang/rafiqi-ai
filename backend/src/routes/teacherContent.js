import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, teacherMiddleware } from '../auth.js';
import { buildMemo, rebuildMemo } from '../services/memoService.js';
import { buildResource, rebuildResource } from '../services/resourceService.js';
import { getBankExam, buildExamContent, officialExamSummary } from '../services/officialExamService.js';
// Dynamic import for docx service — loaded lazily to avoid crashing server if docx package unavailable
let _docxService = null;
async function getDocxService() {
  if (!_docxService) {
    try {
      _docxService = await import('../services/officialDocxService.js');
    } catch (e) {
      console.error('Failed to load officialDocxService:', e.message);
      throw new Error('خدمة تصدير Word غير متوفرة حالياً');
    }
  }
  return _docxService;
}
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import {
  memoGenerateSchema,
  memoContentSchema,
  resourceCreateSchema,
  resourceContentSchema,
  resourceShareSchema,
  libraryQuerySchema,
  teacherExamCreateSchema,
  teacherExamUpdateSchema,
  examSubmissionScoreSchema,
  examSubmissionParamsSchema,
  teacherContentIdParamSchema
} from '../validators/teacherContent.js';

const router = Router();
router.use(authMiddleware);

/**
 * @swagger
 * /api/teacher/memos:
 *   get:
 *     summary: مذكرات الأستاذ
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة المذكرات
 */
router.get('/memos', teacherMiddleware, asyncHandler(async (req, res) => {
  const memos = await prisma.memo.findMany({
    where: { teacherId: req.user.id },
    orderBy: { updatedAt: 'desc' }
  });
  res.json(memos);
}));

/**
 * @swagger
 * /api/teacher/memos/generate:
 *   post:
 *     summary: إنشاء مذكرة
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, lessonTitle]
 *             properties:
 *               subject: { type: string }
 *               level: { type: string }
 *               lessonTitle: { type: string }
 *               unit: { type: string }
 *               bookTitle: { type: string }
 *     responses:
 *       200:
 *         description: المذكرة
 *       400:
 *         description: فشل التحقق من البيانات
 */
router.post('/memos/generate', teacherMiddleware, validateBody(memoGenerateSchema), asyncHandler(async (req, res) => {
  const { subject, level, lessonTitle, unit, bookTitle } = req.body;
  try {
    const result = await buildMemo({
      teacherId: req.user.id,
      subject,
      level: level || 'السنة الأولى أساسي',
      lessonTitle,
      unit,
      bookTitle
    });
    res.json(result);
  } catch (e) {
    throw new ApiError(400, e.message);
  }
}));

/**
 * @swagger
 * /api/teacher/memos/{id}:
 *   put:
 *     summary: تعديل مذكرة
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: object }
 *     responses:
 *       200:
 *         description: تم التعديل
 *       400:
 *         description: المحتوى مطلوب
 *       404:
 *         description: المذكرة غير موجودة
 */
router.put('/memos/:id', teacherMiddleware, validateParams(teacherContentIdParamSchema), validateBody(memoContentSchema), asyncHandler(async (req, res) => {
  const { content } = req.body;
  const memo = await prisma.memo.updateMany({
    where: { id: Number(req.params.id), teacherId: req.user.id },
    data: { content }
  });
  if (memo.count === 0) throw new ApiError(404, 'المذكرة غير موجودة');
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/teacher/memos/{id}/rebuild:
 *   post:
 *     summary: إعادة بناء مذكرة
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: المذكرة المعاد بناؤها
 *       400:
 *         description: فشل الإعادة
 *       404:
 *         description: المذكرة غير موجودة
 */
router.post('/memos/:id/rebuild', teacherMiddleware, validateParams(teacherContentIdParamSchema), asyncHandler(async (req, res) => {
  try {
    const result = await rebuildMemo(Number(req.params.id), req.user.id);
    if (!result) throw new ApiError(404, 'المذكرة غير موجودة');
    res.json(result);
  } catch (e) {
    throw new ApiError(400, e.message);
  }
}));

/**
 * @swagger
 * /api/teacher/memos/{id}:
 *   delete:
 *     summary: حذف مذكرة
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: تم الحذف
 */
router.delete('/memos/:id', teacherMiddleware, validateParams(teacherContentIdParamSchema), asyncHandler(async (req, res) => {
  await prisma.memo.deleteMany({ where: { id: Number(req.params.id), teacherId: req.user.id } });
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/teacher/resources:
 *   get:
 *     summary: موارد الأستاذ
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: kind
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: قائمة الموارد
 */
router.get('/resources', teacherMiddleware, asyncHandler(async (req, res) => {
  const kind = req.query.kind;
  const where = { teacherId: req.user.id, ...(kind ? { kind } : {}) };
  const resources = await prisma.teachingResource.findMany({
    where,
    orderBy: { updatedAt: 'desc' }
  });
  res.json(resources);
}));

/**
 * @swagger
 * /api/teacher/resources:
 *   post:
 *     summary: إنشاء مورد تعليمي
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [kind, lessonTitle]
 *             properties:
 *               kind: { type: string }
 *               subject: { type: string }
 *               level: { type: string }
 *               lessonTitle: { type: string }
 *               input: { type: string }
 *     responses:
 *       201:
 *         description: المورد
 *       400:
 *         description: فشل التحقق من البيانات
 */
router.post('/resources', teacherMiddleware, validateBody(resourceCreateSchema), asyncHandler(async (req, res) => {
  const { kind, subject, level, lessonTitle, input } = req.body;
  try {
    const resource = await buildResource({
      teacherId: req.user.id,
      kind,
      subject: subject || 'MATH',
      level: level || 'السنة الأولى أساسي',
      lessonTitle,
      input
    });
    res.status(201).json(resource);
  } catch (e) {
    throw new ApiError(400, e.message);
  }
}));

/**
 * @swagger
 * /api/teacher/resources/{id}:
 *   put:
 *     summary: تعديل مورد
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: object }
 *     responses:
 *       200:
 *         description: تم التعديل
 *       400:
 *         description: المحتوى مطلوب
 *       404:
 *         description: المورد غير موجود
 */
router.put('/resources/:id', teacherMiddleware, validateParams(teacherContentIdParamSchema), validateBody(resourceContentSchema), asyncHandler(async (req, res) => {
  const { content } = req.body;
  const r = await prisma.teachingResource.updateMany({
    where: { id: Number(req.params.id), teacherId: req.user.id },
    data: { content, title: content.title }
  });
  if (r.count === 0) throw new ApiError(404, 'المورد غير موجود');
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/teacher/resources/{id}/rebuild:
 *   post:
 *     summary: إعادة بناء مورد
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: المورد المعاد بناؤه
 *       400:
 *         description: فشل الإعادة
 *       404:
 *         description: المورد غير موجود
 */
router.post('/resources/:id/rebuild', teacherMiddleware, validateParams(teacherContentIdParamSchema), asyncHandler(async (req, res) => {
  try {
    const resource = await rebuildResource(Number(req.params.id), req.user.id);
    if (!resource) throw new ApiError(404, 'المورد غير موجود');
    res.json(resource);
  } catch (e) {
    throw new ApiError(400, e.message);
  }
}));

/**
 * @swagger
 * /api/teacher/resources/{id}/share:
 *   put:
 *     summary: مشاركة مورد في المكتبة
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shared: { type: boolean }
 *     responses:
 *       200:
 *         description: تم التحديث
 *       404:
 *         description: المورد غير موجود
 */
router.put('/resources/:id/share', teacherMiddleware, validateParams(teacherContentIdParamSchema), validateBody(resourceShareSchema), asyncHandler(async (req, res) => {
  const { shared } = req.body;
  const r = await prisma.teachingResource.updateMany({
    where: { id: Number(req.params.id), teacherId: req.user.id },
    data: { isShared: !!shared, sharedAt: shared ? new Date() : null }
  });
  if (r.count === 0) throw new ApiError(404, 'المورد غير موجود');
  res.json({ ok: true, isShared: !!shared });
}));

/**
 * @swagger
 * /api/teacher/library:
 *   get:
 *     summary: المكتبة المشتركة بين الأساتذة
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: subject
 *         schema: { type: string }
 *       - in: query
 *         name: level
 *         schema: { type: string }
 *       - in: query
 *         name: kind
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: قائمة الموارد المشتركة
 */
router.get('/library', teacherMiddleware, validateQuery(libraryQuerySchema), asyncHandler(async (req, res) => {
  const { subject, level, kind } = req.query;
  const where = { isShared: true };
  if (subject) where.subject = subject;
  if (level) where.level = level;
  if (kind) where.kind = kind;
  const resources = await prisma.teachingResource.findMany({
    where,
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } }
    },
    orderBy: { sharedAt: 'desc' }
  });
  res.json(resources);
}));

/**
 * @swagger
 * /api/teacher/resources/{id}:
 *   delete:
 *     summary: حذف مورد
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: تم الحذف
 */
router.delete('/resources/:id', teacherMiddleware, validateParams(teacherContentIdParamSchema), asyncHandler(async (req, res) => {
  await prisma.teachingResource.deleteMany({ where: { id: Number(req.params.id), teacherId: req.user.id } });
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/teacher/exams:
 *   get:
 *     summary: اختبارات الأستاذ الرسمية
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الاختبارات
 */
router.get('/exams', teacherMiddleware, asyncHandler(async (req, res) => {
  const exams = await prisma.officialExam.findMany({
    where: { teacherId: req.user.id },
    include: { class: true, _count: { select: { submissions: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(exams);
}));

/**
 * @swagger
 * /api/teacher/exams:
 *   post:
 *     summary: إنشاء اختبار رسمي
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, subject]
 *             properties:
 *               title: { type: string }
 *               subject: { type: string }
 *               classId: { type: integer }
 *               trimester: { type: integer }
 *               content: { type: object }
 *     responses:
 *       201:
 *         description: الاختبار
 *       400:
 *         description: فشل التحقق من البيانات
 */
router.post('/exams', teacherMiddleware, validateBody(teacherExamCreateSchema), asyncHandler(async (req, res) => {
  const { title, subject, classId, trimester, content } = req.body;
  const exam = await prisma.officialExam.create({
    data: {
      teacherId: req.user.id,
      title: String(title).trim(),
      subject,
      classId: classId ? Number(classId) : null,
      trimester: trimester ? Number(trimester) : null,
      content: content || null
    }
  });
  res.status(201).json(exam);
}));

/**
 * @swagger
 * /api/teacher/exams/instantiate:
 *   post:
 *     summary: إنشاء اختبار رسمي من بنك الاختبارات الرسمية
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bankId]
 *             properties:
 *               bankId: { type: string }
 *               classId: { type: integer }
 *     responses:
 *       201:
 *         description: الاختبار المنشأ
 *       400:
 *         description: قالب غير صالح
 *       404:
 *         description: القالب غير موجود
 */
router.post('/exams/instantiate', teacherMiddleware, asyncHandler(async (req, res) => {
  const { bankId, classId } = req.body || {};
  if (!bankId) throw new ApiError(400, 'معرف قالب الاختبار مطلوب');
  const bankExam = getBankExam(bankId);
  if (!bankExam) throw new ApiError(404, 'قالب الاختبار غير موجود');
  // بيانات ظرفية (اسم المعلّم/المدرسة/السنة الدراسية) تُمرَّر هنا من سياق
  // الطلب الحالي، وليس من ملف البنك — راجع ملاحظة buildExamContent().
  // TODO: اربط school بالمصدر الفعلي لاسم المدرسة في نظامكم (مثلاً عبر
  // جدول/إعداد مرتبط بـ req.user أو classId) بدل الترك فارغًا.
  const content = buildExamContent(bankExam, {
    school: req.user.school || '',
    schoolYear: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
  });
  const exam = await prisma.officialExam.create({
    data: {
      teacherId: req.user.id,
      title: bankExam.title,
      subject: bankExam.subject,
      classId: classId ? Number(classId) : null,
      trimester: Number(bankExam.trimester) || null,
      content
    }
  });
  res.status(201).json({ ...exam, summary: officialExamSummary(content) });
}));

/**
 * @swagger
 * /api/teacher/exams/{id}/preview:
 *   get:
 *     summary: معاينة اختبار رسمي (مع جدول إسناد الأعداد ومعلومات التصحيح الآلي)
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: الاختبار مع الملخص
 *       404:
 *         description: الاختبار غير موجود
 */
router.get('/exams/:id/preview', teacherMiddleware, validateParams(teacherContentIdParamSchema), asyncHandler(async (req, res) => {
  const exam = await prisma.officialExam.findFirst({
    where: { id: Number(req.params.id), teacherId: req.user.id }
  });
  if (!exam) throw new ApiError(404, 'الاختبار غير موجود');
  res.json({ ...exam, summary: officialExamSummary(exam.content) });
}));

/**
 * @swagger
 * /api/teacher/exams/{id}:
 *   put:
 *     summary: تعديل اختبار رسمي
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               classId: { type: integer }
 *               trimester: { type: integer }
 *               content: { type: object }
 *               published: { type: boolean }
 *     responses:
 *       200:
 *         description: تم التعديل
 *       400:
 *         description: فشل التحقق من البيانات
 *       404:
 *         description: الاختبار غير موجود
 */
router.put('/exams/:id', teacherMiddleware, validateParams(teacherContentIdParamSchema), validateBody(teacherExamUpdateSchema), asyncHandler(async (req, res) => {
  const { title, classId, trimester, content, published } = req.body;
  const r = await prisma.officialExam.updateMany({
    where: { id: Number(req.params.id), teacherId: req.user.id },
    data: {
      ...(title ? { title: String(title).trim() } : {}),
      ...(classId !== undefined ? { classId: classId ? Number(classId) : null } : {}),
      ...(trimester !== undefined ? { trimester: trimester ? Number(trimester) : null } : {}),
      ...(content ? { content } : {}),
      ...(published !== undefined ? { published: !!published } : {})
    }
  });
  if (r.count === 0) throw new ApiError(404, 'الاختبار غير موجود');
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/teacher/exams/{id}:
 *   delete:
 *     summary: حذف اختبار رسمي
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: تم الحذف
 */
router.delete('/exams/:id', teacherMiddleware, validateParams(teacherContentIdParamSchema), asyncHandler(async (req, res) => {
  await prisma.officialExam.deleteMany({ where: { id: Number(req.params.id), teacherId: req.user.id } });
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/teacher/exams/{id}/submissions:
 *   get:
 *     summary: تسليمات اختبار رسمي
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: قائمة التسليمات
 *       404:
 *         description: الاختبار غير موجود
 */
router.get('/exams/:id/submissions', teacherMiddleware, validateParams(teacherContentIdParamSchema), asyncHandler(async (req, res) => {
  const exam = await prisma.officialExam.findFirst({
    where: { id: Number(req.params.id), teacherId: req.user.id }
  });
  if (!exam) throw new ApiError(404, 'الاختبار غير موجود');
  const submissions = await prisma.officialSubmission.findMany({
    where: { examId: exam.id },
    include: { student: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(submissions);
}));

/**
 * @swagger
 * /api/teacher/exams/{id}/submissions/{subId}:
 *   put:
 *     summary: تصحيح تسليم اختبار رسمي
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: subId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               score: { type: number }
 *               status: { type: string }
 *               aiSuggestion: { type: object }
 *     responses:
 *       200:
 *         description: تم التصحيح
 *       400:
 *         description: فشل التحقق من البيانات
 *       404:
 *         description: الاختبار غير موجود
 */
router.put('/exams/:id/submissions/:subId', teacherMiddleware, validateParams(examSubmissionParamsSchema), validateBody(examSubmissionScoreSchema), asyncHandler(async (req, res) => {
  const { score, status, aiSuggestion } = req.body;
  const exam = await prisma.officialExam.findFirst({
    where: { id: Number(req.params.id), teacherId: req.user.id }
  });
  if (!exam) throw new ApiError(404, 'الاختبار غير موجود');
  await prisma.officialSubmission.update({
    where: { id: Number(req.params.subId) },
    data: {
      ...(score !== undefined ? { score: Number(score) } : {}),
      ...(status ? { status } : {}),
      ...(aiSuggestion !== undefined ? { aiSuggestion } : {})
    }
  });
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/teacher/exams/{id}/docx:
 *   get:
 *     summary: تصدير اختبار رسمي كملف Word (.docx)
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ملف Word
 *         content:
 *           application/vnd.openxmlformats-officedocument.wordprocessingml.document:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: الاختبار غير موجود
 */
router.get('/exams/:id/docx', teacherMiddleware, validateParams(teacherContentIdParamSchema), asyncHandler(async (req, res) => {
  const { buildOfficialDocx, prepareExamForDocx } = await getDocxService();
  const exam = await prisma.officialExam.findFirst({
    where: { id: Number(req.params.id), teacherId: req.user.id }
  });
  if (!exam) throw new ApiError(404, 'الاختبار غير موجود');

  const docxData = prepareExamForDocx(exam.content, {
    subject: exam.subject,
    level: exam.class?.level,
    trimester: exam.trimester,
    durationMinutes: exam.content?.durationMinutes
  });

  if (!docxData) throw new ApiError(400, 'بيانات الاختبار غير صالحة');

  const buffer = await buildOfficialDocx(docxData, {
    school: req.user.school || '',
    teacherName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
    studentName: '................................',
    studentClass: exam.class?.name || '...........',
    date: new Date().toLocaleDateString('ar-TN')
  });

  const filename = `exam-${exam.id}-${Date.now()}.docx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
}));

/**
 * @swagger
 * /api/teacher/exams/generate-docx:
 *   post:
 *     summary: إنشاء اختبار رسمي وتصديره كملف Word (.docx) مباشرة
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject]
 *             properties:
 *               subject: { type: string }
 *               level: { type: integer }
 *               trimester: { type: integer }
 *               title: { type: string }
 *               durationMinutes: { type: integer }
 *               content: { type: object }
 *     responses:
 *       200:
 *         description: ملف Word
 *       400:
 *         description: بيانات غير صالحة
 */
router.post('/exams/generate-docx', teacherMiddleware, asyncHandler(async (req, res) => {
  const { buildOfficialDocx, prepareExamForDocx } = await getDocxService();
  const { subject, level, trimester, title, durationMinutes, content: examContent, classId } = req.body;

  if (!subject) throw new ApiError(400, 'المادة مطلوبة');

  const docxData = prepareExamForDocx(examContent || {}, {
    subject,
    level,
    trimester,
    durationMinutes: durationMinutes || 60,
    title
  });

  if (!docxData) throw new ApiError(400, 'بيانات الاختبار غير صالحة');

  // If classId provided, find class info
  let classInfo = null;
  if (classId) {
    classInfo = await prisma.class.findUnique({ where: { id: Number(classId) } });
  }

  const buffer = await buildOfficialDocx(docxData, {
    school: req.user.school || '',
    teacherName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
    studentName: '................................',
    studentClass: classInfo?.name || '...........',
    date: new Date().toLocaleDateString('ar-TN')
  });

  const filename = `exam-${subject}-${Date.now()}.docx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
}));

/**
 * @swagger
 * /api/teacher/exams/{id}/preview-docx:
 *   get:
 *     summary: معاينة اختبار رسمي كملف Word
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ملف Word للمعاينة
 */
router.get('/exams/:id/preview-docx', teacherMiddleware, validateParams(teacherContentIdParamSchema), asyncHandler(async (req, res) => {
  const { buildOfficialDocx, prepareExamForDocx } = await getDocxService();
  const exam = await prisma.officialExam.findFirst({
    where: { id: Number(req.params.id), teacherId: req.user.id }
  });
  if (!exam) throw new ApiError(404, 'الاختبار غير موجود');

  const docxData = prepareExamForDocx(exam.content, {
    subject: exam.subject,
    level: exam.class?.level,
    trimester: exam.trimester
  });

  if (!docxData) throw new ApiError(400, 'بيانات الاختبار غير صالحة');

  const buffer = await buildOfficialDocx(docxData, {
    school: req.user.school || '',
    teacherName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
    studentName: '................................',
    studentClass: exam.class?.name || '...........',
    date: new Date().toLocaleDateString('ar-TN')
  });

  const filename = `preview-${exam.id}.docx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(Buffer.from(buffer));
}));

export default router;
