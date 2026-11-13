import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, type RenderResult } from '@testing-library/react';
import { TouchControls, type TouchAction } from './TouchControls';

let rendered: RenderResult;
let actions: TouchAction[];
let onAction: (a: TouchAction) => void;

beforeEach(() => {
  vi.useFakeTimers();
  actions = [];
  onAction = (a: TouchAction) => {
    actions.push(a);
  };
});

afterEach(() => {
  rendered?.unmount();
  vi.useRealTimers();
});

function btn(label: string): HTMLElement {
  const el = rendered.container.querySelector(`.touch-btn[aria-label="${label}"]`);
  if (el === null) throw new Error(`no touch button with aria-label "${label}"`);
  return el as HTMLElement;
}

function pointer(el: HTMLElement, type: 'pointerdown' | 'pointerup'): void {
  act(() => {
    // jsdom has no PointerEvent; React routes listeners by event-type string,
    // so a MouseEvent typed 'pointerdown' still reaches onPointerDown.
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
  });
}

describe('TouchControls', () => {
  it('renders all seven action buttons, including both left AND right', () => {
    rendered = render(<TouchControls onAction={onAction} />);
    const labels = Array.from(rendered.container.querySelectorAll('.touch-btn')).map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['left', 'down', 'right', 'ccw', 'cw', 'hold', 'hard']);
  });

  it('fires right when the right button is pressed', () => {
    rendered = render(<TouchControls onAction={onAction} />);
    pointer(btn('right'), 'pointerdown');
    expect(actions).toEqual(['right']);
  });

  it('repeats a held direction every 110 ms and stops on release', () => {
    rendered = render(<TouchControls onAction={onAction} />);
    pointer(btn('right'), 'pointerdown');
    expect(actions).toEqual(['right']);
    vi.advanceTimersByTime(110);
    expect(actions).toEqual(['right', 'right']);
    vi.advanceTimersByTime(110 * 2);
    expect(actions).toEqual(['right', 'right', 'right', 'right']);
    pointer(btn('right'), 'pointerup');
    vi.advanceTimersByTime(500);
    expect(actions).toHaveLength(4); // release stops the repeat
  });

  it('latches soft drop while down is held and releases it on pointer up', () => {
    rendered = render(<TouchControls onAction={onAction} />);
    pointer(btn('down'), 'pointerdown');
    expect(actions[0]).toBe('down');
    expect(actions).not.toContain('softOff'); // latched while held
    pointer(btn('down'), 'pointerup');
    expect(actions).toEqual(['down', 'softOff']);
    vi.advanceTimersByTime(500);
    expect(actions).toHaveLength(2); // nothing further after release
  });

  it('switching from a held down to left releases soft drop and re-arms the repeat', () => {
    rendered = render(<TouchControls onAction={onAction} />);
    pointer(btn('down'), 'pointerdown');
    pointer(btn('left'), 'pointerdown');
    // the new press fires first; the stale soft-drop latch is released after it
    expect(actions.slice(0, 3)).toEqual(['down', 'left', 'softOff']);
    vi.advanceTimersByTime(110);
    expect(actions).toEqual(['down', 'left', 'softOff', 'left']); // left re-armed, down gone
  });

  it('fires discrete actions once per tap, with no repeat timer', () => {
    rendered = render(<TouchControls onAction={onAction} />);
    pointer(btn('cw'), 'pointerdown');
    pointer(btn('cw'), 'pointerup');
    pointer(btn('hard'), 'pointerdown');
    pointer(btn('hold'), 'pointerdown');
    pointer(btn('hold'), 'pointerup');
    vi.advanceTimersByTime(1000);
    expect(actions).toEqual(['cw', 'hard', 'hold']);
  });
});
