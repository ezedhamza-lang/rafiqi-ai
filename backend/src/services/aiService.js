import crypto from 'crypto';
import prisma from '../db.js';
import { getLessonPages, normalizeArabic } from './curriculumService.js';
import { PROMPTS } from '../prompts/aiPrompts.js';

const ENC_KEY =
  process.env.AI_ENC_KEY ||
  crypto.createHash('sha256').update(process.env.JWT_SECRET || '').digest('hex').slice(0, 64);

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENC_KEY, 'hex'), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':');
}

function decrypt(payload) {
  const [iv, tag, enc] = payload.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENC_KEY, 'hex'), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(enc, 'hex')), decipher.final()]).toString('utf8');
}

export async function saveAiKey(teacherId, apiKey) {
  const keyEncrypted = encrypt(apiKey);
  return prisma.aiKey.upsert({
    where: { teacherId },
    update: { keyEncrypted, provider: 'gemini', updatedAt: new Date() },
    create: { teacherId, keyEncrypted, provider: 'gemini' }
  });
}

export async function deleteAiKey(teacherId) {
  await prisma.aiKey.deleteMany({ where: { teacherId } });
}

export function hasAiKey(teacherId) {
  return prisma.aiKey.findUnique({ where: { teacherId } });
}

// ===== مفتاح المنصة (المرحلة 7.3 — واجهة إدارية) =====

const PLATFORM_AI_KEY = 'ai_provider_key';

export async function getPlatformAiKey() {
  const row = await prisma.systemSetting.findUnique({ where: { key: PLATFORM_AI_KEY } });
  if (!row) return null;
  try {
    return decrypt(row.value);
  } catch {
    return null;
  }
}

export async function savePlatformAiKey(adminId, apiKey) {
  await prisma.systemSetting.upsert({
    where: { key: PLATFORM_AI_KEY },
    update: { value: encrypt(apiKey), updatedBy: adminId, updatedAt: new Date() },
    create: { key: PLATFORM_AI_KEY, value: encrypt(apiKey), updatedBy: adminId }
  });
}

export async function deletePlatformAiKey() {
  await prisma.systemSetting.deleteMany({ where: { key: PLATFORM_AI_KEY } });
}

// ترتيب التفعيل: مفتاح المعلّم → مفتاح المنصة → متغير البيئة
async function resolveApiKey(teacherId) {
  if (teacherId) {
    const row = await prisma.aiKey.findUnique({ where: { teacherId } });
    if (row) {
      try {
        return decrypt(row.keyEncrypted);
      } catch {
        /* المفتاح التالف يتجاوز للمستوى التالي */
      }
    }
  }
  const platform = await getPlatformAiKey();
  if (platform) return platform;
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  return null;
}

async function callGemini(prompt, apiKey) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
  const res = await fetch(`${url}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
    })
  });
  if (!res.ok) {
    await res.text();
    throw new Error(`AI service error: ${res.status}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Injectable provider (used by tests to avoid real network calls).
let callProvider = callGemini;
export function __setCallProvider(fn) {
  callProvider = fn;
}
export function __resetCallProvider() {
  callProvider = callGemini;
}

function buildPrompt(system, user) {
  return `${system}\n\nالمستخدم:\n${user}\n\nيرجى الرد مباشرة بدون مقدمات.`;
}

export async function generateText(teacherId, system, user) {
  const apiKey = await resolveApiKey(teacherId);
  if (!apiKey) {
    throw new Error('NO_AI_KEY');
  }
  return callProvider(buildPrompt(system, user), apiKey);
}

export async function generateQuizQuestions(teacherId, { subject, level, lessonTitle, count = 5 }) {
  const system = PROMPTS.quiz.system;
  const user = PROMPTS.quiz.user({ subject, level, lessonTitle, count });
  const text = await generateText(teacherId, system, user);
  try {
    const match = text.match(/\[[\s\S]*\]/);
    return JSON.parse(match ? match[0] : text);
  } catch {
    return null;
  }
}

export async function generateStory(teacherId, { level, theme, words = 100 }) {
  return generateText(teacherId, PROMPTS.story.system, PROMPTS.story.user({ level, theme, words }));
}

export async function gradeShortAnswer(teacherId, { question, modelAnswer, studentAnswer }) {
  return generateText(teacherId, PROMPTS.gradeShort.system, PROMPTS.gradeShort.user({ question, modelAnswer, studentAnswer }));
}

export async function gradeSuggestion(teacherId, { question, studentAnswer }) {
  return generateText(teacherId, PROMPTS.gradeSuggestion.system, PROMPTS.gradeSuggestion.user({ question, studentAnswer }));
}

export async function reviewQuality(teacherId, { content, type }) {
  return generateText(teacherId, PROMPTS.review.system, PROMPTS.review.user({ content, type }));
}

export async function chatRefeeqi(studentId, teacherId, userMessage, studentName) {
  return generateText(teacherId, PROMPTS.refeeqi.system(studentName), userMessage);
}

// ===== المرحلة 7.1 — ربط رفيقي بمحتوى المنهج (المرحلة 6) =====

function lessonTextOf(page, limit = 1400) {
  if (!page) return '';
  const parts = [];
  if (page.title) parts.push(`الدرس: ${page.title}`);
  for (const b of page.blocks || []) {
    const label = b.title ? `${b.title}: ` : '';
    let text = b.text || '';
    if (Array.isArray(b.points)) text += (text ? ' ' : '') + b.points.join('؛ ');
    if (Array.isArray(b.materials)) text += (text ? ' ' : '') + `الأدوات: ${b.materials.join('، ')}`;
    if (Array.isArray(b.steps)) text += (text ? ' ' : '') + `الخطوات: ${b.steps.join('؛ ')}`;
    if (Array.isArray(b.options)) text += (text ? ' ' : '') + `الخيارات: ${b.options.join(' / ')}`;
    if (text) parts.push(label + text);
  }
  return parts.join('\n').slice(0, limit);
}

export function resolveLessonContext({ gradeId, subjectId, lessonId, level, subject, lessonTitle }) {
  const code = String(subjectId || subject || '').toLowerCase();
  if (!code) return '';
  const pages = getLessonPages(code, level || '', gradeId);
  if (!pages.length) return '';
  let page = null;
  if (lessonId) {
    page = pages.find((p) => String(p.id) === String(lessonId));
  }
  if (!page && lessonTitle) {
    const titleNorm = normalizeArabic(lessonTitle);
    page = pages.find((p) => normalizeArabic(p.title || '').includes(titleNorm) || titleNorm.includes(normalizeArabic(p.title || '')));
  }
  if (!page) page = pages[0];
  return lessonTextOf(page);
}

export async function chatRefeeqiWithContext(studentId, teacherId, userMessage, studentName, contextText) {
  return generateText(teacherId, PROMPTS.refeeqi.systemWithContext(studentName, contextText), userMessage);
}

// ===== المرحلة 7.2 — مولّدات الأستاذ =====

function extractJson(text) {
  if (!text) return null;
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {
      /* try array */
    }
  }
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]);
    } catch {
      /* fall through */
    }
  }
  return null;
}

export async function generateLessonPlan(teacherId, { subject, level, lessonTitle, gradeId, subjectId, lessonId, duration = 45 }) {
  const context = resolveLessonContext({ gradeId, subjectId, lessonId, level, subject, lessonTitle });
  const text = await generateText(teacherId, PROMPTS.lessonPlan.system, PROMPTS.lessonPlan.user({ subject, level, lessonTitle, duration, context }));
  return extractJson(text);
}

export async function generateSummary(teacherId, { subject, level, lessonTitle, gradeId, subjectId, lessonId, maxWords = 150 }) {
  const context = resolveLessonContext({ gradeId, subjectId, lessonId, level, subject, lessonTitle });
  return generateText(teacherId, PROMPTS.summary.system, PROMPTS.summary.user({ subject, level, lessonTitle, context, maxWords }));
}

export async function generatePresentation(teacherId, { subject, level, lessonTitle, gradeId, subjectId, lessonId, slideCount = 8 }) {
  const context = resolveLessonContext({ gradeId, subjectId, lessonId, level, subject, lessonTitle });
  const text = await generateText(teacherId, PROMPTS.presentation.system, PROMPTS.presentation.user({ subject, level, lessonTitle, context, slideCount }));
  const parsed = extractJson(text);
  return Array.isArray(parsed) ? parsed : null;
}

// ===== المرحلة 7.3 — رؤى الولي (ملخص + أنشطة) فوق البيانات الحقيقية =====

export async function generateParentSummary(teacherId, contextData) {
  return generateText(teacherId, PROMPTS.parentSummary.system, PROMPTS.parentSummary.user(contextData));
}

export async function generateParentActivities(teacherId, contextData) {
  const text = await generateText(teacherId, PROMPTS.parentActivities.system, PROMPTS.parentActivities.user(contextData));
  const parsed = extractJson(text);
  return Array.isArray(parsed) ? parsed : null;
}
