import crypto from 'crypto';
import prisma from '../db.js';
import { getLessonPages, normalizeArabic } from './curriculumService.js';

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
  const system = 'أنت مدرّس تونسي خبير في التعليم الابتدائي. أنشئ أسئلة اختبار مناسبة لمستوى التلميذ باللغة العربية.';
  const user = `المادة: ${subject}\nالمستوى: ${level}\nالدرس: ${lessonTitle}\nأنجز ${count} أسئلة بصيغة JSON على الشكل:\n[{"type":"MCQ","prompt":"...","options":["أ","ب","ج"],"correctOption":"أ","points":1}] مع أنواع متنوعة (MCQ, TRUE_FALSE, FILL_BLANK). أعد JSON فقط.`;
  const text = await generateText(teacherId, system, user);
  try {
    const match = text.match(/\[[\s\S]*\]/);
    return JSON.parse(match ? match[0] : text);
  } catch {
    return null;
  }
}

export async function generateStory(teacherId, { level, theme, words = 100 }) {
  const system = 'أنت كاتب قصص أطفال تونسي. اكتب قصة قصيرة ممتعة ومناسبة للأطفال باللغة العربية الفصحى المبسطة.';
  const user = `المستوى: ${level}\nالموضوع: ${theme}\nالطول: حوالي ${words} كلمة.`;
  return generateText(teacherId, system, user);
}

export async function gradeShortAnswer(teacherId, { question, modelAnswer, studentAnswer }) {
  const system = 'أنت مصحّح. قيّم إجابة التلميذ بمقارنتها بالإجابة النموذجية. أجب بتعليق قصير جدا (لا يتجاوز 20 كلمة) ثم أعط نقطة من 10.';
  const user = `السؤال: ${question}\nالإجابة النموذجية: ${modelAnswer}\nإجابة التلميذ: ${studentAnswer}`;
  return generateText(teacherId, system, user);
}

export async function gradeSuggestion(teacherId, { question, studentAnswer }) {
  const system = 'أنت مدرّس. اقترح تصحيحا لإجابة التلميذ الخاطئة بطريقة بيداغوجية لطيفة لا تتجاوز 20 كلمة.';
  const user = `السؤال: ${question}\nإجابة التلميذ: ${studentAnswer}`;
  return generateText(teacherId, system, user);
}

export async function reviewQuality(teacherId, { content, type }) {
  const system = 'أنت خبير جودة محتوى تعليمي. راجع المحتوى وأعط تقييما مع ملاحظات موجزة.';
  const user = `النوع: ${type}\nالمحتوى:\n${content}`;
  return generateText(teacherId, system, user);
}

export async function chatRefeeqi(studentId, teacherId, userMessage, studentName) {
  const system = `أنت "رفيقي"، بومة ذكية تساعد التلميذ ${studentName} (تلميذ ابتدائي تونسي). أجب بلغة عربية مبسطة ومشجعة وبجمل قصيرة.`;
  return generateText(teacherId, system, userMessage);
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
  const system = `أنت "رفيقي"، بومة ذكية تساعد التلميذ ${studentName} (تلميذ ابتدائي تونسي). أجب بلغة عربية مبسطة ومشجعة وبجمل قصيرة، واعتمد في إجابتك على محتوى الدرس المقدّم أدناه إن كان ذا صلة بالسؤال:\n\nمحتوى الدرس:\n${contextText}\n\nأجب بالاعتماد على المحتوى المذكور فقط مع تبسيطه.`;
  return generateText(teacherId, system, userMessage);
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
  const system = 'أنت خبير بيداغوجي تونسي في التعليم الابتدائي. أنشئ خطة درس كاملة وفق البيداغوجيا التونسية.';
  const user = `المادة: ${subject}\nالمستوى: ${level}\nالدرس: ${lessonTitle}\nالمدة: ${duration} دقيقة\n${context ? `محتوى الدرس المرجعي:\n${context}\n` : ''}\nأنجز خطة درس بصيغة JSON على الشكل:\n{"title":"...","objectives":["..."],"materials":["..."],"stages":[{"time":"5 د","name":"تمهيد","goal":"...","activity":"..."}],"evaluation":"...","homework":"..."}\nأعد JSON فقط.`;
  const text = await generateText(teacherId, system, user);
  return extractJson(text);
}

export async function generateSummary(teacherId, { subject, level, lessonTitle, gradeId, subjectId, lessonId, maxWords = 150 }) {
  const context = resolveLessonContext({ gradeId, subjectId, lessonId, level, subject, lessonTitle });
  const system = 'أنت معلّم تونسي خبير. اكتب ملخصا موجزا وواضحا لدرس باللغة العربية الفصحى المبسطة.';
  const user = `المادة: ${subject}\nالمستوى: ${level}\nالدرس: ${lessonTitle}\n${context ? `محتوى الدرس المرجعي:\n${context}\n` : ''}\nاكتب ملخصا لا يتجاوز ${maxWords} كلمة يركّز على المفاهيم الأساسية.`;
  return generateText(teacherId, system, user);
}

export async function generatePresentation(teacherId, { subject, level, lessonTitle, gradeId, subjectId, lessonId, slideCount = 8 }) {
  const context = resolveLessonContext({ gradeId, subjectId, lessonId, level, subject, lessonTitle });
  const system = 'أنت معلّم تونسي خبير. أنشئ شرائح عرض تقديمي تعليمي باللغة العربية.';
  const user = `المادة: ${subject}\nالمستوى: ${level}\nالدرس: ${lessonTitle}\n${context ? `محتوى الدرس المرجعي:\n${context}\n` : ''}\nأنشئ ${slideCount} شرائح بصيغة JSON على الشكل:\n[{"title":"...","body":"..."}]\nأول شريحة للعنوان ثم الأهداف ثم المحتوى ثم الأمثلة ثم التقويم. أعد JSON فقط.`;
  const text = await generateText(teacherId, system, user);
  const parsed = extractJson(text);
  return Array.isArray(parsed) ? parsed : null;
}

// ===== المرحلة 7.3 — رؤى الولي (ملخص + أنشطة) فوق البيانات الحقيقية =====

export async function generateParentSummary(teacherId, contextData) {
  const system =
    'أنت مساعد أولياء تلاميذ تونسي خبير في التربية. اكتب ملخصاً واضحاً وموضوعياً عن الوضع الدراسي لابن المستخدم باللغة العربية الفصحى المبسطة، معتمداً حصراً على الأرقام والبيانات المقدمة أدناه. لا تختلق أرقاماً ولا معلومات غير موجودة، ولا تتجاوز 120 كلمة.';
  const user = `بيانات حقيقية من منصة المؤسسة:\n${JSON.stringify(contextData, null, 2)}\n\nأكتب الملخص.`;
  return generateText(teacherId, system, user);
}

export async function generateParentActivities(teacherId, contextData) {
  const system =
    'أنت مرشد تربوي تونسي. اقترح أنشطة عملية للولي تدعم ابنه وتعالج تحديداً نقاط الضعف الظاهرة في البيانات أدناه (مواد ضعيفة، تكليفات متأخرة، غياب، تفاعل منخفض). أعد مصفوفة JSON على الشكل [{"title":"...","detail":"..."}] من 3 إلى 5 أنشطة فقط، بدون اختلاق معلومات. أعد JSON فقط.';
  const user = `البيانات:\n${JSON.stringify(contextData, null, 2)}\n\nأعد JSON فقط.`;
  const text = await generateText(teacherId, system, user);
  const parsed = extractJson(text);
  return Array.isArray(parsed) ? parsed : null;
}
