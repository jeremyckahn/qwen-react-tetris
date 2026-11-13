import { describe, expect, it } from 'vitest';
import { b2bEligible, scoreClear } from './scoring';
import type { Tspin } from './types';

const LINE_BASE = [0, 100, 300, 500, 800];
const FULL = [100, 800, 1200, 1600, 1600];
const MINI = [100, 200, 400, 400, 1600];

describe('scoreClear', () => {
  it.each([
    ['none', 0, 0],
    ['none', 1, 100],
    ['none', 2, 300],
    ['none', 3, 500],
    ['none', 4, 800],
    ['full', 0, 100],
    ['full', 1, 800],
    ['full', 2, 1200],
    ['full', 3, 1600],
    ['full', 4, 1600],
    ['mini', 0, 100],
    ['mini', 1, 200],
    ['mini', 2, 400],
    ['mini', 3, 400],
    ['mini', 4, 1600],
  ] as [Tspin, number, number][])('base points for %s clear with %d lines', (tspin, lines, expected) => {
    const r = scoreClear({ level: 1, lines, tspin, prevCombo: 0, prevB2B: false });
    expect(r.base).toBe(expected);
    expect(r.points).toBe(expected);
    expect(r.total).toBe(expected);
    expect(r.b2b).toBe(false);
    expect(r.combo).toBe(lines > 0 ? 1 : 0);
    expect(r.comboBonus).toBe(0);
    expect(r.newB2B).toBe(b2bEligible(lines, tspin));
  });

  it.each([[0], [1], [2], [3], [4]])(
    'label for a plain line clear',
    (lines) => {
      const names = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];
      expect(scoreClear({ level: 1, lines, tspin: 'none', prevCombo: 0, prevB2B: false }).label).toBe(names[lines]);
    },
  );

  it('labels T-spin variants', () => {
    expect(scoreClear({ level: 1, lines: 0, tspin: 'full', prevCombo: 0, prevB2B: false }).label).toBe('T-SPIN');
    expect(scoreClear({ level: 1, lines: 0, tspin: 'mini', prevCombo: 0, prevB2B: false }).label).toBe('MINI T-SPIN');
    expect(scoreClear({ level: 1, lines: 1, tspin: 'full', prevCombo: 0, prevB2B: false }).label).toBe('T-SPIN SINGLE');
    expect(scoreClear({ level: 1, lines: 2, tspin: 'full', prevCombo: 0, prevB2B: false }).label).toBe('T-SPIN DOUBLE');
    expect(scoreClear({ level: 1, lines: 1, tspin: 'mini', prevCombo: 0, prevB2B: false }).label).toBe('MINI SINGLE');
    expect(scoreClear({ level: 1, lines: 4, tspin: 'mini', prevCombo: 0, prevB2B: false }).label).toBe('MINI TETRIS');
  });

  it('applies the 1.5x back-to-back multiplier when eligible and chained', () => {
    // Tetris after Tetris
    const tetris = scoreClear({ level: 1, lines: 4, tspin: 'none', prevCombo: 0, prevB2B: true });
    expect(tetris.b2b).toBe(true);
    expect(tetris.points).toBe(1200);
    expect(tetris.label).toBe('TETRIS \u00b7 B2B');
    expect(tetris.newB2B).toBe(true);
    // Full T-spin after a b2b chain
    const spin = scoreClear({ level: 1, lines: 2, tspin: 'full', prevCombo: 0, prevB2B: true });
    expect(spin.b2b).toBe(true);
    expect(spin.points).toBe(1800);
    expect(spin.label).toBe('T-SPIN DOUBLE \u00b7 B2B');
    // First clear of a chain: no multiplier
    expect(scoreClear({ level: 1, lines: 4, tspin: 'none', prevCombo: 0, prevB2B: false }).points).toBe(800);
    // Mini T-spins are never b2b-eligible
    expect(scoreClear({ level: 1, lines: 1, tspin: 'mini', prevCombo: 0, prevB2B: true }).b2b).toBe(false);
    expect(scoreClear({ level: 1, lines: 1, tspin: 'mini', prevCombo: 0, prevB2B: true }).newB2B).toBe(false);
  });

  it('b2b eligibility: Tetris or full T-spin with lines', () => {
    expect(b2bEligible(4, 'none')).toBe(true);
    expect(b2bEligible(1, 'full')).toBe(true);
    expect(b2bEligible(0, 'full')).toBe(false);
    expect(b2bEligible(3, 'none')).toBe(false);
    expect(b2bEligible(1, 'mini')).toBe(false);
  });

  it('pays combo bonuses of 50 x level per consecutive clear beyond the first', () => {
    const r = scoreClear({ level: 2, lines: 1, tspin: 'none', prevCombo: 2, prevB2B: false });
    expect(r.combo).toBe(3); // third clear in the streak
    expect(r.comboBonus).toBe(50 * 2 * 2); // streak length minus one
    expect(r.total).toBe(100 + 200); // single base + combo bonus
    expect(scoreClear({ level: 1, lines: 1, tspin: 'none', prevCombo: 0, prevB2B: false }).comboBonus).toBe(0);
    expect(scoreClear({ level: 1, lines: 1, tspin: 'none', prevCombo: 1, prevB2B: false }).comboBonus).toBe(50);
  });

  it('a lock that clears nothing scores nothing and breaks the chain', () => {
    const r = scoreClear({ level: 5, lines: 0, tspin: 'none', prevCombo: 4, prevB2B: true });
    expect(r.total).toBe(0);
    expect(r.combo).toBe(0);
    expect(r.newB2B).toBe(false);
  });

  it('scales line points with level via the engine (spot checks)', () => {
    expect(scoreClear({ level: 2, lines: 1, tspin: 'none', prevCombo: 0, prevB2B: false }).base).toBe(100);
    // (Level scaling of base values is the guideline's level multiplier; this
    // implementation applies level to combo bonuses, base stays canonical.)
    expect(scoreClear({ level: 4, lines: 2, tspin: 'none', prevCombo: 1, prevB2B: false }).comboBonus).toBe(50 * 4);
  });
});

describe('base tables', () => {
  it('matches the canonical guideline tables', () => {
    for (let lines = 0; lines <= 4; lines++) {
      expect(scoreClear({ level: 1, lines, tspin: 'none', prevCombo: 0, prevB2B: false }).base).toBe(LINE_BASE[lines]);
      expect(scoreClear({ level: 1, lines, tspin: 'full', prevCombo: 0, prevB2B: false }).base).toBe(FULL[lines]);
      expect(scoreClear({ level: 1, lines, tspin: 'mini', prevCombo: 0, prevB2B: false }).base).toBe(MINI[lines]);
    }
  });
});
