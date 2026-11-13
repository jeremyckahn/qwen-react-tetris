import { COLORS, VISIBLE_TOP } from '../engine/constants';
import { pieceCells } from '../engine/board';
import type { Fx, GameState, Grid } from '../engine/types';
import { BOARD_W, CELL, xOf, yOf } from './geom';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

export interface Popup {
  text: string;
  sub: string;
  color: string;
  x: number;
  y: number;
  t: number; // 0..1 lifetime
  big: boolean;
}

/** In-flight line-clear collapse animation (t: 0..1). */
export interface ClearAnim {
  grid: Grid;
  rows: number[];
  t: number;
}

export interface FxState {
  particles: Particle[];
  popups: Popup[];
  clear: ClearAnim | null;
  shakeT: number;
  shakeAmp: number;
  flashT: number;
}

export function createFx(): FxState {
  return { particles: [], popups: [], clear: null, shakeT: 0, shakeAmp: 0, flashT: 0 };
}

/** Translates engine fx into particle/popup/animation state. */
export function onFx(fx: Fx, _st: GameState, f: FxState): void {
  if (fx.kind === 'clear') {
    if (fx.rows.length > 0) f.clear = { grid: fx.preGrid, rows: fx.rows, t: 0 };
    fx.cells.forEach((row, i) => {
      const y = fx.rows[i];
      row.forEach((c, x) => {
        if (!c) return;
        const col = COLORS[c];
        for (let i = 0; i < 5; i++) {
          f.particles.push({
            x: xOf(x) + Math.random() * CELL,
            y: yOf(y) + Math.random() * CELL,
            vx: (Math.random() - 0.5) * 320,
            vy: (Math.random() - 0.6) * 380,
            life: 0,
            max: 380 + Math.random() * 520,
            size: 2 + Math.random() * 5,
            color: i % 2 ? col.base : col.light,
          });
        }
      });
    });
    const big = fx.label.includes('TETRIS') || fx.label.includes('TRIPLE') || fx.label.includes('T-SPIN');
    f.popups.push({
      text: fx.label,
      sub: `+${fx.points}`,
      color: big ? '#fbbf24' : '#e2e8f0',
      x: BOARD_W / 2,
      y: 84,
      t: 0,
      big,
    });
    if (fx.combo >= 2) {
      f.popups.push({
        text: `COMBO \u00d7${fx.combo - 1}`,
        sub: '',
        color: '#22d3ee',
        x: BOARD_W / 2,
        y: 128,
        t: 0.1,
        big: false,
      });
    }
  } else if (fx.kind === 'harddrop') {
    f.shakeT = 1;
    f.shakeAmp = 5;
    for (const { x, y } of pieceCells(fx.piece)) {
      if (y < VISIBLE_TOP) continue;
      for (let i = 0; i < 3; i++) {
        f.particles.push({
          x: xOf(x) + Math.random() * CELL,
          y: yOf(y) + CELL,
          vx: (Math.random() - 0.5) * 200,
          vy: 60 + Math.random() * 120,
          life: 0,
          max: 240 + Math.random() * 200,
          size: 2 + Math.random() * 3,
          color: 'rgba(226,232,240,0.9)',
        });
      }
    }
  } else if (fx.kind === 'levelup') {
    f.popups.push({ text: `LEVEL ${fx.level}`, sub: 'SPEED UP', color: '#4ade80', x: BOARD_W / 2, y: 164, t: 0.2, big: true });
  } else if (fx.kind === 'gameover') {
    f.flashT = 1;
    f.shakeT = 1;
    f.shakeAmp = 12;
  }
}

export function updateFx(f: FxState, dt: number): void {
  if (f.clear) {
    f.clear.t += dt / 280;
    if (f.clear.t >= 1) f.clear = null;
  }
  if (f.shakeT > 0) f.shakeT = Math.max(0, f.shakeT - dt / 220);
  if (f.flashT > 0) f.flashT = Math.max(0, f.flashT - dt / 600);
  const s = dt / 1000;
  for (const p of f.particles) {
    p.life += dt;
    p.x += p.vx * s;
    p.y += p.vy * s;
    p.vy += 620 * s;
  }
  if (f.particles.length > 0) f.particles = f.particles.filter((p) => p.life < p.max);
  if (f.popups.length > 0) {
    for (const p of f.popups) p.t += dt / 1500;
    f.popups = f.popups.filter((p) => p.t < 1);
  }
}

export function drawFx(ctx: CanvasRenderingContext2D, f: FxState): void {
  for (const p of f.particles) {
    const a = Math.max(0, 1 - p.life / p.max);
    if (a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.restore();
  }
  for (const p of f.popups) {
    const a = p.t < 0.12 ? p.t / 0.12 : 1 - Math.max(0, (p.t - 0.45) / 0.55);
    if (a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = `${p.big ? 800 : 700} ${p.big ? 26 : 16}px 'Orbitron', system-ui, sans-serif`;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = p.color;
    const y = p.y - p.t * 52;
    ctx.fillText(p.text, p.x, y);
    if (p.sub) {
      ctx.font = "700 13px 'Orbitron', monospace";
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(p.sub, p.x, y + 20);
    }
    ctx.restore();
  }
}
