import { armorShapes } from './armor-shapes.ts';
import { STARTING_SWORD } from './equipment.ts';
import type { ShieldDefinition } from './model.ts';
import { shieldShapes, weaponShapes, type GearShape } from './weapon-shapes.ts';
import type { ArmorMaterial, ArmorPiece, CharacterOutfit } from './art-types.ts';
import { PLAYER_ATTACHMENTS } from './character-motion.ts';
import { polygon, line, taper, type Point, type Color } from './art-primitives.ts';

const STEEL: ArmorMaterial = { base: '#728c81', shadow: '#294750', edge: '#d1d6b0', trim: '#cfaa6c' };

const LEATHER: ArmorMaterial = { base: '#5c4c41', shadow: '#292b30', edge: '#a79873', trim: '#b18b58' };

export const STARTER_OUTFIT: CharacterOutfit = {
  head: { style: 'plate', seed: 31, material: STEEL },
  chest: { style: 'plate', seed: 17, material: STEEL },
  shoulders: { style: 'plate', seed: 42, material: STEEL },
  hands: { style: 'plate', seed: 23, material: STEEL },
  legs: { style: 'plate', seed: 59, material: STEEL },
  boots: { style: 'leather', seed: 11, material: LEATHER },
  cloak: { base: '#92364e', shadow: '#4e2a3e', highlight: '#cf5e69', trim: '#d4a070', seed: 71 },
};

export function drawGearShapes(ctx: CanvasRenderingContext2D, shapes: readonly GearShape[], color: Color): void {
  for (const shape of shapes) {
    if (shape.fill) polygon(ctx, shape.points, color(shape.fill));
    if (shape.stroke) line(ctx, shape.points, color(shape.stroke), shape.width ?? .7);
  }
}

export function heldWeapon(ctx: CanvasRenderingContext2D, hand: Point, angle: number, color: Color,
  visual = STARTING_SWORD.visual, draw = 0): void {
  ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(angle);
  drawGearShapes(ctx, weaponShapes(visual, draw), color);
  ctx.restore();
}

export function heldShield(ctx: CanvasRenderingContext2D, hand: Point, angle: number,
  visual: ShieldDefinition['visual'], color: Color, guard = 0): void {
  ctx.save(); ctx.translate(hand[0], hand[1]);
  ctx.rotate(Math.cos(angle) * -.12);
  ctx.scale(.62 + Math.abs(Math.sin(angle)) * .38, 1);
  drawGearShapes(ctx, shieldShapes(visual), color);
  if (guard > 0) {
    ctx.globalAlpha *= guard * .7;
    line(ctx, [[-9, -10], [-11, 0], [0, 15], [11, 0], [9, -10]], '#b1ddef', 1);
  }
  ctx.restore();
}

export function upperArm(ctx: CanvasRenderingContext2D, shoulder: Point, elbow: Point, color: Color): void {
  taper(ctx, shoulder, elbow, 4.5, 3.4, color('#263a39'));
}

export function forearm(ctx: CanvasRenderingContext2D, elbow: Point, hand: Point, piece: ArmorPiece | null, color: Color): void {
  taper(ctx, elbow, hand, 3.4, 2.1, color('#5b5145'));
  if (piece) {
    const m = piece.material;
    const cuff: Point = [elbow[0] * 0.28 + hand[0] * 0.72, elbow[1] * 0.28 + hand[1] * 0.72];
    taper(ctx, elbow, cuff, piece.style === 'plate' ? 4.4 : 3.4, 3, color(m.shadow));
    taper(ctx, [elbow[0] - 0.5, elbow[1] - 0.6], [cuff[0] - 0.5, cuff[1] - 0.3], 3.1, 2.2, color(m.base));
    line(ctx, [[elbow[0] - 1.4, elbow[1]], [cuff[0] - 1.2, cuff[1]]], color(m.edge), 0.65);
    line(ctx, [[cuff[0] - 1.6, cuff[1] - 0.7], [cuff[0] + 1.6, cuff[1] + 0.7]], color(m.trim), 0.8);
  }
}

export function gauntlet(ctx: CanvasRenderingContext2D, hand: Point, piece: ArmorPiece | null, color: Color): void {
  const material = piece?.material ?? LEATHER;
  polygon(ctx, [[hand[0] - 2, hand[1] - 1.7], [hand[0] + 1.5, hand[1] - 2],
    [hand[0] + 2.1, hand[1] + 0.8], [hand[0] + 1.1, hand[1] + 2], [hand[0] - 1.5, hand[1] + 1.6]], color(material.base));
  line(ctx, [[hand[0] - 1.4, hand[1] - 1.2], [hand[0] + 1.3, hand[1] - 1.2]], color(material.edge), 0.65);
  for (let finger = 0; finger < 2; finger++) {
    line(ctx, [[hand[0] - 0.5 + finger, hand[1]], [hand[0] - 0.4 + finger, hand[1] + 1.4]], color(material.shadow), 0.45);
  }
}

export function armorBoot(ctx: CanvasRenderingContext2D, anchor: Point, piece: ArmorPiece | null, color: Color, direction: number): void {
  const [x, y] = anchor;
  const m = piece?.material ?? LEATHER;
  const toe = direction * 0.85;
  polygon(ctx, [[x - 2.2, y - 6], [x + 2, y - 6], [x + 2.3, y - 2],
    [x + 3 + toe, y - 0.2], [x + 2.5 + toe, y + 1.2], [x - 2.2 + toe, y + 1.4], [x - 2.5, y - 1]], color(m.shadow));
  polygon(ctx, [[x - 1.7, y - 5.5], [x + 1.5, y - 5.5], [x + 1.7, y - 1],
    [x + 2.2 + toe, y], [x - 1.5 + toe, y + 0.5]], color(m.base));
  line(ctx, [[x - 1.5 + toe, y + 0.7], [x + 2.1 + toe, y + 0.4]], color('#1b2428'), 0.75);
  line(ctx, [[x - 1.5, y - 4], [x + 1.4, y - 4]], color(m.trim), 0.9);
  ctx.fillStyle = color(m.edge);
  ctx.fillRect(x - 0.1, y - 4.4, 0.8, 0.8);
  line(ctx, [[x - 1.3, y - 5.4], [x - 1.2, y - 1.7], [x - 0.4 + toe, y - 0.6]], color(m.edge), 0.55);
  if (piece?.style === 'plate') {
    polygon(ctx, [[x - 1.6, y - 2], [x + 1.6, y - 2], [x + 2.2 + toe, y], [x - 1.8 + toe, y + 0.3]], color(m.base));
    line(ctx, [[x - 1.6, y - 2], [x + 1.6, y - 2]], color(m.edge), 0.65);
  }
}

export function chestArmor(ctx: CanvasRenderingContext2D, piece: ArmorPiece | null, color: Color): void {
  ctx.save(); ctx.translate(...PLAYER_ATTACHMENTS.chest);
  polygon(ctx, [[-6, -7], [6, -7], [7, 6], [4, 11], [-5, 11], [-7, 4]], color('#1b3338'));
  // Dark quilted fabric remains visible between separately attached armor pieces.
  for (let row = 0; row < 3; row++) {
    line(ctx, [[-4.5, 4 + row * 2], [0, 5 + row * 2], [4, 4 + row * 2]], color('#496257'), 0.6);
  }
  if (piece) drawGearShapes(ctx, armorShapes('chest', piece), color);
  line(ctx, [[-5.3, 8.1], [5.3, 8.1]], color('#644834'), 2);
  ctx.fillStyle = color('#d4ae72'); ctx.fillRect(-1.4, 6.8, 2.8, 2.4);
  ctx.fillStyle = color('#392e2b'); ctx.fillRect(-0.5, 7.4, 1, 1.1);
  polygon(ctx, [[3.5, 8.1], [6.5, 8.8], [6.1, 12], [3.5, 11.7]], color('#5c4638'));
  line(ctx, [[3.8, 8.8], [6.2, 9.4]], color('#b59a6d'), 0.5);
  ctx.restore();
}

export function shoulderArmor(ctx: CanvasRenderingContext2D, anchor: Point, elbow: Point, piece: ArmorPiece | null, color: Color): void {
  if (!piece) return;
  ctx.save();
  ctx.translate(...anchor);
  // Mount and orientation both follow the upper arm, including in rear/side views.
  ctx.rotate(-Math.atan2(elbow[0] - anchor[0], Math.max(2, elbow[1] - anchor[1])));
  ctx.translate(-1.5, 0);
  drawGearShapes(ctx, armorShapes('shoulder', piece), color);
  ctx.restore();
}

export function headArmor(ctx: CanvasRenderingContext2D, piece: ArmorPiece | null, color: Color, facing: number): void {
  ctx.save(); ctx.translate(Math.cos(facing) * 1.4, PLAYER_ATTACHMENTS.head[1]);
  const back = Math.sin(facing) < -.16;
  const side = Math.cos(facing), look = side * .8;
  const m = piece?.material ?? LEATHER;
  // A skin neck seated inside a dark gorget gives the helmet a separate volume.
  polygon(ctx, [[-1.7, 3.8], [1.9, 3.8], [2.1, 6.7], [-2, 6.7]], color('#9e8069'));
  polygon(ctx, [[-3.5, 5.4], [-1.9, 5.8], [0, 6.9], [2.3, 5.6], [3.6, 5.2], [3.1, 7.3], [0, 8], [-3.1, 7]], color(m.shadow));
  line(ctx, [[-3, 5.8], [0, 7.2], [3.1, 5.6]], color(m.edge), .65);
  polygon(ctx, [[-4.2, -.8], [-3.2, -3.9], [.6, -4.8], [3.7, -2.7], [4.2, .6], [2.7, 4.1], [.7, 5.3], [-2, 4.6], [-3.9, 1.8]], color('#403b39'));
  if (!back) {
    polygon(ctx, [[-3 + look, -1.4], [.2 + look, -2.6], [2.7 + look, -1.3], [3 + look, 2.4], [1.1 + look, 4.7], [-1.1 + look, 4.4], [-2.6 + look, 2.6]], color('#b89a7d'));
    polygon(ctx, [[-3 + look, -1.4], [-1.1 + look, -.7], [-.7 + look, 3.8], [-1.1 + look, 4.4], [-2.6 + look, 2.6]], color('#755f51'));
    polygon(ctx, [[.2 + look, 1.1], [1 + look, 2.2], [.4 + look, 2.7], [-.1 + look, 2.1]], color('#e0c39c'));
    // Near eye is full width, far eye foreshortens; no fixed forward-looking mask.
    for (const eye of [-1, 1]) {
      const width = .9 - Math.max(0, side * eye) * .35;
      line(ctx, [[eye * 1.6 + look - width / 2, 1.25], [eye * 1.6 + look + width / 2, 1.25]], color('#263239'), .65);
    }
    line(ctx, [[-.8 + look, 3.1], [.9 + look, 3.3]], color('#65504b'), .55);
    line(ctx, [[-.5 + look, 4.2], [.8 + look, 4.3]], color('#d6b991'), .45);
  }
  if (piece) drawGearShapes(ctx, armorShapes('head', piece, facing), color);
  else {
    polygon(ctx, [[-4.2, -.7], [-3.2, -3.9], [.6, -4.8], [3.7, -2.7], [3.8, -.6], [2.1, -1.4], [1, -2.5], [-1.5, -1.8], [-2.2, .1], [-3.6, 1.4]], color('#4c3b32'));
    line(ctx, [[-3.4, -1.5], [-2.6, -3], [.3, -3.7], [2.4, -2.4]], color('#8f7457'), .7);
    if (back) polygon(ctx, [[-3.7, -.4], [3.7, -.4], [3.5, 3.2], [1.8, 4.8], [-2.3, 4.2], [-3.8, 2.1]], color('#4c3b32'));
  }
  ctx.restore();
}
