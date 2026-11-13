import { describe, expect, it } from 'vitest';
import { makeSfx } from '../audio/sfx';
import type { SfxName } from '../engine/types';
import { fakeAudio } from '../test/helpers';

const ALL_NAMES: SfxName[] = ['move', 'rotate', 'hold', 'harddrop', 'clear', 'tetris', 'tspin', 'levelup', 'gameover', 'start', 'pause'];

describe('makeSfx', () => {
  it('plays a distinct recipe per event name', () => {
    const { backend, freqs } = fakeAudio();
    const sfx = makeSfx(backend);
    sfx.play('clear');
    expect(freqs).toEqual([523.25, 659.25, 783.99]);
  });

  it('tetris plays a five-note arpeggio', () => {
    const { backend, freqs } = fakeAudio();
    makeSfx(backend).play('tetris');
    expect(freqs).toEqual([523.25, 659.25, 783.99, 1046.5, 1318.5]);
  });

  it('gameover plays a descending four-note motif', () => {
    const { backend, freqs } = fakeAudio();
    makeSfx(backend).play('gameover');
    expect(freqs).toEqual([392, 329.63, 261.63, 196]);
  });

  it('harddrop layers two oscillators', () => {
    const { backend, freqs } = fakeAudio();
    makeSfx(backend).play('harddrop');
    expect(freqs).toEqual([150, 90]);
  });

  it('muted output is silent', () => {
    const { backend, freqs } = fakeAudio();
    const sfx = makeSfx(backend);
    sfx.setMuted(true);
    for (const n of ALL_NAMES) sfx.play(n);
    expect(freqs).toEqual([]);
  });

  it('unmutes again', () => {
    const { backend, freqs } = fakeAudio();
    const sfx = makeSfx(backend);
    sfx.setMuted(true);
    sfx.setMuted(false);
    sfx.play('move');
    expect(freqs).toEqual([220]);
  });

  it('never throws when no AudioContext exists (jsdom / SSR)', () => {
    const sfx = makeSfx(null);
    for (const n of ALL_NAMES) sfx.play(n); // all no-ops
    expect(true).toBe(true);
  });

  it('every recipe name is implemented', () => {
    const { backend } = fakeAudio();
    const sfx = makeSfx(backend);
    for (const n of ALL_NAMES) expect(() => sfx.play(n)).not.toThrow();
  });
});
