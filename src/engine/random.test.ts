import { describe, expect, it } from 'vitest';
import { mulberry32, shuffled } from './random';
import { ALL } from './constants';

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds produce different streams', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const sa = Array.from({ length: 5 }, () => a());
    const sb = Array.from({ length: 5 }, () => b());
    expect(sa).not.toEqual(sb);
  });
});

describe('shuffled (7-bag)', () => {
  it('is a permutation of the input', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 50; i++) {
      const bag = shuffled(ALL, rng);
      expect(bag).toHaveLength(7);
      expect(bag.sort().join('')).toBe('IJLOSTZ');
    }
  });

  it('does not mutate the source array', () => {
    const src = ['T', 'I'] as const;
    shuffled(src, mulberry32(3));
    expect(src).toEqual(['T', 'I']);
  });

  it('varies the order across seeds', () => {
    const a = shuffled(ALL, mulberry32(11));
    const b = shuffled(ALL, mulberry32(22));
    expect(a.join('')).not.toBe(b.join(''));
  });
});
