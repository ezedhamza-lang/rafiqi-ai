/**
 * البومة "رفيقي" — the player's character, built entirely from geometry.
 *
 * The mascot is the original Rafiqi owl: a cute blue owl with large friendly
 * eyes, round glasses, a dark blue graduation cap and a yellow tassel.
 * Cosmetics (cap, glasses, backpack, book, trail) are unlocked through
 * learning achievements and applied here.
 */
import * as THREE from '../../vendor/three.module.js';
import { BRAND, TUNING } from '../config.js';
import { audio } from './audio.js';

const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });

export class Owl {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.radius = 1.5;
    this.trailColor = null;
    this.scene.add(this.group);
    this.pos = new THREE.Vector3(0, 3, 0);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.reset();
    this.build();
    this.applyAppearance({});
  }

  reset() {
    this.pos.set(0, 3, 0);
    this.vel.set(0, 0, 0);
    this.speed = TUNING.runSpeed;
    this.onGround = false;
    this.coyote = 0;
    this.jumps = 0;
    this.dashT = 0;
    this.dashCd = 0;
    this.steer = 0;
    this.runPhase = 0;
    this.tilt = 0;
    this.invuln = 0;
  }

  /** Build the body, wings, face, glasses and cap. */
  build() {
    const g = this.group;

    // --- body: wide and low so the head reads as a separate shape above it
    this.body = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 16), lambert(BRAND.owlBody));
    this.body.position.y = 1.25;
    this.body.scale.set(1.15, 0.95, 1);
    g.add(this.body);

    // --- belly
    const belly = new THREE.Mesh(new THREE.SphereGeometry(1.05, 18, 14), lambert(BRAND.owlBelly));
    belly.position.set(0, 1.05, 0.6);
    belly.scale.set(0.85, 1, 0.45);
    g.add(belly);

    // --- tail feathers fanning out behind, a classic owl cue
    for (let i = -1; i <= 1; i++) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, 0.2), lambert(BRAND.owlDark));
      tail.position.set(i * 0.35, 1.1, -1.5);
      tail.rotation.x = -0.5;
      tail.rotation.z = i * 0.25;
      g.add(tail);
    }

    // --- wings: broad and angled outward so the silhouette reads as a bird
    // even from directly behind (which is the default camera angle).
    this.wings = [];
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 10), lambert(BRAND.owlDark));
      wing.position.set(side * 1.6, 1.45, -0.15);
      wing.scale.set(0.45, 1.5, 1.05);
      wing.rotation.z = side * 0.28;      // flared away from the body
      wing.rotation.x = -0.12;
      wing.geometry.translate(0, -0.45, 0);
      g.add(wing);
      this.wings.push(wing);
    }

    // --- feet
    this.feet = [];
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.8), lambert(BRAND.owlBeak));
      foot.position.set(side * 0.5, 0.12, 0.18);
      g.add(foot);
      this.feet.push(foot);
    }

    // --- head: clearly separated above the body
    this.head = new THREE.Group();
    this.head.position.y = 2.75;
    g.add(this.head);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 16), lambert(BRAND.owlBody));
    skull.scale.set(1.18, 1.02, 0.95);
    this.head.add(skull);

    // Large friendly eyes — white sclera, dark pupil, plus a highlight glint
    // that is what makes the mascot read as warm rather than blank.
    this.eyes = [];
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 14), lambert(0xffffff));
      eye.position.set(side * 0.5, 0.18, 0.88);
      eye.scale.set(1, 1, 0.6);
      this.head.add(eye);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), lambert(0x12233f));
      pupil.position.set(side * 0.5, 0.18, 1.08);
      this.head.add(pupil);

      const glint = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      glint.position.set(side * 0.5 + 0.09, 0.3, 1.16);
      this.head.add(glint);

      this.eyes.push({ eye, pupil });
    }

    // --- beak
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 4), lambert(BRAND.owlBeak));
    beak.position.set(0, -0.16, 1.06);
    beak.rotation.x = Math.PI / 2;
    this.head.add(beak);
    this.beak = beak;

    // --- ear tufts (the classic owl silhouette)
    for (const side of [-1, 1]) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 6), lambert(BRAND.owlDark));
      tuft.position.set(side * 0.72, 1.02, -0.05);
      tuft.rotation.z = side * -0.35;
      this.head.add(tuft);
    }

    this.#buildGlasses();
    this.#buildCap();
    this.#buildCosmetics();
  }

  /** Round glasses — one ring per eye plus a bridge. */
  #buildGlasses() {
    this.glasses = new THREE.Group();
    this.glasses.position.set(0, 0.18, 1.0);
    this.head.add(this.glasses);

    const frame = new THREE.MeshBasicMaterial({ color: 0x334155 });
    for (const side of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.07, 8, 26), frame);
      ring.position.set(side * 0.5, 0, 0);
      this.glasses.add(ring);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.07), frame);
    this.glasses.add(bridge);

    // The "visor" cosmetic swaps the rings for a tinted band.
    this.visor = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.5, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x00bcd4, transparent: true, opacity: 0.55 })
    );
    this.visor.position.set(0, 0, 0.05);
    this.visor.visible = false;
    this.glasses.add(this.visor);
  }

  /** Dark blue graduation cap with a yellow tassel. */
  #buildCap() {
    this.cap = new THREE.Group();
    this.cap.position.y = 0.98;
    this.head.add(this.cap);

    this.capBoard = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.16, 2.5), lambert(BRAND.cap));
    this.capBoard.rotation.x = 0.06;
    this.capBoard.position.y = 0.22;
    this.cap.add(this.capBoard);

    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      lambert(BRAND.cap)
    );
    crown.position.y = 0.1;
    crown.scale.set(1.05, 0.7, 1.05);
    this.cap.add(crown);

    // Yellow tassel hanging from the board's edge.
    this.tassel = new THREE.Group();
    this.tassel.position.set(1.1, 0.2, 0.5);
    this.cap.add(this.tassel);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), lambert(BRAND.tassel));
    cord.position.y = -0.45;
    this.tassel.add(cord);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), lambert(BRAND.tassel));
    knot.position.y = -0.95;
    this.tassel.add(knot);
  }

  /** Backpack and the held book, both hidden until unlocked. */
  #buildCosmetics() {
    this.backpack = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.4, 0.6), lambert(0x8e6bd6));
    this.backpack.position.set(0, 1.6, -1.15);
    this.backpack.visible = false;
    this.group.add(this.backpack);

    this.book = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.22), lambert(BRAND.primary));
    this.book.position.set(0.95, 1.9, 0.5);
    this.book.rotation.z = -0.35;
    this.book.visible = false;
    this.group.add(this.book);
  }

  /**
   * Apply an outfit. Keys match COSMETIC_DEFAULTS in config.js.
   * Unrecognised ids fall back to the mascot's original Rafiqi look.
   */
  applyAppearance(appearance = {}) {
    this.appearance = { ...appearance };

    // Caps
    const capId = appearance.cap || 'graduation';
    const capColors = { graduation: BRAND.cap, turban: 0xf7f7f7, star: 0x2b2b6b };
    const capColor = capColors[capId] ?? BRAND.cap;
    this.cap.traverse((o) => { if (o.isMesh && o !== this.tassel) o.material = lambert(capColor); });
    // A turban reads as a taller, rounder crown than a mortarboard.
    this.capBoard.scale.set(1, capId === 'turban' ? 2.2 : 1, 1);
    this.tassel.visible = capId === 'graduation' || capId === 'star';

    // Glasses: the visor hides the round rings behind a tinted band.
    const glassesId = appearance.glasses || 'round';
    this.visor.visible = glassesId === 'visor';
    this.glasses.children[0].visible = glassesId !== 'visor';
    this.glasses.children[1].visible = glassesId !== 'visor';
    this.glasses.children[2].visible = glassesId !== 'visor';

    // Backpack & book
    this.backpack.visible = (appearance.backpack || 'none') === 'books';
    this.book.visible = (appearance.book || 'none') === 'encyclopedia';

    this.trailColor = appearance.trail && appearance.trail !== 'none'
      ? ({ stars: 0xffd166, rainbow: 0xff6f91 }[appearance.trail] ?? null)
      : null;
    this.jumpFx = appearance.jump || 'puff';
  }

  /**
   * Physics + animation.
   * `steer` is -1..1; the owl always runs forward along +X.
   */
  update(dt, { steer = 0, jump = false, dash = false, speedScale = 1 } = {}) {
    const targetSpeed = TUNING.runSpeed * speedScale;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 1.2);

    const boosting = this.dashT > 0;
    if (boosting) this.dashT -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;

    this.vel.x = boosting ? TUNING.dashSpeed : this.speed;
    this.pos.x += this.vel.x * dt;

    // Steering across the Z axis, clamped to the playfield.
    this.steer += (steer - this.steer) * Math.min(1, TUNING.steerAccel * dt);
    this.pos.z += this.steer * TUNING.steerMax * (boosting ? 1.5 : 1) * dt;
    this.pos.z = Math.max(-26, Math.min(26, this.pos.z));

    // Gravity + jumping, with coyote time and a forgiving double jump so a
    // child can never get stuck behind a platform.
    if (this.onGround) this.coyote = TUNING.coyoteTime;
    else if (this.coyote > 0) this.coyote -= dt;

    if (jump) {
      if (this.onGround || this.coyote > 0) {
        this.vel.y = TUNING.jumpVel;
        this.onGround = false;
        this.coyote = 0;
        this.jumps = 1;
        audio.jump();
      } else if (this.jumps < 2) {
        this.vel.y = TUNING.doubleJumpVel;
        this.jumps = 2;
        audio.jump();
      }
    }

    if (dash && this.dashCd <= 0) {
      this.dashT = TUNING.dashTime;
      this.dashCd = TUNING.dashCooldown;
      audio.dash();
    }

    this.vel.y -= TUNING.gravity * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 0) {
      if (!this.onGround && this.vel.y < -12) audio.land();
      this.pos.y = 0;
      this.vel.y = 0;
      this.onGround = true;
      this.jumps = 0;
    } else if (this.pos.y > 0.1) {
      this.onGround = false;
    }

    if (this.invuln > 0) this.invuln -= dt;

    this.#animate(dt, boosting);
    this.group.position.copy(this.pos);
    return { dashing: boosting, onGround: this.onGround };
  }

  /** Wing flap, body bob, tassel sway and an occasional blink. */
  #animate(dt, dashing) {
    this.runPhase += dt * (dashing ? 22 : 13);

    const flap = Math.sin(this.runPhase) * 0.55;
    this.wings[0].rotation.x = flap - 0.2;
    this.wings[1].rotation.x = -flap + 0.2;

    this.body.position.y = 1.5 + Math.abs(Math.sin(this.runPhase)) * 0.1;
    this.tilt += (this.steer * 0.32 - this.tilt) * Math.min(1, dt * 6);
    this.group.rotation.z = this.tilt;
    this.group.rotation.y = this.steer * 0.22;

    if (this.onGround) {
      this.feet[0].position.z = 0.18 + Math.sin(this.runPhase) * 0.3;
      this.feet[1].position.z = 0.18 - Math.sin(this.runPhase) * 0.3;
    }

    this.tassel.rotation.z = Math.sin(this.runPhase * 0.8) * 0.3 + this.steer * 0.2;
    this.tassel.rotation.x = Math.cos(this.runPhase * 0.6) * 0.2;

    this.blink = (this.blink ?? 0) - dt;
    if (this.blink < -3 - Math.random() * 3) this.blink = 0.14;
    const lid = this.blink > 0 ? 0.12 : 1;
    this.eyes.forEach(({ eye }) => { eye.scale.y = lid; });

    this.book.position.y = 1.9 + Math.abs(Math.sin(this.runPhase)) * 0.14;
  }

  /** Put the owl back on the track after falling into a gap. */
  respawn(x) {
    this.pos.set(x, 7, 0);
    this.vel.set(0, 0, 0);
    this.invuln = 1.2;
  }
}
