import { COLS, KICKS, PIECE_CELLS, ROWS, SPAWN_X, SPAWN_Y } from './constants';
import type { ActivePiece, Cell, Grid, PieceKind, Rot } from './types';

export function emptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

export function pieceCells(p: { kind: PieceKind; rot: Rot; x: number; y: number }): Array<{ x: number; y: number }> {
  const cells = PIECE_CELLS[p.kind][p.rot];
  return cells.map(([cx, cy]) => ({ x: p.x + cx, y: p.y + cy }));
}

/** True if the piece fits at (x, y) in rotation `rot` (bounds + collisions). */
export function canPlace(grid: Grid, kind: PieceKind, rot: Rot, x: number, y: number): boolean {
  for (const [cx, cy] of PIECE_CELLS[kind][rot]) {
    const px = x + cx;
    const py = y + cy;
    if (px < 0 || px >= COLS || py < 0 || py >= ROWS) return false;
    if (grid[py][px]) return false;
  }
  return true;
}

export function collides(grid: Grid, p: { kind: PieceKind; rot: Rot; x: number; y: number }): boolean {
  return !canPlace(grid, p.kind, p.rot, p.x, p.y);
}

/** Returns the moved piece, or null if the move is blocked. */
export function canMove(grid: Grid, p: ActivePiece, dx: number, dy: number): ActivePiece | null {
  const np: ActivePiece = { kind: p.kind, rot: p.rot, x: p.x + dx, y: p.y + dy };
  return canPlace(grid, np.kind, np.rot, np.x, np.y) ? np : null;
}

/**
 * SRS rotation with wall kicks. dir: 1 = CW, -1 = CCW, 2 = 180.
 * Returns null when no kick offset works (O piece is a no-op by definition).
 */
export function tryRotate(grid: Grid, p: ActivePiece, dir: 1 | -1 | 2): ActivePiece | null {
  if (p.kind === 'O') return null;
  const to = ((((p.rot + dir) % 4) + 4) % 4) as Rot;
  const kicks = KICKS[p.kind][`${p.rot}>${to}`];
  if (!kicks) return null;
  for (const [dx, dy] of kicks) {
    if (canPlace(grid, p.kind, to, p.x + dx, p.y + dy)) {
      return { kind: p.kind, rot: to, x: p.x + dx, y: p.y + dy };
    }
  }
  return null;
}

/** True when the piece cannot move one row down. */
export function isGrounded(grid: Grid, p: ActivePiece): boolean {
  return !canPlace(grid, p.kind, p.rot, p.x, p.y + 1);
}

/** Lowest y the piece can rest at (ghost-piece position). */
export function dropY(grid: Grid, p: ActivePiece): number {
  let y = p.y;
  while (canPlace(grid, p.kind, p.rot, p.x, y + 1)) y++;
  return y;
}

/** Merges the piece into the grid, returning a new grid. */
export function merge(grid: Grid, p: ActivePiece): Grid {
  const g: Grid = grid.map((row) => row.slice());
  for (const { x, y } of pieceCells(p)) g[y][x] = p.kind;
  return g;
}

/**
 * Removes full rows (rows above shift down; empty rows prepend at the top).
 * Returns the new grid, the cleared row indices, and the cleared row contents
 * (needed for the renderer's collapse animation + particles).
 */
export function clearRows(grid: Grid): { grid: Grid; rows: number[]; cells: Cell[][] } {
  const rows: number[] = [];
  for (let y = 0; y < ROWS; y++) {
    if (grid[y].every((c) => c !== null)) rows.push(y);
  }
  if (rows.length === 0) return { grid, rows, cells: [] };
  const drop = new Set(rows);
  const cells = rows.map((y) => grid[y].slice());
  const kept: Grid = grid.filter((_, y) => !drop.has(y));
  while (kept.length < ROWS) kept.unshift(Array<Cell>(COLS).fill(null));
  return { grid: kept, rows, cells };
}

export function spawnPiece(kind: PieceKind): ActivePiece {
  return { kind, rot: 0, x: SPAWN_X[kind], y: SPAWN_Y };
}

export interface TspinInfo {
  full: boolean;
  mini: boolean;
}

/**
 * Guideline T-spin detection: 3 of the 4 corners around the T's 3x3 center
 * are occupied (walls count as occupied). Both *front* corners filled = full
 * T-spin, otherwise mini. Front = the two corners on the side the nub points.
 */
export function tspinCorners(grid: Grid, p: ActivePiece): TspinInfo {
  if (p.kind !== 'T') return { full: false, mini: false };
  const filled = (x: number, y: number): boolean =>
    x < 0 || x >= COLS || y < 0 || y >= ROWS ? true : grid[y][x] !== null;
  const nw = filled(p.x, p.y);
  const ne = filled(p.x + 2, p.y);
  const sw = filled(p.x, p.y + 2);
  const se = filled(p.x + 2, p.y + 2);
  const count = (nw ? 1 : 0) + (ne ? 1 : 0) + (sw ? 1 : 0) + (se ? 1 : 0);
  if (count < 3) return { full: false, mini: false };
  const front: [boolean, boolean] =
    p.rot === 0
      ? [nw, ne] // nub points up
      : p.rot === 1
        ? [ne, se] // nub points right
        : p.rot === 2
          ? [sw, se] // nub points down
          : [nw, sw]; // nub points left
  const frontCount = (front[0] ? 1 : 0) + (front[1] ? 1 : 0);
  return { full: frontCount === 2, mini: frontCount < 2 };
}
