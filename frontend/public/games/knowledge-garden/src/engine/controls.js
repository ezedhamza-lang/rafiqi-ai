/**
 * التحكّم — keyboard + touch.
 *
 * Desktop : WASD / Arrow keys steer, Space jumps, Shift dashes, Esc pauses.
 * Mobile  : a large virtual joystick plus big jump and dash buttons, sized for
 *           small hands (minimum 64px touch target).
 */
import { KEYS } from '../config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Controls {
  constructor(root) {
    this.root = root;
    this.keys = new Set();
    this.steer = 0;
    this.jumpQueued = false;
    this.dashQueued = false;
    this.stickX = 0;
    this.enabled = true;
    this.onPause = null;
    this.#keyboard();
    this.#touch();
  }

  #has(list) { return list.some((k) => this.keys.has(k)); }

  #keyboard() {
    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'Escape' && this.onPause) { this.onPause(); return; }
      if (!this.enabled) return;
      // Register BEFORE testing: the old order tested an empty set on the first
      // keydown, so the very first jump/dash of a run was silently swallowed.
      this.keys.add(e.code);
      if (this.#has(KEYS.jump)) this.jumpQueued = true;
      if (this.#has(KEYS.dash)) this.dashQueued = true;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    // Never leave the owl running after the tab loses focus.
    addEventListener('blur', () => this.keys.clear());
  }

  #touch() {
    const stick = this.root.querySelector('#kg-stick');
    const knob = this.root.querySelector('#kg-knob');
    const btnJump = this.root.querySelector('#kg-jump');
    const btnDash = this.root.querySelector('#kg-dash');
    if (!stick) return;

    let id = null;
    const move = (t) => {
      const r = stick.getBoundingClientRect();
      const dx = clamp((t.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
      this.stickX = dx;
      if (knob) knob.style.transform = `translate(${dx * 38}px, 0px)`;
    };
    const end = () => {
      id = null;
      this.stickX = 0;
      if (knob) knob.style.transform = 'translate(0,0)';
    };

    stick.addEventListener('touchstart', (e) => {
      id = e.changedTouches[0].identifier;
      move(e.changedTouches[0]);
      e.preventDefault();
    }, { passive: false });
    stick.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === id) { move(t); e.preventDefault(); }
    }, { passive: false });
    stick.addEventListener('touchend', end);
    stick.addEventListener('touchcancel', end);

    const press = (el, fn) => {
      if (!el) return;
      el.addEventListener('touchstart', (e) => { fn(); e.preventDefault(); }, { passive: false });
      el.addEventListener('click', (e) => { fn(); });
    };
    press(btnJump, () => { this.jumpQueued = true; });
    press(btnDash, () => { this.dashQueued = true; });
  }

  update() {
    const left = this.#has(KEYS.steerLeft) ? 1 : 0;
    const right = this.#has(KEYS.steerRight) ? 1 : 0;
    this.steer = clamp(right - left + this.stickX, -1, 1);
  }

  consumeJump() { const v = this.jumpQueued; this.jumpQueued = false; return v; }
  consumeDash() { const v = this.dashQueued; this.dashQueued = false; return v; }
}
