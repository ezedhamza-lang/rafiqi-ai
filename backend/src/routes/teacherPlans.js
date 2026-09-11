import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, teacherMiddleware, studentMiddleware } from '../auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { actorSchoolId } from '../tenant.js';
import { PERIOD_TIMES, canonicalSubject, subjectLabel } from '../services/gradeService.js';
import {
  annualPlanCreateSchema,
  annualPlanContentSchema,
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

/**
 * @swagger
 * /api/teacher/schedules:
 *   get:
 *     summary: جداول الأسابيع الرسمية (جدول ضرب الفترات) لكل أقسام الأستاذ/المدير
 *     tags: [teacher-plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: { slots, classes:[{class, grid, subjects}] } }
 */
router.get('/schedules', teacherMiddleware, asyncHandler(async (req, res) => {
  const sid = actorSchoolId(req);
  const classWhere = req.user.role === 'TEACHER'
    ? { teacherId: req.user.id }
    : (sid != null ? { schoolId: sid } : {});
  const classes = await prisma.class.findMany({ where: classWhere, orderBy: [{ level: 'asc' }, { name: 'asc' }] });
  const ids = classes.map((c) => c.id);
  const [rows, subjRows] = await Promise.all([
    prisma.schedule.findMany({
      where: { classId: { in: ids } },
      include: { teacher: { select: { id: true, firstName: true, lastName: true } } }
    }),
    prisma.classSubject.findMany({
      where: { classId: { in: ids } },
      include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { subject: 'asc' }
    })
  ]);
  const byClass = {};
  for (const c of classes) byClass[c.id] = { class: { id: c.id, name: c.name, level: c.level }, grid: [], subjects: [] };
  for (const r of rows) if (byClass[r.classId]) byClass[r.classId].grid.push({ day: r.day, period: r.period, subject: r.subject });
  for (const s of subjRows) if (byClass[s.classId]) byClass[s.classId].subjects.push({ subject: s.subject, coefficient: s.coefficient, teacher: s.teacher });
  res.json({ slots: PERIOD_TIMES, classes: Object.values(byClass) });
}));

/**
 * @swagger
 * /api/teacher/schedules/{classId}:
 *   put:
 *     summary: حفظ جدول الأسبوع (يُرسَم في جدول Schedule الصحيح مع حراسة التعارض)
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
 *               grid: { type: array, description: '[{day 1-6, period 1-6, subject}]' }
 *     responses:
 *       200: { description: تم الحفظ }
 *       400: { description: مادة غير مبرمجة أو شبكة غير صالحة }
 *       409: { description: تعارض توقيت الأستاذ }
 */
router.put('/schedules/:classId', teacherMiddleware, validateParams(classIdParamSchema), asyncHandler(async (req, res) => {
  const classId = Number(req.params.classId);
  const sid = actorSchoolId(req);
  const cls = await prisma.class.findFirst({
    where: { id: classId, ...(req.user.role === 'TEACHER' ? { teacherId: req.user.id } : (sid != null ? { schoolId: sid } : {})) }
  });
  if (!cls) throw new ApiError(404, 'القسم غير موجود');

  const { grid } = req.body || {};
  if (!Array.isArray(grid)) throw new ApiError(400, 'الشبكة غير صالحة');
  if (grid.length > 36) throw new ApiError(400, 'الأسبوع 6 أيام × 6 فترات كحد أقصى');

  const programmed = await prisma.classSubject.findMany({ where: { classId } });
  const byCode = {};
  for (const s of programmed) byCode[canonicalSubject(s.subject)] = s;

  const cells = [];
  const seen = new Set();
  for (const cell of grid) {
    const day = Number(cell?.day);
    const period = Number(cell?.period);
    if (!Number.isInteger(day) || day < 1 || day > 6 || !Number.isInteger(period) || period < 1 || period > 6) {
      throw new ApiError(400, 'قيم الأيام والفترات يجب أن تكون بين 1 و6');
    }
    const code = canonicalSubject(cell?.subject || '');
    if (!code) continue;
    const key = `${day}-${period}`;
    if (seen.has(key)) throw new ApiError(400, 'لا يمكن تكرار نفس الخلية');
    seen.add(key);
    const cs = byCode[code];
    if (!cs) throw new ApiError(400, 'المادة غير مبرمجة لهذا القسم — برمجها أولاً من مواد الأقسام');
    cells.push({ day, period, subject: cs.subject, teacherId: cs.teacherId });
  }

  for (const c of cells) {
    if (!c.teacherId) continue;
    const clash = await prisma.schedule.findFirst({
      where: { teacherId: c.teacherId, day: c.day, period: c.period, classId: { not: classId } },
      include: { class: { select: { name: true } } }
    });
    if (clash) {
      throw new ApiError(409, `تعارض توقيت: الأستاذ يدرّس أصلاً قسم «${clash.class.name}» في اليوم ${c.day} الفقرة ${c.period}`);
    }
  }

  const ops = [prisma.schedule.deleteMany({ where: { classId } })];
  if (cells.length) ops.push(prisma.schedule.createMany({ data: cells.map((c) => ({ ...c, classId })) }));
  await prisma.$transaction(ops);

  res.json({ ok: true, count: cells.length });
}));

/**
 * @swagger
 * /api/teacher/schedules/student/my:
 *   get:
 *     summary: جدول الأسبوع الخاص بالتلميذ
 *     tags: [teacher-plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: { class, slots, subjects, grid } }
 */
router.get('/schedules/student/my', studentMiddleware, asyncHandler(async (req, res) => {
  const student = await prisma.student.findFirst({ where: { accountUserId: req.user.id } });
  if (!student?.classId) return res.json({ class: null, grid: [], subjects: [], slots: PERIOD_TIMES });
  const cls = await prisma.class.findUnique({ where: { id: student.classId } });
  const [rows, subjRows] = await Promise.all([
    prisma.schedule.findMany({
      where: { classId: student.classId },
      include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ day: 'asc' }, { period: 'asc' }]
    }),
    prisma.classSubject.findMany({ where: { classId: student.classId }, orderBy: { subject: 'asc' } })
  ]);
  res.json({
    class: cls,
    slots: PERIOD_TIMES,
    subjects: subjRows.map((s) => ({ subject: s.subject, coefficient: s.coefficient })),
    grid: rows.map((r) => ({ day: r.day, period: r.period, subject: r.subject, subjectLabel: subjectLabel(r.subject), teacher: r.teacher }))
  });
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
