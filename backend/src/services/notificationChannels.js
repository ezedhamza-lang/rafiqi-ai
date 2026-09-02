import { logger } from '../utils/logger.js';

export const EMAIL_PROVIDER = (process.env.NOTIFICATION_EMAIL_PROVIDER || 'DEMO').toUpperCase();
export const SMS_PROVIDER = (process.env.NOTIFICATION_SMS_PROVIDER || 'DEMO').toUpperCase();

export function emailChannelEnabled() {
  return EMAIL_PROVIDER !== 'NONE';
}

export function smsChannelEnabled() {
  return SMS_PROVIDER !== 'NONE';
}

export async function deliverEmail({ to, subject, body }) {
  if (EMAIL_PROVIDER === 'SMTP') {
    return sendViaSmtp({ to, subject, body });
  }
  if (process.env.NODE_ENV !== 'test') {
    logger.info({ to, subject, bodyPreview: (body || '').slice(0, 160) }, '[DEMO-EMAIL]');
  }
  return { ok: true, provider: 'DEMO' };
}

async function sendViaSmtp({ to, subject, body }) {
  try {
    const nodemailer = (await import('nodemailer')).default;
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM || 'rafiqi@education.tn',
      to,
      subject,
      text: body
    });
    return { ok: true, provider: 'SMTP' };
  } catch (err) {
    return { ok: false, provider: 'SMTP', error: err.message };
  }
}

export async function deliverSms({ to, body }) {
  if (SMS_PROVIDER !== 'DEMO') {
    return { ok: false, provider: SMS_PROVIDER, error: 'مزوّد SMS غير مدعوم حاليا' };
  }
  if (process.env.NODE_ENV !== 'test') {
    logger.info({ to, bodyPreview: (body || '').slice(0, 160) }, '[DEMO-SMS]');
  }
  return { ok: true, provider: 'DEMO' };
}
