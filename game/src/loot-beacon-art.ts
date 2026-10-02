import { LOOT_BEACONS, type SpecialLootTier } from './loot-drop-presentation.ts';
import { drawGlow } from './lighting.ts';

/** Narrow stained-light spires leave silhouettes and combat telegraphs readable. */
export function drawLootBeacon(c: CanvasRenderingContext2D, x: number, y: number, tier: SpecialLootTier,
  id: number, time: number, reduced: boolean, flare: number) {
  const s = LOOT_BEACONS[tier], t = reduced ? 0 : time;
  const pulse = reduced ? 1 : .92 + Math.sin(t * 1.7 + id) * .08;
  const height = s.height * pulse;
  c.save(); c.translate(x, y); c.globalCompositeOperation = 'screen';
  c.save(); c.scale(1, .42); drawGlow(c, 0, 0, 43, s.accent, .6); drawGlow(c, 0, 0, 22, s.color, .75); c.restore();
  const beam = c.createLinearGradient(0, 0, 0, -height);
  beam.addColorStop(0, s.color + 'a0'); beam.addColorStop(.18, s.color + '60');
  beam.addColorStop(.65, s.accent + '28'); beam.addColorStop(1, s.accent + '00');
  c.fillStyle = beam;
  c.beginPath(); c.moveTo(-7, 0); c.lineTo(-2, -height); c.lineTo(2, -height); c.lineTo(7, 0); c.fill();
  c.globalAlpha = .65; c.fillStyle = beam; c.fillRect(-1, -height, 2, height); c.globalAlpha = 1;
  c.strokeStyle = s.color + '88'; c.lineWidth = .75;
  c.beginPath(); c.ellipse(0, 0, 18, 6, 0, 0, Math.PI * 2); c.stroke();
  drawGlow(c, 0, -3, 13, s.core, .65);
  for (let i = 0; i < 6; i++) {
    const progress = ((t * .16 + i / 6 + id * .17) % 1 + 1) % 1;
    const a = i * 2.4 + t * .5, px = Math.sin(a) * (5 + progress * 9), py = -progress * height;
    c.globalAlpha = Math.sin(progress * Math.PI) * .7;
    c.fillStyle = i % 2 ? s.core : s.accent;
    c.fillRect(px, py, 1.3, 2.8);
  }
  if (!reduced && flare > 0) {
    c.globalAlpha = flare * .7;
    c.strokeStyle = s.color; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(0, 0, 18 + (1 - flare) * 44, 6 + (1 - flare) * 15, 0, 0, Math.PI * 2); c.stroke();
    drawGlow(c, 0, -5, 35, s.core, flare * .7);
  }
  c.restore();
}
