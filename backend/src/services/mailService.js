// خدمة البريد الإلكتروني — SMTP من متغيرات البيئة، وفي التطوير (بلا SMTP)
// تُكتب الرسائل في backend/tmp-mail.log حتى تعمل كل الميزات دون خادم بريد.
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

const MAIL_LOG = path.join(process.cwd(), 'tmp-mail.log');

let transporter = null;
if (config.smtp?.host && config.smtp?.user) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass }
  });
}

async function deliver({ to, subject, html }) {
  if (transporter) {
    await transporter.sendMail({ from: config.smtp.from, to, subject, html });
    return { delivered: 'smtp' };
  }
  // وضع التطوير: سجل محلي
  const entry = `\n===== ${new Date().toISOString()} =====\nTO: ${to}\nSUBJECT: ${subject}\n${html}\n`;
  fs.appendFileSync(MAIL_LOG, entry);
  return { delivered: 'log' };
}

function wrapHtml(title, bodyHtml) {
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><body style="font-family:Segoe UI,Tahoma,Arial;background:#f6f8fc;padding:24px">
<div style="max-width:520px;margin:auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e3e8f2">
<div style="background:#3b6fd4;color:#fff;padding:18px 24px;font-size:20px;font-weight:700">رفيقي — منصة التعلم</div>
<div style="padding:24px"><h2 style="margin:0 0 12px;color:#223">${title}</h2>${bodyHtml}</div>
<div style="padding:14px 24px;background:#f0f3fa;color:#889;font-size:12px">رسالة آلية — إن لم تطلبها فتجاهلها بأمان.</div>
</div></body></html>`;
}

export async function sendPasswordResetEmail(to, name, resetUrl) {
  const html = wrapHtml('استعادة كلمة المرور',
    `<p>مرحباً ${name}،</p>
     <p>تلقينا طلباً لإعادة تعيين كلمة مرورك. اضغط الزر أدناه (الرابط صالح لمدة ساعة واحدة):</p>
     <p style="text-align:center;margin:22px 0"><a href="${resetUrl}" style="background:#3b6fd4;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700">إعادة تعيين كلمة المرور</a></p>
     <p style="color:#667;font-size:13px">إن لم يعمل الزر انسخ الرابط التالي:<br><code>${resetUrl}</code></p>`);
  return deliver({ to, subject: 'استعادة كلمة المرور — رفيقي', html });
}

export async function sendVerificationEmail(to, name, verifyUrl) {
  const html = wrapHtml('تأكيد البريد الإلكتروني',
    `<p>مرحباً ${name}،</p>
     <p>خطوة أخيرة لتأكيد بريدك الإلكتروني والاستفادة الكاملة من المنصة:</p>
     <p style="text-align:center;margin:22px 0"><a href="${verifyUrl}" style="background:#2e9e5b;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700">تأكيد البريد الإلكتروني</a></p>`);
  return deliver({ to, subject: 'تأكيد البريد الإلكتروني — رفيقي', html });
}