import type { ArmorPiece, CharacterOutfit } from './art-types.ts';
import type { CharacterSheet, Item } from './character-types.ts';
import { TIER_COLORS } from './items.ts';

const safeColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value) ? value : '#798590';
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

/** Inventory silhouettes share each item's material and weapon dimensions with its worn art. */
export function itemIconSVG(item: Item, size = 48): string {
  const pixels = Number.isFinite(size) ? Math.max(16, Math.min(512, Math.round(size))) : 48;
  const prefix = `itm-${item.id.replace(/[^a-z0-9-]/gi, '')}`;
  const base = safeColor(item.appearance.base), shadow = safeColor(item.appearance.shadow);
  const edge = safeColor(item.appearance.edge), trim = safeColor(item.appearance.trim), rarity = TIER_COLORS[item.tier];
  const metal = `url(#${prefix}-metal)`, cloth = `url(#${prefix}-cloth)`;
  const leather = item.appearance.style === 'leather';
  const plateDetail = `<path d="M20 20L24 23L28 20M24 15V30" fill="none" stroke="${edge}" stroke-width=".8" opacity=".75"/>`;
  let shape: string;
  switch (item.kind) {
    case 'weapon': {
      const weapon = item.weapon?.visual;
      const width = Math.max(1.5, Math.min(3.4, (weapon?.width ?? 3.4) * .6));
      const top = 24 - Math.max(16, Math.min(22, (weapon?.length ?? 30) * .65));
      const grip = safeColor(weapon?.grip ?? shadow), guard = safeColor(weapon?.guard ?? trim);
      shape = `<g transform="rotate(36 24 24)">
        <path d="M${24 - width} 28L${24 - width * .75} ${top + 5}L24 ${top}L${24 + width * .75} ${top + 5}L${24 + width} 28Z" fill="${metal}" stroke="${shadow}" stroke-width="1.2"/>
        <path d="M24 ${top + 1}V28" stroke="${safeColor(weapon?.edge ?? edge)}" stroke-width="1.25"/>
        <path d="M22.2 29H25.8V40H22.2Z" fill="${grip}" stroke="${shadow}" stroke-width="1"/>
        <path d="M22.4 31L25.6 32M22.4 34L25.6 35M22.4 37L25.6 38" stroke="${trim}" stroke-width=".8"/>
        <path d="M15 27L19 26L22 28H26L29 26L33 27L32 30L27 30L24 31L21 30L16 30Z" fill="${guard}" stroke="${shadow}" stroke-width="1"/>
        <path d="M21.5 40L24 38.8L26.5 40L26 42.5L24 44L22 42.5Z" fill="${guard}" stroke="${edge}" stroke-width=".6"/>
        <path d="M23 40L24 39.6L25 40.5L24 42L23 41Z" fill="${rarity}"/>
        ${weapon?.glow ? `<path d="M${24 - width * .75} ${top + 5}L24 ${top}L${24 + width * .75} ${top + 5}" fill="none" stroke="${safeColor(weapon.glow)}" stroke-width="1.2"/>` : ''}
      </g>`;
      break;
    }
    case 'head':
      shape = `<path d="M11 23L14 12L23 7L33 12L37 24L34 39L29 41L27 31H20L18 41L12 37Z" fill="${metal}" stroke="${shadow}" stroke-width="1.5"/>
        <path d="M23 8L21 20L24 25L27 20L25 8" fill="${leather ? shadow : edge}"/>
        <path d="M15 23L22 24V28L14 27ZM26 24L34 22L35 26L26 28Z" fill="${shadow}"/>
        <path d="M14 18L20 16M28 16L33 18M13 33L16 36M31 36L34 31" fill="none" stroke="${trim}" stroke-width="1.2"/>
        <path d="M23 26V36L26 34L26 26" fill="${edge}" opacity=".75"/>`;
      break;
    case 'chest':
      shape = `<path d="M15 9L20 7L24 12L28 7L34 9L43 15L38 23L33 22L33 37L29 42L18 42L14 37L14 22L9 23L5 15Z" fill="${metal}" stroke="${shadow}" stroke-width="1.5"/>
        <path d="M15 10L13 20L7 19L9 13ZM34 10L36 20L41 18L39 13Z" fill="${base}" stroke="${trim}" stroke-width=".8"/>
        <path d="M17 13L21 15H27L31 13L30 28L24 32L17 28Z" fill="${leather ? cloth : metal}" stroke="${edge}" stroke-width=".9"/>
        ${leather ? `<path d="M19 16L21 18M19 21L21 23M19 26L21 28" stroke="${trim}" stroke-width=".8"/>` : plateDetail}
        <path d="M15 33L24 36L33 33M16 37L24 40L32 37" fill="none" stroke="${trim}" stroke-width="1.2"/>
        <path d="M21 33H27V37H21Z" fill="${trim}"/><path d="M23 34H25V36H23Z" fill="${shadow}"/>`;
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
