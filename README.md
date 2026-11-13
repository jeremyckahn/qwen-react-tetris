# Qwen Tetris

A production-grade, neon-flavored **Tetris** built with React + Vite, implementing the
modern guideline ruleset: 7-bag randomizer, SRS wall kicks, ghost piece, hold, combos,
back-to-back, T-spins (full + mini), lock delay with move-reset, and level-scaled
gravity — with a juicy canvas renderer (particles, screen shake, flash, popups) and
WebAudio chiptune SFX.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

## Controls

| Key            | Action                          |
| -------------- | ------------------------------- |
| ← / →          | Move (DAS auto-shift)           |
| ↓              | Soft drop (1 pt/row, 2x speed)  |
| ↑ / X          | Rotate clockwise                |
| Z              | Rotate counter-clockwise        |
| Space          | Hard drop (2 pts/row)           |
| C / Shift      | Hold (one per piece)            |
| P / Esc        | Pause                           |
| M              | Mute / unmute                   |
| Enter          | Start / play again              |

On touch devices a control pad appears: ◀ ▼ ▶ move (hold to repeat),
↺ / ↻ rotate, ⬆ hard drop, and HOLD.
Append `#seed=123` to the URL to pin the 7-bag for a shareable, replayable run.

## Architecture

```
src/
  engine/    Pure, deterministic core — zero DOM, zero React, 100% unit-testable.
    constants.ts   Piece shapes (SRS), kick tables, timing, colors, scoring tables
    types.ts       Shared type vocabulary
    random.ts      mulberry32 RNG + Fisher–Yates 7-bag
    board.ts       Grid ops: collisions, move, SRS rotation w/ kicks, merge, clear
    scoring.ts     Guideline scoring: lines, T-spin matrix, b2b ×1.5, combos
    input.ts       Buffered input with DAS/ARR (directional auto-shift/repeat)
    engine.ts      State machine: start/pause/tick/move/rotate/hold/harddrop/lock
  render/    Canvas 2D at 60fps, decoupled from React's render cycle.
    geom.ts        Board geometry + DPI scaling
    draw.ts        Backdrop, grid, blocks, ghost, frame composition
    fx.ts          Particle/popups/shake/flash animation state
  audio/     WebAudio SFX synth (no assets; silent where unavailable)
  components/
    Game.tsx       Owns the engine ref + main loop; syncs a tiny HUD snapshot
    Overlays.tsx   Menu / pause / game-over screens
    panels.tsx     Hold, next-queue, stats panels
    MiniPiece.tsx  DOM-rendered preview pieces
    TouchControls.tsx  On-screen control pad for touch devices
```

The engine is a pure state machine: every action is a `(state) → state` function and
the only mutable escape hatches are the injected RNG. The React layer keeps state in a
ref, advances it at frame rate, and re-renders only when a small HUD snapshot
(score/level/lines/combo/hold/queue/phase) actually changes — so 60fps gameplay never
waits on React reconciliation.

## Rules implemented

- **7-bag** randomizer (each bag is a shuffled permutation of all 7 pieces)
- **SRS** rotation with the full kick tables (J/L/S/T/Z 5 offsets, I 8 offsets, O identity)
- **Ghost piece** (drop preview), **hold** with one-hold-per-piece rule
- **Lock delay**: 500ms while grounded, up to 15 resets on successful move/rotate
  (move-reset rule), hard drop locks instantly
- **Scoring**: guideline base table for singles/doubles/triples/tetrises, T-spin
  matrix (full + mini, 0-line = 100), back-to-back ×1.5 for Tetrises and full T-spins,
  combo bonus 50 × level per combo step beyond the first, soft drop 1 pt/row,
  hard drop 2 pts/row
- **Levels**: gravity `1000 × 0.85^(level-1)` ms/row, level up every 10 lines
- **Game over**: blockout (spawn collision) or lockout (piece locks in the hidden zone)

## Tests

```bash
npm test           # full suite (engine, renderer, audio, components, integration)
npm run test:watch # watch mode
npm run coverage   # v8 coverage report
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

The suite covers the engine exhaustively (rotation/kick vectors, DAS/ARR timing,
lock-delay windows, the full scoring matrix, T-spin/mini detection, level curves,
determinism of seeded runs), the renderer against a recording canvas proxy, the SFX
synth against a fake WebAudio backend, and React components in jsdom — including an
end-to-end game driven purely by synthetic key events to game over.

## License

MIT
