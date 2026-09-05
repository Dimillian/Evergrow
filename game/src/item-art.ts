import { armorShapes } from './armor-shapes.ts';
import type { ArmorPiece, CharacterOutfit } from './art-types.ts';
import type { CharacterSheet, Item } from './character-types.ts';
import { TIER_COLORS } from './items.ts';
import { STARTING_SWORD } from './equipment.ts';
import { gearShapesSVG, shieldShapes, weaponShapes, type GearShape } from './weapon-shapes.ts';
import type { Point } from './art-primitives.ts';

const safeColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value) ? value : '#798590';
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

const dropShapes = new WeakMap<Item, readonly GearShape[]>();

/** Small world drops preserve the equipped silhouette and material. The geometry
 * cache follows the item lifetime; it does not accumulate an unbounded ID map. */
export function itemDropShapes(item: Item): readonly GearShape[] {
  const cached = dropShapes.get(item);
  if (cached) return cached;
  const { base, shadow, edge, trim } = item.appearance;
  const fill = (points: readonly Point[], color: string): GearShape => ({ points, fill: color });
  const line = (points: readonly Point[], color: string, width = .8): GearShape => ({ points, stroke: color, width });
  const piece: ArmorPiece = { style: item.appearance.style, seed: item.seed, material: { base, shadow, edge, trim } };
  let shapes: readonly GearShape[], angle = 0;
  switch (item.kind) {
    case 'weapon': shapes = weaponShapes(item.weapon?.visual ?? STARTING_SWORD.visual); angle = -.52; break;
    case 'shield': shapes = shieldShapes(item.shield?.visual ?? { kind: 'kite', base, shadow, edge, trim }); break;
    case 'head': shapes = armorShapes('head', piece); break;
    case 'chest': shapes = armorShapes('chest', piece); break;
    case 'cloak': shapes = [fill([[-4, -8], [0, -10], [4, -8], [5, -2], [9, 9], [3, 8], [0, 10], [-4, 8], [-9, 10], [-5, -2]], shadow),
      fill([[-3, -7], [0, -9], [3, -7], [3, -1], [6, 8], [0, 7], [-6, 8], [-3, -1]], base),
      fill([[-3, -7], [0, -9], [-1, 5], [-5, 7]], edge), line([[-6, 8], [0, 7], [6, 8]], trim), line([[-3, -6], [0, -4], [3, -6]], trim)]; break;
    case 'gloves': shapes = [-1, 1].flatMap(side => [fill([[side * 1.5, -8], [side * 6, -8], [side * 6.5, 3], [side * 5.5, 7], [side * 1.5, 8], [side * .8, 3]], base),
      line([[side * 2, -6], [side * 5.5, -6]], trim, 1.2), line([[side * 2, 2], [side * 5.5, 2]], edge),
      line([[side * 3, 4], [side * 3, 6.5]], shadow)]); break;
    case 'legs': shapes = [fill([[-6, -9], [6, -9], [5, -1], [7, 9], [2, 10], [0, 1], [-2, 10], [-7, 9], [-5, -1]], base),
      line([[-5.5, -7], [5.5, -7]], trim, 1.2), line([[-4, -4], [-3.5, 3]], edge), line([[3, -4], [3.5, 3]], shadow, 1.2),
      line([[-5, 4], [-2, 4]], trim), line([[2, 4], [5, 4]], trim)]; break;
    case 'boots': shapes = [-1, 1].flatMap(side => [fill([[side * 1.3, -8], [side * 5.7, -8], [side * 5.2, 1], [side * 7.5, 5], [side * 7.5, 8], [side * 1.5, 8], [side * .5, 5]], base),
      line([[side * 1.8, -5], [side * 5.1, -5]], trim, 1.1), line([[side * 2, -6.5], [side * 2.1, 1.5], [side * 4.7, 4.7]], edge),
      line([[side * 1.5, 7.5], [side * 7, 7.5]], shadow, 1.3)]); break;
    case 'ring': {
      const ring = Array.from({ length: 17 }, (_, i): Point => [Math.cos(i * Math.PI / 8) * 5.6, Math.sin(i * Math.PI / 8) * 6 + 1.5]);
      shapes = [line(ring, shadow, 3.2), line(ring, trim, 2), fill([[-3.5, -7], [0, -9], [3.5, -7], [3, -3], [-3, -3]], trim),
        fill([[-2, -6.6], [0, -7.8], [2, -6.6], [1.7, -4], [-1.7, -4]], TIER_COLORS[item.tier]), line([[-1.8, -6.4], [0, -7.4]], edge)]; break;
    }
    case 'amulet': shapes = [line([[-4, -10], [-7, -6], [-5, -1], [0, 3], [5, -1], [7, -6], [4, -10]], shadow, 1.8),
      line([[-4, -10], [-7, -6], [-5, -1], [0, 3], [5, -1], [7, -6], [4, -10]], trim),
      fill([[0, 0], [5, 4], [4, 9], [0, 12], [-4, 9], [-5, 4]], trim), fill([[0, 2], [3, 4.5], [2.5, 8], [0, 10], [-2.5, 8], [-3, 4.5]], TIER_COLORS[item.tier]),
      fill([[0, 2], [0, 8], [-2.5, 4.5]], edge)]; break;
  }
  if (shapes.length === 0) return [];
  const rotated = shapes.map(shape => ({ ...shape, points: shape.points.map(([x, y]): Point => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)]) }));
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
  const prefix = `itm-${item.id.replace(/[^a-z0-9-]/gi, '')}`;
  const base = safeColor(item.appearance.base), shadow = safeColor(item.appearance.shadow);
  const edge = safeColor(item.appearance.edge), trim = safeColor(item.appearance.trim), rarity = TIER_COLORS[item.tier];
  const metal = `url(#${prefix}-metal)`, cloth = `url(#${prefix}-cloth)`;
  const armorPiece: ArmorPiece = { style: item.appearance.style, seed: item.seed, material: { base, shadow, edge, trim } };
  let shape: string;
  switch (item.kind) {
    case 'weapon': {
      const visual = item.weapon?.visual ?? STARTING_SWORD.visual;
      const shapes = weaponShapes(visual);
      if (shapes.length === 0) { shape = ''; break; }
      const degrees = visual.kind === 'bow' ? -18 : -52;
      const angle = degrees * Math.PI / 180;
      const points = shapes.flatMap(shape => shape.points.map(([x, y]) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)]));
      const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
      const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
      const scale = Math.min(37 / Math.max(1, maxX - minX), 40 / Math.max(1, maxY - minY));
      shape = `<g transform="translate(24 24) scale(${scale}) translate(${-(minX + maxX) / 2} ${-(minY + maxY) / 2}) rotate(${degrees})">${gearShapesSVG(shapes)}</g>`;
      break;
    }
    case 'shield': {
      const visual = item.shield?.visual ?? { kind: 'kite', base, edge, trim, shadow };
      shape = `<g transform="translate(24 23) scale(1.45)">${gearShapesSVG(shieldShapes(visual))}</g>`;
      break;
    }
    case 'head':
      shape = `<g transform="translate(24 23) scale(3.3)"><path d="M-4-.5H4V4L0 5L-4 4Z" fill="${shadow}"/>${gearShapesSVG(armorShapes('head', armorPiece))}</g>`;
      break;
    case 'chest':
      shape = `<g transform="translate(24 19) scale(2.15)">
        <path d="M-5-5H5L6 9L3 11H-3L-6 9Z" fill="${shadow}"/>
        <g transform="translate(-6 -4) rotate(18)">${gearShapesSVG(armorShapes('shoulder', armorPiece))}</g>
        <g transform="translate(6 -4) scale(-1 1) rotate(18)">${gearShapesSVG(armorShapes('shoulder', armorPiece))}</g>
        ${gearShapesSVG(armorShapes('chest', armorPiece))}</g>`;
      break;
    case 'gloves':
      shape = `<g transform="rotate(-14 17 26)"><path d="M10 10H23L22 24L25 29L25 34L22 33L21 42L17 43L10 40L8 30L10 24Z" fill="${metal}" stroke="${shadow}" stroke-width="1.4"/>
        <path d="M10 12H22M11 21H21" stroke="${trim}" stroke-width="1.4"/>
        <path d="M12 25L18 24L21 30L19 34L11 34Z" fill="${base}" stroke="${edge}" stroke-width=".8"/>
        <path d="M12 36V40M15 36V41M18 36V41" stroke="${shadow}" stroke-width="1.1"/></g>
        <g transform="translate(19 -3) rotate(14 17 26) scale(.88)"><path d="M10 10H23L22 24L25 29L25 34L22 33L21 42L17 43L10 40L8 30L10 24Z" fill="${metal}" stroke="${shadow}" stroke-width="1.4"/>
        <path d="M10 12H22M11 21H21M11 32H20" stroke="${trim}" stroke-width="1.2"/>
        <path d="M13 35V40M17 35V41" stroke="${shadow}" stroke-width="1.1"/></g>`;
      break;
    case 'legs':
      shape = `<path d="M13 7H35L34 21L37 41L27 43L24 23L21 43L11 41L14 22Z" fill="${metal}" stroke="${shadow}" stroke-width="1.4"/>
        <path d="M13 10H35M14 15L24 19L34 15" fill="none" stroke="${trim}" stroke-width="1.2"/>
        <path d="M15 20L20 22L20 30L16 32L13 28ZM28 22L33 20L35 28L31 32L28 30Z" fill="${base}" stroke="${edge}" stroke-width=".8"/>
        <path d="M14 35L19 36M29 36L35 35" fill="none" stroke="${trim}" stroke-width="1.4"/>`;
      break;
    case 'boots':
      shape = `<path d="M8 9L22 11L20 28L24 37L24 41L8 42L5 38L8 26Z" fill="${metal}" stroke="${shadow}" stroke-width="1.5"/>
        <path d="M28 8H40L39 27L44 36L44 41H28L25 37L28 25Z" fill="${metal}" stroke="${shadow}" stroke-width="1.5"/>
        <path d="M8 14L21 16M9 24L20 25M28 13H40M28 23H39" stroke="${trim}" stroke-width="1.4"/>
        <path d="M9 32L18 32L22 37L8 37ZM29 32H38L41 36H28Z" fill="${base}" stroke="${edge}" stroke-width=".8"/>
        <path d="M7 40L22 39M28 39H42" stroke="${shadow}" stroke-width="2"/>`;
      break;
    case 'cloak':
      shape = `<path d="M17 7L24 5L31 7L35 13L38 26L44 41L34 39L26 43L18 40L6 43L12 25L13 13Z" fill="${cloth}" stroke="${shadow}" stroke-width="1.5"/>
        <path d="M17 8L18 16L24 18L31 15L31 8L25 12Z" fill="${base}" stroke="${trim}" stroke-width="1.1"/>
        <path d="M19 18L13 38M25 21L24 40M30 18L36 37" fill="none" stroke="${edge}" stroke-width="1.1" opacity=".45"/>
        <path d="M9 40L18 37L26 40L34 36L40 39" fill="none" stroke="${trim}" stroke-width="1"/>
        <path d="M21 15L24 12L27 15L24 19Z" fill="${trim}"/><path d="M23 15L24 14L25 15L24 17Z" fill="${rarity}"/>`;
      break;
    case 'amulet':
      shape = `<path d="M17 6C4 12 9 23 20 30M31 6C44 12 39 23 28 30" fill="none" stroke="${shadow}" stroke-width="3.5"/>
        <path d="M17 6C4 12 9 23 20 30M31 6C44 12 39 23 28 30" fill="none" stroke="${trim}" stroke-width="1.7" stroke-dasharray="2.5 1"/>
        <path d="M21 26L24 23L27 26L27 29H21Z" fill="${trim}"/>
        <path d="M24 28L34 34L31 42L24 46L17 42L14 34Z" fill="${metal}" stroke="${trim}" stroke-width="1.3"/>
        <path d="M24 31L29 35L28 40L24 43L20 40L19 35Z" fill="${rarity}" stroke="${edge}" stroke-width=".7"/>
        <path d="M24 32L24 40L20 36Z" fill="${edge}" opacity=".55"/>`;
      break;
    case 'ring':
      shape = `<ellipse cx="24" cy="28" rx="13" ry="14" fill="none" stroke="${shadow}" stroke-width="7"/>
        <ellipse cx="24" cy="27" rx="13" ry="14" fill="none" stroke="${trim}" stroke-width="4.5"/>
        <path d="M14 23C13 31 18 39 24 39" fill="none" stroke="${edge}" stroke-width="1.1"/>
        <path d="M15 11L21 6H28L34 12L31 21H18Z" fill="${metal}" stroke="${trim}" stroke-width="1.4"/>
        <path d="M21 9H27L30 13L28 18H21L18 13Z" fill="${rarity}" stroke="${edge}" stroke-width=".8"/>
        <path d="M21 10L24 13L20 16L19 13Z" fill="${edge}" opacity=".6"/>
        <path d="M24 13L28 10L29 13L27 17Z" fill="${shadow}" opacity=".35"/>`;
      break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><title>${escape(item.name)}</title>
    <defs><linearGradient id="${prefix}-metal" x1="0" y1="0" x2="1" y2=".65"><stop stop-color="${edge}"/><stop offset=".32" stop-color="${base}"/><stop offset=".59" stop-color="${base}"/><stop offset="1" stop-color="${shadow}"/></linearGradient>
    <linearGradient id="${prefix}-cloth" x1="0" y1="0" x2="1" y2=".3"><stop stop-color="${shadow}"/><stop offset=".28" stop-color="${base}"/><stop offset=".55" stop-color="${base}"/><stop offset="1" stop-color="${shadow}"/></linearGradient></defs>
    <ellipse cx="24" cy="42" rx="15" ry="3" fill="#05090e" opacity=".45"/>${shape}</svg>`;
}

function armor(item: Item | null): ArmorPiece | null {
  if (!item) return null;
  const { base, shadow, edge, trim, style } = item.appearance;
  return { style, seed: item.seed, material: { base, shadow, edge, trim } };
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
