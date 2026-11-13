import type { SfxName } from '../engine/types';

export interface Sfx {
  play(name: SfxName): void;
  setMuted(muted: boolean): void;
}

/** Minimal structural view of an AudioContext (keeps the module testable). */
export interface AudioBackend {
  currentTime: number;
  state?: string;
  resume?: () => Promise<void>;
  destination: unknown;
  createOscillator(): OscNode;
  createGain(): GainNode;
}

interface OscNode {
  type: OscillatorType;
  frequency: Param;
  connect(dest: unknown): unknown;
  start(t: number): void;
  stop(t: number): void;
}

interface GainNode {
  gain: Param;
  connect(dest: unknown): unknown;
}

interface Param {
  setValueAtTime(v: number, t: number): void;
  linearRampToValueAtTime(v: number, t: number): void;
  exponentialRampToValueAtTime(v: number, t: number): void;
}

/**
 * Synthesized sound effects via WebAudio (no assets). The AudioContext is
 * created lazily on first play so it is born inside a user gesture and
 * satisfies autoplay policies. Pass a custom backend in tests.
 */
export function makeSfx(ctx: AudioBackend | null = null): Sfx {
  let ac: AudioBackend | null = ctx;
  let muted = false;

  const ensure = (): AudioBackend | null => {
    if (muted) return null;
    if (!ac && typeof AudioContext !== 'undefined') {
      try {
        ac = new AudioContext();
      } catch {
        ac = null;
      }
    }
    if (ac && ac.state === 'suspended' && ac.resume) {
      ac.resume().catch(() => undefined);
    }
    return ac;
  };

  const tone = (c: AudioBackend, f0: number, f1: number, t0: number, dur: number, type: OscillatorType, vol: number): void => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(f0, 1), t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  };

  const recipes: Record<SfxName, (c: AudioBackend, t: number) => void> = {
    move: (c, t) => tone(c, 220, 180, t, 0.05, 'square', 0.045),
    rotate: (c, t) => tone(c, 330, 390, t, 0.06, 'triangle', 0.05),
    hold: (c, t) => tone(c, 520, 470, t, 0.07, 'sine', 0.05),
    harddrop: (c, t) => {
      tone(c, 150, 60, t, 0.1, 'square', 0.09);
      tone(c, 90, 45, t, 0.13, 'sine', 0.08);
    },
    clear: (c, t) => {
      [523.25, 659.25, 783.99].forEach((f, i) => tone(c, f, f, t + i * 0.06, 0.12, 'triangle', 0.06));
    },
    tetris: (c, t) => {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(c, f, f, t + i * 0.05, 0.14, 'triangle', 0.07));
    },
    tspin: (c, t) => {
      tone(c, 660, 990, t, 0.1, 'sawtooth', 0.05);
      tone(c, 440, 660, t + 0.06, 0.12, 'triangle', 0.06);
    },
    levelup: (c, t) => {
      [440, 554.37, 659.25, 880].forEach((f, i) => tone(c, f, f, t + i * 0.07, 0.16, 'sine', 0.06));
    },
    gameover: (c, t) => {
      [392, 329.63, 261.63, 196].forEach((f, i) => tone(c, f, f, t + i * 0.15, 0.24, 'triangle', 0.08));
    },
    start: (c, t) => {
      tone(c, 440, 880, t, 0.14, 'sine', 0.07);
      tone(c, 660, 1320, t + 0.05, 0.16, 'sine', 0.05);
    },
    pause: (c, t) => tone(c, 300, 240, t, 0.09, 'sine', 0.05),
  };

  return {
    play(name) {
      const c = ensure();
      if (!c) return;
      try {
        recipes[name](c, c.currentTime);
      } catch {
        // Audio is best-effort; never break the game for it.
      }
    },
    setMuted(m) {
      muted = m;
    },
  };
}
