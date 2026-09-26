/**
 * تحديات اللعبة — Challenge generators.
 *
 * Every challenge is a small teaching moment embedded in the 3D world:
 * the student must physically reach the right object, not tap an answer.
 *
 * A challenge is a plain data object:
 *   { kind, prompt, skill, skillType, skillLabel, hint,
 *     items[], correctValue, ordered?, explain }
 */

import {
  LETTERS, SYLLABLES, WORDS, CONFUSABLE_PAIRS,
  SENTENCES, COMPREHENSION, GRAMMAR, NUMBERS, LOGIC
} from './curriculum.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b) => a + Math.random() * (b - a);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A scramble that is never accidentally already correct. */
function scramble(arr) {
  if (arr.length < 2) return [...arr];
  let out = shuffle(arr);
  let guard = 0;
  while (out.join('|') === arr.join('|') && guard++ < 12) out = shuffle(arr);
  return out;
}

const letterPool = (count, exclude = []) =>
  shuffle(LETTERS.map((l) => l.letter).filter((l) => !exclude.includes(l))).slice(0, count);

const wordPool = (count, exclude = []) =>
  shuffle(WORDS.map((w) => w.text).filter((w) => !exclude.includes(w))).slice(0, count);

// ---------------------------------------------------------------------------
// Stage A — تمييز الحرف: recognise the target letter among decoys.
// ---------------------------------------------------------------------------

export function findLetter(target) {
  const t = target || pick(LETTERS);
  const decoys = letterPool(4, [t.letter]);
  return {
    kind: 'FIND_LETTER',
    prompt: 'ابحث عن حرف',
    target: t.letter,
    skill: `letter:${t.letter}`,
    skillType: 'LETTER',
    skillLabel: `حرف ${t.letter}`,
    hint: `الحرف المطلوب هو «${t.letter}». تذكّر شكله: ${t.name}`,
    correctValue: t.letter,
    items: shuffle([t.letter, ...decoys])
  };
}

// ---------------------------------------------------------------------------
// Stage B — التعرّف داخل الكلمات: which word contains the letter?
// ---------------------------------------------------------------------------

export function findLetterInWord(target) {
  const t = target || pick(LETTERS);
  const withLetter = WORDS.filter((w) => w.text.includes(t.letter));
  const without = WORDS.filter((w) => !w.text.includes(t.letter));
  const good = pick(withLetter.length ? withLetter : WORDS);
  const bad = shuffle(without).slice(0, 3);
  return {
    kind: 'FIND_IN_WORD',
    prompt: 'أين يوجد الحرف',
    target: t.letter,
    skill: `letter:${t.letter}`,
    skillType: 'LETTER',
    skillLabel: `حرف ${t.letter} داخل الكلمات`,
    hint: `اقرأ الكلمات بتأنٍّ — أي كلمة فيها حرف «${t.letter}»؟`,
    correctValue: good.text,
    explain: `الكلمة «${good.text}» تحتوي على حرف «${t.letter}».`,
    // `bad` holds word OBJECTS ({text, ...}); the tiles render String(value),
    // so forgetting .text prints "[object Object]" and makes the challenge
    // unsolvable by reading. (Found live in the browser, 2026-09-26.)
    items: shuffle([good.text, ...bad.map((w) => w.text)])
  };
}

// ---------------------------------------------------------------------------
// Stage C — ربط الحرف بالصوت: picture → first letter of its name.
// ---------------------------------------------------------------------------

export function letterSound(target) {
  const t = target || pick(LETTERS);
  return {
    kind: 'LETTER_SOUND',
    prompt: 'بماذا تبدأ الكلمة؟',
    target: t.word,
    emoji: t.emoji,
    skill: `sound:${t.letter}`,
    skillType: 'SOUND',
    skillLabel: `صوت ${t.letter} (${t.word})`,
    hint: `الصورة هي «${t.word}» — ما أول صوت فيها؟`,
    correctValue: t.sound,
    explain: `«${t.word}» تبدأ بصوت «${t.sound}».`,
    items: shuffle([t.sound, ...letterPool(3, [t.sound])])
  };
}

// ---------------------------------------------------------------------------
// Stage D — بناء المقاطع: م + ا = ما
// ---------------------------------------------------------------------------

export function buildSyllable(target) {
  const s = target || pick(SYLLABLES);
  return {
    kind: 'BUILD_SYLLABLE',
    prompt: 'كوّن المقطع',
    target: s.text,
    emoji: s.emoji,
    skill: `syllable:${s.text}`,
    skillType: 'SYLLABLE',
    skillLabel: `مقطع ${s.text}`,
    hint: `المقطع «${s.text}» يتكوّن من حرفين. اجمعهما بالترتيب.`,
    // Ordered challenges are completed by collecting each part in turn, so the
    // "answer" is the assembled syllable, not a single tile.
    correctValue: s.text,
    ordered: true,
    orderedItems: s.parts,
    items: shuffle([...s.parts, ...letterPool(2, s.parts)])
  };
}

// ---------------------------------------------------------------------------
// Stage E — بناء كلمة كاملة: ب ا ب = باب
// ---------------------------------------------------------------------------

export function buildWord(target) {
  const w = target || pick(WORDS);
  const letters = [...w.text];
  return {
    kind: 'BUILD_WORD',
    prompt: 'كوّن الكلمة',
    target: w.text,
    emoji: w.emoji,
    skill: `word:${w.text}`,
    skillType: 'WORD',
    skillLabel: `كلمة ${w.text}`,
    hint: `الكلمة «${w.text}» فيها ${letters.length} حروف. اجمعها بالترتيب.`,
    correctValue: w.text,
    ordered: true,
    orderedItems: letters,
    items: shuffle([...letters, ...letterPool(3, letters)])
  };
}

// ---------------------------------------------------------------------------
// Word Forest mechanics
// ---------------------------------------------------------------------------

export function pickWordForImage(target) {
  const w = target || pick(WORDS);
  return {
    kind: 'WORD_FOR_IMAGE',
    prompt: 'ما اسم هذه الصورة؟',
    target: w.text,
    emoji: w.emoji,
    skill: `word:${w.text}`,
    skillType: 'WORD',
    skillLabel: `كلمة ${w.text}`,
    hint: 'انظر الصورة جيداً ثم اختر الكلمة التي تطابقها.',
    correctValue: w.text,
    items: shuffle([w.text, ...wordPool(3, [w.text])])
  };
}

export function missingLetter(target) {
  const w = target || pick(WORDS.filter((x) => x.text.length >= 3));
  const letters = [...w.text];
  const idx = Math.floor(Math.random() * letters.length);
  const missing = letters[idx];
  // `target` is what the child sees (the pattern); `word` is the full answer
  // used by the explanation, so feedback never echoes the gap back at them.
  const pattern = letters.map((l, i) => (i === idx ? '_' : l)).join(' ');
  return {
    kind: 'MISSING_LETTER',
    prompt: 'أكمل الكلمة الناقصة',
    target: pattern,
    pattern,
    word: w.text,
    emoji: w.emoji,
    skill: `word:${w.text}`,
    skillType: 'WORD',
    skillLabel: `كلمة ${w.text}`,
    hint: `انظر إلى الفراغ في الكلمة وأكمله بالحرف الناقص.`,
    correctValue: missing,
    explain: `الكلمة الصحيحة «${w.text}» والحرف الناقص هو «${missing}».`,
    items: shuffle([missing, ...letterPool(3, [missing])])
  };
}

export function orderLetters(target) {
  const w = target || pick(WORDS.filter((x) => x.text.length >= 3));
  const letters = [...w.text];
  return {
    kind: 'ORDER_LETTERS',
    prompt: 'رتّب الحروف لتكوّن الكلمة',
    target: w.text,
    emoji: w.emoji,
    skill: `word:${w.text}`,
    skillType: 'WORD',
    skillLabel: `ترتيب ${w.text}`,
    hint: `اقرأ الحروف ثم رتّبها لتكوّن كلمة «${w.text}».`,
    correctValue: w.text,
    ordered: true,
    orderedItems: letters,
    items: scramble(letters)
  };
}

export function findWrongWord(target) {
  const pair = target || pick(CONFUSABLE_PAIRS);
  return {
    kind: 'WRONG_WORD',
    prompt: 'أي كلمة مكتوبة خطأ؟',
    target: pair.bad,
    skill: `word:${pair.good}`,
    skillType: 'WORD',
    skillLabel: `تصحيح ${pair.good}`,
    hint: 'اقرأ كل كلمة بحرف بعينه — واحدة منها ناقصة حرف.',
    correctValue: pair.bad,
    explain: `«${pair.bad}» خطأ — الصحيحة «${pair.good}».`,
    items: shuffle([pair.bad, pair.good, ...wordPool(2, [pair.good, pair.bad])])
  };
}

export function readWord(target) {
  const w = target || pick(WORDS);
  return {
    kind: 'READ_WORD',
    prompt: 'اقرأ الكلمة بصوت واضح',
    target: w.text,
    emoji: w.emoji,
    skill: `word:${w.text}`,
    skillType: 'READ',
    skillLabel: `قراءة ${w.text}`,
    hint: 'اقرأ الكلمة ثم اخترها من بين الكلمات.',
    correctValue: w.text,
    items: shuffle([w.text, ...wordPool(3, [w.text])])
  };
}

// ---------------------------------------------------------------------------
// Sentence Village — collect the words in the right order.
// ---------------------------------------------------------------------------

export function buildSentence(target) {
  const s = target || pick(SENTENCES);
  return {
    kind: 'SENTENCE',
    prompt: 'اجمع كلمات الجملة بالترتيب',
    target: s.text,
    emoji: s.emoji,
    skill: `sentence:${s.text}`,
    skillType: 'SENTENCE',
    skillLabel: `جملة ${s.text}`,
    hint: 'اقرأ الجملة ثم اجمع كلماتها بالترتيب الصحيح.',
    correctValue: s.text,
    ordered: true,
    orderedItems: s.words,
    items: scramble(s.words)
  };
}

// ---------------------------------------------------------------------------
// Knowledge Castle — panel challenges shown on 3D boards in the world.
// ---------------------------------------------------------------------------

function panelOf(kind, bank, type, skillPrefix) {
  const item = pick(bank);
  return {
    kind,
    prompt: item.q,
    skill: `${skillPrefix}:${item.q.slice(0, 20)}`,
    skillType: type,
    skillLabel: item.q,
    hint: 'اقرأ السؤال بتأنٍّ ثم اختر الإجابة الصحيحة.',
    options: item.options,
    correctIndex: item.answer
  };
}

export const comprehensionChallenge = () => panelOf('COMPREHENSION', COMPREHENSION, 'COMPREHENSION', 'compr');
export const grammarChallenge = () => panelOf('GRAMMAR', GRAMMAR, 'GRAMMAR', 'grammar');
export const numberChallenge = () => panelOf('NUMBER', NUMBERS, 'NUMBER', 'number');
export const logicChallenge = () => panelOf('LOGIC', LOGIC, 'LOGIC', 'logic');

/** Panel challenges are answered with buttons; the rest by running to a tile. */
export function isPanelChallenge(ch) {
  return Boolean(ch && Array.isArray(ch.options) && ch.correctIndex !== undefined);
}

export { shuffle, pick, rand };
