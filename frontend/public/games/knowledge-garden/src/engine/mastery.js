/**
 * محرّك الإتقان والتكيّف — Mastery + adaptive difficulty.
 *
 * The learner never sees a "difficulty setting". Instead the game watches how
 * they are doing inside the current level and quietly adjusts:
 *
 *   doing well   → fewer hints, more decoys, longer words, optional timer
 *   struggling   → hints on, fewer decoys, slower world, gentle repetition
 *
 * The same data is sent to the server, which keeps the durable skill record.
 */

export const MASTERY_THRESHOLD = 70;
export const PRACTICE_THRESHOLD = 35;

export const STAGES = [
  { key: 'RECOGNITION', ar: 'تمييز', min: 0 },
  { key: 'IDENTIFICATION', ar: 'تعرّف', min: 20 },
  { key: 'APPLICATION', ar: 'تطبيق', min: 40 },
  { key: 'CONSTRUCTION', ar: 'بناء', min: 60 },
  { key: 'CHALLENGE', ar: 'تحدٍّ', min: 78 },
  { key: 'MASTERY', ar: 'إتقان', min: 92 }
];

export function stageFor(mastery) {
  let current = STAGES[0];
  for (const s of STAGES) if (mastery >= s.min) current = s;
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

/** Mirrors the server's applySkillUpdate so the HUD never disagrees. */
export function applySkillUpdate(skill, wasCorrect) {
  const mastery = skill.mastery ?? 0;
  const attempts = (skill.attempts ?? 0) + 1;
  const correct = (skill.correct ?? 0) + (wasCorrect ? 1 : 0);
  const streak = wasCorrect ? (skill.streak ?? 0) + 1 : 0;
  const next = wasCorrect
    ? Math.min(100, mastery + (mastery >= 92 ? 1 : mastery >= 78 ? 3 : mastery >= 40 ? 5 : 7))
    : Math.max(0, mastery - (mastery >= 78 ? 6 : mastery >= 40 ? 4 : 2));
  return { attempts, correct, streak, mastery: next, needsPractice: next < MASTERY_THRESHOLD };
}

export const STREAK_MESSAGES = [
  { at: 3, text: 'رائع! 🔥', color: '#ff8c42' },
  { at: 5, text: 'سلسلة نجاح!', color: '#10b981' },
  { at: 10, text: 'بطل الحروف! 🏆', color: '#e8a317' },
  { at: 15, text: 'أسطورة الحديقة! 🌟', color: '#8e6bd6' }
];

/** Feedback shown after a correct answer. */
export const PRAISE = ['أحسنت!', 'ممتاز!', 'رائع جداً!', 'إجابة صحيحة!', 'بارك الله فيك!', 'أنت شاطر!'];

/** Feedback after a wrong answer — always gentle, never scolding. */
export const ENCOURAGE = ['حاول مرة أخرى', 'لا بأس — أعد المحاولة', 'قريب جداً!', 'انظر مرة أخرى بتأنٍّ'];

/**
 * Runtime state for one level run.
 * Owns the streak, the per-skill counters and the adaptive difficulty value.
 */
export class RunState {
  constructor(level, { practiceSkills = [] } = {}) {
    this.level = level;
    this.skills = new Map();
    this.practiceSkills = practiceSkills;
    this.correct = 0;
    this.wrong = 0;
    this.hintsUsed = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.challengesDone = 0;
    this.elapsed = 0;
    // 0 = struggling, 1 = comfortable, 2 = flying. Starts neutral-positive.
    this.difficulty = 1;
    this.recent = [];       // last few results, newest last
  }

  /** Register a skill record if we have never seen it. */
  #ensure(skillId, skillType, label) {
    if (!this.skills.has(skillId)) {
      this.skills.set(skillId, {
        skillId, skillType, label, mastery: 0, attempts: 0, correct: 0, streak: 0, needsPractice: true
      });
    }
    return this.skills.get(skillId);
  }

  /** Record the outcome of one answered challenge. */
  record(challenge, wasCorrect) {
    const rec = this.#ensure(challenge.skill, challenge.skillType, challenge.skillLabel);
    Object.assign(rec, applySkillUpdate(rec, wasCorrect));

    this.recent.push(wasCorrect);
    if (this.recent.length > 4) this.recent.shift();

    if (wasCorrect) {
      this.correct++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.challengesDone++;
    } else {
      this.wrong++;
      this.streak = 0;
    }
    this.#adapt();
    return rec;
  }

  /**
   * Quietly move difficulty up or down.
   * Uses a rolling window so one lucky answer never spikes the difficulty.
   */
  #adapt() {
    if (this.recent.length < 2) return;
    const rate = this.recent.filter(Boolean).length / this.recent.length;
    if (rate >= 0.85) this.difficulty = Math.min(2, this.difficulty + 0.34);
    else if (rate <= 0.4) this.difficulty = Math.max(0, this.difficulty - 0.34);
  }

  useHint() { this.hintsUsed++; }

  /** Should the game offer a hint for the upcoming challenge? */
  shouldOfferHint() {
    return this.difficulty < 0.9 || this.hintsUsed < 2;
  }

  /** Extra decoys when the learner is comfortable. */
  get decoyBonus() {
    return this.difficulty >= 1.6 ? 1 : this.difficulty <= 0.5 ? -1 : 0;
  }

  /** Movement assist: slower, steadier pacing when struggling. */
  get runSpeedScale() {
    return this.difficulty <= 0.5 ? 0.86 : this.difficulty >= 1.6 ? 1.1 : 1;
  }

  get timerAllowed() {
    return this.difficulty >= 1.3;
  }

  get accuracy() {
    const total = this.correct + this.wrong;
    return total ? this.correct / total : 0;
  }

  /**
   * Should the next beat repeat a weak skill?
   * Only after a genuine stumble, and never as a punishment.
   */
  planPractice(challenge) {
    if (!this.practiceSkills.length) return false;
    const known = this.skills.get(challenge.skill);
    const weak = known && known.mastery < PRACTICE_THRESHOLD;
    return Boolean(weak || this.recent.filter((x) => !x).length >= 2);
  }

  /** Payload for the server: counters only, never a score. */
  toSubmission() {
    return {
      levelId: this.level.id,
      worldId: this.level.worldId,
      correct: this.correct,
      wrong: this.wrong,
      total: this.level.challengeCount,
      timeSec: Math.round(this.elapsed),
      bestStreak: this.bestStreak,
      hintsUsed: this.hintsUsed,
      skills: [...this.skills.values()].map((s) => ({
        skillId: s.skillId,
        skillType: s.skillType,
        label: s.label,
        correct: s.correct,
        wrong: s.attempts - s.correct
      }))
    };
  }
}

/** Skills the learner still needs to work on, weakest first. */
export function weakSkills(skillRows) {
  return (skillRows || [])
    .filter((s) => s.mastery < MASTERY_THRESHOLD)
    .sort((a, b) => a.mastery - b.mastery);
}

export function describeSkill(skill) {
  return {
    ...skill,
    stage: stageFor(skill.mastery).key,
    stageAr: stageFor(skill.mastery).ar,
    status: statusFor(skill.mastery),
    statusAr: STATUS_AR[statusFor(skill.mastery)]
  };
}
