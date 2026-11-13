import { ARR, DAS } from './constants';

export type HDir = -1 | 1;

export interface InputFrame {
  /** Horizontal moves to apply this frame (DAS/ARR repeat output). */
  moves: HDir[];
  soft: boolean;
}

/**
 * Time-based horizontal input with guideline-style DAS + ARR.
 * `press` returns true only on a fresh (or direction-switching) press; the
 * caller applies the immediate move. Repeating movement is emitted by
 * `update(dt)` after the DAS delay, then every ARR while held.
 * Switching or releasing the active direction re-arms DAS.
 */
export class InputBuffer {
  private left = false;
  private right = false;
  private dir: 0 | HDir = 0;
  private das = 0;
  private arr = 0;
  soft = false;

  /** Returns true when the press should trigger an immediate move. */
  press(d: HDir): boolean {
    if (d === -1) {
      if (this.left) return false;
      this.left = true;
    } else {
      if (this.right) return false;
      this.right = true;
    }
    if (this.dir === d) return false;
    this.dir = d;
    this.das = 0;
    this.arr = 0;
    return true;
  }

  release(d: HDir): void {
    if (d === -1) this.left = false;
    else this.right = false;
    if (this.dir === d) {
      // Active direction gone: fall back to the other held key (re-armed), or idle.
      this.dir = this.right ? 1 : this.left ? -1 : 0;
      this.das = 0;
      this.arr = 0;
    }
  }

  setSoft(on: boolean): void {
    this.soft = on;
  }

  /** Clears all held state (used on pause / new game). */
  reset(): void {
    this.left = false;
    this.right = false;
    this.dir = 0;
    this.das = 0;
    this.arr = 0;
    this.soft = false;
  }

  update(dt: number): InputFrame {
    const moves: HDir[] = [];
    if (this.dir !== 0 && (this.dir === -1 ? this.left : this.right)) {
      this.das += dt;
      if (this.das >= DAS) {
        this.arr += dt;
        while (this.arr >= ARR) {
          moves.push(this.dir);
          this.arr -= ARR;
        }
      }
    }
    return { moves, soft: this.soft };
  }
}
