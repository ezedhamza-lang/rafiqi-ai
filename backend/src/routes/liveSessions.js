import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import {
  createLiveSessionSchema,
  updateLiveSessionSchema,
  liveSessionIdParamSchema,
  liveSessionUserParamSchema
} from '../validators/liveSessions.js';
import { config } from '../config.js';
import { getVideoProvider, getVideoProviderInfo } from '../services/videoProvider/index.js';
import {
  sanitizeRoomName,
  classStudentAndParentIds,
  reconcileSession,
  finalizeSession,
  serializeSession
} from '../services/liveSessionService.js';
import { notify } from '../services/notify.js';
import {
  getLiveRoomInteractions,
  lowerRaisedHand,
  stopScreenShare
} from '../ws.js';

const router = Router();
router.use(authMiddleware);

const TEACHER_ROLES = ['TEACHER', 'ADMIN', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN'];

function formatDate(d) {
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatTime(d) {
  const date = new Date(d);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function isAdminRole(role) {
  return ['ADMIN', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN'].includes(role);
}

function canManage(session, user) {
  return session.teacherId === user.id || isAdminRole(user.role);
}

async function sessionWhereForUser(user) {
  if (user.role === 'TEACHER') {
    return { teacherId: user.id };
  }
  if (isAdminRole(user.role)) {
    return {};
  }
  if (user.role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { accountUserId: user.id } });
    return { OR: [{ classId: student?.classId ?? null }, { classId: null }] };
  }
  if (user.role === 'PARENT') {
    const students = await prisma.student.findMany({ where: { userId: user.id }, select: { classId: true } });
    const classIds = [...new Set(students.map((s) => s.classId).filter((v) => v != null))];
    return { OR: [{ classId: { in: classIds } }, { classId: null }] };
  }
  return { id: -1 };
}

async function findSessionAuthorized(id, user) {
  const session = await prisma.liveSession.findUnique({ where: { id } });
  if (!session) throw new ApiError(404, 'الحصة غير موجودة');

  if (user.role === 'TEACHER') {
    if (session.teacherId !== user.id) throw new ApiError(403, 'صلاحية غير كافية');
    return session;
  }
  if (isAdminRole(user.role)) return session;
  if (user.role === 'STUDENT') {
    if (session.classId === null) return session;
    const count = await prisma.student.count({ where: { accountUserId: user.id, classId: session.classId } });
    if (!count) throw new ApiError(403, 'صلاحية غير كافية');
    return session;
  }
  if (user.role === 'PARENT') {
    if (session.classId === null) return session;
    const count = await prisma.student.count({ where: { userId: user.id, classId: session.classId } });
    if (!count) throw new ApiError(403, 'صلاحية غير كافية');
    return session;
  }
  throw new ApiError(403, 'صلاحية غير كافية');
}

async function notifyClass(classId, payloadStudents, payloadParents) {
  const { students, parents } = await classStudentAndParentIds(classId);
  if (students.length) await notify(students, payloadStudents);
  if (parents.length) await notify(parents, payloadParents);
}

/**
 * @swagger
 * /api/live/config:
 *   get:
 *     summary: معلومات مزوّد الفيديو النشط
 *     tags: [live-sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: المزوّد (LOCAL | LIVEKIT) مع بياناته العمومية
 */
router.get('/live/config', asyncHandler(async (req, res) => {
  res.json(getVideoProviderInfo());
}));

export const liveConfigRouter = Router();
liveConfigRouter.use(authMiddleware);
liveConfigRouter.get('/config', asyncHandler(async (req, res) => {
  res.json(getVideoProviderInfo());
}));

/**
 * @swagger
 * /api/{space}/live:
 *   get:
 *     summary: قائمة الحصص المباشرة (حسب الدور)
 *     tags: [live-sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: space
 *         schema: { type: string, enum: [teacher, student, parent] }
 *         required: true
 *     responses:
 *       200:
 *         description: قائمة الحصص (مجدولة/حية/منتهية) مع التسجيلات
 */
router.get('/live', asyncHandler(async (req, res) => {
  const where = await sessionWhereForUser(req.user);
  const sessions = await prisma.liveSession.findMany({
    where,
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true, role: true } },
      class: { select: { id: true, name: true } },
      recordings: { orderBy: { createdAt: 'desc' } }
    },
    orderBy: { startsAt: 'asc' }
  });
  const result = [];
  for (const s of sessions) {
    result.push(serializeSession(await reconcileSession(s)));
  }
  res.json(result);
}));

/**
 * @swagger
 * /api/{space}/live/recordings:
 *   get:
 *     summary: تسجيلات الحصص المتاحة (حسب الدور)
 *     tags: [live-sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة التسجيلات المتاحة
 */
router.get('/live/recordings', asyncHandler(async (req, res) => {
  const where = await sessionWhereForUser(req.user);
  const sessions = await prisma.liveSession.findMany({ where, select: { id: true } });
  const ids = sessions.map((s) => s.id);
  if (!ids.length) return res.json([]);
  const recordings = await prisma.liveRecording.findMany({
    where: { sessionId: { in: ids }, status: 'AVAILABLE' },
    include: {
      session: {
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true, role: true } },
          class: { select: { id: true, name: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(recordings);
}));

/**
 * @swagger
 * /api/teacher/live:
 *   post:
 *     summary: جدولة حصة مباشرة جديدة
 *     tags: [live-sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, startsAt, endsAt]
 *             properties:
 *               title: { type: string }
 *               subject: { type: string }
 *               description: { type: string }
 *               classId: { type: integer, nullable: true }
 *               provider: { type: string, enum: [LOCAL, LIVEKIT] }
 *               maxParticipants: { type: integer }
 *               startsAt: { type: string, format: date-time }
 *               endsAt: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: الحصة المجدولة
 *       404:
 *         description: القسم غير موجود
 */
router.post(
  '/live',
  requireRole(...TEACHER_ROLES),
  validateBody(createLiveSessionSchema),
  asyncHandler(async (req, res) => {
    const d = req.body;
    if (d.classId) {
      const klass = await prisma.class.findUnique({ where: { id: d.classId } });
      if (!klass) throw new ApiError(404, 'القسم غير موجود');
      if (req.user.role === 'TEACHER' && klass.teacherId !== req.user.id) {
        throw new ApiError(403, 'لا يمكنك جدولة حصة لقسم ليس من أقسامك');
      }
    }

    const startsAt = new Date(d.startsAt);
    const endsAt = new Date(d.endsAt);
    if (endsAt <= startsAt) throw new ApiError(400, 'وقت النهاية يجب أن يكون بعد وقت البداية');

    const now = new Date();
    const initialStatus = now >= startsAt && now < endsAt ? 'LIVE' : 'SCHEDULED';
    const session = await prisma.liveSession.create({
      data: {
        teacherId: req.user.id,
        classId: d.classId || null,
        title: d.title,
        subject: d.subject || null,
        description: d.description || null,
        provider: (d.provider || config.video.provider).toUpperCase(),
        roomName: sanitizeRoomName(d.title),
        startsAt,
        endsAt,
        status: initialStatus,
        maxParticipants: d.maxParticipants || 30
      }
    });

    await getVideoProvider().createRoom(session).catch(() => {});

    if (session.classId) {
      await notifyClass(
        session.classId,
        {
          type: 'LIVE_SESSION',
          title: `حصة مباشرة جديدة: ${session.title}`,
          body: `مجدولة يوم ${formatDate(startsAt)} على الساعة ${formatTime(startsAt)}`,
          link: '/student-space/live'
        },
        {
          type: 'LIVE_SESSION',
          title: `حصة مباشرة جديدة: ${session.title}`,
          body: `مجدولة يوم ${formatDate(startsAt)} على الساعة ${formatTime(startsAt)}`,
          link: '/parent/live'
        }
      );
    }

    res.status(201).json(serializeSession(session));
  })
);

/**
 * @swagger
 * /api/teacher/live/{id}:
 *   get:
 *     summary: تفاصيل حصة مباشرة
 *     tags: [live-sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: تفاصيل الحصة مع التسجيلات
 *       404:
 *         description: الحصة غير موجودة
 */
router.get('/live/:id', validateParams(liveSessionIdParamSchema), asyncHandler(async (req, res) => {
  const session = await findSessionAuthorized(Number(req.params.id), req.user);
  const detail = await prisma.liveSession.findUnique({
    where: { id: session.id },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true, role: true } },
      class: { select: { id: true, name: true } },
      recordings: { orderBy: { createdAt: 'desc' } }
    }
  });
  res.json(serializeSession(await reconcileSession(detail)));
}));

/**
 * @swagger
 * /api/teacher/live/{id}:
 *   put:
 *     summary: تعديل حصة مجدولة
 *     tags: [live-sessions]
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
 *               subject: { type: string }
 *               description: { type: string }
 *               classId: { type: integer, nullable: true }
 *               maxParticipants: { type: integer }
 *               startsAt: { type: string, format: date-time }
 *               endsAt: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: الحصة المحدثة
 *       400:
 *         description: لا يمكن تعديل حصة جارية أو منتهية
 */
router.put(
  '/live/:id',
  requireRole(...TEACHER_ROLES),
  validateParams(liveSessionIdParamSchema),
  validateBody(updateLiveSessionSchema),
  asyncHandler(async (req, res) => {
    const session = await findSessionAuthorized(Number(req.params.id), req.user);
    if (!canManage(session, req.user)) throw new ApiError(403, 'صلاحية غير كافية');
    if (session.status !== 'SCHEDULED') {
      throw new ApiError(400, 'لا يمكن تعديل حصة جارية أو منتهية أو ملغاة');
    }
    const d = req.body;
    const data = {};
    if (d.title !== undefined) data.title = d.title;
    if (d.subject !== undefined) data.subject = d.subject;
    if (d.description !== undefined) data.description = d.description;
    if (d.maxParticipants !== undefined) data.maxParticipants = d.maxParticipants;
    if (d.classId !== undefined) {
      if (d.classId) {
        const klass = await prisma.class.findUnique({ where: { id: d.classId } });
        if (!klass) throw new ApiError(404, 'القسم غير موجود');
        if (req.user.role === 'TEACHER' && klass.teacherId !== req.user.id) {
          throw new ApiError(403, 'لا يمكنك تعديل حصة لقسم ليس من أقسامك');
        }
      }
      data.classId = d.classId;
    }
    if (d.startsAt !== undefined) data.startsAt = new Date(d.startsAt);
    if (d.endsAt !== undefined) data.endsAt = new Date(d.endsAt);
    if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) {
      throw new ApiError(400, 'وقت النهاية يجب أن يكون بعد وقت البداية');
    }
    if (data.startsAt && !data.endsAt && data.startsAt >= session.endsAt) {
      throw new ApiError(400, 'وقت النهاية يجب أن يكون بعد وقت البداية');
    }
    if (data.endsAt && !data.startsAt && session.startsAt >= data.endsAt) {
      throw new ApiError(400, 'وقت النهاية يجب أن يكون بعد وقت البداية');
    }
    const updated = await prisma.liveSession.update({ where: { id: session.id }, data });
    res.json(serializeSession(updated));
  })
);

/**
 * @swagger
 * /api/teacher/live/{id}/start:
 *   post:
 *     summary: بدء حصة مباشرة الآن
 *     tags: [live-sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: الحصة صارت حية مع توكن البث
 *       403:
 *         description: الحصة لم تبدأ بعد أو صلاحية غير كافية
 */
router.post(
  '/live/:id/start',
  requireRole(...TEACHER_ROLES),
  validateParams(liveSessionIdParamSchema),
  asyncHandler(async (req, res) => {
    const session = await findSessionAuthorized(Number(req.params.id), req.user);
    if (!canManage(session, req.user)) throw new ApiError(403, 'صلاحية غير كافية');
    if (session.status === 'CANCELLED') throw new ApiError(400, 'لا يمكن بدء حصة ملغاة');
    if (session.status === 'ENDED') throw new ApiError(400, 'انتهت الحصة');

    const provider = getVideoProvider();
    await provider.requestRecording({ session }).catch(() => {});
    const updated = await prisma.liveSession.update({ where: { id: session.id }, data: { status: 'LIVE' } });
    const join = await provider.issueJoinToken({ session: updated, user: req.user, canPublish: true });

    if (updated.classId) {
      await notifyClass(
        updated.classId,
        {
          type: 'LIVE_SESSION_STARTED',
          title: `بدأت الآن الحصة المباشرة: ${updated.title}`,
          body: 'اضغط للانضمام إلى الحصة',
          link: '/student-space/live'
        },
        {
          type: 'LIVE_SESSION_STARTED',
          title: `بدأت الآن الحصة المباشرة: ${updated.title}`,
          body: 'اضغط لمتابعة الحصة',
          link: '/parent/live'
        }
      );
    }

    res.json({ session: serializeSession(updated), join });
  })
);

/**
 * @swagger
 * /api/teacher/live/{id}/end:
 *   post:
 *     summary: إنهاء حصة مباشرة (يُنشئ التسجيل تلقائيا)
 *     tags: [live-sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: انتهت الحصة والتسجيل متاح
 */
router.post(
  '/live/:id/end',
  requireRole(...TEACHER_ROLES),
  validateParams(liveSessionIdParamSchema),
  asyncHandler(async (req, res) => {
    const session = await findSessionAuthorized(Number(req.params.id), req.user);
    if (!canManage(session, req.user)) throw new ApiError(403, 'صلاحية غير كافية');
    if (session.status === 'CANCELLED') throw new ApiError(400, 'لا يمكن إنهاء حصة ملغاة');

    if (session.status === 'ENDED') {
      const recording = await prisma.liveRecording.findFirst({ where: { sessionId: session.id } });
      return res.json({ session: serializeSession(session), recording });
    }

    const ended = await finalizeSession(session);
    const recording = await prisma.liveRecording.findFirst({ where: { sessionId: session.id } });
    res.json({ session: serializeSession(ended), recording });
  })
);

/**
 * @swagger
 * /api/teacher/live/{id}/cancel:
 *   post:
 *     summary: إلغاء حصة مباشرة مجدولة
 *     tags: [live-sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: أُلغيت الحصة
 */
router.post(
  '/live/:id/cancel',
  requireRole(...TEACHER_ROLES),
  validateParams(liveSessionIdParamSchema),
  asyncHandler(async (req, res) => {
    const session = await findSessionAuthorized(Number(req.params.id), req.user);
    if (!canManage(session, req.user)) throw new ApiError(403, 'صلاحية غير كافية');
    if (session.status === 'ENDED') throw new ApiError(400, 'لا يمكن إلغاء حصة انتهت');
    if (session.status === 'LIVE') throw new ApiError(400, 'لا يمكن إلغاء حصة جارية');

    const updated = await prisma.liveSession.update({ where: { id: session.id }, data: { status: 'CANCELLED' } });

    if (updated.classId) {
      await notifyClass(
        updated.classId,
        {
          type: 'LIVE_SESSION_CANCELLED',
          title: `أُلغيت الحصة المباشرة: ${updated.title}`,
          body: 'راجع جدول الحصص القادمة',
          link: '/student-space/live'
        },
        {
          type: 'LIVE_SESSION_CANCELLED',
          title: `أُلغيت الحصة المباشرة: ${updated.title}`,
          body: 'راجع جدول الحصص القادمة',
          link: '/parent/live'
        }
      );
    }

    res.json(serializeSession(updated));
  })
);

/**
 * @swagger
 * /api/{space}/live/{id}/join:
 *   post:
 *     summary: الانضمام إلى حصة مباشرة (حسب الدور)
 *     tags: [live-sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: توكن الدخول + تفاصيل الحصة
 *       403:
 *         description: الحصة لم تبدأ بعد أو صلاحية غير كافية
 */
router.post(
  '/live/:id/join',
  validateParams(liveSessionIdParamSchema),
  asyncHandler(async (req, res) => {
    let session = await findSessionAuthorized(Number(req.params.id), req.user);
    session = await reconcileSession(session);
    const provider = getVideoProvider();
    const isHost = session.teacherId === req.user.id || isAdminRole(req.user.role);
    if (session.status === 'CANCELLED' || session.status === 'ENDED') {
      throw new ApiError(400, 'انتهت الحصة أو أُلغيت');
    }
    if (!isHost && session.status !== 'LIVE') {
      throw new ApiError(403, 'الحصة لم تبدأ بعد');
    }
    const join = await provider.issueJoinToken({ session, user: req.user, canPublish: isHost });
    res.json({ session: serializeSession(session), join });
  })
);

/**
 * @swagger
 * /api/{space}/live/{id}/chat:
 *   get:
 *     summary: سجل الدردشة الحية لحصة (حسب الدور)
 *     tags: [live-sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: آخر رسائل الدردشة
 *       404:
 *         description: الحصة غير موجودة
 */
router.get(
  '/live/:id/chat',
  validateParams(liveSessionIdParamSchema),
  asyncHandler(async (req, res) => {
    const session = await findSessionAuthorized(Number(req.params.id), req.user);
    const messages = await prisma.liveChatMessage.findMany({
      where: { sessionId: session.id },
      include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(messages.reverse());
  })
);

/**
 * @swagger
 * /api/{space}/live/{id}/interactions:
 *   get:
 *     summary: الحالة اللحظية لتفاعلات الحصة (أيدي مرفوعة + مشاركة شاشة)
 *     tags: [live-sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: قوائم الأيدي المرفوعة ومشاركات الشاشة
 */
router.get(
  '/live/:id/interactions',
  validateParams(liveSessionIdParamSchema),
  asyncHandler(async (req, res) => {
    const session = await findSessionAuthorized(Number(req.params.id), req.user);
    res.json(getLiveRoomInteractions(session.roomName));
  })
);

/**
 * @swagger
 * /api/teacher/live/{id}/hand/{userId}/lower:
 *   post:
 *     summary: خفض يد تلميذ (من الأستاذ)
 *     tags: [live-sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: خُفضت اليد
 *       403:
 *         description: صلاحية غير كافية
 */
router.post(
  '/live/:id/hand/:userId/lower',
  requireRole(...TEACHER_ROLES),
  validateParams(liveSessionUserParamSchema),
  asyncHandler(async (req, res) => {
    const session = await findSessionAuthorized(Number(req.params.id), req.user);
    if (!canManage(session, req.user)) throw new ApiError(403, 'صلاحية غير كافية');
    await lowerRaisedHand(session.roomName, Number(req.params.userId), session.id);
    res.json({ ok: true });
  })
);

/**
 * @swagger
 * /api/teacher/live/{id}/screen/{userId}/stop:
 *   post:
 *     summary: إيقاف مشاركة شاشة (من الأستاذ)
 *     tags: [live-sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: أوقفت المشاركة
 */
router.post(
  '/live/:id/screen/:userId/stop',
  requireRole(...TEACHER_ROLES),
  validateParams(liveSessionUserParamSchema),
  asyncHandler(async (req, res) => {
    const session = await findSessionAuthorized(Number(req.params.id), req.user);
    if (!canManage(session, req.user)) throw new ApiError(403, 'صلاحية غير كافية');
    await stopScreenShare(session.roomName, Number(req.params.userId), session.id);
    res.json({ ok: true });
  })
);

/**
 * @swagger
 * /api/{space}/live/{id}/recording:
 *   get:
 *     summary: تحميل تسجيل حصة متاح
 *     tags: [live-sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ملف التسجيل
 *       404:
 *         description: لا يوجد تسجيل متاح
 */
router.get(
  '/live/:id/recording',
  validateParams(liveSessionIdParamSchema),
  asyncHandler(async (req, res) => {
    const session = await findSessionAuthorized(Number(req.params.id), req.user);
    const recording = await prisma.liveRecording.findFirst({
      where: { sessionId: session.id, status: 'AVAILABLE' }
    });
    if (!recording?.fileUrl) throw new ApiError(404, 'لا يوجد تسجيل متاح لهذه الحصة بعد');
    const filePath = path.join(process.cwd(), 'uploads', 'recordings', path.basename(recording.fileUrl));
    if (!fs.existsSync(filePath)) throw new ApiError(404, 'ملف التسجيل غير موجود بعد');
    res.download(filePath, `${session.title.replace(/[^\u0600-\u06FFa-zA-Z0-9_-]+/g, '-')}-recording.wav`);
  })
);

export default router;
