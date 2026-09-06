import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURRICULUM_DIR = path.join(__dirname, '../../curriculum');
const CONTENT_DIR = path.join(__dirname, '../../content');
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

export function normalizeArabic(text) {
  return String(text ?? '')
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .replace(/[\u064B-\u0652]/g, '')
    .toLowerCase();
}

function readJson(abs) {
  if (!fs.existsSync(abs)) return null;
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
}

// ===== Batch 3: فصل محرّك المنهج عن المحتوى التونسي (تحميل حسب country) =====
//
// registry.json (الجذر) يبقى دائماً "الفهرس": يحوي حقل "countries" يسرد كل
// سوق متوفّر ومجلّده (dir). السوق الافتراضي (dir: null) هو المحتوى التونسي
// الحالي في جذر backend/curriculum مباشرة — بلا أي نقل ملفّات، فلا خطر على
// المحتوى القائم. أي سوق جديد يُضاف كمجلّد مستقل backend/curriculum/<dir>/
// يحوي registry.json + content/ خاصّين به (محتوى "بديل"، لا دمج) — تماماً
// كما ينص هذا القسم من ROADMAP، دون تعديل كود الخادم.

function baseRegistryFile() {
  return readJson(path.join(CURRICULUM_DIR, 'registry.json')) || { grades: [] };
}

function countriesIndex() {
  const base = baseRegistryFile();
  if (Array.isArray(base.countries) && base.countries.length) return base.countries;
  // تراجع للتوافق مع الشكل القديم (بدون "countries"): سوق تونسي وحيد افتراضي.
  return [{ code: base.country || 'TN', title: base.curriculum || '', dir: null, default: true }];
}

export function listCountries() {
  return countriesIndex().map((c) => ({ code: c.code, title: c.title, default: !!c.default }));
}

function resolveCountry(country) {
  const list = countriesIndex();
  const wanted = String(country || '').trim().toUpperCase();
  const found = wanted ? list.find((c) => String(c.code).toUpperCase() === wanted) : null;
  return found || list.find((c) => c.default) || list[0] || { code: 'TN', dir: null };
}

function baseDirs(country) {
  const entry = resolveCountry(country);
  const root = entry.dir ? path.join(CURRICULUM_DIR, entry.dir) : CURRICULUM_DIR;
  return {
    curriculumDir: root,
    contentDir: entry.dir ? path.join(root, 'content') : CONTENT_DIR,
    country: entry.code
  };
}

function loadRegistry(country) {
  const { curriculumDir } = baseDirs(country);
  return readJson(path.join(curriculumDir, 'registry.json')) || { grades: [] };
}

const GRADE_ORDINALS = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة'];

function extractGradeOrdinal(text) {
  const norm = normalizeArabic(text || '');
  return GRADE_ORDINALS.find((o) => norm.includes(normalizeArabic(o))) || null;
}

function findGradeByLevel(level, country) {
  const registry = loadRegistry(country);
  const levelNorm = normalizeArabic(level || '');
  const byText = (registry.grades || []).find(
    (g) => normalizeArabic(g.title) === levelNorm || normalizeArabic(g.title).includes(levelNorm) || levelNorm.includes(normalizeArabic(g.title))
  );
  if (byText) return byText;
  const ordinal = extractGradeOrdinal(levelNorm);
  if (!ordinal) return null;
  const ordinalNorm = normalizeArabic(ordinal);
  return (registry.grades || []).find((g) => normalizeArabic(g.title).includes(ordinalNorm)) || null;
}

const SUBJECT_ALIASES = {
  math: ['math', 'maths', 'رياضيات', 'الرياضيات'],
  anisi: ['anisi', 'arabic', 'reading', 'قراءة', 'أنيسي', 'أنيس'],
  science: ['science', 'ايقاظ', 'إيقاظ', 'علوم'],
  production: ['production', 'writing', 'إنتاج', 'إنتاج كتابي']
};

function findSubject(grade, subjectCode) {
  const code = String(subjectCode || '').toLowerCase();
  const aliasList = SUBJECT_ALIASES[code] || [code];
  return (grade.subjects || []).find(
    (s) => s.id === code || aliasList.some((a) => normalizeArabic(a) === normalizeArabic(s.id) || normalizeArabic(a) === normalizeArabic(s.title))
  ) || null;
}

function listBooks(country) {
  const registry = loadRegistry(country);
  const { curriculumDir } = baseDirs(country);
  const books = [];
  for (const grade of registry.grades || []) {
    for (const subject of grade.subjects || []) {
      const bookFile = subject.bookFile;
      if (!bookFile) continue;
      const book = readJson(path.join(curriculumDir, grade.dir, bookFile));
      if (!book) continue;
      books.push({
        gradeId: grade.id,
        grade: grade.title,
        gradeOrder: grade.order,
        levelId: grade.levelId,
        subjectId: subject.id,
        subject: subject.title,
        title: book.title,
        subtitle: book.subtitle,
        imageBase: book.imageBase,
        imageExt: book.imageExt || '.jpg',
        totalPages: book.totalPages,
        units: (book.units || []).map((u) => ({ id: u.id, title: u.title, icon: u.icon, color: u.color, startPage: u.startPage, endPage: u.endPage })),
        hasImages: book.imageBase ? fs.existsSync(path.join(UPLOADS_DIR, 'assets', 'books', book.imageBase.replace('/assets/books/', ''))) : false
      });
    }
  }
  return books;
}

function getBook(gradeId, subjectId, country) {
  const registry = loadRegistry(country);
  const { curriculumDir } = baseDirs(country);
  const grade = (registry.grades || []).find((g) => g.id === gradeId);
  if (!grade) return null;
  const subject = (grade.subjects || []).find((s) => s.id === subjectId);
  if (!subject || !subject.bookFile) return null;
  const book = readJson(path.join(curriculumDir, grade.dir, subject.bookFile));
  if (!book) return null;
  return { ...book, gradeId, grade: grade.title, subjectId, subject: subject.title };
}

// ===== Adapters: convert each subject's lesson file to unified pages =====

function adaptMathUnits(lessons) {
  const pages = [];
  for (const [id, item] of Object.entries(lessons)) {
    if (!item || typeof item !== 'object' || !item.title || item.ready === false) continue;
    if (item.kind && String(item.kind).startsWith('count-extra')) continue;
    const extra = item.lessonTestId ? { lessonTestId: item.lessonTestId } : {};
    // مرّر axisId و period لتمكين الـ frontend من رسم страниц التقييم كأوراق اختبار
    if (item.axisId) extra.axisId = item.axisId;
    if (item.period) extra.period = item.period;
    if (item.isAssessment) extra.isAssessment = true;
    if (item.subject) extra.subject = item.subject;
    if (item.noEnrich) extra.noEnrich = true;
    if (item.pedagogicalBasis) extra.pedagogicalBasis = item.pedagogicalBasis;
    // دروس مؤلفة للتلميذ (studentBlocks): تعرض حصرياً للتلميذ بدل القالب
    // الافتراضي (أساس بيداغوجي موجّه للمعلم) — أسئلة تفاعلية + خلاصة.
    if (Array.isArray(item.studentBlocks) && item.studentBlocks.length) {
      const blocks = item.studentBlocks
        .filter((b) => b && typeof b === 'object' && (b.text || b.title || (b.points || []).length))
        .map((b) => ({ kind: b.kind || 'concept', ...b }));
      const firstText = (blocks.find((b) => b.text)?.text) || item.title;
      pages.push({ id, title: item.title, content: firstText, domain: item.domain, blocks, ...extra });
      continue;
    }
    // دروس بلا محتوى مؤلف: صفحة تلميذ نظيفة بالعنوان فقط + تنبيه لطيف.
    // (لا نعرض كتل المذكرة: الأهداف/الأساس البيداغوجي/المحور/مرجع —
    //  مكانها مذكرة المعلم وخرائط المهارات، لا كتاب التلميذ.)
    const blocks = [
      { kind: 'concept', title: item.title, text: `درس «${item.title}» — نسخته التفاعلية قيد التحضير وستظهر هنا قريبًا. راجع دروسك المكتملة وواصل التقدم.` }
    ];
    pages.push({ id, title: item.title, content: item.title, domain: item.domain, blocks, ...extra });
  }
  return pages;
}

// ===== أنيسي (قراءة س1): أسئلة قابلة للإجابة مرتبطة بالحرف + تقييمات فترات =====

const ANISI_LETTER_CHARS = {
  'الباء': 'ب', 'التاء': 'ت', 'الثاء': 'ث', 'الجيم': 'ج', 'الحاء': 'ح', 'الخاء': 'خ',
  'الدال': 'د', 'الذال': 'ذ', 'الراء': 'ر', 'الزاي': 'ز', 'السين': 'س', 'الشين': 'ش',
  'الصاد': 'ص', 'الضاد': 'ض', 'الطاء': 'ط', 'الظاء': 'ظ', 'العين': 'ع', 'الغين': 'غ',
  'الفاء': 'ف', 'القاف': 'ق', 'الكاف': 'ك', 'اللام': 'ل', 'الميم': 'م', 'النون': 'ن',
  'الهاء': 'ه', 'الواو': 'و', 'الياء': 'ي', 'الهمزة': 'ء'
};

function anisiStrip(s) {
  return String(s || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[.,!؟:؛،"'«»()\[\]{}\-–—]/g, '')
    .trim();
}

function anisiDeAl(s) {
  return s.replace(/^(?:ٱل|ال)/, '');
}

function anisiLessonWords(lesson) {
  const seen = new Set();
  const out = [];
  const add = (raw) => {
    const display = String(raw || '').replace(/[.,!؟:؛،"'«»()\[\]{}\-–—]/g, '').trim();
    const stripped = anisiStrip(display);
    const hasAl = /^(?:ٱل|ال)/.test(stripped);
    const deAlDisplay = hasAl ? display.replace(/^(?:ٱل|ال)[\u064B-\u0652]*/, '') : display;
    const bare = anisiDeAl(stripped);
    if (!display || display.includes(' ') || bare.length < 3 || seen.has(display)) return;
    seen.add(display);
    out.push({ display, stripped, bare, hasAl, deAlDisplay });
  };
  for (const v of lesson.vocabulary || []) add(v);
  for (const line of lesson.story_text || []) for (const w of line.split(/\s+/)) add(w);
  return out;
}

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = (seed >>> 0) || 1;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function anisiMatchCh(c, ch) {
  return ch === 'ء' ? /[ءأإئؤ]/.test(c) : c === ch;
}

function anisiLetterQuestions(ch, words, allLetters, seed) {
  const qs = [];
  const others = allLetters.filter((c) => c !== ch);
  if (!others.length) return qs;
  // عرض بلا «ال» لأسئلة البداية/النهاية/الموضع حتى يرى التلميذ الحرف واضحا
  const entries = words.map((w) => ({ text: w.deAlDisplay, stripped: w.bare }));

  // 1) تمييز الحرف (دروس فقط، لا يدخل التقييم)
  const d1 = seededShuffle(others, seed).slice(0, 2);
  const opts1 = seededShuffle([ch, ...d1], seed + 1);
  qs.push({ kind: 'question', lessonLetter: true, text: 'مَا الحَرْفُ الَّذِي نَتَعَلَّمُهُ فِي هَذَا الدَّرْسِ؟', options: opts1, answer: opts1.indexOf(ch) });

  // 2) كلمة تبدأ بالحرف
  const starting = entries.filter((e) => anisiMatchCh([...e.stripped][0], ch));
  const notStarting = entries.filter((e) => !anisiMatchCh([...e.stripped][0], ch));
  if (starting.length && notStarting.length >= 2) {
    const correct = seededShuffle(starting, seed + 2)[0];
    const wrong = seededShuffle(notStarting, seed + 3).slice(0, 2);
    const opts = seededShuffle([correct, ...wrong], seed + 4).map((e) => e.text);
    qs.push({ kind: 'question', text: `أَيُّ كَلِمَةٍ تَبْدَأُ بِحَرْفِ «${ch}»؟`, options: opts, answer: opts.indexOf(correct.text) });
  }

  // 3) موضع الحرف في كلمة
  const posCandidates = entries.map((e) => {
    const chars = [...e.stripped];
    const idxs = chars.map((c, i) => (anisiMatchCh(c, ch) ? i : -1)).filter((i) => i >= 0);
    if (idxs.length !== 1) return null;
    const pos = idxs[0] === 0 ? 'أَوَّلًا' : idxs[0] === chars.length - 1 ? 'آخِرًا' : 'فِي الوَسَطِ';
    return { ...e, pos };
  }).filter(Boolean);
  if (posCandidates.length) {
    const pick = seededShuffle(posCandidates, seed + 5)[0];
    const opts = ['أَوَّلًا', 'فِي الوَسَطِ', 'آخِرًا'];
    qs.push({ kind: 'question', text: `أَيْنَ يَأْتِي حَرْفُ «${ch}» فِي كَلِمَةِ «${pick.text}»؟`, options: opts, answer: opts.indexOf(pick.pos) });
  }

  // 4) صح أو خطأ: الكلمة تحتوي الحرف
  const withL = words.filter((w) => [...w.stripped].some((c) => anisiMatchCh(c, ch)));
  const withoutL = words.filter((w) => !withL.includes(w));
  if (withL.length && withoutL.length) {
    const sayTrue = seed % 2 === 0;
    const w = seededShuffle(sayTrue ? withL : withoutL, seed + 6)[0];
    const opts = ['صَوَابٌ', 'خَطَأٌ'];
    qs.push({ kind: 'question', text: `صَحْ أَوْ خَطَأْ: كَلِمَةُ «${w.display}» فِيهَا حَرْفُ «${ch}».`, options: opts, answer: sayTrue ? 0 : 1 });
  }

  // 5) كلمة تنتهي بالحرف
  const ending = entries.filter((e) => anisiMatchCh([...e.stripped].pop(), ch));
  const notEnding = entries.filter((e) => !anisiMatchCh([...e.stripped].pop(), ch));
  if (ending.length && notEnding.length >= 2) {
    const correct = seededShuffle(ending, seed + 7)[0];
    const wrong = seededShuffle(notEnding, seed + 8).slice(0, 2);
    const opts = seededShuffle([correct, ...wrong], seed + 9).map((e) => e.text);
    qs.push({ kind: 'question', text: `أَيُّ كَلِمَةٍ تَنْتَهِي بِحَرْفِ «${ch}»؟`, options: opts, answer: opts.indexOf(correct.text) });
  }

  // 6) إكمال الحرف الأول (اختيار من متعدد) — يتخطى الهمزة لصعوبة كتابتها
  if (starting.length && ch !== 'ء') {
    const w = seededShuffle(starting, seed + 10)[0];
    const rest = w.text.slice(1).replace(/^[\u064B-\u0652]+/, '');
    const d = seededShuffle(others, seed + 11).slice(0, 2);
    const opts = seededShuffle([ch, ...d], seed + 12);
    qs.push({ kind: 'question', text: `أَيُّ حَرْفٍ يُكَمِّلُ الكَلِمَة: «......${rest}»؟`, options: opts, answer: opts.indexOf(ch) });
  }

  return qs;
}

function buildAnisiAssessment(period, unitsInPeriod, allLetters) {
  const words = [];
  const letters = [];
  for (const u of unitsInPeriod) {
    for (const l of u.lessons || []) {
      const ch = ANISI_LETTER_CHARS[l.letter];
      if (ch && !letters.includes(ch)) letters.push(ch);
      for (const w of anisiLessonWords(l)) if (!words.some((x) => x.display === w.display)) words.push(w);
    }
  }
  const seedBase = 1000 + period * 97;
  const pool = [];
  letters.forEach((ch, li) => pool.push(...anisiLetterQuestions(ch, words, allLetters, seedBase + li * 13).filter((q) => !q.lessonLetter)));
  // سؤال الحرف الأول من كلمة (مناسب للتقييم)
  const clean = words.filter((w) => !w.hasAl);
  const firstLetterQs = [];
  const usedFirst = new Set();
  for (const w of seededShuffle(clean, seedBase + 50)) {
    const first = [...w.stripped][0];
    if (usedFirst.has(first)) continue;
    usedFirst.add(first);
    const distractors = seededShuffle(allLetters.filter((c) => c !== first), seedBase + first.charCodeAt(0)).slice(0, 2);
    const opts = seededShuffle([first, ...distractors], seedBase + first.charCodeAt(0) + 1);
    firstLetterQs.push({ kind: 'question', text: `مَا الحَرْفُ الأَوَّلُ فِي كَلِمَةِ «${w.display}»؟`, options: opts, answer: opts.indexOf(first) });
    if (firstLetterQs.length === 3) break;
  }
  const combined = seededShuffle([...firstLetterQs, ...pool], seedBase + 7);
  const chosen = [];
  const usedTexts = new Set();
  for (const q of combined) {
    if (usedTexts.has(q.text)) continue;
    usedTexts.add(q.text);
    chosen.push(q);
    if (chosen.length === 6) break;
  }
  const points = [3, 3, 3, 3, 4, 4];
  const blocks = [
    { kind: 'concept', title: `📝 تقييم الفترة ${['الأُولَى', 'الثَّانِيَة', 'الثَّالِثَة', 'الرَّابِعَة'][period - 1]}`, text: 'أَنْجِزِ التَّمَارِينَ التَّالِيَةَ فِي وَرَقَةِ الاخْتِبَارِ. اِقْرَأِ السَّنَدَ جَيِّدًا ثُمَّ أَجِبْ عَنْ كُلِّ التَّعْلِيمَاتِ.' },
    { kind: 'concept', title: '📖 السند 1: كلمات تعلمناها', text: `كَلِمَاتٌ مِمَّا قَرَأْنَاهُ فِي هَذِهِ الفَتْرَة: ${words.slice(0, 6).map((w) => w.display).join('، ')}.` }
  ];
  chosen.forEach((q, i) => blocks.push({ ...q, title: `تعليم ${i + 1}`, points: points[i] || 3 }));
  return {
    id: `y1ra${period}`,
    title: `أُقَيِّمُ مُكْتَسَبَاتِي: الفَتْرَة ${['الأُولَى', 'الثَّانِيَة', 'الثَّالِثَة', 'الرَّابِعَة'][period - 1]}`,
    content: 'تقييم ختامي',
    isAssessment: true,
    period,
    subject: 'القراءة',
    lessonTestId: `year1-anisi-period-${period}-assess`,
    blocks
  };
}

function adaptAnisiLessons(book) {
  const pages = [];
  const allLetters = Object.values(ANISI_LETTER_CHARS);
  const units = book.units || [];
  const PERIOD_END = { 2: 1, 4: 2, 6: 3, 7: 4 };
  const PERIOD_START = { 1: 1, 2: 3, 3: 5, 4: 7 };
  for (const unit of units) {
    for (const lesson of unit.lessons || []) {
      const blocks = [
        { kind: 'objective', title: 'الأهداف', text: `أن يتعرّف المتعلّم على حرف ${lesson.letter} وينطقه ويقرأه ويكتبه في كلمات.` }
      ];
      const story = (lesson.story_text || []).join(' ');
      if (story) blocks.push({ kind: 'concept', title: 'نص الانطلاق', text: story });
      const ch = ANISI_LETTER_CHARS[lesson.letter];
      const words = anisiLessonWords(lesson);
      const seed = (unit.unit_number * 100 + (lesson.lesson_number || 0)) * 7 + 3;
      const qs = ch ? anisiLetterQuestions(ch, words, allLetters, seed) : [];
      qs.forEach((q, i) => blocks.push({ ...q, title: `تعليم ${i + 1}` }));
      pages.push({
        id: `u${unit.unit_number}-l${lesson.lesson_number}`,
        title: `حرف ${lesson.letter}`,
        content: story || `درس حرف ${lesson.letter}`,
        letter: lesson.letter,
        bookPage: lesson.book_page,
        image: lesson.image,
        noEnrich: true,
        blocks
      });
    }
    const period = PERIOD_END[unit.unit_number];
    if (period) {
      const group = units.filter((u) => u.unit_number >= PERIOD_START[period] && u.unit_number <= unit.unit_number);
      pages.push(buildAnisiAssessment(period, group, allLetters));
    }
  }
  return pages;
}

function adaptScienceBook(book) {
  const pages = [];
  for (const ch of book.chapters || []) {
    for (const p of ch.pages || []) {
      const type = p.type || 'lesson';
      if (type === 'cover') continue;
      const blocks = [];
      if (type === 'lesson') blocks.push({ kind: 'concept', title: p.title, text: p.text });
      if (type === 'observe') blocks.push({ kind: 'example', title: p.title || 'لاحظ', text: p.text });
      if (type === 'fact') blocks.push({ kind: 'note', title: 'هل تعلم', text: p.text });
      if (type === 'vocab') for (const w of p.words || []) blocks.push({ kind: 'keyword', title: 'كلمة', text: `${w.word || ''} ${w.emoji || ''}` });
      if (type === 'activity' || type === 'quiz') {
        const q = { kind: 'question', title: p.title || 'سؤال', text: p.prompt || '' };
        if (Array.isArray(p.options) && p.options.length) {
          q.options = p.options;
          if (p.answer !== undefined && p.answer !== null) q.answer = p.answer;
        }
        blocks.push(q);
      }
      if (type === 'experiment') {
        blocks.push({
          kind: 'experiment',
          title: p.title || 'جرّب بنفسك',
          text: p.text || '',
          materials: p.materials || [],
          steps: p.steps || []
        });
      }
      if (type === 'summary') {
        blocks.push({ kind: 'summary', title: p.title || 'خلاصة الوحدة', points: p.points || [] });
      }
      if (type === 'reward') {
        blocks.push({ kind: 'reward', title: p.title || 'أحسنت', text: p.text || '' });
      }
      pages.push({ id: `${ch.id}-${pages.length + 1}`, title: p.title || ch.title, content: p.text || '', chapter: ch.title, type, blocks });
    }
  }
  return pages;
}

// ===== Adapter: قراءة نصية (السنة 2-6) — نصوص + فهم + معجم + إنتاج =====
function adaptReadingBook(book) {
  const pages = [];
  for (const unit of book.units || []) {
    for (const lesson of unit.lessons || []) {
      const blocks = [
        {
          kind: 'objective',
          title: 'الأهداف',
          text: lesson.objective || `أن يقرأ المتعلّم نصّ «${lesson.title}» قراءة سليمة معبّرة ويفهم مضامينه ويستخرج فكرته العامة.`
        }
      ];
      const story = (lesson.story_text || []).join(' ');
      if (story) blocks.push({ kind: 'concept', title: 'نص الانطلاق', text: story });
      if (lesson.key_sentence) blocks.push({ kind: 'definition', title: 'الجملة المفتاحية', text: lesson.key_sentence });
      for (const v of lesson.vocabulary || []) blocks.push({ kind: 'keyword', title: 'كلمة', text: v });
      for (const q of lesson.comprehension || []) {
        const qb = { kind: 'question', title: 'فهم النص', text: q.prompt };
        if (Array.isArray(q.options) && q.options.length) {
          qb.options = q.options;
          if (q.answer !== undefined && q.answer !== null) qb.answer = q.answer;
        } else if (q.answer !== undefined && q.answer !== null) {
          qb.answer = q.answer;
        }
        blocks.push(qb);
      }
      if (lesson.production) blocks.push({ kind: 'activity', title: 'أُنتج', text: lesson.production });
      if (lesson.moral) blocks.push({ kind: 'reward', title: 'العبرة من النص', text: lesson.moral });
      pages.push({
        id: lesson.id,
        title: lesson.title,
        content: story || lesson.title,
        chapter: unit.title,
        bookPage: lesson.book_page,
        blocks
      });
    }
  }
  return pages;
}

// ===== Adapter: إنتاج كتابي (السنة 2-6) =====
function adaptProductionBook(book) {
  const pages = [];
  for (const unit of book.units || []) {
    for (const lesson of unit.lessons || []) {
      const blocks = [];
      if (lesson.objective) blocks.push({ kind: 'objective', title: 'الأهداف', text: lesson.objective });
      if (lesson.model) blocks.push({ kind: 'concept', title: 'نموذج', text: lesson.model });
      if (lesson.steps && lesson.steps.length) blocks.push({ kind: 'summary', title: 'خطوات الإنتاج', points: lesson.steps });
      for (const ex of lesson.exercises || []) {
        const q = { kind: 'question', title: 'تمرين', text: ex.prompt };
        if (Array.isArray(ex.options) && ex.options.length) {
          q.options = ex.options;
          if (ex.answer !== undefined && ex.answer !== null) q.answer = ex.answer;
        }
        blocks.push(q);
      }
      if (lesson.topic) blocks.push({ kind: 'activity', title: 'أنتج', text: lesson.topic });
      pages.push({
        id: lesson.id,
        title: lesson.title,
        content: lesson.model || lesson.title,
        chapter: unit.title,
        blocks
      });
    }
  }
  return pages;
}

export function getLessonPages(subjectCode, level, gradeId, country) {
  const registry = loadRegistry(country);
  const { curriculumDir } = baseDirs(country);
  let grade = gradeId ? (registry.grades || []).find((g) => g.id === gradeId) : null;
  if (!grade) grade = findGradeByLevel(level, country);
  if (!grade) return [];
  const subject = findSubject(grade, subjectCode);
  if (!subject) return [];

  const code = String(subjectCode || '').toLowerCase();
  let pages;
  if (code === 'math') {
    const lessons = readJson(path.join(curriculumDir, grade.dir, subject.lessonsFile || 'math-units.json'));
    if (!lessons) return [];
    if (subject.adapter === 'generic' || grade.id === 'year6') {
      pages = [];
      for (const [id, item] of Object.entries(lessons)) {
        if (!item || typeof item !== 'object' || !item.title) continue;
        pages.push({
          id,
          title: item.title,
          content: item.title,
          blocks: [
            { kind: 'concept', title: item.title, text: item.title },
            ...(item.content ? [{ kind: 'concept', title: 'المحتوى', text: item.content }] : [])
          ]
        });
      }
      return pages;
    }
    pages = adaptMathUnits(lessons);
  } else if (code === 'anisi' || code === 'reading' || code === 'arabic') {
    const book = readJson(path.join(curriculumDir, grade.dir, subject.lessonsFile || 'anisi-lessons-full.json'));
    if (!book) return [];
    // السنة الأولى: محوّل الحروف (أنيسي). السنة 2-6: محوّل النصوص القرائية.
    const isLetterBook = Array.isArray(book.units) && book.units.some((u) => Array.isArray(u.lessons) && u.lessons.some((l) => l.letter));
    pages = isLetterBook ? adaptAnisiLessons(book) : adaptReadingBook(book);
  } else if (code === 'science') {
    if (subject.lessonsFile) {
      const lessons = readJson(path.join(curriculumDir, grade.dir, subject.lessonsFile));
      if (lessons) pages = adaptMathUnits(lessons);
    }
    if (!pages || !pages.length) {
      const book = readJson(path.join(curriculumDir, grade.dir, subject.bookFile || 'science-book.json'));
      pages = book ? adaptScienceBook(book) : [];
    }
  } else if (code === 'production' || code === 'writing') {
    const book = readJson(path.join(curriculumDir, grade.dir, subject.lessonsFile || 'production-units.json'));
    if (!book) return [];
    if (Array.isArray(book.units)) {
      pages = adaptProductionBook(book);
    } else {
      pages = adaptMathUnits(book);
    }
  } else {
    return [];
  }
  return enrichPagesWithBankExercises(pages, code, country, gradeId, level);
}

export function searchLesson(subjectCode, level, lessonTitle, gradeId, country) {
  const pages = getLessonPages(subjectCode, level, gradeId, country);
  const titleNorm = normalizeArabic(lessonTitle || '');
  if (!titleNorm) return pages;
  return pages.filter((p) => {
    const pTitle = normalizeArabic(p.title || '');
    const pContent = normalizeArabic((p.content || '').slice(0, 200));
    return pTitle.includes(titleNorm) || titleNorm.includes(pTitle) || pContent.includes(titleNorm);
  });
}

export function getSubjectsForLevel(level, country) {
  const grade = findGradeByLevel(level, country);
  if (!grade) return [];
  return (grade.subjects || []).map((s) => ({
    id: s.id,
    title: s.title,
    aliases: s.aliases || []
  }));
}

// ===== Stories =====

const STORY_SERIES = [
  { id: 'anisi-stories', file: 'anisi-stories-data.json', title: 'أنيسي — قصصي' },
  { id: 'anisi-stories-2', file: 'anisi-stories-2-data.json', title: 'أنيسي — قصصي (2)' },
  { id: 'anisi-stories-ai', file: 'anisi-stories-ai-data.json', title: 'أنيسي — الذكاء الاصطناعي' },
  { id: 'salem', file: 'salem-stories-data.json', title: 'سالم والنظافة' },
  { id: 'haras-watani', file: 'haras-watani-stories-data.json', title: 'قصصي في وطني' },
  { id: 'iqra', file: 'iqra-series.json', title: 'اقرأ بذكاء' }
];

export function listStorySeries(country) {
  const { contentDir } = baseDirs(country);
  return STORY_SERIES.map((s) => {
    const data = readJson(path.join(contentDir, 'stories', s.file));
    return { ...s, count: Array.isArray(data) ? data.length : 0 };
  });
}

export function getStorySeries(id, country) {
  const { contentDir } = baseDirs(country);
  const series = STORY_SERIES.find((s) => s.id === id);
  if (!series) return null;
  return { ...series, stories: readJson(path.join(contentDir, 'stories', series.file)) || [] };
}

export function getStoryMap(country) {
  const { contentDir } = baseDirs(country);
  return readJson(path.join(contentDir, 'stories', 'story-map.json'));
}

// ===== Question banks =====

export function getTemplates(country) {
  const { contentDir } = baseDirs(country);
  return readJson(path.join(contentDir, 'banks', 'templates-bank.json')) || [];
}

export function getQuestionBank(country) {
  const { contentDir } = baseDirs(country);
  return readJson(path.join(contentDir, 'banks', 'question-bank.json')) || {};
}

// ===== Bank-driven interactive exercises =====

const BANK_SUBJECT_NAMES = {
  math: ['الرياضيات'],
  anisi: ['اللغة العربية', 'إنتاج كتابي'],
  reading: ['اللغة العربية', 'إنتاج كتابي'],
  arabic: ['اللغة العربية', 'إنتاج كتابي'],
  production: ['اللغة العربية', 'إنتاج كتابي'],
  science: ['الإيقاظ العلمي']
};

const QUESTION_BANK_BY_SUBJECT = {
  math: ['numbers'],
  anisi: ['letters', 'colors', 'vocab'],
  reading: ['letters', 'colors', 'vocab'],
  arabic: ['letters', 'colors', 'vocab'],
  production: ['vocab'],
  science: []
};

const CATEGORY_LABELS = {
  letters: 'الحروف',
  numbers: 'الأعداد',
  colors: 'الألوان',
  vocab: 'المفردات'
};

function normalizeBankQuestion(q) {
  if (q.type === 'tf') {
    return { kind: 'question', text: q.prompt_ar, options: ['صحيح', 'خطأ'], answer: q.correct ? 0 : 1 };
  }
  if (q.type === 'order') {
    return { kind: 'question', text: `${q.prompt_ar} (${(q.items || []).join('، ')})`, answer: (q.items || []).join(' ') };
  }
  const out = { kind: 'question', text: q.prompt_ar };
  if (Array.isArray(q.options) && q.options.length) {
    out.options = q.options;
    if (typeof q.correct === 'number' && q.correct >= 0 && q.correct < q.options.length) {
      out.answer = q.correct;
    }
  } else if (q.correct !== undefined && q.correct !== null) {
    out.answer = q.correct;
  }
  return out;
}

function bankTemplateToExercise(t) {
  return {
    id: t.id,
    title: t.title,
    subject: t.subject,
    category: t.category,
    passage: t.passage ? { title: t.passage.title, text: t.passage.text } : null,
    questions: (t.questions || []).map(normalizeBankQuestion)
  };
}

function getBankTemplatesForSubject(code, country) {
  const names = BANK_SUBJECT_NAMES[code];
  if (!names) return [];
  const all = getTemplates(country);
  return (all || []).filter((t) => names.includes(t.subject));
}

function exerciseToBlocks(ex, maxQuestions = 3, start = 0) {
  const blocks = [];
  if (ex.passage && ex.passage.text) {
    blocks.push({ kind: 'concept', title: 'نص الانطلاق', text: ex.passage.text });
  }
  const rawQuestions = ex.questions || [];
  const n = rawQuestions.length;
  for (let i = 0; i < Math.min(maxQuestions, n); i += 1) {
    const q = rawQuestions[(start + i) % n];
    if (q && q.kind) {
      blocks.push(q);
    } else {
      blocks.push(normalizeBankQuestion(q));
    }
  }
  return blocks;
}

// كلمات توقف عربية تُتجاهل عند استخراج مواضيع عناوين الدروس/القوالب
const TOPIC_STOPWORDS = new Set([
  'من', 'إلى', 'الى', 'على', 'عن', 'حتى', 'مع', 'بين', 'عند', 'بعد', 'قبل', 'فوق', 'تحت',
  'في', 'كما', 'ثم', 'أو', 'او', 'أن', 'ان', 'ما', 'لا', 'كل', 'بعض', 'هذا', 'هذه', 'ذلك',
  'تلك', 'بدون', 'عبر', 'لأن', 'بأن', 'وأن', 'غير'
]);

// يستخرج "موضوع" العنوان: كلمات معبّرة (بلا كلمات توقف، بلا أرقام، بلا حروف قصيرة)
function topicWords(text) {
  const norm = normalizeArabic(text || '')
    .replace(/[\d٠-٩0-9]+/g, ' ')
    .replace(/[^\u0600-\u06FF\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !TOPIC_STOPWORDS.has(w));
  return [...new Set(norm)];
}

function templateMatchesLesson(template, page) {
  const tWords = topicWords(template.title);
  const pWords = topicWords(page.title || '');
  if (!tWords.length || !pWords.length) return false;
  let shared = 0;
  for (const w of tWords) if (pWords.includes(w)) shared += 1;
  if (shared === 0) return false;
  // كلمة مميّزة واحدة كافية (طولها ≥ 6)، أو كلمتان قصيرتان (≥ 4)
  return shared >= 2 || tWords.some((w) => w.length >= 6 && pWords.includes(w));
}

// يرفق بالدرس فقط القوالب التي يطابق موضوعها موضوع الدرس — البنك كله من مستوى س1
// (العدّ من 1 إلى 10، الجمع البسيط...) لذا لا يُرفق إلا بدروس س1، والسنوات 2-6 تبقى
// بمحتواها الأصلي فقط (لا ننقل محتوى من مستوى أدنى لمستوى أعلى).
function enrichPagesWithBankExercises(pages, code, country, gradeId, level) {
  const resolved = gradeId ? null : (level ? findGradeByLevel(level, country) : null);
  const isYear1 = gradeId === 'year1' || resolved?.id === 'year1';
  if (!isYear1) return pages;
  if (!pages.length) return pages;
  const templates = getBankTemplatesForSubject(code, country);
  if (!templates.length) return pages;
  const AUTHORED_KINDS = new Set(['textarea', 'math-input', 'drawing', 'file-upload', 'picture-choice', 'match-pairs']);
  return pages.map((page) => {
    // الدروس المؤلفة ودروس التقييم لها محتواها المضبوط — لا نلوثها
    // بأسئلة دخيلة من البنك (كانت تظهر لتلميذ 6 سنوات بلا صور ولا سياق).
    const authored = page.noEnrich || page.lessonTestId || (page.blocks || []).some((b) => AUTHORED_KINDS.has(b.kind));
    if (authored) return page;
    const matches = templates.filter((t) => templateMatchesLesson(t, page));
    if (!matches.length) return page;
    // اختيار حتمي (حسب معرّف الدرس) بين القوالب المطابقة — يمنع تكرار نفس
    // السؤال في دروس متتالية من نفس الموضوع، وتدوير الأسئلة داخل القالب نفسه
    let h = 0;
    for (const ch of String(page.id || page.title || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const template = matches[h % matches.length];
    const start = (template.questions || []).length ? h % template.questions.length : 0;
    const blocks = exerciseToBlocks(template, 3, start);
    return { ...page, blocks: [...(page.blocks || []), ...blocks] };
  });
}

export function getBookExercises(subjectCode, level, gradeId, country) {
  const registry = loadRegistry(country);
  let grade = gradeId ? (registry.grades || []).find((g) => g.id === gradeId) : null;
  if (!grade) grade = findGradeByLevel(level, country);
  if (!grade) return [];
  const code = String(subjectCode || '').toLowerCase();
  const subject = findSubject(grade, code);
  if (!subject) return [];

  const exercises = getBankTemplatesForSubject(code, country).map(bankTemplateToExercise);

  const qb = getQuestionBank(country);
  for (const cat of QUESTION_BANK_BY_SUBJECT[code] || []) {
    for (const q of qb[cat] || []) {
      if (q.lang === 'en' || !q.prompt_ar) continue;
      exercises.push({
        id: `qb-${cat}-${exercises.length + 1}`,
        title: q.prompt_ar,
        subject: (subject && subject.title) || code,
        category: cat,
        passage: q.emoji ? { title: CATEGORY_LABELS[cat] || cat, text: q.emoji } : null,
        questions: [{ kind: 'question', text: q.prompt_ar, options: q.options, answer: q.correct }]
      });
    }
  }
  return exercises;
}

// ===== Shared methodology docs =====

export function getMethodologies() {
  const dir = path.join(CURRICULUM_DIR, 'shared', 'methodologies');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    const doc = readJson(path.join(dir, f));
    return { file: f, title: doc?.title || f, content: doc };
  });
}

// ===== Annual plans (HTML + images) =====

export function getPlans(country) {
  const { contentDir } = baseDirs(country);
  const plansDir = path.join(contentDir, 'plans');
  const subjects = ['preliminary', 'arabic', 'math', 'science'];
  const labels = {
    preliminary: 'الفترة التمهيدية',
    arabic: 'اللغة العربية',
    math: 'الرياضيات',
    science: 'الإيقاظ العلمي'
  };
  if (!fs.existsSync(plansDir)) return [];
  const out = [];
  for (const subj of subjects) {
    const bodyPath = path.join(plansDir, subj, 'body.html');
    if (!fs.existsSync(bodyPath)) continue;
    const html = fs.readFileSync(bodyPath, 'utf8');
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const firstHead = (html.match(/<h[12][^>]*>([^<]+)</i) || [])[1];
    out.push({
      id: subj,
      title: labels[subj] || subj,
      heading: firstHead || titleMatch?.[1] || labels[subj] || subj,
      html: html.replace(/"\/plans\//g, '"/plans/').replace(/src="(\/plans\/[^"]+)"/g, 'src="$1"'),
      images: fs.existsSync(path.join(plansDir, subj, 'media'))
        ? fs.readdirSync(path.join(plansDir, subj, 'media')).filter((f) => /\.(png|jpe?g|gif|svg|webp)$/i.test(f))
        : []
    });
  }
  return out;
}

export { listBooks, getBook, loadRegistry, findGradeByLevel };
