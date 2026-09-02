import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../db.js';
import { searchLesson, normalizeArabic } from './curriculumService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURRICULUM_DIR = path.join(__dirname, '../../curriculum');
const REGISTRY_PATH = path.join(CURRICULUM_DIR, 'registry.json');

export function contentHash(parts) {
  return crypto.createHash('md5').update(parts.join('|')).digest('hex');
}

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return { subjects: {} };
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch {
    return { subjects: {} };
  }
}

function findLegacyBook(subjectCode, level) {
  const registry = loadRegistry();
  const subject = registry.subjects?.[subjectCode];
  if (!subject) return null;
  const levelKey = Object.keys(subject.levels || {}).find((k) => normalizeArabic(k) === normalizeArabic(level));
  const filePath = levelKey ? subject.levels[levelKey] : null;
  if (!filePath) return null;
  const abs = path.join(CURRICULUM_DIR, filePath);
  return fs.existsSync(abs) ? JSON.parse(fs.readFileSync(abs, 'utf8')) : null;
}

function extractSection(pages, keys) {
  const out = [];
  for (const p of pages) {
    const blocks = p.blocks || [];
    for (const b of blocks) {
      const key = String(b.kind || b.type || '').toLowerCase();
      if (keys.some((k) => key.includes(k))) {
        out.push({ title: b.title || p.title, text: b.text || b.content || '', type: b.kind || b.type });
      }
    }
    if (p.examples?.length) {
      for (const ex of p.examples) out.push({ title: 'مثال', text: typeof ex === 'string' ? ex : JSON.stringify(ex), type: 'example' });
    }
  }
  return out;
}

export async function buildMemo({ teacherId, subject, level, lessonTitle, unit, bookTitle }) {
  const parts = [bookTitle || subject, level, unit || '', lessonTitle];
  const hash = contentHash(parts);
  const existing = await prisma.memo.findUnique({ where: { hash } });
  if (existing) return { memo: existing, cached: true };

  const subjectCodeMap = { MATH: 'math', READING: 'anisi', SCIENCE: 'science' };
  const subjectCode = subjectCodeMap[subject] || subject;
  let pages = searchLesson(subjectCode, level, lessonTitle);
  let source = 'curriculum';
  if (!pages.length) {
    const legacy = findLegacyBook(subjectCode, level);
    if (legacy) {
      pages = legacy.units?.flatMap((u) => u.pages || []) || [];
      if (lessonTitle) {
        const tn = normalizeArabic(lessonTitle);
        pages = pages.filter((p) => {
          const pt = normalizeArabic(p.title || '');
          const pc = normalizeArabic((p.content || '').slice(0, 200));
          return pt.includes(tn) || tn.includes(pt) || pc.includes(tn);
        });
      }
    }
  }
  if (!pages.length) source = 'template';

  const lessonText = pages.map((p) => p.content || '').join(' ').slice(0, 1500);

  const objectives = extractSection(pages, ['objective', 'objectif', 'هدف', 'الاهداف']);
  const definitions = extractSection(pages, ['definition', 'تعريف']);
  const concepts = extractSection(pages, ['concept', 'مفهوم']);
  const examples = extractSection(pages, ['example', 'مثال', 'نشاط']);
  const keywords = extractSection(pages, ['keyword', 'كلمة']);
  const questions = extractSection(pages, ['question', 'سؤال']);
  const tips = extractSection(pages, ['tip', 'note', 'ملاحظ']);

  const stages = [
    { stage: 'تمهيد', time: '5 د', description: `تقديم الدرس "${lessonTitle}" وربطه بما سبق أو بمحيط التلميذ اليومي.` },
    { stage: 'شرح الدرس', time: '15 د', description: lessonText ? `تقديم المحتوى الأساسي للدرس:\n${lessonText}` : `شرح المفاهيم الأساسية للدرس "${lessonTitle}" مع أمثلة من الكتاب المدرسي.` },
    { stage: 'أمثلة وتمارين موجهة', time: '12 د', description: examples.length ? `مناقشة الأمثلة: ${examples.map((e) => e.text).slice(0, 3).join('؛ ')}` : 'إنجاز تمارين تطبيقية مع التلميذ تحت إشراف المعلّم.' },
    { stage: 'تقويم', time: '8 د', description: questions.length ? `أسئلة التقويم: ${questions.map((q) => q.text).slice(0, 3).join('؛ ')}` : 'تقييم الفهم عبر أسئلة شفوية قصيرة.' },
    { stage: 'خاتمة', time: '5 د', description: 'تلخيص أهم ما تعلّمه التلميذ وإعطاء واجب منزلي بسيط.' }
  ];

  const meta = {
    subject,
    level,
    lessonTitle,
    unit: unit || '',
    bookTitle: bookTitle || '',
    source: source,
    learningObjectives: objectives.length ? objectives.map((o) => o.text) : [`فهم وترسيخ درس "${lessonTitle}".`],
    summary: lessonText.slice(0, 400) || `ملخص موجز لدرس "${lessonTitle}" في مادة ${subject} للسنة ${level}.`,
    easyExplanation: lessonText.slice(0, 600) || `شرح مبسط لمحتوى الدرس "${lessonTitle}".`,
    explanation: lessonText.slice(0, 1000) || `شرح تفصيلي لدرس "${lessonTitle}" مع التركيز على المفاهيم الأساسية.`,
    definitions: definitions.map((d) => ({ term: d.title, text: d.text })).slice(0, 8),
    concepts: concepts.map((c) => ({ name: c.title, text: c.text })).slice(0, 8),
    examples: examples.map((e) => e.text).slice(0, 6),
    importantNotes: tips.map((t) => t.text).slice(0, 5),
    commonMistakes: [],
    quiz: questions.map((q) => q.text).slice(0, 5),
    commonStudentQuestions: questions.map((q) => q.text).slice(0, 5),
    keywords: keywords.map((k) => k.text).slice(0, 8),
    flashcards: definitions.slice(0, 5).map((d, i) => ({ front: d.title || `مفهوم ${i + 1}`, back: d.text })),
    sourceText: lessonText.slice(0, 2000)
  };

  const memo = await prisma.memo.create({
    data: { teacherId, subject, level, unit: unit || '', lessonTitle, bookTitle: bookTitle || '', hash, content: { meta, stages } }
  });
  return { memo, cached: false };
}

export async function rebuildMemo(id, teacherId) {
  const memo = await prisma.memo.findFirst({ where: { id: Number(id), teacherId } });
  if (!memo) return null;
  await prisma.memo.delete({ where: { id: memo.id } });
  return buildMemo({
    teacherId,
    subject: memo.subject,
    level: memo.level,
    lessonTitle: memo.lessonTitle,
    unit: memo.unit || undefined,
    bookTitle: memo.bookTitle || undefined
  });
}
