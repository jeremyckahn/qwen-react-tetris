export type PieceKind = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
export type Cell = PieceKind | null;
export type Grid = Cell[][];
export type Rot = 0 | 1 | 2 | 3;

export interface ActivePiece {
  kind: PieceKind;
  rot: Rot;
  x: number;
  y: number;
}

export type Phase = 'menu' | 'playing' | 'paused' | 'over';
export type OverReason = 'lockout' | 'blockout';
export type Tspin = 'none' | 'mini' | 'full';

export type SfxName =
  | 'move'
  | 'rotate'
  | 'hold'
  | 'harddrop'
  | 'clear'
  | 'tetris'
  | 'tspin'
  | 'levelup'
  | 'gameover'
  | 'start'
  | 'pause';

/** Ephemeral visual/audio events emitted by the engine after significant actions. */
export type Fx =
  | {
      kind: 'clear';
      rows: number[];
      cells: Cell[][];
      /** Full grid snapshot before the clear (for the collapse animation). */
      preGrid: Grid;
      label: string;
      points: number;
      sfx: SfxName;
      combo: number;
      b2b: boolean;
      tspin: Tspin;
    }
  | { kind: 'harddrop'; piece: ActivePiece; sfx: SfxName }
  | { kind: 'levelup'; level: number; sfx: SfxName }
  | { kind: 'gameover'; reason: OverReason; sfx: SfxName };

export interface GameState {
  grid: Grid;
  active: ActivePiece | null;
  hold: PieceKind | null;
  /** True after a hold has been used on the current piece (one hold per piece). */
  holdLocked: boolean;
  /** Upcoming pieces; refilled from a fresh 7-bag as it is consumed. */
  queue: PieceKind[];
  phase: Phase;
  score: number;
  lines: number;
  level: number;
  /** Consecutive line-clear locks including the most recent lock; 0 = streak broken. */
  combo: number;
  /** The previous line-clear lock was b2b-eligible (T-spin w/ lines or Tetris). */
  backToBack: boolean;
  softDrop: boolean;
  gravityAcc: number;
  /** ms accumulated while the piece is resting (cannot fall). */
  lockAcc: number;
  /** Successful move/rotate lock-delay resets for the current piece. */
  lockResets: number;
  lastAction: 'none' | 'move' | 'rotate';
  overReason: OverReason | null;
  fx: Fx[];
  rng: () => number;
}

export interface EngineOptions {
  /** Deterministic seed for the 7-bag (mulberry32). Ignored if `rng` is given. */
  seed?: number;
  /** Custom RNG for the 7-bag. Defaults to Math.random. */
  rng?: () => number;
  /** Seed the next-piece queue (useful for tests / attract mode). */
  queue?: PieceKind[];
}
