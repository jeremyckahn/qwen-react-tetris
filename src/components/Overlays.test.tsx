import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Overlays, type OverlayData } from './Overlays';

const base: OverlayData = {
  phase: 'menu',
  score: 12345,
  lines: 7,
  level: 3,
  best: 99999,
  newBest: false,
  overReason: null,
};

describe('Overlays', () => {
  it('menu shows the title, tagline and start button', () => {
    const { container } = render(<Overlays d={base} onStart={() => {}} onResume={() => {}} />);
    expect(container.querySelector('.title-neon')?.textContent).toBe('TETRIS');
    expect(container.querySelector('.tagline')?.textContent).toContain('SRS wall kicks');
    const btn = container.querySelector('button');
    expect(btn?.textContent).toBe('START GAME');
  });

  it('menu start button calls onStart', () => {
    const onStart = vi.fn();
    const { container } = render(<Overlays d={base} onStart={onStart} onResume={() => {}} />);
    container.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('playing renders nothing', () => {
    const { container } = render(<Overlays d={{ ...base, phase: 'playing' }} onStart={() => {}} onResume={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('paused shows PAUSED and a resume control', () => {
    const onResume = vi.fn();
    const { container } = render(<Overlays d={{ ...base, phase: 'paused' }} onStart={() => {}} onResume={onResume} />);
    expect(container.querySelector('.pause-title')?.textContent).toBe('PAUSED');
    const btn = container.querySelector('button')!;
    expect(btn.textContent).toBe('RESUME');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('game over shows the reason, stats and restart', () => {
    const onStart = vi.fn();
    const { container } = render(
      <Overlays d={{ ...base, phase: 'over', overReason: 'lockout', newBest: true }} onStart={onStart} onResume={() => {}} />,
    );
    expect(container.querySelector('.over-title')?.textContent).toBe('GAME OVER');
    expect(container.querySelector('.over-reason')?.textContent).toBe('locked out in the hidden zone');
    expect(container.querySelector('.new-best')?.textContent).toContain('NEW HIGH SCORE');
    expect(container.textContent).toContain('12,345');
    expect(container.textContent).toContain('99,999');
    const btn = container.querySelector('button')!;
    expect(btn.textContent).toBe('PLAY AGAIN');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('game over explains a blockout', () => {
    const { container } = render(
      <Overlays d={{ ...base, phase: 'over', overReason: 'blockout' }} onStart={() => {}} onResume={() => {}} />,
    );
    expect(container.querySelector('.over-reason')?.textContent).toBe('spawn blocked');
    expect(container.querySelector('.new-best')).toBeNull();
  });
});
