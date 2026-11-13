import { describe, expect, it } from 'vitest';
import { InputBuffer, type HDir } from './input';
import { ARR, DAS } from './constants';

/** Drive the buffer with fixed-size frames, collecting emitted moves. */
function pump(ib: InputBuffer, ms: number, dt = ARR): HDir[] {
  const out: HDir[] = [];
  for (let t = 0; t < ms; ) {
    const step = Math.min(dt, ms - t);
    out.push(...ib.update(step).moves);
    t += step;
  }
  return out;
}

describe('InputBuffer', () => {
  it('emits nothing until the DAS delay elapses', () => {
    const ib = new InputBuffer();
    expect(ib.press(-1)).toBe(true); // caller applies the immediate move
    expect(pump(ib, DAS - ARR, ARR)).toEqual([]); // still charging DAS
    expect(pump(ib, ARR, ARR)).toEqual([-1]); // DAS crossed, first ARR elapses
    expect(pump(ib, 1, ARR)).toEqual([]); // leftover fraction carries, no extra move
  });

  it('repeats once per ARR while held', () => {
    const ib = new InputBuffer();
    ib.press(1);
    expect(pump(ib, DAS - ARR, ARR)).toEqual([]);
    expect(pump(ib, ARR, ARR)).toEqual([1]);
    expect(pump(ib, ARR, ARR)).toEqual([1]);
    expect(pump(ib, ARR * 2, ARR)).toEqual([1, 1]);
  });

  it('re-arms DAS on a direction switch while the other key is held', () => {
    const ib = new InputBuffer();
    ib.press(-1);
    pump(ib, DAS, ARR); // charging left
    ib.press(1); // switch: right moves immediately, DAS re-armed
    expect(pump(ib, DAS, ARR)).toEqual([]); // right must charge a fresh DAS
    expect(pump(ib, 10, ARR)).toEqual([1]); // ...then repeats as right (28ms credit + 10)
  });

  it('releasing the active direction falls back to the other held key (re-armed)', () => {
    const ib = new InputBuffer();
    ib.press(-1);
    ib.press(1); // right is active
    pump(ib, DAS, ARR);
    ib.release(1); // fall back to left
    expect(pump(ib, DAS, ARR)).toEqual([]); // left re-arms DAS
    expect(pump(ib, 10, ARR)).toEqual([-1]);
  });

  it('re-pressing the same held direction does not re-arm', () => {
    const ib = new InputBuffer();
    ib.press(-1);
    pump(ib, DAS, ARR); // 28ms of ARR credit at the crossing
    expect(ib.press(-1)).toBe(false); // already held: no immediate move, no re-arm
    expect(pump(ib, 5, ARR)).toHaveLength(1); // original DAS completes on schedule
    expect(pump(ib, 33, ARR)).toHaveLength(1); // ...and the repeat cadence is intact
  });

  it('release of the only held direction idles the buffer', () => {
    const ib = new InputBuffer();
    ib.press(-1);
    pump(ib, DAS + ARR * 10, ARR);
    ib.release(-1);
    expect(pump(ib, 1000, ARR)).toEqual([]);
  });

  it('tracks soft drop state', () => {
    const ib = new InputBuffer();
    expect(ib.update(16).soft).toBe(false);
    ib.setSoft(true);
    expect(ib.update(16).soft).toBe(true);
    ib.setSoft(false);
    expect(ib.update(16).soft).toBe(false);
  });

  it('long held bursts stay proportional to time (no runaway)', () => {
    const ib = new InputBuffer();
    ib.press(1);
    const moves = pump(ib, 1000, 16);
    const expected = Math.max(0, Math.floor((1000 - DAS) / ARR));
    expect(moves.length).toBeGreaterThanOrEqual(expected - 1);
    expect(moves.length).toBeLessThanOrEqual(expected + 1);
    expect(moves.every((m) => m === 1)).toBe(true);
  });

  it('reset clears all state (pause / new game)', () => {
    const ib = new InputBuffer();
    ib.press(-1);
    ib.setSoft(true);
    pump(ib, DAS + ARR * 10, ARR);
    ib.reset();
    expect(pump(ib, 1000, ARR)).toEqual([]);
    expect(ib.update(16).soft).toBe(false);
  });
});
