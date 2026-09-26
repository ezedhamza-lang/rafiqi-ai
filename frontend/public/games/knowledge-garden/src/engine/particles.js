/**
 * الجسيمات — a small pooled particle system.
 *
 * Used for correct answers (green/gold burst), wrong answers (soft grey puff),
 * stars, gems and confetti on the results screen. Pooling keeps allocation
 * out of the frame loop, which matters on phones.
 */
import * as THREE from '../../vendor/three.module.js';

const MAX = 400;

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    for (let i = 0; i < MAX; i++) this.pool.push(this.#make());
  }

  #make() {
    const geo = new THREE.SphereGeometry(0.42, 6, 5);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    this.scene.add(mesh);
    return { mesh, life: 0, maxLife: 1, vel: new THREE.Vector3(), spin: 0 };
  }

  #take() {
    const p = this.pool.pop();
    if (!p) return null;
    this.active.push(p);
    return p;
  }

  /** A radial burst of `count` particles. */
  burst(pos, count = 20, color = 0x2ecc71, speed = 9, spread = 1) {
    for (let i = 0; i < count; i++) {
      const p = this.#take();
      if (!p) return;
      p.mesh.visible = true;
      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(0.6 + Math.random() * 0.8);
      const a = Math.random() * Math.PI * 2;
      const el = (Math.random() - 0.3) * spread;
      p.vel.set(Math.cos(a) * speed * (0.5 + Math.random() * 0.5), el * speed, Math.sin(a) * speed * (0.5 + Math.random() * 0.5));
      p.life = p.maxLife = 0.6 + Math.random() * 0.5;
      p.spin = (Math.random() - 0.5) * 8;
    }
  }

  /** A slow fountain used for confetti and level completion. */
  confetti(pos, colors = [0xe8a317, 0x10b981, 0x155eef, 0xff6f91, 0x8e6bd6]) {
    for (let i = 0; i < 60; i++) {
      const p = this.#take();
      if (!p) return;
      p.mesh.visible = true;
      p.mesh.position.set(
        pos.x + (Math.random() - 0.5) * 6,
        pos.y + Math.random() * 3,
        pos.z + (Math.random() - 0.5) * 6
      );
      p.mesh.material.color.setHex(colors[i % colors.length]);
      p.mesh.material.opacity = 1;
      p.mesh.scale.set(0.5, 1.3, 0.28);
      p.vel.set((Math.random() - 0.5) * 4, 7 + Math.random() * 6, (Math.random() - 0.5) * 4);
      p.life = p.maxLife = 1.2 + Math.random() * 0.8;
      p.spin = (Math.random() - 0.5) * 10;
    }
  }

  /** A soft trail of dust behind a dashing owl. */
  trail(pos, color = 0xffffff) {
    const p = this.#take();
    if (!p) return;
    p.mesh.visible = true;
    p.mesh.position.copy(pos);
    p.mesh.material.color.setHex(color);
    p.mesh.material.opacity = 0.55;
    p.mesh.scale.setScalar(0.5);
    p.vel.set(-2, 1.4, 0);
    p.life = p.maxLife = 0.42;
    p.spin = 0;
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.active.splice(i, 1);
        this.pool.push(p);
        continue;
      }
      p.vel.y -= 22 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
    }
  }

  clear() {
    for (const p of this.active) { p.mesh.visible = false; this.pool.push(p); }
    this.active.length = 0;
  }
}
