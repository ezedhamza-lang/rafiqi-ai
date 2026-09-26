/**
 * مغامرة رفيقي – حديقة المعرفة
 * Main game loop: scene setup, the run loop, and screen wiring.
 *
 * Flow:  TITLE → MAP → INTRO → PLAYING → RESULTS → MAP
 * Every reward is computed server-side; this file only ever sends counters.
 */
import * as THREE from '../vendor/three.module.js';
import { TUNING } from './config.js';
import { getLevel, ALL_LEVELS, LEVELS_BY_ID, BEAT_LABELS } from './data/levels.js';
import { findLetter, letterSound, readWord, comprehensionChallenge } from './data/challenges.js';
import { World } from './engine/world.js';
import { Owl } from './engine/owl.js';
import { ChaseCamera } from './engine/camera.js';
import { Particles } from './engine/particles.js';
import { ChallengeRunner } from './engine/challenges.js';
import { Controls } from './engine/controls.js';
import { audio } from './engine/audio.js';
import { RunState } from './engine/mastery.js';
import { makeShadow, clearTextCache } from './engine/textures.js';
import { UI, $ } from './ui/screens.js';
import * as api from './api.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- three setup
const canvas = $('kg-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// Cap the pixel ratio: on a phone a 3x buffer costs more than it shows.
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, 2000);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- game state
const G = {
  phase: 'title',     // title | map | intro | playing | results | paused
  level: null,
  run: null,
  world: null,
  owl: null,
  chase: null,
  particles: null,
  challenges: null,
  brief: null,
  stars: 0,
  gems: 0,
  lastResult: null,
  nextLevelId: null,
  daily: false,
  dailyDayKey: null
};

let save = api.emptySave();
const ui = new UI();

// ---------------------------------------------------------------- lifecycle

/** Tear down the previous level's 3D content completely. */
function teardown() {
  if (G.world) { G.world.dispose(); G.world = null; }
  if (G.challenges) {
    for (const t of G.challenges.tiles) {
      t.group.traverse((o) => {
        o.geometry?.dispose?.();
        o.material?.map?.dispose?.();
        o.material?.dispose?.();
      });
      t.group.removeFromParent();
    }
    G.challenges = null;
  }
  if (G.particles) G.particles.clear();
  if (G.owl) { G.owl.group.removeFromParent(); G.owl = null; }
  if (G.shadow) { G.shadow.removeFromParent(); G.shadow.geometry.dispose(); G.shadow = null; }
  clearTextCache();
}

/** Load progress. Works offline by falling back to the local cache. */
async function refreshSave() {
  const { save: loaded, offline } = await api.loadState();
  save = loaded;
  if (!save.levelResults) save.levelResults = {};
  G.stars = save.profile.stars;
  G.gems = save.profile.gems;
  return offline;
}

/** Which levels the child may open, derived from completed results. */
function isUnlocked(levelId) {
  const level = LEVELS_BY_ID.get(levelId);
  if (!level) return false;
  if (level.order <= 1) return true;
  const previous = ALL_LEVELS.find((l) => l.order === level.order - 1);
  return (save.levelResults?.[previous.id]?.stars ?? 0) > 0;
}

/** The level the map should open by default. */
function currentLevel() {
  return getLevel(save.profile?.currentLevelId || 'w1-l1');
}

function showTitle() {
  G.phase = 'title';
  ui.renderTitle(save, save.badges || []);
  ui.show('kg-title');
  $('kg-hud').classList.add('hidden');
  $('kg-touch').classList.add('hidden');
  $('kg-objective').classList.add('hidden');
  $('kg-hint-btn').classList.add('hidden');
}

function showMap() {
  G.phase = 'map';
  teardown();
  ui.renderMap(save);
  ui.show('kg-map');
  $('kg-hud').classList.add('hidden');
  $('kg-touch').classList.add('hidden');
  $('kg-objective').classList.add('hidden');
  $('kg-hint-btn').classList.add('hidden');
}

/** Show the pre-level briefing, then wait for the child to press start. */
async function openLevel(levelId) {
  if (!isUnlocked(levelId)) {
    ui.feedback('هذه المرحلة مقفلة — أكمل السابقة أولاً', false, 2000);
    return;
  }
  G.level = getLevel(levelId);
  // Ask the server for an adaptivity brief; fall back to sane defaults.
  G.brief = await api.loadLevelBrief(levelId);
  ui.renderIntro(G.level, G.brief);
  ui.show('kg-intro');
  G.phase = 'intro';
  audio.ui();
}

/** Build the 3D level and start the run. */
function startLevel() {
  const level = G.level;
  teardown();

  G.run = new RunState(level, { practiceSkills: G.brief?.practiceSkills || [] });
  G.world = new World(scene, level).build();

  // The owl starts at the beginning of the course.
  G.owl = new Owl(scene);
  G.owl.applyAppearance(save.profile?.appearance || {});
  G.owl.pos.set(0, 1, 0);

  // A fake contact shadow keeps the owl grounded without a shadow map.
  G.shadow = makeShadow(2.2);
  scene.add(G.shadow);

  G.chase = new ChaseCamera(camera);
  G.chase.snap(G.owl.pos);
  G.particles = new Particles(scene);
  G.challenges = new ChallengeRunner(scene, level, G.run);
  G.challenges.onFeedback = onFeedback;
  G.challenges.onRearm = onRearm;

  G.stars = save.profile.stars;
  G.gems = save.profile.gems;
  G.daily = false;
  G.nextLevelId = null;
  G.lastResult = null;

  G.phase = 'playing';
  ui.hideAll();
  $('kg-hud').classList.remove('hidden');
  $('kg-touch').classList.remove('hidden');
  $('kg-hint-btn').classList.remove('hidden');
  updateHud();
  audio.ensure();
}

/** Build a short 5-challenge level for the daily challenge. */
function startDaily(dayKey) {
  G.dailyDayKey = dayKey;
  // A synthetic level: five mixed challenges, no boss.
  const dailyLevel = {
    ...getLevel('w1-l1'),
    id: `daily-${dayKey}`,
    name: 'تحدي اليوم',
    isBoss: false,
    challengeCount: 5,
    beats: [
      { beatId: 'warmup', generator: findLetter },
      { beatId: 'main', generator: letterSound },
      { beatId: 'hard', generator: readWord },
      { beatId: 'final', generator: comprehensionChallenge },
      { beatId: 'final', generator: letterSound }
    ]
  };
  G.level = dailyLevel;
  G.brief = { practiceSkills: [] };
  G.run = new RunState(dailyLevel, {});
  G.world = new World(scene, dailyLevel).build();
  G.owl = new Owl(scene);
  G.owl.applyAppearance(save.profile?.appearance || {});
  G.owl.pos.set(0, 1, 0);
  G.shadow = makeShadow(2.2);
  scene.add(G.shadow);
  G.chase = new ChaseCamera(camera);
  G.chase.snap(G.owl.pos);
  G.particles = new Particles(scene);
  G.challenges = new ChallengeRunner(scene, dailyLevel, G.run);
  G.challenges.onFeedback = onFeedback;
  G.challenges.onRearm = onRearm;

  G.stars = save.profile.stars;
  G.gems = save.profile.gems;
  G.daily = true;
  G.phase = 'playing';
  ui.hideAll();
  $('kg-hud').classList.remove('hidden');
  $('kg-touch').classList.remove('hidden');
  $('kg-hint-btn').classList.add('hidden');
  updateHud();
  audio.ensure();
}

function updateHud() {
  ui.updateHud({
    levelName: G.level ? (G.daily ? 'تحدي اليوم' : G.level.name) : '',
    done: G.run?.challengesDone ?? 0,
    total: G.level?.challengeCount ?? 1,
    stars: G.stars,
    gems: G.gems,
    streak: G.run?.streak ?? 0
  });
}

/** Handle the outcome of one answered challenge. */
function onFeedback(fb) {
  ui.feedback(fb.text, fb.good, fb.good ? 1100 : 2200);
  if (!fb.good) {
    // A tiny camera nudge — noticeable, never punishing.
    G.chase?.addShake(0.32);
  } else {
    // Celebrate streak milestones at 3 / 5 / 10 correct in a row.
    if (G.run.streak === 3 || G.run.streak === 5 || G.run.streak === 10) ui.streakBurst(G.run.streak);
    // The boss visibly weakens with every correct answer.
    if (G.level?.isBoss) G.world?.hitBoss(true);
  }
  refreshObjective();
  updateHud();
}

/**
 * A zone the learner ran past is re-offered behind them: rewind the owl so
 * the retry is reachable, and say so kindly. Teaching, never punishment.
 */
function onRearm() {
  const to = G.challenges?.pendingRewind;
  G.challenges.pendingRewind = null;
  if (to != null && G.owl && G.owl.pos.x > to) {
    G.owl.pos.set(to, 8, G.owl.pos.z);
    if (G.owl.vel) G.owl.vel.set(0, 0, 0);
    G.chase?.snap?.(G.owl.pos);
  }
  ui.feedback('مرة أخرى 💪 — حاول مجدداً', true, 2200);
  refreshObjective();
}

/** Repaint the objective banner for the current challenge. */
function refreshObjective() {
  const ch = G.challenges?.currentChallenge();
  const beat = G.level?.beats[G.challenges?.zoneIndex ?? 0];
  ui.updateObjective({
    beatLabel: beat ? (BEAT_LABELS[beat.beatId] || beat.beatId) : 'التحدي',
    challenge: ch,
    collected: G.challenges?.collected || [],
    slots: ch?.ordered ? ch.orderedItems : null
  });

  // Hints appear only when the child is struggling (adaptive difficulty).
  const offerHint = G.run?.shouldOfferHint() && !G.daily;
  $('kg-hint-btn').classList.toggle('hidden', !offerHint || !ch);
}

/** Give a hint for the current challenge and count it. */
function useHint() {
  const ch = G.challenges?.currentChallenge();
  if (!ch || !G.run) return;
  G.run.useHint();
  ui.feedback(ch.hint || 'انظر إلى الخيارات بتأنٍّ', false, 2600);
  updateHud();
}

// ---------------------------------------------------------------- collisions

/**
 * Simple AABB-style collision helpers against the world's box colliders.
 * Enough for a runner of this scale and far cheaper than a physics engine.
 */
function groundHeightAt(x, z, fromY) {
  let best = -Infinity;
  for (const seg of G.world.groundSegments) {
    if (x < seg.x - seg.hw || x > seg.x + seg.hw) continue;
    if (z < seg.z - seg.hd || z > seg.z + seg.hd) continue;
    if (seg.top <= fromY + 3.2 && seg.top > best) best = seg.top;
  }
  return best === -Infinity ? 0 : best;
}

function inGap(x, z) {
  for (const g of G.world.gaps) {
    if (x > g.x - g.w / 2 && x < g.x + g.w / 2 && Math.abs(z) < 24) return true;
  }
  return false;
}

/** Handle every pickup collision for this frame. */
function checkCollisions(dt) {
  const pos = G.owl.pos;

  // --- stars (free collectibles, purely for joy and score flavour)
  for (const s of G.world.stars) {
    if (s.dead) continue;
    if (s.mesh.position.distanceTo(pos) < TUNING.collectRadius) {
      s.dead = true;
      s.mesh.visible = false;
      G.particles.burst(s.mesh.position, 12, 7, 0xffd166);
      audio.star();
      G.particles.confetti(pos, [0xffd166, 0xffffff]);
    }
  }

  // --- educational tiles
  for (const tile of G.challenges.tiles) {
    if (tile.dead) continue;
    if (tile.group.position.distanceTo(pos) < TUNING.collectRadius + 1.4) {
      G.challenges.touch(tile, G.particles);
      // Reset the local cooldown so one tile cannot trigger twice in a frame.
      G.touchCooldown = 0.15;
    }
  }

  // --- obstacles: a soft nudge sideways, never a death
  for (const o of G.world.obstacles) {
    const d = Math.hypot(o.x - pos.x, o.z - pos.z);
    if (d < o.r + 1.6 && pos.y < o.y + 3) {
      G.chase.addShake(0.25);
      G.owl.vel.z += (pos.z > o.z ? 8 : -8) * dt * 10;
    }
  }

  // --- falling into a gap: respawn at the last checkpoint, no score loss
  if (pos.y < -12 || (inGap(pos.x, pos.z) && pos.y < -2)) {
    const cp = [...G.world.checkpoints].reverse().find((c) => c.x <= pos.x) || { x: 0 };
    G.owl.respawn(cp.x);
    G.chase.snap(G.owl.pos);
    ui.feedback('عودت بك إلى نقطة البداية — لا بأس!', false, 1400);
  }
  void dt;
}

// ---------------------------------------------------------------- run loop

let lastTime = performance.now();
let touchCooldown = 0;

function loop(now = performance.now()) {
  requestAnimationFrame(loop);
  // Clamp dt so a background tab does not teleport the owl on return.
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (G.phase === 'playing' && G.owl && G.world) {
    G.run.elapsed += dt;
    if (touchCooldown > 0) touchCooldown -= dt;

    controls.update();
    const { dashing } = G.owl.update(dt, {
      steer: controls.steer,
      jump: controls.consumeJump(),
      dash: controls.consumeDash(),
      speedScale: G.run.runSpeedScale
    });

    // Cosmetic trail behind a dashing owl.
    if (dashing && G.owl.trailColor) G.particles.trail(G.owl.pos, G.owl.trailColor);

    // Land on the highest platform under the owl.
    if (G.owl.vel.y <= 0) {
      const floor = groundHeightAt(G.owl.pos.x, G.owl.pos.z, G.owl.pos.y);
      if (G.owl.pos.y <= floor) {
        G.owl.pos.y = floor;
        G.owl.vel.y = 0;
        G.owl.onGround = true;
        G.owl.jumps = 0;
      }
    }

    G.world.update(dt);
    G.challenges.update(dt, G.owl.pos.x, G.world.zoneX);
    if (touchCooldown <= 0) checkCollisions(dt);

    G.particles.update(dt);
    G.chase.update(dt, G.owl.pos, controls.steer, G.owl.speed / TUNING.dashSpeed);

    // The contact shadow follows and shrinks with height.
    if (G.shadow) {
      G.shadow.position.set(G.owl.pos.x, 0.3, G.owl.pos.z);
      const h = clamp(G.owl.pos.y / 18, 0, 1);
      G.shadow.scale.setScalar(1 - h * 0.55);
      G.shadow.material.opacity = 0.9 - h * 0.6;
    }

    refreshObjective();
    updateHud();

    // Finished the level: crossed the finish line with all zones solved.
    if (G.challenges.done && G.owl.pos.x > G.world.finishX) {
      finishLevel();
    } else if (!G.challenges.done && G.owl.pos.x > G.world.finishX + 40) {
      // Safety valve: every retry is used and the learner reached the gate with
      // zones left. Abandon them so the run can still be submitted — skipped
      // zones count as unanswered, which lowers the stars. Nobody is stranded.
      G.challenges.skipToEnd();
      ui.feedback('انتهت المحاولات — سلّمنا إجاباتك 🙂', false, 3000);
    }
  } else if (G.phase !== 'paused') {
    // Keep the world alive behind menus, but frozen without an owl.
    if (G.world) {
      G.world.update(dt);
      G.particles?.update(dt);
    }
  }

  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- completion

/** Level finished: send counters, then render the server's verdict. */
async function finishLevel() {
  if (G.phase !== 'playing') return;
  G.phase = 'submitting';
  $('kg-touch').classList.add('hidden');
  $('kg-hint-btn').classList.add('hidden');

  const run = G.run;
  const isBoss = Boolean(G.level.isBoss);
  if (isBoss) audio.bossDone();
  else audio.levelDone();
  G.particles.confetti(G.owl.pos);

  // The client sends counters only — never a score.
  const server = G.daily
    ? await api.submitDaily({
      dayKey: G.dailyDayKey,
      correct: run.correct,
      total: G.level.challengeCount,
      skills: run.toSubmission().skills
    })
    : await api.submitLevel(run.toSubmission());

  G.lastResult = server;
  G.nextLevelId = server?.nextLevelId || null;

  // Refresh the local save so the map reflects the new progress immediately.
  await refreshSave();

  // Merge in the server's own numbers for the HUD.
  if (server?.result) {
    G.stars = save.profile.stars;
    G.gems = save.profile.gems;
  }

  G.phase = 'results';
  $('kg-hud').classList.add('hidden');
  $('kg-objective').classList.add('hidden');
  ui.renderResults({
    run,
    server,
    isBoss: isBoss || G.daily,
    nextLevelId: G.nextLevelId
  });
  ui.show('kg-results');
}

/** After a daily run, the reward screen is replaced by a short summary. */

// ---------------------------------------------------------------- controls
const controls = new Controls(document.body);
controls.onPause = togglePause;

function togglePause() {
  if (G.phase === 'playing') {
    G.phase = 'paused';
    $('kg-pause').classList.remove('hidden');
    $('kg-touch').classList.add('hidden');
  } else if (G.phase === 'paused') {
    G.phase = 'playing';
    $('kg-pause').classList.add('hidden');
    $('kg-touch').classList.remove('hidden');
  }
}

// ---------------------------------------------------------------- UI wiring

ui.onPickLevel = (levelId) => openLevel(levelId);

// The map's level buttons route through openLevel too.
$('kg-start').addEventListener('click', () => { audio.ensure(); showMap(); });
$('kg-continue').addEventListener('click', () => { audio.ensure(); openLevel(currentLevel().id); });
$('kg-map-back').addEventListener('click', showTitle);
$('kg-intro-go').addEventListener('click', startLevel);

$('kg-pause-btn').addEventListener('click', togglePause);
$('kg-resume').addEventListener('click', togglePause);
$('kg-quit').addEventListener('click', () => { showMap(); });

$('kg-hint-btn').addEventListener('click', useHint);

$('kg-next').addEventListener('click', () => {
  if (G.nextLevelId) openLevel(G.nextLevelId);
  else showMap();
});
$('kg-retry').addEventListener('click', () => startLevel());
$('kg-to-map').addEventListener('click', showMap);

// --- daily challenge
$('kg-daily-btn').addEventListener('click', () => {
  ui.renderDaily(save);
  ui.show('kg-daily');
});
$('kg-daily-close').addEventListener('click', showMap);
$('kg-daily-start').addEventListener('click', () => {
  const key = G.dailyDayKey || ui.renderDaily(save);
  if (G.dailyDayKey === key && (save.daily || []).some((d) => d.dayKey === key)) {
    ui.feedback('أنجزت تحدي اليوم — عد غداً!', true, 1800);
    return;
  }
  startDaily(key);
});

// --- panels
$('kg-skills-btn').addEventListener('click', () => { ui.renderSkills(save); ui.show('kg-skills'); });
$('kg-skills-close').addEventListener('click', showMap);

$('kg-badges-btn').addEventListener('click', () => { ui.renderBadges(save); ui.show('kg-badges'); });
$('kg-badges-close').addEventListener('click', showMap);

$('kg-wardrobe-btn').addEventListener('click', () => {
  ui.renderWardrobe(save, pickCosmetic);
  ui.show('kg-wardrobe');
});
$('kg-wardrobe-close').addEventListener('click', showMap);

/** Equip a cosmetic: apply instantly, persist through the server. */
async function pickCosmetic(kind, id) {
  save.profile.appearance = { ...(save.profile.appearance || {}), [kind]: id };
  G.owl?.applyAppearance(save.profile.appearance);
  ui.renderWardrobe(save, pickCosmetic);
  const res = await api.saveAppearance(save.profile.appearance);
  // The server is authoritative; adopt whatever it accepted.
  if (res?.appearance) save.profile.appearance = res.appearance;
  ui.feedback('تم حفظ المظهر الجديد', true, 1200);
}

// --- sound toggle
$('kg-sound-toggle').addEventListener('click', () => {
  audio.ensure();
  audio.setMuted(!audio.muted);
  const icon = $('kg-sound-toggle').querySelector('span');
  if (icon) icon.textContent = audio.muted ? '🔇' : '🔊';
});

// Pause automatically when the tab is hidden mid-run.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.phase === 'playing') togglePause();
});

// ---------------------------------------------------------------- boot

(async function boot() {
  const offline = await refreshSave();
  showTitle();
  $('kg-loading').classList.add('is-gone');
  if (offline) {
    // Not an error: the game stays fully playable, progress syncs later.
    console.info('[KnowledgeGarden] playing offline — progress will sync when signed in');
  }
  // Start the render loop once everything is ready.
  loop();
})();
