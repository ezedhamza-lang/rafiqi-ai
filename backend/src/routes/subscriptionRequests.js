import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { config } from '../config.js';
import { notify } from '../services/notify.js';
import { currentSchoolYear } from '../services/schoolYear.js';
import { validateBody } from '../middleware/validate.js';
import { subscriptionRequestSchema } from '../validators/subscription.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(authMiddleware);

// ===== «الوضع المفتوح» المؤقت (2026-11) =====
// في الوضع المفتوح: طلب «تسجيل ابني» يُنفَّذ فورًا — يُنشأ التلميذ وحسابه
// بحالة ACTIVE مع بيانات دخول مؤقتة، بلا انتظار موافقة المدير ولا الدفع.
// خارج الوضع المفتوح: المسار القديم كما هو (طلب ⇒ موافقة ⇒ دفع).
// ملاحظة: لا اشتراك ولا فاتورة في الوضع المفتوح (الإيراد صفر مؤقتًا).
async function provisionChildImmediately(request, parent) {
  // القسم: أول قسم نشط في مدرسة الولي يطابق المستوى، وإلا أول قسم بلا أستاذ.
  const classes = await prisma.class.findMany({
    where: { ...(parent.schoolId != null ? { schoolId: parent.schoolId } : {}) },
    select: { id: true, name: true, level: true, teacherId: true, schoolId: true },
    orderBy: { name: 'asc' }
  });
  const klass =
    classes.find((c) => c.level === request.level) ||
    classes.find((c) => c.teacherId == null) ||
    classes[0] ||
    null;

  // بريد مؤقّت للتلميذ (كما في مسار المدير) + كلمة سر مؤقتة من 6 أرقام.
  const temporaryPassword = String(100000 + crypto.randomInt(0, 900000));
  let studentEmail = `t${Date.now().toString(36)}@refeeqi.tn`;
  for (let i = 0; i < 8; i++) {
    const candidate = `t${crypto.randomBytes(3).toString('hex')}@refeeqi.tn`;
    const taken = await prisma.user.findUnique({ where: { email: candidate } });
    if (!taken) { studentEmail = candidate; break; }
  }

  const { student } = await prisma.$transaction(async (tx) => {
    const account = await tx.user.create({
      data: {
        firstName: request.firstName,
        lastName: request.lastName,
        email: studentEmail,
        passwordHash: await bcrypt.hash(temporaryPassword, 10),
        role: 'STUDENT',
        accountStatus: 'ACTIVE',
        schoolId: klass?.schoolId ?? parent.schoolId ?? null
      }
    });
    const student = await tx.student.create({
      data: {
        userId: parent.id,
        accountUserId: account.id,
        classId: klass?.id ?? null,
        firstName: request.firstName,
        lastName: request.lastName,
        birthDate: new Date(request.birthDate),
        cin: request.cin || null,
        gender: request.gender || null,
        level: request.level,
        schoolYear: request.schoolYear,
        schoolName: request.schoolName || null,
        tempPassword: temporaryPassword,
        credentialsIssuedAt: new Date()
      }
    });
    return { student };
  });

  const updated = await prisma.subscriptionRequest.update({
    where: { id: request.id },
    data: { status: 'ACTIVE', studentId: student.id, classId: klass?.id ?? null },
    include: {
      class: { select: { id: true, name: true, level: true } },
      parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }
    }
  });

  return { updated, credentials: { email: studentEmail, password: temporaryPassword } };
}

/**
 * @swagger
 * /api/subscription-requests/mine:
 *   get:
 *     summary: طلبات الولي
 *     tags: [subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الطلبات
 */
router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const requests = await prisma.subscriptionRequest.findMany({
      where: { parentId: req.user.id },
      include: {
        class: { select: { id: true, name: true, level: true } },
        parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  })
);

/**
 * @swagger
 * /api/subscription-requests:
 *   post:
 *     summary: تقديم طلب إضافة تلميذ (الولي)
 *     tags: [subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, birthDate, level]
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               birthDate: { type: string, format: date, description: "YYYY-MM-DD" }
 *               cin: { type: string }
 *               gender: { type: string }
 *               level: { type: string }
 *               schoolYear: { type: string }
 *               schoolName: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: تم إنشاء الطلب
 *       400:
 *         description: فشل التحقق
 */
router.post(
  '/',
  requireRole('PARENT', 'TEACHER'),
  validateBody(subscriptionRequestSchema),
  asyncHandler(async (req, res) => {
    const { firstName, lastName, birthDate, cin, gender, level, schoolYear, schoolName, notes } = req.body;
    const finalYear = schoolYear || currentSchoolYear();

    // منع التكرار: طلب معلّق مماثل لنفس الابن من نفس الولي ⇒ نعيد الموجود بدل إنشاء مكرر.
    // في الوضع المفتوح يُحسب أيضًا الطلب المنفَّذ (ACTIVE) منعًا لتكرار الطفل.
    const includeReq = {
      class: { select: { id: true, name: true, level: true } },
      parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }
    };
    const dedupeStatuses = config.openMode
      ? ['PENDING_APPROVAL', 'PENDING_PAYMENT', 'ACTIVE']
      : ['PENDING_APPROVAL', 'PENDING_PAYMENT'];
    const existing = await prisma.subscriptionRequest.findFirst({
      where: {
        parentId: req.user.id,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        level,
        schoolYear: finalYear,
        status: { in: dedupeStatuses }
      },
      include: includeReq
    });
    if (existing) return res.status(200).json({ ...existing, _deduped: true });

    const request = await prisma.subscriptionRequest.create({
      data: {
        parentId: req.user.id,
        firstName,
        lastName,
        birthDate: new Date(birthDate),
        cin: cin || null,
        gender: gender || null,
        level,
        schoolYear: finalYear,
        schoolName: schoolName || null,
        notes: notes || null
      },
      include: {
        class: { select: { id: true, name: true, level: true } },
        parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }
      }
    });

    // توجيه التنبيه: إذا كان للولي مدرسة → مديرو مدرسته + الإدارة؛ 
    // وإلا (ولي بلا مدرسة بعد) → كل مديري المدارس + الإدارة ليُسنَد لهم
    const parentSchoolId = req.user?.schoolId ?? null;
    const directors = await prisma.user.findMany({
      where: { role: 'SCHOOL_DIRECTOR', ...(parentSchoolId != null ? { schoolId: parentSchoolId } : {}) },
      select: { id: true }
    });
    const managers = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } }, select: { id: true, role: true } });
    // الاعتماد على الطلب من صلاحيات مدير المدرسة فقط ⇒ الإداري يصلح رابطه /director/requests
    // أما مدير النظام فلا توجد له شاشة اعتماد، فالرابط يقوده إلى فضائه بدل رابط ميّت.
    const actionIds = [...new Set([...directors.map((d) => d.id), ...managers.filter((m) => m.role === 'ADMIN').map((m) => m.id)])];
    const ownerIds = managers.filter((m) => m.role === 'SUPER_ADMIN').map((m) => m.id);
    const notification = {
      type: 'SUBSCRIPTION_REQUEST',
      title: 'طلب إضافة تلميذ جديد',
      body: `${firstName} ${lastName} (${level}) ينتظر المصادقة من طرف الولي`
    };
    if (actionIds.length) {
      await notify(actionIds, { ...notification, link: '/director/requests' });
    }
    if (ownerIds.length) {
      await notify(ownerIds, { ...notification, link: '/superadmin' });
    }

    // ===== «الوضع المفتوح» المؤقت: تنفيذ فوري بلا موافقة ولا دفع =====
    if (config.openMode) {
      const { updated, credentials } = await provisionChildImmediately(request, req.user);
      res.status(201).json({
        ...updated,
        _openMode: true,
        _credentials: credentials
      });
      return;
    }

    res.status(201).json(request);
  })
);

/**
 * @swagger
 * /api/subscription-requests/{id}/cancel:
 *   put:
 *     summary: إلغاء طلب معلق
 *     tags: [subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: تم الإلغاء
 *       404:
 *         description: الطلب غير موجود
 */
router.put(
  '/:id/cancel',
  requireRole('PARENT', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const request = await prisma.subscriptionRequest.findUnique({ where: { id: Number(req.params.id) } });
    if (!request || request.parentId !== req.user.id) {
      throw new ApiError(404, 'الطلب غير موجود');
    }
    if (request.status !== 'PENDING_APPROVAL') {
      throw new ApiError(400, 'لا يمكن إلغاء طلب تمت معالجته');
    }
    const updated = await prisma.subscriptionRequest.update({
      where: { id: request.id },
      data: { status: 'CANCELLED', rejectionReason: 'أُلغي الطلب من طرف الولي' }
    });
    res.json(updated);
  })
);

export default router;
