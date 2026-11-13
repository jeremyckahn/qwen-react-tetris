import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, type RenderResult } from '@testing-library/react';
import App from '../App';

function key(k: string, opts: { repeat?: boolean } = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, repeat: opts.repeat ?? false });
}

function dispatchKey(k: string, opts?: { repeat?: boolean }): void {
  window.dispatchEvent(key(k, opts));
}

let rendered: RenderResult;

/** Hard-drop the current piece `n` times, acting around each dispatch. */
async function dropTimes(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      dispatchKey(' ');
    });
  }
}

beforeEach(() => {
  window.location.hash = '';
  localStorage.clear();
});

afterEach(() => {
  rendered?.unmount();
  window.location.hash = '';
});

describe('Game (integration)', () => {
  it('mounts into the menu with the board visible', async () => {
    rendered = render(<App />);
    expect(rendered.container.querySelector('canvas.board-canvas')).not.toBeNull();
    expect(rendered.container.querySelector('.title-neon')?.textContent).toBe('TETRIS');
    expect(rendered.container.textContent).toContain('START GAME');
  });

  it('starts a game from the menu and hides the overlay', async () => {
    rendered = render(<App />);
    const start = Array.from(rendered.container.querySelectorAll('button')).find((b) => b.textContent === 'START GAME')!;
    await act(async () => {
      start.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(rendered.container.querySelector('.overlay')).toBeNull();
    // a pause button appears in the HUD while playing
    expect(Array.from(rendered.container.querySelectorAll('button')).some((b) => b.textContent === '⏸ PAUSE')).toBe(true);
  });

  it('starts with Enter and hard-drops with Space', async () => {
    rendered = render(<App />);
    await act(async () => {
      dispatchKey('Enter');
    });
    expect(rendered.container.querySelector('.overlay')).toBeNull();
    await dropTimes(1); // must not throw; piece locks and respawns
    expect(rendered.container.querySelector('.overlay')).toBeNull();
  });

  it('pauses with P / Escape and resumes with P', async () => {
    rendered = render(<App />);
    await act(async () => {
      dispatchKey('Enter');
    });
    await act(async () => {
      dispatchKey('Escape');
    });
    expect(rendered.container.querySelector('.pause-title')?.textContent).toBe('PAUSED');
    await act(async () => {
      dispatchKey('p');
    });
    expect(rendered.container.querySelector('.overlay')).toBeNull();
    await act(async () => {
      dispatchKey('p');
    });
    expect(rendered.container.querySelector('.pause-title')).not.toBeNull();
  });

  it('toggles sound with M', async () => {
    rendered = render(<App />);
    const muteBtn = () =>
      Array.from(rendered.container.querySelectorAll('button')).find((b) => b.textContent?.includes('SOUND'))!;
    expect(muteBtn().textContent).toContain('SOUND ON');
    await act(async () => {
      dispatchKey('m');
    });
    expect(muteBtn().textContent).toContain('SOUND OFF');
    await act(async () => {
      dispatchKey('M');
    });
    expect(muteBtn().textContent).toContain('SOUND ON');
  });

  it('plays a full game to game over from a seeded run', async () => {
    window.location.hash = '#seed=20261112';
    rendered = render(<App />);
    await act(async () => {
      dispatchKey('Enter');
    });
    // Blind hard drops pile up in the spawn column; a fixed seed ends the run
    // deterministically (blockout or lockout) well before 40 pieces.
    for (let i = 0; i < 40; i++) {
      await act(async () => {
        dispatchKey(' ');
      });
      if (rendered.container.querySelector('.over-title')) break;
    }
    expect(rendered.container.querySelector('.over-title')?.textContent).toBe('GAME OVER');
    expect(rendered.container.querySelector('.over-reason')).not.toBeNull();
    expect(rendered.container.textContent).toContain('PLAY AGAIN');
  });

  it('restarts with Enter after game over', async () => {
    window.location.hash = '#seed=20261112';
    rendered = render(<App />);
    await act(async () => {
      dispatchKey('Enter');
    });
    for (let i = 0; i < 40; i++) {
      await act(async () => {
        dispatchKey(' ');
      });
      if (rendered.container.querySelector('.over-title')) break;
    }
    expect(rendered.container.querySelector('.over-title')).not.toBeNull();
    await act(async () => {
      dispatchKey('Enter');
    });
    expect(rendered.container.querySelector('.overlay')).toBeNull(); // back in a fresh game
  });

  it('persists the high score across games', async () => {
    window.location.hash = '#seed=20261112';
    rendered = render(<App />);
    await act(async () => {
      dispatchKey('Enter');
    });
    for (let i = 0; i < 40; i++) {
      await act(async () => {
        dispatchKey(' ');
      });
      if (rendered.container.querySelector('.over-title')) break;
    }
    const best = localStorage.getItem('qwen-tetris:best');
    expect(best).toBeTruthy();
    const unmounted = () => rendered.unmount();
    unmounted();
    rendered = render(<App />);
    expect(rendered.container.textContent).toContain(Number(best).toLocaleString());
  });

  it('ignores movement input while paused', async () => {
    window.location.hash = '#seed=20261112';
    rendered = render(<App />);
    await act(async () => {
      dispatchKey('Enter');
    });
    await act(async () => {
      dispatchKey('Escape');
    });
    await act(async () => {
      dispatchKey('ArrowLeft');
      dispatchKey('ArrowRight');
      dispatchKey(' ');
    });
    // still paused; overlay intact
    expect(rendered.container.querySelector('.pause-title')).not.toBeNull();
  });
});
