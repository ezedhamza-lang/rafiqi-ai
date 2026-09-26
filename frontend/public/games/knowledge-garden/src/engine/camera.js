/**
 * الكاميرا — a smoothed chase camera that keeps the owl framed.
 *
 * It lags behind the player so the world feels alive, leads slightly in the
 * direction of travel, and adds a small shake on wrong answers (gentle enough
 * to be reassuring rather than punishing).
 */
import * as THREE from '../../vendor/three.module.js';
import { TUNING } from '../config.js';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(-10, 8, 18);
    this.look = new THREE.Vector3(0, 3, 0);
    this.shakeAmount = 0;
    this._tmp = new THREE.Vector3();
  }

  addShake(amount = 0.4) {
    this.shakeAmount = Math.min(1.2, this.shakeAmount + amount);
  }

  update(dt, target, steer = 0, speedRatio = 0) {
    const desiredX = target.x - TUNING.camDist;
    const desiredY = target.y + TUNING.camHeight;
    const desiredZ = target.z + steer * 6;

    this.pos.x += (desiredX - this.pos.x) * Math.min(1, TUNING.camLag * dt);
    this.pos.y += (desiredY - this.pos.y) * Math.min(1, TUNING.camLag * dt);
    this.pos.z += (desiredZ - this.pos.z) * Math.min(1, TUNING.camLag * dt);

    // Look slightly ahead so the player sees what is coming.
    this._tmp.set(target.x + TUNING.camLookAhead + speedRatio * 3, target.y + 2.4, target.z);
    this.look.lerp(this._tmp, Math.min(1, TUNING.camLag * dt));

    this.camera.position.copy(this.pos);
    if (this.shakeAmount > 0) {
      // Small, decaying, and never enough to disorient.
      const s = this.shakeAmount * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.shakeAmount = Math.max(0, this.shakeAmount - dt * 2.4);
    }
    this.camera.lookAt(this.look);
  }

  /** Snap instantly — used on level start so the camera never flies in. */
  snap(target) {
    this.pos.set(target.x - TUNING.camDist, target.y + TUNING.camHeight, target.z);
    this.look.set(target.x, target.y + 2, target.z);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
