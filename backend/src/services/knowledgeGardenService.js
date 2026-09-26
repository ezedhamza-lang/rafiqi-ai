/**
 * Knowledge Garden Adventure — server-authoritative game logic.
 *
 * مغامرة رفيقي – حديقة المعرفة
 *
 * Design rules encoded here (never in the browser):
 *  1. The client never sends points. It sends counters only; every number the
 *     student sees (score, stars, gems, mastery) is recomputed here.
 *  2. A level must be unlocked server-side before its result is accepted.
 *  3. Skills evolve through the 6-stage ladder
 *     recognition → identification → application → construction → challenge → mastery
 *     and repeated failure schedules extra practice automatically.
 *  4. Mistakes never remove rewards — they only shape the mastery record.
 */

// ---------------------------------------------------------------------------
// Skill ladder + mastery thresholds
// ---------------------------------------------------------------------------

export const SKILL_STAGES = [
  { key: 'RECOGNITION',    ar: 'تمييز',  min: 0 },
  { key: 'IDENTIFICATION', ar: 'تعرّف',   min: 20 },
  { key: 'APPLICATION',    ar: 'تطبيق',  min: 40 },
  { key: 'CONSTRUCTION',   ar: 'بناء',   min: 60 },
  { key: 'CHALLENGE',      ar: 'تحدٍّ',  min: 78 },
  { key: 'MASTERY',        ar: 'إتقان',  min: 92 }
];

export const MASTERY_THRESHOLD = 70;   // >= this counts as "متقن"
export const PRACTICE_THRESHOLD = 35;  // <  this counts as "يحتاج مراجعة"

/** Reward economy. Single source of truth for the whole game. */
export const ECONOMY = {
  pointsPerCorrect: 10,
  pointsPerWrong: 0,          // teaching first — no punishment
  gemsPerStar: 3,
  keysPerBoss: 1,
  xpPerLevel: 25,
  xpPerStar: 5,
  dailyBonusStars: 1,
  dailyBonusGems: 5
};

// ---------------------------------------------------------------------------
// Level registry — mirrors the game's 30+ level table.
// The server owns the truth: clients cannot invent levels or challenge counts.
// ---------------------------------------------------------------------------

export const WORLD_ORDER = [
  'letters-garden', 'word-forest', 'sentence-village',
  'knowledge-castle', 'challenge-valley', 'knowledge-city', 'champions-island'
];

function buildLevels() {
  const levels = [];
  for (let w = 0; w < 7; w++) {
    for (let l = 1; l <= 5; l++) {
      const isBoss = l === 5;
      // A normal level is always 4 educational beats (warm-up, main, hard,
      // final) plus a pure platforming beat that is not a challenge. The two
      // opening levels of the first world get one extra gentle repetition so a
      // beginner meets the same skill twice before being tested on it.
      const normalCount = w === 0 && l <= 2 ? 5 : 4;
      levels.push({
        id: `w${w + 1}-l${l}`,
        worldId: WORLD_ORDER[w],
        worldIndex: w,
        order: w * 5 + l,
        indexInWorld: l,
        isBoss,
        // Boss levels always present exactly 10 challenges, as required.
        // This number is the server's cap when validating a submitted run.
        challengeCount: isBoss ? 10 : normalCount,
        parTimeSec: 90 + w * 25 + l * 5,
        tier: w === 0 ? 'VERY_EASY' : w === 1 ? 'EASY' : w === 2 ? 'MEDIUM'
          : w === 3 ? 'MEDIUM_HARD' : w === 4 ? 'HARD' : 'CHALLENGE'
      });
    }
  }
  return levels;
}

export const LEVELS = buildLevels();
export const LEVELS_BY_ID = new Map(LEVELS.map((l) => [l.id, l]));

export function levelOrder(id) {
  return LEVELS_BY_ID.get(id)?.order ?? 0;
}

export function isLevelUnlocked(completedOrders, id) {
  const target = levelOrder(id);
  if (target <= 1) return true;
  return completedOrders.has(target - 1);
}

export function firstLevelOfWorld(worldId) {
  return LEVELS.find((l) => l.worldId === worldId) || LEVELS[0];
}

// ---------------------------------------------------------------------------
// Mastery maths
// ---------------------------------------------------------------------------

export function stageFor(mastery) {
  let current = SKILL_STAGES[0];
  for (const s of SKILL_STAGES) if (mastery >= s.min) current = s;
  return current;
}

export function statusFor(mastery) {
  if (mastery >= MASTERY_THRESHOLD) return 'MASTERED';
  if (mastery >= PRACTICE_THRESHOLD) return 'PRACTICING';
  return 'NEEDS_REVIEW';
}

export const STATUS_AR = {
  MASTERED: '✅ متقن',
  PRACTICING: '⚠️ يحتاج تدريب',
  NEEDS_REVIEW: '❌ يحتاج مراجعة'
};

/**
 * Update one skill record after a single answered item.
 * Growth is fast when correct, decay is gentle when wrong — a struggling
 * child must never feel punished, only re-guided.
 */
export function applySkillUpdate(skill, wasCorrect) {
  const mastery = skill.mastery ?? 0;
  const attempts = (skill.attempts ?? 0) + 1;
  const correct = (skill.correct ?? 0) + (wasCorrect ? 1 : 0);
  const streak = wasCorrect ? (skill.streak ?? 0) + 1 : 0;

  let next;
  if (wasCorrect) {
    // Diminishing gains: the last stretch is the hardest, and worth the most.
    const gain = mastery >= 92 ? 1 : mastery >= 78 ? 3 : mastery >= 40 ? 5 : 7;
    next = Math.min(100, mastery + gain);
  } else {
    const loss = mastery >= 78 ? 6 : mastery >= 40 ? 4 : 2;
    next = Math.max(0, mastery - loss);
  }

  return { attempts, correct, streak, mastery: next, needsPractice: next < MASTERY_THRESHOLD };
}

/**
 * Extra practice items a level should insert.
 * Only skills the learner actually stumbled on are queued, and only a few,
 * so the game never turns into a punitive drill.
 */
export function practiceQueue(weakSkillIds, maxItems = 3) {
  return weakSkillIds.slice(0, maxItems);
}

// ---------------------------------------------------------------------------
// Scoring — the only place a score is ever produced.
// ---------------------------------------------------------------------------

/**
 * @param {object} input
 * @param {number} input.correct   correct answers reported by the run
 * @param {number} input.total     challenges the level actually contains
 * @param {number} input.streak    best consecutive-correct streak reached
 * @param {number} input.hints     hints consumed (fewer hints -> more stars)
 */
export function computeScore({ correct, total, streak = 0, hints = 0 }) {
  const safeTotal = Math.max(1, total | 0);
  // The browser could claim a huge "correct"; cap it at what the level holds.
  const safeCorrect = Math.max(0, Math.min(safeTotal, correct | 0));
  const acc = safeCorrect / safeTotal;
  const accuracyPercent = Math.round(acc * 100);

  let score = safeCorrect * ECONOMY.pointsPerCorrect;
  score += Math.max(0, Math.min(safeCorrect, streak) - 1) * 5;  // streak bonus
  score += Math.round(accuracyPercent * 0.5);                   // mastery > speed
  // No subtraction for wrong answers anywhere: pedagogy over punishment.

  // Stars: 1 for finishing, +1 at >=70% accuracy, +1 at >=90% with no help.
  let stars = 1;
  if (accuracyPercent >= 70) stars += 1;
  if (accuracyPercent >= 90 && hints === 0) stars += 1;
  stars = Math.max(1, Math.min(3, stars));

  return {
    score: Math.max(0, Math.round(score)),
    accuracyPercent,
    stars,
    gems: stars * ECONOMY.gemsPerStar,
    mastered: safeCorrect >= Math.ceil(safeTotal * 0.8)
  };
}

export function worldProgress(levelResults, worldId) {
  const inWorld = LEVELS.filter((l) => l.worldId === worldId);
  const done = inWorld.filter((l) => (levelResults[l.id]?.stars ?? 0) > 0);
  const totalStars = inWorld.reduce((sum, l) => sum + (levelResults[l.id]?.stars ?? 0), 0);
  return {
    worldId,
    totalLevels: inWorld.length,
    completedLevels: done.length,
    totalStars,
    maxStars: inWorld.length * 3,
    percent: inWorld.length ? Math.round((done.length / inWorld.length) * 100) : 0
  };
}

/** Cosmetic unlocks are earned by achievement, never bought. */
export const COSMETIC_RULES = [
  { key: 'cap:turban',        kind: 'cap',      label: 'عمامة المعرفة',   requires: { stars: 10 } },
  { key: 'cap:star',          kind: 'cap',      label: 'قبعة النجوم',     requires: { stars: 25 } },
  { key: 'glasses:visor',     kind: 'glasses',  label: 'نظارة البطل',     requires: { mastered: 8 } },
  { key: 'backpack:books',    kind: 'backpack', label: 'حقيبة الكتب',     requires: { worldsCleared: 1 } },
  { key: 'book:encyclopedia', kind: 'book',     label: 'موسوعة المعرفة',  requires: { stars: 40 } },
  { key: 'trail:stars',       kind: 'trail',    label: 'أثر النجوم',      requires: { streak: 10 } },
  { key: 'trail:rainbow',     kind: 'trail',    label: 'قوس قزح',         requires: { stars: 60 } },
  { key: 'jump:petals',       kind: 'jump',     label: 'قفزة البتلات',    requires: { worldsCleared: 2 } },
  { key: 'jump:fireworks',    kind: 'jump',     label: 'قفزة الألعاب النارية', requires: { stars: 80 } }
];

export function evaluateUnlocks({ stars = 0, mastered = 0, worldsCleared = 0, bestStreak = 0, unlocked = {} }) {
  const granted = [];
  for (const rule of COSMETIC_RULES) {
    if (unlocked[rule.key]) continue;
    const r = rule.requires;
    const ok =
      (r.stars == null || stars >= r.stars) &&
      (r.mastered == null || mastered >= r.mastered) &&
      (r.worldsCleared == null || worldsCleared >= r.worldsCleared) &&
      (r.streak == null || bestStreak >= r.streak);
    if (ok) granted.push(rule);
  }
  return granted;
}

export const BOSSES = [
  { key: 'boss:letters-1', name: 'وحش الكلمات',  world: 'letters-garden',    icon: '👹' },
  { key: 'boss:forest-1',  name: 'حارس الغابة',  world: 'word-forest',      icon: '🧌' },
  { key: 'boss:village-1', name: 'عملاق الجمل',  world: 'sentence-village', icon: '🗿' },
  { key: 'boss:castle-1',  name: 'حارس القلعة',  world: 'knowledge-castle', icon: '🛡️' },
  { key: 'boss:valley-1',  name: 'عاصفة التحدي', world: 'challenge-valley', icon: '🌪️' },
  { key: 'boss:city-1',    name: 'حارس المدينة', world: 'knowledge-city',   icon: '🏙️' },
  { key: 'boss:island-1',  name: 'تنين الحروف',  world: 'champions-island', icon: '🐉' }
];

export const BADGE_RULES = [
  { key: 'first-steps',    name: 'الخطوة الأولى', icon: '👣', test: (s) => s.completedLevels >= 1 },
  { key: 'letter-friend',  name: 'صديق الحروف',   icon: '🔤', test: (s) => s.masteredLetters >= 5 },
  { key: 'word-builder',   name: 'باني الكلمات',  icon: '📚', test: (s) => s.masteredWords >= 8 },
  { key: 'sentence-sage',  name: 'حكيم الجمل',    icon: '📖', test: (s) => s.completedLevels >= 12 },
  { key: 'streak-10',      name: 'سلسلة النجاح',  icon: '🔥', test: (s) => s.bestStreak >= 10 },
  { key: 'boss-slayer',    name: 'بطل الزعماء',   icon: '⚔️', test: (s) => s.bossesCleared >= 1 },
  { key: 'world-cleared',  name: 'فاتح العالم',   icon: '🗺️', test: (s) => s.worldsCleared >= 1 },
  { key: 'knowledge-hero', name: 'بطل المعرفة',   icon: '🏆', test: (s) => s.stars >= 90 }
];

export function evaluateBadges(stats) {
  return BADGE_RULES.filter((b) => {
    try { return b.test(stats); } catch { return false; }
  });
}
