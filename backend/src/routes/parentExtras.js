import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { validateParams, validateBody } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { buildStudentReport } from '../services/analyticsService.js';
import { analyticsStudentParamSchema } from '../validators/analytics.js';
import { z } from 'zod';

const parentRouter = Router();
const teacherRouter = Router();
parentRouter.use(authMiddleware);
teacherRouter.use(authMiddleware);

const studentParam = z.object({ studentId: z.coerce.number().int().positive() });

/**
 * @swagger
 * /api/parent/analytics/children/{studentId}:
 *   get:
 *     summary: تقرير تحليلي لابن الولي
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: التقرير التحليلي للابن (القوة/الضعف والمنحنى والتنبيهات)
 *       404:
 *         description: الابن غير موجود
 */
parentRouter.get('/analytics/children/:studentId', requireRole('PARENT', 'TEACHER'), validateParams(analyticsStudentParamSchema), asyncHandler(async (req, res) => {
  const student = await prisma.student.findFirst({
    where: { userId: req.user.id, accountUserId: Number(req.params.studentId) },
    include: { class: true }
  });
  if (!student) throw new ApiError(404, 'الابن غير موجود');

  const assignments = await prisma.assignment.findMany({
    where: { classId: student.classId },
    orderBy: { dueDate: 'asc' }
  });
  const submissions = await prisma.assignmentSubmission.findMany({
    where: { studentId: student.accountUserId }
  });

  res.json(buildStudentReport({ student, klass: student.class, assignments, submissions }));
}));

/**
 * @swagger
 * /api/parent/analytics/children/{studentId}/pdf:
 *   get:
 *     summary: تقرير تقدم الابن PDF قابل للطباعة
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ملف PDF
 */
parentRouter.get('/analytics/children/:studentId/pdf', requireRole('PARENT', 'TEACHER'), validateParams(studentParam), asyncHandler(async (req, res) => {
  const student = await prisma.student.findFirst({
    where: { userId: req.user.id, accountUserId: Number(req.params.studentId) },
    include: { class: true, account: true }
  });
  if (!student) throw new ApiError(404, 'الابن غير موجود');

  const assignments = await prisma.assignment.findMany({ where: { classId: student.classId }, orderBy: { dueDate: 'asc' } });
  const submissions = await prisma.assignmentSubmission.findMany({ where: { studentId: student.accountUserId } });
  const report = buildStudentReport({ student, klass: student.class, assignments, submissions });

  const { buildChildReportPdf } = await import('../services/exportService.js');
  const buffer = await buildChildReportPdf({ student, report });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="report-${student.accountUserId}.pdf"`);
  res.send(buffer);
}));

/**
 * @swagger
 * /api/parent/notes:
 *   get:
 *     summary: ملاحظات الولي (مع الردود)
 *     tags: [parent]
 *     security:
 *       - bearerAuth: []
 */
parentRouter.get('/notes', requireRole('PARENT', 'TEACHER'), asyncHandler(async (req, res) => {
  const notes = await prisma.parentNote.findMany({
    where: { parentId: req.user.id },
    include: {
      student: { select: { firstName: true, lastName: true } },
      teacher: { select: { firstName: true, lastName: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(notes.map((n) => ({
    id: n.id,
    studentId: n.studentId,
    studentName: `${n.student.firstName} ${n.student.lastName}`,
    teacherId: n.teacherId,
    teacherName: `${n.teacher.firstName} ${n.teacher.lastName}`,
    content: n.content,
    reply: n.reply,
    readAt: n.readAt,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt
  })));
}));

/**
 * @swagger
 * /api/parent/notes:
 *   post:
 *     summary: إرسال ملاحظة لأستاذ الابن
 *     tags: [parent]
 *     security:
 *       - bearerAuth: []
 */
parentRouter.post('/notes', requireRole('PARENT', 'TEACHER'), validateBody(z.object({
  studentId: z.coerce.number().int().positive(),
  teacherId: z.coerce.number().int().positive(),
  content: z.string().trim().min(3, { error: 'الملاحظة قصيرة جداً' }).max(2000)
})), asyncHandler(async (req, res) => {
  const { studentId, teacherId, content } = req.body;
  const student = await prisma.student.findFirst({ where: { userId: req.user.id, accountUserId: studentId } });
  if (!student) throw new ApiError(404, 'الابن غير موجود');
  const teacher = await prisma.user.findFirst({ where: { id: teacherId, role: 'TEACHER' } });
  if (!teacher) throw new ApiError(404, 'الأستاذ غير موجود');

  const note = await prisma.parentNote.create({
    data: { parentId: req.user.id, studentId, teacherId, content }
  });
  const { notify } = await import('../services/notify.js');
  await notify([teacherId], { type: 'PARENT_NOTE', title: 'ملاحظة جديدة من ولي', body: content.slice(0, 120), link: '/teacher/notes' });
  res.status(201).json(note);
}));

/**
 * @swagger
 * /api/parent/notes/teachers:
 *   get:
 *     summary: أساتذة أبناء الولي (لإرسال الملاحظات)
 *     tags: [parent]
 *     security:
 *       - bearerAuth: []
 */
parentRouter.get('/notes/teachers', requireRole('PARENT', 'TEACHER'), asyncHandler(async (req, res) => {
  const students = await prisma.student.findMany({
    where: { userId: req.user.id },
    select: { accountUserId: true, firstName: true, lastName: true, class: { select: { id: true, name: true, teacher: { select: { id: true, firstName: true, lastName: true } } } } }
  });
  const items = [];
  for (const s of students) {
    if (s.class?.teacher) items.push({ studentId: s.accountUserId, studentName: `${s.firstName} ${s.lastName}`, teacherId: s.class.teacher.id, teacherName: `${s.class.teacher.firstName} ${s.class.teacher.lastName}` });
  }
  res.json(items);
}));

/**
 * @swagger
 * /api/teacher/notes:
 *   get:
 *     summary: ملاحظات الأولياء الموجهة للأستاذ
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 */
teacherRouter.get('/notes', requireRole('TEACHER', 'ADMIN', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const notes = await prisma.parentNote.findMany({
    where: { teacherId: req.user.id },
    include: {
      parent: { select: { firstName: true, lastName: true } },
      student: { select: { firstName: true, lastName: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(notes.map((n) => ({
    id: n.id,
    parentName: `${n.parent.firstName} ${n.parent.lastName}`,
    studentName: `${n.student.firstName} ${n.student.lastName}`,
    content: n.content,
    reply: n.reply,
    readAt: n.readAt,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt
  })));
}));

/**
 * @swagger
 * /api/teacher/notes/{id}/reply:
 *   post:
 *     summary: رد الأستاذ على ملاحظة ولي
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 */
teacherRouter.post('/notes/:id/reply', requireRole('TEACHER', 'ADMIN', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN'), validateParams(z.object({ id: z.coerce.number().int().positive() })), validateBody(z.object({ reply: z.string().trim().min(1, { error: 'الرد فارغ' }).max(2000) })), asyncHandler(async (req, res) => {
  const note = await prisma.parentNote.findFirst({ where: { id: Number(req.params.id), teacherId: req.user.id } });
  if (!note) throw new ApiError(404, 'الملاحظة غير موجودة');
  const updated = await prisma.parentNote.update({ where: { id: note.id }, data: { reply: req.body.reply, readAt: new Date() } });
  const { notify } = await import('../services/notify.js');
  await notify([note.parentId], { type: 'PARENT_NOTE_REPLY', title: 'رد الأستاذ على ملاحظتك', body: req.body.reply.slice(0, 120), link: '/parent/notes' });
  res.json(updated);
}));

export { parentRouter, teacherRouter };