import type { PieceKind } from '../engine/types';
import { MiniPiece } from './MiniPiece';

export function HoldPanel({ kind, disabled }: { kind: PieceKind | null; disabled: boolean }) {
  return (
    <div className={`panel hold${disabled ? ' hold-disabled' : ''}`}>
      <div className="panel-title">Hold</div>
      <div className="mini-slot">{kind ? <MiniPiece kind={kind} /> : <span className="mini-empty" aria-hidden>-</span>}</div>
    </div>
  );
}

export function NextPanel({ kinds }: { kinds: PieceKind[] }) {
  return (
    <div className="panel next">
      <div className="panel-title">Next</div>
      <div className="next-list">
        {kinds.slice(0, 5).map((k, i) => (
          <MiniPiece key={`${k}-${i}`} kind={k} cell={i === 0 ? 15 : 12} highlight={i === 0} />
        ))}
      </div>
    </div>
  );
}

export function StatsPanel({
  score,
  level,
  lines,
  combo,
  best,
}: {
  score: number;
  level: number;
  lines: number;
  combo: number;
  best: number;
}) {
  return (
    <div className="panel stats">
      <div className="panel-title">Stats</div>
      <div className="stat score-stat">
        <span className="stat-label">Score</span>
        <span className="stat-value">{score.toLocaleString()}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Level</span>
        <span className="stat-value">{level}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Lines</span>
        <span className="stat-value">{lines}</span>
      </div>
      <div className={`stat combo${combo >= 2 ? ' combo-hot' : ''}`}>
        <span className="stat-label">Combo</span>
        <span className="stat-value">{combo >= 2 ? `\u00d7${combo - 1}` : '\u2014'}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Best</span>
        <span className="stat-value">{best.toLocaleString()}</span>
      </div>
    </div>
  );
}
