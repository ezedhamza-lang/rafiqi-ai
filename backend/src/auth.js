import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from './db.js';
import { AR } from './middleware/messages.js';

const JWT_SECRET = process.env.JWT_SECRET;

// مدة صلاحية رمز الوصول: 15 دقيقة — رمز قصير العمر يُجدَّد تلقائياً
// عبر رمز التجديد (refresh token) من الواجهة (تجديد صامت في client.js).
// هذا هو الإصلاح الكامل للثغرة المعلّقة سابقاً (كان 3 أيام بلا تجديد).
export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_DAYS = 7;

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, accountStatus: user.accountStatus, schoolId: user.schoolId ?? null },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

// رمز تجديد معتم (opaque): لا يُخزَّن ولا يُرسل إلا مرة واحدة؛ يُحفظ
// بصيغته المجزّأة SHA-256 فقط، ويُدوَّر عند كل استعمال (إبطال القديم
// وإصدار جديد) — أي إعادة استعمال لرمز مسروق تُفشل تلقائياً.
export function generateRefreshTokenValue() {
  return crypto.randomBytes(48).toString('hex');
}

export function hashRefreshToken(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function issueRefreshToken(userId, ttlDays = REFRESH_TOKEN_TTL_DAYS) {
  const value = generateRefreshTokenValue();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashRefreshToken(value), expiresAt }
  });
  return value;
}

// تدوير رمز التجديد: إبطال القديم وإصدار جديد — قاعدة أمان ضد السرقة
export async function rotateRefreshToken(userId, oldValue) {
  const oldHash = hashRefreshToken(oldValue);
  const old = await prisma.refreshToken.findUnique({ where: { tokenHash: oldHash } });
  if (!old || old.revokedAt || old.expiresAt < new Date()) return null;
  await prisma.refreshToken.update({
    where: { id: old.id },
    data: { revokedAt: new Date() }
  });
  const value = generateRefreshTokenValue();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashRefreshToken(value), expiresAt, replacedById: old.id }
  });
  return value;
}

export async function revokeRefreshToken(value) {
  if (!value) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(value), revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export async function revokeAllUserTokens(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

// تنظيف الرموز المنتهية (يُستدعى عند الإصدار لتفادي نمو الجدول)
export async function purgeExpiredRefreshTokens() {
  await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

export function accountStatusMessage(status) {
  switch (status) {
    case 'PENDING_APPROVAL':
    case 'PENDING_PAYMENT':
      return 'حسابك لم يُفعَّل بعد، يرجى استكمال إجراءات المصادقة والاشتراك';
    case 'SUSPENDED':
      return 'حسابك معطّل مؤقتا بسبب عدم دفع الاشتراك';
    case 'EXPIRED':
      return 'انتهت صلاحية اشتراكك، يرجى تجديد الاشتراك';
    default:
      return 'حسابك غير مفعّل';
  }
}

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: AR.UNAUTHORIZED });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // فحص حالة الحساب لكل الأدوار (وليس المشتركين فقط)، حتى لا يبقى حساب
    // موقوف/منتهي لصلاحية إدارية فعّالاً حتى انتهاء الرمز القصير.
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { accountStatus: true }
      });
      const accountStatus = user?.accountStatus || null;
      if (accountStatus !== 'ACTIVE') {
        return res.status(403).json({ error: accountStatusMessage(accountStatus) });
      }
      payload.accountStatus = accountStatus;
    } catch {
      return res.status(401).json({ error: AR.SESSION_EXPIRED });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: AR.SESSION_EXPIRED });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: AR.UNAUTHORIZED });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: AR.FORBIDDEN });
    }
    next();
  };
}

// مصادقة اختيارية لمسارات عامة (مثل نموذج المساعدة): إن وُجد توكن صالح
// NON-موقوف يُعبَّأ req.user، وإلا يُكمل مجهولاً بلا خطأ. يمنع أنتحال
// الهوية عبر إرسال userId من عميل غير مصادَق.
export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { accountStatus: true }
      });
      if (user && user.accountStatus === 'ACTIVE') req.user = payload;
    } catch {
      /* مجهول */
    }
  }
  next();
}

export const adminMiddleware = requireRole('ADMIN', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN');
export const superAdminMiddleware = requireRole('SUPER_ADMIN');
export const teacherMiddleware = requireRole('TEACHER', 'ADMIN', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN');
export const studentMiddleware = requireRole('STUDENT', 'TEACHER', 'ADMIN', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN');