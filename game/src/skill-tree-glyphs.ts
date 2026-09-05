import type { StatKey } from './character-types.ts';
import { skillIconSVG } from './skill-content.ts';
import type { SkillNode } from './skill-tree.ts';

/** Engravings share a 40-unit drawing space with the active-skill illustrations. */
const ENGRAVINGS = Object.freeze({
  origin: 'M20 3 24 15 37 20 24 25 20 37 16 25 3 20 16 15ZM20 11v18M11 20h18',
  sword: 'M12 29 27 6 32 4 31 10 16 32ZM8 25l13 9M12 30l-5 7M5 35l4 4M24 13l3 2',
  heart: 'M20 34C15 29 5 22 5 14 5 5 16 4 20 12 24 4 35 5 35 14 35 22 25 29 20 34ZM8 19h7l3-5 4 11 3-6h7',
  shield: 'M20 4C14 8 9 9 5 9v12c0 7 8 13 15 16 7-3 15-9 15-16V9c-4 0-9-1-15-5ZM20 10v20M11 16h18M13 25l7 5 7-5',
  daggers: 'M8 5 17 18 17 25 12 21 6 9ZM25 16 32 5 34 9 29 20 24 24ZM11 25l10-9M12 22l13 14M22 20l-8 15M21 35l5-3M12 33l5 3',
  eye: 'M3 20C12 6 28 6 37 20 28 34 12 34 3 20ZM20 13a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 17v6M17 20h6M20 3v4M20 33v4',
  impact: 'M22 3 23 15 35 10 28 21 37 26 24 26 19 37 17 26 5 30 12 20 3 14 16 15ZM20 16l-3 7 7-4M8 5l3 4M31 34l-3-4',
  cadence: 'M9 8 20 17 17 20 6 9ZM25 21l9 10-1 3-12-10ZM7 24c-2-8 2-16 9-19M5 21l2 5 5-2M33 16c2 8-2 16-9 19M35 19l-2-5-5 2M15 11l14 15',
  boots: 'M14 5h11l-2 16 8 6c4 1 5 5 3 8H7v-8l6-7ZM14 11h10M13 17h10M9 28h8l6-5M7 31h27M4 14h5M2 20h6',
  flame: 'M23 3c1 10 11 12 10 23-1 8-8 12-15 10C6 34 3 24 9 16c0 6 3 7 5 6-1-8 6-10 9-19ZM21 19c1 7 6 8 5 12-1 5-8 5-10 0-1-4 3-7 5-12Z',
  book: 'M20 12C13 7 8 7 4 9v24c5-2 10-1 16 3 6-4 11-5 16-3V9c-4-2-9-2-16 3ZM20 12v24M8 14l8 2M8 20l8 2M8 26l8 2M25 16l6-2M25 22l6-2M25 28l6-2M20 3v3',
  mana: 'M20 3C16 11 7 19 7 25a13 13 0 0 0 26 0c0-6-9-14-13-22ZM13 25c0 5 3 7 7 7M17 19l3-5 3 5M26 23v4',
  current: 'M20 4c-3 6-8 11-8 15a8 8 0 0 0 16 0c0-4-5-9-8-15ZM6 25c-4 2-4 5 0 7 6 4 22 4 28 0 4-2 4-5 0-7M7 24l-2 4 5 1M14 29h12M17 19l3 3 3-3',
  leaf: 'M32 5C16 4 5 12 7 25c2 9 11 13 19 8 8-6 8-17 6-28ZM9 31 28 11M12 25l-1-8M17 20l9 1M22 15l-1-6M5 36l4-5',
  hourglass: 'M10 4h20M10 36h20M12 4v8c0 4 5 6 8 8-3 2-8 4-8 8v8M28 4v8c0 4-5 6-8 8 3 2 8 4 8 8v8M13 9h14M13 31h14M16 13l4 3 4-3M16 28l4-4 4 4',
  leech: 'M11 29 25 6 30 4 29 10 15 32ZM7 25l12 8M12 31l-5 6M29 21c-2 5-6 8-6 11a6 6 0 0 0 12 0c0-3-4-6-6-11ZM28 31v3',
});

type EngravingId = keyof typeof ENGRAVINGS;
interface StatGlyph { readonly engraving: EngravingId; readonly unit: number; }

// Compare contributions in the same units as an ordinary minor node. This keeps
// a raw pool bonus such as +24 life from outweighing every smaller-valued stat.
const STAT_GLYPHS: Readonly<Record<StatKey, StatGlyph>> = Object.freeze({
  strength: { engraving: 'sword', unit: 2 },
  vitality: { engraving: 'heart', unit: 2 },
  dexterity: { engraving: 'daggers', unit: 2 },
  intelligence: { engraving: 'book', unit: 2 },
  maxHp: { engraving: 'heart', unit: 8 },
  maxMana: { engraving: 'mana', unit: 7 },
  armor: { engraving: 'shield', unit: 6 },
  damagePercent: { engraving: 'sword', unit: 4 },
  attackSpeedPercent: { engraving: 'cadence', unit: 2 },
  critChance: { engraving: 'eye', unit: 1 },
  critDamage: { engraving: 'impact', unit: 4 },
  moveSpeedPercent: { engraving: 'boots', unit: 1 },
  spellDamagePercent: { engraving: 'flame', unit: 4 },
  manaRegen: { engraving: 'current', unit: .15 },
  lifeRegen: { engraving: 'leaf', unit: .15 },
  cooldownPercent: { engraving: 'hourglass', unit: 1 },
  lifeOnHit: { engraving: 'leech', unit: .5 },
});

function engravingFor(node: SkillNode): EngravingId {
  if (node.kind === 'origin') return 'origin';
  let engraving: EngravingId = node.domain === 'Might' ? 'sword' : node.domain === 'Cunning' ? 'daggers' : 'book';
  let strongest = 0;
  for (const [stat, value] of Object.entries(node.bonuses) as [StatKey, number][]) {
    const glyph = STAT_GLYPHS[stat], strength = Math.abs(value) / glyph.unit;
    if (strength > strongest) { engraving = glyph.engraving; strongest = strength; }
  }
  return engraving;
}

/** Native UI and Canvas both consume the original active-skill illustration. */
export function skillNodeIconSVG(node: SkillNode, size = 32): string {
  if (node.skill) return skillIconSVG(node.skill, size);
  const dimension = Number.isFinite(size) ? Math.max(8, Math.min(256, size)) : 32;
  return `<svg aria-hidden="true" width="${dimension}" height="${dimension}" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ENGRAVINGS[engravingFor(node)]}"/></svg>`;
}

interface CanvasGlyph { readonly paths: readonly Path2D[]; readonly width: number; }
const canvasGlyphs = new Map<string, CanvasGlyph>();

/**
 * The authored SVG vocabulary is deliberately only paths and circles. Read that
 * tiny vocabulary directly so no image loading, DOM parsing, or duplicate skill
 * geometry is needed. Path2D objects are created lazily in the rendering layer.
 */
function canvasGlyph(node: SkillNode): CanvasGlyph {
  const key = node.skill ? `skill:${node.skill}` : engravingFor(node);
  const cached = canvasGlyphs.get(key);
  if (cached) return cached;
  const svg = skillNodeIconSVG(node), paths: Path2D[] = [];
  for (const match of svg.matchAll(/<path\s+d="([^"]+)"/g)) paths.push(new Path2D(match[1]));
  for (const match of svg.matchAll(/<circle\s+cx="([\d.]+)"\s+cy="([\d.]+)"\s+r="([\d.]+)"/g)) {
    const path = new Path2D();
    path.arc(Number(match[1]), Number(match[2]), Number(match[3]), 0, Math.PI * 2);
    paths.push(path);
  }
  const result = { paths, width: node.skill ? 1.6 : 1.8 };
  canvasGlyphs.set(key, result);
  return result;
}

/** Draw a centered, scalable engraving without creating per-node image assets. */
export function drawSkillGlyph(c: CanvasRenderingContext2D, node: SkillNode, x: number, y: number, size: number, color: string): void {
  if (!Number.isFinite(size) || size <= 0) return;
  const glyph = canvasGlyph(node);
  c.save();
  c.translate(x - size / 2, y - size / 2);
  c.scale(size / 40, size / 40);
  c.strokeStyle = color;
  c.lineWidth = glyph.width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const path of glyph.paths) c.stroke(path);
  c.restore();
}
