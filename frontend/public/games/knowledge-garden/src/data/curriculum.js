/**
 * المناهج العربي للعبة — مغامرة رفيقي
 *
 * Every challenge in the game is generated from this content bank.
 * Each entry carries the skill it trains so the mastery system can track it.
 *
 * Skill id convention:
 *   letter:م      → recognising / identifying a letter
 *   sound:م        → letter-to-sound association (first sound of a word)
 *   syllable:ما    → joining two letters into a syllable
 *   word:قلم      → reading and building a whole word
 *   sentence:٠     → ordering a sentence
 *   number:٠       → counting / arithmetic
 *   logic:٠        → simple logic
 */

/** The 28 letters taught in the Letter Garden, with their picture anchors. */
export const LETTERS = [
  { letter: 'ا', name: 'ألف', sound: 'أ', word: 'أسد', emoji: '🦁', color: 0xe8544f },
  { letter: 'ب', name: 'باء', sound: 'ب', word: 'بطة', emoji: '🦆', color: 0x155eef },
  { letter: 'ت', name: 'تاء', sound: 'ت', word: 'تفاحة', emoji: '🍎', color: 0x10b981 },
  { letter: 'ث', name: 'ثاء', sound: 'ث', word: 'ثعلب', emoji: '🦊', color: 0xf0a91c },
  { letter: 'ج', name: 'جيم', sound: 'ج', word: 'جمل', emoji: '🐫', color: 0x8e6bd6 },
  { letter: 'ح', name: 'حاء', sound: 'ح', word: 'حصان', emoji: '🐴', color: 0xff8c42 },
  { letter: 'خ', name: 'خاء', sound: 'خ', word: 'خروف', emoji: '🐑', color: 0x00bcd4 },
  { letter: 'د', name: 'دال', sound: 'د', word: 'دب', emoji: '🐻', color: 0x795548 },
  { letter: 'ذ', name: 'ذال', sound: 'ذ', word: 'ذئب', emoji: '🐺', color: 0x607d8b },
  { letter: 'ر', name: 'راء', sound: 'ر', word: 'صاروخ', emoji: '🚀', color: 0x2e7d32 },
  { letter: 'ز', name: 'زاي', sound: 'ز', word: 'زهرة', emoji: '🌸', color: 0xec407a },
  { letter: 'س', name: 'سين', sound: 'س', word: 'شمس', emoji: '☀️', color: 0xffa000 },
  { letter: 'ش', name: 'شين', sound: 'ش', word: 'شجرة', emoji: '🌳', color: 0x43a047 },
  { letter: 'ص', name: 'صاد', sound: 'ص', word: 'صقر', emoji: '🦅', color: 0x6d4c41 },
  { letter: 'ض', name: 'ضاد', sound: 'ض', word: 'ضفدع', emoji: '🐸', color: 0x26a69a },
  { letter: 'ط', name: 'طاء', sound: 'ط', word: 'طائرة', emoji: '✈️', color: 0x5c6bc0 },
  { letter: 'ظ', name: 'ظاء', sound: 'ظ', word: 'ظروف', emoji: '✉️', color: 0x8d6e63 },
  { letter: 'ع', name: 'عين', sound: 'ع', word: 'عين', emoji: '👁️', color: 0x00acc1 },
  { letter: 'غ', name: 'غين', sound: 'غ', word: 'غراب', emoji: '🐦‍⬛', color: 0x546e7a },
  { letter: 'ف', name: 'فاء', sound: 'ف', word: 'فيل', emoji: '🐘', color: 0x7e57c2 },
  { letter: 'ق', name: 'قاف', sound: 'ق', word: 'قمر', emoji: '🌙', color: 0xab47bc },
  { letter: 'ك', name: 'كاف', sound: 'ك', word: 'كتاب', emoji: '📕', color: 0x1e88e5 },
  { letter: 'ل', name: 'لام', sound: 'ل', word: 'ليمون', emoji: '🍋', color: 0x43a047 },
  { letter: 'م', name: 'ميم', sound: 'م', word: 'موزة', emoji: '🍌', color: 0xfdd835 },
  { letter: 'ن', name: 'نون', sound: 'ن', word: 'نجمة', emoji: '⭐', color: 0xfb8c00 },
  { letter: 'ه', name: 'هاء', sound: 'ه', word: 'هاتف', emoji: '📱', color: 0x26c6da },
  { letter: 'و', name: 'واو', sound: 'و', word: 'وردة', emoji: '🌹', color: 0xe91e63 },
  { letter: 'ي', name: 'ياء', sound: 'ي', word: 'سمكة', emoji: '🐟', color: 0x3f51b5 }
];

/** Two-letter syllables used in Stage D (م + ا = ما). */
export const SYLLABLES = [
  { text: 'ما', parts: ['م', 'ا'], word: 'ماء', emoji: '💧' },
  { text: 'مد', parts: ['م', 'د'], word: 'مدينة', emoji: '🏙️' },
  { text: 'بت', parts: ['ب', 'ت'], word: 'بيت', emoji: '🏠' },
  { text: 'كت', parts: ['ك', 'ت'], word: 'كتاب', emoji: '📗' },
  { text: 'سم', parts: ['س', 'م'], word: 'سمكة', emoji: '🐟' },
  { text: 'شر', parts: ['ش', 'ر'], word: 'شارع', emoji: '🛣️' },
  { text: 'فم', parts: ['ف', 'م'], word: 'فم', emoji: '👄' },
  { text: 'جل', parts: ['ج', 'ل'], word: 'جمل', emoji: '🐫' }
];

/** Full words used in Stage E and throughout the Word Forest. */
export const WORDS = [
  { text: 'باب', emoji: '🚪' },
  { text: 'بيت', emoji: '🏠' },
  { text: 'قلم', emoji: '✏️' },
  { text: 'كتاب', emoji: '📕' },
  { text: 'شمس', emoji: '☀️' },
  { text: 'مدرسة', emoji: '🏫' },
  { text: 'قمر', emoji: '🌙' },
  { text: 'نجمة', emoji: '⭐' },
  { text: 'موزة', emoji: '🍌' },
  { text: 'شجرة', emoji: '🌳' },
  { text: 'وردة', emoji: '🌹' },
  { text: 'سمكة', emoji: '🐟' }
];

/** Words that are visually similar — used to build a wrong-word challenge. */
export const CONFUSABLE_PAIRS = [
  { good: 'بيت', bad: 'بت' },
  { good: 'قلم', bad: 'قتم' },
  { good: 'كتاب', bad: 'كتاب' },
  { good: 'شمس', bad: 'شم' },
  { good: 'مدرسة', bad: 'مدرسة' },
  { good: 'موزة', bad: 'مزة' }
];

/** Sentences for the Sentence Village — the words are collected in order. */
export const SENTENCES = [
  { text: 'ذهب سامي إلى المدرسة', words: ['ذهب', 'سامي', 'إلى', 'المدرسة'], emoji: '🏫' },
  { text: 'قرأت لارا كتابا ممتعا', words: ['قرأت', 'لارا', 'كتابا', 'ممتعا'], emoji: '📖' },
  { text: 'شرب أحمد حليبا لذيذا', words: ['شرب', 'أحمد', 'حليبا', 'لذيذا'], emoji: '🥛' },
  { text: 'لعبت سلمى في الحديقة', words: ['لعبت', 'سلمى', 'في', 'الحديقة'], emoji: '🌳' },
  { text: 'أكلت فاطمة تفاحة خضراء', words: ['أكلت', 'فاطمة', 'تفاحة', 'خضراء'], emoji: '🍏' },
  { text: 'كتب الولد قصة قصيرة', words: ['كتب', 'الولد', 'قصة', 'قصيرة'], emoji: '📝' },
  { text: 'شاهد يوسف الطيور', words: ['شاهد', 'يوسف', 'الطيور'], emoji: '🐦' },
  { text: 'تساعد ليلى أخاها الصغير', words: ['تساعد', 'ليلى', 'أخاها', 'الصغير'], emoji: '🤝' }
];

/** Comprehension items for the Knowledge Castle. */
export const COMPREHENSION = [
  { q: 'ماذا فعل سامي في الجملة الأولى؟', options: ['ذهب إلى المدرسة', 'لعب في الحديقة', 'شرب الحليب'], answer: 0 },
  { q: 'ماذا أكلت فاطمة؟', options: ['تفاحة خضراء', 'موزة', 'قمر'], answer: 0 },
  { q: 'من ساعد أخاه الصغير؟', options: ['ليلى', 'سامي', 'يوسف'], answer: 0 },
  { q: 'أين لعبت سلمى؟', options: ['في الحديقة', 'في المدرسة', 'في البيت'], answer: 0 }
];

/** Grammar basics — taught through visible structure rather than rules. */
export const GRAMMAR = [
  { q: 'ما هو «ال» في كلمة «المدرسة»؟', options: ['حرف الجر', 'أداة التعريف', 'حرف العطف'], answer: 1 },
  { q: 'ما آخر كلمة في جملة «ذهب سامي إلى المدرسة»؟', options: ['ذهب', 'سامي', 'المدرسة'], answer: 2 },
  { q: 'أي جملة صحيحة؟', options: ['سامي يذهب المدرسة', 'ذهب سامي إلى المدرسة', 'إلى سامي ذهب المدرسة'], answer: 1 },
  { q: 'ما ضد كلمة «كبير»؟', options: ['صغير', 'جميل', 'سريع'], answer: 0 }
];

/** Counting and simple arithmetic for the castle and the knowledge city. */
export const NUMBERS = [
  { q: 'كم عدد حروف كلمة «قلم»؟', options: ['2', '3', '4'], answer: 1 },
  { q: 'ما ناتج ٣ + ٢ ؟', options: ['4', '5', '6'], answer: 1 },
  { q: 'كم عدد الحروف في «قلم» و«بيت» معاً؟', options: ['5', '6', '7'], answer: 1 },
  { q: 'ما العدد الأكبر؟', options: ['7', '12', '9'], answer: 1 },
  { q: 'كم عدد حروف كلمة «قمر»؟', options: ['2', '3', '4'], answer: 1 }
];

/** Simple logic for the advanced worlds. */
export const LOGIC = [
  { q: 'الحرف الذي يسبق «ب» في الأبجدية هو…', options: ['ت', 'ا', 'ث'], answer: 1 },
  { q: 'الكلمة التي تبدأ بحرف «ق» هي…', options: ['شمس', 'قمر', 'بيت'], answer: 1 },
  { q: 'كلمة «كتاب» فيها …… حرف', options: ['2', '3', '4'], answer: 2 },
  { q: 'الحرف الأخير في كلمة «مدرسة» هو…', options: ['م', 'ر', 'ة'], answer: 2 }
];
