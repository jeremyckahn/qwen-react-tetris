import type { OverReason, Phase } from '../engine/types';

export interface OverlayData {
  phase: Phase;
  score: number;
  lines: number;
  level: number;
  best: number;
  newBest: boolean;
  overReason: OverReason | null;
}

/** Full-board overlays for the menu / paused / game-over phases. */
export function Overlays({
  d,
  onStart,
  onResume,
}: {
  d: OverlayData;
  onStart: () => void;
  onResume: () => void;
}) {
  if (d.phase === 'playing') return null;

  if (d.phase === 'menu') {
    return (
      <div className="overlay" role="dialog" aria-label="Start screen">
        <div className="overlay-panel">
          <h2 className="title-neon">TETRIS</h2>
          <p className="tagline">
            {'seven-bag fairness \u00b7 SRS wall kicks \u00b7 ghost piece \u00b7 T-spins \u00b7 combos'}
          </p>
          <button type="button" className="btn primary" onClick={onStart}>
            START GAME
          </button>
          <p className="hint">
            or press <kbd>ENTER</kbd>
          </p>
        </div>
      </div>
    );
  }

  if (d.phase === 'paused') {
    return (
      <div className="overlay" role="dialog" aria-label="Paused">
        <div className="overlay-panel">
          <h2 className="pause-title">PAUSED</h2>
          <button type="button" className="btn primary" onClick={onResume}>
            RESUME
          </button>
          <p className="hint">
            <kbd>P</kbd> or <kbd>ESC</kbd>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay over" role="dialog" aria-label="Game over">
      <div className="overlay-panel">
        <h2 className="over-title">GAME OVER</h2>
        <p className="over-reason">{d.overReason === 'lockout' ? 'locked out in the hidden zone' : 'spawn blocked'}</p>
        <div className="over-stats">
          <div className="over-stat">
            <span className="over-label">Score</span>
            <span className="over-value">{d.score.toLocaleString()}</span>
          </div>
          <div className="over-stat">
            <span className="over-label">Lines</span>
            <span className="over-value">{d.lines}</span>
          </div>
          <div className="over-stat">
            <span className="over-label">Level</span>
            <span className="over-value">{d.level}</span>
          </div>
          <div className="over-stat">
            <span className="over-label">Best</span>
            <span className="over-value">{d.best.toLocaleString()}</span>
          </div>
        </div>
        {d.newBest && (
          <div className="new-best">
            {'\u2605 NEW HIGH SCORE \u2605'}
          </div>
        )}
        <button type="button" className="btn primary" onClick={onStart}>
          PLAY AGAIN
        </button>
        <p className="hint">
          or press <kbd>ENTER</kbd>
        </p>
      </div>
    </div>
  );
}
