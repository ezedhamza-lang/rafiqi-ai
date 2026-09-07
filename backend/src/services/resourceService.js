import prisma from '../db.js';
import { generateText } from './aiService.js';

function extractJson(text) {
  if (!text) return null;
  // Try markdown code blocks first
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch {}
  }
  // Try to find first valid JSON object by scanning
  const start = text.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(text.slice(start, i + 1)); } catch { break; }
        }
      }
    }
  }
  // Fallback: greedy match
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return JSON.parse(objMatch[0]); } catch {} }
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) { try { return JSON.parse(arrMatch[0]); } catch {} }
  return null;
}

const AI_PROMPTS = {
  WORKSHEET: (lessonTitle, subject) =>
    `أنت مدرّس تونسي. أنشئ ورقة عمل للدرس "${lessonTitle}" في مادة ${subject || 'متنوعة'}.\n` +
    'أعد JSON فقط بالشكل:\n' +
    '{"instructions":"تعليمات الورقة","exercises":[{"type":"MCQ","prompt":"السؤال","options":["أ","ب","ج","د"],"answer":"أ"},{"type":"FILL","prompt":"أكمل: ......","answer":"الجواب"},{"type":"OPEN","prompt":"سؤال مفتوح"}]}\n' +
    'أنشئ 6-8 أسئلة متنوعة ومناسبة للمستوى الابتدائي.',

  HOMEWORK: (lessonTitle, subject) =>
    `أنت مدرّس تونسي. أنشئ واجباً منزلياً للدرس "${lessonTitle}" في مادة ${subject || 'متنوعة'}.\n` +
    'أعد JSON فقط بالشكل:\n' +
    '{"dueDays":3,"tasks":["تكليف 1","تكليف 2","تكليف 3"]}\n' +
    '3-5 تكليفات عملية ومناسبة.',

  FLASHCARDS: (lessonTitle, subject) =>
    `أنت مدرّس تونسي. أنشئ بطاقات مراجعة للدرس "${lessonTitle}" في مادة ${subject || 'متنوعة'}.\n` +
    'أعد JSON فقط بالشكل:\n' +
    '{"cards":[{"front":"السؤال أو المفهوم","back":"الإجابة أو التعريف"}]}\n' +
    'أنشئ 8-10 بطاقات مراجعة.',

  PRESENTATION: (lessonTitle, subject) =>
    `أنت مدرّس تونسي. أنشئ عرضاً تقديرياً للدرس "${lessonTitle}" في مادة ${subject || 'متنوعة'}.\n` +
    'أعد JSON فقط بالشكل:\n' +
    '{"slides":[{"title":"عنوان الشريحة","body":"محتوى الشريحة"}]}\n' +
    'أنشئ 6-8 شرائح: عنوان، أهداف، محتوى، أمثلة، تقويم، خاتمة.'
};

const FALLBACK = {
  WORKSHEET: (lessonTitle) => ({
    title: `ورقة عمل: ${lessonTitle}`,
    instructions: 'أنجز التمارين التالية بتركيز ثم تحقق من إجاباتك.',
    exercises: [
      { type: 'MCQ', prompt: `ما المفهوم الأساسي في درس "${lessonTitle}"؟`, options: ['المفهوم أ', 'المفهوم ب', 'المفهوم ج', 'المفهوم د'], answer: 'المفهوم أ' },
      { type: 'FILL', prompt: 'أكمل الفراغ: ......', answer: 'الجواب' },
      { type: 'OPEN', prompt: `اشرح بأسلوبك مفهوم درس "${lessonTitle}".` }
    ]
  }),
  HOMEWORK: (lessonTitle) => ({
    title: `واجب منزلي: ${lessonTitle}`,
    dueDays: 3,
    tasks: [`راجع درس "${lessonTitle}"`, 'أنجز التمارين في الكتاب', 'أجب عن أسئلة المراجعة']
  }),
  FLASHCARDS: (lessonTitle) => ({
    title: `بطاقات مراجعة: ${lessonTitle}`,
    cards: [
      { front: `مفهوم 1 من "${lessonTitle}"`, back: 'تعريف المفهوم' },
      { front: `مفهوم 2 من "${lessonTitle}"`, back: 'تعريف المفهوم' },
      { front: `مثال على "${lessonTitle}"`, back: 'مثال توضيحي' }
    ]
  }),
  PRESENTATION: (lessonTitle) => ({
    title: `عرض تقديمي: ${lessonTitle}`,
    slides: [
      { title: `درس: ${lessonTitle}`, body: 'مرحبًا بكم' },
      { title: 'الأهداف', body: 'فهم المفاهيم الأساسية' },
      { title: 'المحتوى', body: 'شرح المفاهيم' },
      { title: 'التقويم', body: 'مراجعة' }
    ]
  })
};

export async function buildResource({ teacherId, kind, subject, level, lessonTitle, input: _input = {} }) {
  if (!AI_PROMPTS[kind]) throw new Error('نوع مورد غير معروف');

  let content;
  try {
    const prompt = AI_PROMPTS[kind](lessonTitle, subject);
    const text = await generateText(teacherId, prompt, '');
    content = extractJson(text);
  } catch {
    content = null;
  }

  if (!content || !content.exercises && !content.tasks && !content.cards && !content.slides) {
    content = FALLBACK[kind](lessonTitle);
  }

  content.title = `${FALLBACK[kind](lessonTitle).title}`;

  return prisma.teachingResource.create({
    data: {
      teacherId,
      kind,
      subject,
      level,
      lessonTitle: String(lessonTitle),
      title: content.title,
      content
    }
  });
}

export async function rebuildResource(id, teacherId) {
  const existing = await prisma.teachingResource.findFirst({ where: { id: Number(id), teacherId } });
  if (!existing) return null;
  await prisma.teachingResource.delete({ where: { id: existing.id } });
  return buildResource({
    teacherId,
    kind: existing.kind,
    subject: existing.subject,
    level: existing.level,
    lessonTitle: existing.lessonTitle,
    input: existing.content
  });
}
