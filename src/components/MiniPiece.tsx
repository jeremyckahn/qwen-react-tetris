import { BOX_SIZE, COLORS, PIECE_CELLS } from '../engine/constants';
import type { PieceKind, Rot } from '../engine/types';

/** Small DOM-rendered piece used by the hold and next-queue panels. */
export function MiniPiece({
  kind,
  rot = 0,
  cell = 13,
  highlight = false,
}: {
  kind: PieceKind;
  rot?: Rot;
  cell?: number;
  highlight?: boolean;
}) {
  const c = COLORS[kind];
  const size = BOX_SIZE[kind];
  return (
    <div
      className={`mini-piece${highlight ? ' mini-hot' : ''}`}
      data-kind={kind}
      style={{ width: size * cell, height: size * cell }}
    >
      {PIECE_CELLS[kind][rot].map(([x, y], i) => (
        <span
          key={i}
          className="mini-cell"
          data-x={x}
          data-y={y}
          style={{
            left: x * cell,
            top: y * cell,
            width: cell - 2,
            height: cell - 2,
            background: `linear-gradient(180deg, ${c.light}, ${c.base})`,
            boxShadow: highlight ? `0 0 10px ${c.glow}` : 'none',
          }}
        />
      ))}
    </div>
  );
}
