import crypto from 'crypto';
import { config } from '../config.js';

const store = new Map();

function toArabicDigits(n) {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

function makeChallenge() {
  const a = 1 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * 9);
  const op = Math.random() < 0.5 ? '+' : '*';
  const answer = op === '+' ? a + b : a * b;
  const symbol = op === '+' ? '＋' : '×';
  return {
    question: `${toArabicDigits(a)} ${symbol} ${toArabicDigits(b)} = ؟`,
    answer
  };
}

function renderSvg(question) {
  const lines = Array.from({ length: 4 }, () => {
    const x1 = Math.floor(Math.random() * 60);
    const y1 = Math.floor(Math.random() * 60);
    const x2 = x1 + 90 + Math.floor(Math.random() * 80);
    const y2 = Math.floor(Math.random() * 60);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#c7d2fe" stroke-width="1"/>`;
  }).join('');
  const dots = Array.from({ length: 18 }, () => {
    const cx = Math.floor(Math.random() * 170);
    const cy = Math.floor(Math.random() * 56);
    const r = 0.5 + Math.random() * 1.2;
    return `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="#a5b4fc"/>`;
  }).join('');
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="170" height="56" viewBox="0 0 170 56" role="img" aria-label="رمز تحقق رقمي">',
    `<rect width="170" height="56" rx="10" fill="#eef2ff"/>`,
    dots,
    lines,
    `<text x="85" y="38" text-anchor="middle" font-size="26" font-family="Amiri, serif" font-weight="bold" fill="#1e3a8a" transform="rotate(-3 85 38)">${question}</text>`,
    '</svg>'
  ].join('');
}

export function createCaptcha() {
  const { question, answer } = makeChallenge();
  const token = crypto.randomBytes(18).toString('hex');
  store.set(token, {
    answer,
    expiresAt: Date.now() + config.payment.captchaTtlMs
  });
  return {
    token,
    question,
    svg: renderSvg(question),
    ...(config.payment.revealCaptchaAnswer ? { answer } : {})
  };
}

export function verifyCaptcha(token, answer) {
  if (!token || answer === undefined || answer === null || answer === '') {
    return { ok: false, error: 'يرجى حل رمز التحقق (CAPTCHA)' };
  }
  const record = store.get(token);
  if (!record) {
    return { ok: false, error: 'رمز التحقق غير صالح، يرجى إعادة تحميله' };
  }
  store.delete(token);
  if (Date.now() > record.expiresAt) {
    return { ok: false, error: 'انتهت صلاحية رمز التحقق، يرجى إعادة تحميله' };
  }
  if (Number(answer) !== record.answer) {
    return { ok: false, error: 'إجابة رمز التحقق غير صحيحة' };
  }
  return { ok: true };
}
