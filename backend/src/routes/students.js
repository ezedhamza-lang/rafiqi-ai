import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { actorSchoolId } from '../tenant.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { studentUpdateSchema } from '../validators/student.js';
import { idParamSchema } from '../validators/common.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(authMiddleware);

const accountInclude = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  accountStatus: true
};

const subscriptionsInclude = {
  select: { id: true, plan: true, status: true, amount: true, schoolYear: true }
};

function includeForRole(role, asParent) {
  const include = {
    class: { select: { id: true, name: true, level: true } },
    // نسخة مبنية (لا الكائن المشترك) حتى لا ينتقل حقل subscriptions إلى أدوار أخرى بالخطأ
    account: { select: { ...accountInclude } }
  };
  if (asParent || ['ADMIN', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN'].includes(role)) {
    include.account.select.subscriptions = subscriptionsInclude;
  }
  return include;
}

/**
 * @swagger
 * /api/students:
 *   get:
 *     summary: قائمة التلاميذ حسب الدور
 *     tags: [students]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة التلاميذ
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const role = req.user.role;
    let where = {};
    // حساب دورين (معلّم له أبناء مرتبطون مثل حساب إيمان) ⇒ يُعرض أبناءه بصفة وليّ،
    // وإلا (المعلّم بلا أبناء) تلاميذ صفوفه كسابق فيعود سلوك الأستاذ دون تغيير.
    let asParent = role === 'PARENT';
    if (role === 'TEACHER') {
      const linkedChildren = await prisma.student.count({ where: { userId: req.user.id } });
      asParent = linkedChildren > 0;
    }
    if (asParent) {
      where = { userId: req.user.id };
    } else if (role === 'TEACHER') {
      where = { class: { teacherId: req.user.id } };
    } else if (role === 'STUDENT') {
      where = { accountUserId: req.user.id };
    } else {
      const sid = actorSchoolId(req);
      where = sid != null ? { account: { schoolId: sid } } : {};
    }
    const students = await prisma.student.findMany({
      where,
      include: includeForRole(role, asParent),
      orderBy: { createdAt: 'desc' }
    });
    res.json(students);
  })
);

router.post(
  '/',
  requireRole('PARENT', 'TEACHER'),
  asyncHandler(async (_req, res) => {
    res.status(403).json({
      error: 'إضافة تلميذ جديد تتم عبر طلب تسجيل جديد يقع عرضه على مدير المدرسة للمصادقة'
    });
  })
);

/**
 * @swagger
 * /api/students/{id}:
 *   put:
 *     summary: تعديل بيانات تلميذ (الولي)
 *     tags: [students]
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
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               birthDate: { type: string, format: date }
 *               cin: { type: string }
 *               gender: { type: string }
 *               level: { type: string }
 *               schoolYear: { type: string }
 *               schoolName: { type: string }
 *     responses:
 *       200:
 *         description: تم التعديل
 *       404:
 *         description: التلميذ غير موجود
 */
router.put(
  '/:id',
  requireRole('PARENT', 'TEACHER'),
  validateParams(idParamSchema),
  validateBody(studentUpdateSchema),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student || student.userId !== req.user.id) {
      throw new ApiError(404, 'التلميذ غير موجود');
    }
    const { firstName, lastName, birthDate, cin, gender, level, schoolYear, schoolName } = req.body;
    const updated = await prisma.student.update({
      where: { id: student.id },
      data: {
        firstName: firstName !== undefined ? String(firstName).trim() : undefined,
        lastName: lastName !== undefined ? String(lastName).trim() : undefined,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        cin: cin !== undefined ? (cin ? String(cin).trim() : null) : undefined,
        gender: gender !== undefined ? gender : undefined,
        level: level !== undefined ? String(level) : undefined,
        schoolYear: schoolYear !== undefined ? String(schoolYear) : undefined,
        schoolName: schoolName !== undefined ? schoolName : undefined
      }
    });
    res.json(updated);
  })
);

/**
 * @swagger
 * /api/students/{id}:
 *   delete:
 *     summary: حذف تلميذ (الولي)
 *     tags: [students]
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
 *       404:
 *         description: التلميذ غير موجود
 */
router.delete(
  '/:id',
  requireRole('PARENT', 'TEACHER'),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student || student.userId !== req.user.id) {
      throw new ApiError(404, 'التلميذ غير موجود');
    }
    await prisma.student.delete({ where: { id: student.id } });
    res.json({ success: true });
  })
);

export default router;
