import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../db.js';
import { authMiddleware, teacherMiddleware } from '../auth.js';
import { assertClassInSchool } from '../tenant.js';
import { buildMemo, rebuildMemo } from '../services/memoService.js';
import { buildResource, rebuildResource } from '../services/resourceService.js';
import { getBankExam, buildExamContent, officialExamSummary, saveAiExamToBank } from '../services/officialExamService.js';
import { buildExam, SUBJECT_KEYS, subjectFold } from '../services/examBuilder.js';
import { generateText } from '../services/aiService.js';
// محرك الاختبارات التقويمي (src/exams) — مخطّط ← توليد ← تدقيق ← حفظ (§1,§10)
import { buildBlueprint, validateBlueprint, blueprintScopeOptions } from '../exams/exam-blueprint.js';
import { validateExam, assertPublishable } from '../exams/exam-pipeline.js';
import { buildExamPrompt, parseGeneratedExamPayload, normalizeGeneratedQuestions, normalizeGeneratedStimuli } from '../exams/generation.js';
import { criteriaFor } from '../exams/criteria-grids.js';
import { criteriaDisplay } from '../exams/criterion-map.js';
import { subjectLabel } from '../exams/subject-labels.js';
import { resolveGradeId, gradeTitle } from '../exams/curriculum-index.js';
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

// حارس «لا سؤال يتيم» (§7,§18): أسئلة تشير إلى «سند» بلا سند محفوظ = ورقة تُطبع
// بلا سند ويسقط فيها التلميذ (حالة exam-20) — يُمنع الحفظ برسالة تحدّى أين الإشكال
// بدل حفظ صامت معيب. يُستدعى في المسار اليدوي الذي لا يمرّ على مدقّق المحرّك.
function assertNoOrphanSindRefs(content) {
  const questions = Array.isArray(content?.questions) ? content.questions : [];
  if (!questions.length) return;
  const hasSind = !!((Array.isArray(content?.stimuli) && content.stimuli.length) ||
    (Array.isArray(content?.passages) && content.passages.length));
  if (hasSind) return;
  const refs = questions.filter((q) => q?.sindId ||
    /السند/.test(`${q?.prompt || ''} ${q?.text || ''} ${q?.label || ''}`));
  if (!refs.length) return;
  throw new ApiError(400, `لا يمكن حفظ الاختبار: ${refs.length} سؤال يشير إلى «سند» بينما لا يوجد سند محفوظ — أضِف نصّ السند (حقل السندات) أو احذف الإشارة من السؤال`);
}

const __tcDirname = path.dirname(fileURLToPath(import.meta.url));
const EXAM_IMG_DIR = path.join(__tcDirname, '../../uploads/exams');
if (!fs.existsSync(EXAM_IMG_DIR)) {
  fs.mkdirSync(EXAM_IMG_DIR, { recursive: true });
}
const examImgUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, EXAM_IMG_DIR),
    filename: (_req, file, cb) => {
      const ext = (file.originalname.match(/\.(jpg|jpeg|png)$/i) || [])[1] || 'png';
      cb(null, `exam-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext.toLowerCase()}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /image\/(jpeg|png|jpg)/.test(file.mimetype) || /\.(jpg|jpeg|png)$/i.test(file.originalname);
    cb(null, ok);
  }
});

/**
 * @swagger
 * /api/teacher/exams/upload-image:
 *   post:
 *     summary: رفع صورة لسؤال امتحان (تُضمَّن في ملف Word)
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: رابط الصورة
 */
router.post('/exams/upload-image', teacherMiddleware, examImgUpload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'اختر صورة بصيغة PNG أو JPG');
  res.json({ url: `/uploads/exams/${req.file.filename}` });
}));

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
  if (subject) where.subject = { equals: subject, mode: 'insensitive' };
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
  await assertClassInSchool(prisma, req, classId, ApiError);
  assertNoOrphanSindRefs(content);
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
  await assertClassInSchool(prisma, req, classId, ApiError);
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
 * /api/teacher/exams/from-books:
 *   get:
 *     summary: معاينة اختبار مبني من أسئلة كتب السنة الحقيقية (بلا إجابات، حتمي بالبذرة)
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: gradeId
 *         required: true
 *         schema: { type: string, example: year6 }
 *       - in: query
 *         name: seed
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: size
 *         schema: { type: integer, example: 8 }
 *     responses:
 *       200: { description: نسخة الاختبار }
 *       404: { description: لا توجد أسئلة مرقمنة لهذه السنة بعد }
 */
router.get('/exams/from-books', teacherMiddleware, asyncHandler(async (req, res) => {
  const gradeId = String(req.query.gradeId || '');
  if (!/^year[1-6]$/.test(gradeId)) throw new ApiError(400, 'gradeId غير صالح (year1..year6)');
  const rawSubject = String(req.query.subject || 'رياضيات');
  const subject = SUBJECT_KEYS.find((k) => subjectFold(k) === subjectFold(rawSubject));
  if (!subject) throw new ApiError(400, `المادة يجب أن تكون إحدى: ${SUBJECT_KEYS.join(' ، ')}`);
  const seed = Number(req.query.seed) || 1;
  const size = Math.min(20, Math.max(4, Number(req.query.size) || 8));
  const exam = buildExam(gradeId, seed, size, subject);
  if (!exam) throw new ApiError(404, `لا توجد أسئلة مرقمنة في كتب ${subject} — ${gradeId} بعد — أضف الكتاب مرقمنًا أولًا.`);
  res.json(exam);
}));

/**
 * @swagger
 * /api/teacher/exams/blueprint-options:
 *   get:
 *     summary: خيارات مخطّط الاختبار (دروس الثلاثي مجمّعة في وحدات + قيم هدف النقاط)
 *     tags: [teacher-content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema: { type: string, example: year6 }
 *       - in: query
 *         name: subject
 *         required: true
 *         schema: { type: string, example: arabic }
 *       - in: query
 *         name: trimester
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200: { description: الوحدات والدروس + القيم المسموحة }
 *       400: { description: مدخلات غير صالحة }
 */
router.get('/exams/blueprint-options', teacherMiddleware, asyncHandler(async (req, res) => {
  const { level, subject, trimester } = req.query;
  if (!subject) throw new ApiError(400, 'المادة مطلوبة');
  const t = [1, 2, 3].includes(Number(trimester)) ? Number(trimester) : null;
  if (trimester !== undefined && String(trimester).trim() !== '' && t === null) {
    throw new ApiError(400, 'الثلاثي يجب أن يكون 1 أو 2 أو 3');
  }
  const grade = resolveGradeId(level);
  const opts = blueprintScopeOptions({ level, subject, trimester: t });
  res.json({
    ...opts,
    grade,
    gradeLabel: gradeTitle(grade),
    subjectLabel: subjectLabel(subject),
    trimester: t,
    targetPoints: [10, 15, 20],
    assessmentTypes: [
      { value: 'written', label: 'تحريري' },
      { value: 'oral', label: 'شفوي' },
      { value: 'practical', label: 'عملي' },
      { value: 'diagnostic', label: 'تشخيصي' },
      { value: 'formative', label: 'تكويني' },
      { value: 'unit', label: 'اختبار وحدة' },
      { value: 'term', label: 'اختبار ثلاثي' },
      { value: 'cumulative', label: 'تراكمي' },
      { value: 'remedial', label: 'علاجي' }
    ]
  });
}));

/**
 * @swagger
 * /api/teacher/exams/generate-ai:
 *   post:
 *     summary: توليد اختبار تقويمي وفق مخطّط (مخطّط ← توليد ← تدقيق §50-§53) وحفظه للمراجعة
 *     description: >
 *       لا يُنشر مباشرة أبدًا (§61): يُحفظ بحالة needs_review عند نظافة التدقيق،
 *       أو draft مع قائمة الملاحظات عند وجود أخطاء — والرد صادق لا «نجاح» زائف.
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
 *               subject: { type: string, example: arabic }
 *               level: { type: string, example: year6 }
 *               trimester: { type: integer, example: 1 }
 *               title: { type: string }
 *               lessonTitle: { type: string }
 *               count: { type: integer, minimum: 1, maximum: 20 }
 *               classId: { type: integer }
 *               durationMinutes: { type: integer }
 *               targetPoints: { type: integer, enum: [10, 15, 20] }
 *               assessmentType: { type: string, example: term }
 *               domains: { type: array, items: { type: string } }
 *               competencies: { type: array, items: { type: string } }
 *               difficulty: { type: string, example: balanced }
 *     responses:
 *       201:
 *         description: الاختبار المحفوظ + تقرير الفحص (issues/audit/report/message)
 *       400:
 *         description: مخطّط غير صالح أو غياب مفتاح المنصة
 *       502:
 *         description: تعذّر الاتصال بالمزوّد أو توليد صيغة الأسئلة (أعد المحاولة)
 */
router.post('/exams/generate-ai', teacherMiddleware, asyncHandler(async (req, res) => {
  const {
    subject, level, trimester, title, lessonTitle, count, classId, durationMinutes,
    targetPoints, assessmentType, domains, competencies, difficulty
  } = req.body || {};
  if (!subject) throw new ApiError(400, 'المادة مطلوبة');
  await assertClassInSchool(prisma, req, classId, ApiError);

  // 1) المخطّط أولًا (§1,§10): لا سؤال يُخلَق قبل قبوله — أخطاء المخطّط تُرفض هنا
  const blueprint = buildBlueprint({
    level, subject, trimester, assessmentType, lessonTitle, domains, competencies, difficulty,
    questionCount: count, targetPoints, durationMinutes
  });
  const bpCheck = validateBlueprint(blueprint);
  if (!bpCheck.valid) {
    throw new ApiError(400, bpCheck.issues.filter((i) => i.severity === 'error').map((i) => i.message).join(' — '));
  }

  // عنوان صافٍ: لا «بالذكاء الاصطناعي» في عنوان يراه التلميذ (§5) — تسمية داخلية فقط
  const givenTitle = String(title || '').replace(/[,،]?\s*بالذكاء الاصطناعي/g, '').trim();
  const examTitle = givenTitle ||
    `اختبار ${blueprint.subjectLabel} — ${blueprint.gradeLabel} (الثلاثي ${blueprint.trimester})`;

  // 2) التوليد المخطّطي + التدقيق + إعادة محاولة بتغذية راجعة (§49,§126)
  let validation = null;
  let previousIssues = null;
  let stimuli = []; // سندات آخر محاولة ناجحة القراءة (تبقى من المحاولة السابقة عند فشل لاحق)
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let text = null;
    try {
      const prompt = buildExamPrompt(blueprint, { previousIssues });
      text = await generateText(req.user.id, prompt.system, prompt.user, {
        maxTokens: prompt.maxTokens || 4000,
        jsonMode: true
      });
    } catch (e) {
      if (e?.message === 'NO_AI_KEY') {
        throw new ApiError(400, 'لم يتم ضبط مفتاح الذكاء الاصطناعي للمنصة — اضبطه من لوحة المشرف العام');
      }
      // نداء فاشل بعد نجاح محاولة سابقة → نحتفظ بالنتيجة بدل ضياعها
      if (validation) break;
      console.warn('[AI-EXAM] provider failure:', e?.message, 'status=' + (e?.providerStatus || ''), String(e?.providerBody || '').slice(0, 300));
      throw new ApiError(502, 'تعذّر الاتصال بمزوّد الذكاء الاصطناعي — أعد المحاولة بعد لحظات');
    }

    const parsed = parseGeneratedExamPayload(text);
    const questions = parsed ? normalizeGeneratedQuestions(parsed.questions, blueprint) : null;
    const stimNorm = parsed ? normalizeGeneratedStimuli(parsed.stimuli, blueprint) : { stimuli: [], invalid: [] };
    stimuli = stimNorm.stimuli;
    if (!questions) {
      console.warn('[AI-EXAM] invalid exam JSON, attempt', attempt, String(text || '').slice(0, 150));
      previousIssues = 'إخراجك السابق لم يكن JSON صالحًا — أعد الإخراج كائنًا فيه stimuli وquestions فقط دون شرح';
      if (attempt === 3) break;
      continue;
    }

    validation = validateExam({
      blueprint,
      questions,
      stimuli,
      // اختبار سنّدي: بلا سند حقيقي = رفض (§18,§105) — لا نستبدل السند بقائمة أسئلة
      stimulusRequired: true,
      durationMinutes: blueprint.durationMinutes,
      title: examTitle
    }, { requireCount: true, requireStructure: true }); // سلامة العدّاد (§51) + بنية الورقة: طول/تشكيل النص + تنوع الصيغ + فرص قياس القراءة (MASTER §4,§6,§36)
    stimuli = validation.stimuli || stimuli; // المثيرات بعد الإصلاح الحتمي هي المحفوظة
    if (validation.approved) break;
    const errs = validation.issues.filter((i) => i.severity === 'error');
    // التغذية الراجعة تُبنى من الأخطاء + أسباب رفض السندات عند التطبيع + مخالفات
    // العقد الهيكلية (مرجع سند معلّق، نوع مثير خارج الملف) — لا سبب يُكتشف ثم يُهمل.
    const contractFeedback = (validation.repairNotes || [])
      .filter((n) => n.code === 'SIND_REF_REBOUND' || n.code === 'STIMULUS_TYPE_FIXED')
      .map((n) => n.message);
    const sindFeedback = [];
    if (parsed && stimNorm.stimuli.length === 0) {
      sindFeedback.push('لم تُرجع أي سند صالح في "stimuli" — اختبار سنّدي بلا سند يُرفض: أعِد الإخراج كائنًا فيه stimuli (نصّ ≥ 8 أحرف لكل سند) وquestions مع sindId');
    }
    if (stimNorm.invalid.length) {
      sindFeedback.push(`سندات مرفوضة عند التطبيع: ${stimNorm.invalid.join('؛ ')}`);
    }
    previousIssues = [...new Set([...sindFeedback, ...errs.slice(0, 8).map((i) => i.message), ...contractFeedback])]
      .join('؛ ')
      .slice(0, 1200) || null;
    if (!previousIssues) break; // تنبيهات فقط (لا error) → لا إعادة محاولة
    console.warn('[AI-EXAM] validation feedback, attempt', attempt, previousIssues.slice(0, 200));
  }
  if (!validation) {
    throw new ApiError(502, 'تعذّر توليد صيغة الأسئلة — أعد المحاولة بعد لحظات');
  }

  // 3) الحفظ الصادق (§61,§126): نظيف ← needs_review، أخطاء ← generated + قائمة الملاحظات
  const errIssues = validation.issues.filter((i) => i.severity === 'error');
  const status = validation.approved ? 'needs_review' : 'generated';
  // §B2 (قرار2026-10-03): عرض المعايير للمعلّم «الاثنان مع وسم المصدر» —
  // الرمز الرسمي (M1–M4/D) + المصدر يُضافان إلى شبكة التنقيط في مسار الذكاء
  // الاصطناعي فقط؛ الرمز الداخلي (مع1..5) يبقى للتنقيط ولا يُعرض رسميًّا بدله.
  const criteria = criteriaFor(subject, blueprint.targetPoints).map((c) => ({
    ...c,
    ...(criteriaDisplay(c.id, subject) || {})
  }));
  const questions = validation.questions.map((q, i) => ({
    ...q,
    // إسناد حتمي من خط التوليد (§B2: أي سؤال يقيس أي معيار) يسبق التوزيع الدائري
    criterion: q.criterion || criteria[i % criteria.length].id
  }));

  const y = new Date().getFullYear();
  const content = {
    header: '', // لا ترويسة رسمية لاختبار غير رسمي (§4) — وزارة التربية لـ source:official فقط
    school: req.user.school || '',
    date: `${y}/${y + 1}`,
    durationMinutes: blueprint.durationMinutes,
    totalPoints: blueprint.targetPoints,
    source: 'ai-generated',
    status,
    grade: blueprint.grade,
    gradeLabel: blueprint.gradeLabel,
    subjectLabel: blueprint.subjectLabel,
    assessmentType: blueprint.assessmentType,
    curriculumVersion: blueprint.curriculumVersion,
    blueprint,
    audit: validation.audit,
    report: validation.report,
    // التقرير التحليلي §D8/§C4: معيار ← مؤشر ← صيغ ← نقاط ← عتبات ← أخطاء متوقعة ← تشخيص
    analyticalReport: Array.isArray(validation.analyticalReport) && validation.analyticalReport.length
      ? validation.analyticalReport
      : null,
    issues: validation.issues,
    criteria,
    // السند هو الأصل (§1-3,§105): نخزّن السندات كاملة + نسخة passages للتوافق
    stimulusRequired: true,
    stimuli,
    passages: stimuli.map((s) => ({ id: s.id, title: s.title, text: s.text })),
    questions
  };

  const exam = await prisma.officialExam.create({
    data: {
      teacherId: req.user.id,
      title: examTitle,
      subject,
      classId: classId ? Number(classId) : null,
      trimester: blueprint.trimester,
      content
    }
  });

  // حفظ في بنك الاختبارات فقط عند نظافة التديق — الاختبار المعيب لا يُدخَل البنك
  let savedToBank = false;
  if (validation.approved) {
    try {
      savedToBank = saveAiExamToBank({
        id: `ai-${exam.id}-${Date.now()}`,
        level: blueprint.grade || '',
        subject,
        trimester: blueprint.trimester,
        title: exam.title,
        durationMinutes: content.durationMinutes,
        totalPoints: blueprint.targetPoints,
        source: 'ai-generated',
        criteria,
        passages: content.passages,
        stimuli: content.stimuli,
        questions: questions.map((q) => ({ ...q }))
      });
    } catch {
      savedToBank = false;
    }
  }

  // ردّ صادق (§126): لا «تم الإنشاء بنجاح» حين توجد أخطاء — بل عدّها وقائمة الملاحظات
  const message = validation.approved
    ? `تم إنشاء الاختبار (${questions.length} سؤالًا، ${blueprint.targetPoints} نقطة) — ينتظر مراجعتك واعتمادك`
    : `يوجد ${errIssues.length} عناصر تحتاج إلى مراجعة`;

  res.status(201).json({
    ...exam,
    summary: officialExamSummary(content),
    savedToBank,
    status,
    valid: validation.approved,
    issues: validation.issues,
    audit: validation.audit,
    // المعلّم يقرأ الموجز أولًا (بلا رموز §)؛ الفني الكامل (مع التحليلي) خلف «تفاصيل»
    report: validation.reportShort || validation.report,
    reportFull: validation.report,
    warnings: [...(blueprint.warnings || [])],
    message
  });
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
  if (classId !== undefined) await assertClassInSchool(prisma, req, classId, ApiError);

  // إعادة فحص محتوى المحرّك عند تعديله (§61,§126): لا نثق بما يأتي من العميل —
  // نعيد تشغيل المدقّق نفسه ونعكس نتيجته الصادقة على الحالة. سليم ← needs_review
  // (يصلح للنشر بعد مراجعة)، معيب ← generated. بلا هذه الخطوة يبقى اختبار «generated»
  // محجوبًا عن النشر إلى الأبد رغم إصلاح المدرس له (مخرج مسدود).
  let contentUpdate = content;
  if (contentUpdate?.blueprint && Array.isArray(contentUpdate.questions)) {
    const v = validateExam({
      blueprint: contentUpdate.blueprint,
      questions: contentUpdate.questions,
      // إعادة الفحص تشمل التأصيل أيضًا (§7): لا يمرّ تعديل يكسر ارتباط السؤال بسندته
      stimuli: Array.isArray(contentUpdate.stimuli) ? contentUpdate.stimuli : [],
      stimulusRequired: contentUpdate.stimulusRequired === true,
      durationMinutes: contentUpdate.durationMinutes ?? contentUpdate.blueprint.durationMinutes,
      title
    });
    contentUpdate = {
      ...contentUpdate,
      status: v.approved ? 'needs_review' : 'generated',
      issues: v.issues,
      audit: v.audit,
      report: v.report,
      coverage: v.coverage,
      questions: v.questions
    };
  }
  // محتوى بلا مخطّط (مسار يدوي) لا يمرّ على المدقّق أعلاه → حارس «لا سؤال يتيم» هنا
  if (contentUpdate && !contentUpdate.blueprint) assertNoOrphanSindRefs(contentUpdate);
  if (published !== undefined) {
    const existing = await prisma.officialExam.findFirst({ where: { id: Number(req.params.id), teacherId: req.user.id } });
    if (!existing) throw new ApiError(404, 'الاختبار غير موجود');
    const eff = contentUpdate || existing.content;

    // عقد النشر (§125,§61): اختبارات المحرّك (ذات blueprint) لا تُنشر وهي مسودة
    // أو فيها أخطاء فحص — النشر فعل بشري بعد المراجعة، والمدقّق لا يثق بالمحتوى.
    // الاختبارات المستوردة من البنك (بلا blueprint / بلا status) لا تتأثر.
    if (published === true && eff?.blueprint) {
      const gate = assertPublishable({
        blueprint: eff.blueprint,
        questions: eff.questions || [],
        stimuli: eff.stimuli || eff.passages || [],
        stimulusRequired: eff.stimulusRequired === true
      });
      const hasErrors = (eff.issues || []).some((i) => i?.severity === 'error');
      const st = String(eff.status || '');
      if (!gate.ok || hasErrors || ['draft', 'generated', 'rejected'].includes(st)) {
        const detail = [
          ...(!gate.ok ? [`حقول ناقصة: ${gate.missing.join('، ')}`] : []),
          ...(hasErrors ? ['يوجد أخطاء فحص لم تُراجَع'] : []),
          ...(['draft', 'generated', 'rejected'].includes(st) ? [`الحالة «${st}» لا تسمح بالنشر`] : [])
        ].join('؛ ');
        throw new ApiError(409, `لا يمكن النشر — ${detail}`);
      }
    }

    if (eff?.status) {
      contentUpdate = { ...eff };
      if (published && eff.status !== 'published') contentUpdate.status = 'published';
      if (!published && eff.status === 'published') contentUpdate.status = 'approved';
    }
  }

  const r = await prisma.officialExam.updateMany({
    where: { id: Number(req.params.id), teacherId: req.user.id },
    data: {
      ...(title ? { title: String(title).trim() } : {}),
      ...(classId !== undefined ? { classId: classId ? Number(classId) : null } : {}),
      ...(trimester !== undefined ? { trimester: trimester ? Number(trimester) : null } : {}),
      ...(contentUpdate ? { content: contentUpdate } : {}),
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
  await assertClassInSchool(prisma, req, classId, ApiError);

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


router.get('/memos/:id/pdf', teacherMiddleware, validateParams(teacherContentIdParamSchema), asyncHandler(async (req, res) => {
  const memo = await prisma.memo.findFirst({ where: { id: Number(req.params.id), teacherId: req.user.id } });
  if (!memo) throw new ApiError(404, 'المذكرة غير موجودة');
  const { buildMemoDocx } = await import('../services/memoDocxService.js');
  const buffer = await buildMemoDocx(memo);
  const safeTitle = (memo.lessonTitle || 'memo').replace(/[\\/:*?"<>|]/g, '').slice(0, 60);
  const raw = buffer;
  const buf = Buffer.from(raw.buffer || raw);
  const filename = encodeURIComponent(safeTitle) + '.docx';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
  res.setHeader('Content-Length', buf.length);
  res.end(buf);
}));

export default router;


