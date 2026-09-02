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

// كراس تمارين الرياضيات (س1): محتوى مبني من ملف الكراس المقدّم (math-workbook.json).
// كل سؤال يؤخذ كما هو في الكراس مع نوع تفاعلي (mcq/imgchoice/count/write/click/match/order/fill/multi/activity).
function adaptMathWorkbook(wb) {
  return (wb.lessons || []).map((l) => ({
    id: l.id,
    title: l.title,
    content: l.story || '',
    domain: l.domain,
    blocks: [
      ...(l.objective ? [{ kind: 'objective', title: 'الهدف من الدرس', text: l.objective }] : []),
      ...(l.story ? [{ kind: 'concept', title: 'نصّ الانطلاق', text: l.story }] : []),
      ...(l.remember ? [{ kind: 'note', title: 'تذكّر', text: l.remember }] : []),
      ...(l.questions || []).map((q) => {
        const b = { kind: 'question', type: q.type, title: q.text, text: q.text };
        if (q.img) b.img = q.img;
        if (q.options) b.options = q.options;
        if (q.answer !== undefined && q.answer !== null) b.answer = q.answer;
        if (q.left) b.left = q.left;
        if (q.right) b.right = q.right;
        if (q.items) b.items = q.items;
        if (q.rows) b.rows = q.rows;
        return b;
      })
    ]
  }));
}

function adaptMathUnits(lessons, contentPath) {
  const content = contentPath ? readJson(contentPath) || {} : {};
  const pages = [];
  for (const [id, item] of Object.entries(lessons)) {
    if (!item || typeof item !== 'object' || !item.title || item.ready === false) continue;
    if (item.kind && String(item.kind).startsWith('count-extra')) continue;
    const blocks = [
      { kind: 'objective', title: 'الأهداف', text: item.pedagogicalBasis ? `أن يتعرّف المتعلّم على: ${item.title}.` : `أن يتقن المتعلّم: ${item.title}.` }
    ];
    const c = content[id] || {};
    if ((c.text || []).length) blocks.push({ kind: 'concept', title: 'نصّ الانطلاق', text: c.text.join(' ') });
    if (item.pedagogicalBasis) blocks.push({ kind: 'concept', title: 'الأساس البيداغوجي', text: item.pedagogicalBasis });
    if (item.domain) blocks.push({ kind: 'definition', title: 'المحور', text: item.domain });
    for (const act of item.activities || []) blocks.push({ kind: 'example', title: 'نشاط', text: act });
    if (item.officialRef?.pages) blocks.push({ kind: 'note', title: 'مرجع', text: `${item.officialRef.source || 'الكتاب'} — ص ${item.officialRef.pages}` });
    for (const q of c.questions || []) {
      const qb = { kind: 'question', title: 'سؤال', text: q.prompt };
      if (Array.isArray(q.options) && q.options.length) {
        qb.options = q.options;
        if (q.answer !== undefined && q.answer !== null) qb.answer = q.answer;
      }
      blocks.push(qb);
    }
    pages.push({ id, title: item.title, content: c.text ? c.text.join(' ') : (item.pedagogicalBasis || item.title), domain: item.domain, blocks });
  }
  return pages;
}

// ===== توليد أسئلة قراءة س1 (أنيسي): نصّ الانطلاق + 5 أسئلة لكل درس =====

const TASHKEEL = /[\u064B-\u0652\u0670\u0640]/g;
function normAr(s) {
  return (s || '')
    .replace(TASHKEEL, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}
function wordsAr(s) {
  return new Set(normAr(s).split(' ').filter((w) => w.length >= 2));
}
function bareLetter(letter) {
  const name = String(letter || '').replace(/^ال/, '');
  if (normAr(name) === 'همزه') return 'ء';
  return normAr(name)[0] || '';
}
function speakerAnswerIndex(story, options) {
  const src = normAr(story);
  const m = src.match(/قَالَ(?:ت)?\s+([^:«،؛\s][^:«،؛]{0,20}?)\s*:/);
  if (m) {
    const sp = normAr(m[1]);
    const idx = options.findIndex((o) => sp.includes(normAr(o).split(' ')[0]) || normAr(o).split(' ')[0].includes(sp));
    if (idx >= 0) return idx;
  }
  let best = -1;
  let bestPos = Infinity;
  options.forEach((o, i) => {
    const pos = src.indexOf(normAr(o).split(' ')[0]);
    if (pos >= 0 && pos < bestPos) { bestPos = pos; best = i; }
  });
  return best;
}
function deriveAnswerIndex(options, source) {
  const src = normAr(source);
  const srcWords = wordsAr(source);
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < options.length; i += 1) {
    const on = normAr(options[i]);
    let score = src.includes(on) ? 100000 : 0;
    let overlap = 0;
    for (const w of wordsAr(options[i])) if (srcWords.has(w)) overlap += 1;
    score += overlap;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
function pickDistractor(vocab, allVocab, letter) {
  const pool = allVocab.filter((w) => !normAr(w).includes(letter) && !vocab.includes(w));
  return pool.length ? pool[Math.abs(pool.length / 2 | 0) % pool.length] : null;
}

// ===== رسوم كرتونية بالإيموجي لمفردات القراءة =====
const WORD_EMOJI = {
  'مكتب': '📚', 'سبوره': '🧑‍🏫', 'مبراه': '✏️', 'حاسوب': '💻', 'مصطبه': '🛏️', 'طباشير': '🖍️',
  'طفل': '🧒', 'اعلام': '🚩', 'قلم': '🖊️', 'مقص': '✂️', 'ممحاة': '🧽', 'محفظه': '🎒',
  'ممر المترجلين': '🚸', 'ميده حمرياء': '🚏', 'ميده': '🚏', 'معرض رسوم': '🖼️', 'كرسي': '🪑',
  'درج': '🪜', 'مسطره': '📏', 'سياره سباق': '🏎️', 'رواق المدرسه': '🏫', 'رساله قصيره': '✉️',
  'ورده': '🌹', 'ديك': '🐓', 'اولاد': '👦', 'باقه ورود': '💐', 'ديك رومي': '🦃', 'دوامه': '🌀',
  'فستان': '👗', 'ستار': '🪟', 'فانوس': '🏮', 'مربي اسمك': '🐠', 'شاشه الحاسوب': '🖥️',
  'بساط': '🧶', 'اريكه': '🛋️', 'شباك': '🪟', 'كراس': '📓', 'حكيات عجيه': '📚',
  'كتاب القراءه': '📖', 'حنفيه': '🚰', 'صابون': '🧼', 'اسنان': '🦷', 'قنديل معلق': '🪔',
  'نافوره من المرمر': '⛲', 'منزل عتيق': '🏠', 'فرشاه': '🪥', 'مفتاح': '🔑',
  'الماء': '💧', 'المطر': '🌧️', 'مطريه': '☂️', 'طاووس': '🦚', 'اوزه': '🪿',
  'ناجح': '🏆', 'تجاره': '🏪', 'نقاش': '🎨', 'منقوشه': '🖼️', 'خلود': '🌟',
  'خابيه': '🫙', 'عصافير': '🐦', 'قفص': '🪺', 'مريم': '👧', 'ميساء': '👧',
  'جني': '🧺', 'رضوان': '👦', 'رياض': '🏃', 'بليغ': '📣', 'غاده': '👧',
  'ثامر': '👦', 'تمثيليه': '🎭', 'ذئب': '🐺', 'مهرج': '🤡', 'المشاهدين': '👀',
  'بهلوانيه': '🤹', 'حقنه التلقيح': '💉', 'الحيبه': '🎒',
  'وقف': '🧍', 'زار': '🚶', 'ترقص': '💃', 'غناء': '🎤', 'حفظ': '📖', 'نظيف': '🧼',
  'لذيذ': '😋', 'تروي': '💧', 'صنع': '🔨', 'اشار': '👉', 'خديجه': '👧', 'حمزه': '👦',
  'طارق': '👦', 'شكري': '👦', 'حازم': '👦', 'غيث': '🌧️', 'ارض': '🌍', 'اريج': '🌸',
  'رواق': '🏫', 'انحاء': '🧭', 'تساقط': '🍂'
};
const CARD_STOPWORDS = ['هذا', 'الان'];
function emojiFor(word) {
  const n = normAr(word);
  for (const [k, v] of Object.entries(WORD_EMOJI)) if (n.includes(normAr(k))) return v;
  return '🔤';
}

// ===== بنّاؤو الأسئلة المتنوعة الإضافية للقراءة =====
function buildMultiLetterWords(letter, vocab, allVocab, salt) {
  const ch = bareLetter(letter);
  if (!ch) return null;
  const withL = (vocab || []).filter((w) => normAr(w).includes(ch));
  const pool = (allVocab || []).filter((w) => !normAr(w).includes(ch));
  if (withL.length < 2 || pool.length < 3) return null;
  const start = Math.abs(salt * 7 + 3) % pool.length;
  const d1 = pool[start];
  const d2 = pool[(start + 11) % pool.length];
  if (d1 === d2) return null;
  const items = salt % 2 === 0 ? [withL[0], d1, withL[1], d2] : [d1, withL[0], d2, withL[1]];
  const answer = items.map((w, i) => (normAr(w).includes(ch) ? i : -1)).filter((i) => i >= 0);
  return {
    kind: 'question',
    type: 'multi',
    title: `أَضَعُ عَلَامَةَ ✓ تَحْتَ كُلِّ كَلِمَةٍ فِيهَا حَرْفُ «${letter}».`,
    text: `أَضَعُ عَلَامَةَ ✓ تَحْتَ كُلِّ كَلِمَةٍ فِيهَا حَرْفُ «${letter}».`,
    items,
    answer
  };
}

function buildEmojiLetterChoice(letter, vocab, allVocab, salt) {
  const ch = bareLetter(letter);
  if (!ch) return null;
  const withL = (vocab || []).filter((w) => normAr(w).includes(ch));
  const pool = (allVocab || []).filter((w) => !normAr(w).includes(ch));
  if (withL.length < 2 || pool.length < 3) return null;
  const p1 = pool[Math.abs(salt * 5 + 1) % pool.length];
  const p2 = pool[(Math.abs(salt * 5 + 1) + 13) % pool.length];
  if (p1 === p2) return null;
  const opts = salt % 2 === 0 ? [withL[0], p1, withL[1], p2] : [p1, withL[0], p2, withL[1]];
  const answer = opts.findIndex((w) => normAr(w).includes(ch));
  return {
    kind: 'question',
    type: 'imgchoice',
    title: `أَخْتَارُ الصُّورَةَ الَّتِي اسْمُهَا فِيهَا حَرْفُ «${letter}».`,
    text: `أَخْتَارُ الصُّورَةَ الَّتِي اسْمُهَا فِيهَا حَرْفُ «${letter}».`,
    options: opts.map((w) => ({ caption: w, emoji: emojiFor(w) })),
    answer
  };
}

function buildFillKeySentence(key, vocab) {
  const words = String(key || '').split(/\s+/).filter(Boolean);
  if (words.length < 4) return null;
  let idx = words.findIndex((w) => (vocab || []).some((v) => normAr(w) === normAr(v)));
  if (idx < 0 || idx === 0 || idx === words.length - 1) {
    // بديل: أطول كلمة محتوية في وسط الجملة — تفضيل غير المبدوءة بأداة عطف (و/ف)
    let bestLen = 0;
    let altLen = 0;
    let altIdx = -1;
    words.forEach((w, i) => {
      if (i === 0 || i === words.length - 1) return;
      const bare = normAr(w).replace(/[^\u0621-\u064A]/g, '');
      if (bare.length < 3) return;
      if (/^[وف]/.test(bare)) {
        if (bare.length > altLen) { altLen = bare.length; altIdx = i; }
        return;
      }
      if (bare.length > bestLen) { bestLen = bare.length; idx = i; }
    });
    if (idx < 0 || idx === 0 || idx === words.length - 1) idx = altIdx;
  }
  if (idx < 0) return null;
  const target = words[idx];
  const masked = words.map((w, i) => (i === idx ? '______' : w)).join(' ');
  return {
    kind: 'question',
    type: 'fill',
    title: 'أَكْمِلُ الجُمْلَةَ بِالكَلِمَةِ النَّاقِصَةِ.',
    text: key,
    rows: [{ label: masked, answer: [target] }]
  };
}

function buildOrderKeySentence(key, salt) {
  const words = String(key || '').split(/\s+/).filter(Boolean);
  if (words.length < 4 || words.length > 8) return null;
  const shuffled = words.map((_, i) => i);
  let h = (salt + 1) * 131 + words.length;
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    h = (h * 31 + i * 7) >>> 0;
    const j = h % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (shuffled.every((v, i) => v === i)) [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  return {
    kind: 'question',
    type: 'order',
    title: 'أُرَتِّبُ كَلِمَاتِ الجُمْلَةِ.',
    text: key,
    items: shuffled.map((i) => words[i]),
    answer: words.map((_, pos) => shuffled.indexOf(pos))
  };
}
function buildQuoteQuestion(story) {
  const quotes = [...story.matchAll(/«([^»]+)»/g)].map((m) => m[1].trim());
  const dashLines = story.split(/\n|(?=\s*-)/).map((s) => s.trim()).filter((s) => /^[-–]/.test(s)).map((s) => s.replace(/^[-–]\s*/, '').trim());
  const candidates = quotes.length ? quotes : dashLines;
  if (!candidates.length) return null;
  const names = [];
  const after = story.match(/قَالَ(?:ت)?\s+([^:«،؛\s][^:«،؛]*?)(?=\s*[:«])/);
  if (after) names.push(normAr(after[1]).split(' ')[0]);
  for (const m of story.matchAll(/يَا\s+([^\s،.]+)/g)) names.push(normAr(m[1]).split(' ')[0]);
  const before = story.match(/([^:.\s،]+)\s*(?:و)?قَالَ(?:ت)?\s*:/);
  if (before) names.push(normAr(before[1]).split(' ')[0]);
  const uniq = [...new Set(names.filter(Boolean))];
  if (uniq.length < 2) return null;
  const [speaker, other] = uniq;
  const q = candidates[0];
  return {
    kind: 'question',
    type: 'mcq',
    title: `مَنِ ٱلَّذِي قَالَ: «${q}»؟`,
    text: `مَنِ ٱلَّذِي قَالَ: «${q}»؟`,
    options: [speaker, other],
    answer: 0
  };
}
function buildCompleteQuestion(keySentence, vocab, story) {
  const source = keySentence || story;
  const n = normAr(source);
  const words = n.split(' ').filter((w) => w.length >= 3);
  if (!words.length || !vocab.length) return null;
  const target = words.reduce((a, b) => (b.length > a.length ? b : a));
  const distractor1 = vocab.find((v) => normAr(v) !== target && normAr(v).length >= 3);
  const distractor2 = vocab.find((v) => normAr(v) !== target && normAr(v) !== (distractor1 && normAr(distractor1)) && normAr(v).length >= 3);
  if (!distractor1 || !distractor2) return null;
  const blanked = source.replace(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '_____');
  if (blanked === source) return null;
  return {
    kind: 'question',
    type: 'mcq',
    title: 'أُكْمِلُ ٱلْجُمْلَةَ بِٱلْبِطَاقَةِ ٱلْمُنَاسِبَةِ.',
    text: `أُكْمِلُ ٱلْجُمْلَةَ: «${blanked}» بِٱلْبِطَاقَةِ ٱلْمُنَاسِبَةِ.`,
    options: [target, normAr(distractor1), normAr(distractor2)],
    answer: 0
  };
}
function buildPositionQuestion(letter, vocab) {
  if (!letter || !vocab.length) return null;
  for (const v of vocab) {
    const n = normAr(v);
    if (!n.includes(letter) || n.length < 3) continue;
    const idx = n.indexOf(letter);
    const pos = idx === 0 ? 'أَوَّلُهَا' : idx === n.length - 1 ? 'آخِرُهَا' : 'وَسَطُهَا';
    const others = ['أَوَّلُهَا', 'وَسَطُهَا', 'آخِرُهَا'].filter((p) => p !== pos);
    return {
      kind: 'question',
    type: 'mcq',
      title: `أَيْنَ تَجِدُ حَرْفَ «${letter}» فِي كَلِمَةِ «${v}»؟`,
      text: `أَيْنَ تَجِدُ حَرْفَ «${letter}» فِي كَلِمَةِ «${v}»؟`,
      options: [pos, ...others],
      answer: 0
    };
  }
  return null;
}
function buildWordQuestion(letter, vocab, allVocab) {
  if (!letter) return null;
  const withLetter = vocab.filter((v) => normAr(v).includes(letter));
  if (withLetter.length < 2) return null;
  const distractor = pickDistractor(vocab, allVocab, letter);
  if (!distractor) return null;
  const opts = [withLetter[0], withLetter[1], distractor];
  return {
    kind: 'question',
    type: 'mcq',
    title: `أَيُّ كَلِمَةٍ فِيهَا حَرْفُ «${letter}»؟`,
    text: `أَيُّ كَلِمَةٍ فِيهَا حَرْفُ «${letter}»؟`,
    options: opts,
    answer: 0
  };
}
function splitSentences(text) {
  return normAr(text).split(/(?<=[.!؟؟…])\s*/).map((s) => s.trim()).filter((s) => s.length >= 6);
}
function buildChoiceQuestion(story, vocab, salt) {
  const sentences = splitSentences(story);
  if (!sentences.length) return null;
  const source = sentences[salt % sentences.length];
  const words = source.split(' ').filter((w) => w.length >= 3);
  if (!words.length) return null;
  const target = words[(salt + 1) % words.length];
  const subs = vocab.map(normAr).filter((v) => v.length >= 3 && v !== target && !source.includes(v));
  if (subs.length < 2) return null;
  const a = subs[salt % subs.length];
  const b = subs[(salt + 1) % subs.length];
  if (a === b) return null;
  const re = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return {
    kind: 'question',
    type: 'mcq',
    title: 'أَخْتَارُ ٱلْجُمْلَةَ ٱلصَّحِيحَةَ حَسَبَ ٱلنَّصِّ.',
    text: 'أَخْتَارُ ٱلْجُمْلَةَ ٱلصَّحِيحَةَ حَسَبَ ٱلنَّصِّ.',
    options: [source.replace(re, a), source.replace(re, b), source],
    answer: 2
  };
}
function storyWordsUnique(story) {
  return [...new Set(splitSentences(story).flatMap((s) => s.split(' ')))].filter((w) => w.length >= 3);
}
function buildFirstWordQuestion(story) {
  const words = storyWordsUnique(story);
  if (words.length < 3) return null;
  return {
    kind: 'question',
    type: 'mcq',
    title: 'مَا هِيَ أَوَّلُ كَلِمَةٍ فِي ٱلنَّصِّ؟',
    text: 'مَا هِيَ أَوَّلُ كَلِمَةٍ فِي ٱلنَّصِّ؟',
    options: [words[0], words[1], words[2]],
    answer: 0
  };
}
function buildLetterStartQuestion(story, letter, salt) {
  if (!letter) return null;
  const words = storyWordsUnique(story);
  const start = words.filter((w) => w.startsWith(letter));
  if (!start.length) return null;
  const others = words.filter((w) => !w.startsWith(letter)).slice(0, 2);
  if (others.length < 2) return null;
  return {
    kind: 'question',
    type: 'mcq',
    title: `أَيُّ كَلِمَةٍ فِي ٱلنَّصِّ تَبْدَأُ بِحَرْفِ «${letter}»؟`,
    text: `أَيُّ كَلِمَةٍ فِي ٱلنَّصِّ تَبْدَأُ بِحَرْفِ «${letter}»؟`,
    options: [start[salt % start.length], others[0], others[1]],
    answer: 0
  };
}
function buildNotInTextQuestion(story, vocab, salt) {
  const inside = storyWordsUnique(story).slice(0, 2);
  const outside = vocab.map(normAr).filter((v) => v.length >= 3 && !splitSentences(story).join(' ').includes(v));
  if (inside.length < 2 || !outside.length) return null;
  return {
    kind: 'question',
    type: 'mcq',
    title: 'أَيُّ كَلِمَةٍ لَيْسَتْ مِنْ كَلِمَاتِ ٱلنَّصِّ؟',
    text: 'أَيُّ كَلِمَةٍ لَيْسَتْ مِنْ كَلِمَاتِ ٱلنَّصِّ؟',
    options: [inside[0], inside[1], outside[salt % outside.length]],
    answer: 2
  };
}
function buildCompleteFromSentence(story, vocab, salt) {
  const sentences = splitSentences(story);
  if (!sentences.length) return null;
  const source = sentences[salt % sentences.length];
  const words = source.split(' ').filter((w) => w.length >= 3);
  if (!words.length) return null;
  const target = words[(salt + 2) % words.length];
  const subs = vocab.map(normAr).filter((v) => v.length >= 3 && v !== target && !source.includes(v));
  if (!subs.length) return null;
  const correct = target;
  const a = subs[salt % subs.length];
  const b = subs[(salt + 1) % subs.length];
  if (a === b) return null;
  const blanked = source.replace(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '_____');
  if (blanked === source) return null;
  return {
    kind: 'question',
    type: 'mcq',
    title: 'أُكْمِلُ ٱلْجُمْلَةَ بِٱلْبِطَاقَةِ ٱلْمُنَاسِبَةِ.',
    text: `أُكْمِلُ ٱلْجُمْلَةَ: «${blanked}» بِٱلْبِطَاقَةِ ٱلْمُنَاسِبَةِ.`,
    options: [correct, a, b],
    answer: 0
  };
}
function buildTrueFalseQuestion(story, vocab, salt) {
  const sentences = splitSentences(story);
  if (!sentences.length) return null;
  const source = sentences[salt % sentences.length];
  const words = source.split(' ').filter((w) => w.length >= 3);
  if (!words.length) return null;
  const target = words[salt % words.length];
  const sub = vocab.map(normAr).find((v) => v.length >= 3 && v !== target && !source.includes(v));
  if (!sub) return null;
  const mutated = source.replace(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), sub);
  if (mutated === source) return null;
  return {
    kind: 'question',
    type: 'mcq',
    title: 'هَلِ ٱلْجُمْلَةُ صَحِيحَةٌ حَسَبَ ٱلنَّصِّ؟',
    text: `هَلِ ٱلْجُمْلَةُ صَحِيحَةٌ حَسَبَ ٱلنَّصِّ: «${mutated}»؟`,
    options: ['صَحِيحٌ', 'خَطَأٌ'],
    answer: 1
  };
}

function adaptAnisiLessons(book) {
  const pages = [];
  const allVocab = (book.units || []).flatMap((u) => (u.lessons || []).flatMap((l) => l.vocabulary || []));
  for (const unit of book.units || []) {
    for (const lesson of unit.lessons || []) {
      const story = (lesson.story_text || []).join(' ');
      const key = lesson.key_sentence || '';
      const vocab = lesson.vocabulary || [];
      const letter = bareLetter(lesson.letter);
      const blocks = [];
      if (story) blocks.push({ kind: 'concept', title: 'نص الانطلاق', text: story });
      const questions = [];
      const exList = lesson.workbook_exercises || [];
      const markEx = exList.find((ex) => /ٱلْعَلَامَةَ\s*x/i.test(ex.instr) && Array.isArray(ex.options) && ex.options.length >= 2);
      if (markEx) {
        const answer = Array.isArray(markEx.answers) && typeof markEx.answers[0] === 'number'
          ? markEx.answers[0]
          : deriveAnswerIndex(markEx.options, `${story} ${key}`);
        if (answer >= 0 && answer < markEx.options.length) {
          questions.push({
            kind: 'question',
            type: 'mark',
            title: markEx.instr,
            text: markEx.instr,
            items: markEx.options.map((o, i) => ({ text: o, correct: i === answer }))
          });
        }
      }
      const matchEx = exList.find((ex) => /أَرْبُطُ|أُوَصِلُ/.test(ex.instr) && Array.isArray(ex.left_items) && Array.isArray(ex.right_items) && ex.left_items.length >= 2 && ex.left_items.length === ex.right_items.length);
      if (matchEx) {
        questions.push({
          kind: 'question',
          type: 'match',
          title: matchEx.instr,
          text: matchEx.instr,
          left: matchEx.left_items,
          right: matchEx.right_items
        });
      }
      for (const ex of exList) {
        if (questions.length >= 5) break;
        if (ex === markEx || ex === matchEx) continue;
        if (!Array.isArray(ex.options) || ex.options.length < 2) continue;
        let answer;
        if (/قَال|صَاحِبِ|ٱلْقَوْلِ/.test(ex.instr)) {
          answer = speakerAnswerIndex(`${story} ${key}`, ex.options);
        } else {
          answer = Array.isArray(ex.answers) && typeof ex.answers[0] === 'number'
            ? ex.answers[0]
            : deriveAnswerIndex(ex.options, `${story} ${key}`);
        }
        if (answer < 0 || answer >= ex.options.length) continue;
        questions.push({ kind: 'question', type: 'mcq', title: ex.instr, text: ex.instr, options: ex.options, answer });
      }
      if (questions.length < 5) {
        const qq = buildQuoteQuestion(story);
        if (qq) questions.push(qq);
      }
      if (questions.length < 5) {
        const cq = buildCompleteQuestion(key, vocab, story);
        if (cq) questions.push(cq);
      }
      if (questions.length < 5) {
        const pq = buildPositionQuestion(letter, vocab);
        if (pq) questions.push(pq);
      }
      if (questions.length < 5) {
        const wq = buildWordQuestion(letter, vocab, allVocab);
        if (wq) questions.push(wq);
      }
      let salt = 0;
      let tries = 0;
      while (questions.length < 5 && tries < 60) {
        tries += 1;
        const builders = [
          buildChoiceQuestion,
          buildTrueFalseQuestion,
          buildCompleteFromSentence,
          buildFirstWordQuestion,
          buildLetterStartQuestion,
          buildNotInTextQuestion
        ];
        const builder = builders[salt % builders.length];
        const q = builder.name === 'buildLetterStartQuestion'
          ? builder(story, letter, salt)
          : builder.name === 'buildFirstWordQuestion'
            ? builder(story)
            : builder(story, vocab, salt);
        salt += 1;
        if (!q) continue;
        if (questions.some((x) => x.title === q.title)) continue;
        questions.push(q);
      }
      // ===== تنويع إضافي: أنواع تفاعلية جديدة (✓ متعدد، صور بالإيموجي، إكمال، ترتيب) =====
      const extraBuilders = [
        (s) => buildMultiLetterWords(letter, vocab, allVocab, s),
        (s) => buildEmojiLetterChoice(letter, vocab, allVocab, s),
        () => buildFillKeySentence(key, vocab),
        (s) => buildOrderKeySentence(key, s)
      ];
      extraBuilders.forEach((fn, i) => {
        if (questions.length >= 9) return;
        const q = fn(i);
        if (!q) return;
        if (questions.some((x) => x.title === q.title)) return;
        questions.push(q);
      });
      blocks.push(...questions);
      pages.push({
        id: `u${unit.unit_number}-l${lesson.lesson_number}`,
        title: `حرف ${lesson.letter}`,
        content: story || `درس حرف ${lesson.letter}`,
        letter: lesson.letter,
        bookPage: lesson.book_page,
        image: lesson.image,
        vocabEmojis: (() => {
          const candidates = (vocab || []).filter((w) => !CARD_STOPWORDS.some((s) => normAr(w) === s));
          const known = candidates.filter((w) => emojiFor(w) !== '🔤').slice(0, 3).map((w) => ({ word: w, emoji: emojiFor(w) }));
          if (known.length >= 3) return known;
          const rest = candidates.map((w) => ({ word: w, emoji: emojiFor(w) })).filter((c) => !known.some((k) => k.word === c.word));
          return [...known, ...rest].slice(0, 3);
        })(),
        blocks
      });
    }
  }
  return pages;
}

// ===== التربية التقنية س1: ورشات تطبيقية من كتاب المستخدم (tech-book.json) =====
function adaptTechBook(book) {
  return (book.lessons || []).map((l) => ({
    id: l.id,
    title: l.title,
    content: l.mission || '',
    domain: 'ورشات تطبيقية',
    image: l.image,
    blocks: [
      ...(l.mission ? [{ kind: 'concept', title: 'مع أنيسي', text: l.mission }] : []),
      ...(l.questions || []).map((q) => ({
        kind: 'question',
        type: 'write',
        title: q.text,
        text: q.text,
        input: 'text',
        ...(q.answerHint ? { answerHint: q.answerHint } : {})
      }))
    ]
  }));
}

// ===== التربية الإسلامية س1: من كتاب المستخدم (islamic-book.json) =====
function adaptIslamicBook(book) {
  return (book.lessons || []).map((l) => ({
    id: l.id,
    title: l.title,
    content: l.sanad || '',
    domain: `${l.period || ''} — ${l.axis || ''}`.replace(/^ — /, ''),
    image: l.image,
    blocks: [
      ...(l.sanad ? [{ kind: 'concept', title: 'السَّنَد', text: l.sanad }] : []),
      ...(l.quote ? [{ kind: 'note', title: l.quoteType || 'اقتباس', text: l.quote }] : []),
      ...(l.questions || []).map((q) => {
        const b = { kind: 'question', type: q.type, title: q.text, text: q.text };
        if (q.input) b.input = q.input;
        if (q.options) b.options = q.options;
        if (q.answer !== undefined && q.answer !== null) b.answer = q.answer;
        if (q.left) b.left = q.left;
        if (q.right) b.right = q.right;
        return b;
      })
    ]
  }));
}

function adaptScienceBook(book) {
  const pages = [];
  for (const ch of book.chapters || []) {
    // صورة الفصل الكرتونية من مصدر المستخدم (science-y1-NN-chNN.png)
    const chNum = parseInt(String(ch.id || '').replace(/^ch/, ''), 10);
    const chapterImage = Number.isFinite(chNum) ? `/science/science-y1-${String(chNum).padStart(2, '0')}-ch${chNum}.png` : null;
    let firstLessonDone = false;
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
      // الصورة على أول صفحة درس في الفصل فقط (تفادياً للتكرار في كل صفحات الفصل)
      const image = type === 'lesson' && !firstLessonDone ? chapterImage : null;
      if (type === 'lesson') firstLessonDone = true;
      pages.push({ id: `${ch.id}-${pages.length + 1}`, title: p.title || ch.title, content: p.text || '', chapter: ch.title, type, image, blocks });
    }
  }
  return pages;
}

// ===== Adapter: قراءة نصية (السنة 2-6) — نصوص + فهم + معجم + إنتاج =====
function adaptReadingBook(book) {
  const pages = [];
  for (const unit of book.units || []) {
    for (const lesson of unit.lessons || []) {
      const blocks = [];
      const story = (lesson.story_text || []).join(' ');
      if (story) blocks.push({ kind: 'concept', title: 'نص الانطلاق', text: story });
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

// ===== الإنتاج الكتابي س1: كراس الملاحظة والإنتاج من كتاب المستخدم =====
function adaptProductionWorkbook(book) {
  return (book.lessons || []).map((l) => {
    const blocks = [];
    if (l.observe?.length) blocks.push({ kind: 'summary', title: 'أَلاحِظُ الصُّورَةَ', points: l.observe });
    if (l.correction) {
      blocks.push({ kind: 'note', title: 'أُصَحِّحُ النَّصَّ', text: `${l.correction.text} ${l.correction.note || ''}`.trim() });
    }
    if (l.cards) blocks.push({ kind: 'note', title: 'بِطَاقَاتُ الكَلِمَاتِ', text: l.cards });
    if (l.complete) blocks.push({ kind: 'example', title: 'أُكَمِّلُ شَفَوِيّاً', text: l.complete });
    if (l.ordering?.items?.length) {
      const oq = { kind: 'question', type: 'order', title: 'أُرَتِّبُ الجُمَلَ حَسَبَ الصُّوَرِ.', text: 'اضغط على الجمل بالترتيب الصحيح (1، 2، 3...)', items: l.ordering.items };
      if (Array.isArray(l.ordering.answer)) oq.answer = l.ordering.answer;
      blocks.push(oq);
    }
    if (l.task) blocks.push({ kind: 'question', type: 'write', title: l.task, text: l.task, input: 'textarea' });
    if (l.checklist?.length) blocks.push({ kind: 'summary', title: 'أُرَاجِعُ نَفْسِي ✓', points: l.checklist });
    return {
      id: l.id,
      title: l.title,
      content: l.task || '',
      domain: 'الإنتاج الكتابي',
      images: l.images || [],
      image: (l.images || [])[0] || null,
      blocks
    };
  });
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
    // كراس التمارين (س1): إن وُجد الملف المبني من الكراس نستعمله، وإلا نبقى على المحتوى الحالي.
    const wbPath = path.join(curriculumDir, grade.dir, 'math-workbook.json');
    const wb = readJson(wbPath);
    if (wb && Array.isArray(wb.lessons) && wb.lessons.length) {
      pages = adaptMathWorkbook(wb);
    } else {
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
              { kind: 'objective', title: 'الأهداف', text: `أن يتعلّم المتعلّم: ${item.title}.` },
              ...(item.content ? [{ kind: 'concept', title: 'المحتوى', text: item.content }] : [])
            ]
          });
        }
        return pages;
      }
      pages = adaptMathUnits(lessons, path.join(curriculumDir, grade.dir, 'math-content.json'));
    }
  } else if (code === 'anisi' || code === 'reading' || code === 'arabic') {
    const book = readJson(path.join(curriculumDir, grade.dir, subject.lessonsFile || 'anisi-lessons-full.json'));
    if (!book) return [];
    // السنة الأولى: محوّل الحروف (أنيسي). السنة 2-6: محوّل النصوص القرائية.
    const isLetterBook = Array.isArray(book.units) && book.units.some((u) => Array.isArray(u.lessons) && u.lessons.some((l) => l.letter));
    pages = isLetterBook ? adaptAnisiLessons(book) : adaptReadingBook(book);
  } else if (code === 'islamic') {
    const book = readJson(path.join(curriculumDir, grade.dir, subject.bookFile || 'islamic-book.json'));
    if (!book) return [];
    pages = adaptIslamicBook(book);
  } else if (code === 'tech') {
    const book = readJson(path.join(curriculumDir, grade.dir, subject.bookFile || 'tech-book.json'));
    if (!book) return [];
    pages = adaptTechBook(book);
  } else if (code === 'science') {
    const book = readJson(path.join(curriculumDir, grade.dir, subject.bookFile || 'science-book.json'));
    if (!book) return [];
    pages = adaptScienceBook(book);
  } else if (code === 'production' || code === 'writing') {
    // س1: كراس الملاحظة والإنتاج الجديد إن وُجد، وإلا المحتوى القديم
    const wbPath = path.join(curriculumDir, grade.dir, 'production-book-v2.json');
    const wb = readJson(wbPath);
    if (wb && Array.isArray(wb.lessons) && wb.lessons.length) {
      pages = adaptProductionWorkbook(wb);
    } else {
      const book = readJson(path.join(curriculumDir, grade.dir, subject.lessonsFile || 'production-units.json'));
      if (!book) return [];
      pages = adaptProductionBook(book);
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

// المواد الرسمية في المنهج التونسي — تختلف من سنة إلى أخرى (الفرنسية تبدأ من س3).
const OFFICIAL_SUBJECTS_BY_GRADE = {
  year1: [
    { code: 'anisi', label: 'القراءة' },
    { code: 'math', label: 'الرياضيات' },
    { code: 'science', label: 'الإيقاظ العلمي' },
    { code: 'production', label: 'الإنتاج الكتابي' },
    { code: 'islamic', label: 'التربية الإسلامية' },
    { code: 'civic', label: 'التربية المدنية' },
    { code: 'art', label: 'التربية التشكيلية' },
    { code: 'pe', label: 'التربية البدنية' }
  ],
  year2: [
    { code: 'anisi', label: 'القراءة' },
    { code: 'math', label: 'الرياضيات' },
    { code: 'science', label: 'الإيقاظ العلمي' },
    { code: 'production', label: 'الإنتاج الكتابي' },
    { code: 'islamic', label: 'التربية الإسلامية' },
    { code: 'civic', label: 'التربية المدنية' },
    { code: 'art', label: 'التربية التشكيلية' },
    { code: 'pe', label: 'التربية البدنية' }
  ],
  year3: [
    { code: 'anisi', label: 'القراءة' },
    { code: 'french', label: 'الفرنسية' },
    { code: 'math', label: 'الرياضيات' },
    { code: 'science', label: 'الإيقاظ العلمي' },
    { code: 'production', label: 'الإنتاج الكتابي' },
    { code: 'islamic', label: 'التربية الإسلامية' },
    { code: 'civic', label: 'التربية المدنية' },
    { code: 'art', label: 'التربية التشكيلية' },
    { code: 'pe', label: 'التربية البدنية' }
  ],
  year4: [
    { code: 'anisi', label: 'القراءة' },
    { code: 'french', label: 'الفرنسية' },
    { code: 'math', label: 'الرياضيات' },
    { code: 'science', label: 'الإيقاظ العلمي' },
    { code: 'production', label: 'الإنتاج الكتابي' },
    { code: 'islamic', label: 'التربية الإسلامية' },
    { code: 'civic', label: 'التربية المدنية' },
    { code: 'art', label: 'التربية التشكيلية' },
    { code: 'pe', label: 'التربية البدنية' }
  ],
  year5: [
    { code: 'anisi', label: 'القراءة' },
    { code: 'french', label: 'الفرنسية' },
    { code: 'math', label: 'الرياضيات' },
    { code: 'science', label: 'الإيقاظ العلمي' },
    { code: 'production', label: 'الإنتاج الكتابي' },
    { code: 'islamic', label: 'التربية الإسلامية' },
    { code: 'civic', label: 'التربية المدنية' },
    { code: 'art', label: 'التربية التشكيلية' },
    { code: 'pe', label: 'التربية البدنية' }
  ],
  year6: [
    { code: 'anisi', label: 'القراءة' },
    { code: 'french', label: 'الفرنسية' },
    { code: 'math', label: 'الرياضيات' },
    { code: 'science', label: 'الإيقاظ العلمي' },
    { code: 'production', label: 'الإنتاج الكتابي' },
    { code: 'islamic', label: 'التربية الإسلامية' },
    { code: 'civic', label: 'التربية المدنية' },
    { code: 'art', label: 'التربية التشكيلية' },
    { code: 'pe', label: 'التربية البدنية' }
  ]
};

export function getOfficialSubjectsForLevel(level, country) {
  const grade = findGradeByLevel(level, country);
  if (!grade) return [];
  return OFFICIAL_SUBJECTS_BY_GRADE[grade.id] || [];
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
  // مواد اللغة العربية تولّد أسئلتها الخاصة (5 أسئلة لكل درس) — لا نضيف بنكاً
  // يكرّر نفس الأسئلة (مثل «أين تجد حرف...») بجوارها.
  // رياضيات س1 أصبحت كراس تمارين كاملاً (44 درساً × 10 أسئلة) — لا نضيف بنكاً فوقه.
  if (['anisi', 'reading', 'arabic', 'production', 'math'].includes(String(code || '').toLowerCase())) return pages;
  const templates = getBankTemplatesForSubject(code, country);
  if (!templates.length) return pages;
  return pages.map((page) => {
    const matches = templates.filter((t) => templateMatchesLesson(t, page));
    if (!matches.length) return page;
    // اختيار حتمي (حسب معرّف الدرس) بين القوالب المطابقة — يمنع تكرار نفس
    // السؤال في دروس متتالية من نفس الموضوع، وتدوير الأسئلة داخل القالب نفسه
    let h = 0;
    for (const ch of String(page.id || page.title || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const template = matches[h % matches.length];
    const start = (template.questions || []).length ? h % template.questions.length : 0;
    const blocks = exerciseToBlocks(template, 3, start);
    // حماية من التكرار: لا نضيف أي كتلة عنوانها مطابق لكتلة موجودة أصلاً في الدرس
    const existing = new Set((page.blocks || []).map((b) => String(b.title || b.text || '').slice(0, 40)));
    const fresh = blocks.filter((b) => !existing.has(String(b.title || b.text || '').slice(0, 40)));
    if (!fresh.length) return page;
    return { ...page, blocks: [...(page.blocks || []), ...fresh] };
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
