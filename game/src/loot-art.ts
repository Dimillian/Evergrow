import { itemDisplayName } from './items.ts';
import type { GroundItem } from './character-types.ts';
import type { Pickup } from './model.ts';
import { TIER_COLORS, TIER_NAMES } from './items.ts';
import { text, textWidth } from './font.ts';
import { itemDropShapes } from './item-art.ts';
import { drawGearShapes } from './equipment-art.ts';
import { polygon } from './art-primitives.ts';
import { layoutLootLabels } from './loot-label-layout.ts';

/** Separate silhouettes in a multi-item drop without changing pickup/save positions. */
function lootPositions(drops: readonly GroundItem[]) {
  const groups = new Map<string, GroundItem[]>();
  for (const drop of drops) {
    const key = `${drop.x}:${drop.y}`;
    const group = groups.get(key) ?? []; group.push(drop); groups.set(key, group);
  }
  return [...groups.values()].flatMap(group => group.sort((a, b) => a.id - b.id).map((drop, i) => ({
    drop, x: drop.x + (i - (group.length - 1) / 2) * 19,
    y: drop.y + (group.length > 1 ? Math.sin(i * 2.4) * 5 : 0),
  })));
}

export function drawGroundLoot(c: CanvasRenderingContext2D, drops: readonly GroundItem[], time: number, reducedMotion = false): void {
  c.save();
  for (const { drop, x, y } of lootPositions(drops)) {
    const color = TIER_COLORS[drop.item.tier];
    const precious = ['rare', 'epic', 'legendary'].includes(drop.item.tier);
    c.fillStyle = '#040a10b0'; c.beginPath(); c.ellipse(x, y + 2, 12, 4, -.12, 0, Math.PI * 2); c.fill();
    // Equipment rests on the floor, not suspended inside a beam of light.
    c.save(); c.translate(x, y - 3); c.rotate(Math.sin(drop.item.seed) * .18); c.scale(1.2, .95);
    drawGearShapes(c, itemDropShapes(drop.item), value => value); c.restore();
    c.strokeStyle = color + (precious ? 'ae' : '65'); c.lineWidth = .7;
    for (const side of [-1, 1]) {
      c.beginPath(); c.moveTo(x + side * 12, y - 2); c.lineTo(x + side * 15, y + 1);
      c.lineTo(x + side * 11, y + 4); c.stroke();
    }
    // Rare gear catches a brief glint; common equipment has no ambient emitter.
    const glint = reducedMotion ? .35 : Math.max(0, Math.sin(time * 1.8 + drop.id) - .72) / .28;
    if (precious && glint > 0) {
      c.save(); c.globalAlpha = glint * .8; c.strokeStyle = color; c.lineWidth = .8;
      c.beginPath(); c.moveTo(x + 6, y - 10); c.lineTo(x + 6, y - 4);
      c.moveTo(x + 3, y - 7); c.lineTo(x + 9, y - 7); c.stroke(); c.restore();
    }
  }
  c.restore();
}

/** Resource pickups are little stoppered glass vessels, distinct from equipment. */
export function drawResourcePickups(c: CanvasRenderingContext2D, pickups: readonly Pickup[], time: number, reducedMotion: boolean): void {
  c.save();
  for (const pickup of pickups) {
    c.save(); c.translate(pickup.x, pickup.y); c.globalAlpha = Math.min(1, pickup.life / 2);
    c.fillStyle = '#030a10a0'; c.beginPath(); c.ellipse(0, 2, 5, 2, 0, 0, Math.PI * 2); c.fill();
    c.rotate(Math.sin(pickup.id) * .35);
    polygon(c, [[-2,-8],[2,-8],[2,-5],[4,-3],[3,1],[-3,1],[-4,-3],[-2,-5]], '#1b3036');
    const surface = reducedMotion ? -3 : -3 + Math.sin(time * 2 + pickup.id) * .25;
    polygon(c, [[-2.8,surface],[2.8,surface],[2,0],[-2,0]], pickup.kind === 'health' ? '#ca655b' : '#588db9');
    c.strokeStyle = '#adc3c2'; c.lineWidth = .65; c.beginPath();
    c.moveTo(-2,-6); c.lineTo(-3,-3); c.lineTo(-2,.2); c.stroke();
    c.fillStyle = '#b8a27c'; c.fillRect(-2,-8,4,1.7);
    c.restore();
  }
  c.restore();
}

/** Crisp names and an explicit quality/level line; leaders identify packed drops. */
export function drawLootLabels(c: CanvasRenderingContext2D, drops: readonly GroundItem[],
  project: (x: number, y: number) => { x: number; y: number }, width: number, height: number): void {
  const positions = lootPositions(drops);
  const byId = new Map(drops.map(drop => [drop.id, drop]));
  const anchors = positions.map(({ drop, x, y }) => ({ id: drop.id, ...project(x, y),
    width: Math.max(textWidth(itemDisplayName(drop.item), 1.05), textWidth(`${TIER_NAMES[drop.item.tier]} · iLv ${drop.item.itemLevel}`, .72, 'interface')) + 22 }));
  const boxes = layoutLootLabels(anchors, width, height);
  c.save();
  for (const b of boxes) {
    const drop = byId.get(b.id)!, color = TIER_COLORS[drop.item.tier];
    const center = b.left + b.width / 2;
    c.strokeStyle = color + '65'; c.lineWidth = .65;
    c.beginPath(); c.moveTo(b.x, b.y - 6); c.lineTo(center, b.top + b.height / 2); c.stroke();
    const fill = c.createLinearGradient(b.left, b.top, b.left, b.top + b.height);
    fill.addColorStop(0, '#1b2930f5'); fill.addColorStop(1, '#080f16f0');
    c.fillStyle = fill; c.fillRect(b.left, b.top, b.width, b.height);
    c.strokeStyle = color + '65'; c.lineWidth = .7; c.strokeRect(b.left + .5, b.top + .5, b.width - 1, b.height - 1);
    c.fillStyle = color; c.fillRect(b.left, b.top + 5, 2, b.height - 10);
    c.save(); c.beginPath(); c.rect(b.left + 6, b.top, b.width - 12, b.height); c.clip();
    text(c, itemDisplayName(drop.item), center, b.top + 5, 1.05, color, 'center');
    text(c, `${TIER_NAMES[drop.item.tier]} · iLv ${drop.item.itemLevel}`, center, b.top + 18, .72, '#a9b9bc', 'center', 'interface');
    c.restore();
  }
  c.restore();
}
