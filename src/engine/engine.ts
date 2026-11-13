import { canMove, clearRows, collides, dropY, emptyGrid, isGrounded, merge, pieceCells, spawnPiece, tryRotate, tspinCorners } from './board';
import { ALL, LOCK_DELAY, MAX_LOCK_RESETS, NEXT_COUNT, SOFT_INTERVAL, VISIBLE_TOP, gravityMs } from './constants';
import { mulberry32, shuffled } from './random';
import { scoreClear } from './scoring';
import type { ActivePiece, EngineOptions, GameState, SfxName, Tspin } from './types';

function ensureQueue(s: GameState): void {
  while (s.queue.length < NEXT_COUNT + 2) {
    s.queue.push(...shuffled(ALL, s.rng));
  }
}

/** Creates a fresh game in the menu phase (empty board, pre-rolled next queue). */
export function createGame(o: EngineOptions = {}): GameState {
  const rng = o.rng ?? (o.seed !== undefined ? mulberry32(o.seed) : Math.random);
  const s: GameState = {
    grid: emptyGrid(),
    active: null,
    hold: null,
    holdLocked: false,
    queue: o.queue ? o.queue.slice() : [],
    phase: 'menu',
    score: 0,
    lines: 0,
    level: 1,
    combo: 0,
    backToBack: false,
    softDrop: false,
    gravityAcc: 0,
    lockAcc: 0,
    lockResets: 0,
    lastAction: 'none',
    overReason: null,
    fx: [],
    rng,
  };
  ensureQueue(s);
  return s;
}

/**
 * Draws the next piece and spawns it at the top of the field.
 * A spawn that immediately collides is a blockout game over.
 * (The new piece gets a fresh lock delay; hold permission is untouched,
 *  callers set `holdLocked` per the guideline "one hold per piece" rule.)
 */
export function spawn(st: GameState): GameState {
  ensureQueue(st);
  const kind = st.queue.shift()!;
  ensureQueue(st);
  const active = spawnPiece(kind);
  const s: GameState = { ...st, active, lockResets: 0, lockAcc: 0, gravityAcc: 0 };
  if (collides(s.grid, active)) {
    return {
      ...s,
      phase: 'over',
      overReason: 'blockout',
      fx: [...s.fx, { kind: 'gameover', reason: 'blockout', sfx: 'gameover' as SfxName }],
    };
  }
  return s;
}

/** Starts (or restarts) a run on a fresh board. No-op while playing. */
export function startGame(st: GameState): GameState {
  if (st.phase === 'playing') return st;
  const fresh = createGame({ rng: st.rng });
  return spawn({ ...fresh, phase: 'playing' });
}

export function pauseToggle(st: GameState): GameState {
  if (st.phase === 'playing') return { ...st, phase: 'paused' };
  if (st.phase === 'paused') return { ...st, phase: 'playing' };
  return st;
}

/**
 * Lock-delay bookkeeping after a successful move/rotate:
 * resting pieces reset the 500ms timer (max 15 resets, then it stops resetting);
 * airborne pieces arm the timer from zero.
 */
function applyGroundedReset(s: GameState): GameState {
  const a = s.active!;
  if (!isGrounded(s.grid, a)) return { ...s, lockAcc: 0 };
  if (s.lockResets >= MAX_LOCK_RESETS) return s;
  return { ...s, lockAcc: 0, lockResets: s.lockResets + 1 };
}

export function move(st: GameState, dx: -1 | 1): GameState {
  if (st.phase !== 'playing' || !st.active) return st;
  const np = canMove(st.grid, st.active, dx, 0);
  if (!np) return st;
  return applyGroundedReset({ ...st, active: np, lastAction: 'move' });
}

/** dir: 1 = CW, -1 = CCW, 2 = 180. Failed rotations leave state unchanged. */
export function rotate(st: GameState, dir: 1 | -1 | 2): GameState {
  if (st.phase !== 'playing' || !st.active) return st;
  const np = tryRotate(st.grid, st.active, dir);
  if (!np) return st;
  return applyGroundedReset({ ...st, active: np, lastAction: 'rotate' });
}

/** 180° rotation as two successive 90° rotations (each with its own kicks). */
export function rotateHalf(st: GameState): GameState {
  const once = rotate(st, 1);
  if (once === st) return st;
  return rotate(once, 1);
}

export function setSoftDrop(st: GameState, on: boolean): GameState {
  if (st.softDrop === on) return st;
  return { ...st, softDrop: on };
}

/**
 * Guideline hold: one hold per piece. First use stashes the active piece and
 * spawns the next; afterwards the active piece swaps with the hold slot
 * (no queue consumption). Holding into a blocked spawn is a blockout.
 */
export function holdPiece(st: GameState): GameState {
  if (st.phase !== 'playing' || !st.active || st.holdLocked) return st;
  if (st.hold === null) {
    const spawned = spawn({ ...st, hold: st.active.kind });
    return { ...spawned, holdLocked: true };
  }
  const incoming = st.hold;
  const s: GameState = { ...st, hold: st.active.kind, holdLocked: true };
  const active = spawnPiece(incoming);
  if (collides(s.grid, active)) {
    return {
      ...s,
      active,
      phase: 'over',
      overReason: 'blockout',
      fx: [...s.fx, { kind: 'gameover', reason: 'blockout', sfx: 'gameover' as SfxName }],
    };
  }
  return { ...s, active, lockResets: 0, lockAcc: 0, gravityAcc: 0, lastAction: 'none' };
}

/**
 * Advances gravity and lock delay by dt ms.
 * Soft drop caps gravity at SOFT_INTERVAL and pays +1 per fallen row.
 */
export function tick(st: GameState, dt: number): GameState {
  if (st.phase !== 'playing' || !st.active) return st;
  const interval = st.softDrop ? Math.min(gravityMs(st.level), SOFT_INTERVAL) : gravityMs(st.level);
  let acc = st.gravityAcc + dt;
  let active = st.active;
  let fell = 0;
  while (acc >= interval) {
    acc -= interval;
    const np = canMove(st.grid, active, 0, 1);
    if (!np) break;
    active = np;
    fell++;
  }
  let s: GameState = { ...st, active, gravityAcc: acc };
  if (isGrounded(s.grid, active)) {
    // A piece that just fell gets a fresh lock window; otherwise keep counting.
    const lockAcc = (fell > 0 ? 0 : s.lockAcc) + dt;
    s = { ...s, lockAcc };
    if (lockAcc >= LOCK_DELAY) s = doLock(s, active);
  } else {
    s = { ...s, lockAcc: 0 };
  }
  if (st.softDrop && fell > 0) s = { ...s, score: s.score + fell };
  return s;
}

/**
 * Hard drop: instant fall (+2 per row) and immediate lock.
 * Emits a harddrop fx in addition to any clear/levelup/gameover fx.
 */
export function hardDrop(st: GameState): GameState {
  if (st.phase !== 'playing' || !st.active) return st;
  const y = dropY(st.grid, st.active);
  const dist = y - st.active.y;
  const dropped: ActivePiece = { ...st.active, y };
  const landed: GameState = { ...st, active: dropped, score: st.score + dist * 2, gravityAcc: 0, lockAcc: 0 };
  const locked = doLock(landed, dropped);
  return { ...locked, fx: [{ kind: 'harddrop', piece: dropped, sfx: 'harddrop' as SfxName }, ...locked.fx] };
}

/**
 * Locks the active piece: merge, clear full rows, score (T-spin detection on
 * the pre-clear grid, back-to-back, combo, level-up), lockout check, respawn.
 */
export function lockActive(st: GameState): GameState {
  if (!st.active) return st;
  return doLock(st, st.active);
}

function doLock(st: GameState, active: ActivePiece): GameState {
  const merged = merge(st.grid, active);
  const { grid, rows, cells } = clearRows(merged);
  let s: GameState = { ...st, grid, active: null, holdLocked: false };

  if (rows.length > 0 || (active.kind === 'T' && st.lastAction === 'rotate')) {
    const corners = active.kind === 'T' && st.lastAction === 'rotate' ? tspinCorners(merged, active) : null;
    const tspin: Tspin = corners ? (corners.full ? 'full' : 'mini') : 'none';
    const cs = scoreClear({ level: st.level, lines: rows.length, tspin, prevCombo: st.combo, prevB2B: st.backToBack });
    if (cs.total > 0 || rows.length > 0) {
      s = { ...s, score: s.score + cs.total, lines: s.lines + rows.length, combo: cs.combo, backToBack: cs.newB2B };
      const sfx: SfxName = rows.length === 4 ? 'tetris' : tspin !== 'none' ? 'tspin' : 'clear';
      s = {
        ...s,
        fx: [
          ...s.fx,
          { kind: 'clear', rows, cells, preGrid: merged, label: cs.label, points: cs.total, sfx, combo: cs.combo, b2b: cs.b2b, tspin },
        ],
      };
      const newLevel = Math.floor(s.lines / 10) + 1;
      if (newLevel > s.level) {
        s = { ...s, level: newLevel, fx: [...s.fx, { kind: 'levelup', level: newLevel, sfx: 'levelup' }] };
      }
    }
  } else {
    s = { ...s, combo: 0, backToBack: false };
  }

  // Lockout: any surviving locked cell still inside the hidden zone after clears.
  const lockout = pieceCells(active).some(
    (c) => !rows.includes(c.y) && c.y + rows.filter((r) => r > c.y).length < VISIBLE_TOP,
  );
  if (lockout) {
    return {
      ...s,
      active,
      phase: 'over',
      overReason: 'lockout',
      fx: [...s.fx, { kind: 'gameover', reason: 'lockout', sfx: 'gameover' as SfxName }],
    };
  }
  return spawn(s);
}

/** The renderer consumes fx (spawns particles/popups); this discards them. */
export function consumeFx(st: GameState): GameState {
  return st.fx.length > 0 ? { ...st, fx: [] } : st;
}
