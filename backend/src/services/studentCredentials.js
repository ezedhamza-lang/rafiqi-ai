// إصدار بيانات دخول التلميذ — المسار الوحيد (المرحلة C).
//
// لماذا خدمة مستقلة بدل منطق داخل المسار؟ لأن إصدار البطاقات يجب أن يسلك
// نفس القواعد في كل مكان: من صفحة المدير، ومن سطر أوامر الإدارة (المرحلة E)،
// ومن سكربت provisioning. الاختبارات تثبت السلوك هنا لا في كل مستهلك.
//
// القواعد:
//  • كلمة السر لا تُخزَّن إلا مُعمّاة (bcrypt) + نسخة «مؤقتة» إن طُلب ذلك.
//  • issuing permanently ⇒ tempPassword=null (لا إجبار على التغيير ⇒ البطاقة تبقى صالحة).
//  • issuing مؤقت ⇒ tempPassword=password (إجبار التغيير عند أول دخول — مشتق في auth.js).
//  • credentialsIssuedAt يُضبط دائمًا ⇒ الإقلاع لا يلمس هذا الحساب (tenancyBootstrap).
//  • كلمة السر لا تُعاد في أي قراءة (GET) — تُعاد مرة واحدة عند الإصدار فقط.
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { ApiError } from '../middleware/errorHandler.js';

export const CARD_MODES = ['card', 'temporary'];

const MIN_LEN = 6;
const MAX_LEN = 64;

/** كلمة سر سهلة من 6 أرقام (يكتبها التلميذ/وليّه بسهولة). */
export function generateEasyPassword() {
  return String(100000 + crypto.randomInt(0, 900000));
}

/**
 * يتحقق من قوة/طول كلمة السر ويعيدها كما هي (بلا اقتطاع صامت).
 * يرمي ApiError برسالة عربية عند الفشل.
 */
export function assertUsablePassword(password, { email } = {}) {
  const raw = String(password ?? '');
  if (raw.length < MIN_LEN) throw new ApiError(400, `كلمة السر قصيرة جدا (${MIN_LEN} أحرف على الأقل)`);
  if (raw.length > MAX_LEN) throw new ApiError(400, `كلمة السر طويلة جدا (${MAX_LEN} حرفا على الأكثر)`);
  if (/\s/.test(raw)) throw new ApiError(400, 'كلمة السر لا يجب أن تحتوي فراغات');
  if (email && raw.toLowerCase() === String(email).trim().toLowerCase()) {
    throw new ApiError(400, 'كلمة السر لا يمكن أن تكون نفس البريد الإلكتروني');
  }
  return raw;
}

/** كلمة السر تُولَّد إن لم يمرّرها المدير، وتُتحقق دائمًا. */
export function resolvePassword(input, { email } = {}) {
  const provided = String(input ?? '').trim();
  const chosen = provided || generateEasyPassword();
  return assertUsablePassword(chosen, { email });
}

/**
 * يكتب بيانات الدخول على حساب التلميذ ويعيد «البطاقة» (بنص صريح، مرة واحدة).
 * @param {object} tx Prisma client أو transaction
 * @param {{ studentId:number, accountId:number, email:string, firstName:string, lastName:string, className?:string|null, level?:string|null, schoolYear?:string|null }} target
 * @param {{ password?:string, mode?:'card'|'temporary' }} options
 */
export async function issueStudentCredentials(tx, target, { password, mode = 'card' } = {}) {
  if (!CARD_MODES.includes(mode)) throw new ApiError(400, 'نوع البطاقة غير معروف');
  const plain = resolvePassword(password, { email: target.email });
  const passwordHash = await bcrypt.hash(plain, 10);
  const issuedAt = new Date();

  // لا نلمس accountStatus إطلاقًا: بوابة الدفع/التفعيل (auth.js) تبقى كما هي.
  // إصدار بيانات دخول ليس تنشيطًا — تفعيل الاشتراك قرار مالي منفصل.
  await tx.user.update({
    where: { id: target.accountId },
    data: { passwordHash }
  });
  await tx.student.update({
    where: { id: target.studentId },
    data: {
      tempPassword: mode === 'temporary' ? plain : null,
      credentialsIssuedAt: issuedAt
    }
  });

  return {
    studentId: target.studentId,
    firstName: target.firstName,
    lastName: target.lastName,
    email: target.email,
    password: plain,
    mode,
    mustChangePassword: mode === 'temporary',
    issuedAt: issuedAt.toISOString(),
    className: target.className ?? null,
    level: target.level ?? null,
    schoolYear: target.schoolYear ?? null
  };
}

/** الشكل الآمن للقوائم: لا كلمة سر ولا hash ولا tempPassword. */
export function safeStudentRow(student) {
  return {
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.account?.email ?? null,
    level: student.level,
    schoolYear: student.schoolYear,
    accountStatus: student.account?.accountStatus ?? null,
    hasPassword: Boolean(student.account?.passwordHash),
    needsChange: Boolean(student.tempPassword),
    credentialsIssuedAt: student.credentialsIssuedAt ?? null,
    lastActiveAt: student.account?.lastActiveAt ?? null
  };
}
