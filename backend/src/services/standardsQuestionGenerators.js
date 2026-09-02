// ===== مولّدات الأسئلة الإجرائية حسب المعايير الرسمية =====
//
// لكل معيار (std-xxx من exam-bank-standards.json) مولّد يبتكر سؤالاً جديداً
// بقيم عشوائية داخل نطاق السنة — لا نسخ من بنك: كل استدعاء ينتج سؤالاً
// مختلفاً بإجابة محسوبة رياضياً.
//
// ضمانة الصحة: buildOptions تُدرج الإجابة الصحيحة دائماً ضمن الخيارات.

function ri(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}
function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}
function shuffled(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** خيارات مضمونة: الإجابة الصحيحة موجودة حتماً + مميزات عنها + مخلوطة */
function buildOptions(rand, answer, wrongPool, n = 3) {
  const uniq = [...new Set(wrongPool.map(String).filter((w) => w !== String(answer) && w != null && w !== ''))];
  const wrongs = shuffled(uniq, rand).slice(0, n - 1);
  const options = shuffled([String(answer), ...wrongs], rand);
  return { options, correctOption: options.indexOf(String(answer)) };
}

const EMOJIS = ['🍎', '⚽', '🌟', '🎈', '🐟', '🌸', '🦋', '🍪'];
const NUMBER_WORDS = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const NUMBER_WORDS_100 = [
  '', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة',
  'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر',
  'عشرون', 'واحد وعشرون', 'اثنان وعشرون', 'ثلاثة وعشرون', 'أربعة وعشرون', 'خمسة وعشرون', 'ستة وعشرون', 'سبعة وعشرون', 'ثمانية وعشرون', 'تسعة وعشرون',
  'ثلاثون', 'واحد وثلاثون', 'اثنان وثلاثون', 'ثلاثة وثلاثون', 'أربعة وثلاثون', 'خمسة وثلاثون', 'ستة وثلاثون', 'سبعة وثلاثون', 'ثمانية وثلاثون', 'تسعة وثلاثون',
  'أربعون', 'واحد وأربعون', 'اثنان وأربعون', 'ثلاثة وأربعون', 'أربعة وأربعون', 'خمسة وأربعون', 'ستة وأربعون', 'سبعة وأربعون', 'ثمانية وأربعون', 'تسعة وأربعون',
  'خمسون', 'واحد وخمسون', 'اثنان وخمسون', 'ثلاثة وخمسون', 'أربعة وخمسون', 'خمسة وخمسون', 'ستة وخمسون', 'سبعة وخمسون', 'ثمانية وخمسون', 'تسعة وخمسون',
  'ستون', 'واحد وستون', 'اثنان وستون', 'ثلاثة وستون', 'أربعة وستون', 'خمسة وستون', 'ستة وستون', 'سبعة وستون', 'ثمانية وستون', 'تسعة وستون',
  'سبعون', 'واحد وسبعون', 'اثنان وسبعون', 'ثلاثة وسبعون', 'أربعة وسبعون', 'خمسة وسبعون', 'ستة وسبعون', 'سبعة وسبعون', 'ثمانية وسبعون', 'تسعة وسبعون',
  'ثمانون', 'واحد وثمانون', 'اثنان وثمانون', 'ثلاثة وثمانون', 'أربعة وثمانون', 'خمسة وثمانون', 'ستة وثمانون', 'سبعة وثمانون', 'ثمانية وثمانون', 'تسعة وثمانون',
  'تسعون', 'واحد وتسعون', 'اثنان وتسعون', 'ثلاثة وتسعون', 'أربعة وتسعون', 'خمسة وتسعون', 'ستة وتسعون', 'سبعة وتسعون', 'ثمانية وتسعون', 'تسعة وتسعون',
  'مئة'
];

export const GENERATORS = {
  // ================= السنة الأولى - قراءة =================
  'std-001': (rand) => {
    const letters = ['ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي'];
    const letter = pick(rand, letters);
    const wrongs = letters.filter(l => l !== letter);
    const { options, correctOption } = buildOptions(rand, letter, wrongs);
    return { prompt: `أي حرفٍ هذا: «${letter}»؟`, options, correctOption };
  },
  'std-002': (rand) => {
    const combos = [
      { combo: 'با', parts: ['ب','ا'] }, { combo: 'تا', parts: ['ت','ا'] },
      { combo: 'جا', parts: ['ج','ا'] }, { combo: 'حا', parts: ['ح','ا'] },
      { combo: 'كا', parts: ['ك','ا'] }, { combo: 'لا', parts: ['ل','ا'] },
      { combo: 'ما', parts: ['م','ا'] }, { combo: 'نا', parts: ['ن','ا'] },
      { combo: 'بي', parts: ['ب','ي'] }, { combo: 'تي', parts: ['ت','ي'] },
    ];
    const c = pick(rand, combos);
    const wrongs = combos.filter(x => x.combo !== c.combo).map(x => x.combo);
    const { options, correctOption } = buildOptions(rand, c.combo, wrongs);
    return { prompt: `ما هو هذا المقطع: «${c.combo}»؟`, options, correctOption };
  },
  'std-003': (rand) => {
    const words = [
      { word: 'كِتَاب', meaning: 'نقرأ فيه الدروس' },
      { word: 'قَلَم', meaning: 'نكتب به' },
      { word: 'مِفْتَاح', meaning: 'يفتح الباب' },
      { word: 'تِفَّاحَة', meaning: 'فاكهة حمراء' },
      { word: 'نَجْمَة', meaning: 'تلمع في السماء ليلاً' },
      { word: 'وَرْدَة', meaning: 'زهرة جميلة' },
    ];
    const w = pick(rand, words);
    const wrongs = words.filter(x => x.word !== w.word).map(x => x.word);
    const { options, correctOption } = buildOptions(rand, w.word, wrongs);
    return { prompt: `أي كلمة تعني: «${w.meaning}»؟`, options, correctOption };
  },
  'std-004': (rand) => {
    const sentences = [
      { s: 'يأكلُ الطفلُ التفاحةَ.', q: 'ماذا يأكلُ الطفلُ؟', a: 'التفاحةَ', w: ['الخبزَ', 'الحليبَ', 'التفاحةَ'] },
      { s: 'ترسمُ ليلى بيتاً.', q: 'ماذا ترسمُ ليلى؟', a: 'بيتاً', w: ['شجرةً', 'بيتاً', 'قطةً'] },
      { s: 'يلعبُ سامي في الحديقةِ.', q: 'أين يلعبُ سامي؟', a: 'في الحديقة', w: ['في المدرسة', 'في البيت', 'في الحديقة'] },
    ];
    const s = pick(rand, sentences);
    const { options, correctOption } = buildOptions(rand, s.a, s.w);
    return { prompt: `اقرأ: «${s.s}» — ${s.q}`, options, correctOption };
  },

  // ================= السنة الأولى - رياضيات =================
  'std-013': (rand) => {
    const n = ri(rand, 1, 9);
    const nums = Array.from({length: 9}, (_, i) => String(i + 1));
    const { options, correctOption } = buildOptions(rand, n, nums);
    return { prompt: `كم عدد الكُتل: ${'■'.repeat(n)}؟`, options, correctOption };
  },
  'std-014': (rand) => {
    const n = ri(rand, 1, 9);
    const nums = Array.from({length: 9}, (_, i) => String(i + 1));
    const { options, correctOption } = buildOptions(rand, n, nums);
    const word = NUMBER_WORDS[n] || String(n);
    return { prompt: `اكتب العدد «${n}» بالحروف`, options, correctOption };
  },
  'std-015': (rand) => {
    const n = ri(rand, 10, 20);
    const nums = [10,11,12,13,14,15,16,17,18,19,20].map(String);
    const { options, correctOption } = buildOptions(rand, n, nums);
    const word = NUMBER_WORDS_100[n] || String(n);
    return { prompt: `اكتب العدد «${n}» بالحروف`, options, correctOption };
  },
  'std-016': (rand) => {
    const a = ri(rand, 1, 5);
    const b = ri(rand, 1, 9 - a);
    const wrongs = [a + b - 1, a + b + 1, a + b + 2].filter(x => x > 0 && x !== a + b);
    const nums = [String(a + b), ...wrongs.map(String)].slice(0, 3);
    const { options, correctOption } = buildOptions(rand, a + b, nums);
    return { prompt: `${a} + ${b} = ؟`, options, correctOption };
  },
  'std-017': (rand) => {
    const a = ri(rand, 3, 9);
    const b = ri(rand, 1, a - 1);
    const wrongs = [a - b - 1, a - b + 1, a - b + 2].filter(x => x >= 0 && x !== a - b);
    const nums = [String(a - b), ...wrongs.map(String)].slice(0, 3);
    const { options, correctOption } = buildOptions(rand, a - b, nums);
    return { prompt: `${a} − ${b} = ؟`, options, correctOption };
  },
  'std-018': (rand) => {
    const pairs = [
      { a: '3', b: '5', answer: '5' }, { a: '7', b: '2', answer: '7' },
      { a: '4', b: '8', answer: '8' }, { a: '6', b: '1', answer: '6' },
    ];
    const p = pick(rand, pairs);
    const { options, correctOption } = buildOptions(rand, p.answer, [p.a, p.b, String(ri(rand, 1, 9))]);
    return { prompt: `أي عدد أكبر: ${p.a} أو ${p.b}؟`, options, correctOption };
  },
  'std-019': (rand) => {
    const shapes = [
      { shape: 'المربع', sides: '4', opts: ['3', '4', '5'] },
      { shape: 'المثلث', sides: '3', opts: ['3', '4', '5'] },
      { shape: 'الدائرة', sides: '0', opts: ['0', '4', '2'] },
    ];
    const s = pick(rand, shapes);
    const { options, correctOption } = buildOptions(rand, s.sides, s.opts);
    return { prompt: `كم أضلاع ${s.shape}؟`, options, correctOption };
  },
  'std-020': (rand) => {
    const colors = [
      { q: 'لون السماء', a: 'أزرق', w: ['أحمر', 'أزرق', 'أخضر'] },
      { q: 'لون العشب', a: 'أخضر', w: ['أحمر', 'أزرق', 'أخضر'] },
      { q: 'لون الشمس', a: 'أصفر', w: ['أصفر', 'أزرق', 'أسود'] },
    ];
    const c = pick(rand, colors);
    const { options, correctOption } = buildOptions(rand, c.a, c.w);
    return { prompt: `${c.q} هو لون:`, options, correctOption };
  },
  'std-021': (rand) => {
    const items = [
      { q: 'أطول من: العمود أطول من ___', a: 'القلم', w: ['الbuilding', 'القلم', 'الكتاب'] },
      { q: 'أقصر من: الورقة أقصر من ___', a: 'الكتاب', w: ['القلم', 'الكتاب', 'الطاولة'] },
      { q: 'يكون أكبر: ___ أكبر من ___', a: 'الفيل أكبر من القط', w: ['الفيل أكبر من القط', 'القط أكبر من الفيل', 'هما متساويان'] },
    ];
    const c = pick(rand, items);
    const { options, correctOption } = buildOptions(rand, c.a, c.w);
    return { prompt: c.q, options, correctOption };
  },
  'std-022': (rand) => {
    const times = [
      { q: 'في الصباح، نستيقظ ونأكل ___', a: 'الفطور', w: ['الفطور', 'العشاء', 'الغداء'] },
      { q: 'عند الظهير، نأكل ___', a: 'الغداء', w: ['الفطور', 'الغداء', 'العشاء'] },
      { q: 'عند المساء، نأكل ___', a: 'العشاء', w: ['الفطور', 'الغداء', 'العشاء'] },
    ];
    const t = pick(rand, times);
    const { options, correctOption } = buildOptions(rand, t.a, t.w);
    return { prompt: t.q, options, correctOption };
  },

  // ================= السنة الأولى - إيقاظ علمي =================
  'std-023': (rand) => {
    const parts = [
      { q: 'نبصر بها', a: 'العينان', w: ['العينان', 'الأذنان', 'اليدان'] },
      { q: 'نسمع بها', a: 'الأذنان', w: ['العينان', 'الأذنان', 'الفم'] },
      { q: 'نتذوق بها', a: 'الفم', w: ['الأنف', 'الفم', 'العينان'] },
      { q: 'نشم بها', a: 'الأنف', w: ['الأنف', 'الفم', 'العينان'] },
    ];
    const p = pick(rand, parts);
    const { options, correctOption } = buildOptions(rand, p.a, p.w);
    return { prompt: `${p.q} — ما هو العضو؟`, options, correctOption };
  },
  'std-024': (rand) => {
    const foods = [
      { q: '哪种 هو طعام صحي؟', a: 'التفاحة', w: ['التفاحة', 'الشيبس', 'المثلجات'] },
      { q: 'أي طعام يiben nutrients نحتاج؟', a: 'الحليب', w: ['الماء', 'الحليب', 'العلك'] },
    ];
    const f = pick(rand, [
      { q: 'أي من هذه صحي للأكل؟', a: 'التفاحة', w: ['التفاحة', 'علك النعناع', 'المثلجات'] },
      { q: 'ما نشرب لل sức khoẻ؟', a: 'الماء', w: ['الماء', 'العلك', 'الشيبس'] },
    ]);
    const { options, correctOption } = buildOptions(rand, f.a, f.w);
    return { prompt: f.q, options, correctOption };
  },
  'std-025': (rand) => {
    const actions = [
      { q: 'الجري حركة ____', a: 'سريعة', w: ['سريعة', 'بطيئة', 'ثابتة'] },
      { q: 'المشي حركة ____', a: 'بطيئة', w: ['سريعة', 'بطيئة', 'هادئة'] },
      { q: 'القفز حركة ____', a: 'سريعة', w: ['بطيئة', 'سريعة', 'ثابتة'] },
    ];
    const a = pick(rand, actions);
    const { options, correctOption } = buildOptions(rand, a.a, a.w);
    return { prompt: a.q, options, correctOption };
  },
  'std-026': (rand) => {
    const animals = [
      { q: 'القط ___ في الليل', a: 'يصحو', w: ['يصحو', 'ينام', 'يطير'] },
      { q: 'الدجاج ___ في الصباح', a: 'يصرخ', w: ['يصرخ', 'ينام', 'يسبح'] },
    ];
    const a = pick(rand, [
      { q: 'ماذا يفعل القطة في الليل؟', a: 'تصطاد', w: ['تصطاد', 'تنام', 'تطير'] },
      { q: 'ماذا يفعل الدجاج في الصباح؟', a: 'يصيح', w: ['يصيح', 'ينام', 'يسبح'] },
      { q: 'ماذا يفعل الحصان؟', a: 'يركض', w: ['يركض', 'يطير', 'يسبح'] },
    ]);
    const { options, correctOption } = buildOptions(rand, a.a, a.w);
    return { prompt: a.q, options, correctOption };
  },
  'std-027': (rand) => {
    const seasons = [
      { q: 'في ____ نلبس معطفاً', a: 'الشتاء', w: ['الشتاء', 'الصيف', 'الربيع'] },
      { q: 'في ____ الجو حار', a: 'الصيف', w: ['الصيف', 'الشتاء', 'الخريف'] },
      { q: 'في ____ تتساقط الأوراق', a: 'الخريف', w: ['الخريف', 'الصيف', 'الربيع'] },
    ];
    const s = pick(rand, seasons);
    const { options, correctOption } = buildOptions(rand, s.a, s.w);
    return { prompt: s.q, options, correctOption };
  },
  'std-028': (rand) => {
    const body = [
      { q: 'نمشي بـ', a: 'القدمين', w: ['القدمين', 'اليدين', 'الرأس'] },
      { q: 'نحمل الأشياء بـ', a: 'اليدين', w: ['اليدين', 'القدمين', 'الرأس'] },
      { q: 'نفكر بـ', a: 'الدماغ', w: ['الدماغ', 'القلب', 'المعدة'] },
    ];
    const b = pick(rand, body);
    const { options, correctOption } = buildOptions(rand, b.a, b.w);
    return { prompt: b.q, options, correctOption };
  },
  'std-029': (rand) => {
    const materials = [
      { q: 'الماء سائل', a: 'صحيح', w: ['صحيح', 'خطأ'] },
      { q: 'الحجر صلب', a: 'صحيح', w: ['صحيح', 'خطأ'] },
      { q: 'الهواء صلب', a: 'خطأ', w: ['صحيح', 'خطأ'] },
    ];
    const m = pick(rand, materials);
    const { options, correctOption } = buildOptions(rand, m.a, m.w);
    return { prompt: `صح أم خطأ: ${m.q}؟`, options, correctOption };
  },
  'std-030': (rand) => {
    const plants = [
      { q: 'النبات يحتاج إلى ___', a: 'الماء والشمس', w: ['الماء والشمس', 'الظلام فقط', 'الملح'] },
      { q: 'الأوراق ____', a: 'خضراء', w: ['خضراء', 'زرقاء', 'حمراء'] },
    ];
    const p = pick(rand, [
      { q: 'ماذا يحتاج النبات لينمو؟', a: 'الماء والشمس', w: ['الماء والشمس', 'الظلام', 'الملح'] },
      { q: 'ما لون أوراق النبات العادي؟', a: 'أخضر', w: ['أخضر', 'أزرق', 'بنفسجي'] },
    ]);
    const { options, correctOption } = buildOptions(rand, p.a, p.w);
    return { prompt: p.q, options, correctOption };
  },
  'std-031': (rand) => {
    const time = [
      { q: 'اليوم فيه ___ ساعات', a: '24', w: ['12', '24', '30'] },
      { q: 'الليلة ___ من النهار', a: 'أطول', w: ['أطول', 'أقصر', 'مساوية'] },
    ];
    const t = pick(rand, [
      { q: 'كم ساعة في اليوم؟', a: '24', w: ['12', '24', '30'] },
      { q: 'كم يوم في الأسبوع؟', a: '7', w: ['5', '7', '10'] },
      { q: 'كم شهر في السنة؟', a: '12', w: ['10', '12', '15'] },
    ]);
    const { options, correctOption } = buildOptions(rand, t.a, t.w);
    return { prompt: t.q, options, correctOption };
  },

  // ================= السنة الثانية - قراءة (Reading) =================
  'std2-rd-01': (rand) => {
    const texts = [
      'ذاتَ صباحٍ مشمسٍ، خرجَ سامي إلى الحديقةِ ليلعبَ معَ أخيه.',
      'في الفصلِ، يدرسُ التلاميذُ القراءةَ والكتابةَ بجدٍّ.',
      'ذهبتْ ليلى إلى السوقِ معَ أمِّها لشراءِ الفاكهةِ.',
      'الطيورُ تغردُ على الأشجارِ في الربيعِ الجميلِ.'
    ];
    const text = pick(rand, texts);
    const questions = [
      { q: 'مَن خرجَ إلى الحديقةِ؟', a: 'سامي', opts: ['سامي', 'ليلى', 'الأم', 'الأخ'] },
      { q: 'ماذا يفعلُ التلاميذُ في الفصلِ؟', a: 'يدرسون', opts: ['يلعبون', 'يدرسون', 'ينامون', 'يأكلون'] },
      { q: 'معَ مَن ذهبتْ ليلى إلى السوقِ؟', a: 'أمها', opts: ['أبيها', 'أختها', 'أمها', 'صديقتها'] },
      { q: 'متى تغردُ الطيورُ؟', a: 'في الربيع', opts: ['في الشتاء', 'في الصيف', 'في الربيع', 'في الخريف'] }
    ];
    const q = pick(rand, questions);
    const { options, correctOption } = buildOptions(rand, q.a, q.opts);
    return { prompt: `اقرأ النصَّ: «${text}» — ${q.q}`, options, correctOption };
  },
  'std2-rd-02': (rand) => {
    const words = ['مدرسة', 'قلم', 'كتاب', 'حديقة', 'سيارة', 'طائرة', 'تفاحة', 'مفتاح', 'نجمة', 'زهرة'];
    const word = pick(rand, words);
    const syllables = word.split('');
    const target = pick(rand, syllables);
    const { options, correctOption } = buildOptions(rand, target, syllables.filter(s => s !== target));
    return { prompt: `في كلمة «${word}»، ما هو المقطع ${target === syllables[0] ? 'الأول' : target === syllables[syllables.length-1] ? 'الأخير' : 'الأوسط'}؟`, options, correctOption };
  },
  'std2-rd-03': (rand) => {
    const sentences = [
      'الطالبُ مجتهدٌ.', 'الشمسُ ساطعةٌ.', 'البحرُ أزرقُ.', 'الجبلُ عالٍ.'
    ];
    const sent = pick(rand, sentences);
    const words = sent.split(' ');
    const target = pick(rand, words.slice(0, -1));
    const { options, correctOption } = buildOptions(rand, target, words.filter(w => w !== target && w !== '.'));
    return { prompt: `في الجملة: «${sent}»، ما هو المبتدأ/الفاعل؟`, options, correctOption };
  },
  'std2-rd-04': (rand) => {
    const text = 'ذهبَ كريمٌ إلى المكتبةِ فوجدَ كتاباً عن الحيواناتِ، فقرأَ عن الأسدِ والفيلِ.';
    const questions = [
      { q: 'إلى أين ذهبَ كريمٌ؟', a: 'المكتبة', opts: ['المدرسة', 'المكتبة', 'الحديقة', 'البيت'] },
      { q: 'ماذا وجدَ في المكتبةِ؟', a: 'كتاباً عن الحيوانات', opts: ['قصة', 'كتاباً عن الحيوانات', 'مجلة', 'ورقة'] },
      { q: 'عن أيِّ حيوانين قرأَ؟', a: 'الأسدِ والفيلِ', opts: ['القط والكلب', 'الأسد والفيل', 'العصفور والفراشة', 'السمكة والسلحفاة'] }
    ];
    const q = pick(rand, questions);
    const { options, correctOption } = buildOptions(rand, q.a, q.opts);
    return { prompt: `اقرأ: «${text}» — ${q.q}`, options, correctOption };
  },
  'std2-rd-05': (rand) => {
    const items = [
      { text: 'الطفلُ يلعبُ بالكرةِ.', q: 'مَن يلعبُ؟', a: 'الطفل', opts: ['الكرة', 'الطفل', 'البيت', 'الشمس'] },
      { text: 'الأمُّ تطبخُ الطعامَ.', q: 'ماذا تفعلُ الأمُّ؟', a: 'تطبخ', opts: ['تنظف', 'تطبخ', 'تقرأ', 'تنام'] },
      { text: 'الطائرُ يطيرُ في السماءِ.', q: 'أين يطيرُ الطائرُ؟', a: 'في السماء', opts: ['في الماء', 'على الأرض', 'في السماء', 'تحت الشجرة'] }
    ];
    const item = pick(rand, items);
    const { options, correctOption } = buildOptions(rand, item.a, item.opts);
    return { prompt: `اقرأ: «${item.text}» — ${item.q}`, options, correctOption };
  },
  'std2-rd-06': (rand) => {
    const sentences = [
      'أكمل: ذهبَ سامي إلى ...............', 
      'أكمل: اشترتْ ليلى ................',
      'أكمل: الطائرُ يغردُ على ................'
    ];
    const sent = pick(rand, sentences);
    const answers = ['المدرسة', 'تفاحة', 'الشجرة'];
    const idx = sentences.indexOf(sent);
    const { options, correctOption } = buildOptions(rand, answers[idx], ['البيت', 'المدرسة', 'السوق', 'الحديقة']);
    return { prompt: sent, options, correctOption };
  },
  'std2-rd-07': (rand) => {
    const prompts = [
      'إذا كنتَ مكانَ سامي، ماذا كنتَ ستفعلُ في المكتبةِ؟ اكتبْ جملةً واحدةً.',
      'ما رأيكَ في قراءةِ القصصِ؟ هل تحبُّها؟ ولماذا؟',
      'اكتبْ جملةً تصفُ فيها مكتبةَ مدرستِكَ.'
    ];
    return { prompt: pick(rand, prompts), freeLines: 3 };
  },

  // ================= السنة الثانية - قواعد لغة (Grammar) =================
  'std2-gr-01': (rand) => {
    const sentences = [
      'محمدٌ يقرأُ الكتابَ.', 'تلعبُ البنتُ بالكرةِ.', 'الطائرُ يطيرُ في السماءِ.'
    ];
    const sent = pick(rand, sentences);
    const parts = sent.replace('.', '').split(' ');
    const verb = parts.find(w => w.endsWith('ُ') || w.endsWith('َ') || w.match(/[أإ]?[بتثجحخدذرزسشصضطظعغفقكلمنهوي]/));
    const { options, correctOption } = buildOptions(rand, verb || parts[1], parts.filter(p => p !== verb && p !== '.'));
    return { prompt: `في الجملة: «${sent}»، ما هو الفعل؟`, options, correctOption };
  },
  'std2-gr-02': (rand) => {
    const nouns = ['قلم', 'كتاب', 'مدرسة', 'حديقة', 'سيارة'];
    const noun = pick(rand, nouns);
    const types = ['اسم', 'فعل', 'حرف'];
    const { options, correctOption } = buildOptions(rand, 'اسم', ['فعل', 'حرف']);
    return { prompt: `كلمة «${noun}» هي:`, options, correctOption };
  },
  'std2-gr-03': (rand) => {
    const words = ['الكتابُ', 'القلمَ', 'محمدٌ', 'البيتِ', 'في'];
    const word = pick(rand, words);
    let answer = 'مرفوع';
    if (word.endsWith('َ')) answer = 'منصوب';
    else if (word.endsWith('ِ')) answer = 'مجرور';
    else if (word.startsWith('في')) answer = 'حرف جر';
    const { options, correctOption } = buildOptions(rand, answer, ['مرفوع', 'منصوب', 'مجرور', 'مبني'].filter(x => x !== answer));
    return { prompt: `ما إعراب/بناء كلمة «${word}»؟`, options, correctOption };
  },
  'std2-gr-04': (rand) => {
    const pairs = [
      ['طالبٌ', 'طالبانِ', 'طلابٌ'],
      ['مدرسةٌ', 'مدرستانِ', 'مدارسُ'],
      ['قلمٌ', 'قلمانِ', 'أقلامٌ']
    ];
    const [singular, dual, plural] = pick(rand, pairs);
    const form = pick(rand, [singular, dual, plural]);
    let answer = 'مفرد';
    if (form === dual) answer = 'مثنى';
    else if (form === plural) answer = 'جمع';
    const { options, correctOption } = buildOptions(rand, answer, ['مفرد', 'مثنى', 'جمع'].filter(x => x !== answer));
    return { prompt: `كلمة «${form}» هي:`, options, correctOption };
  },
  'std2-gr-05': (rand) => {
    const prompts = [
      'حلِّل الجملة التالية تحليلاً كاملاً: «المعلمُ يشرحُ الدرسَ».',
      'حوِّل المفرد إلى مثنى وجمع: (كتاب، قلم، شجرة).',
      'أعرب ما تحته خط: «ذهبَ الطالبُ إلى المدرسةِ».'
    ];
    return { prompt: pick(rand, prompts), freeLines: 4 };
  },

  // ================= السنة الثانية - إنتاج كتابي (Production) =================
  'std2-pr-01': () => ({ freeLines: 4, prompt: 'رتّب الصور التالية لتروي قصةً، ثم اكتبْ جملةً لكل صورة.' }),
  'std2-pr-02': () => ({ freeLines: 3, prompt: 'أكمل القصة: في يومٍ جميلٍ، ذهبَ كريمُ إلى الغابةِ فوجدَ ................' }),
  'std2-pr-03': () => ({ freeLines: 5, prompt: 'انظر إلى الصورة واكتبْ فقرةً من ٤-٥ جملٍ تصفُ ما تراهُ.' }),

  // ================= السنة الثانية - خط وإملاء (Handwriting) =================
  'std2-hw-01': () => ({ freeLines: 2, prompt: 'انسخِ الجملةَ بخطٍّ جميلٍ: «الطالبُ المجتهدُ ينجحُ».' }),
  'std2-hw-02': () => ({ freeLines: 2, prompt: 'اكتبِ الكلماتِ الآتيةَ بخطٍّ واضحٍ: (مدرسة - كتاب - قلم - حديقة).' }),
  'std2-hw-03': () => ({ freeLines: 1, prompt: 'اكتبِ الكلمةَ التي يمليها عليك المعلمُ: (............)' }),
  'std2-hw-04': () => ({ freeLines: 1, prompt: 'ضعْ دائرةً حول الكلمةِ الصحيحةِ: (يذهبُ / يذهبَ) الطالبُ إلى المدرسةِ.' }),

  // ================= السنة الثانية - الفرنسية (French) =================
  'std2-fr-01': (rand) => {
    const items = [
      { prompt: 'Complète : Bonjour, je m\'appelle _____.', answer: 'Marie', opts: ['Marie', 'Pierre', 'Paul', 'Luc'] },
      { prompt: 'Comment ça va ?', answer: 'Très bien', opts: ['Très bien', 'Mal', 'Comme ci comme ça', 'Fatigué'] },
      { prompt: 'Quelle est ta couleur préférée ?', answer: 'Bleu', opts: ['Bleu', 'Rouge', 'Vert', 'Jaune'] }
    ];
    const item = pick(rand, items);
    const { options, correctOption } = buildOptions(rand, item.answer, item.opts);
    return { prompt: item.prompt, options, correctOption };
  },
  'std2-fr-02': (rand) => {
    const items = [
      { prompt: 'Lis : "Le chat est sur la table." Où est le chat ?', answer: 'Sur la table', opts: ['Sous la table', 'Sur la table', 'Dans la table', 'Devant la table'] },
      { prompt: 'Marc a un chien. Le chien est _____.', answer: 'noir', opts: ['noir', 'blanc', 'gris', 'marron'] }
    ];
    const item = pick(rand, items);
    const { options, correctOption } = buildOptions(rand, item.answer, item.opts);
    return { prompt: item.prompt, options, correctOption };
  },
  'std2-fr-03': (rand) => {
    const items = [
      { prompt: 'Conjugue : Je _____ (manger) une pomme.', answer: 'mange', opts: ['mange', 'manges', 'mangeons', 'mangent'] },
      { prompt: 'Nous _____ (aller) à l\'école.', answer: 'allons', opts: ['vais', 'vas', 'va', 'allons'] }
    ];
    const item = pick(rand, items);
    const { options, correctOption } = buildOptions(rand, item.answer, item.opts);
    return { prompt: item.prompt, options, correctOption };
  },
  'std2-fr-04': (rand) => {
    const vocab = [
      { word: 'pomme', meaning: 'تفاحة', opts: ['تفاحة', 'موزة', 'برتقالة', 'كمثرى'] },
      { word: 'école', meaning: 'مدرسة', opts: ['منزل', 'مدرسة', 'مستشفى', 'سوق'] },
      { word: 'ami', meaning: 'صديق', opts: ['أخ', 'صديق', 'أب', 'معلم'] }
    ];
    const v = pick(rand, vocab);
    const { options, correctOption } = buildOptions(rand, v.meaning, v.opts);
    return { prompt: `Quelle est la signification de « ${v.word} » ?`, options, correctOption };
  },
  'std2-fr-05': () => ({ freeLines: 3, prompt: 'Écris 3 phrases sur toi-même : (Je m\'appelle... J\'ai... ans. J\'aime...)' }),

  // ================= السنة الثانية - الرياضيات (Math) =================
  'std2-mt-01': (rand) => {
    const n = ri(rand, 100, 999);
    const hundreds = Math.floor(n / 100);
    const tens = Math.floor((n % 100) / 10);
    const ones = n % 10;
    const qType = rand() > 0.5 ? 'hundreds' : rand() > 0.5 ? 'tens' : 'ones';
    const answer = qType === 'hundreds' ? hundreds : qType === 'tens' ? tens : ones;
    const label = qType === 'hundreds' ? 'المئات' : qType === 'tens' ? 'العشرات' : 'الآحاد';
    const wrong = [hundreds, tens, ones, hundreds+tens, tens+ones].filter(x => x !== answer && x >= 0 && x <= 9);
    const { options, correctOption } = buildOptions(rand, answer, wrong);
    return { prompt: `في العدد ${n}، كم عدد ${label}؟`, options, correctOption };
  },
  'std2-mt-02': (rand) => {
    let a = ri(rand, 10, 99);
    let b = ri(rand, 10, 99);
    const op = rand() > 0.5 ? '+' : '-';
    if (op === '-' && a < b) [a, b] = [b, a]; // ensure positive
    const answer = op === '+' ? a + b : a - b;
    const wrong = [answer + 10, answer - 10, answer + 1, answer - 1].filter(x => x > 0 && x !== answer);
    const { options, correctOption } = buildOptions(rand, answer, wrong);
    return { prompt: `احسب: ${a} ${op} ${b} = ؟`, options, correctOption };
  },
  'std2-mt-03': (rand) => {
    let a = ri(rand, 10, 50);
    let b = ri(rand, 10, 50);
    if (a < b) [a, b] = [b, a];
    const answer = a - b;
    const wrong = [answer + 5, answer - 5, a + b, b - a].filter(x => x > 0 && x !== answer);
    const { options, correctOption } = buildOptions(rand, answer, wrong);
    return { prompt: `أكمل الطرح: ${a} - ؟ = ${answer}`, options, correctOption };
  },
  'std2-mt-04': (rand) => {
    const shapes = [
      { name: 'مربع', sides: 4, rightAngles: 4 },
      { name: 'مستطيل', sides: 4, rightAngles: 4 },
      { name: 'مثلث', sides: 3, rightAngles: 0 },
      { name: 'دائرة', sides: 0, rightAngles: 0 }
    ];
    const shape = pick(rand, shapes);
    const { options, correctOption } = buildOptions(rand, shape.name, shapes.map(s => s.name).filter(n => n !== shape.name));
    return { prompt: `شكل له ${shape.sides} أضلاع ${shape.rightAngles > 0 ? 'و' + shape.rightAngles + ' زوايا قائمة' : ''}، هو:`, options, correctOption };
  },
  'std2-mt-05': (rand) => {
    const comparisons = [
      { a: 45, b: 32, op: '>' },
      { a: 78, b: 91, op: '<' },
      { a: 56, b: 56, op: '=' }
    ];
    const c = pick(rand, comparisons);
    const { options, correctOption } = buildOptions(rand, c.op, ['<', '>', '='].filter(x => x !== c.op));
    return { prompt: `قارن: ${c.a} ؟ ${c.b}`, options, correctOption };
  },
  'std2-mt-06': (rand) => {
    const cm = ri(rand, 10, 50);
    const mm = cm * 10;
    const { options, correctOption } = buildOptions(rand, mm, [mm + 10, mm - 10, cm, cm * 100].filter(x => x !== mm));
    return { prompt: `حوِّل ${cm} سم إلى ملم:`, options, correctOption };
  },
  'std2-mt-07': (rand) => {
    const a = ri(rand, 2, 10);
    const b = ri(rand, 2, 10);
    const answer = a * b;
    const wrong = [answer + a, answer - a, a + b, a - b].filter(x => x > 0 && x !== answer);
    const { options, correctOption } = buildOptions(rand, answer, wrong);
    return { prompt: `مساحة مستطيل طوله ${a} سم وعرضه ${b} سم = ؟`, options, correctOption };
  },
  'std2-mt-08': () => ({ freeLines: 4, prompt: 'وضعية إدماجية: لدى أحمد 250 دنانير، اشترى كتاباً بـ 80 د. وكتاباً بـ 65 د. كم بقي معه؟ اكتب العملية والحل.' }),

  // ================= السنة الثانية - الإيقاظ العلمي (Science) =================
  'std2-sc-01': (rand) => {
    const organs = [
      { organ: 'العين', function: 'الرؤية' },
      { organ: 'الأذن', function: 'السمع' },
      { organ: 'الأنف', function: 'الشم' },
      { organ: 'اللسان', function: 'التذوق' },
      { organ: 'الجلد', function: 'اللمس' }
    ];
    const o = pick(rand, organs);
    const { options, correctOption } = buildOptions(rand, o.function, organs.map(x => x.function).filter(f => f !== o.function));
    return { prompt: `عضو ${o.organ} يقوم بوظيفة:`, options, correctOption };
  },
  'std2-sc-02': (rand) => {
    const care = ['غسل اليدين', 'تنظيف الأسنان', 'الاستحمام', 'قص الأظافر'];
    const answer = pick(rand, care);
    const { options, correctOption } = buildOptions(rand, answer, care.filter(c => c !== answer));
    return { prompt: `من وسائل العناية بالجسم:`, options, correctOption };
  },
  'std2-sc-03': (rand) => {
    const animals = [
      { name: 'القط', type: 'ثديي', food: 'لحوم' },
      { name: 'العصفور', type: 'طائر', food: 'بذور/حشرات' },
      { name: 'السمكة', type: 'سمك', food: 'طحالب/دودة' },
      { name: 'النملة', type: 'حشرة', food: 'كل شيء' }
    ];
    const a = pick(rand, animals);
    const { options, correctOption } = buildOptions(rand, a.type, ['ثديي', 'طائر', 'سمك', 'حشرة', 'زاحف'].filter(t => t !== a.type));
    return { prompt: `الـ ${a.name} ينتمي إلى صنف:`, options, correctOption };
  },
  'std2-sc-04': (rand) => {
    const habitats = [
      { animal: 'السمكة', habitat: 'الماء' },
      { animal: 'الطائر', habitat: 'الهواء/الأشجار' },
      { animal: 'الجمل', habitat: 'الصحراء' },
      { animal: 'الدب القطبي', habitat: 'المناطق الجليدية' }
    ];
    const h = pick(rand, habitats);
    const { options, correctOption } = buildOptions(rand, h.habitat, ['الماء', 'الهواء', 'الصحراء', 'الجليد', 'الغابة'].filter(x => x !== h.habitat));
    return { prompt: `موطن ${h.animal} الطبيعي هو:`, options, correctOption };
  },
  'std2-sc-05': (rand) => {
    const materials = [
      { name: 'الخشب', props: 'صلب، يعوم على الماء' },
      { name: 'الحديد', props: 'صلب، ثقيل، موصل للحرارة' },
      { name: 'البلاستيك', props: 'خفيف، لا يصدأ' },
      { name: 'الزجاج', props: 'شفاف، قابل للكسر' }
    ];
    const m = pick(rand, materials);
    const { options, correctOption } = buildOptions(rand, m.name, materials.map(x => x.name).filter(n => n !== m.name));
    return { prompt: `مادة ${m.props} هي:`, options, correctOption };
  },
  'std2-sc-06': (rand) => {
    const motions = [
      { obj: 'السيارة', motion: 'الدوران (العجلات)' },
      { obj: 'المروحة', motion: 'الدوران' },
      { obj: 'البندول', motion: 'التأرجح' },
      { obj: 'الكرة', motion: 'التدحرج' }
    ];
    const m = pick(rand, motions);
    const { options, correctOption } = buildOptions(rand, m.motion, ['الدوران', 'التأرجح', 'التدحرج', 'الخط المستقيم'].filter(x => x !== m.motion));
    return { prompt: `حركة ${m.obj} هي حركة:`, options, correctOption };
  },
  'std2-sc-07': () => ({ freeLines: 4, prompt: 'صمِّم تجربةً بسيطةً لتعرفَ أيَّ الموادِ تعومُ وأيَّها تغوصُ في الماءِ. ارسمْ وأدِلَّ.' }),

  // ================= السنة الثانية - التربية الإسلامية =================
  'std2-is-01': () => ({ freeLines: 3, prompt: 'اكتبْ سورةَ الإخلاصِ من حفظِكَ.' }),
  'std2-is-02': () => ({ freeLines: 2, prompt: 'اكتبْ آيةَ الكرسيِّ أو ما تحفظُ منها.' }),
  'std2-is-03': () => ({ freeLines: 3, prompt: 'ما هي أركانُ الإسلامِ الخمسةُ؟ اكتبْها بالترتيبِ.' }),
  'std2-is-04': () => ({ freeLines: 3, prompt: 'اذكرْ ثلاثَ آدابٍ من آدابِ دخولِ المسجدِ.' }),

  // ================= السنة الثانية - التربية المدنية =================
  'std2-cv-01': () => ({ freeLines: 3, prompt: 'ما هي واجباتُ التلميذِ نحوَ مدرستِهِ؟ اكتبْ ثلاثَ واجباتٍ.' }),
  'std2-cv-02': () => ({ freeLines: 2, prompt: 'اكتبْ قاعدةً من قواعدِ الفصلِ تحترمُها.' }),
  'std2-cv-03': () => ({ freeLines: 3, prompt: 'كيف تتعاونُ مع زملائِكَ في الفصلِ؟ أعطِ مثالينِ.' }),
  'std2-cv-04': () => ({ freeLines: 2, prompt: 'ما معنى العلمِ التونسيِّ (ألوانه ورموزه)؟' }),

  // ================= السنة الثانية - التكنولوجيا =================
  'std2-tc-01': () => ({ freeLines: 3, prompt: 'صنِّف الأدواتَ التاليةَ: (مطرقة، مفك، منشار، كماشة) — ما وظيفة كلِّ أداةٍ؟' }),
  'std2-tc-02': () => ({ freeLines: 2, prompt: 'ارسمْ أداةً تستعملُها في النجارةِ وسمِّ أجزاءَها.' }),
  'std2-tc-03': () => ({ freeLines: 4, prompt: 'صمِّم لعبةً بسيطةً من الورقِ المقوَّى، واكتبْ خطواتِ صنعِها.' }),
  'std2-tc-04': () => ({ freeLines: 2, prompt: 'ما هي الموادِ التي تستعملُ في صنعِ طاولةٍ خشبيةٍ؟' }),

  // ================= السنة الثانية - الإعلامية =================
  'std2-ic-01': () => ({ freeLines: 2, prompt: 'سمِّ مكوناتِ الحاسوبِ الأساسيةِ: (الشاشة، لوحة المفاتيح، الفأرة، الوحدة المركزية).' }),
  'std2-ic-02': () => ({ freeLines: 2, prompt: 'ما وظيفةُ الفأرةِ (المाउس)؟' }),
  'std2-ic-03': () => ({ freeLines: 3, prompt: 'ارسمْ أيقونةَ برنامجِ الرسمِ (Paint) واكتبْ اسمَهُ.' }),
  'std2-ic-04': () => ({ freeLines: 2, prompt: 'كيف تفتحُ ملفًّا محفوظاً على الحاسوبِ؟' }),

  // ================= السنة الثانية - التربية التشكيلية =================
  'std2-ar-01': () => ({ freeLines: 3, prompt: 'ارسمْ منظراً طبيعياً (شمس، جبل، شجرة، نهر) بالألوانِ.' }),
  'std2-ar-02': () => ({ freeLines: 3, prompt: 'ارسمْ وجهَ صديقِكَ أو فردٍ من عائلتِكَ.' }),
  'std2-ar-03': () => ({ freeLines: 3, prompt: 'لوِّنِ الرسمَ الآتيَ باستعمالِ الألوانِ الدافئةِ (أحمر، برتقالي، أصفر).' }),
  'std2-ar-04': () => ({ freeLines: 3, prompt: 'صمِّم بطاقةَ معايدةٍ بمناسبةِ عيدِ الاستقلالِ.' }),

  // ================= السنة الثانية - التربية الموسيقية =================
  'std2-mu-01': () => ({ freeLines: 2, prompt: 'غنِّ نشيدَ «بلادي» أو النشيدَ الوطنيِّ التونسيِّ.' }),
  'std2-mu-02': () => ({ freeLines: 2, prompt: 'اضربْ على الطاولةِ إيقاعاً منتظماً: (طَق طَق — طَق طَق طَق).' }),
  'std2-mu-03': () => ({ freeLines: 2, prompt: 'ما هي الآلةُ الموسيقيةُ التي تعزفُ بالنفخِ؟ (ناي، زمر، بوق).' }),
  'std2-mu-04': () => ({ freeLines: 2, prompt: 'غنِّ أغنيةً للأطفالِ تعرفُها مع حركاتِ اليدينِ.' }),

  // ================= السنة الثانية - التربية البدنية =================
  'std2-pe-01': () => ({ freeLines: 2, prompt: 'قمْ بتمرينِ الإحماءِ: (دوران الذراعين، ثني الركبتين، القفز مكانك).' }),
  'std2-pe-02': () => ({ freeLines: 2, prompt: 'اركضْ مسافةَ ٢٠ متراً ثم عُدْ مشياً.' }),
  'std2-pe-03': () => ({ freeLines: 2, prompt: 'العبْ لعبةَ «القط والفأر» مع زملائِكَ.' }),
  'std2-pe-04': () => ({ freeLines: 2, prompt: 'ما هي أهميةِ الرياضةِ للجسمِ؟ اذكرْ فائدتينِ.' })
};

// أسئلة حرة للسنة الأولى (موجودة مسبقاً) + السنة الثانية
export const FREE_GENERATORS = {
  // سنة أولى
  'std-005': () => ({ freeLines: 2, prompt: 'ارسم حرف اليوم كبيراً ثم صغيراً.' }),
  'std-006': () => ({ freeLines: 2, prompt: 'انسخ الكلمة التي على السبورة بخط جميل.' }),
  'std-007': () => ({ freeLines: 3, prompt: 'اكتب جملة قصيرة عن نفسك (ابدأ بحرف كبير وضع نقطة في الأخير).' }),
  'std-008': () => ({ freeLines: 1, prompt: 'اكتب الكلمة التي يمليها عليك المعلم.' }),
  'std-009': () => ({ freeLines: 1, prompt: 'ضع دائرة حول الصورة التي اسمها يبدأ بالصوت الذي تسمعه.' }),
  'std-010': () => ({ freeLines: 3, prompt: 'رتّب صور القصة ثم احكي ما يحدث فيها بجملة لكل صورة.' }),
  'std-011': () => ({ freeLines: 2, prompt: 'أكمل الجملة: في القسمِ ............' }),
  'std-012': () => ({ freeLines: 4, prompt: 'انظر إلى الصورة واكتب جملتين أو ثلاثاً تصف ما تراه.' }),
  // سنة ثانية
  'std2-pr-01': () => ({ freeLines: 4, prompt: 'رتّب الصور التالية لتروي قصةً، ثم اكتبْ جملةً لكل صورة.' }),
  'std2-pr-02': () => ({ freeLines: 3, prompt: 'أكمل القصة: في يومٍ جميلٍ، ذهبَ كريمُ إلى الغابةِ فوجدَ ................' }),
  'std2-pr-03': () => ({ freeLines: 5, prompt: 'انظر إلى الصورة واكتبْ فقرةً من ٤-٥ جملٍ تصفُ ما تراهُ.' }),
  'std2-hw-01': () => ({ freeLines: 2, prompt: 'انسخِ الجملةَ بخطٍّ جميلٍ: «الطالبُ المجتهدُ ينجحُ».' }),
  'std2-hw-02': () => ({ freeLines: 2, prompt: 'اكتبِ الكلماتِ الآتيةَ بخطٍّ واضحٍ: (مدرسة - كتاب - قلم - حديقة).' }),
  'std2-hw-03': () => ({ freeLines: 1, prompt: 'اكتبِ الكلمةَ التي يمليها عليك المعلمُ: (............)' }),
  'std2-hw-04': () => ({ freeLines: 1, prompt: 'ضعْ دائرةً حول الكلمةِ الصحيحةِ: (يذهبُ / يذهبَ) الطالبُ إلى المدرسةِ.' }),
  'std2-is-01': () => ({ freeLines: 3, prompt: 'اكتبْ سورةَ الإخلاصِ من حفظِكَ.' }),
  'std2-is-02': () => ({ freeLines: 2, prompt: 'اكتبْ آيةَ الكرسيِّ أو ما تحفظُ منها.' }),
  'std2-is-03': () => ({ freeLines: 3, prompt: 'ما هي أركانُ الإسلامِ الخمسةُ؟ اكتبْها بالترتيبِ.' }),
  'std2-is-04': () => ({ freeLines: 3, prompt: 'اذكرْ ثلاثَ آدابٍ من آدابِ دخولِ المسجدِ.' }),
  'std2-cv-01': () => ({ freeLines: 3, prompt: 'ما هي واجباتُ التلميذِ نحوَ مدرستِهِ؟ اكتبْ ثلاثَ واجباتٍ.' }),
  'std2-cv-02': () => ({ freeLines: 2, prompt: 'اكتبْ قاعدةً من قواعدِ الفصلِ تحترمُها.' }),
  'std2-cv-03': () => ({ freeLines: 3, prompt: 'كيف تتعاونُ مع زملائِكَ في الفصلِ؟ أعطِ مثالينِ.' }),
  'std2-cv-04': () => ({ freeLines: 2, prompt: 'ما معنى العلمِ التونسيِّ (ألوانه ورموزه)؟' }),
  'std2-tc-01': () => ({ freeLines: 3, prompt: 'صنِّف الأدواتَ التاليةَ: (مطرقة، مفك، منشار، كماشة) — ما وظيفة كلِّ أداةٍ؟' }),
  'std2-tc-02': () => ({ freeLines: 2, prompt: 'ارسمْ أداةً تستعملُها في النجارةِ وسمِّ أجزاءَها.' }),
  'std2-tc-03': () => ({ freeLines: 4, prompt: 'صمِّم لعبةً بسيطةً من الورقِ المقوَّى، واكتبْ خطواتِ صنعِها.' }),
  'std2-tc-04': () => ({ freeLines: 2, prompt: 'ما هي الموادِ التي تستعملُ في صنعِ طاولةٍ خشبيةٍ؟' }),
  'std2-ic-01': () => ({ freeLines: 2, prompt: 'سمِّ مكوناتِ الحاسوبِ الأساسيةِ: (الشاشة، لوحة المفاتيح، الفأرة، الوحدة المركزية).' }),
  'std2-ic-02': () => ({ freeLines: 2, prompt: 'ما وظيفةُ الفأرةِ (المाउس)؟' }),
  'std2-ic-03': () => ({ freeLines: 3, prompt: 'ارسمْ أيقونةَ برنامجِ الرسمِ (Paint) واكتبْ اسمَهُ.' }),
  'std2-ic-04': () => ({ freeLines: 2, prompt: 'كيف تفتحُ ملفًّا محفوظاً على الحاسوبِ؟' }),
  'std2-ar-01': () => ({ freeLines: 3, prompt: 'ارسمْ منظراً طبيعياً (شمس، جبل، شجرة، نهر) بالألوانِ.' }),
  'std2-ar-02': () => ({ freeLines: 3, prompt: 'ارسمْ وجهَ صديقِكَ أو فردٍ من عائلتِكَ.' }),
  'std2-ar-03': () => ({ freeLines: 3, prompt: 'لوِّنِ الرسمَ الآتيَ باستعمالِ الألوانِ الدافئةِ (أحمر، برتقالي، أصفر).' }),
  'std2-ar-04': () => ({ freeLines: 3, prompt: 'صمِّم بطاقةَ معايدةٍ بمناسبةِ عيدِ الاستقلالِ.' }),
  'std2-mu-01': () => ({ freeLines: 2, prompt: 'غنِّ نشيدَ «بلادي» أو النشيدَ الوطنيِّ التونسيِّ.' }),
  'std2-mu-02': () => ({ freeLines: 2, prompt: 'اضربْ على الطاولةِ إيقاعاً منتظماً: (طَق طَق — طَق طَق طَق).' }),
  'std2-mu-03': () => ({ freeLines: 2, prompt: 'ما هي الآلةُ الموسيقيةُ التي تعزفُ بالنفخِ؟ (ناي، زمر، بوق).' }),
  'std2-mu-04': () => ({ freeLines: 2, prompt: 'غنِّ أغنيةً للأطفالِ تعرفُها مع حركاتِ اليدينِ.' }),
  'std2-pe-01': () => ({ freeLines: 2, prompt: 'قمْ بتمرينِ الإحماءِ: (دوران الذراعين، ثني الركبتين، القفز مكانك).' }),
  'std2-pe-02': () => ({ freeLines: 2, prompt: 'اركضْ مسافةَ ٢٠ متراً ثم عُدْ مشياً.' }),
  'std2-pe-03': () => ({ freeLines: 2, prompt: 'العبْ لعبةَ «القط والفأر» مع زملائِكَ.' }),
  'std2-pe-04': () => ({ freeLines: 2, prompt: 'ما هي أهميةُ الرياضةِ للجسمِ؟ اذكرْ فائدتينِ.' })
};