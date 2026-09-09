// أدوات عزل المدارس (Multi-tenancy).

// هل يجب تقييد هذا الممثل بمدرسة؟ المشرف العام (SUPER_ADMIN) بلا schoolId يرى كل شيء.
export function hasSchoolScope(user) {
  return user && user.schoolId != null;
}

// معرّف مدرسة الممثل الحالي (null للمشرف العام).
export function actorSchoolId(req) {
  return req.user?.schoolId ?? null;
}

// لقيادة تسجيل ولي لم تُسنَد لمدرسة بعد (schoolId=null) — يراها المدير ليُعطي عليها
// بالإضافة إلى طلبات مدرسته. للمشرف العام (sid=null) لا قيد.
export function leadParentFilter(req) {
  const sid = req.user?.schoolId;
  if (sid == null) return {};
  return { OR: [{ schoolId: sid }, { schoolId: null }] };
}

// مقيد Prisma يفرض schoolId على استعلامات الجداول التي تحمل schoolId مباشرة (User/Class).
// يرجّع {} للمشرف العام (بدون تقييد).
export function schoolScope(req) {
  if (hasSchoolScope(req.user)) return { schoolId: req.user.schoolId };
  return {};
}

// مقيد عبر العلاقة: كيان مرتبط بقسم (class) أو بمستخدم (account/teacher/…) له مدرسة.
// usage: where: { ...classSchoolScope(req) } على جدول فيه relation اسمها class/user.
export function classSchoolScope(req, relation = 'class') {
  if (hasSchoolScope(req.user)) return { [relation]: { schoolId: req.user.schoolId } };
  return {};
}

// تحقق أن كياناً معيّن ينتمي لمدرسة الممثل (للمشرف العام: صحيح دائماً).
export function belongsToSchool(user, entity) {
  if (!hasSchoolScope(user)) return true;
  return entity && entity.schoolId === user.schoolId;
}
