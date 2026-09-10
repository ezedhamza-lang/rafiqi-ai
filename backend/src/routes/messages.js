import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../db.js';
import { authMiddleware } from '../auth.js';
import { notify } from '../services/notify.js';
import { sendToUser, broadcastUnread } from '../ws.js';
import { isAllowedContact, scopedRecipientIds, MESSAGE_POLICY, MESSAGE_POLICY_TEXT } from '../services/messagingPolicy.js';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { validateUploadedFiles } from '../utils/fileSecurity.js';
import { strictExtFilter, safeFilename } from '../utils/uploadSafe.js';
import {
  userIdParamSchema,
  messageCreateSchema,
  recipientsQuerySchema,
  archiveQuerySchema,
  archiveConversationQuerySchema
} from '../validators/messages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MSG_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx'];
const MSG_MAGIC = ['pdf', 'jpeg', 'png', 'webp', 'doc', 'zip'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: safeFilename('att')
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: strictExtFilter(MSG_EXT)
});

const POLICY = MESSAGE_POLICY;
const POLICY_TEXT = MESSAGE_POLICY_TEXT;

const router = Router();
router.use(authMiddleware);

/**
 * @swagger
 * /api/messages/conversations:
 *   get:
 *     summary: قائمة المحادثات الخاصة بالمستخدم
 *     tags: [messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة المحادثات
 */
router.get('/conversations', asyncHandler(async (req, res) => {
  const messages = await prisma.message.findMany({
    where: {
      OR: [{ senderId: req.user.id }, { recipientId: req.user.id }]
    },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, role: true } },
      recipient: { select: { id: true, firstName: true, lastName: true, role: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const convMap = new Map();
  for (const m of messages) {
    const otherId = m.senderId === req.user.id ? m.recipientId : m.senderId;
    if (!convMap.has(otherId)) {
      convMap.set(otherId, {
        other: m.senderId === req.user.id ? m.recipient : m.sender,
        lastMessage: m,
        unread: m.recipientId === req.user.id && !m.readAt ? 1 : 0
      });
    } else {
      const c = convMap.get(otherId);
      if (m.recipientId === req.user.id && !m.readAt) c.unread += 1;
    }
  }
  res.json(Array.from(convMap.values()));
}));

/**
 * @swagger
 * /api/messages/messages/{userId}:
 *   get:
 *     summary: سجل الرسائل مع مستخدم آخر
 *     tags: [messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: قائمة الرسائل
 *       400:
 *         description: معرف غير صحيح
 *       404:
 *         description: المستخدم غير موجود
 */
router.get('/messages/:userId', validateParams(userIdParamSchema), asyncHandler(async (req, res) => {
  const otherId = Number(req.params.userId);
  if (otherId === req.user.id) {
    throw new ApiError(400, 'معرف غير صحيح');
  }

  const other = await prisma.user.findUnique({ where: { id: otherId } });
  if (!other) throw new ApiError(404, 'المستخدم غير موجود');

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: req.user.id, recipientId: otherId },
        { senderId: otherId, recipientId: req.user.id }
      ]
    },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true } }
    },
    orderBy: { createdAt: 'asc' }
  });

  await prisma.message.updateMany({
    where: { senderId: otherId, recipientId: req.user.id, readAt: null },
    data: { readAt: new Date() }
  });
  await broadcastUnread(req.user.id);
  sendToUser(otherId, { type: 'message:read', readerId: req.user.id });

  res.json(messages);
}));

/**
 * @swagger
 * /api/messages/recipients:
 *   get:
 *     summary: قائمة المستلمين المحتملين
 *     tags: [messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: قائمة المستخدمين
 */
router.get('/recipients', validateQuery(recipientsQuerySchema), asyncHandler(async (req, res) => {
  const allowed = POLICY[req.user.role] || [];
  if (!allowed.length) return res.json([]);
  const q = (req.query.q || '').toString().trim();

  const qFilter = q
    ? [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } }
      ]
    : null;

  if (req.user.role === 'PARENT' || req.user.role === 'TEACHER') {
    const contactRole = req.user.role === 'PARENT' ? 'TEACHER' : 'PARENT';
    const contactIds = (await scopedRecipientIds(req.user)) || [];
    const adminRoles = allowed.filter((r) => r !== contactRole);
    const where = {
      id: { not: req.user.id },
      accountStatus: 'ACTIVE',
      OR: [
        { role: contactRole, id: { in: contactIds.length ? contactIds : [-1] } },
        { role: { in: adminRoles } }
      ]
    };
    if (qFilter) where.AND = [{ OR: qFilter }];
    const users = await prisma.user.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
      take: 100
    });
    return res.json(users);
  }

  const where = {
    id: { not: req.user.id },
    role: { in: allowed },
    accountStatus: 'ACTIVE'
  };
  if (qFilter) where.OR = qFilter;
  const users = await prisma.user.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
    orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    take: 100
  });
  res.json(users);
}));

/**
 * @swagger
 * /api/messages/unread-count:
 *   get:
 *     summary: عدد الرسائل غير المقروءة
 *     tags: [messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: العدد
 */
router.get('/unread-count', asyncHandler(async (req, res) => {
  const count = await prisma.message.count({
    where: { recipientId: req.user.id, readAt: null }
  });
  res.json({ count });
}));

/**
 * @swagger
 * /api/messages/messages:
 *   post:
 *     summary: إرسال رسالة (مع إمكانية إرفاق ملف)
 *     tags: [messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [recipientId, body]
 *             properties:
 *               recipientId: { type: integer }
 *               subject: { type: string }
 *               body: { type: string }
 *               attachment: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: تم إرسال الرسالة
 *       400:
 *         description: فشل التحقق من البيانات
 *       403:
 *         description: صلاحية غير كافية
 *       404:
 *         description: المستلم غير موجود
 */
router.post('/messages', upload.single('attachment'), validateBody(messageCreateSchema), asyncHandler(async (req, res) => {
  const { recipientId, subject, body } = req.body;
  if (req.file) {
    const badFiles = validateUploadedFiles([req.file], MSG_MAGIC);
    if (badFiles.length) throw new ApiError(400, 'محتوى المرفق لا يطابق الأنواع المسموح بها (PDF أو صور أو Word)');
  }
  const recipient = await prisma.user.findUnique({ where: { id: Number(recipientId) } });
  if (!recipient) throw new ApiError(404, 'المستلم غير موجود');
  if (!(await isAllowedContact(req.user, recipient))) {
    throw new ApiError(403, POLICY_TEXT[req.user.role] || 'صلاحية غير كافية');
  }

  const message = await prisma.message.create({
    data: {
      senderId: req.user.id,
      recipientId: Number(recipientId),
      subject: subject ? String(subject).trim().slice(0, 200) : null,
      body: String(body).trim().slice(0, 5000),
      attachmentUrl: req.file ? `/uploads/${req.file.filename}` : null,
      attachmentName: req.file ? req.file.originalname : null,
      attachmentType: req.file ? req.file.mimetype : null
    },
    include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } }
  });

  await notify([recipient.id], {
    type: 'MESSAGE',
    title: `رسالة جديدة من ${req.user.firstName} ${req.user.lastName}`,
    body: message.subject || message.body.slice(0, 120),
    link: '/messages'
  });

  sendToUser(recipient.id, { type: 'message:new', message });
  await broadcastUnread(recipient.id);

  res.status(201).json(message);
}));

/**
 * @swagger
 * /api/messages/archive:
 *   get:
 *     summary: أرشيف الرسائل (المدير العام فقط)
 *     tags: [messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: الأرشيف
 *       403:
 *         description: صلاحية غير كافية
 */
router.get('/archive', validateQuery(archiveQuerySchema), asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    throw new ApiError(403, 'الأرشيف متاح للمدير العام فقط');
  }
  const q = (req.query.q || '').toString().trim();
  const messages = await prisma.message.findMany({
    where: q
      ? {
          OR: [
            { subject: { contains: q, mode: 'insensitive' } },
            { body: { contains: q, mode: 'insensitive' } }
          ]
        }
      : undefined,
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, role: true } },
      recipient: { select: { id: true, firstName: true, lastName: true, role: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const convMap = new Map();
  for (const m of messages) {
    const key = [m.senderId, m.recipientId].sort((a, b) => a - b).join('-');
    if (!convMap.has(key)) {
      convMap.set(key, {
        key,
        users: [
          { id: m.sender.id, firstName: m.sender.firstName, lastName: m.sender.lastName, role: m.sender.role },
          { id: m.recipient.id, firstName: m.recipient.firstName, lastName: m.recipient.lastName, role: m.recipient.role }
        ],
        messages: [],
        lastMessage: m
      });
    }
    convMap.get(key).messages.push(m);
  }
  res.json(Array.from(convMap.values()).map((c) => ({ ...c, messages: c.messages.reverse(), count: c.messages.length })));
}));

/**
 * @swagger
 * /api/messages/archive/conversation:
 *   get:
 *     summary: محادثة كاملة بين مستخدمين (المدير العام فقط)
 *     tags: [messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userA
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: userB
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: الرسائل
 *       400:
 *         description: معرفان مطلوبان
 *       403:
 *         description: صلاحية غير كافية
 */
router.get('/archive/conversation', validateQuery(archiveConversationQuerySchema), asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    throw new ApiError(403, 'الأرشيف متاح للمدير العام فقط');
  }
  const userA = Number(req.query.userA);
  const userB = Number(req.query.userB);
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userA, recipientId: userB },
        { senderId: userB, recipientId: userA }
      ]
    },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, role: true } },
      recipient: { select: { id: true, firstName: true, lastName: true, role: true } }
    },
    orderBy: { createdAt: 'asc' }
  });
  res.json(messages);
}));

/**
 * @swagger
 * /api/messages/teachers:
 *   get:
 *     summary: قائمة الأساتذة
 *     tags: [messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الأساتذة
 */
router.get('/teachers', asyncHandler(async (req, res) => {
  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    select: { id: true, firstName: true, lastName: true, email: true }
  });
  res.json(teachers);
}));

/**
 * @swagger
 * /api/messages/teacher/students:
 *   get:
 *     summary: قائمة تواصل أقسام الأستاذ (تلاميذ وأولياء)
 *     tags: [messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة جهات الاتصال
 *       403:
 *         description: صلاحية غير كافية
 */
router.get('/teacher/students', asyncHandler(async (req, res) => {
  if (!['TEACHER', 'ADMIN', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role)) {
    throw new ApiError(403, 'صلاحية غير كافية');
  }
  const classes = await prisma.class.findMany({
    where: { teacherId: req.user.id },
    include: {
      students: {
        include: {
          account: { select: { id: true, firstName: true, lastName: true, email: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      }
    }
  });
  const contacts = [];
  for (const c of classes) {
    for (const s of c.students) {
      const account = s.account;
      const parent = s.user;
      if (account) contacts.push({ id: account.id, name: `${account.firstName} ${account.lastName}`, type: 'STUDENT', className: c.name, email: account.email });
      if (parent) contacts.push({ id: parent.id, name: `${parent.firstName} ${parent.lastName}`, type: 'PARENT', className: c.name, email: parent.email });
    }
  }
  res.json(contacts);
}));

export default router;
