/**
 * عدّاء التحديات — spawns and judges the educational tiles in the world.
 *
 * Educational content is not a questionnaire: each challenge is a set of
 * floating tiles laid out across the running line, and the child must steer
 * the owl into the right one. Wrong tiles teach instead of punishing.
 *
 * For ordered challenges (building a word or a sentence) the tiles must be
 * collected in sequence, so a child learns the shape of the word, not a guess.
 */
import * as THREE from '../../vendor/three.module.js';
import { textSprite } from './textures.js';
import { audio } from './audio.js';

const CORRECT_COLOR = 0x10b981;
const WRONG_COLOR = 0x94a3b8;

/**
 * Every tile looks identical before it is touched.
 *
 * This is deliberate: colouring the right answer would turn the game into a
 * reflex task. The child must actually read the letter/word to choose, and only
 * then does the tile glow to confirm it.
 */
const TILE_BG = 0x2f4f8a;
const TILE_HALO = 0x5b8cff;

export class Tile {
  constructor(scene, { value, index, pos, orderedIndex = null, style = {} }) {
    this.value = value;
    this.isCorrect = false;
    this.index = index;
    this.orderedIndex = orderedIndex;
    this.dead = false;
    this.pos = pos.clone();
    this.t = Math.random() * 6;

    this.group = new THREE.Group();

    // A rounded plate with the letter/word on it.
    // Kept deliberately small: the child must still see the road ahead, and
    // the tiles must be readable without filling the whole screen.
    const isLong = String(value).length > 2;
    this.sprite = textSprite(
      String(value),
      TILE_BG,
      0xffffff,
      isLong ? 150 : 200,
      isLong ? 22 : 26
    );
    const base = isLong ? 4.4 : 3.2;
    this.sprite.scale.set(base * (this.sprite.userData.aspect || 1), base, 1);
    this.group.add(this.sprite);

    // A soft halo so the tile pops against the scenery — neutral, not a hint.
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(isLong ? 2.2 : 1.7, 24),
      new THREE.MeshBasicMaterial({
        color: TILE_HALO,
        transparent: true, opacity: 0.3, depthWrite: false
      })
    );
    halo.position.z = -0.3;
    this.group.add(halo);
    this.halo = halo;

    // A pedestal that reaches the ground, so each tile reads as a standing
    // object in the world rather than a shape floating in mid-air.
    const postHeight = 3.0;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.26, postHeight, 8),
      new THREE.MeshLambertMaterial({ color: style.postColor ?? 0x1e3a6e })
    );
    post.position.y = -1.5 - postHeight / 2 + 0.1;
    this.group.add(post);

    this.group.position.copy(pos);
    scene.add(this.group);
  }

  update(dt) {
    this.t += dt;
    this.sprite.position.y = Math.sin(this.t * 2) * 0.45;
    this.group.rotation.y = Math.sin(this.t * 0.8) * 0.22;
  }

  /** Correct tiles glow; a wrong tile dims and turns away. */
  reveal(good) {
    this.halo.material.color.setHex(good ? 0x22c55e : 0xef4444);
    this.halo.material.opacity = good ? 0.7 : 0.4;
    if (!good) this.group.rotation.z = 0.25;
  }

  collect() {
    this.dead = true;
    this.group.visible = false;
  }
}

/**
 * Runs one level's challenge list.
 *
 * It owns the zone the player is currently in, spawns that zone's tiles, and
 * judges what the owl touches. It also tracks the built-so-far string for
 * ordered challenges so a partial word can be shown in the HUD.
 */
export class ChallengeRunner {
  constructor(scene, level, runState) {
    this.scene = scene;
    this.level = level;
    this.run = runState;
    this.zoneIndex = 0;
    this.tiles = [];
    this.challenge = null;
    this.collected = [];        // ordered collection progress
    this.expected = 0;          // next required index for ordered challenges
    this.onComplete = null;     // () => void
    this.onFeedback = null;     // ({good, text, kind}) => void
    this.onRearm = null;        // (challenge, attempt) => void — a zone is re-offered
    this.correct = 0;
    this.rearms = 0;            // retries used on the CURRENT zone
    this.skipped = 0;           // zones abandoned after exhausting retries
    // Set when the host must rewind the owl so a re-armed zone is reachable.
    this.pendingRewind = null;
  }

  get total() { return this.level.challengeCount; }
  get done() { return this.zoneIndex >= this.level.beats.length; }

  /** The challenge currently being presented (null on platforming beats). */
  currentChallenge() { return this.challenge; }

  /**
   * Enter the next educational zone.
   * `zoneX` is the x position of the zone; tiles are spread across Z.
   */
  #enterZone(beat, zoneX) {
    const ch = beat.generator ? beat.generator() : null;
    this.challenge = ch;
    this.collected = [];
    this.expected = 0;
    this.tiles.forEach((t) => t.collect());
    this.tiles = [];
    if (!ch) return;

    // Tiles are laid out in a gentle forward-staggered arc: spread across the
    // lanes (z) so steering is required, but shallow enough that the child can
    // see the whole row at once and read every option before choosing.
    const baseX = zoneX + 10;
    const items = ch.items;
    const span = 13;   // total width across the lanes
    items.forEach((value, i) => {
      const t = items.length === 1 ? 0.5 : i / (items.length - 1);
      const z = (t - 0.5) * span;
      // A slight x stagger adds depth without hiding the far tiles.
      const x = baseX + Math.abs(t - 0.5) * 5;
      // For ordered challenges mark which position in the sequence a tile holds,
      // so the runner can tell "in order" apart from "wrong letter".
      const orderedIndex = ch.ordered ? ch.orderedItems.indexOf(value) : null;
      this.tiles.push(new Tile(this.scene, {
        value, index: i, orderedIndex, pos: new THREE.Vector3(x, 3.2, z)
      }));
    });
  }

  /** Advance the player into the next zone when they pass the current one. */
  update(dt, playerX, zonePositions) {
    for (const t of this.tiles) if (!t.dead) t.update(dt);
    if (this.done) return;

    const currentZone = zonePositions[this.zoneIndex];
    if (currentZone === undefined) return;
    const beat = this.level.beats[this.zoneIndex];

    // Activate the zone as the player approaches it.
    if (!this.challenge && beat.generator) {
      if (playerX > currentZone - 30) this.#enterZone(beat, currentZone);
      return;
    }

    // Platforming beats ask no question — crossing one IS completing it. (Before
    // this branch, zoneIndex could never advance past a platform beat, so every
    // normal level stalled there forever: found live, 2026-09-26.)
    if (!this.challenge && beat.platformOnly && playerX > currentZone + 12) {
      this.zoneIndex++;
      this.rearms = 0;
      if (this.zoneIndex >= this.level.beats.length && this.onComplete) this.onComplete();
      return;
    }

    // A solved zone is left behind once the player runs past it.
    if (this.challenge && this.#zoneSolved() && playerX > currentZone + 12) {
      this.zoneIndex++;
      this.rearms = 0;
      this.challenge = null;
      this.tiles.forEach((t) => t.collect());
      this.tiles = [];
      if (this.zoneIndex >= this.level.beats.length && this.onComplete) this.onComplete();
      return;
    }

    // An unsolved zone the player has run past. Without this the run can never
    // finish: the owl keeps running, `done` stays false and the level has no
    // end (found live in the browser, 2026-09-26 — 3/5 then silence forever).
    // Re-offer the zone just behind the owl; after bounded retries, abandon it
    // so the run stays submittable. Unanswered items simply lower accuracy —
    // nothing is granted silently.
    if (this.challenge && !this.#zoneSolved() && playerX > currentZone + 26) {
      if (this.rearms < 3) {
        this.rearms++;
        this.#enterZone(beat, currentZone);
        this.pendingRewind = Math.max(0, currentZone - 30);
        this.onRearm?.(this.challenge, this.rearms);
      } else {
        this.skipped++;
        this.rearms = 0;
        this.zoneIndex++;
        this.challenge = null;
        this.tiles.forEach((t) => t.collect());
        this.tiles = [];
        if (this.zoneIndex >= this.level.beats.length && this.onComplete) this.onComplete();
      }
    }
  }

  /**
   * Abandon every remaining zone. Last-resort path so a run at the finish gate
   * with exhausted retries can still be submitted instead of stranding the
   * player. Skipped zones count as unanswered, which lowers the stars.
   */
  skipToEnd() {
    if (this.done) return;
    this.skipped += this.level.beats.length - this.zoneIndex;
    this.zoneIndex = this.level.beats.length;
    this.challenge = null;
    this.tiles.forEach((t) => t.collect());
    this.tiles = [];
    if (this.onComplete) this.onComplete();
  }

  #zoneSolved() {
    if (!this.challenge) return true;
    if (this.challenge.ordered) {
      return this.collected.length >= this.challenge.orderedItems.length;
    }
    return this.correct >= 1;
  }

  /** The owl touched a tile. Returns a feedback payload, or null. */
  touch(tile, particles) {
    const ch = this.challenge;
    if (!ch || tile.dead) return null;

    // --- ordered challenges: the sequence must be respected.
    if (ch.ordered) {
      if (tile.orderedIndex === this.expected) {
        this.collected.push(tile.value);
        this.expected++;
        tile.collect();
        particles.burst(tile.pos, 16, 10, CORRECT_COLOR);
        audio.shatter();
        const complete = this.expected >= ch.orderedItems.length;
        this.correct++;
        this.run.record(ch, complete);
        const fb = {
          good: true,
          kind: complete ? 'word' : 'partial',
          text: complete ? `أحسنت! «${ch.correctValue}» 🎉` : this.collected.join(' '),
          skill: ch.skill
        };
        if (this.onFeedback) this.onFeedback(fb);
        return fb;
      }
      // Out of order: show the correct sequence, never scold.
      tile.reveal(false);
      audio.wrong();
      particles.burst(tile.pos, 6, 5, WRONG_COLOR);
      this.run.record(ch, false);
      const fb = {
        good: false,
        kind: 'order',
        text: `الترتيب الصحيح يبدأ بـ «${ch.orderedItems[this.expected]}» — جرّب من جديد`,
        skill: ch.skill
      };
      if (this.onFeedback) this.onFeedback(fb);
      return fb;
    }

    // --- single-answer challenges.
    const isRight = String(tile.value) === String(ch.correctValue);
    tile.reveal(isRight);
    tile.collect();

    if (isRight) {
      this.correct++;
      particles.burst(tile.pos, 24, 14, CORRECT_COLOR);
      audio.correct(this.run.streak);
      this.run.record(ch, true);
      const fb = {
        good: true,
        kind: 'correct',
        text: this.run.streak >= 3 ? 'رائع! 🔥' : 'أحسنت! ⭐',
        skill: ch.skill
      };
      if (this.onFeedback) this.onFeedback(fb);
      return fb;
    }

    // Wrong: gentle sound, a small shake, a hint, and another chance.
    audio.wrong();
    particles.burst(tile.pos, 6, 5, WRONG_COLOR);
    this.run.record(ch, false);
    const fb = {
      good: false,
      kind: 'wrong',
      text: ch.explain || ch.hint || 'حاول مرة أخرى',
      skill: ch.skill,
      correct: ch.correctValue
    };
    if (this.onFeedback) this.onFeedback(fb);
    return fb;
  }
}
