import crypto from 'crypto';
import prisma from '../db.js';
import { getLessonPages, normalizeArabic } from './curriculumService.js';
import { loadOfficialMemos } from './officialMemos.js';

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
  const provider = detectProvider(apiKey);
  return prisma.aiKey.upsert({
    where: { teacherId },
    update: { keyEncrypted, provider, updatedAt: new Date() },
    create: { teacherId, keyEncrypted, provider }
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
export async function resolveApiKey(teacherId) {
  if (teacherId) {
    const row = await prisma.aiKey.findUnique({ where: { teacherId } });
    if (row) {
      try {
        return { key: decrypt(row.keyEncrypted), provider: row.provider || 'gemini' };
      } catch {
        /* المفتاح التالف يتجاوز للمستوى التالي */
      }
    }
  }
  const platform = await getPlatformAiKey();
  if (platform) return { key: platform, provider: 'gemini' };
  if (process.env.GEMINI_API_KEY) return { key: process.env.GEMINI_API_KEY, provider: 'gemini' };
  return null;
}

// كشف المزوّد من صيغة المفتاح
function detectProvider(apiKey) {
  if (!apiKey) return 'gemini';
  if (apiKey.startsWith('sk-ant-')) return 'claude';
  if (apiKey.startsWith('sk-')) return 'openai';
  if (apiKey.startsWith('AIza')) return 'gemini';
  if (apiKey.startsWith('gsk_')) return 'groq';
  if (apiKey.startsWith('nvapi-')) return 'nvidia';
  return 'openai'; // افتراضي: OpenAI-compatible
}

async function callGemini(prompt, apiKey, maxTokens = 800) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
  const res = await fetch(`${url}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens }
    })
  });
  if (!res.ok) {
    const err = new Error(`AI service error: ${res.status}`);
    err.providerStatus = res.status;
    try { err.providerBody = (await res.text()).slice(0, 300); } catch { err.providerBody = ''; }
    throw err;
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAI(prompt, apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 800
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callClaude(prompt, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude error: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.content?.[0]?.text || '';
}

async function callGroq(prompt, apiKey) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'qwen/qwen3.8-27b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 800
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callNvidia(prompt, apiKey, maxTokens = 2000) {
  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'meta/llama-3.1-8b-instruct',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: maxTokens
    })
  });
  if (!res.ok) {
    const err = new Error(`AI service error: ${res.status}`);
    err.providerStatus = res.status;
    try { err.providerBody = (await res.text()).slice(0, 300); } catch { err.providerBody = ''; }
    throw err;
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callProviderByType(prompt, apiKey, provider, opts) {
  const maxTokens = opts && Number(opts.maxTokens) > 0 ? Number(opts.maxTokens) : 800;
  switch (provider) {
    case 'claude': return callClaude(prompt, apiKey);
    case 'gemini': return callGemini(prompt, apiKey, maxTokens);
    case 'groq': return callGroq(prompt, apiKey);
    case 'nvidia': return callNvidia(prompt, apiKey, Math.max(maxTokens, 2000));
    case 'openai':
    default: return callOpenAI(prompt, apiKey);
  }
}

// خطاف قابل للحقن تُستعمله الاختبارات لتفادي نداءات الشبكة الحقيقية.
// عند تعيينه يُستبدل نداء المزوّد بالكامل؛ وإلا يُستخدم المزوّد الحقيقي حسب النوع.
let callProvider = null;
export function __setCallProvider(fn) {
  callProvider = fn;
}
export function __resetCallProvider() {
  callProvider = null;
}

function buildPrompt(system, user) {
  return `${system}\n\nالمستخدم:\n${user}\n\nيرجى الرد مباشرة بدون مقدمات.`;
}

function invokeProvider(prompt, apiKey, provider, opts) {
  if (callProvider) return callProvider(prompt, apiKey, provider, opts);
  return callProviderByType(prompt, apiKey, provider, opts);
}

export async function generateText(teacherId, system, user, opts) {
  const resolved = await resolveApiKey(teacherId);
  if (!resolved) {
    throw new Error('NO_AI_KEY');
  }
  const { key, provider } = resolved;
  return invokeProvider(buildPrompt(system, user), key, provider, opts);
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

const MEMO_PLAN_TEMPLATES = {
  math: {
    timingMinutes: 60,
    memoTitle: 'مذكرة رياضيات',
    stages: ['حساب ذهني', 'تعهد المكتسبات', 'الوضعية الاستكشافية + التعلم المنهجي الآلي', 'تعلم ادماجي', 'تقييم']
  },
  science: {
    timingMinutes: 30,
    memoTitle: 'مذكرة إيقاظ علمي',
    stages: ['تعهد المكتسبات', 'الوضعية الاشكالية', 'التجريب والتثبت + الاستنتاجات', 'التعلم المنهجي + التطبيق', 'التعلم الادماجي + التقييم']
  },
  generic: {
    timingMinutes: 45,
    memoTitle: 'مذكرة درس',
    stages: ['التمهيد والتهيئة', 'العرض والاستكشاف', 'التطبيق الموجه', 'الإدماج', 'التقويم']
  }
};

function memoTemplateFor(subject) {
  const n = normalizeArabic(String(subject || ''));
  if (/رياض/.test(n)) return { ...MEMO_PLAN_TEMPLATES.math, kind: 'math' };
  if (/ايقاظ|علوم|موقظ/.test(n)) return { ...MEMO_PLAN_TEMPLATES.science, kind: 'science' };
  return { ...MEMO_PLAN_TEMPLATES.generic, kind: 'generic' };
}

function officialExampleFor(kind) {
  try {
    const bank = loadOfficialMemos();
    const entry = bank.find((e) => (kind === 'math' ? e.subject === 'math' : e.subject === 'science')) || bank[0];
    if (!entry) return '';
    return `\nمثال رسمي كامل للشكل المطلوب (مذكرة ${entry.topic}):\n${JSON.stringify({
      competency: (entry.competency || '').slice(0, 300),
      objective: (entry.objective || '').slice(0, 300),
      content: (entry.content || '').slice(0, 300),
      lessonGoal: (entry.lessonGoal || '').slice(0, 300),
      stages: (entry.stages || []).map((s) => ({
        name: s.name,
        teacherActivity: String(s.teacher || '').slice(0, 500),
        learnerActivity: String(s.learner || '').slice(0, 300),
        tools: (s.tools || []).join(' + ')
      }))
    })}\n`;
  } catch {
    return '';
  }
}

function validateMemoPlan(obj, template) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 'بنية فارغة';
  for (const f of ['competency', 'objective', 'content', 'lessonGoal']) {
    if (!obj[f] || typeof obj[f] !== 'string' || !obj[f].trim()) return `الحقل ${f} ناقص`;
  }
  if (!Array.isArray(obj.stages) || obj.stages.length !== 5) return 'المراحل ليست خمساً';
  for (let i = 0; i < 5; i++) {
    const s = obj.stages[i];
    if (!s || typeof s !== 'object') return `المرحلة ${i + 1} ناقصة`;
    const got = normalizeArabic(String(s.name || ''));
    const want = normalizeArabic(template.stages[i]);
    const close = got === want || got.replace(/^[0-9٠-٩.\-()\s]+/, '').trim() === want || want.includes(got) || got.includes(want);
    if (!close) return `اسم المرحلة ${i + 1} يجب أن يكون «${template.stages[i]}»`;
    s.name = template.stages[i];
    for (const f of ['teacherActivity', 'learnerActivity']) {
      if (!s[f] || typeof s[f] !== 'string' || !s[f].trim()) return `المرحلة ${i + 1}: ${f} ناقص`;
    }
    if (!s.tools || typeof s.tools !== 'string' || !s.tools.trim()) {
      s.tools = 'كتاب التلميذ، السبورة';
    }
  }
  return null;
}

export async function generateLessonPlan(teacherId, { subject, level, lessonTitle, gradeId, subjectId, lessonId, duration }) {
  const template = memoTemplateFor(subject);
  const timing = Number(duration) > 0 ? Number(duration) : template.timingMinutes;
  const context = resolveLessonContext({ gradeId, subjectId, lessonId, level, subject, lessonTitle });
  const example = officialExampleFor(template.kind);
  const schema = `{"competency":"مكون الكفاية","objective":"الهدف المميز","content":"المحتوى","lessonGoal":"هدف الحصة","stages":[{"name":"${template.stages[0]}","teacherActivity":"...","learnerActivity":"...","tools":"..."} × 5 بنفس الترتيب: ${template.stages.join(' / ')}]}`;
  const rules = [
    'أخرج JSON فقط بالمخطط المحدد دون أي نص إضافي.',
    `أسماء المراحل الخمس حرفياً وبالترتيب: ${template.stages.join(' / ')}.`,
    'كل الأنشطة والأمثلة والأعداد مشتقة حصراً من محتوى الدرس المرجعي أدناه — ممنوع اختراع تمارين أو أعداد أو أسماء.',
    'أنشطة المعلّم مفصّلة خطوة بخطوة، وأنشطة المتعلّم بصيغة المتكلم الجمع، والوسائل واقعية من القسم.',
    `التوقيت الإجمالي: ${timing} دقيقة.`
  ].join('\n- ');
  const baseUser = `المادة: ${subject}\nالمستوى: ${level}\nالدرس: ${lessonTitle}\n${context ? `محتوى الدرس المرجعي (المصدر الوحيد للأنشطة):\n${context}\n` : ''}${example}\nالمخطط الإلزامي:\n${schema}\nالقواعد:\n- ${rules}`;
  const system = 'أنت خبير بيداغوجي تونسي في التعليم الابتدائي. تولّد مذكرات دروس مطابقة حرفياً لهيكل المذكرة الرسمية. تلتزم بالمخطط والأسماء والقواعد بدقة صارمة.';
  const attempt = async (extra) => {
    const text = await generateText(teacherId, system, baseUser + (extra || ''), { maxTokens: 3500 });
    return extractJson(text);
  };
  let plan = await attempt('');
  let err = validateMemoPlan(plan, template);
  if (err) {
    plan = await attempt(`\nتنبيه: إخراجك السابق مرفوض (${err}). أعد الإخراج كاملاً مصححاً ملتزماً بالمخطط والأسماء الحرفية.`);
    err = validateMemoPlan(plan, template);
  }
  if (err) {
    try {
      console.error(`[AI-PLAN-REJECTED] ${err} :: ${JSON.stringify(plan)?.slice(0, 400)}`);
    } catch { /* logging only */ }
    const invalid = new Error(`تعذّر توليد خطة مطابقة للقالب الرسمي (${err}) — أعد المحاولة.`);
    invalid.code = 'AI_PLAN_INVALID';
    throw invalid;
  }
  return {
    subject, level, lessonTitle,
    timingMinutes: timing,
    memoTitle: template.memoTitle,
    source: 'ai',
    ...plan
  };
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
  // تطبيع: قد يرجع النموذج مصفوفة عارية أو غلافا {slides:[...]} أو {presentation:{slides:[...]}}
  const slides = Array.isArray(parsed)
    ? parsed
    : (Array.isArray(parsed?.slides) ? parsed.slides : (Array.isArray(parsed?.presentation?.slides) ? parsed.presentation.slides : null));
  return slides && slides.length ? slides : null;
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

// ===== التصحيح الذكي الجماعي =====

export async function batchGradeSubmissions(teacherId, { submissions, lessonContext }) {
  const apiKey = await resolveApiKey(teacherId);
  if (!apiKey) throw new Error('NO_AI_KEY');

  const system = `أنت مصحّح تونسي خبير. قيّم إجابات التلاميذ على هذا الدرس.
السياق: ${lessonContext || 'درس ابتدائي تونسي'}

قواعد التصحيح:
1. لكل سؤال، قيّم الإجابة و أعطِ درجة من 0到الحد الأقصى
2. الإجابة الصحيحة = كامل الدرجة، الجزئية = نصف أو ثلث، الخاطئة = 0
3. للنصوص المفتوحة: قيّم الفهم وال HomePage والتركيب اللغوي
4. أعد JSON فقط بدون شرح

الشكل المطلوب:
{
  "results": [
    {
      "submissionId": 123,
      "score": 15,
      "maxScore": 20,
      "feedback": "تعليق موجز",
      "details": [
        { "blockId": "b1", "earned": 2, "max": 2, "comment": "" },
        { "blockId": "b2", "earned": 1, "max": 2, "comment": "ينقص التفصيل" }
      ]
    }
  ]
}`;

  const results = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < submissions.length; i += BATCH_SIZE) {
    const batch = submissions.slice(i, i + BATCH_SIZE);
    const batchData = batch.map(s => ({
      submissionId: s.id,
      studentName: s.studentName,
      answers: s.answers
    }));

    const user = `إرسالات التلاميذ (${batch.length}):\n${JSON.stringify(batchData, null, 2)}\n\nقيّم كل إرسال وأعد JSON.`;

    try {
      const text = await invokeProvider(`${system}\n\nالمستخدم:\n${user}\n\nيرجى الرد مباشرة بدون مقدمات.`, apiKey.key, apiKey.provider);
      const parsed = extractJson(text);
      if (parsed?.results) {
        results.push(...parsed.results);
      }
    } catch (err) {
      console.error('Batch grading error for batch starting at', i, err.message);
      for (const s of batch) {
        results.push({
          submissionId: s.id,
          score: null,
          maxScore: 20,
          feedback: 'تعذر التصحيح التلقائي — يحتاج مراجعة يدوية',
          details: []
        });
      }
    }
  }

  return results;
}
