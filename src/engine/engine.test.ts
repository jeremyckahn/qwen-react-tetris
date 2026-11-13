import { describe, expect, it } from 'vitest';
import {
  consumeFx,
  createGame,
  hardDrop,
  holdPiece,
  lockActive,
  move,
  pauseToggle,
  rotate,
  rotateHalf,
  setSoftDrop,
  spawn,
  startGame,
  tick,
} from './engine';
import { canMove, clearRows, dropY, emptyGrid, isGrounded, merge, pieceCells, spawnPiece, tspinCorners } from './board';
import { COLS, KICKS, LOCK_DELAY, PIECE_CELLS, ROWS, VISIBLE_TOP, gravityMs } from './constants';
import type { ActivePiece, GameState, Grid, PieceKind } from './types';

function gridFull(rows: number[], fill: PieceKind = 'J'): Grid {
  const g = emptyGrid();
  for (const y of rows) for (let x = 0; x < COLS; x++) g[y][x] = fill;
  return g;
}

/** A playing-state with a bespoke grid/active piece (and optional overrides). */
function playing(grid?: Grid, active?: ActivePiece | null, extra: Partial<GameState> = {}): GameState {
  const base = createGame({ seed: 1 });
  return { ...base, phase: 'playing', grid: grid ?? base.grid, active: active ?? base.active, ...extra };
}

const T = (x: number, y: number, rot: 0 | 1 | 2 | 3 = 0): ActivePiece => ({ kind: 'T', rot, x, y });
const I = (x: number, y: number, rot: 0 | 1 | 2 | 3 = 0): ActivePiece => ({ kind: 'I', rot, x, y });

describe('createGame / startGame', () => {
  it('creates a menu-phase game with an empty 40x10 board', () => {
    const s = createGame({ seed: 42 });
    expect(s.phase).toBe('menu');
    expect(s.grid.length).toBe(40);
    expect(s.grid[0].length).toBe(10);
    expect(s.grid.every((r) => r.every((c) => c === null))).toBe(true);
    expect(s.active).toBeNull();
    expect(s.hold).toBeNull();
    expect(s.score).toBe(0);
    expect(s.level).toBe(1);
  });

  it('pre-rolls a next queue of at least 5 pieces', () => {
    const s = createGame({ seed: 42 });
    expect(s.queue.length).toBeGreaterThanOrEqual(5);
    expect(new Set(s.queue.slice(0, 7)).size).toBe(7); // first 7 = one full bag
  });

  it('is deterministic for a given seed', () => {
    const a = createGame({ seed: 777 });
    const b = createGame({ seed: 777 });
    expect(a.queue.slice(0, 10)).toEqual(b.queue.slice(0, 10));
  });

  it('honors a provided initial queue', () => {
    const s = createGame({ queue: ['T', 'I', 'S', 'Z', 'J', 'L', 'O'] });
    expect(s.queue.slice(0, 7)).toEqual(['T', 'I', 'S', 'Z', 'J', 'L', 'O']);
  });

  it('startGame spawns a piece at the top of the visible field', () => {
    const s = startGame(createGame({ seed: 5 }));
    expect(s.phase).toBe('playing');
    expect(s.active).not.toBeNull();
    expect(s.active!.y).toBe(VISIBLE_TOP);
    expect(s.score).toBe(0);
  });

  it('ignores startGame while playing', () => {
    const s = startGame(createGame({ seed: 5 }));
    expect(startGame(s)).toBe(s);
  });

  it('restarts cleanly from game over', () => {
    const over = { ...startGame(createGame({ seed: 5 })), phase: 'over' as const, overReason: 'lockout' as const, score: 999 };
    const again = startGame(over);
    expect(again.phase).toBe('playing');
    expect(again.score).toBe(0);
    expect(again.lines).toBe(0);
    expect(again.grid.every((r) => r.every((c) => c === null))).toBe(true);
  });
});

describe('7-bag randomizer', () => {
  it('deals two full 7-bags, each a permutation of all pieces', () => {
    // After startGame the queue holds the rest of bag 1 followed by a full bag 2:
    // [b1.1..b1.6, b2.0..b2.6]. (Playing 14 pieces is impossible: the stack
    // would block out first, so verify the dealing directly from the queue.)
    const s = startGame(createGame({ seed: 1234 }));
    const bag1: PieceKind[] = [s.active!.kind, ...s.queue.slice(0, 6)];
    const bag2: PieceKind[] = s.queue.slice(6, 13);
    expect(bag1).toHaveLength(7);
    expect(bag2).toHaveLength(7);
    expect(bag1.slice().sort().join('')).toBe('IJLOSTZ');
    expect(bag2.slice().sort().join('')).toBe('IJLOSTZ');
    expect(bag1.join('')).not.toBe(bag2.join('')); // consecutive shuffles differ
  });

  it('keeps the queue topped up while playing', () => {
    let s = startGame(createGame({ seed: 321 }));
    for (let i = 0; i < 8; i++) s = hardDrop(s);
    expect(s.queue.length).toBeGreaterThanOrEqual(5);
  });
});

describe('movement & collision', () => {
  it('moves left/right when free', () => {
    const s = playing(undefined, T(3, 10));
    expect(move(s, -1)!.active!.x).toBe(2);
    expect(move(s, 1)!.active!.x).toBe(4);
  });

  it('refuses to move through walls', () => {
    const s = playing(undefined, T(0, 10));
    expect(move(s, -1)).toBe(s);
    const right = playing(undefined, T(7, 10));
    expect(move(right, 1)).toBe(right); // column 9 would be out of bounds
  });

  it('refuses to move into locked blocks', () => {
    const g = emptyGrid();
    g[11][2] = 'J'; // the cell the piece would occupy after moving left
    const s = playing(g, T(3, 10));
    expect(move(s, -1)).toBe(s);
  });

  it('falls one row under gravity at level 1 (1000ms/row)', () => {
    const s0 = playing(undefined, T(3, 20));
    expect(gravityMs(1)).toBe(1000);
    expect(tick(s0, 999).active!.y).toBe(20);
    expect(tick(s0, 1000).active!.y).toBe(21);
    expect(tick(tick(s0, 1000), 1000).active!.y).toBe(22);
  });

  it('gravity accelerates with level and clamps', () => {
    expect(gravityMs(2)).toBeLessThan(1000);
    expect(gravityMs(10)).toBeLessThan(gravityMs(5));
    expect(gravityMs(15)).toBeLessThan(gravityMs(10));
    expect(gravityMs(99)).toBe(gravityMs(20));
  });

  it('soft drop caps gravity and scores +1 per row', () => {
    let s = setSoftDrop(playing(undefined, T(3, 20)), true);
    s = tick(s, 40);
    expect(s.active!.y).toBe(21);
    expect(s.score).toBe(1);
    s = tick(s, 100); // ~2 rows
    expect(s.active!.y).toBe(23);
    expect(s.score).toBe(3);
  });

  it('does not soft-drop while paused', () => {
    let s = setSoftDrop(playing(undefined, T(3, 20)), true);
    s = { ...s, phase: 'paused' as const };
    expect(tick(s, 5000)).toBe(s);
  });

  it('hard drop lands on the ghost and pays +2 per row', () => {
    const s = playing(undefined, I(3, 20, 1)); // vertical I: rests at y=36
    expect(dropY(emptyGrid(), I(3, 20, 1))).toBe(36);
    const r = hardDrop(s);
    expect(r.phase).toBe('playing'); // locks, spawns next
    expect(r.score).toBe(16 * 2); // 20 -> 36
    expect(r.active!.y).toBe(20); // next piece spawned
    expect(r.fx[0].kind).toBe('harddrop');
  });

  it('hard drop is a no-op in the menu', () => {
    const s = createGame({ seed: 9 });
    expect(hardDrop(s)).toBe(s);
  });
});

describe('lock delay', () => {
  const grounded = () => playing(undefined, T(3, 38)); // flat on the floor

  it('locks after 500ms of resting', () => {
    let s = grounded();
    expect(isGrounded(s.grid, s.active!)).toBe(true);
    s = tick(s, 400);
    expect(s.active!.y).toBe(38);
    s = tick(s, 99);
    expect(s.active!.y).toBe(38);
    s = tick(s, 1);
    expect(s.active!.y).toBe(20); // locked + respawned
    expect(s.grid[39][4]).toBe('T');
  });

  it('locks on the frame it lands when the frame exceeds the lock delay', () => {
    const s = playing(undefined, T(3, 20));
    let cur = s;
    for (let i = 0; i < 17; i++) cur = tick(cur, 1000);
    expect(cur.active!.y).toBe(37); // one row above the floor, not grounded yet
    expect(cur.lockAcc).toBe(0);
    cur = tick(cur, 1000); // falls onto the floor; the 500ms window elapses in-frame
    expect(cur.active!.y).toBe(20); // locked + respawned
  });

  it('accumulates the lock timer across frames while resting', () => {
    const s = playing(undefined, T(3, 38));
    const a = tick(s, 300);
    expect(a.lockAcc).toBe(300);
    const b = tick(a, 150);
    expect(b.lockAcc).toBe(450);
    expect(b.active!.y).toBe(38);
    expect(tick(b, 50).active!.y).toBe(20); // 500 reached -> lock
  });

  it('successful moves while grounded reset the lock delay', () => {
    let s = grounded();
    s = tick(s, 300);
    s = move(s, 1);
    expect(s.lockResets).toBe(1);
    expect(s.lockAcc).toBe(0);
    s = tick(s, 300);
    s = move(s, -1);
    expect(s.lockResets).toBe(2);
    expect(s.lockAcc).toBe(0);
    s = tick(s, 499);
    expect(s.active!.y).toBe(38); // 499 < 500 after last reset
    s = tick(s, 2);
    expect(s.active!.y).toBe(20);
  });

  it('caps lock resets at 15, after which moves stop resetting', () => {
    let s = playing(undefined, T(3, 38));
    for (let i = 0; i < 20; i++) {
      s = tick(s, 40);
      s = move(s, i % 2 === 0 ? 1 : -1);
    }
    expect(s.lockResets).toBe(15);
    expect(s.lockAcc).toBeLessThan(LOCK_DELAY);
    s = tick(s, LOCK_DELAY - s.lockAcc + 1);
    expect(s.active!.y).toBe(20); // force-locked
  });

  it('resets lock state on each new piece', () => {
    let s = playing(undefined, T(3, 38));
    s = tick(s, 400);
    s = tick(s, 200); // locked -> new piece
    expect(s.lockResets).toBe(0);
    expect(s.lockAcc).toBe(0);
    expect(s.active!.y).toBe(20);
  });
});

describe('rotations (SRS)', () => {
  it('cycles through all four rotation states in place', () => {
    let s = playing(undefined, T(4, 10));
    s = rotate(s, 1);
    expect(s.active).toMatchObject({ rot: 1, x: 4, y: 10 });
    s = rotate(s, 1);
    expect(s.active!.rot).toBe(2);
    s = rotate(s, 1);
    expect(s.active!.rot).toBe(3);
    s = rotate(s, 1);
    expect(s.active!.rot).toBe(0);
    expect(s.active!.x).toBe(4);
    expect(s.active!.y).toBe(10);
  });

  it('counter-rotates', () => {
    expect(rotate(playing(undefined, T(4, 10)), -1).active!.rot).toBe(3);
  });

  it('180 rotation works as two 90s and via the direct table', () => {
    const s = playing(undefined, T(4, 10));
    expect(rotateHalf(s).active!.rot).toBe(2);
    expect(rotate(s, 2).active!.rot).toBe(2);
  });

  it('O piece rotation is a no-op', () => {
    const s = playing(undefined, { kind: 'O', rot: 0, x: 3, y: 10 });
    expect(rotate(s, 1)).toBe(s);
    expect(rotate(s, -1)).toBe(s);
  });

  it('failed rotations leave state unchanged', () => {
    // Solid wall of blocks around the piece (its own cells carved out): no kick
    // can fit the rotated shape, so the rotation must fail.
    const g = emptyGrid();
    const p: ActivePiece = { kind: 'T', rot: 1, x: 3, y: 9 };
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) g[y][x] = 'J';
    for (const [cx, cy] of PIECE_CELLS.T[1]) g[p.y + cy][p.x + cx] = null;
    const s = playing(g, p);
    expect(rotate(s, 1)).toBe(s);
    expect(rotate(s, -1)).toBe(s);
    expect(move(s, -1)).toBe(s);
    expect(move(s, 1)).toBe(s);
  });

  it('I-piece floor kick: rotates onto a blocked row using a nonzero offset', () => {
    const g = emptyGrid();
    for (let x = 3; x <= 6; x++) g[37][x] = 'J'; // block the in-place horizontal
    const s = playing(g, I(5, 36, 3)); // vertical I in column 7, on the floor
    const r = rotate(s, 1);
    expect(r).not.toBe(s);
    expect(r.active).toMatchObject({ x: 6, y: 38, rot: 0 }); // kick (1, +2)
  });

  it('JLSTZ obstacle kick: blocked (0,0) falls back to the (1,0) offset', () => {
    const g = emptyGrid();
    g[37][5] = 'J';
    const s = playing(g, { kind: 'T', rot: 2, x: 4, y: 37 });
    const r = rotate(s, 1);
    expect(r.active).toMatchObject({ x: 5, y: 37, rot: 3 });
  });

  it('every kick table entry exists and is non-empty', () => {
    const pairs = ['0>1', '1>0', '1>2', '2>1', '2>3', '3>2', '3>0', '0>3', '0>2', '2>0'];
    for (const kind of ['I', 'J', 'L', 'S', 'T', 'Z'] as const) {
      for (const p of pairs) {
        expect(KICKS[kind][p]?.length, `${kind} ${p}`).toBeGreaterThanOrEqual(3);
      }
    }
    // The O piece has an identity kick in every transition.
    for (const p of pairs) expect(KICKS.O[p]).toEqual([[0, 0]]);
  });
});

describe('clearing & scoring', () => {
  it('clears full rows, shifting rows above down', () => {
    const g = emptyGrid();
    g[38][0] = 'T';
    for (let x = 0; x < COLS; x++) g[39][x] = 'J';
    const { grid, rows } = clearRows(g);
    expect(rows).toEqual([39]);
    expect(grid[39][0]).toBe('T');
    expect(grid[38][0]).toBeNull();
  });

  it('clears multiple non-adjacent rows with correct shifts', () => {
    const g = emptyGrid();
    g[38][1] = 'S';
    g[36][2] = 'Z';
    for (const y of [37, 39]) for (let x = 0; x < COLS; x++) g[y][x] = 'L';
    const r = clearRows(g);
    expect(r.rows).toEqual([37, 39]);
    expect(r.grid[39][1]).toBe('S'); // 38 -> 39 (row below it cleared)
    expect(r.grid[38][2]).toBe('Z'); // 36 -> 38 (both below cleared)
    expect(r.grid[37][2]).toBeNull();
  });

  it('scores a normal single for a lock into a full row', () => {
    const g = emptyGrid();
    for (let x = 0; x < COLS; x++) if (x !== 3 && x !== 4 && x !== 5) g[39][x] = 'J';
    for (let x = 0; x < COLS; x++) if (x !== 4 && x !== 0) g[38][x] = 'L'; // hole elsewhere
    const s = playing(g, T(3, 38), { lastAction: 'move' });
    const r = lockActive(s);
    const fx = r.fx.find((f) => f.kind === 'clear');
    expect(fx).toBeTruthy();
    expect(r.score).toBe(100);
    expect(r.lines).toBe(1);
    expect(fx!.label).toBe('SINGLE');
    expect(fx!.sfx).toBe('clear');
    expect(r.combo).toBe(1);
  });

  it('scores a full T-spin single (800) with the 3-corner rule', () => {
    const g = emptyGrid();
    for (let x = 0; x < COLS; x++) if (x !== 3 && x !== 4 && x !== 5) g[39][x] = 'J';
    for (let x = 0; x < COLS; x++) if (x !== 4 && x !== 0) g[38][x] = 'L';
    const s = playing(g, T(3, 38), { lastAction: 'rotate' });
    const r = lockActive(s);
    expect(r.score).toBe(800);
    const fx = r.fx.find((f) => f.kind === 'clear')!;
    expect(fx.label).toBe('T-SPIN SINGLE');
    expect(fx.sfx).toBe('tspin');
    expect(fx.tspin).toBe('full');
  });

  it('a move after the rotate disqualifies the T-spin', () => {
    const g = emptyGrid();
    for (let x = 0; x < COLS; x++) if (x !== 3 && x !== 4 && x !== 5) g[39][x] = 'J';
    for (let x = 0; x < COLS; x++) if (x !== 4 && x !== 0) g[38][x] = 'L';
    const s = playing(g, T(3, 38), { lastAction: 'move' }); // same slot, no spin
    const r = lockActive(s);
    expect(r.score).toBe(100);
    const fx = r.fx.find((f) => f.kind === 'clear')!;
    expect(fx.label).toBe('SINGLE');
    expect(fx.tspin).toBe('none');
  });

  it('scores a mini T-spin when only one front corner is filled', () => {
    const g = emptyGrid();
    // Front (rot 0) = NW + NE. Fill only NW; the floor supplies both back corners.
    for (let x = 0; x < COLS; x++) if (x !== 1 && x !== 2) g[38][x] = 'S'; // gap: top cell + NE
    for (let x = 0; x < COLS; x++) if (x > 2) g[39][x] = 'L'; // T's bottom row completes it
    const s = playing(g, T(0, 38), { lastAction: 'rotate' });
    const r = lockActive(s);
    expect(r.score).toBe(200);
    const fx = r.fx.find((f) => f.kind === 'clear')!;
    expect(fx.tspin).toBe('mini');
    expect(fx.label).toBe('MINI SINGLE');
  });

  it('awards a zero-line T-spin 100 points with no combo effect', () => {
    const g = emptyGrid();
    g[38][0] = 'J'; // NW (front)
    g[38][2] = 'L'; // NE (front); floor supplies both back corners -> full spin
    const s = playing(g, T(0, 38), { lastAction: 'rotate', combo: 3, backToBack: true });
    const r = lockActive(s);
    expect(r.score).toBe(100);
    expect(r.lines).toBe(0);
    const fx = r.fx.find((f) => f.kind === 'clear')!;
    expect(fx.label).toBe('T-SPIN');
    expect(r.combo).toBe(0); // spin without lines breaks the streak
    expect(r.backToBack).toBe(false);
  });

  it('applies back-to-back x1.5 to consecutive T-spins', () => {
    const g = emptyGrid();
    for (let x = 0; x < COLS; x++) if (x !== 3 && x !== 4 && x !== 5) g[39][x] = 'J';
    for (let x = 0; x < COLS; x++) if (x !== 4 && x !== 0) g[38][x] = 'L';
    const s = playing(g, T(3, 38), { lastAction: 'rotate', backToBack: true });
    const r = lockActive(s);
    expect(r.score).toBe(1200);
    const fx = r.fx.find((f) => f.kind === 'clear')!;
    expect(fx.b2b).toBe(true);
    expect(fx.label).toContain('B2B');
    expect(r.backToBack).toBe(true);
  });

  it('a non-b2b clear resets the chain', () => {
    const g = emptyGrid();
    for (let x = 0; x < COLS; x++) if (x !== 3 && x !== 4 && x !== 5) g[39][x] = 'J';
    for (let x = 0; x < COLS; x++) if (x !== 4 && x !== 0) g[38][x] = 'L';
    const s = playing(g, T(3, 38), { lastAction: 'move', backToBack: true });
    const r = lockActive(s);
    expect(r.score).toBe(100);
    expect(r.backToBack).toBe(false);
  });

  it('scores a Tetris (800) when a vertical I drops into a 4-row gap', () => {
    const g = emptyGrid();
    for (const y of [36, 37, 38, 39]) for (let x = 0; x < COLS; x++) if (x !== 5) g[y][x] = 'J';
    const s = playing(g, I(3, 20, 1));
    const r = hardDrop(s);
    expect(r.lines).toBe(4);
    expect(r.score).toBe(32 + 800);
    const fx = r.fx.find((f) => f.kind === 'clear')!;
    expect(fx.label).toBe('TETRIS');
    expect(fx.sfx).toBe('tetris');
    expect(r.combo).toBe(1);
  });

  it('chained Tetris earn b2b x1.5 and a combo bonus', () => {
    // One 8-row-deep gap in column 5: each vertical I drops to the bottom of it,
    // and every clear drops the next gap down into place for the following piece.
    const g = emptyGrid();
    for (const y of [32, 33, 34, 35, 36, 37, 38, 39]) {
      for (let x = 0; x < COLS; x++) if (x !== 5) g[y][x] = 'J';
    }
    const s0 = createGame({ seed: 1, queue: ['I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I'] });
    let s: GameState = { ...s0, phase: 'playing', grid: g, active: spawnPiece('I') };
    s = rotate(s, 1);
    s = consumeFx(hardDrop(s)); // tetris #1: 800 + 32 drop; renderer consumed its fx
    expect(s.lines).toBe(4);
    expect(s.score).toBe(32 + 800);
    s = rotate(s, 1); // fresh I spawns in the same column
    s = hardDrop(s); // tetris #2: 1200 (b2b) + 50 (combo) + 32 drop
    expect(s.phase).toBe('playing');
    expect(s.lines).toBe(8);
    expect(s.combo).toBe(2);
    expect(s.backToBack).toBe(true);
    expect(s.score).toBe(832 + 32 + 1250);
    const fx = s.fx.find((f) => f.kind === 'clear')!; // unconsumed: label still readable
    expect(fx.label).toBe('TETRIS \u00b7 B2B');
  });

  it('levels up every 10 lines', () => {
    const g = gridFull([39]);
    const s = playing(g, I(1, 20, 3), { lines: 9 });
    const r = hardDrop(s);
    expect(r.lines).toBe(10);
    expect(r.level).toBe(2);
    expect(r.fx.some((f) => f.kind === 'levelup' && f.level === 2)).toBe(true);
  });

  it('scores at the pre-clear level after a level-up', () => {
    const g = gridFull([39]);
    const s = playing(g, I(1, 20, 3), { lines: 9, level: 1 });
    const r = hardDrop(s);
    expect(r.score).toBe(15 * 2 + 100); // 15 rows dropped, scored at level 1
  });

  it('resets combo and b2b on a lock that clears nothing', () => {
    const s = playing(undefined, T(3, 30), { combo: 3, backToBack: true });
    const r = lockActive(s);
    expect(r.combo).toBe(0);
    expect(r.backToBack).toBe(false);
    expect(r.fx).toHaveLength(0);
  });
});

describe('tspinCorners', () => {
  it('full: 3 corners with both front corners (rot 0, nub up)', () => {
    const g = emptyGrid();
    g[20][4] = 'J'; // NW
    g[20][6] = 'L'; // NE
    g[22][4] = 'S'; // SW (SE empty -> 3 corners)
    expect(tspinCorners(g, T(4, 20, 0))).toEqual({ full: true, mini: false });
  });

  it('mini: 3 corners with exactly one front corner', () => {
    const g = emptyGrid();
    g[20][4] = 'J'; // NW (front)
    g[22][4] = 'S'; // SW (back)
    g[22][6] = 'L'; // SE (back)
    expect(tspinCorners(g, T(4, 20, 0))).toEqual({ full: false, mini: true });
  });

  it('none: fewer than 3 corners', () => {
    const g = emptyGrid();
    g[20][4] = 'J';
    g[20][6] = 'L';
    expect(tspinCorners(g, T(4, 20, 0))).toEqual({ full: false, mini: false });
  });

  it('walls count as filled corners', () => {
    // A T against the left wall, floor two rows below: both back corners (SW, SE)
    // are out of bounds and count as filled per the 3-corner rule.
    const g = emptyGrid();
    g[38][2] = 'L'; // NE + both floor corners = 3 corners, one front (SW wall) -> mini
    expect(tspinCorners(g, T(0, 38, 3))).toEqual({ full: false, mini: true });
    g[38][0] = 'J'; // NW too: both front corners (NW, SW) filled -> full
    expect(tspinCorners(g, T(0, 38, 3))).toEqual({ full: true, mini: false });
  });

  it('ignores non-T pieces', () => {
    expect(tspinCorners(emptyGrid(), I(4, 20, 0))).toEqual({ full: false, mini: false });
  });
});

describe('hold', () => {
  function seededPlay() {
    const s0 = createGame({ seed: 99, queue: ['T', 'I', 'S', 'Z', 'J', 'L', 'O', 'T'] });
    const s: GameState = { ...s0, phase: 'playing', active: spawnPiece('T'), queue: s0.queue.slice(1) };
    return s;
  }

  it('first hold stashes the active piece and spawns the next', () => {
    const s = holdPiece(seededPlay());
    expect(s.hold).toBe('T');
    expect(s.active!.kind).toBe('I');
    expect(s.holdLocked).toBe(true);
    expect(s.queue[0]).toBe('S');
  });

  it('a second hold is refused until the piece locks', () => {
    const s = holdPiece(seededPlay());
    expect(holdPiece(s)).toBe(s);
  });

  it('after a lock, the hold swaps back', () => {
    // Queue after seeding: active T, then I, S, ... Hold swaps T for I; the I
    // locks; the next hold swaps the locked I's successor (S) back into the hold.
    let s = holdPiece(seededPlay());
    s = { ...s, active: { ...s.active!, y: 38 } as ActivePiece }; // I resting on floor
    s = hardDrop(s);
    expect(s.holdLocked).toBe(false);
    expect(s.active!.kind).toBe('S'); // next queue piece spawned after the lock
    s = holdPiece(s);
    expect(s.hold).toBe('S'); // no queue consumption on a swap
    expect(s.active!.kind).toBe('T');
    expect(s.holdLocked).toBe(true);
  });

  it('holding into a blocked spawn is a blockout game over', () => {
    const g = gridFull([20, 21, 22]);
    const s: GameState = {
      ...createGame({ seed: 4 }),
      phase: 'playing',
      grid: g,
      active: spawnPiece('S'),
      hold: 'T',
      queue: [],
    };
    const r = holdPiece(s);
    expect(r.phase).toBe('over');
    expect(r.overReason).toBe('blockout');
    expect(r.fx[r.fx.length - 1]).toMatchObject({ kind: 'gameover', reason: 'blockout' });
  });

  it('spawn into a full top zone is a blockout', () => {
    const s = spawn({ ...createGame({ seed: 4 }), phase: 'playing', grid: gridFull([20, 21, 22]) });
    expect(s.phase).toBe('over');
    expect(s.overReason).toBe('blockout');
  });
});

describe('game over: lockout', () => {
  it('locks out when the piece finishes in the hidden zone', () => {
    const s = playing(undefined, T(3, 18)); // rows 18 & 19: fully hidden
    const r = lockActive(s);
    expect(r.phase).toBe('over');
    expect(r.overReason).toBe('lockout');
    expect(r.fx[r.fx.length - 1].kind).toBe('gameover');
  });

  it('a clear that pulls the hidden cell back into view survives', () => {
    const g = emptyGrid();
    for (let x = 0; x < COLS; x++) if (x !== 3 && x !== 4 && x !== 5) g[20][x] = 'J';
    const s = playing(g, T(3, 19)); // rows 19 (hidden) & 20 (visible slot)
    const r = lockActive(s);
    expect(r.phase).toBe('playing');
    expect(r.lines).toBe(1);
    // The hidden-row cell shifted down into the visible field:
    expect(r.grid[20][4]).toBe('T');
  });
});

describe('pause', () => {
  it('toggles playing <-> paused', () => {
    const s = startGame(createGame({ seed: 8 }));
    const p = pauseToggle(s);
    expect(p.phase).toBe('paused');
    expect(pauseToggle(p).phase).toBe('playing');
  });

  it('is a no-op in the menu', () => {
    const s = createGame({ seed: 8 });
    expect(pauseToggle(s)).toBe(s);
  });
});

describe('consumeFx', () => {
  it('clears emitted fx and is idempotent when empty', () => {
    const withFx = { ...createGame({ seed: 8 }), fx: [{ kind: 'harddrop' as const, piece: T(3, 20), sfx: 'harddrop' as const }] };
    expect(consumeFx(withFx).fx).toHaveLength(0);
    const quiet = createGame({ seed: 8 });
    expect(consumeFx(quiet)).toBe(quiet); // no fx -> same reference, zero churn
  });
});

describe('board helpers', () => {
  it('pieceCells maps box cells to board coordinates', () => {
    expect(pieceCells(T(3, 20, 0))).toEqual([
      { x: 4, y: 20 },
      { x: 3, y: 21 },
      { x: 4, y: 21 },
      { x: 5, y: 21 },
    ]);
  });

  it('I piece rotation states match the SRS spec', () => {
    const norm = (c: number[][]) => c.map((p) => [...p].sort((a, b) => a - b)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    expect(norm(PIECE_CELLS.I[1])).toEqual(norm([[2, 0], [2, 1], [2, 2], [2, 3]]));
    expect(norm(PIECE_CELLS.I[3])).toEqual(norm([[1, 0], [1, 1], [1, 2], [1, 3]]));
  });

  it('T piece rotation states match the SRS spec', () => {
    const norm = (c: number[][]) => c.map((p) => [...p].sort((a, b) => a - b)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    expect(norm(PIECE_CELLS.T[1])).toEqual(norm([[1, 0], [1, 1], [2, 1], [1, 2]]));
    expect(norm(PIECE_CELLS.T[2])).toEqual(norm([[0, 1], [1, 1], [2, 1], [1, 2]]));
  });

  it('canMove/merge/isGrounded behave', () => {
    const g = emptyGrid();
    const p = T(3, 38);
    expect(canMove(g, p, 0, 1)).toBeNull();
    expect(isGrounded(g, p)).toBe(true);
    const merged = merge(g, p);
    expect(merged[38][4]).toBe('T');
    expect(merged[39][3]).toBe('T');
    expect(merged[39][5]).toBe('T');
    expect(g[38][4]).toBeNull(); // original untouched
  });

  it('dropY finds the resting row', () => {
    expect(dropY(emptyGrid(), I(3, 20, 1))).toBe(36);
    expect(dropY(emptyGrid(), T(3, 20))).toBe(38);
    expect(dropY(emptyGrid(), { kind: 'O', rot: 0, x: 3, y: 20 })).toBe(38);
  });
});
