/**
 * محرّك الصوت — procedural Web Audio, no external assets.
 *
 * Every sound is synthesised, so the game ships with zero audio files and
 * works offline. Tones are short, warm and child-friendly.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  tone({ freq = 440, dur = 0.18, type = 'sine', vol = 0.3, slide = 0, delay = 0 }) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.2, filter = 1800, delay = 0 }) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = filter;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t0);
  }

  // ---- game sounds -------------------------------------------------------

  /** Rising two-note chime; `index` climbs the scale with the streak. */
  correct(index = 0) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const f = scale[index % scale.length];
    this.tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.28 });
    this.tone({ freq: f * 1.5, dur: 0.2, type: 'sine', vol: 0.16, delay: 0.08 });
  }

  /** Gentle, never harsh — a nudge, not a buzzer. */
  wrong() {
    this.tone({ freq: 320, dur: 0.16, type: 'sine', vol: 0.14, slide: -90 });
    this.tone({ freq: 240, dur: 0.14, type: 'sine', vol: 0.09, delay: 0.1, slide: -60 });
  }

  star() {
    this.tone({ freq: 1046, dur: 0.1, type: 'triangle', vol: 0.2 });
    this.tone({ freq: 1396, dur: 0.14, type: 'triangle', vol: 0.16, delay: 0.07 });
  }

  gem() {
    this.tone({ freq: 880, dur: 0.1, type: 'sine', vol: 0.18 });
    this.tone({ freq: 1174, dur: 0.12, type: 'sine', vol: 0.14, delay: 0.06 });
  }

  jump() { this.tone({ freq: 380, dur: 0.13, type: 'triangle', vol: 0.16, slide: 260 }); }
  dash() { this.noise({ dur: 0.26, vol: 0.16, filter: 2400 }); this.tone({ freq: 620, dur: 0.16, type: 'sawtooth', vol: 0.08, slide: 400 }); }
  land() { this.noise({ dur: 0.1, vol: 0.1, filter: 700 }); }

  /** A collectible shatters into particles. */
  shatter() {
    this.noise({ dur: 0.3, vol: 0.2, filter: 3000 });
    this.tone({ freq: 880, dur: 0.14, type: 'triangle', vol: 0.12, slide: 300 });
  }

  levelDone() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.24, delay: i * 0.13 }));
  }

  /** A richer, longer fanfare reserved for boss defeats. */
  bossDone() {
    [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      this.tone({ freq: f, dur: 0.42, type: 'triangle', vol: 0.26, delay: i * 0.15 });
      this.tone({ freq: f * 0.5, dur: 0.42, type: 'sine', vol: 0.14, delay: i * 0.15 });
    });
  }

  streak() {
    [659.25, 830.6, 987.77].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.22, delay: i * 0.09 }));
  }

  ui() { this.tone({ freq: 660, dur: 0.08, type: 'sine', vol: 0.12 }); }
}

export const audio = new AudioEngine();
