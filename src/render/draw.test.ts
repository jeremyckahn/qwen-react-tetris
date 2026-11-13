import { describe, expect, it } from 'vitest';
import { drawBlock, drawFrame } from './draw';
import { createFx, drawFx, onFx, updateFx } from './fx';
import { createGame, hardDrop, startGame } from '../engine/engine';
import { emptyGrid } from '../engine/board';
import { COLORS } from '../engine/constants';
import { recordingCtx } from '../test/helpers';
import type { GameState } from '../engine/types';

describe('drawBlock', () => {
  it('paints a gradient block with gloss and shadow', () => {
    const { ctx, calls } = recordingCtx();
    drawBlock(ctx, 16, 64, 32, COLORS.T);
    expect(calls).toContain('createLinearGradient');
    expect(calls).toContain('arcTo');
    expect(calls.filter((c) => c === 'fill').length).toBeGreaterThanOrEqual(2);
    expect(calls).toContain('fillRect');
  });

  it('skips fully transparent blocks', () => {
    const { ctx, calls } = recordingCtx();
    drawBlock(ctx, 16, 64, 32, COLORS.T, 0);
    expect(calls).toEqual([]);
  });
});

describe('drawFrame', () => {
  it('renders a full frame without throwing', () => {
    const st = startGame(createGame({ seed: 7 }));
    const { ctx, calls } = recordingCtx();
    drawFrame(ctx, st, createFx(), 16);
    expect(calls).toContain('clearRect');
    expect(calls).toContain('fillRect'); // backdrop
    expect(calls).toContain('stroke'); // grid lines
    expect(calls.filter((c) => c === 'fill').length).toBeGreaterThan(3); // piece blocks
  });

  it('draws the ghost piece outline below the active piece', () => {
    const st = startGame(createGame({ seed: 7 }));
    const { ctx, calls } = recordingCtx();
    drawFrame(ctx, st, createFx(), 16);
    expect(calls.filter((c) => c === 'stroke').length).toBeGreaterThan(10); // grid lines + ghost
  });

  it('renders a static board in the menu phase', () => {
    const st = createGame({ seed: 7 });
    const { ctx, calls } = recordingCtx();
    drawFrame(ctx, st, createFx(), 16);
    expect(calls).toContain('fillRect');
  });

  it('animates a line clear from the pre-clear snapshot', () => {
    const st = startGame(createGame({ seed: 7 }));
    const g = emptyGrid();
    for (let x = 0; x < 10; x++) if (x !== 6) g[39][x] = 'J';
    const pre: GameState = { ...st, grid: g, active: { kind: 'I', rot: 3, x: 5, y: 36 } };
    const after = hardDrop(pre);
    expect(after.fx.some((f) => f.kind === 'clear')).toBe(true);

    const fx = createFx();
    for (const f of after.fx) onFx(f, after, fx);
    expect(fx.clear).not.toBeNull();
    expect(fx.particles.length).toBeGreaterThan(0);

    updateFx(fx, 100);
    const { ctx, calls } = recordingCtx();
    drawFrame(ctx, after, fx, 16);
    expect(calls).toContain('fillRect'); // flash row + particles
    expect(calls).toContain('fillText'); // score popup
  });

  it('completes the clear animation and returns to the live grid', () => {
    const st = startGame(createGame({ seed: 7 }));
    const g = emptyGrid();
    for (let x = 0; x < 10; x++) if (x !== 6) g[39][x] = 'J';
    const pre: GameState = { ...st, grid: g, active: { kind: 'I', rot: 3, x: 5, y: 36 } };
    const after = hardDrop(pre);
    const fx = createFx();
    for (const f of after.fx) onFx(f, after, fx);
    updateFx(fx, 500); // longer than the 280ms animation
    expect(fx.clear).toBeNull();
    const { ctx } = recordingCtx();
    expect(() => drawFrame(ctx, after, fx, 16)).not.toThrow();
  });

  it('draws particles and popups', () => {
    const fx = createFx();
    fx.particles.push({ x: 10, y: 10, vx: 0, vy: 0, life: 0, max: 100, size: 3, color: '#fff' });
    fx.popups.push({ text: 'TETRIS', sub: '+800', color: '#fbbf24', x: 160, y: 80, t: 0.2, big: true });
    const { ctx, calls } = recordingCtx();
    drawFx(ctx, fx);
    expect(calls).toContain('fillRect');
    expect(calls).toContain('fillText');
  });

  it('decays screen shake and game-over flash', () => {
    const fx = createFx();
    fx.shakeT = 1;
    fx.shakeAmp = 10;
    fx.flashT = 1;
    updateFx(fx, 1000); // longer than both the 220ms shake and 600ms flash
    expect(fx.shakeT).toBe(0);
    expect(fx.flashT).toBe(0);
    const st = startGame(createGame({ seed: 7 }));
    const { ctx } = recordingCtx();
    expect(() => drawFrame(ctx, st, fx, 16)).not.toThrow();
  });

  it('spawns dust particles for a hard drop and a big shake', () => {
    const st = startGame(createGame({ seed: 7 }));
    const g = emptyGrid();
    for (let x = 0; x < 10; x++) if (x !== 6) g[39][x] = 'J';
    const pre: GameState = { ...st, grid: g, active: { kind: 'I', rot: 3, x: 4, y: 30 } };
    const after = hardDrop(pre);
    const fx = createFx();
    for (const f of after.fx) onFx(f, after, fx);
    expect(fx.shakeT).toBe(1);
    expect(fx.shakeAmp).toBe(5);
    expect(fx.particles.length).toBeGreaterThan(0);
  });
});
