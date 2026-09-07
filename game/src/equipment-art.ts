import { armorAccessoryShapes, type ArmorAccessory } from './armor-accessory-shapes.ts';
import { bootShapes } from './boot-shapes.ts';
import { gearMaterialStops, gearMaterialMarks, gearCanvasLight } from './gear-material.ts';
import { drawWeaponEnchantment, drawEquipmentGlow } from './weapon-enchantment-art.ts';
import { focusShapes, focusGlowCenter } from './focus-shapes.ts';
import { appearanceHeadShapes } from './appearance-shapes.ts';
import { appearancePalette, SKIN_PALETTES, type CharacterAppearance } from './appearance-content.ts';
import { armorShapes } from './armor-shapes.ts';
import { STARTING_SWORD } from './equipment.ts';
import type { FocusDefinition, ShieldDefinition } from './model.ts';
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

const shadingCache = new WeakMap<GearShape,{key:string;stops:Array<readonly [number,string]>}>();
export function drawGearShapes(ctx: CanvasRenderingContext2D, shapes: readonly GearShape[], color: Color): void {
  const matrix = ctx.getTransform(), fine = Math.hypot(matrix.a, matrix.b) >= 2.4;
  const lighting = gearCanvasLight(ctx), facing = Math.round(Math.atan2(matrix.b,matrix.a)*128)/128;
  const lightKey=`${facing}:${lighting.direction.map(v=>Math.round(v*64)).join(',')}:${lighting.color}:${Math.round(lighting.power*64)}`;
  for (const shape of shapes) {
    if (shape.fine && !fine) continue;
    let stops:Array<readonly [number,string]>|undefined;
    if(shape.surface) {
      const cached=shadingCache.get(shape);
      if(cached?.key===lightKey)stops=cached.stops;
      else {stops=gearMaterialStops(shape.fill??shape.stroke??'#808080',shape.surface,facing,lighting);shadingCache.set(shape,{key:lightKey,stops});}
    }
    if (shape.fill) {
      polygon(ctx, shape.points, color(!fine && stops ? stops[1][1] : shape.fill));
      if (fine && shape.surface && !shape.fine) {
        const xs=shape.points.map(p=>p[0]),ys=shape.points.map(p=>p[1]);
        const left=Math.min(...xs),top=Math.min(...ys),w=Math.max(...xs)-left,h=Math.max(...ys)-top;
        if(w*h>1) {
          ctx.save();ctx.clip();
          const light=ctx.createLinearGradient(left,top,left+w*.8,top+h);
          for(const [at,value] of stops!) light.addColorStop(at,color(value));
          ctx.fillStyle=light;ctx.fillRect(left,top,w,h);
          if(w*h>5) {ctx.globalAlpha*=.13;for(const mark of gearMaterialMarks(shape.surface,[left,top,w,h])) line(ctx,mark,color(shape.fill),.1);}
          ctx.restore();
        }
      }
    }
    if (shape.stroke) line(ctx, shape.points, color(stops ? stops[1][1] : shape.stroke), shape.width ?? .7);
  }
}

export function heldWeapon(ctx: CanvasRenderingContext2D, hand: Point, angle: number, color: Color,
  visual = STARTING_SWORD.visual, draw = 0, time = 0, charge = 0, lengthScale = 1): void {
  ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(angle); ctx.scale(lengthScale, 1);
  drawGearShapes(ctx, weaponShapes(visual, draw), color);
  drawWeaponEnchantment(ctx, visual, time, charge);
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
  taper(ctx, shoulder, elbow, 3.8, 3, color('#263a39'));
}

export function forearm(ctx: CanvasRenderingContext2D, elbow: Point, hand: Point, piece: ArmorPiece | null, color: Color): void {
  taper(ctx, elbow, hand, 3, 1.8, color('#5b5145'));
  if (piece) {
    const cuff: Point = [elbow[0] * .28 + hand[0] * .72, elbow[1] * .28 + hand[1] * .72];
    armorSegment(ctx,elbow,cuff,piece,color,'bracer');
  }
}

export function gauntlet(ctx: CanvasRenderingContext2D, hand: Point, piece: ArmorPiece | null, color: Color,
  angle = 0, gripping = true): void {
  const m = piece?.material ?? LEATHER;
  ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(angle);
  drawGearShapes(ctx,armorAccessoryShapes('glove',piece ?? BARE_BOOT),color);
  if (gripping) {
    for (let finger = 0; finger < 3; finger++) {
      const x = -1.15 + finger * .72;
      line(ctx, [[x, -.15], [x + .12, .65], [x - .05, 1.3]], color(m.base), .52);
      line(ctx, [[x + .2, .2], [x + .24, .9]], color(m.shadow), .22);
    }
    polygon(ctx, [[.4, -1.5], [1.7, -.9], [1.75, -.2], [1, .35], [.65, -.25], [1, -.6]], color(m.base));
    line(ctx, [[1, -1.15], [1.5, -.75]], color(m.edge), .3);
  } else line(ctx, [[-.7, -.4], [-.6, 1], [.2, 1.1]], color(m.shadow), .35);
  ctx.restore();
}

export function armorSegment(ctx:CanvasRenderingContext2D, from:Point, to:Point, piece:ArmorPiece, color:Color, kind:Extract<ArmorAccessory,'bracer'|'thigh'>):void {
  const dx=to[0]-from[0],dy=to[1]-from[1],length=Math.hypot(dx,dy);
  ctx.save();ctx.translate(...from);ctx.rotate(-Math.atan2(dx,dy));ctx.scale(1,length/(kind==='thigh'?7:6));
  drawGearShapes(ctx,armorAccessoryShapes(kind,piece),color);ctx.restore();
}
export function kneeArmor(ctx:CanvasRenderingContext2D, point:Point, piece:ArmorPiece, color:Color):void {
  ctx.save();ctx.translate(...point);drawGearShapes(ctx,armorAccessoryShapes('knee',piece),color);ctx.restore();
}

const BARE_BOOT: ArmorPiece = { style: 'leather', seed: 11, material: LEATHER };
export function armorBoot(ctx: CanvasRenderingContext2D, anchor: Point, piece: ArmorPiece | null, color: Color, direction: number): void {
  ctx.save(); ctx.translate(...anchor);
  drawGearShapes(ctx, bootShapes(piece ?? BARE_BOOT, direction), color);
  ctx.restore();
}

export function chestArmor(ctx: CanvasRenderingContext2D, piece: ArmorPiece | null, color: Color): void {
  ctx.save(); ctx.translate(...PLAYER_ATTACHMENTS.chest);
  polygon(ctx, [[-6, -7], [6, -7], [7, 6], [4, 11], [-5, 11], [-7, 4]], color('#1b3338'));
  // Dark quilted fabric remains visible between separately attached armor pieces.
  for (let row = 0; row < 3; row++) {
    line(ctx, [[-4.5, 4 + row * 2], [0, 5 + row * 2], [4, 4 + row * 2]], color('#496257'), 0.6);
  }
  if (piece) drawGearShapes(ctx, armorShapes('chest', piece), color);
  if(piece?.style==='cloth'){ctx.restore();return;}
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

export function headArmor(ctx: CanvasRenderingContext2D, piece: ArmorPiece | null, color: Color, facing: number, appearance?: Readonly<CharacterAppearance>): void {
  ctx.save(); ctx.translate(Math.cos(facing) * 1.4, PLAYER_ATTACHMENTS.head[1]);
  const back = Math.sin(facing) < -.16;
  const side = Math.cos(facing), look = side * .8;
  const m = piece?.material ?? LEATHER;
  // A skin neck seated inside a dark gorget gives the helmet a separate volume.
  polygon(ctx, [[-1.7, 3.8], [1.9, 3.8], [2.1, 6.7], [-2, 6.7]], color(appearance ? appearancePalette(SKIN_PALETTES, appearance.skin).shadow : '#9e8069'));
  polygon(ctx, [[-3.5, 5.4], [-1.9, 5.8], [0, 6.9], [2.3, 5.6], [3.6, 5.2], [3.1, 7.3], [0, 8], [-3.1, 7]], color(m.shadow));
  line(ctx, [[-3, 5.8], [0, 7.2], [3.1, 5.6]], color(m.edge), .65);
  if (appearance) {
    drawGearShapes(ctx, appearanceHeadShapes(appearance, facing, !!piece), color);
    if (piece) drawGearShapes(ctx, armorShapes('head', piece, facing), color);
    ctx.restore(); return;
  }
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

/** Bound spellbooks face their owner; luminous orbs levitate above the palm. */
export function heldFocus(ctx: CanvasRenderingContext2D, hand: Point, visual: FocusDefinition['visual'], color: Color, time = 0, facing = Math.PI / 2): void {
  ctx.save(); ctx.translate(hand[0], hand[1]);
  drawGearShapes(ctx, focusShapes(visual, time, facing), color);
  const [cx, cy] = focusGlowCenter(visual, time);
  drawEquipmentGlow(ctx, cx, cy, visual.kind === 'orb' ? 10 : 5, visual.glow, .5 + Math.sin(time * 1.6) * .06);
  ctx.restore();
}
