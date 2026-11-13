import { useCallback, useEffect, useRef, useState } from 'react';
import {
  consumeFx,
  createGame,
  hardDrop,
  holdPiece,
  move,
  pauseToggle,
  rotate,
  setSoftDrop,
  startGame,
  tick,
} from '../engine/engine';
import { InputBuffer } from '../engine/input';
import type { GameState, OverReason, Phase, PieceKind, SfxName } from '../engine/types';
import { drawFrame } from '../render/draw';
import { createFx, onFx, type FxState } from '../render/fx';
import { BOARD_H, BOARD_W } from '../render/geom';
import { makeSfx, type Sfx } from '../audio/sfx';
import { HoldPanel, NextPanel, StatsPanel } from './panels';
import { Overlays, type OverlayData } from './Overlays';
import { TouchControls, type TouchAction } from './TouchControls';

const BEST_KEY = 'qwen-tetris:best';

function readBest(): number {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

function saveBest(n: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    // Storage unavailable (private mode) — high score just won't persist.
  }
}

/** `#seed=123` in the URL pins the 7-bag — shareable/replayable runs, testable UI. */
function seedFromHash(): number | undefined {
  try {
    const m = window.location.hash.match(/seed=(\d+)/);
    return m ? Number(m[1]) : undefined;
  } catch {
    return undefined;
  }
}

/** Small snapshot of engine state that the DOM HUD renders from. */
interface Hud {
  phase: Phase;
  score: number;
  level: number;
  lines: number;
  combo: number;
  hold: PieceKind | null;
  next: PieceKind[];
  best: number;
  newBest: boolean;
  overReason: OverReason | null;
  muted: boolean;
  canHold: boolean;
}

function toHud(st: GameState, best: number, newBest: boolean, muted: boolean): Hud {
  return {
    phase: st.phase,
    score: st.score,
    level: st.level,
    lines: st.lines,
    combo: st.combo,
    hold: st.hold,
    next: st.queue.slice(0, 5),
    best,
    newBest,
    overReason: st.overReason,
    muted,
    canHold: st.phase === 'playing' && !st.holdLocked && st.active !== null,
  };
}

function sameHud(a: Hud, b: Hud): boolean {
  return (
    a.phase === b.phase &&
    a.score === b.score &&
    a.level === b.level &&
    a.lines === b.lines &&
    a.combo === b.combo &&
    a.hold === b.hold &&
    a.best === b.best &&
    a.newBest === b.newBest &&
    a.overReason === b.overReason &&
    a.muted === b.muted &&
    a.canHold === b.canHold &&
    a.next.join('') === b.next.join('')
  );
}

export default function Game() {
  // Engine state lives in a ref and is mutated at frame rate; React only sees
  // a tiny HUD snapshot, so re-renders happen on score/phase changes, not 60/s.
  const stateRef = useRef<GameState | null>(null);
  if (stateRef.current === null) stateRef.current = createGame({ seed: seedFromHash() });
  const bestRef = useRef<number>(readBest());
  /** Best score at the start of the current run (for the "new high score" badge). */
  const runBestRef = useRef(0);
  const newBestRef = useRef(false);
  const fxRef = useRef<FxState>(createFx());
  const inputRef = useRef<InputBuffer>(new InputBuffer());
  const sfxRef = useRef<Sfx>(makeSfx(null));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [hud, setHud] = useState<Hud>(() => toHud(stateRef.current!, bestRef.current, false, false));
  const mutedRef = useRef(false);
  const [scale, setScale] = useState(1);

  const syncHud = useCallback((st: GameState) => {
    setHud((prev) => {
      const next = toHud(st, bestRef.current, newBestRef.current, mutedRef.current);
      return sameHud(prev, next) ? prev : next;
    });
  }, []);

  /** Best-score bookkeeping shared by the input path and the frame loop. */
  const commitBest = useCallback((s: GameState, prev: GameState) => {
    if (s.score > bestRef.current) bestRef.current = s.score;
    if (s.phase === 'over' && prev.phase !== 'over') {
      const isBest = s.score > runBestRef.current;
      newBestRef.current = isBest;
      if (isBest) saveBest(s.score);
    }
  }, []);

  /** Applies an engine action; plays result fx + sound when state actually changed. */
  const act = useCallback(
    (f: (s: GameState) => GameState, sfxName?: SfxName) => {
      const cur = stateRef.current;
      if (!cur) return;
      const after = f(cur);
      if (after === cur) return;
      let s = after;
      if (s.fx.length > 0) {
        for (const fx of s.fx) {
          onFx(fx, s, fxRef.current);
          sfxRef.current.play(fx.sfx);
        }
        s = consumeFx(s);
      }
      if (sfxName) sfxRef.current.play(sfxName);
      commitBest(s, cur);
      stateRef.current = s;
      syncHud(s);
    },
    [commitBest, syncHud],
  );

  const doStart = useCallback(() => {
    const st = stateRef.current;
    if (!st || (st.phase !== 'menu' && st.phase !== 'over')) return;
    inputRef.current.reset();
    runBestRef.current = bestRef.current;
    newBestRef.current = false;
    const s = startGame(st);
    stateRef.current = s;
    sfxRef.current.play('start');
    syncHud(s);
  }, [syncHud]);

  const doPause = useCallback(() => {
    const st = stateRef.current;
    if (!st || (st.phase !== 'playing' && st.phase !== 'paused')) return;
    const s = pauseToggle(st);
    stateRef.current = s;
    if (s.phase === 'paused') inputRef.current.reset();
    sfxRef.current.play('pause');
    syncHud(s);
  }, [syncHud]);

  const doMute = useCallback(() => {
    setHud((prev) => {
      mutedRef.current = !prev.muted;
      sfxRef.current.setMuted(mutedRef.current);
      return { ...prev, muted: mutedRef.current };
    });
  }, []);

  const onAction = useCallback(
    (a: TouchAction) => {
      if (a === 'left' || a === 'right') {
        const d: -1 | 1 = a === 'left' ? -1 : 1;
        if (inputRef.current.press(d)) act((s) => move(s, d), 'move');
        return;
      }
      if (a === 'down') {
        inputRef.current.setSoft(true);
        return;
      }
      if (a === 'softOff') {
        inputRef.current.setSoft(false);
        return;
      }
      if (a === 'cw') act((s) => rotate(s, 1), 'rotate');
      else if (a === 'ccw') act((s) => rotate(s, -1), 'rotate');
      else if (a === 'hard') act((s) => hardDrop(s));
      else if (a === 'hold') act((s) => holdPiece(s), 'hold');
    },
    [act],
  );

  // Keyboard controls.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === 'm' || k === 'M') {
        doMute();
        return;
      }
      if (k === 'Enter') {
        doStart();
        return;
      }
      if (k === 'p' || k === 'P' || k === 'Escape') {
        doPause();
        return;
      }
      if (e.repeat) return;
      switch (k) {
        case 'ArrowLeft':
          e.preventDefault();
          if (inputRef.current.press(-1)) act((s) => move(s, -1), 'move');
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (inputRef.current.press(1)) act((s) => move(s, 1), 'move');
          break;
        case 'ArrowDown':
          e.preventDefault();
          inputRef.current.setSoft(true);
          break;
        case 'ArrowUp':
        case 'x':
        case 'X':
          e.preventDefault();
          act((s) => rotate(s, 1), 'rotate');
          break;
        case 'z':
        case 'Z':
          act((s) => rotate(s, -1), 'rotate');
          break;
        case ' ':
          e.preventDefault();
          act((s) => hardDrop(s));
          break;
        case 'c':
        case 'C':
        case 'Shift':
          act((s) => holdPiece(s), 'hold');
          break;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') inputRef.current.release(-1);
      else if (e.key === 'ArrowRight') inputRef.current.release(1);
      else if (e.key === 'ArrowDown') inputRef.current.setSoft(false);
    };
    const onBlur = () => {
      inputRef.current.reset();
      if (stateRef.current?.phase === 'playing') doPause();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', onBlur);
    };
  }, [act, doStart, doPause, doMute]);

  // Main loop: advance input + engine, emit fx, draw, sync HUD.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(BOARD_W * dpr);
    canvas.height = Math.round(BOARD_H * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(Math.max(t - last, 0), 100);
      last = t;
      const st = stateRef.current;
      if (!st) return;
      let s = st;
      if (s.phase === 'playing') {
        const frame = inputRef.current.update(dt);
        if (frame.soft !== s.softDrop) s = setSoftDrop(s, frame.soft);
        for (const d of frame.moves) s = move(s, d);
        s = tick(s, dt);
        if (s.fx.length > 0) {
          for (const fx of s.fx) {
            onFx(fx, s, fxRef.current);
            sfxRef.current.play(fx.sfx);
          }
          s = consumeFx(s);
        }
        commitBest(s, st);
        stateRef.current = s;
        syncHud(s);
      }
      ctx.save();
      ctx.scale(dpr, dpr);
      drawFrame(ctx, s, fxRef.current, dt);
      ctx.restore();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [commitBest, syncHud]);

  // Responsive scale for the board + side panels.
  useEffect(() => {
    const update = () =>
      setScale(
        Math.max(0.5, Math.min(1, (window.innerHeight - 150) / (BOARD_H + 40), (window.innerWidth - 360) / (BOARD_W + 60))),
      );
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const overlayData: OverlayData = {
    phase: hud.phase,
    score: hud.score,
    lines: hud.lines,
    level: hud.level,
    best: hud.best,
    newBest: hud.newBest,
    overReason: hud.overReason,
  };

  return (
    <div className="app">
      <div className="bg-blob b1" aria-hidden />
      <div className="bg-blob b2" aria-hidden />
      <div className="stars" aria-hidden />

      <header className="app-header">
        <h1 className="app-title">
          QWEN<span>TETRIS</span>
        </h1>
        <p className="app-sub">neon guideline edition</p>
      </header>

      <div className="layout" style={{ transform: `scale(${scale})` }}>
        <div className="col side">
          <HoldPanel kind={hud.hold} disabled={!hud.canHold} />
          <div className="panel keys">
            <div className="panel-title">Controls</div>
            <div className="key-row">
              <span>
                <kbd>←</kbd>
                <kbd>→</kbd>
              </span>
              <span>move</span>
            </div>
            <div className="key-row">
              <span>
                <kbd>↓</kbd>
              </span>
              <span>soft drop</span>
            </div>
            <div className="key-row">
              <span>
                <kbd>↑</kbd>
                <kbd>X</kbd>
              </span>
              <span>rotate cw</span>
            </div>
            <div className="key-row">
              <span>
                <kbd>Z</kbd>
              </span>
              <span>rotate ccw</span>
            </div>
            <div className="key-row">
              <span>
                <kbd>SPACE</kbd>
              </span>
              <span>hard drop</span>
            </div>
            <div className="key-row">
              <span>
                <kbd>C</kbd>
              </span>
              <span>hold</span>
            </div>
            <div className="key-row">
              <span>
                <kbd>P</kbd>
              </span>
              <span>pause</span>
            </div>
            <div className="key-row">
              <span>
                <kbd>M</kbd>
              </span>
              <span>sound</span>
            </div>
          </div>
          <button type="button" className="btn ghost" onClick={doMute}>
            {hud.muted ? '🔇 SOUND OFF' : '🔊 SOUND ON'}
          </button>
          {hud.phase === 'playing' && (
            <button type="button" className="btn ghost" onClick={doPause}>
              ⏸ PAUSE
            </button>
          )}
        </div>

        <div className="board-wrap">
          <canvas
            ref={canvasRef}
            className="board-canvas"
            width={BOARD_W}
            height={BOARD_H}
            style={{ width: BOARD_W, height: BOARD_H }}
            aria-label="Tetris board"
          />
          <Overlays d={overlayData} onStart={doStart} onResume={doPause} />
        </div>

        <div className="col side right">
          <NextPanel kinds={hud.next} />
          <StatsPanel score={hud.score} level={hud.level} lines={hud.lines} combo={hud.combo} best={hud.best} />
        </div>
      </div>

      <TouchControls onAction={onAction} />
    </div>
  );
}
