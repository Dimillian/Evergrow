import type { WeaponVisual } from './model.ts';
import { weaponArtLength } from './weapon-shapes.ts';
import { line, polygon, type Point } from './art-primitives.ts';

/** Small equipment glow also works in detached portrait canvases and geometry reviews. */
export function drawEquipmentGlow(c: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, power: number) {
  c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha *= power;
  const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color); gradient.addColorStop(.2, color + 'aa'); gradient.addColorStop(1, color + '00');
  c.fillStyle = gradient; c.fillRect(x - radius, y - radius, radius * 2, radius * 2); c.restore();
}

/** Local-space bounded effects: no particles allocated per frame, no gameplay state. */
export function drawWeaponEnchantment(c: CanvasRenderingContext2D, v: WeaponVisual, time: number, charge: number) {
  if (!v.glow || !v.element || v.element === 'physical' || v.kind === 'bow' || v.kind === 'unarmed') return;
  const caster = v.kind === 'staff' || v.kind === 'wand', length = weaponArtLength(v);
  const start = caster ? length - 3 : length * (v.kind === 'axe' || v.kind === 'mace' ? .65 : .23);
  const end = length - 1, pulse = .65 + Math.sin(time * 2.2) * .08 + charge * .25;
  drawEquipmentGlow(c, (start + end) / 2, 0, caster ? 7 + charge * 3 : 6, v.glow, pulse * .55);
  c.save(); c.globalCompositeOperation = 'screen';
  if (!caster) {
    c.globalAlpha *= .5;
    line(c, [[start, 0], [end, 0]], v.glow, 2.2);
    c.globalAlpha *= 1.5;
    line(c, [[start, 0], [end, 0]], '#eefbff', .4);
  }
  if (v.element === 'lightning') {
    const points: Point[] = Array.from({ length: 8 }, (_, i) => [start + (end - start + 3) * i / 7,
      Math.sin(i * 13.1 + Math.floor(time * 9)) * (i === 0 || i === 7 ? .3 : 2.3)]);
    c.globalAlpha *= .7; line(c, points, v.glow, .9); line(c, points, '#eef5ff', .3);
  } else for (let i = 0; i < 4; i++) {
    const phase = ((time * (v.element === 'fire' ? .55 : .22) + i * .25) % 1 + 1) % 1;
    const x = start + (end - start) * (i / 3), y = -phase * (v.element === 'fire' ? 7 : 4);
    c.save(); c.globalAlpha *= Math.sin(phase * Math.PI) * .8;
    if (v.element === 'fire') {
      polygon(c, [[x - .7, y], [x + Math.sin(time * 3 + i) * 1.2, y - 2.8], [x + .8, y + .7]], v.glow);
    } else {
      const size = v.element === 'frost' ? .8 : .55;
      polygon(c, [[x, y - size], [x + size * .6, y], [x, y + size], [x - size * .6, y]], v.glow);
    }
    c.restore();
  }
  c.restore();
}
