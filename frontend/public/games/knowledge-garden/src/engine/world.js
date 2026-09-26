/**
 * Ø§Ù„Ø¹ÙˆØ§Ù„Ù… â€” procedural 3D worlds, geometry only (no external assets).
 *
 * Every world gets its own palette, sky, ground treatment and decor recipe, so
 * the student always knows where they are from one screenshot. The course is
 * generated from the level's beat list: each beat becomes a stretch of ground
 * with its own platforming features.
 */
import * as THREE from '../../vendor/three.module.js';
import { BRAND, WORLD_THEMES, TUNING } from '../config.js';
import { LETTERS, WORDS } from '../data/curriculum.js';
import { textSprite } from './textures.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const lambert = (c, opts) => new THREE.MeshLambertMaterial({ color: c, ...opts });

export class World {
  constructor(scene, level) {
    this.scene = scene;
    this.level = level;
    this.theme = WORLD_THEMES[level.worldId];
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.length = TUNING.sectionLead * 2 + level.beats.length * TUNING.zoneSpacing;
    this.groundSegments = [];   // {x, y, z, hw, hd, top}
    this.obstacles = [];        // {x, y, z, r}
    this.movers = [];           // moving platforms
    this.checkpoints = [];      // {x, y, z}
    this.zoneX = [];            // x position of each beat
    this.stars = [];            // free collectible stars
    this.gaps = [];
    this.boss = null;
  }

  build() {
    this.#sky();
    this.#ground();
    this.#course();
    this.#decor();
    this.#boss();
    this.scene.fog = new THREE.Fog(this.theme.sky, this.theme.fog[0], this.theme.fog[1]);
    return this;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh || o.isSprite) {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose?.();
      }
    });
    this.scene.remove(this.group);
  }

  // ---------------------------------------------------------------- sky/light

  #sky() {
    const t = this.theme;

    // Gradient-free but soft: a big inverted sphere plus cartoon clouds.
    const skyGeo = new THREE.SphereGeometry(1200, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({ color: t.sky, side: THREE.BackSide });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    for (let i = 0; i < 20; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < puffs; j++) {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(rand(5, 11), 12, 10),
          lambert(0xffffff, { transparent: true, opacity: 0.92 })
        );
        m.position.set(j * rand(5, 10), rand(-2, 3), rand(-4, 4));
        m.scale.y = 0.66;
        cloud.add(m);
      }
      cloud.position.set(rand(-150, this.length + 250), rand(55, 110), rand(-220, 220));
      this.scene.add(cloud);
    }

    this.scene.add(new THREE.HemisphereLight(0xffffff, this.theme.ground, 1.05));
    const sun = new THREE.DirectionalLight(0xfff6e0, 1.15);
    sun.position.set(60, 120, 40);
    sun.castShadow = false;   // shadows off by default keeps phones smooth
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xcfe8ff, 0.35);
    rim.position.set(-40, 60, -60);
    this.scene.add(rim);
  }

  // ---------------------------------------------------------------- ground

  /**
   * One long ground slab plus a lighter path down the middle, so the running
   * line is always visually obvious.
   */
  #ground() {
    const t = this.theme;

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(this.length + 200, 4, 90),
      lambert(t.ground)
    );
    ground.position.set(this.length / 2, -2, 0);
    this.group.add(ground);
    this.groundSegments.push({ x: this.length / 2, y: 0, z: 0, hw: (this.length + 200) / 2, hd: 45, top: 0 });

    const path = new THREE.Mesh(
      new THREE.BoxGeometry(this.length + 200, 0.25, 26),
      lambert(t.path)
    );
    path.position.set(this.length / 2, 0.12, 0);
    this.group.add(path);

    // Soft stripes across the path give a sense of speed while running.
    const stripeGeo = new THREE.BoxGeometry(3, 0.3, 26);
    const stripeMat = lambert(t.groundAlt, { transparent: true, opacity: 0.35 });
    for (let x = 0; x < this.length; x += 18) {
      const s = new THREE.Mesh(stripeGeo, stripeMat);
      s.position.set(x, 0.1, 0);
      this.group.add(s);
    }
  }

  // ---------------------------------------------------------------- course

  /**
   * Turn the level's beat list into physical ground.
   * Difficulty is driven by the world index, so the first garden is a smooth
   * ribbon and the Challenge Valley is a gauntlet.
   */
  #course() {
    const t = this.level.worldIndex;
    const spacing = TUNING.zoneSpacing;

    this.level.beats.forEach((beat, i) => {
      const x = TUNING.sectionLead + i * spacing;
      this.zoneX.push(x);

      if (beat.platformOnly) {
        this.#platformSection(x, t);
      } else {
        this.#challengeSection(x, t, beat);
      }
    });

    // A checkpoint before every beat so a fall is never a punishment.
    this.zoneX.forEach((x) => this.checkpoints.push({ x: x - spacing * 0.42, y: 1, z: 0 }));

    // Finish gate at the end of the level.
    this.finishX = TUNING.sectionLead + this.level.beats.length * spacing + 12;
  }

  /** Jumping + star collecting, with a difficulty-appropriate gap count. */
  #platformSection(x, tier) {
    const gaps = tier >= 4 ? 3 : tier >= 2 ? 2 : 1;
    const starCount = 5;

    for (let g = 0; g < gaps; g++) {
      const gx = x + 8 + g * 14;
      // The gap itself is a hole; we add a raised platform after it.
      this.gaps.push({ x: gx, w: 6 });
      const plat = this.#platform(gx + 8, 1.6 + g * 0.4, rand(-6, 6), 5, 5);

      // A star rewards the jump.
      const star = this.#star(gx + 3.5, 4.2 + g * 0.4, 0);
      this.stars.push(star);
      void plat;
    }

    // A ring of stars to gather on solid ground, rewarding steering.
    for (let s = 0; s < starCount; s++) {
      this.stars.push(this.#star(x + 20 + s * 7, 3.2, ((s % 3) - 1) * 9));
    }
  }

  /**
   * An educational beat: mostly open ground so the learner can read the
   * floating tiles, with obstacles placed to the sides rather than blocking
   * the answer. A child is never forced into a fail state to learn a letter.
   */
  #challengeSection(x, tier, beat) {
    // One forgiving obstacle per section, off to one side.
    if (tier >= 1) {
      const side = Math.random() > 0.5 ? 1 : -1;
      this.obstacles.push({ x: x + 20, y: 1.4, z: side * 13, r: 1.7 });
      this.#obstacleMesh(x + 20, 1.4, side * 13);
    }

    // A small floating platform with a star to reward a well-timed jump.
    if (tier >= 2 || beat.timed) {
      this.#platform(x + 26, 2.2, 0, 5, 5);
      this.stars.push(this.#star(x + 26, 5.4, 0));
    }
  }

  #platform(x, top, z, hw, hd) {
    const t = this.theme;
    const height = top;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(hw * 2, height, hd * 2),
      lambert(t.groundAlt)
    );
    mesh.position.set(x, height / 2, z);
    this.group.add(mesh);
    // A lighter cap makes the landing surface obvious.
    const cap = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.3, 0.3, hd * 2 + 0.3), lambert(t.path));
    cap.position.set(x, height + 0.1, z);
    this.group.add(cap);

    this.groundSegments.push({ x, y: height, z, hw, hd, top: height });
    return { x, top, z, hw, hd };
  }

  /** A platform that slides sideways â€” used from the castle onwards. */
  #movingPlatform(x, y, z) {
    const t = this.theme;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(7, 0.8, 5), lambert(t.accent));
    mesh.position.set(x, y, z);
    this.group.add(mesh);

    const mover = {
      mesh, base: z, y, x, hw: 3.5, hd: 2.5, top: y,
      amp: 9, speed: 1.1 + Math.random() * 0.6, t: Math.random() * 6
    };
    this.movers.push(mover);
    this.groundSegments.push({ x, y, z, hw: 3.5, hd: 2.5, top: y, mover });
    return mover;
  }

  #obstacleMesh(x, y, z) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.6, 0),
      lambert(this.theme.groundAlt)
    );
    rock.position.set(x, y, z);
    rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    this.group.add(rock);
  }

  /** A rotating collectible star. */
  #star(x, y, z) {
    const geo = new THREE.OctahedronGeometry(1.15, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: BRAND.goldLight, emissive: BRAND.gold, emissiveIntensity: 0.55, metalness: 0.25, roughness: 0.35
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    return { mesh, pos: mesh.position.clone(), dead: false, kind: 'star', t: Math.random() * 6 };
  }

  // ---------------------------------------------------------------- decor

  /**
   * Each world gets its own signature scenery, placed off the running line so
   * it never blocks play but always fills the frame.
   */
  #decor() {
    const recipe = this.theme.decor;
    for (let x = 10; x < this.length; x += rand(14, 26)) {
      const kind = recipe[Math.floor(Math.random() * recipe.length)];
      const side = Math.random() > 0.5 ? 1 : -1;
      const z = side * rand(20, 40);
      const method = DECOR_BUILDERS[kind] || 'tree';
      this[method](x, z);
    }
  }

  tree(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1, 5, 8), lambert(0x8b5a2b));
    trunk.position.y = 2.5;
    g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(rand(2.4, 3.4), 12, 10), lambert(0x4caf50));
      leaf.position.set(rand(-1, 1), 5.5 + i * 1.1, rand(-1, 1));
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    this.group.add(g);
  }

  flower(x, z) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2, 6), lambert(0x2e7d32));
    stem.position.y = 1;
    g.add(stem);
    const colors = [0xff6f91, 0xffd166, 0x8e6bd6, 0xffffff];
    for (let i = 0; i < 5; i++) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), lambert(pick(colors)));
      const a = (i / 5) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.5, 2.1, Math.sin(a) * 0.5);
      g.add(petal);
    }
    g.position.set(x, 0, z);
    this.group.add(g);
  }

  /** A giant floating letter â€” the signature of the Letter Garden. */
  giantLetter(x, z) {
    const letter = pick(LETTERS);
    // Translucent and floating: a garden ornament, not a white billboard.
    const sprite = textSprite(letter.letter, letter.color, 0xffffff, 210, 20);
    sprite.material.opacity = 0.5;
    sprite.material.transparent = true;
    sprite.scale.set(4.6, 4.6, 1);
    sprite.position.set(x, rand(9, 14), z);
    this.group.add(sprite);
  }

  butterfly(x, z) {
    const g = new THREE.Group();
    const colors = [0xff6f91, 0xffd166, 0x8e6bd6];
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(
        new THREE.CircleGeometry(0.9, 12),
        lambert(pick(colors), { side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
      );
      wing.position.set(side * 0.7, 0, 0);
      g.add(wing);
    }
    g.position.set(x, rand(4, 9), z);
    g.userData.fly = { baseY: g.position.y, t: Math.random() * 6 };
    this.group.add(g);
    (this.butterflies ||= []).push(g);
  }

  /** A giant book standing like a tree â€” the Word Forest signature. */
  bigBook(x, z) {
    const g = new THREE.Group();
    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(5, 7, 1.6),
      lambert(pick([0x8e6bd6, 0x155eef, 0x10b981, 0xe8544f]))
    );
    g.add(cover);
    const pages = new THREE.Mesh(new THREE.BoxGeometry(4.4, 6.4, 1.8), lambert(0xfdfaf2));
    pages.position.x = 0.35;
    g.add(pages);
    g.rotation.y = rand(-0.4, 0.4);
    g.position.set(x, 3.5, z);
    this.group.add(g);
  }

  wordSign(x, z) {
    const word = pick(WORDS);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5, 6), lambert(0x8b5a2b));
    post.position.set(x, 2.5, z);
    this.group.add(post);
    const sign = textSprite(word.text, 0xffffff, 0x8e6bd6, 200);
    sign.scale.set(6, 2.6, 1);
    sign.position.set(x, 6, z);
    this.group.add(sign);
  }

  magicTree(x, z) {
    this.tree(x, z);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.65 })
    );
    glow.position.set(x, 8, z);
    this.group.add(glow);
    (this.sparkles ||= []).push(glow);
  }

  mushroom(x, z) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 3, 8), lambert(0xf5f0e6));
    stem.position.y = 1.5;
    g.add(stem);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      lambert(pick([0xe8544f, 0x8e6bd6, 0x10b981]))
    );
    cap.position.y = 3;
    g.add(cap);
    g.position.set(x, 0, z);
    g.scale.setScalar(rand(0.8, 1.5));
    this.group.add(g);
  }

  /** A house shaped like a closed book â€” the Sentence Village signature. */
  bookHouse(x, z) {
    const g = new THREE.Group();
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(7, 6, 6),
      lambert(pick([0xf5e6c8, 0xe8d5b0, 0xdcc7a0]))
    );
    walls.position.y = 3;
    g.add(walls);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(1.4, 6.4, 6.4), lambert(0x8e6bd6));
    spine.position.set(-3.2, 3, 0);
    g.add(spine);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.4, 3.4, 4), lambert(0xe8544f));
    roof.position.y = 7.4;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    g.position.set(x, 0, z);
    g.rotation.y = rand(-0.3, 0.3);
    this.group.add(g);
  }

  /** Roads made of letters, set into the ground like tiles. */
  letterRoad(x, z) {
    for (let i = 0; i < 5; i++) {
      const letter = pick(LETTERS);
      const tile = textSprite(letter.letter, 0xffffff, 0xe8544f, 180);
      tile.scale.set(3, 3, 1);
      tile.position.set(x + i * 5, 0.8, z);
      this.group.add(tile);
    }
  }

  lamp(x, z) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 7, 6), lambert(0x546e7a));
    post.position.set(x, 3.5, z);
    this.group.add(post);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffe082 }));
    bulb.position.set(x, 7.2, z);
    this.group.add(bulb);
  }

  fence(x, z) {
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4, 0.4), lambert(0x8b5a2b));
      p.position.set(x + i * 3, 1.2, z);
      this.group.add(p);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(13, 0.3, 0.3), lambert(0x8b5a2b));
    rail.position.set(x + 6, 1.9, z);
    this.group.add(rail);
  }

  /** A castle tower with battlements â€” the Knowledge Castle signature. */
  tower(x, z) {
    const g = new THREE.Group();
    const h = rand(14, 22);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.6, h, 10), lambert(0xb0b8c8));
    shaft.position.y = h / 2;
    g.add(shaft);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 1.1), lambert(0x9aa4b8));
      merlon.position.set(Math.cos(a) * 3.1, h + 0.6, Math.sin(a) * 3.1);
      g.add(merlon);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4, 5, 10), lambert(0x155eef));
    roof.position.y = h + 3.5;
    g.add(roof);
    g.position.set(x, 0, z);
    this.group.add(g);
  }

  /** A stack of giant books forming a library. */
  library(x, z) {
    const g = new THREE.Group();
    const colors = [0x8e6bd6, 0x155eef, 0x10b981, 0xe8544f, 0xe8a317];
    let y = 0;
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(rand(5, 8), 1.5, 4.5), lambert(pick(colors)));
      b.position.set(rand(-0.6, 0.6), y + 0.75, 0);
      b.rotation.y = rand(-0.2, 0.2);
      g.add(b);
      y += 1.6;
    }
    g.position.set(x, 0, z);
    this.group.add(g);
  }

  /** A giant puzzle piece on a plinth. */
  puzzle(x, z) {
    const g = new THREE.Group();
    const piece = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 1.2, 20), lambert(this.theme.accent));
    g.add(piece);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), lambert(this.theme.accent));
    knob.position.set(0, 0.7, 2.2);
    g.add(knob);
    g.position.set(x, 1.2, z);
    g.rotation.y = rand(0, 3);
    this.group.add(g);
  }

  /** A stone bridge arch spanning the path. */
  bridge(x, z) {
    for (const side of [-1, 1]) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(6, 0.9, 8, 20, Math.PI), lambert(0xc9d0dd));
      arch.position.set(x, 0, z + side * 12);
      this.group.add(arch);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(7, 1, 26), lambert(0xd3d9e6));
    deck.position.set(x, 6.5, z);
    this.group.add(deck);
  }

  /** A jagged rock formation â€” the Challenge Valley signature. */
  rock(x, z) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const height = rand(6, 14);
      const r = new THREE.Mesh(
        new THREE.ConeGeometry(rand(2, 4.5), height, Math.floor(rand(5, 9))),
        lambert(pick([0x7a6a86, 0x5f5269, 0x8d7f9c]))
      );
      r.position.set(rand(-3, 3), height / 2, rand(-3, 3));
      r.rotation.y = rand(0, 3);
      g.add(r);
    }
    g.position.set(x, 0, z);
    this.group.add(g);
  }

  /** A waterfall with a translucent falling sheet. */
  waterfall(x, z) {
    const cliff = new THREE.Mesh(new THREE.BoxGeometry(16, 28, 5), lambert(0x5f5269));
    cliff.position.set(x, 14, z - 4);
    this.group.add(cliff);
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 26),
      new THREE.MeshBasicMaterial({ color: 0x7ec8e3, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
    );
    sheet.position.set(x, 13, z);
    this.group.add(sheet);
    (this.waterfalls ||= []).push(sheet);
  }

  /** Glowing lava pools that light the valley floor. */
  lavaGlow(x, z) {
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(rand(3, 6), 16),
      new THREE.MeshBasicMaterial({ color: 0xff7043, transparent: true, opacity: 0.75 })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.3, z);
    this.group.add(pool);
    (this.lavaPools ||= []).push(pool);
  }

  /** A modern tower â€” the Knowledge City signature. */
  skyscraper(x, z) {
    const h = rand(18, 40);
    const g = new THREE.Group();
    const w = rand(5, 9);
    const d = rand(5, 9);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(0xdfe7f2));
    body.position.y = h / 2;
    g.add(body);
    // Window bands make the towers read as a living skyline.
    for (let y = 3; y < h - 2; y += 4) {
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.3, 1.4, d + 0.3),
        new THREE.MeshBasicMaterial({ color: pick([0x00bcd4, 0x155eef, 0x7ee8fa]) })
      );
      band.position.y = y;
      g.add(band);
    }
    g.position.set(x, 0, z);
    this.group.add(g);
  }

  /** A glowing sign with a word on it. */
  neonSign(x, z) {
    const word = pick(WORDS);
    const sign = textSprite(word.text, 0x0b2545, this.theme.accent, 200, 2.5);
    sign.scale.set(7, 3, 1);
    sign.position.set(x, rand(6, 12), z);
    this.group.add(sign);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 8, 6), lambert(0x546e7a));
    pole.position.set(x, 4, z);
    this.group.add(pole);
  }

  /** A holographic board with a letter floating in front of it. */
  holoBoard(x, z) {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(8, 5, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x00bcd4, transparent: true, opacity: 0.32 })
    );
    board.position.set(x, 7, z);
    this.group.add(board);
    const letter = pick(LETTERS);
    const glyph = textSprite(letter.letter, 0xffffff, 0x00bcd4, 200);
    glyph.scale.set(4, 4, 1);
    glyph.position.set(x, 7, z + 0.4);
    this.group.add(glyph);
  }

  fountain(x, z) {
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.4, 1.4, 20), lambert(0xc9d4e3));
    basin.position.set(x, 0.7, z);
    this.group.add(basin);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(5.4, 20),
      new THREE.MeshBasicMaterial({ color: 0x7ec8e3, transparent: true, opacity: 0.7 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, 1.45, z);
    this.group.add(water);
    const jet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 1, 6, 8),
      new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.6 })
    );
    jet.position.set(x, 4, z);
    this.group.add(jet);
  }

  /** A palm tree â€” the Champions Island signature. */
  palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 11, 8), lambert(0xa1662f));
    trunk.position.y = 5.5;
    g.add(trunk);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 8), lambert(0x2e9e5b));
      frond.scale.set(1.6, 0.22, 0.7);
      frond.position.set(Math.cos(a) * 3.2, 11, Math.sin(a) * 3.2);
      frond.rotation.y = -a;
      g.add(frond);
    }
    g.position.set(x, 0, z);
    this.group.add(g);
  }

  /** A statue of the owl mascot. */
  statue(x, z) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 4), lambert(0xd8c48a));
    base.position.y = 1;
    g.add(base);
    const bird = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 14), lambert(0x1e3a6e));
    bird.position.y = 4.4;
    bird.scale.set(1, 1.2, 0.9);
    g.add(bird);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), lambert(0x1e3a6e));
    head.position.y = 6.8;
    g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 3.4), lambert(0x101a33));
    cap.position.y = 7.9;
    g.add(cap);
    g.position.set(x, 0, z);
    this.group.add(g);
  }

  /** A giant golden trophy. */
  trophy(x, z) {
    const gold = new THREE.MeshStandardMaterial({ color: 0xffd166, metalness: 0.7, roughness: 0.3 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(3, 1.8, 4, 16, 1, true), gold);
    cup.material.side = THREE.DoubleSide;
    cup.position.y = 8;
    this.group.add(cup);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 4, 10), gold);
    stem.position.set(x, 4, z);
    this.group.add(stem);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.8, 1.2, 12),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, metalness: 0.4, roughness: 0.6 })
    );
    base.position.set(x, 0.6, z);
    this.group.add(base);
    cup.position.set(x, 8, z);
  }

  /** A floating crystal â€” pure decoration, purely pretty. */
  crystal(x, z) {
    const color = pick([0xff6f91, 0x8e6bd6, 0x00bcd4]);
    const c = new THREE.Mesh(
      new THREE.OctahedronGeometry(rand(1.6, 3), 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 })
    );
    c.position.set(x, rand(4, 8), z);
    c.userData.spin = { t: Math.random() * 6, y: c.position.y };
    this.group.add(c);
    (this.crystals ||= []).push(c);
  }

  // ---------------------------------------------------------------- boss

  /**
   * The world boss, waiting at the end of every fifth level.
   * It is a friendly-looking obstacle rather than a threat: each correct answer
   * makes it shrink and change colour, so defeating it is visibly the result
   * of the child's own knowledge.
   */
  #boss() {
    if (!this.level.isBoss) return;

    const info = this.level.boss;
    const g = new THREE.Group();

    const colors = [0x8e6bd6, 0xe8544f, 0x00bcd4, 0xff7043, 0x4caf50];
    // A rounded body with two eyes â€” readable as a creature at a glance.
    const body = new THREE.Mesh(new THREE.SphereGeometry(5, 22, 18), lambert(colors[0]));
    body.position.y = 7;
    g.add(body);
    this.bossBody = body;

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 12), lambert(0xffffff));
      eye.position.set(side * 1.8, 8, 3.9);
      g.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), lambert(0x12233f));
      pupil.position.set(side * 1.8, 8, 5.1);
      g.add(pupil);
    }

    // Spiky crown so it reads as a "word monster" from the story.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI - Math.PI / 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.4, 6), lambert(colors[1]));
      spike.position.set(Math.cos(a) * 4.2, 12, Math.sin(a) * 2);
      g.add(spike);
    }

    // A floating name plate so the child knows what they are facing.
    const plate = textSprite(`${info.icon} ${info.name}`, 0xffffff, 0x12233f, 190, 3);
    plate.scale.set(14, 4, 1);
    plate.position.set(0, 18, 0);
    g.add(plate);

    g.position.set(this.finishX + 14, 0, 0);
    this.group.add(g);
    this.boss = {
      group: g,
      name: info.name,
      icon: info.icon,
      maxHits: 10,
      hits: 0,
      defeated: false,
      x: this.finishX + 14
    };
  }

  /** Called by the game when a boss challenge is answered. */
  hitBoss(good) {
    if (!this.boss || this.boss.defeated) return;
    this.boss.hits = good ? this.boss.hits + 1 : this.boss.hits;
    const ratio = Math.min(1, this.boss.hits / this.boss.maxHits);
    const scale = 1.3 - ratio * 0.75;
    this.bossBody.scale.setScalar(scale);
    // Green-shifting colour as it weakens.
    this.bossBody.material.color.setHex(ratio > 0.6 ? 0x4caf50 : ratio > 0.3 ? 0xffa000 : 0xe8544f);
    if (this.boss.hits >= this.boss.maxHits) {
      this.boss.defeated = true;
      this.boss.group.visible = false;
    }
  }

  // ---------------------------------------------------------------- update

  update(dt) {
    // Moving platforms slide along Z and carry their collider with them.
    for (const m of this.movers) {
      m.t += dt * m.speed;
      m.mesh.position.z = m.base + Math.sin(m.t) * m.amp;
      const seg = this.groundSegments.find((s) => s.mover === m);
      if (seg) seg.z = m.mesh.position.z;
    }

    // Stars spin and bob.
    for (const s of this.stars) {
      if (s.dead) continue;
      s.t += dt;
      s.mesh.rotation.y += dt * 2.4;
      s.mesh.position.y = s.pos.y + Math.sin(s.t * 2) * 0.5;
    }

    // Ambient life: butterflies drift, crystals spin, lava pulses.
    for (const b of this.butterflies || []) {
      b.userData.fly.t += dt;
      b.position.y = b.userData.fly.baseY + Math.sin(b.userData.fly.t) * 1.2;
      b.rotation.y += dt * 1.4;
    }
    for (const c of this.crystals || []) {
      c.userData.spin.t += dt;
      c.rotation.y = c.userData.spin.t;
      c.position.y = c.userData.spin.y + Math.sin(c.userData.spin.t * 0.8) * 0.7;
    }
    for (const p of this.lavaPools || []) {
      p.material.opacity = 0.6 + Math.sin(Date.now() / 400) * 0.15;
    }
    for (const w of this.waterfalls || []) {
      w.position.y = 13 - ((Date.now() / 12) % 3);
    }
    for (const s of this.sparkles || []) {
      s.scale.setScalar(1 + Math.sin(Date.now() / 300) * 0.2);
    }

    if (this.boss && !this.boss.defeated) {
      this.boss.group.position.y = Math.sin(Date.now() / 600) * 1.2;
      this.boss.group.rotation.y = Math.sin(Date.now() / 900) * 0.25;
    }
  }
}

/**
 * Decor recipe â†’ private method name.
 * Keeps `#decor` readable and means a new world only needs a builder here.
 */
const DECOR_BUILDERS = {
  flower: 'flower',
  tree: 'tree',
  giantLetter: 'giantLetter',
  butterfly: 'butterfly',
  bigBook: 'bigBook',
  wordSign: 'wordSign',
  magicTree: 'magicTree',
  mushroom: 'mushroom',
  bookHouse: 'bookHouse',
  letterRoad: 'letterRoad',
  lamp: 'lamp',
  fence: 'fence',
  tower: 'tower',
  library: 'library',
  puzzle: 'puzzle',
  bridge: 'bridge',
  rock: 'rock',
  waterfall: 'waterfall',
  movingPlatform: 'tree',
  lavaGlow: 'lavaGlow',
  skyscraper: 'skyscraper',
  neonSign: 'neonSign',
  holoBoard: 'holoBoard',
  fountain: 'fountain',
  palm: 'palm',
  statue: 'statue',
  trophy: 'trophy',
  crystal: 'crystal'
};
