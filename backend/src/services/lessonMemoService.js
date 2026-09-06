import { contentHash } from './memoService.js';
import { resolveMethodology, normalizeSubject } from './methodologyResolver.js';
import {
  normalizeArabic,
  loadRegistry,
  findGradeByLevel,
  searchLesson
} from './curriculumService.js';
import * as lessonMemos from '../repositories/lessonMemos.js';

/**
 * LessonMemoService — يبني المذكرة محليًا من BookContent وفق بروفايل المنهجية
 * الرسمي، دون أي اتصال شبكي أو ذكاء اصطناعي. التدفّق:
 *   Teacher → LessonMemoService → BookContent → lesson_memos → Response
 */

export class MemoBuildError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MemoBuildError';
    this.code = code;
  }
}

// ===== تحديد الكتاب والدرس من محتوى المنهج =====

function coreLevel(text) {
  return normalizeArabic(text).replace(/(اساسي|ابتدائ[يى]|اعدادي|ثانوي)/g, '').trim();
}

function findGradeLenient(level) {
  const registry = loadRegistry();
  const core = coreLevel(level);
  if (core) {
    const byCore = (registry.grades || []).find((g) => coreLevel(g.title) === core);
    if (byCore) return byCore;
  }
  return findGradeByLevel(level);
}

function resolveBook(subject, level) {
  const grade = findGradeLenient(level);
  if (!grade) return null;
  const norm = normalizeSubject(subject);
  const subjectDef = (grade.subjects || []).find((s) => {
    if (normalizeSubject(s.id) === norm) return true;
    if (normalizeSubject(s.title) === norm) return true;
    return (s.aliases || []).some((a) => normalizeSubject(a) === norm);
  });
  if (!subjectDef) return null;
  return {
    bookId: `${grade.id}/${subjectDef.id}`,
    gradeId: grade.id,
    subjectId: subjectDef.id,
    subjectTitle: subjectDef.title,
    gradeTitle: grade.title
  };
}

function findLesson(subjectId, level, lessonTitle, gradeId) {
  const pages = searchLesson(subjectId, level, lessonTitle, gradeId);
  if (!pages.length) return null;
  const norm = normalizeArabic(lessonTitle);
  const exact = pages.find((p) => normalizeArabic(p.title) === norm);
  return exact || pages[0];
}

// ===== بناء محتوى المذكرة =====

function byKind(lesson, kind) {
  return (lesson.blocks || []).filter((b) => b.kind === kind).map((b) => b.text).filter(Boolean);
}

function classifyActivity(text) {
  const t = String(text || '').trim();
  if (/^(يدعو|يقدّم|يعطي|يحثّ|ينوّع|يتوقّف|يقرأ|يتدخّل|يهيّئ|يشرح|يستثمر|يدرّب|يحرص|يصيغ|يطرح|يعرض|يمكّن|يلاحظ)/.test(t)) return 'teacher';
  if (/ينجز المتعلّم|يعدّل المتعلّم|يقارن كل متعلّم|يحدّد المتعلّمون|يحدّد المتعلّم|يستعمل المتعلّم|يلوّن المتعلّم|يكتب المتعلّم|يسمّي المتعلّم|يرتّب المتعلّم|يتدرّب المتعلّم|يعبّر المتعلّم|يدرك المتعلّم|يميّز المتعلّم|يقرأ المتعلّم|ينجز التلميذ/.test(t)) return 'student';
  return 'neutral';
}

function collectPhaseActivities(phase) {
  const out = [];
  for (const key of ['activityBank', 'auditoryApproach', 'visualApproach', 'sentenceBuilding']) {
    if (Array.isArray(phase[key])) out.push(...phase[key]);
  }
  if (phase.wordGames && typeof phase.wordGames === 'object') {
    for (const v of Object.values(phase.wordGames)) out.push(v);
  }
  return out;
}

function uniqueStrings(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const s = String(item || '').trim();
    if (!s) continue;
    if (seen.has(normalizeArabic(s))) continue;
    seen.add(normalizeArabic(s));
    out.push(s);
  }
  return out;
}

function injectLessonContent(phaseName, lesson) {
  const name = phaseName || '';
  const out = [];

  if (/استكشاف|الشاملة|تحليلي|بناء|ملاحظة|تحقّق|استحضار|التعلّم|الشرح|التحرّر/.test(name)) {
    if (lesson.content && normalizeArabic(lesson.content) !== normalizeArabic(lesson.title)) out.push(`المحتوى الرسمي للدرس: ${lesson.content}`);
    if (lesson.letter) out.push(`الحرف الجديد: ${lesson.letter}`);
    if (lesson.chapter) out.push(`المحور/الوحدة: ${lesson.chapter}`);
  }

  if (/تدرّب|مساعدة|توظيف|إدماج|التدريب|التمشيات/.test(name)) {
    for (const a of byKind(lesson, 'example').slice(0, 4)) out.push(`نشاط من المنهج: ${a}`);
    for (const d of byKind(lesson, 'definition').slice(0, 2)) out.push(`تذكير مفاهيمي: ${d}`);
    for (const k of byKind(lesson, 'keyword').slice(0, 4)) out.push(`مفردات أساسية: ${k}`);
  }

  if (/تقييم|تقويم/.test(name)) {
    const questions = (lesson.blocks || []).filter((b) => b.kind === 'question');
    for (const q of questions.slice(0, 3)) {
      const opts = q.options && q.options.length ? ` (الخيارات: ${q.options.join('، ')})` : '';
      out.push(`سؤال تقويمي: ${q.text}${opts}`);
    }
  }

  return uniqueStrings(out).slice(0, 6);
}

function buildHeader(profile, lesson, ctx, lessonContent) {
  const columns =
    profile.header?.fields ||
    profile.sessionTable?.columns ||
    ['مكوّن الكفاية', 'الهدف المميّز', 'هدف الحصّة', 'المحتوى', 'الوسائل'];
  const values = {};

  const competency =
    profile.competencyFramework?.subjectCompetency || profile.header?.example?.['مكوّن الكفاية'];
  const distinctive =
    profile.competencyFramework?.sampleComponentCompetencies?.[0] ||
    profile.header?.example?.['الأهداف المميّزة']?.[0];

  const objectives = byKind(lesson, 'objective');
  const objective = objectives[0] || `أن يتعرّف المتعلّم على: ${lesson.title}.`;
  const notes = byKind(lesson, 'note');
  const means = notes.join('، ') || 'كتاب التلميذ، اللوح، الأدوات المتوفّرة في القسم';

  for (const col of columns) {
    const L = col.replace(/[()：:()]/g, '');
    if (L.includes('مكوّن الكفاية')) values[col] = Array.isArray(competency) ? competency.join('؛ ') : competency || '';
    else if (L.includes('الهدف المميّز')) values[col] = Array.isArray(distinctive) ? distinctive.join('؛ ') : distinctive || '';
    else if (L.includes('هدف الحصّة')) values[col] = objective;
    else if (L.includes('المستوى')) values[col] = ctx.level;
    else if (L.includes('المادة')) values[col] = ctx.subject;
    else if (L.includes('نص') || L.includes('تركيب لغوي')) values[col] = lessonContent;
    else if (L.includes('المحتوى')) values[col] = lesson.title + (lesson.domain ? ` — ${lesson.domain}` : '');
    else if (L.includes('وسائل') || L.includes('السند') || L.includes('مدار')) values[col] = means;
    else if (L.includes('اليوم') || L.includes('الفترة')) values[col] = '';
    else values[col] = '';
  }
  return { columns, values };
}

function buildPhases(profile, lesson) {
  return (profile.phases || []).map((phase) => {
    const injected = injectLessonContent(phase.name, lesson);
    const bank = collectPhaseActivities(phase);
    return {
      name: phase.name,
      goal: phase.goal || '',
      activities: uniqueStrings([...injected, ...bank]).slice(0, 10),
      notes: phase.notes || []
    };
  });
}

function buildTable(profile, phases) {
  const cols = profile.tableColumns;
  if (!cols || !cols.length) return null;
  const rows = phases.map((phase) => {
    const row = {};
    const notes = phase.notes || [];
    const allActs = phase.activities;
    cols.forEach((col, idx) => {
      const L = col.replace(/[()：:()]/g, '');
      if (idx === 0) {
        row[col] = phase.name;
      } else if (L.includes('ملاحظ')) {
        row[col] = notes.join('؛ ');
      } else if (L.includes('الممارسات البيداغوجية')) {
        row[col] = allActs.join('؛ ');
      } else if (L.includes('نشاط الأستاذ') || L.includes('تمشيات') || L.includes('نشاط المعلّم')) {
        row[col] = allActs.filter((a) => classifyActivity(a) !== 'student').join('؛ ');
      } else if (L.includes('نشاط المتعلّم') || L.includes('ممارسات') || L.includes('أجوبة') || L.includes('إنتاجات')) {
        row[col] = allActs.filter((a) => classifyActivity(a) === 'student').join('؛ ') || phase.goal;
      } else {
        row[col] = phase.goal;
      }
    });
    return row;
  });
  return { columns: cols, rows };
}

function buildDomainNotes(profile) {
  if (profile.domainNotes && typeof profile.domainNotes === 'object') {
    return Object.entries(profile.domainNotes).map(([domain, note]) => ({ domain, note }));
  }
  if (Array.isArray(profile.domainBank)) {
    return profile.domainBank.map((d) => ({
      domain: d.domain,
      note: (d.sampleContents || []).join('، ')
    }));
  }
  return [];
}

export function buildMemoContent(methodology, lesson, ctx) {
  const profile = methodology;
  const contentText = lesson.content || byKind(lesson, 'concept')[0] || lesson.title;
  const warmup = Array.isArray(profile.warmupBank) ? profile.warmupBank.slice(0, 3) : [];
  const phases = buildPhases(profile, lesson);
  const header = buildHeader(profile, lesson, ctx, contentText);
  const table = buildTable(profile, phases);
  const sourceBlocks = uniqueStrings([
    ...(lesson.blocks || []).map((b) => b.text),
    lesson.content || '',
    lesson.pedagogicalBasis || ''
  ]);

  return {
    methodologyId: profile.methodId,
    methodologyTitle: profile.title,
    principle: profile.principle || '',
    subject: ctx.subject,
    level: ctx.level,
    lessonTitle: lesson.title,
    lessonType: ctx.lessonType || profile.appliesTo?.lessonType || '',
    unit: ctx.unit || '',
    domain: lesson.domain || lesson.chapter || '',
    header,
    warmup,
    phases,
    table,
    closing: profile.closingFields || [],
    domainNotes: buildDomainNotes(profile),
    keywords: byKind(lesson, 'keyword').slice(0, 8),
    definitions: byKind(lesson, 'definition').slice(0, 6),
    source: 'curriculum',
    sourceText: sourceBlocks.slice(0, 12).join('\n').slice(0, 3000)
  };
}

// ===== واجهة التوليد العامة =====

export async function generateMemo({ teacherId, subject, level, lessonTitle, lessonType, unit }) {
  const levelValue = level || 'السنة الأولى أساسي';

  const book = resolveBook(subject, levelValue);
  if (!book) {
    throw new MemoBuildError(
      'NO_BOOK',
      `لا يوجد محتوى منهج لـ ${subject} — ${levelValue} في curriculum/registry.json. أضف محتوى الكتاب أولًا.`
    );
  }

  const lesson = findLesson(book.subjectId, levelValue, lessonTitle, book.gradeId);
  if (!lesson) {
    throw new MemoBuildError(
      'LESSON_NOT_FOUND',
      `لم يُعثر على درس "${lessonTitle}" في محتوى المنهج (${book.gradeTitle} — ${book.subjectTitle}).`
    );
  }

  let methodology;
  try {
    methodology = resolveMethodology({ subject, level: levelValue, lessonType });
  } catch (e) {
    if (e.name === 'MethodologyError') throw new MemoBuildError(e.code, e.message);
    throw e;
  }
  if (!methodology) throw new MemoBuildError('NO_METHODOLOGY', 'المنهجية غير متوفّرة.');

  const cached = await lessonMemos.findByLesson(book.bookId, lesson.id);
  if (cached && cached.methodologyId === methodology.methodId) {
    return { memo: cached, cached: true };
  }

  const ctx = { subject: book.subjectTitle, level: levelValue, lessonTitle, lessonType, unit };
  const content = buildMemoContent(methodology, lesson, ctx);
  const hash = contentHash([book.bookId, lesson.id, methodology.methodId]);

  const memo = await lessonMemos.upsert({
    teacherId,
    bookId: book.bookId,
    lessonId: lesson.id,
    subject: book.subjectTitle,
    level: levelValue,
    lessonTitle: lesson.title,
    lessonType: lessonType || methodology.appliesTo?.lessonType || null,
    unit: unit || null,
    methodologyId: methodology.methodId,
    methodologyTitle: methodology.title,
    hash,
    content
  });

  return { memo, cached: false };
}

export async function rebuildMemo({ teacherId, subject, level, lessonTitle, lessonType, unit }) {
  const levelValue = level || 'السنة الأولى أساسي';
  const book = resolveBook(subject, levelValue);
  if (book) {
    const lesson = findLesson(book.subjectId, levelValue, lessonTitle, book.gradeId);
    if (lesson) await lessonMemos.deleteByLesson(book.bookId, lesson.id);
  }
  return generateMemo({ teacherId, subject, level, lessonTitle, lessonType, unit });
}

export { resolveBook, findLesson };
