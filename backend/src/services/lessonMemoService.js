import { contentHash } from './memoService.js';
import { buildSpecMemo } from './memoEngine.js';
import { resolveMethodology, normalizeSubject } from './methodologyResolver.js';
import {
  normalizeArabic,
  loadRegistry,
  findGradeByLevel,
  searchLesson,
  getLessonPages
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

// طيّ أسماء المواد للمذكرات: «رياضياتي 2» و«المتميز في الرياضيات»均属 رياضيات
function subjectFold(s) {
  const n = normalizeSubject(s);
  if (n.startsWith('رياضيات')) return 'رياضيات';
  return n;
}

/**
 * كل كتب المادة لهذه السنة (قد يكون لسنة واحدة عدة كتب: كتابي في الرياضيات،
 * رياضياتي 2، المتميز، الشامل...). المطابقة المباشرة أولًا ثم التجميع بـ subjectKey.
 */
function resolveBookCandidates(subject, level) {
  const grade = findGradeLenient(level);
  if (!grade) return [];
  const norm = normalizeSubject(subject);
  const fold = subjectFold(subject);
  const direct = [];
  const grouped = [];
  for (const s of grade.subjects || []) {
    if (!s.bookFile && !s.lessonsFile) continue;
    const isDirect =
      normalizeSubject(s.id) === norm ||
      normalizeSubject(s.title) === norm ||
      (s.aliases || []).some((a) => normalizeSubject(a) === norm);
    const entry = {
      bookId: `${grade.id}/${s.id}`,
      gradeId: grade.id,
      subjectId: s.id,
      subjectTitle: s.title,
      gradeTitle: grade.title
    };
    if (isDirect) direct.push(entry);
    else if (subjectFold(s.subjectKey || s.title) === fold) grouped.push(entry);
  }
  return [...direct, ...grouped];
}

function resolveBook(subject, level) {
  const candidates = resolveBookCandidates(subject, level);
  return candidates[0] || null;
}

function findLesson(subjectId, level, lessonTitle, gradeId) {
  const pages = searchLesson(subjectId, level, lessonTitle, gradeId);
  if (!pages.length) return null;
  const norm = normalizeArabic(lessonTitle);
  const exact = pages.find((p) => normalizeArabic(p.title) === norm);
  return exact || pages[0];
}

// صفحات الكتب غير المرقمنة تولّد curriculumService كتلة عرض مؤقتة («قيد التحضير…») —
// المذكرة يجب أن ترفض بوضوح بدل نسخ النص المؤقت إلى الجدول الرسمي.
const PLACEHOLDER_RE = /التحضير|سيظهر هنا|واصل التقدم|لم ينشا/;
function isPlaceholderBlock(b) {
  if (!b || typeof b !== 'object') return true;
  const hay = normalizeArabic(`${b.text || ''} ${b.title || ''}`);
  return PLACEHOLDER_RE.test(hay);
}
export function lessonIsDigitized(lesson) {
  const blocks = (lesson && lesson.blocks) || [];
  const titleNorm = normalizeArabic((lesson && lesson.title) || '');
  return blocks.some((b) => {
    if (isPlaceholderBlock(b)) return false;
    const rich = !!(b.image || (b.options && b.options.length) || (b.rows && b.rows.length) || (b.pairs && b.pairs.length) || b.kind === 'table' || b.kind === 'question' || b.kind === 'textarea' || b.kind === 'math-input');
    if (rich) return true;
    const t = normalizeArabic(b.text || '');
    return !!t && t !== titleNorm && t.length > 40;
  });
}

// اقتراحات عندما يفشل البحث: أقرب عناوين الدروس عبر كل كتب المادة المرشّحة
function suggestLessons(candidates, level, lessonTitle) {
  try {
    const list = Array.isArray(candidates) ? candidates : [{ subjectId: candidates, gradeId: null }];
    const seen = new Set();
    const entries = [];
    for (const cand of list) {
      const all = getLessonPages(cand.subjectId, level, cand.gradeId);
      for (const pg of all) {
        const t = String(pg.title || '').trim();
        if (!t) continue;
        const key = normalizeArabic(t);
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push({ title: t, book: cand.subjectTitle || cand.subjectId });
      }
    }
    const normQ = normalizeArabic(lessonTitle || '');
    const qWords = normQ.split(/\s+/).filter((w) => w.length >= 3);
    const score = (t) => {
      const nt = normalizeArabic(t);
      let sc = nt.includes(normQ) || normQ.includes(nt) ? 100 : 0;
      for (const w of qWords) if (nt.includes(w)) sc += 1;
      return sc;
    };
    entries.sort((a, b) => score(b.title) - score(a.title));
    const matched = entries.filter((e) => score(e.title) > 0).slice(0, 6);
    return matched.length ? matched : entries.slice(0, 8);
  } catch {
    return [];
  }
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
    images: (lesson.blocks || [])
      .filter((b) => b && typeof b === 'object' && b.image)
      .slice(0, 6)
      .map((b) => ({
        imageId: b.imageId || `img-${lesson.id}-${String(b.image).split('/').pop().replace(/\.(png|jpe?g|webp)$/i, '')}`,
        src: b.image,
        caption: b.alt || b.title || ''
      })),
    closing: profile.closingFields || [],
    domainNotes: buildDomainNotes(profile),
    keywords: byKind(lesson, 'keyword').slice(0, 8),
    definitions: byKind(lesson, 'definition').slice(0, 6),
    source: 'curriculum',
    sourceBook: ctx.sourceBook || ctx.subject || '',
    spec: buildSpecMemo({ profile, lesson, ctx }),
    sourceText: sourceBlocks.slice(0, 12).join('\n').slice(0, 3000)
  };
}

// ===== واجهة التوليد العامة =====

export async function generateMemo({ teacherId, subject, level, lessonTitle, lessonType, unit }) {
  const levelValue = level || 'السنة الأولى أساسي';

  const candidates = resolveBookCandidates(subject, levelValue);
  if (!candidates.length) {
    throw new MemoBuildError(
      'NO_BOOK',
      `لا يوجد محتوى منهج لـ ${subject} — ${levelValue} في curriculum/registry.json. أضف محتوى الكتاب أولًا.`
    );
  }

  // سنة/مادة قد يخدمهما عدة كتب — نبحث الدرس في كل كتب المادة ونولد من الكتاب الذي يحويه
  let book = null;
  let lesson = null;
  for (const cand of candidates) {
    const found = findLesson(cand.subjectId, levelValue, lessonTitle, cand.gradeId);
    if (found) { book = cand; lesson = found; break; }
  }
  if (!lesson) {
    book = candidates[0];
    const hints = suggestLessons(candidates, levelValue, lessonTitle);
    throw new MemoBuildError(
      'LESSON_NOT_FOUND',
      `لم يُعثر على درس "${lessonTitle}" في ${candidates.map((c) => `«${c.subjectTitle}»`).join(' ، ')} (${book.gradeTitle}).` +
        (hints.length
          ? ` أقرب الدروس المتاحة: ${hints.map((h) => `«${h.title}» (${h.book})`).join(' ، ')}`
          : ' لا توجد دروس مرقمنة لهذا المستوى بعد.')
    );
  }

  // لا نُولّد مذكرة من كتاب غير مرقمن — نصّ «قيد التحضير» ليس محتوى درسًا
  if (!lessonIsDigitized(lesson)) {
    throw new MemoBuildError(
      'NOT_DIGITIZED',
      `درس «${lesson.title}» في «${book.subjectTitle}» (${levelValue}) غير مرقمن بعد: كتاب هذه السنة لم يُدوَّن بعد في المنصة. أرسل ملف الكتاب (docx) ليُضاف كتابًا مستقلًّا إلى جانب الكتب الحالية، وبعدها تُولَّد مذكراته بجميع صوره.`
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

  const specHash = contentHash([book.bookId, lesson.id, methodology.methodId, 'spec-v3']);
  const cached = await lessonMemos.findByLesson(book.bookId, lesson.id);
  if (cached && cached.methodologyId === methodology.methodId && cached.hash === specHash) {
    return { memo: cached, cached: true };
  }

  const ctx = { subject: book.subjectTitle, level: levelValue, lessonTitle, lessonType, unit, sourceBook: book.subjectTitle, gradeId: book.gradeId, subjectId: book.subjectId };
  const content = buildMemoContent(methodology, lesson, ctx);
  const hash = specHash;

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
  for (const cand of resolveBookCandidates(subject, levelValue)) {
    const lesson = findLesson(cand.subjectId, levelValue, lessonTitle, cand.gradeId);
    if (lesson) await lessonMemos.deleteByLesson(cand.bookId, lesson.id);
  }
  return generateMemo({ teacherId, subject, level, lessonTitle, lessonType, unit });
}

export { resolveBook, resolveBookCandidates, findLesson };
