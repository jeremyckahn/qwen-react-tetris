import type { Tspin } from './types';

export interface ClearScore {
  /** Base points before the b2b multiplier. */
  base: number;
  /** Base x 1.5 when back-to-back applies. */
  points: number;
  b2b: boolean;
  /** Consecutive line-clear streak including this lock (0 if no lines cleared). */
  combo: number;
  /** 50 x level per combo step beyond the first clear of the streak. */
  comboBonus: number;
  total: number;
  label: string;
  /** Whether this clear keeps the back-to-back chain alive for the next clear. */
  newB2B: boolean;
}

const LINE_BASE = [0, 100, 300, 500, 800];
const FULL_TSPIN = [100, 800, 1200, 1600, 1600];
const MINI_TSPIN = [100, 200, 400, 400, 1600];
const LINE_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];

/** Back-to-back bonus applies to Tetris and T-spins that clear lines. */
export function b2bEligible(lines: number, tspin: Tspin): boolean {
  return lines === 4 || (tspin === 'full' && lines > 0);
}

/**
 * Pure guideline scoring for a lock:
 * line points, T-spin variants, x1.5 back-to-back, and combo (50 x level per step).
 */
export function scoreClear(o: {
  level: number;
  lines: number;
  tspin: Tspin;
  prevCombo: number;
  prevB2B: boolean;
}): ClearScore {
  const { level, lines, tspin, prevCombo, prevB2B } = o;
  const table = tspin === 'full' ? FULL_TSPIN : tspin === 'mini' ? MINI_TSPIN : LINE_BASE;
  const base = table[lines] ?? 0;
  const eligible = b2bEligible(lines, tspin);
  const b2b = eligible && prevB2B;
  const points = Math.round(base * (b2b ? 1.5 : 1));
  const combo = lines > 0 ? (prevCombo > 0 ? prevCombo + 1 : 1) : 0;
  const comboBonus = combo > 1 ? 50 * (combo - 1) * level : 0;
  const total = points + comboBonus;
  let label =
    tspin === 'none'
      ? LINE_NAMES[lines]
      : lines === 0
        ? tspin === 'mini'
          ? 'MINI T-SPIN'
          : 'T-SPIN'
        : tspin === 'mini'
          ? `MINI ${LINE_NAMES[lines]}`
          : `T-SPIN ${LINE_NAMES[lines]}`;
  if (b2b) label += ' \u00b7 B2B';
  return { base, points, b2b, combo, comboBonus, total, label, newB2B: eligible };
}
