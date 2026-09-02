// عزل البيانات بين المدارس — وحدة العزل الأساسية للمنصة متعددة المدارس.
// القاعدة: SUPER_ADMIN بلا مدرسة يرى الشبكة كلها؛ بقية الأدوار محصورة
// بمدرستهم عبر schoolId القادم من التوكن (أو قاعدة البيانات احتياطاً).
import prisma from '../db.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * يعيد schoolId الخاص بالطلب:
 * - SUPER_ADMIN: null (يرى الكل) إلا إذا مرّر ?schoolId صراحةً
 * - بقية الأدوار: مدرستهم حصراً
 */
export function resolveSchoolId(req) {
  const tokenSchool = req.user?.schoolId ?? null;
  if (tokenSchool != null) return tokenSchool;
  if (req.user?.role === 'SUPER_ADMIN') {
    const q = Number(req.query?.schoolId);
    return Number.isFinite(q) && q > 0 ? q : null;
  }
  return null;
}

/** شرط where جاهز للاستعلامات على جدول يحمل schoolId مباشرة (User/Class) */
export function schoolWhere(req, extra = {}) {
  const schoolId = resolveSchoolId(req);
  return schoolId == null ? extra : { ...extra, schoolId };
}

/**
 * شرط where للاستعلامات غير الحاملة schoolId مباشرة — يمرّ عبر علاقة.
 * مثال: scopedVia(req, 'class', { status: 'PENDING' })
 *   => { ...extra, class: { schoolId } }
 */
export function scopedVia(req, relation, extra = {}) {
  const schoolId = resolveSchoolId(req);
  if (schoolId == null) return extra;
  const rel = extra[relation] || {};
  return { ...extra, [relation]: { ...rel, schoolId } };
}

/** يضمن أن المستخدم ينتمي لمدرسة (يُستعمل في مسارات الإدارة المدرسية) */
export function requireSchoolContext(req) {
  const schoolId = resolveSchoolId(req);
  if (schoolId == null) {
    throw new ApiError(400, 'هذا الإجراء يتطلب سياق مدرسة محددة.');
  }
  return schoolId;
}

/** إحصاءات مدرسة واحدة (تُستعمل في لوحة الشبكة) */
export async function schoolStats(schoolId) {
  const [users, classes, students] = await Promise.all([
    prisma.user.count({ where: { schoolId } }),
    prisma.class.count({ where: { schoolId } }),
    prisma.student.count({ where: { class: { schoolId } } })
  ]);
  return { users, classes, students };
}