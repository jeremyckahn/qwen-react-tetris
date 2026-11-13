import type { PieceKind } from './types';

export const COLS = 10;
export const ROWS = 40;
/** Rows 0..19 are the hidden buffer; pieces pop into view at VISIBLE_TOP. */
export const VISIBLE_TOP = 20;
export const VISIBLE_ROWS = ROWS - VISIBLE_TOP;

export const ALL: PieceKind[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

/** Spawn box position (guideline: pieces spawn at the top of the visible field). */
export const SPAWN_Y = VISIBLE_TOP;
export const SPAWN_X: Record<PieceKind, number> = { I: 3, J: 3, L: 3, O: 3, S: 3, T: 3, Z: 3 };
export const BOX_SIZE: Record<PieceKind, number> = { I: 4, J: 3, L: 3, O: 2, S: 3, T: 3, Z: 3 };

/** Rotation-state 0 (spawn) cells inside each piece's bounding box. */
const ROT0: Record<PieceKind, ReadonlyArray<readonly [number, number]>> = {
  I: [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
  ],
  J: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  L: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  O: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  S: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  T: [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  Z: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
};

/** Clockwise rotation inside the box: (x, y) -> (size - 1 - y, x). */
function rotateCW(cells: ReadonlyArray<readonly [number, number]>, size: number): [number, number][] {
  return cells.map(([x, y]) => [size - 1 - y, x]);
}

function buildRotations(kind: PieceKind): [number, number][][] {
  const size = BOX_SIZE[kind];
  const out: [number, number][][] = [ROT0[kind].map(([x, y]) => [x, y] as [number, number])];
  for (let i = 1; i < 4; i++) out.push(rotateCW(out[i - 1], size));
  return out;
}

/** All four SRS rotation states per piece, as cells of the bounding box. */
export const PIECE_CELLS: Record<PieceKind, [number, number][][]> = {
  I: buildRotations('I'),
  J: buildRotations('J'),
  L: buildRotations('L'),
  O: [0, 1, 2, 3].map(() => ROT0.O.map(([x, y]) => [x, y] as [number, number])),
  S: buildRotations('S'),
  T: buildRotations('T'),
  Z: buildRotations('Z'),
};

export type Kick = readonly [number, number]; // [dx, dy]; dy positive = down

const JLSTZ: Record<string, readonly Kick[]> = {
  '0>1': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '1>0': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '1>2': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '2>1': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '2>3': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '3>2': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '3>0': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '0>3': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '0>2': [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ],
  '2>0': [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ],
};

const I_KICKS: Record<string, readonly Kick[]> = {
  '0>1': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
  '1>0': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, 2],
  ],
  '1>2': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, -2],
    [2, 1],
  ],
  '2>1': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, 2],
    [-2, -1],
  ],
  '2>3': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, 2],
  ],
  '3>2': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
  '3>0': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, 2],
    [-2, -1],
  ],
  '0>3': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, -2],
    [2, 1],
  ],
  '0>2': [
    [0, 0],
    [0, 1],
    [0, -1],
    [-2, 0],
    [2, 0],
  ],
  '2>0': [
    [0, 0],
    [0, -1],
    [0, 1],
    [-2, 0],
    [2, 0],
  ],
};

const O_KICKS: Record<string, readonly Kick[]> = {
  '0>1': [[0, 0]],
  '1>0': [[0, 0]],
  '1>2': [[0, 0]],
  '2>1': [[0, 0]],
  '2>3': [[0, 0]],
  '3>2': [[0, 0]],
  '3>0': [[0, 0]],
  '0>3': [[0, 0]],
  '0>2': [[0, 0]],
  '2>0': [[0, 0]],
};

/** SRS wall-kick tables, keyed `${fromRot}>${toRot}`. */
export const KICKS: Record<PieceKind, Record<string, readonly Kick[]>> = {
  I: I_KICKS,
  J: JLSTZ,
  L: JLSTZ,
  S: JLSTZ,
  T: JLSTZ,
  Z: JLSTZ,
  O: O_KICKS,
};

export interface PieceColor {
  base: string;
  light: string;
  glow: string;
}

export const COLORS: Record<PieceKind, PieceColor> = {
  I: { base: '#22d3ee', light: '#a5f3fc', glow: '#06b6d4' },
  O: { base: '#facc15', light: '#fef08a', glow: '#eab308' },
  T: { base: '#c084fc', light: '#e9d5ff', glow: '#9333ea' },
  S: { base: '#4ade80', light: '#bbf7d0', glow: '#16a34a' },
  Z: { base: '#f87171', light: '#fecaca', glow: '#dc2626' },
  J: { base: '#60a5fa', light: '#bfdbfe', glow: '#2563eb' },
  L: { base: '#fb923c', light: '#fed7aa', glow: '#ea580c' },
};

/** Delayed auto-shift (DAS) and auto-repeat (ARR) in ms. */
export const DAS = 160;
export const ARR = 33;
/** Soft drop gravity interval (capped below normal gravity). */
export const SOFT_INTERVAL = 40;
/** Lock delay in ms once a piece rests on something. */
export const LOCK_DELAY = 500;
/** Max successful move/rotate resets before the lock delay stops resetting. */
export const MAX_LOCK_RESETS = 15;
/** How many upcoming pieces the HUD shows. */
export const NEXT_COUNT = 5;

/**
 * Guideline gravity: (0.8 - (level-1)*0.007)^(level-1) seconds per row,
 * clamped for very high levels. Values in ms, levels 1..20 (20+ clamps).
 */
const GRAVITY_TABLE: number[] = Array.from({ length: 20 }, (_, i) => {
  const level = i + 1;
  const base = Math.max(0.8 - (level - 1) * 0.007, 0.07);
  return Math.round(Math.pow(base, level - 1) * 1000);
});

export function gravityMs(level: number): number {
  if (level <= 1) return 1000;
  const l = Math.min(level, GRAVITY_TABLE.length);
  return GRAVITY_TABLE[l - 1];
}
