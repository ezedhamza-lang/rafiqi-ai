import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../db.js';
import { logger } from '../utils/logger.js';
import { authMiddleware, adminMiddleware, requireRole } from '../auth.js';
import { notify, notifyRole } from '../services/notify.js';
import { schoolYearBounds, priceForType } from '../services/schoolYear.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { schoolWhere, scopedVia, resolveSchoolId } from '../services/schoolScope.js';
import {
  directorRequestApproveSchema,
  directorRequestRejectSchema,
  directorBroadcastSchema,
  directorStatusQuerySchema,
  directorRequestIdParamSchema
} from '../validators/director.js';
import { scheduleGridSchema, classIdParamSchema } from '../validators/teacherPlans.js';
import { idParamSchema } from '../validators/common.js';

const router = Router();
router.use(authMiddleware, adminMiddleware);

/**
 * @swagger
 * /api/director/dashboard:
 *   get:
 *     summary: لوحة تحكم المدير
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: إحصائيات اللوحة
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const schoolWhere_ = schoolWhere(req);
  const [
    classes,
    students,
    teachers,
    parents,
    quizzes,
    submissions,
    memos,
    messages,
    pendingRequests
  ] = await Promise.all([
    prisma.class.count({ where: schoolWhere_ }),
    prisma.student.count({ where: { class: { schoolId: resolveSchoolId(req) ?? undefined } } }),
    prisma.user.count({ where: { role: 'TEACHER', ...schoolWhere_ } }),
    prisma.user.count({ where: { role: 'PARENT', ...schoolWhere_ } }),
    prisma.quiz.count({ where: scopedVia(req, 'class') }),
    prisma.submission.count(),
    prisma.memo.count(),
    prisma.message.count({ where: { recipientId: req.user.id, readAt: null } }),
    // ملاحظة (27-08-2026): أُزيل استعلاما schedules/weakClasses هنا لأنهما
    // كانا يُجلَبان من القاعدة دون استخدام في الرد (تكلفة استعلام ضائعة).
    // جدول الحصص متوفر عبر /director/schedules/:id في صفحة مستقلة.
    prisma.subscriptionRequest.count({ where: scopedVia(req, 'class', { status: 'PENDING_APPROVAL' }) })
  ]);

  res.json({ totals: { classes, students, teachers, parents, quizzes, submissions, memos, unreadMessages: messages, pendingRequests } });
}));

/**
 * @swagger
 * /api/director/stats:
 *   get:
 *     summary: إحصائيات مفصلة لكل قسم
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: الإحصائيات
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const classes = await prisma.class.findMany({
    where: schoolWhere(req),
    include: {
      _count: { select: { students: true } },
      quizzes: { include: { submissions: true } }
    }
  });

  const classIds = classes.map((c) => c.id);

  // متوسط كل تلميذ + عدّ الناجح/راسب لكل قسم (Feature7)
  const submissions = classIds.length
    ? await prisma.submission.findMany({
        where: { quiz: { classId: { in: classIds } } },
        select: { studentId: true, score: true, totalPoints: true }
      })
    : [];
  const perStudent = {};
  submissions.forEach((s) => {
    if (!s.totalPoints) return;
    const pct = (s.score / s.totalPoints) * 100;
    if (!perStudent[s.studentId]) perStudent[s.studentId] = [];
    perStudent[s.studentId].push(pct);
  });

  const allStudents = classIds.length
    ? await prisma.student.findMany({
        where: { classId: { in: classIds } },
        select: { id: true, classId: true }
      })
    : [];
  const studentsByClass = {};
  allStudents.forEach((s) => {
    if (!studentsByClass[s.classId]) studentsByClass[s.classId] = [];
    studentsByClass[s.classId].push(s.id);
  });

  const perClass = classes.map((c) => {
    const attempts = c.quizzes.reduce((acc, q) => acc + q.submissions.length, 0);
    const avg = attempts
      ? Math.round(
          c.quizzes.reduce((acc, q) => acc + q.submissions.reduce((s2, sub) => s2 + (sub.score / (sub.totalPoints || 1)) * 100, 0), 0) / attempts
        )
      : 0;

    const classStudentIds = studentsByClass[c.id] || [];
    let pass = 0;
    let fail = 0;
    let noData = 0;
    classStudentIds.forEach((sid) => {
      const arr = perStudent[sid];
      if (!arr || arr.length === 0) {
        noData += 1;
      } else {
        const sAvg = arr.reduce((a, b) => a + b, 0) / arr.length;
        if (sAvg >= 50) pass += 1;
        else fail += 1;
      }
    });

    return {
      id: c.id,
      name: c.name,
      level: c.level,
      students: c._count.students,
      attempts,
      avgPercent: avg,
      pass,
      fail,
      noData
    };
  });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const recentSubmissions = await prisma.submission.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true }
  });
  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * 86400000);
    const key = d.toDateString();
    const count = recentSubmissions.filter((s) => new Date(s.createdAt).toDateString() === key).length;
    return { date: d.toISOString().slice(0, 10), count };
  });

  res.json({ perClass, trend });
}));

/**
 * @swagger
 * /api/director/alerts:
 *   get:
 *     summary: تنبيهات المدرسة
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: التنبيهات
 */
router.get('/alerts', asyncHandler(async (req, res) => {
  const studentsNoClass = await prisma.student.count({ where: { classId: null } });
  const studentsNoParent = await prisma.student.count({ where: { accountUserId: null } });
  const noActivity = await prisma.class.findMany({ where: { quizzes: { none: {} } } });
  const weakClasses = await prisma.class.findMany({ where: { quizzes: { some: {} } } });
  res.json({ studentsNoClass, studentsNoParent, noActivity: noActivity.map((c) => c.name), weakClasses: weakClasses.map((c) => c.name) });
}));

/**
 * @swagger
 * /api/director/activity:
 *   get:
 *     summary: آخر الأنشطة
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: الأنشطة الأخيرة
 */
router.get('/activity', asyncHandler(async (req, res) => {
  const [submissions, memos, activities] = await Promise.all([
    prisma.submission.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { student: { select: { firstName: true, lastName: true } }, quiz: { select: { title: true } } } }),
    prisma.memo.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { teacher: { select: { firstName: true, lastName: true } } } }),
    prisma.activityLog.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { student: { select: { firstName: true, lastName: true } } } })
  ]);
  res.json({ submissions, memos, activities });
}));

/**
 * @swagger
 * /api/director/classes:
 *   get:
 *     summary: قائمة الأقسام
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الأقسام
 */
router.get('/classes', asyncHandler(async (req, res) => {
  const classes = await prisma.class.findMany({
    where: schoolWhere(req),
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { students: true } }
    },
    orderBy: { name: 'asc' }
  });
  res.json(classes);
}));

/**
 * @swagger
 * /api/director/schedules/{classId}:
 *   get:
 *     summary: جدول قسم (المدير)
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: الجدول
 */
router.get('/schedules/:classId', validateParams(classIdParamSchema), asyncHandler(async (req, res) => {
  const classId = Number(req.params.classId);
  const cls = await prisma.class.findFirst({ where: { id: classId, ...schoolWhere(req) } });
  if (!cls) throw new ApiError(404, 'القسم غير موجود');
  const schedules = await prisma.schedule.findMany({
    where: { classId },
    orderBy: [{ day: 'asc' }, { period: 'asc' }]
  });
  const grid = Array.from({ length: 6 }, () => Array(6).fill(null));
  schedules.forEach((s) => {
    grid[s.day][s.period] = { subject: s.subject, teacherId: s.teacherId };
  });
  res.json({ class: cls, grid, days: 6, periods: 6 });
}));

/**
 * @swagger
 * /api/director/schedules/{classId}:
 *   put:
 *     summary: حفظ جدول قسم (المدير)
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم الحفظ
 */
router.put(
  '/schedules/:classId',
  requireRole('SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'),
  validateParams(classIdParamSchema),
  validateBody(scheduleGridSchema),
  asyncHandler(async (req, res) => {
    const classId = Number(req.params.classId);
    const cls = await prisma.class.findFirst({ where: { id: classId, ...schoolWhere(req) } });
    if (!cls) throw new ApiError(404, 'القسم غير موجود');
    const { grid } = req.body;
    await prisma.schedule.deleteMany({ where: { classId } });
    const rows = [];
    (grid || []).forEach((day, dayIdx) => {
      (day || []).forEach((cell, periodIdx) => {
        const subject = String(cell?.subject || '').trim();
        if (subject && cell?.filled) {
          rows.push({
            classId,
            day: dayIdx,
            period: periodIdx,
            subject,
            teacherId: cell.teacherId ? Number(cell.teacherId) : null
          });
        }
      });
    });
    if (rows.length) await prisma.schedule.createMany({ data: rows });
    res.json({ ok: true, count: rows.length, days: 6, periods: 6 });
  })
);

/**
 * @swagger
 * /api/director/students:
 *   get:
 *     summary: تلاميذ المدرسة
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 */
router.get('/students', asyncHandler(async (req, res) => {
  const students = await prisma.student.findMany({
    where: { class: { schoolId: resolveSchoolId(req) } },
    include: { class: { select: { id: true, name: true, level: true } } },
    orderBy: [{ level: 'asc' }, { lastName: 'asc' }]
  });
  res.json(students);
}));

/**
 * @swagger
 * /api/director/students/{id}/transfer:
 *   put:
 *     summary: نقل تلميذ بين الأقسام
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/students/:id/transfer',
  requireRole('SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const classId = Number(req.body?.classId);
    const student = await prisma.student.findFirst({ where: { id, class: { schoolId: resolveSchoolId(req) } } });
    if (!student) throw new ApiError(404, 'التلميذ غير موجود');
    const target = await prisma.class.findFirst({ where: { id: classId, schoolId: resolveSchoolId(req) } });
    if (!target) throw new ApiError(404, 'القسم غير موجود');
    const updated = await prisma.student.update({ where: { id }, data: { classId: target.id, level: target.level } });
    res.json(updated);
  })
);

/**
 * @swagger
 * /api/director/notifications:
 *   get:
 *     summary: إشعارات المدير
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: الإشعارات
 */
router.get('/notifications', asyncHandler(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  res.json(notifications);
}));

/**
 * @swagger
 * /api/director/notifications/read:
 *   post:
 *     summary: تحديد كل الإشعارات كمقروءة
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم التحديث
 */
router.post('/notifications/read', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/director/requests:
 *   get:
 *     summary: طلبات إضافة التلاميذ
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: قائمة الطلبات
 */
router.get('/requests', validateQuery(directorStatusQuerySchema), asyncHandler(async (req, res) => {
  const { status } = req.query;
  const schoolId = resolveSchoolId(req);
  // نشمل الطلبات المرتبطة بقسم في مدرسة المدير + الطلبات الجديدة (بلا قسم بعد،
  // لأن الولي يقدّمها قبل اختيار القسم من طرف المدير).
  const where = status ? { status } : {};
  if (schoolId != null) {
    where.OR = [{ class: { schoolId } }, { classId: null }];
  }
  const requests = await prisma.subscriptionRequest.findMany({
    where,
    include: {
      class: { select: { id: true, name: true, level: true } },
      parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(requests);
}));

/**
 * @swagger
 * /api/director/requests/{id}/approve:
 *   put:
 *     summary: الموافقة على طلب إضافة تلميذ
 *     tags: [director]
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
 *             required: [classId]
 *             properties:
 *               classId: { type: integer }
 *     responses:
 *       200:
 *         description: تمت الموافقة
 *       400:
 *         description: طلب تمت معالجته مسبقا
 *       404:
 *         description: الطلب أو القسم غير موجود
 */
router.put('/requests/:id/approve', requireRole('SCHOOL_DIRECTOR'), validateParams(directorRequestIdParamSchema), validateBody(directorRequestApproveSchema), asyncHandler(async (req, res) => {
  const { classId } = req.body;
  const request = await prisma.subscriptionRequest.findUnique({ where: { id: Number(req.params.id) } });
  if (!request) throw new ApiError(404, 'الطلب غير موجود');
  if (request.status !== 'PENDING_APPROVAL') {
    throw new ApiError(400, 'هذا الطلب تمت معالجته مسبقا');
  }
  const klass = await prisma.class.findUnique({ where: { id: Number(classId) } });
  if (!klass) throw new ApiError(404, 'القسم غير موجود');

  const temporaryPassword = `Refeeqi-${crypto.randomBytes(3).toString('hex')}`;
  const { start, end } = schoolYearBounds(request.schoolYear);

  try {
    const studentAccount = await prisma.user.create({
      data: {
        firstName: request.firstName,
        lastName: request.lastName,
        email: `s${request.parentId}-${Date.now()}@refeeqi.tn`,
        passwordHash: await bcrypt.hash(temporaryPassword, 10),
        role: 'STUDENT',
        accountStatus: 'PENDING_PAYMENT'
      }
    });

    const student = await prisma.student.create({
      data: {
        userId: request.parentId,
        accountUserId: studentAccount.id,
        classId: klass.id,
        firstName: request.firstName,
        lastName: request.lastName,
        birthDate: request.birthDate,
        cin: request.cin,
        gender: request.gender,
        level: request.level,
        schoolYear: request.schoolYear,
        schoolName: request.schoolName
      }
    });

    const subscription = await prisma.subscription.create({
      data: {
        userId: studentAccount.id,
        type: 'STUDENT',
        plan: 'اشتراك تلميذ',
        schoolYear: request.schoolYear,
        startDate: start,
        endDate: end,
        status: 'PENDING_PAYMENT',
        amount: priceForType('STUDENT'),
        studentId: student.id
      }
    });

    const updated = await prisma.subscriptionRequest.update({
      where: { id: request.id },
      data: { status: 'PENDING_PAYMENT', classId: klass.id, studentId: student.id, subscriptionId: subscription.id },
      include: {
        class: { select: { id: true, name: true, level: true } },
        parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }
      }
    });

    await notifyRole(['ADMIN'], {
      type: 'PAYMENT_PENDING',
      title: 'اشتراك جديد مستحق للدفع',
      body: `${request.firstName} ${request.lastName} — مصادق عليه و في انتظار تفعيل الاشتراك (${request.schoolYear})`,
      link: '/director/subscriptions'
    });
    await notify([request.parentId], {
      type: 'APPROVED',
      title: 'تمت المصادقة على طلبك',
      body: `وافق مدير المدرسة على تسجيل ${request.firstName} ${request.lastName}، أكمل عملية الدفع لتفعيل الحساب`,
      link: '/my-requests'
    });

    res.json({ ...updated, credentials: { email: studentAccount.email, password: temporaryPassword } });
  } catch (e) {
    logger.error({ err: e }, 'approve request failed');
    res.status(500).json({ error: 'تعذّر إتمام الموافقة على الطلب' });
  }
}));

/**
 * @swagger
 * /api/director/requests/{id}/reject:
 *   put:
 *     summary: رفض طلب إضافة تلميذ
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: تم الرفض
 *       400:
 *         description: طلب تمت معالجته مسبقا
 *       404:
 *         description: الطلب غير موجود
 */
router.put('/requests/:id/reject', requireRole('SCHOOL_DIRECTOR'), validateParams(directorRequestIdParamSchema), validateBody(directorRequestRejectSchema), asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const request = await prisma.subscriptionRequest.findUnique({ where: { id: Number(req.params.id) } });
  if (!request) throw new ApiError(404, 'الطلب غير موجود');
  if (request.status !== 'PENDING_APPROVAL') {
    throw new ApiError(400, 'هذا الطلب تمت معالجته مسبقا');
  }
  const updated = await prisma.subscriptionRequest.update({
    where: { id: request.id },
    data: { status: 'REJECTED', rejectionReason: reason ? String(reason).trim() : 'لم يقع تبيان السبب' }
  });
  await notify([request.parentId], {
    type: 'REJECTED',
    title: 'رفض طلب التسجيل',
    body: `تم رفض طلب تسجيل ${request.firstName} ${request.lastName}: ${updated.rejectionReason}`,
    link: '/my-requests'
  });
  res.json(updated);
}));

/**
 * @swagger
 * /api/director/broadcast:
 *   post:
 *     summary: إذاعة تنبيه عاجل لكل الأولياء
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, message]
 *             properties:
 *               title: { type: string }
 *               message: { type: string }
 *     responses:
 *       201:
 *         description: تم الإرسال
 *       400:
 *         description: فشل التحقق من البيانات
 */
router.post('/broadcast', requireRole('SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'), validateBody(directorBroadcastSchema), asyncHandler(async (req, res) => {
  const { title, message } = req.body;

  const parents = await prisma.user.findMany({
    where: { role: 'PARENT' },
    select: { id: true }
  });

  await prisma.notification.createMany({
    data: parents.map((p) => ({
      userId: p.id,
      type: 'EMERGENCY',
      title: `تنبيه عاجل: ${String(title).trim().slice(0, 200)}`,
      body: String(message).trim().slice(0, 2000),
      link: '/parent'
    }))
  });

  res.status(201).json({ ok: true, recipients: parents.length });
}));

export default router;
