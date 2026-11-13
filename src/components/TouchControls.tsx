import { useEffect, useRef } from 'react';

export type TouchAction = 'left' | 'right' | 'down' | 'softOff' | 'cw' | 'ccw' | 'hard' | 'hold';

/**
 * On-screen controls for touch devices (CSS hides them on fine pointers).
 * Held directional buttons auto-repeat; discrete actions fire per tap.
 */
export function TouchControls({ onAction }: { onAction: (a: TouchAction) => void }) {
  const timer = useRef<number | null>(null);
  const stop = () => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => stop, []);

  const press = (a: TouchAction) => {
    onAction(a);
    stop();
    if (a === 'left' || a === 'right' || a === 'down') {
      timer.current = window.setInterval(() => onAction(a), 110);
    }
  };

  const btn = (label: string, a: TouchAction, cls?: string) => (
    <button
      key={a}
      type="button"
      className={`touch-btn ${cls ?? ''}`}
      aria-label={a}
      onPointerDown={(e) => {
        e.preventDefault();
        press(a);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      {label}
    </button>
  );

  return (
    <div className="touch-controls">
      <div className="touch-row">
        {btn('\u25c0', 'left')}
        {btn('\u21ba', 'ccw')}
        {btn('\u25bc', 'down')}
        {btn('\u21bb', 'cw')}
        {btn('\u2b06', 'hard')}
      </div>
      <div className="touch-row touch-row2">{btn('HOLD', 'hold', 'wide')}</div>
    </div>
  );
}
