/**
 * جدول المراحل — 35 مرحلة عبر 7 عوالم.
 *
 * The level table mirrors the server registry exactly (same ids, same
 * challenge counts) so a run can always be validated server-side.
 *
 * Each level is built as an ordered list of "beats":
 *   warmup  → a gentle teaching moment before any test
 *   main    → the core skill of the world
 *   platform→ a pure platforming beat that also carries a letter to collect
 *   hard    → a longer / trickier version of the same skill
 *   final   → a mixed beat combining everything learned so far
 * Boss levels swap the beat list for 10 challenges drawn from the whole world.
 */

import {
  findLetter, findLetterInWord, letterSound, buildSyllable, buildWord,
  pickWordForImage, missingLetter, orderLetters, findWrongWord, readWord,
  buildSentence, comprehensionChallenge, grammarChallenge,
  numberChallenge, logicChallenge, shuffle, pick
} from './challenges.js';
import { WORLD_ORDER } from '../config.js';

export const LEVELS_PER_WORLD = 5;

export const WORLD_INFO = {
  'letters-garden': {
    name: 'حديقة الحروف',
    emoji: '🌱',
    intro: 'حديقة الحروف تنتظرك! تعلّم الحروف بين الزهور والفراشات.'
  },
  'word-forest': {
    name: 'غابة الكلمات',
    emoji: '🌳',
    intro: 'غابة الكلمات أعماقها مليئة بالكتب العملاقة. هل تستطيع بناء الكلمات؟'
  },
  'sentence-village': {
    name: 'قرية الجمل',
    emoji: '🏡',
    intro: 'قرية من بيوت الكتب وطرق من الحروف. رتّب الكلمات لتكوّن جملة.'
  },
  'knowledge-castle': {
    name: 'قلعة المعرفة',
    emoji: '🏰',
    intro: 'قلعة المعرفة فيها أبراج ومكتبة. حافظ على تماسكك هنا فالتحديات مختلطة.'
  },
  'challenge-valley': {
    name: 'وادي التحديات',
    emoji: '🌋',
    intro: 'وادي الصخور والشلالات. هنا سرعة البديهة تختبر… لكن لا تقلق، سأساعدك.'
  },
  'knowledge-city': {
    name: 'مدينة المعرفة',
    emoji: '☁️',
    intro: 'مدينة المعرفة عصرية وعجيبة. الأرقام والمنطق في كل زاوية.'
  },
  'champions-island': {
    name: 'جزيرة الأبطال',
    emoji: '⭐',
    intro: 'جزيرة الأبطال — الاختبار الأخير. أنت بطل الحروف!'
  }
};

/**
 * Which challenge generators each world draws from, in teaching order.
 * Generators are listed from simplest to hardest.
 */
const WORLD_RECIPES = {
  'letters-garden': [findLetter, findLetterInWord, letterSound, buildSyllable, buildWord],
  'word-forest': [findLetter, pickWordForImage, missingLetter, orderLetters, findWrongWord, readWord],
  'sentence-village': [findLetter, readWord, buildWord, buildSentence, findWrongWord, buildSentence],
  'knowledge-castle': [findLetter, readWord, comprehensionChallenge, grammarChallenge, numberChallenge, logicChallenge, buildWord],
  'challenge-valley': [findLetter, findLetterInWord, letterSound, buildWord, numberChallenge, logicChallenge, comprehensionChallenge],
  'knowledge-city': [letterSound, missingLetter, orderLetters, numberChallenge, logicChallenge, buildSentence, readWord],
  'champions-island': [buildWord, buildSentence, findWrongWord, logicChallenge, comprehensionChallenge, numberChallenge, letterSound]
};

const BOSS_RECIPES = {
  'letters-garden': [findLetter, findLetterInWord, letterSound, buildSyllable, buildWord, buildWord],
  'word-forest': [pickWordForImage, missingLetter, orderLetters, findWrongWord, readWord, buildWord],
  'sentence-village': [buildWord, buildSentence, readWord, findWrongWord, buildSentence, buildWord],
  'knowledge-castle': [comprehensionChallenge, grammarChallenge, numberChallenge, logicChallenge, readWord, buildWord],
  'challenge-valley': [numberChallenge, logicChallenge, letterSound, findLetterInWord, comprehensionChallenge, buildWord],
  'knowledge-city': [logicChallenge, numberChallenge, orderLetters, missingLetter, buildSentence, readWord],
  'champions-island': [buildWord, buildSentence, logicChallenge, findWrongWord, comprehensionChallenge, numberChallenge]
};

export const BOSS_INFO = {
  'letters-garden': { name: 'وحش الكلمات', icon: '👹' },
  'word-forest': { name: 'حارس الغابة', icon: '🧌' },
  'sentence-village': { name: 'عملاق الجمل', icon: '🗿' },
  'knowledge-castle': { name: 'حارس القلعة', icon: '🛡️' },
  'challenge-valley': { name: 'عاصفة التحدي', icon: '🌪️' },
  'knowledge-city': { name: 'حارس المدينة', icon: '🏙️' },
  'champions-island': { name: 'تنين الحروف', icon: '🐉' }
};

/**
 * The five pedagogical beats of a normal level, in the order they are played:
 *   1. تمهيد  (warm-up)   — a gentle first contact with the skill
 *   2. أساسي  (main)     — the core skill of the world
 *   3. منصات  (platform) — running/jumping, carrying a collectible
 *   4. متقدّم (hard)      — a longer or trickier version
 *   5. ختامي  (final)    — mixed, draws on the whole world
 */
export const BEAT_LABELS = {
  warmup: 'تسخين',
  main: 'التحدي الأساسي',
  platform: 'تحدي المنصات',
  hard: 'تحدي متقدّم',
  final: 'التحدي الختامي',
  boss: 'مواجهة الزعيم'
};

/** Timed beats only start appearing in the Challenge Valley. */
export function allowsTimer(worldId) {
  return WORLD_ORDER.indexOf(worldId) >= 4;
}

function beat(beatId, generator, extra = {}) {
  return { beatId, generator, ...extra };
}

/** Build the ordered beat list for a normal level (world w, level l). */
function buildBeats(worldId, w, l) {
  const recipe = WORLD_RECIPES[worldId];
  // Difficulty picks a deeper generator: later levels in a world use the
  // harder parts of the same recipe, never brand-new content too early.
  const depth = Math.min(recipe.length - 1, l - 1);
  const gentle = recipe[Math.max(0, depth - 1)];
  const core = recipe[depth];

  const beats = [
    beat('warmup', gentle, { timed: false }),
    beat('main', core, { timed: false }),
    // The platforming beat is a pure movement challenge with a star to grab.
    { beatId: 'platform', platformOnly: true, starCount: 5 },
    beat('hard', core, { timed: allowsTimer(worldId), harder: true }),
    beat('final', recipe[Math.min(recipe.length - 1, depth + 1)], {
      timed: allowsTimer(worldId),
      mixed: true
    })
  ];

  // Early worlds get one extra gentle repetition so beginners get a second
  // chance at the same skill before it is tested.
  if (w === 0 && l <= 2) beats.splice(1, 0, beat('warmup', gentle, { timed: false, extra: true }));
  return beats;
}

/** Full level descriptor. */
export function buildLevel(worldId, indexInWorld) {
  const w = WORLD_ORDER.indexOf(worldId);
  const l = indexInWorld;
  const isBoss = l === LEVELS_PER_WORLD;
  const level = {
    id: `w${w + 1}-l${l}`,
    worldId,
    worldIndex: w,
    indexInWorld: l,
    order: w * LEVELS_PER_WORLD + l,
    isBoss,
    name: isBoss
      ? `${WORLD_INFO[worldId].name} — ${BOSS_INFO[worldId].name}`
      : `${WORLD_INFO[worldId].name} — المرحلة ${l}`,
    intro: WORLD_INFO[worldId].intro
  };

  if (isBoss) {
    const recipe = BOSS_RECIPES[worldId];
    level.boss = BOSS_INFO[worldId];
    // Bosses always present exactly 10 challenges, as the server expects.
    level.beats = Array.from({ length: 10 }, (_, i) => beat(
      'boss',
      recipe[i % recipe.length],
      { timed: allowsTimer(worldId), boss: true, index: i }
    ));
    level.challengeCount = 10;
  } else {
    level.beats = buildBeats(worldId, w, l);
    level.challengeCount = level.beats.filter((b) => !b.platformOnly).length;
  }
  return level;
}

/** All 35 levels, ordered. */
export const ALL_LEVELS = WORLD_ORDER.flatMap((worldId) =>
  Array.from({ length: LEVELS_PER_WORLD }, (_, i) => buildLevel(worldId, i + 1))
);

export const LEVELS_BY_ID = new Map(ALL_LEVELS.map((l) => [l.id, l]));

export function getLevel(id) {
  return LEVELS_BY_ID.get(id) || ALL_LEVELS[0];
}

export function levelWorldLevels(worldId) {
  return ALL_LEVELS.filter((l) => l.worldId === worldId);
}

export { WORLD_ORDER, shuffle, pick };
