/**
 * Zone-advancement tests for the ChallengeRunner.
 *
 * The runner is pure logic over stubbed rendering: real THREE objects (no
 * renderer needed), a stub canvas for the text textures, silent audio and a
 * fake scene. What is proven here runs the exact production code path:
 *
 *  1. A platforming beat advances when crossed — it asks no question, so
 *     crossing it IS completing it. (Before this, zoneIndex could never pass
 *     a platform beat and every normal level stalled there: 2026-09-26.)
 *  2. An unsolved zone the player ran past is re-offered (bounded retries),
 *     then abandoned — the run always stays submittable, never stranded.
 *  3. Skipping never invents answers: counters stay honest, accuracy drops.
 *
 * Run:  node --test test/zones.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';

// ---------------------------------------------------------------- stubs
if (!globalThis.window) globalThis.window = {};

if (!globalThis.document) {
  const makeCtx = () => ({
    font: '', fillStyle: '', strokeStyle: '', direction: 'ltr',
    textAlign: 'center', textBaseline: 'middle', lineWidth: 1, globalAlpha: 1,
    measureText: (t) => ({ width: String(t).length * 20 }),
    clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, arcTo() {},
    closePath() {}, fill() {}, arc() {}, fillText() {}, stroke() {}
  });
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => makeCtx()
    })
  };
}

const { ChallengeRunner } = await import('../src/engine/challenges.js');
const { RunState } = await import('../src/engine/mastery.js');

const particles = { burst() {} };
const scene = { add() {} };

const qaBeat = (answer = 'ا') => ({
  beatId: 'qa',
  generator: () => ({
    ordered: false,
    correctValue: answer,
    items: [answer, 'ب', 'ت'],
    skill: 's1', skillType: 'LETTER', skillLabel: 'L1'
  })
});
const platformBeat = () => ({ beatId: 'platform', platformOnly: true, starCount: 5 });

function makeLevel() {
  return {
    id: 'w-test',
    beats: [qaBeat('ا'), platformBeat(), qaBeat('ث')],
    challengeCount: 2
  };
}

function makeRunner() {
  const level = makeLevel();
  const run = new RunState(level, {});
  const runner = new ChallengeRunner(scene, level, run);
  return { runner, run, level };
}

const ZONES = [40, 86, 132];
const step = (runner, toX) => {
  for (let x = 0; x <= toX; x += 2) runner.update(0.016, x, ZONES);
};

function touchCorrect(runner) {
  const ch = runner.currentChallenge();
  assert.ok(ch, 'a challenge is active');
  const tile = runner.tiles.find((t) => !t.dead && String(t.value) === String(ch.correctValue));
  assert.ok(tile, 'the correct tile exists');
  const fb = runner.touch(tile, particles);
  assert.equal(fb.good, true, 'correct touch is accepted');
}

// ---------------------------------------------------------------- tests

test('a solved zone, a platform beat and the final zone complete the run', () => {
  const { runner, run } = makeRunner();

  step(runner, 56);                 // enter + pass zone 0 unsolved? no — touch first
  assert.equal(runner.zoneIndex, 0);

  // solve zone 0 at its tiles, then walk past it
  const ch0 = runner.currentChallenge();
  assert.ok(ch0, 'zone 0 active near x=50');
  touchCorrect(runner);
  step(runner, 70);
  assert.equal(runner.zoneIndex, 1, 'solved zone advances');

  // the platform beat advances on crossing — no question asked
  step(runner, 110);
  assert.equal(runner.zoneIndex, 2, 'platform beat advances when crossed');

  // solve the last zone and cross the line
  touchCorrect(runner);
  step(runner, 160);
  assert.equal(runner.done, true, 'run completes');
  assert.equal(run.correct, 2, 'both answers counted');
});

test('an unsolved zone is re-armed, then skipped — the run stays submittable', () => {
  const { runner, run } = makeRunner();
  let rearms = 0;
  runner.onRearm = () => { rearms++; };

  step(runner, 30);
  assert.ok(runner.currentChallenge(), 'zone 0 activated');

  // Blow past the zone end (40 + 26) without touching anything. Between passes
  // the host rewinds the owl to pendingRewind — simulated here by driving x
  // back down, exactly as the game loop does.
  const pass = (n) => {
    runner.update(0.016, 68, ZONES);
    assert.equal(rearms, n, `re-arm #${n} offered`);
    assert.ok(runner.pendingRewind !== null, 'host is asked to rewind the owl');
    runner.pendingRewind = null;
    runner.update(0.016, 10, ZONES);   // host rewinds the owl behind the zone
  };
  pass(1);
  pass(2);
  pass(3);

  // Fourth pass: retries exhausted → the zone is abandoned, the run moves on.
  runner.update(0.016, 68, ZONES);
  assert.equal(rearms, 3, 'no fourth re-arm — retries are bounded');
  assert.equal(runner.skipped, 1, 'zone abandoned after exhausted retries');
  assert.equal(runner.zoneIndex, 1, 'run moves on');
  assert.equal(run.correct, 0, 'no answers invented');
});

test('skipToEnd finishes the run without fabricating results', () => {
  const { runner, run } = makeRunner();
  step(runner, 50);
  runner.skipToEnd();
  assert.equal(runner.done, true);
  assert.equal(runner.skipped, 3);
  assert.equal(run.correct, 0, 'counters stay honest');
  const sub = run.toSubmission();
  assert.equal(sub.levelId, 'w-test');
  assert.ok(Array.isArray(sub.skills), 'skills array present for the server');
});

test('a wrong touch teaches without ending the zone', () => {
  const { runner } = makeRunner();
  step(runner, 50);
  const ch = runner.currentChallenge();
  const wrong = runner.tiles.find((t) => !t.dead && String(t.value) !== String(ch.correctValue));
  assert.ok(wrong, 'a wrong tile exists');
  const fb = runner.touch(wrong, particles);
  assert.equal(fb.good, false, 'wrong touch is not accepted');
  assert.equal(runner.zoneIndex, 0, 'zone stays open for another try');
  // the correct tile is still there — the zone remains solvable
  touchCorrect(runner);
});
