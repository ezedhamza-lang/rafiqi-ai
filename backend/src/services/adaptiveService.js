import prisma from '../db.js';
import { getBook, getBookExercises } from './curriculumService.js';

const MIN_EASE_FACTOR = 1.3;
const MAX_DIFFICULTY = 5;
const MIN_DIFFICULTY = 1;
const DEFAULT_SESSION_LIMIT = 10;
const MAX_SESSION_LIMIT = 30;

export function itemKeyOf(exerciseId, questionIndex) {
  return `${exerciseId}:${questionIndex}`;
}

export function parseItemKey(itemKey) {
  const idx = String(itemKey || '').lastIndexOf(':');
  if (idx <= 0) return null;
  return { exerciseId: itemKey.slice(0, idx), questionIndex: Number(itemKey.slice(idx + 1)) };
}

// ===== SM-2 spaced repetition core =====

export function sm2Next({ repetitions = 0, easeFactor = 2.5, intervalDays = 0 }, quality) {
  const q = Math.max(0, Math.min(5, Math.round(Number(quality) || 0)));
  let ef = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ef < MIN_EASE_FACTOR) ef = MIN_EASE_FACTOR;

  let reps;
  let interval;
  if (q >= 3) {
    reps = (repetitions || 0) + 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round((intervalDays || 1) * ef);
  } else {
    reps = 0;
    interval = 1;
  }

  return { repetitions: reps, easeFactor: ef, intervalDays: interval };
}

export function qualityFromCorrect(correct) {
  return correct ? 5 : 1;
}

// Difficulty 1..5 — rises with consecutive correct answers (تصعيب) and
// drops on mistakes (تسهيل). Derived purely from the student's own answers —
// no fabricated difficulty metadata on real content. Long-term retention is
// handled by the SM-2 scheduling (repetitions/intervalDays/dueAt).
export function difficultyFromState({ streak = 0 }) {
  const recent = Math.min(streak || 0, MAX_DIFFICULTY - MIN_DIFFICULTY);
  return Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, MIN_DIFFICULTY + recent));
}

export function difficultyLabel(difficulty) {
  const labels = {
    1: 'مبتدئ',
    2: 'سهل',
    3: 'متوسط',
    4: 'متقدم',
    5: 'خبير'
  };
  return labels[difficulty] || 'مبتدئ';
}

// ===== Question candidates from the real bank =====

function listBookCandidates(gradeId, subjectId) {
  const book = getBook(gradeId, subjectId);
  if (!book) return [];
  const exercises = getBookExercises(subjectId, book.grade, gradeId);
  const candidates = [];
  for (const ex of exercises) {
    const questions = Array.isArray(ex.questions) ? ex.questions : [];
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      if (!q || q.kind !== 'question' || !q.text) continue;
      candidates.push({
        itemKey: itemKeyOf(ex.id, i),
        exerciseId: ex.id,
        questionIndex: i,
        question: { text: q.text, options: q.options || [], answer: q.answer }
      });
    }
  }
  return candidates;
}

function toPublicState(card) {
  if (!card) return null;
  return {
    repetitions: card.repetitions,
    easeFactor: card.easeFactor,
    intervalDays: card.intervalDays,
    dueAt: card.dueAt,
    difficulty: card.difficulty,
    difficultyLabel: difficultyLabel(card.difficulty),
    reviewCount: card.reviewCount,
    correctCount: card.correctCount,
    streak: card.streak
  };
}

// ===== Session building (spaced queue: due first, then new) =====

export async function buildSession(userId, gradeId, subjectId, requestedLimit = DEFAULT_SESSION_LIMIT) {
  const limit = Math.max(1, Math.min(Number(requestedLimit) || DEFAULT_SESSION_LIMIT, MAX_SESSION_LIMIT));
  const candidates = listBookCandidates(gradeId, subjectId);
  if (!candidates.length) return { items: [], meta: { dueCount: 0, newCount: 0, total: 0, limit } };

  const byKey = new Map(candidates.map((c) => [c.itemKey, c]));

  const cards = await prisma.adaptiveCard.findMany({
    where: { userId, gradeId, subjectId }
  });
  const cardMap = new Map(cards.map((c) => [c.itemKey, c]));

  const now = new Date();
  const due = cards
    .filter((c) => c.dueAt <= now && byKey.has(c.itemKey))
    .sort((a, b) => a.dueAt - b.dueAt);
  const fresh = candidates.filter((c) => !cardMap.has(c.itemKey));

  const items = [];
  for (const card of due) {
    if (items.length >= limit) break;
    const cand = byKey.get(card.itemKey);
    items.push({ itemKey: card.itemKey, question: cand.question, state: toPublicState(card) });
  }
  for (const cand of fresh) {
    if (items.length >= limit) break;
    let card = cardMap.get(cand.itemKey);
    if (!card) {
      card = await prisma.adaptiveCard.create({
        data: {
          userId,
          itemKey: cand.itemKey,
          gradeId,
          subjectId,
          exerciseId: cand.exerciseId,
          questionIndex: cand.questionIndex
        }
      });
      cardMap.set(cand.itemKey, card);
    }
    items.push({ itemKey: cand.itemKey, question: cand.question, state: toPublicState(card) });
  }

  return {
    items,
    meta: {
      dueCount: due.length,
      newCount: fresh.length,
      total: items.length,
      limit
    }
  };
}

// ===== Apply a review (answer) =====

export async function applyReview({ userId, itemKey, gradeId, subjectId, quality, correct }) {
  const parsed = parseItemKey(itemKey);
  if (!parsed) return null;

  const q = correct !== undefined
    ? qualityFromCorrect(!!correct)
    : Math.max(0, Math.min(5, Math.round(Number(quality) || 0)));

  const existing = await prisma.adaptiveCard.findUnique({
    where: { userId_itemKey: { userId, itemKey } }
  });

  const prev = existing || {
    repetitions: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    streak: 0,
    difficulty: MIN_DIFFICULTY,
    reviewCount: 0,
    correctCount: 0
  };

  const next = sm2Next(prev, q);
  const isCorrect = q >= 3;
  const streak = isCorrect ? (prev.streak || 0) + 1 : 0;
  const repetitions = isCorrect ? next.repetitions : 0;
  const difficulty = difficultyFromState({ repetitions, streak });

  const data = {
    ...next,
    repetitions,
    streak,
    difficulty,
    reviewCount: (prev.reviewCount || 0) + 1,
    correctCount: (prev.correctCount || 0) + (isCorrect ? 1 : 0),
    lastQuality: q,
    lastReviewedAt: new Date(),
    dueAt: new Date(Date.now() + next.intervalDays * 86400000)
  };

  const card = existing
    ? await prisma.adaptiveCard.update({ where: { id: existing.id }, data })
    : await prisma.adaptiveCard.create({
        data: { userId, itemKey, gradeId, subjectId, exerciseId: parsed.exerciseId, questionIndex: parsed.questionIndex, ...data }
      });

  return {
    itemKey: card.itemKey,
    quality: q,
    correct: isCorrect,
    state: toPublicState(card),
    next: {
      dueInDays: card.intervalDays,
      dueAt: card.dueAt
    }
  };
}

// ===== Summary =====

export async function summarize(userId, gradeId, subjectId) {
  const where = { userId };
  if (gradeId) where.gradeId = gradeId;
  if (subjectId) where.subjectId = subjectId;

  const cards = await prisma.adaptiveCard.findMany({ where });
  const now = new Date();
  const byDifficulty = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let dueNow = 0;
  let learned = 0;
  let reviewCount = 0;
  let correctCount = 0;

  for (const c of cards) {
    byDifficulty[c.difficulty] = (byDifficulty[c.difficulty] || 0) + 1;
    if (c.dueAt <= now) dueNow += 1;
    if (c.repetitions >= 2) learned += 1;
    reviewCount += c.reviewCount;
    correctCount += c.correctCount;
  }

  return {
    total: cards.length,
    dueNow,
    learned,
    accuracy: reviewCount ? Math.round((correctCount / reviewCount) * 100) : 0,
    reviewCount,
    byDifficulty: Object.entries(byDifficulty).map(([level, count]) => ({ level: Number(level), count })),
    hasActiveFilters: Boolean(gradeId || subjectId)
  };
}
