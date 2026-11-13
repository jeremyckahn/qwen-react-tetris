import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MiniPiece } from './MiniPiece';
import { ALL, COLORS, PIECE_CELLS } from '../engine/constants';
import type { PieceKind } from '../engine/types';

function cells(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.mini-cell')) as HTMLSpanElement[];
}

describe('MiniPiece', () => {
  it.each(ALL.map((k) => [k] as [PieceKind]))('renders all 4 cells of %s', (kind) => {
    const { container } = render(<MiniPiece kind={kind} />);
    const els = cells(container);
    expect(els).toHaveLength(4);
    for (const el of els) {
      expect(el.style.background).toBe(`linear-gradient(180deg, ${COLORS[kind].light}, ${COLORS[kind].base})`);
    }
  });

  it('positions cells per the SRS table (vertical I)', () => {
    const { container } = render(<MiniPiece kind="I" rot={1} cell={10} />);
    const els = cells(container);
    for (const el of els) {
      expect(el.style.left).toBe('20px');
      expect(['0px', '10px', '20px', '30px']).toContain(el.style.top);
    }
  });

  it('O piece renders a 2x2 square', () => {
    const { container } = render(<MiniPiece kind="O" cell={10} />);
    const xs = cells(container).map((el) => el.style.left);
    const ys = cells(container).map((el) => el.style.top);
    expect(new Set(xs).size).toBe(2);
    expect(new Set(ys).size).toBe(2);
  });

  it('highlight adds a glow', () => {
    const { container } = render(<MiniPiece kind="T" highlight />);
    expect(container.querySelector('.mini-piece')!.className).toContain('mini-hot');
    const el = cells(container)[0];
    expect(el.style.boxShadow).toBe(`0 0 10px ${COLORS.T.glow}`);
    const plain = render(<MiniPiece kind="T" />);
    expect(cells(plain.container)[0].style.boxShadow).toBe('none');
  });

  it('cell size scales with the cell prop', () => {
    const { container } = render(<MiniPiece kind="J" cell={20} />);
    expect((container.querySelector('.mini-piece') as HTMLElement).style.width).toBe('60px'); // 3 cols x 20
    const { container: c2 } = render(<MiniPiece kind="O" cell={20} />);
    expect((c2.querySelector('.mini-piece') as HTMLElement).style.width).toBe('40px'); // 2 cols x 20
  });

  it('rot 0 and rot 2 of the S piece differ (flat vs vertical)', () => {
    const flat = render(<MiniPiece kind="S" rot={0} cell={10} />);
    const vert = render(<MiniPiece kind="S" rot={1} cell={10} />);
    const f = cells(flat.container).map((el) => `${el.style.left},${el.style.top}`);
    const v = cells(vert.container).map((el) => `${el.style.left},${el.style.top}`);
    expect(f.sort().join(';')).not.toBe(v.sort().join(';'));
    // and matches the engine's own table
    const engine = PIECE_CELLS.S[1].map(([x, y]) => `${x * 10}px,${y * 10}px`).sort();
    expect(v.sort()).toEqual(engine);
  });
});
