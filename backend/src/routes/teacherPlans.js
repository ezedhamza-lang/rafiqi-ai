import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, teacherMiddleware, studentMiddleware } from '../auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import {
  annualPlanCreateSchema,
  annualPlanContentSchema,
  scheduleGridSchema,
  classIdParamSchema,
  annualPlanIdParamSchema
} from '../validators/teacherPlans.js';

const router = Router();
router.use(authMiddleware);

/**
 * @swagger
 * /api/teacher/plans:
 *   get:
 *     summary: مخططات الأستاذ السنوية
 *     tags: [teacher-plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة المخططات
 */
router.get('/plans', teacherMiddleware, asyncHandler(async (req, res) => {
  const plans = await prisma.annualPlan.findMany({
    where: { teacherId: req.user.id },
    orderBy: { updatedAt: 'desc' }
  });
  res.json(plans);
}));

/**
 * @swagger
 * /api/teacher/plans:
 *   post:
 *     summary: إنشاء مخطط سنوي
 *     tags: [teacher-plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, title]
 *             properties:
 *               subject: { type: string }
 *               level: { type: string }
 *               title: { type: string }
 *               content: { type: object }
 *     responses:
 *       201:
 *         description: المخطط
 *       400:
 *         description: فشل التحقق من البيانات
 */
router.post('/plans', teacherMiddleware, validateBody(annualPlanCreateSchema), asyncHandler(async (req, res) => {
  const { subject, level, title, content } = req.body;
  const plan = await prisma.annualPlan.create({
    data: {
      teacherId: req.user.id,
      subject,
      level: level || 'السنة الأولى أساسي',
      title: String(title).trim(),
      content: content || {}
    }
  });
  res.status(201).json(plan);
}));

/**
 * @swagger
 * /api/teacher/plans/{id}:
 *   put:
 *     summary: تحديث محتوى مخطط
 *     tags: [teacher-plans]
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
 *         description: تم التحديث
 *       400:
 *         description: المحتوى مطلوب
 *       404:
 *         description: المخطط غير موجود
 */
router.put('/plans/:id', teacherMiddleware, validateParams(annualPlanIdParamSchema), validateBody(annualPlanContentSchema), asyncHandler(async (req, res) => {
  const { content } = req.body;
  const r = await prisma.annualPlan.updateMany({
    where: { id: Number(req.params.id), teacherId: req.user.id },
    data: { content }
  });
  if (r.count === 0) throw new ApiError(404, 'المخطط غير موجود');
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/teacher/plans/{id}:
 *   delete:
 *     summary: حذف مخطط
 *     tags: [teacher-plans]
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
router.delete('/plans/:id', teacherMiddleware, validateParams(annualPlanIdParamSchema), asyncHandler(async (req, res) => {
  await prisma.annualPlan.deleteMany({ where: { id: Number(req.params.id), teacherId: req.user.id } });
  res.json({ ok: true });
}));

const DAYS = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/**
 * @swagger
 * /api/teacher/schedules:
 *   get:
 *     summary: جداول أقسام الأستاذ
 *     tags: [teacher-plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: الجداول
 */
router.get('/schedules', teacherMiddleware, asyncHandler(async (req, res) => {
  const classes = await prisma.class.findMany({
    where: { teacherId: req.user.id },
    select: { id: true }
  });
  const classIds = classes.map((c) => c.id);
  const schedules = await prisma.schedule.findMany({
    where: { classId: { in: classIds } },
    include: { class: { select: { id: true, name: true } } },
    orderBy: [{ day: 'asc' }, { period: 'asc' }]
  });
  res.json(schedules);
}));

/**
 * @swagger
 * /api/teacher/schedules/{classId}:
 *   put:
 *     summary: حفظ جدول قسم
 *     tags: [teacher-plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [grid]
 *             properties:
 *               grid: { type: array, description: مصفوفة 6 أيام × 6 حصص }
 *     responses:
 *       200:
 *         description: تم الحفظ
 *       400:
 *         description: الجدول يجب أن يحتوي 6 أيام
 *       404:
 *         description: القسم غير موجود
 */
router.put('/schedules/:classId', teacherMiddleware, validateParams(classIdParamSchema), asyncHandler(async (req, res) => {
  const classId = Number(req.params.classId);
  const cls = await prisma.class.findFirst({ where: { id: classId, teacherId: req.user.id } });
  if (!cls) throw new ApiError(404, 'القسم غير موجود');

  const { grade, subjects } = req.body;

  await prisma.subjectDistribution.upsert({
    where: { classId },
    update: { grade, subjects },
    create: { classId, grade, subjects }
  });

  res.json({ ok: true, count: subjects?.length || 0 });
}));

/**
 * @swagger
 * /api/teacher/schedules/student/my:
 *   get:
 *     summary: جدول التلميذ
 *     tags: [teacher-plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: الجدول
 */
router.get('/schedules/student/my', studentMiddleware, asyncHandler(async (req, res) => {
  const student = await prisma.student.findFirst({ where: { accountUserId: req.user.id } });
  if (!student?.classId) return res.json({ class: null, distribution: null });
  const cls = await prisma.class.findUnique({ where: { id: student.classId } });
  const distribution = await prisma.subjectDistribution.findUnique({ where: { classId: student.classId } });
  res.json({ class: cls, distribution });
}));

/**
 * @swagger
 * /api/teacher/suggestions:
 *   get:
 *     summary: اقتراحات الأستاذ البيداغوجية
 *     tags: [teacher-plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الاقتراحات
 */
router.get('/suggestions', teacherMiddleware, asyncHandler(async (req, res) => {
  const suggestions = await prisma.suggestion.findMany({
    where: { teacherId: req.user.id },
    orderBy: { createdAt: 'desc' }
  });
  res.json(suggestions);
}));

const PEDAGOGICAL_SUGGESTIONS = [
  { category: 'التفريق البيداغوجي', title: 'أنشطة بمواصفات متفاوتة', content: 'قدم نفس الهدف بثلاث مستويات صعوبة لتراعي الفروق الفردية بين التلاميذ.' },
  { category: 'التقويم', title: 'التقويم التكويني المستمر', content: 'استعمل بطاقات خروج سريعة في نهاية كل حصة لتقيس مدى بلوغ الأهداف.' },
  { category: 'التحفيز', title: 'نظام المكافآت', content: 'كافئ التقدم لا الكمال: نقط خبرة وشارات لكل إنجاز صغير لتثبيت الدافعية.' },
  { category: 'الأنشطة', title: 'التعلم باللعب', content: 'حوّل التمارين إلى ألعاب تعليمية قصيرة لزيادة التفاعل والمشاركة.' },
  { category: 'التواصل', title: 'إشراك الولي', content: 'أرسل تقريرًا أسبوعيًا بسيطًا لأولياء كل قسم لتتبع تقدم أبنائهم.' },
  { category: 'المراجعة', title: 'المراجعة المتباعدة', content: 'أعد تنشيط المفاهيم السابقة في بداية كل حصة لتثبيتها في الذاكرة طويلة المدى.' }
];

/**
 * @swagger
 * /api/teacher/suggestions/generate:
 *   post:
 *     summary: توليد اقتراحات بيداغوجية
 *     tags: [teacher-plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: الاقتراحات المولدة
 */
router.post('/suggestions/generate', teacherMiddleware, asyncHandler(async (req, res) => {
  const created = [];
  for (const s of PEDAGOGICAL_SUGGESTIONS) {
    const suggestion = await prisma.suggestion.create({
      data: { teacherId: req.user.id, category: s.category, title: s.title, content: s.content }
    });
    created.push(suggestion);
  }
  res.status(201).json(created);
}));

export default router;
