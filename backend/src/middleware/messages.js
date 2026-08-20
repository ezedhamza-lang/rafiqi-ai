export const AR = {
  UNAUTHORIZED: 'غير مصرح به',
  SESSION_EXPIRED: 'انتهت الجلسة، يرجى تسجيل الدخول مجددا',
  FORBIDDEN: 'صلاحية غير كافية',
  NOT_FOUND: 'المورد غير موجود',
  INTERNAL: 'خطأ في الخادم، يرجى المحاولة لاحقا',
  BAD_REQUEST: 'طلب غير صالح',
  VALIDATION_FAILED: 'يرجى التحقق من البيانات المدخلة',
  RATE_LIMITED: 'طلبات كثيرة جدا، يرجى المحاولة لاحقا',
  EMAIL_TAKEN: 'البريد الإلكتروني مسجل بالفعل',
  INVALID_CREDENTIALS: 'بيانات الدخول غير صحيحة',
  USER_NOT_FOUND: 'المستخدم غير موجود',
  MISSING_FIELDS: 'جميع الحقول المطلوبة يجب تعميرها',
  PASSWORD_TOO_SHORT: 'كلمة السر يجب أن تحتوي على 6 أحرف على الأقل',
  MISSING_AUTH: 'البريد الإلكتروني وكلمة السر مطلوبان'
};

export function fieldError(field) {
  return `حقل «${field}» مطلوب`;
}
