import type { EnemyRank } from './progression-content.ts';

/** Shared heraldry for the native target plate and small world-space rank badges. */
export const RANK_METALS = Object.freeze({
  normal: { edge: '#65726f', light: '#b8c4bd', shade: '#242e30', gem: '#a8b9ae' },
  veteran: { edge: '#668aa7', light: '#c2e1ee', shade: '#233b52', gem: '#81ccef' },
  elite: { edge: '#aa8954', light: '#f0d7a0', shade: '#4a3529', gem: '#f4af70' },
});

export function drawRankCrest(c: CanvasRenderingContext2D, rank: EnemyRank, x: number, y: number, scale = 1): void {
  const metal = RANK_METALS[rank];
  c.save(); c.translate(x, y); c.scale(scale, scale); c.lineJoin = 'round';
  // Silver pinions and a three-point crown carry meaning even without rank color.
  if (rank !== 'normal') for (const side of [-1, 1]) {
    c.save(); c.scale(side, 1);
    c.beginPath(); c.moveTo(4, -3); c.lineTo(16, -7); c.lineTo(12, 0);
    c.lineTo(7, 5); c.lineTo(4, 5); c.closePath();
    c.fillStyle = metal.shade; c.fill(); c.strokeStyle = metal.edge; c.lineWidth = .8; c.stroke();
    c.strokeStyle = metal.light; c.lineWidth = .65;
    c.beginPath(); c.moveTo(6, -2); c.lineTo(12, -4); c.moveTo(7, 1); c.lineTo(10, 0); c.stroke(); c.restore();
  }
  if (rank === 'elite') {
    c.beginPath(); c.moveTo(-6, -5); c.lineTo(-8, -12); c.lineTo(-3, -9);
    c.lineTo(0, -15); c.lineTo(3, -9); c.lineTo(8, -12); c.lineTo(6, -5); c.closePath();
    c.fillStyle = metal.shade; c.fill(); c.strokeStyle = metal.light; c.lineWidth = .75; c.stroke();
  }
  const fill = c.createLinearGradient(-6, -7, 6, 9);
  fill.addColorStop(0, metal.light); fill.addColorStop(.18, metal.edge);
  fill.addColorStop(.5, metal.shade); fill.addColorStop(1, metal.edge);
  c.beginPath(); c.moveTo(0, -9); c.lineTo(7, -3); c.lineTo(5, 5); c.lineTo(0, 10);
  c.lineTo(-5, 5); c.lineTo(-7, -3); c.closePath(); c.fillStyle = fill; c.fill();
  c.strokeStyle = metal.light; c.lineWidth = .65; c.stroke();
  c.beginPath(); c.moveTo(0, -5); c.lineTo(3, -1); c.lineTo(0, 5); c.lineTo(-3, -1); c.closePath();
  c.fillStyle = '#070e16'; c.fill(); c.strokeStyle = metal.gem; c.lineWidth = .8; c.stroke();
  c.fillStyle = metal.gem; c.fillRect(-.65, -2, 1.3, 3);
  c.restore();
}
