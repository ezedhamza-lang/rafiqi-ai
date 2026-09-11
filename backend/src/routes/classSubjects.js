import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, teacherMiddleware, studentMiddleware } from '../auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { classSubjectCreateSchema, classSubjectUpdateSchema, classSubjectIdParamSchema } from '../validators/classSubject.js';
import { actorSchoolId } from '../tenant.js';
import { DEFAULT_COEFFICIENTS, SUBJECT_LABELS as OFFICIAL_LABELS } from '../services/gradeService.js';

const router = Router();
router.use(authMiddleware);

export const SUBJECTS = [
  { code: 'MATH', label: 'الرياضيات' },
  { code: 'READING', label: 'القراءة' },
  { code: 'SCIENCE', label: 'الإيقاظ العلمي' },
  { code: 'STORIES', label: 'القصص' }
];

const SUBJECT_LABELS = Object.fromEntries(SUBJECTS.map((s) => [s.code, s.label]));

function canManage(req, klass) {
  const sid = actorSchoolId(req);
  if (['ADMIN', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role)) {
    if (sid == null) return true; // المشرف العام يدير كل المدارس
    return klass?.schoolId === sid;
  }
  // الأستاذ: أقسامه التي يدرّسها ضمن مدرسته فقط.
  return klass?.teacherId === req.user.id && (sid == null || klass?.schoolId === sid);
}

function withClassWhere(req) {
  const sid = actorSchoolId(req);
  if (['ADMIN', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role)) {
    return sid != null ? { schoolId: sid } : {};
  }
  return sid != null ? { teacherId: req.user.id, schoolId: sid } : { teacherId: req.user.id };
}

/**
 * @swagger
 * /api/teacher/class-subjects:
 *   get:
 *     summary: مواد أقسام الأستاذ
 *     tags: [class-subjects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: المواد والكتالوج
 */
router.get('/class-subjects', teacherMiddleware, asyncHandler(async (req, res) => {
  const subjects = await prisma.classSubject.findMany({
    where: { class: withClassWhere(req) },
    include: {
      class: { select: { id: true, name: true, level: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } }
    },
    orderBy: [{ classId: 'asc' }, { subject: 'asc' }]
  });
  res.json({
    subjects: subjects.map((s) => ({ ...s, subjectLabel: SUBJECT_LABELS[s.subject] || s.subject })),
    subjectCatalog: SUBJECTS
  });
}));

/**
 * @swagger
 * /api/teacher/class-subjects:
 *   post:
 *     summary: إضافة مادة لقسم
 *     tags: [class-subjects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [classId, subject]
 *             properties:
 *               classId: { type: integer }
 *               subject: { type: string, enum: [MATH, READING, SCIENCE, STORIES] }
 *               teacherId: { type: integer }
 *     responses:
 *       201:
 *         description: المادة
 *       400:
 *         description: فشل التحقق من البيانات أو المادة مضمنة مسبقا
 *       403:
 *         description: لا يمكنك إدارة مواد هذا القسم
 *       404:
 *         description: القسم غير موجود
 */
router.post('/class-subjects', teacherMiddleware, validateBody(classSubjectCreateSchema), asyncHandler(async (req, res) => {
  const { classId, subject, teacherId } = req.body;

  const klass = await prisma.class.findUnique({ where: { id: Number(classId) } });
  if (!klass) throw new ApiError(404, 'القسم غير موجود');
  if (!canManage(req, klass)) throw new ApiError(403, 'لا يمكنك إدارة مواد هذا القسم');

  const existing = await prisma.classSubject.findFirst({ where: { classId: klass.id, subject } });
  if (existing) throw new ApiError(400, 'هذه المادة مضمنة مسبقا لهذا القسم');

  const sid = actorSchoolId(req);
  const teacher = teacherId ? await prisma.user.findFirst({ where: { id: Number(teacherId), role: 'TEACHER', ...(sid != null ? { schoolId: sid } : {}) } }) : null;
  const created = await prisma.classSubject.create({
    data: {
      classId: klass.id,
      subject,
      level: klass.level,
      teacherId: teacher?.id || klass.teacherId || null,
      coefficient: Number(req.body.coefficient) || DEFAULT_COEFFICIENTS[subject] || 1
    },
    include: {
      class: { select: { id: true, name: true, level: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } }
    }
  });
  res.status(201).json({ ...created, subjectLabel: SUBJECT_LABELS[created.subject] || created.subject });
}));

/**
 * @swagger
 * /api/teacher/class-subjects/{id}:
 *   put:
 *     summary: تغيير أستاذ مادة
 *     tags: [class-subjects]
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
 *               teacherId: { type: integer }
 *     responses:
 *       200:
 *         description: تم التعديل
 *       403:
 *         description: لا يمكنك تعديل مادة هذا القسم
 *       404:
 *         description: المادة غير موجودة
 */
router.put('/class-subjects/:id', teacherMiddleware, validateParams(classSubjectIdParamSchema), validateBody(classSubjectUpdateSchema), asyncHandler(async (req, res) => {
  const { teacherId, coefficient } = req.body;
  const item = await prisma.classSubject.findUnique({
    where: { id: Number(req.params.id) },
    include: { class: true }
  });
  if (!item) throw new ApiError(404, 'المادة غير موجودة');
  if (!canManage(req, item.class)) throw new ApiError(403, 'لا يمكنك تعديل مادة هذا القسم');

  let nextTeacher = item.teacherId;
  if (teacherId !== undefined) {
    nextTeacher = teacherId ? Number(teacherId) : item.class.teacherId || null;
  }
  const updated = await prisma.classSubject.update({
    where: { id: item.id },
    data: { teacherId: nextTeacher, ...(coefficient !== undefined ? { coefficient: Math.min(6, Math.max(1, Number(coefficient) || 1)) } : {}) },
    include: {
      class: { select: { id: true, name: true, level: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } }
    }
  });
  res.json({ ...updated, subjectLabel: SUBJECT_LABELS[updated.subject] || updated.subject });
}));

/**
 * @swagger
 * /api/teacher/class-subjects/{id}:
 *   delete:
 *     summary: حذف مادة من قسم
 *     tags: [class-subjects]
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
 *       403:
 *         description: لا يمكنك حذف مادة هذا القسم
 *       404:
 *         description: المادة غير موجودة
 */
router.delete('/class-subjects/:id', teacherMiddleware, validateParams(classSubjectIdParamSchema), asyncHandler(async (req, res) => {
  const item = await prisma.classSubject.findUnique({
    where: { id: Number(req.params.id) },
    include: { class: true }
  });
  if (!item) throw new ApiError(404, 'المادة غير موجودة');
  if (!canManage(req, item.class)) throw new ApiError(403, 'لا يمكنك حذف مادة هذا القسم');
  await prisma.classSubject.delete({ where: { id: item.id } });
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/teacher/student/subjects:
 *   get:
 *     summary: مواد قسم التلميذ
 *     tags: [class-subjects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: المواد والدروس
 *       403:
 *         description: هذا الفضاء مخصص للتلميذ
 */
router.get('/student/subjects', studentMiddleware, asyncHandler(async (req, res) => {
  if (req.user.role !== 'STUDENT') throw new ApiError(403, 'هذا الفضاء مخصص للتلميذ');

  const studentRecord = await prisma.student.findFirst({
    where: { accountUserId: req.user.id },
    include: { class: { select: { id: true, name: true, level: true } } }
  });
  if (!studentRecord) return res.json({ class: null, subjects: [] });

  const [subjects, lessons] = await Promise.all([
    prisma.classSubject.findMany({
      where: { classId: studentRecord.classId },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        class: { select: { id: true, name: true, level: true } }
      },
      orderBy: { subject: 'asc' }
    }),
    prisma.lesson.findMany({
      where: { level: studentRecord.level },
      orderBy: [{ subject: 'asc' }, { order: 'asc' }]
    })
  ]);

  const lessonsBySubject = {};
  for (const l of lessons) {
    const key = l.subject;
    if (!lessonsBySubject[key]) lessonsBySubject[key] = [];
    lessonsBySubject[key].push(l);
  }

  res.json({
    class: studentRecord.class,
    subjects: subjects.map((s) => ({
      ...s,
      subjectLabel: SUBJECT_LABELS[s.subject] || s.subject,
      lessons: lessonsBySubject[s.subject] || []
    }))
  });
}));

export default router;
