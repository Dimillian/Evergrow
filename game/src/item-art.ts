import { charmShapes } from './charm-shapes.ts';
import { armorAccessoryShapes } from './armor-accessory-shapes.ts';
import { bootShapes } from './boot-shapes.ts';
import { jewelryShapes } from './jewelry-shapes.ts';
import { focusShapes } from './focus-shapes.ts';
import { armorShapes } from './armor-shapes.ts';
import type { ArmorPiece, CharacterOutfit } from './art-types.ts';
import type { CharacterSheet, Item } from './character-types.ts';
import { STARTING_SWORD } from './equipment.ts';
import { gearShapesSVG, shieldShapes, weaponShapes, type GearShape } from './weapon-shapes.ts';
import { type Point } from './art-primitives.ts';

const safeColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value) ? value : '#798590';
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

const dropShapes = new WeakMap<Item, readonly GearShape[]>();

/** Small world drops preserve the equipped silhouette and material. The geometry
 * cache follows the item lifetime; it does not accumulate an unbounded ID map. */
export function itemDropShapes(item: Item): readonly GearShape[] {
  const cached = dropShapes.get(item);
  if (cached) return cached;
  const { base, shadow, edge, trim } = item.appearance;
  const piece: ArmorPiece = { style: item.appearance.style, seed: item.seed, material: { base, shadow, edge, trim, surface: item.appearance.surface } };
  let shapes: readonly GearShape[], angle = 0;
  switch (item.kind) {
    case 'charm': shapes = charmShapes(item); break;
    case 'weapon': shapes = weaponShapes(item.weapon?.visual ?? STARTING_SWORD.visual); angle = -.52; break;
    case 'grimoire': case 'orb': shapes = focusShapes(item.focus!.visual); break;
    case 'shield': shapes = shieldShapes(item.shield?.visual ?? { kind: 'kite', base, shadow, edge, trim }); break;
    case 'head': shapes = armorShapes('head', piece); break;
    case 'chest': shapes = armorShapes('chest', piece); break;
    case 'cloak': shapes = armorAccessoryShapes('cloak',piece); break;
    case 'gloves': shapes = [-1,1].flatMap(side => [
      ...armorAccessoryShapes('bracer',piece).map(s=>({...s,points:s.points.map(([x,y]):Point=>[side*4+x,y-8])})),
      ...armorAccessoryShapes('glove',piece).map(s=>({...s,points:s.points.map(([x,y]):Point=>[side*4+x*1.25,y*1.25-.6])})),
    ]); break;
    case 'legs': shapes = [-1,1].flatMap(side => [
      ...armorAccessoryShapes('thigh',piece).map(s=>({...s,points:s.points.map(([x,y]):Point=>[side*2.6+x,y-8])})),
      ...armorAccessoryShapes('knee',piece).map(s=>({...s,points:s.points.map(([x,y]):Point=>[side*2.8+x,y+.1])})),
      ...armorAccessoryShapes('bracer',piece).map(s=>({...s,points:s.points.map(([x,y]):Point=>[side*3+x*.85,y+2])})),
    ]); break;
    case 'boots': shapes = [-1, 1].flatMap(side => bootShapes(piece, side * .3).map(shape => ({ ...shape,
      points: shape.points.map(([x,y]):Point => [x * 1.5 + side * 3.6, y * 1.5 + 3.5]) }))); break;
    case 'ring': case 'amulet': shapes = jewelryShapes(item); break;
  }
  if (shapes.length === 0) return [];
  const rotated = shapes.map(shape => ({ ...shape,
    surface: shape.surface ? { ...shape.surface, normal: [
      shape.surface.normal[0] * Math.cos(angle) - shape.surface.normal[1] * Math.sin(angle),
      shape.surface.normal[0] * Math.sin(angle) + shape.surface.normal[1] * Math.cos(angle),
      shape.surface.normal[2]] as const } : undefined,
    points: shape.points.map(([x, y]): Point => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)]) }));
  const points = rotated.flatMap(shape => shape.points), xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const target = item.kind === 'weapon' ? 22 : item.kind === 'ring' || item.kind === 'amulet' ? 12 : 16;
  const scale = target / Math.max(1, maxX - minX, maxY - minY);
  const result = rotated.map(shape => ({ ...shape, width: (shape.width ?? .7) * scale,
    points: shape.points.map(([x, y]): Point => [(x - (minX + maxX) / 2) * scale, (y - (minY + maxY) / 2) * scale]) }));
  dropShapes.set(item, result);
  return result;
}

/** Inventory silhouettes share each item's material and weapon dimensions with its worn art. */
export function itemIconSVG(item: Item, size = 48): string {
  const pixels = Number.isFinite(size) ? Math.max(16, Math.min(512, Math.round(size))) : 48;
  const prefix = `itm-${item.id.replace(/[^a-z0-9-]/gi, '')}-${pixels}`;
  const base = safeColor(item.appearance.base), shadow = safeColor(item.appearance.shadow);
  const edge = safeColor(item.appearance.edge), trim = safeColor(item.appearance.trim);
  const armorPiece: ArmorPiece = { style: item.appearance.style, seed: item.seed, material: { base, shadow, edge, trim, surface: item.appearance.surface } };
  const fine = pixels >= 96;
  let surfaceIndex = 0;
  const detailed = (shapes: readonly GearShape[]) => {
    return gearShapesSVG(shapes, fine, `${prefix}-${surfaceIndex++}`);
  };
  let shape: string;
  switch (item.kind) {
    case 'charm': shape = `<g transform="translate(24 24) scale(2.3)">${detailed(itemDropShapes(item))}</g>`; break;
    case 'weapon': {
      const visual = item.weapon?.visual ?? STARTING_SWORD.visual;
      const shapes = weaponShapes(visual);
      if (shapes.length === 0) { shape = ''; break; }
      const degrees = visual.kind === 'bow' ? -18 : -52;
      const angle = degrees * Math.PI / 180;
      const points = shapes.flatMap(shape => shape.points.map(([x, y]) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)]));
      const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
      const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
      const occupancy = visual.kind === 'wand' ? .72 : visual.kind === 'dagger' ? .78 : visual.kind === 'mace' && visual.length < 26 ? .9 : 1;
      const scale = occupancy * Math.min(37 / Math.max(1, maxX - minX), 40 / Math.max(1, maxY - minY));
      shape = `<g transform="translate(24 24) scale(${scale}) translate(${-(minX + maxX) / 2} ${-(minY + maxY) / 2}) rotate(${degrees})">${detailed(shapes)}</g>`;
      break;
    }
    case 'grimoire': case 'orb': {
      shape = `<g transform="translate(24 ${item.kind === 'orb' ? 39 : 33}) scale(${item.kind === 'orb' ? 2.3 : 2.15})">${detailed(focusShapes(item.focus!.visual))}</g>`;
      break;
    }
    case 'shield': {
      const visual = item.shield?.visual ?? { kind: 'kite', base, edge, trim, shadow };
      shape = `<g transform="translate(24 23) scale(1.45)">${detailed(shieldShapes(visual))}</g>`;
      break;
    }
    case 'head':
      shape = `<g transform="translate(24 23) scale(3.3)"><path d="M-4-.5H4V4L0 5L-4 4Z" fill="${shadow}"/>${detailed(armorShapes('head', armorPiece))}</g>`;
      break;
    case 'chest':
      shape = `<g transform="translate(24 ${armorPiece.style==='cloth'?16:19}) scale(${armorPiece.style==='cloth'?1.5:2.15})">
        <path d="M-5-5H5L6 9L3 11H-3L-6 9Z" fill="${shadow}"/>
        <g transform="translate(-6 -4) rotate(18)">${detailed(armorShapes('shoulder', armorPiece))}</g>
        <g transform="translate(6 -4) scale(-1 1) rotate(18)">${detailed(armorShapes('shoulder', armorPiece))}</g>
        ${detailed(armorShapes('chest', armorPiece))}</g>`;
      break;
    case 'gloves': case 'legs': case 'cloak':
      shape = `<g transform="translate(24 24) scale(2.25)">${detailed(itemDropShapes(item))}</g>`;
      break;
    case 'boots':
      shape = [-1, 1].map(side => `<g transform="translate(${24 + side * 10} 36) scale(4)">${detailed(bootShapes(armorPiece, side * .3))}</g>`).join('');
      break;
    case 'amulet': case 'ring':
      shape = `<g transform="translate(24 24) scale(2.05)">${detailed(jewelryShapes(item))}</g>`;
      break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><title>${escape(item.name)}</title>
    <ellipse cx="24" cy="42" rx="15" ry="3" fill="#05090e" opacity=".45"/>${shape}</svg>`;
}

/** Upright, aspect-correct art for rectangular pack footprints. */
export function itemPackIconSVG(item: Item, width: number, height: number): string {
  let shapes = item.kind === 'weapon' ? weaponShapes(item.weapon?.visual ?? STARTING_SWORD.visual) : itemDropShapes(item);
  if (item.kind === 'weapon' && item.weapon?.family !== 'bow') shapes = shapes.map(shape => ({ ...shape, points: shape.points.map(([x, y]): Point => [y, -x]) }));
  const points = shapes.flatMap(shape => shape.points);
  if (!points.length) return '';
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = width * 40, h = height * 40;
  const scale = Math.min((w - 16) / Math.max(1, maxX - minX), (h - 18) / Math.max(1, maxY - minY));
  const prefix = `pack-${item.id.replace(/[^a-z0-9-]/gi, '')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"><g transform="translate(${w / 2} ${h / 2}) scale(${scale}) translate(${-(minX + maxX) / 2} ${-(minY + maxY) / 2})">${gearShapesSVG(shapes, true, prefix)}</g></svg>`;
}

function armor(item: Item | null): ArmorPiece | null {
  if (!item) return null;
  const { base, shadow, edge, trim, style } = item.appearance;
  return { style, seed: item.seed, material: { base, shadow, edge, trim, surface: item.appearance.surface } };
}

/** Explicit empty pieces remove equipment from both the paper doll and world character. */
export function outfitFromEquipment(sheet: CharacterSheet): Partial<CharacterOutfit> {
  const { head, chest, gloves, legs, boots, cloak } = sheet.equipped;
  const shoulders = armor(chest);
  return {
    head: armor(head), chest: armor(chest), shoulders: shoulders ? { ...shoulders, seed: shoulders.seed + 25 } : null,
    hands: armor(gloves), legs: armor(legs), boots: armor(boots),
    cloak: cloak ? { base: cloak.appearance.base, shadow: cloak.appearance.shadow, highlight: cloak.appearance.edge,
      trim: cloak.appearance.trim, seed: cloak.seed } : null,
  };
}
