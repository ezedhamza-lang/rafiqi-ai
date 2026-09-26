/**
 * Headless test for the Knowledge Garden game logic.
 *
 * The WebGL layer is stubbed so the *educational* logic — challenge
 * generation, ordered collection, mastery, adaptivity and the server
 * submission payload — can be verified in Node without a browser.
 *
 * Run:  node --test test/game.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';

// ---------------------------------------------------------------- DOM stub
// The game modules touch `document` for canvas textures and screens. A minimal
// stub is enough to import them and to exercise the non-rendering logic.
if (!globalThis.document) {
  const makeCtx = () => ({
    font: '', fillStyle: '', strokeStyle: '', direction: 'ltr',
    textAlign: 'center', textBaseline: 'middle', lineWidth: 1, globalAlpha: 1,
    measureText: (t) => ({ width: String(t).length * 20 }),
    clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, arcTo() {},
    closePath() {}, fill() {}, arc() {}, fillText() {}, drawImage() {},
    createRadialGradient: () => ({ addColorStop() {} })
  });
  globalThis.document = {
    createElement: () => ({ width: 0, height: 0, getContext: makeCtx, style: {} }),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    getElementById: () => null
  };
  globalThis.window = { AudioContext: undefined, webkitAudioContext: undefined };
  globalThis.localStorage = {
    _d: {},
    getItem(k) { return this._d[k] ?? null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; }
  };
  globalThis.addEventListener = () => {};
  globalThis.performance = globalThis.performance || { now: () => Date.now() };
  globalThis.devicePixelRatio = 1;
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 720;
}

const BASE = new URL('../src/', import.meta.url);
const load = (p) => import(new URL(p, BASE).href);

const { ALL_LEVELS, LEVELS_BY_ID, LEVELS_PER_WORLD, WORLD_ORDER, getLevel } = await load('data/levels.js');
const challenges = await load('data/challenges.js');
const { RunState, stageFor, statusFor, MASTERY_THRESHOLD, STREAK_MESSAGES } = await load('engine/mastery.js');

const generators = {
  findLetter: challenges.findLetter,
  findLetterInWord: challenges.findLetterInWord,
  letterSound: challenges.letterSound,
  buildSyllable: challenges.buildSyllable,
  buildWord: challenges.buildWord,
  pickWordForImage: challenges.pickWordForImage,
  missingLetter: challenges.missingLetter,
  orderLetters: challenges.orderLetters,
  findWrongWord: challenges.findWrongWord,
  readWord: challenges.readWord,
  buildSentence: challenges.buildSentence,
  comprehension: challenges.comprehensionChallenge,
  grammar: challenges.grammarChallenge,
  number: challenges.numberChallenge,
  logic: challenges.logicChallenge
};

// ============================================================ level table

test('there are 35 levels across 7 worlds', () => {
  assert.equal(ALL_LEVELS.length, 35);
  assert.equal(WORLD_ORDER.length, 7);
  assert.equal(LEVELS_PER_WORLD, 5);
});

test('every level has a unique id and a consecutive order', () => {
  const ids = new Set(ALL_LEVELS.map((l) => l.id));
  assert.equal(ids.size, 35, 'level ids must be unique');
  ALL_LEVELS.forEach((l, i) => assert.equal(l.order, i + 1, `${l.id} order`));
});

test('every 5th level is a boss with exactly 10 challenges', () => {
  const bosses = ALL_LEVELS.filter((l) => l.isBoss);
  assert.equal(bosses.length, 7);
  for (const b of bosses) {
    assert.equal(b.challengeCount, 10, `${b.id} challengeCount`);
    assert.equal(b.beats.length, 10, `${b.id} beats`);
    assert.ok(b.boss?.name, `${b.id} has a boss name`);
  }
});

test('a normal level follows warm-up → main → platform → hard → final', () => {
  // w1-l3 is the first level with the standard five-beat shape.
  const normal = getLevel('w1-l3');
  assert.deepEqual(normal.beats.map((b) => b.beatId), ['warmup', 'main', 'platform', 'hard', 'final']);
  // Exactly one pure platforming beat, and it is not counted as a challenge.
  assert.equal(normal.beats.filter((b) => b.platformOnly).length, 1);
  assert.equal(normal.challengeCount, normal.beats.length - 1);
});

test('the two opening levels get an extra gentle repetition', () => {
  assert.equal(getLevel('w1-l1').beats.filter((b) => b.beatId === 'warmup').length, 2);
  assert.equal(getLevel('w1-l3').beats.filter((b) => b.beatId === 'warmup').length, 1);
});

test('timers only appear in the Challenge Valley and beyond', () => {
  for (const l of ALL_LEVELS) {
    if (l.worldIndex < 4) {
      assert.equal(l.beats.some((b) => b.timed), false, `${l.id} must not be timed`);
    }
  }
  assert.ok(getLevel('w5-l4').beats.some((b) => b.timed));
});

// ============================================================ challenge generators

test('every generator produces a well-formed challenge with a skill', () => {
  for (const [name, gen] of Object.entries(generators)) {
    for (let i = 0; i < 25; i++) {
      const ch = gen();
      assert.ok(ch.kind, `${name} has kind`);
      assert.ok(ch.prompt, `${name} has prompt`);
      assert.ok(ch.hint, `${name} has a hint (teaching, not testing)`);
      assert.ok(ch.skill && ch.skillType && ch.skillLabel, `${name} has skill metadata`);
      const isPanel = challenges.isPanelChallenge(ch);
      if (isPanel) {
        assert.ok(Array.isArray(ch.options) && ch.options.length >= 2, `${name} has options`);
      } else {
        assert.ok(Array.isArray(ch.items) && ch.items.length > 0, `${name} has items`);
      }
      // Ordered challenges are answered by collecting their parts in sequence,
      // so the correct answer is the assembled word rather than a single tile.
      if (!isPanel && !ch.ordered) {
        assert.ok(ch.correctValue !== undefined, `${name} has a correct value`);
        // The correct answer must actually be reachable among the items.
        assert.ok(
          ch.items.some((v) => String(v) === String(ch.correctValue)),
          `${name} answer "${ch.correctValue}" missing from items`
        );
      }
      // Every tile is rendered as text in 3D. A non-string item (e.g. a word
      // object instead of word.text) prints as "[object Object]" and makes the
      // challenge unsolvable by reading — this exact regression shipped once
      // (findLetterInWord, 2026-09-26) while the suite stayed green.
      if (!isPanel) {
        for (const v of ch.items) {
          assert.equal(typeof v, 'string', `${name} tile must be a string, got ${typeof v}`);
          assert.ok(v.length > 0 && v !== '[object Object]', `${name} tile is printable`);
        }
      }
    }
  }
});

test('a challenge never offers only one option', () => {
  for (const [name, gen] of Object.entries(generators)) {
    const ch = gen();
    if (challenges.isPanelChallenge(ch)) {
      assert.ok(ch.options.length >= 2, `${name} needs at least 2 options`);
      assert.ok(ch.correctIndex >= 0 && ch.correctIndex < ch.options.length, `${name} answer index in range`);
    } else {
      assert.ok(ch.items.length >= 2, `${name} needs at least 2 tiles`);
    }
  }
});

test('ordered challenges can always be completed in the printed order', () => {
  for (const name of ['buildSyllable', 'buildWord', 'orderLetters', 'buildSentence']) {
    for (let i = 0; i < 20; i++) {
      const ch = generators[name]();
      assert.equal(ch.ordered, true, `${name} is ordered`);
      for (const part of ch.orderedItems) {
        assert.ok(ch.items.includes(part), `${name} tile "${part}" is present in items`);
      }
      // A scrambled list must not accidentally already be the answer.
      if (ch.items.length === ch.orderedItems.length) {
        assert.notEqual(ch.items.join('|'), ch.orderedItems.join('|'), `${name} must be scrambled`);
      }
    }
  }
});

test('word builders collect exactly the letters of the target word', () => {
  for (let i = 0; i < 30; i++) {
    const ch = generators.buildWord();
    assert.equal([...ch.target].sort().join(''), [...ch.orderedItems].sort().join(''));
  }
});

test('missing-letter challenges blank exactly one letter of the word', () => {
  for (let i = 0; i < 20; i++) {
    const ch = generators.missingLetter();
    const blanks = ch.pattern.split(' ').filter((p) => p === '_').length;
    assert.equal(blanks, 1, 'exactly one gap');
    // The pattern shown to the child matches the length of the real word.
    assert.equal(ch.pattern.split(' ').length, [...ch.word].length);
    assert.ok([...ch.word].includes(ch.correctValue));
    // The explanation must reveal the whole word, never the pattern.
    assert.ok(ch.explain.includes(ch.word));
  }
});

test('find-wrong-word offers the misspelling and explains the correction', () => {
  for (let i = 0; i < 20; i++) {
    const ch = generators.findWrongWord();
    assert.ok(ch.items.includes(ch.correctValue), 'the bad word is offered');
    assert.ok(ch.explain && ch.explain.includes('الصحيحة'), 'the correction is explained');
  }
});

// ============================================================ mastery & adaptivity

test('mastery climbs on success and falls gently on mistakes', () => {
  const run = new RunState(getLevel('w1-l1'));
  const ch = generators.findLetter();
  // Enough correct answers to reach the final stage of the ladder.
  for (let i = 0; i < 40; i++) run.record(ch, true);
  // Snapshot the number: the stored record is mutated in place.
  const peak = run.skills.get(ch.skill).mastery;
  assert.ok(peak >= 92, `reaches the mastery stage, got ${peak}`);
  assert.equal(statusFor(peak), 'MASTERED');

  for (let i = 0; i < 5; i++) run.record(ch, false);
  const after = run.skills.get(ch.skill).mastery;
  assert.ok(after < peak, `mistakes reduce mastery (${peak} -> ${after})`);
  assert.ok(after >= 60, `decay stays gentle, got ${after}`);
});

test('the six-stage ladder is reached in order', () => {
  assert.equal(stageFor(0).key, 'RECOGNITION');
  assert.equal(stageFor(25).key, 'IDENTIFICATION');
  assert.equal(stageFor(45).key, 'APPLICATION');
  assert.equal(stageFor(65).key, 'CONSTRUCTION');
  assert.equal(stageFor(80).key, 'CHALLENGE');
  assert.equal(stageFor(95).key, 'MASTERY');
  assert.ok(MASTERY_THRESHOLD >= 70);
});

test('difficulty rises with success and drops with struggle', () => {
  const good = new RunState(getLevel('w1-l1'));
  const ch = generators.findLetter();
  for (let i = 0; i < 8; i++) good.record(ch, true);
  assert.ok(good.difficulty > 1, 'a strong run raises the difficulty');

  const bad = new RunState(getLevel('w1-l1'));
  for (let i = 0; i < 8; i++) bad.record(ch, false);
  assert.ok(bad.difficulty < 1, 'a hard run lowers the difficulty');
  // Assistance is offered precisely when the child is struggling.
  assert.equal(bad.shouldOfferHint(), true);
  assert.ok(bad.runSpeedScale < 1, 'the world slows down to help');
});

test('adaptivity never exceeds its bounds', () => {
  const run = new RunState(getLevel('w1-l1'));
  const ch = generators.findLetter();
  for (let i = 0; i < 50; i++) run.record(ch, true);
  assert.ok(run.difficulty <= 2);
  for (let i = 0; i < 50; i++) run.record(ch, false);
  assert.ok(run.difficulty >= 0);
});

test('streaks are tracked and reset on a mistake', () => {
  const run = new RunState(getLevel('w1-l1'));
  const ch = generators.findLetter();
  for (let i = 0; i < 5; i++) run.record(ch, true);
  assert.equal(run.streak, 5);
  assert.equal(run.bestStreak, 5);
  run.record(ch, false);
  assert.equal(run.streak, 0, 'a mistake breaks the streak');
  assert.equal(run.bestStreak, 5, 'but the best streak is remembered');
});

test('streak milestones exist at 3, 5 and 10', () => {
  const ats = STREAK_MESSAGES.map((m) => m.at);
  assert.ok(ats.includes(3) && ats.includes(5) && ats.includes(10));
});

// ============================================================ submission payload

test('the submission carries counters only — never a score', () => {
  const level = getLevel('w1-l1');
  const run = new RunState(level);
  const ch = generators.findLetter();
  run.record(ch, true);
  run.record(ch, false);
  run.elapsed = 42.6;

  const payload = run.toSubmission();
  assert.equal(payload.levelId, level.id);
  assert.equal(payload.worldId, level.worldId);
  assert.equal(payload.correct, 1);
  assert.equal(payload.wrong, 1);
  assert.equal(payload.total, level.challengeCount);
  assert.equal(payload.timeSec, 43);

  // The client must not be able to influence rewards.
  for (const forbidden of ['score', 'stars', 'gems', 'xp', 'mastery', 'rewards']) {
    assert.equal(payload[forbidden], undefined, `payload must not contain ${forbidden}`);
  }
  for (const s of payload.skills) {
    assert.deepEqual(
      Object.keys(s).sort(),
      ['correct', 'label', 'skillId', 'skillType', 'wrong'],
      'skill entries carry counters and identity only'
    );
  }
});

test('per-skill counters add up to the run totals', () => {
  const run = new RunState(getLevel('w1-l2'));
  for (const ch of [generators.findLetter(), generators.buildWord()]) {
    run.record(ch, true);
    run.record(ch, false);
  }
  const payload = run.toSubmission();
  const sumCorrect = payload.skills.reduce((a, s) => a + s.correct, 0);
  const sumWrong = payload.skills.reduce((a, s) => a + s.wrong, 0);
  assert.equal(sumCorrect, payload.correct);
  assert.equal(sumWrong, payload.wrong);
});

test('every level reports its own real challenge count', () => {
  for (const level of ALL_LEVELS) {
    const run = new RunState(level);
    assert.equal(run.toSubmission().total, level.challengeCount);
    assert.ok(level.challengeCount >= 4, `${level.id} must have real challenges`);
  }
});

test('LEVELS_BY_ID resolves every level id', () => {
  for (const l of ALL_LEVELS) assert.equal(LEVELS_BY_ID.get(l.id), l);
  assert.equal(getLevel('w4-l3').id, 'w4-l3');
});
