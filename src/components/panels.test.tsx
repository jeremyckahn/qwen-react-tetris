import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { HoldPanel, NextPanel, StatsPanel } from './panels';

describe('StatsPanel', () => {
  it('renders formatted score and raw counters', () => {
    const { container } = render(<StatsPanel score={1234567} level={8} lines={123} combo={0} best={2000000} />);
    expect(container.textContent).toContain('1,234,567');
    expect(container.textContent).toContain('2,000,000');
    expect(container.querySelector('.score-stat .stat-value')?.textContent).toBe('1,234,567');
  });

  it('shows a dash for no combo and xN once the streak is live', () => {
    const { container } = render(<StatsPanel score={0} level={1} lines={0} combo={0} best={0} />);
    const comboVal = Array.from(container.querySelectorAll('.stat')).find((s) => s.textContent?.includes('Combo'))!;
    expect(comboVal.querySelector('.stat-value')?.textContent).toBe('\u2014');

    const hot = render(<StatsPanel score={0} level={1} lines={0} combo={3} best={0} />);
    const hotVal = Array.from(hot.container.querySelectorAll('.stat')).find((s) => s.textContent?.includes('Combo'))!;
    expect(hotVal.querySelector('.stat-value')?.textContent).toBe('\u00d72');
    expect(hotVal.className).toContain('combo-hot');
  });
});

describe('NextPanel', () => {
  it('shows the next five pieces, first one highlighted and larger', () => {
    const { container } = render(<NextPanel kinds={['O', 'O', 'O', 'O', 'O', 'O']} />);
    const pieces = Array.from(container.querySelectorAll('.mini-piece')) as HTMLElement[];
    expect(pieces).toHaveLength(5); // capped, even if more queued
    expect(pieces[0].className).toContain('mini-hot');
    expect(pieces[1].className).not.toContain('mini-hot');
    expect(pieces[0].style.width).toBe('30px'); // 2 cols x 15px cell
    expect(pieces[1].style.width).toBe('24px'); // 2 cols x 12px cell
  });

  it('renders nothing for an empty queue', () => {
    const { container } = render(<NextPanel kinds={[]} />);
    expect(container.querySelectorAll('.mini-piece')).toHaveLength(0);
  });
});

describe('HoldPanel', () => {
  it('shows a placeholder when empty', () => {
    const { container } = render(<HoldPanel kind={null} disabled={false} />);
    expect(container.querySelector('.mini-slot .mini-empty')?.textContent).toBe('-');
  });

  it('renders the held piece', () => {
    const { container } = render(<HoldPanel kind="I" disabled={false} />);
    expect((container.querySelector('.mini-piece') as HTMLElement).dataset.kind).toBe('I');
  });

  it('marks the panel disabled after a hold lock', () => {
    const { container } = render(<HoldPanel kind="L" disabled />);
    expect(container.querySelector('.panel.hold')!.className).toContain('hold-disabled');
  });
});
