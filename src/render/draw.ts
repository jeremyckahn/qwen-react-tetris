import { dropY, pieceCells } from '../engine/board';
import { COLORS, COLS, ROWS, VISIBLE_ROWS, VISIBLE_TOP, type PieceColor } from '../engine/constants';
import type { GameState, Grid } from '../engine/types';
import { BOARD_H, BOARD_W, CELL, xOf, yOf } from './geom';
import { drawFx, updateFx, type FxState } from './fx';

const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** One glowing block: neon shadow, vertical gradient, top gloss, bottom shade. */
export function drawBlock(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  color: PieceColor,
  alpha = 1,
): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const inset = size * 0.07;
  const g = ctx.createLinearGradient(0, py + inset, 0, py + size - inset);
  g.addColorStop(0, color.light);
  g.addColorStop(0.45, color.base);
  g.addColorStop(1, color.base);
  ctx.shadowColor = color.glow;
  ctx.shadowBlur = size * 0.4;
  rr(ctx, px + inset, py + inset, size - inset * 2, size - inset * 2, size * 0.18);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  rr(ctx, px + inset * 1.6, py + inset * 1.6, size - inset * 3.2, size * 0.16, size * 0.1);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(px + inset, py + size - inset - size * 0.14, size - inset * 2, size * 0.14);
  ctx.restore();
}

function paintGrid(ctx: CanvasRenderingContext2D, grid: Grid, offset: (y: number) => number): void {
  for (let y = 0; y < ROWS; y++) {
    const sy = offset(y);
    if (sy < -CELL || sy >= BOARD_H) continue;
    for (let x = 0; x < COLS; x++) {
      const c = grid[y][x];
      if (c) drawBlock(ctx, xOf(x), sy, CELL, COLORS[c]);
    }
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, st: GameState, fx: FxState): void {
  if (fx.clear) {
    // Animated collapse: rows above the gap slide down; cleared rows flash white.
    const e = easeOut(Math.min(fx.clear.t, 1));
    const { grid, rows } = fx.clear;
    const below = (y: number): number => rows.reduce((n, r) => (r > y ? n + 1 : n), 0);
    for (let y = 0; y < ROWS; y++) {
      if (rows.includes(y)) {
        const sy = yOf(y);
        if (sy < -CELL || sy >= BOARD_H) continue;
        const a = 1 - e;
        if (a > 0.01) {
          ctx.save();
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 18;
          ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`;
          ctx.fillRect(0, sy, BOARD_W, CELL);
          ctx.restore();
        }
        continue;
      }
      const sy = yOf(y) + below(y) * e * CELL;
      if (sy < -CELL || sy >= BOARD_H) continue;
      paintGrid(ctx, grid, () => sy);
    }
  } else {
    paintGrid(ctx, st.grid, yOf);
  }
}

function drawActive(ctx: CanvasRenderingContext2D, st: GameState): void {
  const p = st.active;
  if (!p) return;
  const gy = dropY(st.grid, p);
  if (gy !== p.y) {
    // Ghost piece: outline at the landing spot.
    const c = COLORS[p.kind];
    ctx.save();
    ctx.globalAlpha = 0.4;
    for (const { x, y } of pieceCells({ kind: p.kind, rot: p.rot, x: p.x, y: gy })) {
      if (y < VISIBLE_TOP) continue;
      rr(ctx, xOf(x) + 3, yOf(y) + 3, CELL - 6, CELL - 6, 5);
      ctx.strokeStyle = c.base;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }
  for (const { x, y } of pieceCells(p)) {
    if (y < VISIBLE_TOP) continue;
    drawBlock(ctx, xOf(x), yOf(y), CELL, COLORS[p.kind]);
  }
}

function drawBackdrop(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, 0, BOARD_H);
  g.addColorStop(0, '#111737');
  g.addColorStop(1, '#0a0e1f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  ctx.strokeStyle = 'rgba(148,163,255,0.08)';
  ctx.lineWidth = 1;
  for (let x = 1; x < COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(xOf(x) + 0.5, 0);
    ctx.lineTo(xOf(x) + 0.5, BOARD_H);
    ctx.stroke();
  }
  for (let y = 1; y < VISIBLE_ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, yOf(y) + 0.5);
    ctx.lineTo(BOARD_W, yOf(y) + 0.5);
    ctx.stroke();
  }
}

/** Renders one full frame of the board (called every animation frame). */
export function drawFrame(ctx: CanvasRenderingContext2D, st: GameState, fx: FxState, dt: number): void {
  ctx.clearRect(0, 0, BOARD_W, BOARD_H);
  drawBackdrop(ctx);
  ctx.save();
  if (fx.shakeT > 0) {
    const a = fx.shakeAmp * fx.shakeT * fx.shakeT;
    ctx.translate((Math.random() - 0.5) * 2 * a, (Math.random() - 0.5) * 2 * a);
  }
  drawBoard(ctx, st, fx);
  if (st.active && st.phase !== 'menu') drawActive(ctx, st);
  updateFx(fx, dt);
  drawFx(ctx, fx);
  if (fx.flashT > 0) {
    ctx.fillStyle = `rgba(248,60,90,${0.35 * fx.flashT})`;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  }
  ctx.restore();
}
