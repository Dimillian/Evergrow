import type { GroundItem } from './character-types.ts';
import { TIER_COLORS } from './items.ts';
import { drawGlow } from './lighting.ts';
import { text, textWidth } from './font.ts';

export function drawGroundLoot(c: CanvasRenderingContext2D, drops: readonly GroundItem[], time: number): void {
  c.save();
  for (const drop of drops) {
    const color = TIER_COLORS[drop.item.tier], x = drop.x, y = drop.y;
    drawGlow(c, x, y - 2, 27, color, .3);
    const beam = c.createLinearGradient(x, y - 35, x, y);
    beam.addColorStop(0, color + '00'); beam.addColorStop(1, color + '65');
    c.fillStyle = beam; c.fillRect(x - 1, y - 35, 2, 33);
    c.strokeStyle = color; c.lineWidth = 1;
    c.beginPath(); c.ellipse(x, y, 8, 3, 0, 0, Math.PI * 2); c.stroke();
    c.save(); c.translate(x, y - 5 + Math.sin(time * 2 + drop.id) * 1.2);
    c.rotate(drop.item.kind === 'weapon' ? .7 : 0);
    c.fillStyle = drop.item.appearance.base; c.strokeStyle = drop.item.appearance.edge;
    if (drop.item.kind === 'weapon') { c.fillRect(-1.5, -9, 3, 16); c.strokeRect(-1.5, -9, 3, 16); c.fillRect(-5, 3, 10, 2); }
    else { c.beginPath(); c.moveTo(0, -7); c.lineTo(6, -2); c.lineTo(4, 6); c.lineTo(-4, 6); c.lineTo(-6, -2); c.closePath(); c.fill(); c.stroke(); }
    c.restore();
  }
  c.restore();
}

/** Labels stay sharp and retain a readable size regardless of world zoom. */
export function drawLootLabels(c: CanvasRenderingContext2D, drops: readonly GroundItem[],
  project: (x: number, y: number) => { x: number; y: number }, width: number, height: number): void {
  const occupied: Array<{ x: number; y: number; width: number }> = [];
  c.save();
  for (const drop of drops) {
    const pos = project(drop.x, drop.y - 23), size = .92;
    if (pos.x < 0 || pos.x > width || pos.y < 0 || pos.y > height) continue;
    const w = textWidth(drop.item.name, size) + 14;
    let y = pos.y;
    for (const other of occupied) if (Math.abs(other.x - pos.x) < (w + other.width) / 2 && Math.abs(other.y - y) < 15) y = other.y - 16;
    occupied.push({ x: pos.x, y, width: w });
    c.fillStyle = '#07101aeb'; c.fillRect(pos.x - w / 2, y - 3, w, 14);
    c.strokeStyle = TIER_COLORS[drop.item.tier] + '88'; c.lineWidth = .5; c.strokeRect(pos.x - w / 2, y - 3, w, 14);
    text(c, drop.item.name, pos.x, y, size, TIER_COLORS[drop.item.tier], 'center');
  }
  c.restore();
}
