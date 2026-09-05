import type { ActionResult, CharacterSheet, SkillId, StatKey, StatModifiers } from './character-types.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';

export type SkillDomain = 'Might' | 'Cunning' | 'Arcana';
export interface SkillNode {
  readonly id: string; readonly name: string; readonly description: string;
  readonly x: number; readonly y: number;
  readonly kind: 'origin' | 'minor' | 'major' | 'notable';
  readonly domain: SkillDomain;
  readonly bonuses: Readonly<StatModifiers>;
  readonly skill?: SkillId;
  readonly neighbors: readonly string[];
}
export interface SkillEdge { readonly from: string; readonly to: string; }
export const SKILL_TREE_ORIGIN = 'origin';

const DIRECTIONS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] as const;
const DOMAINS: readonly SkillDomain[] = ['Might', 'Cunning', 'Arcana'];
const MINORS: Readonly<Record<SkillDomain, readonly { name: string; bonuses: StatModifiers }[]>> = {
  Might: [
    { name: 'Tempered Edge', bonuses: { damagePercent: 4 } }, { name: 'Iron Constitution', bonuses: { vitality: 2 } },
    { name: 'Unbroken', bonuses: { armor: 6 } }, { name: 'Resolute', bonuses: { strength: 2 } },
    { name: 'Bloodwell', bonuses: { maxHp: 8 } }, { name: 'Battle Rhythm', bonuses: { attackSpeedPercent: 2 } },
  ],
  Cunning: [
    { name: 'Keen Eye', bonuses: { critChance: 1 } }, { name: 'Swift Hand', bonuses: { attackSpeedPercent: 2 } },
    { name: 'Wayfarer', bonuses: { moveSpeedPercent: 1 } }, { name: 'Precision', bonuses: { dexterity: 2 } },
    { name: 'Vital Strike', bonuses: { critDamage: 4 } }, { name: 'Sharpened Instinct', bonuses: { damagePercent: 4 } },
  ],
  Arcana: [
    { name: 'Inner Flame', bonuses: { spellDamagePercent: 4 } }, { name: 'Deep Reserves', bonuses: { maxMana: 7 } },
    { name: 'Attunement', bonuses: { intelligence: 2 } }, { name: 'Quiet Current', bonuses: { manaRegen: .15 } },
    { name: 'Continuum', bonuses: { cooldownPercent: 1 } }, { name: 'Spirit Ward', bonuses: { maxHp: 8 } },
  ],
};
const NOTABLES: Readonly<Record<SkillDomain, readonly { name: string; bonuses: StatModifiers }[]>> = {
  Might: [{ name: 'Heart of Iron', bonuses: { maxHp: 24, armor: 12 } }, { name: 'Sanguine Edge', bonuses: { damagePercent: 8, lifeOnHit: 1 } }, { name: 'Titan Grip', bonuses: { strength: 5, damagePercent: 6 } }],
  Cunning: [{ name: 'Ghost Step', bonuses: { dexterity: 4, moveSpeedPercent: 3 } }, { name: 'Perfect Opening', bonuses: { critChance: 2, critDamage: 12 } }, { name: 'Waking Steel', bonuses: { attackSpeedPercent: 6, damagePercent: 4 } }],
  Arcana: [{ name: 'Astral Reservoir', bonuses: { maxMana: 20, manaRegen: .4 } }, { name: 'Eventide', bonuses: { spellDamagePercent: 12, cooldownPercent: 2 } }, { name: 'Soul Stitch', bonuses: { intelligence: 4, lifeRegen: .4 } }],
};
const MAJOR_SKILLS: readonly SkillId[] = ['cleave', 'lunge', 'volley', 'siphon', 'nova', 'ember'];
const CONSTELLATIONS = ['Crown', 'Lantern', 'Warden', 'Serpent', 'Pilgrim', 'Chalice', 'Herald', 'Veil', 'Spire', 'Watcher', 'Horizon'];
const cellKey = (q: number, r: number) => `${q},${r}`;
const hubId = (q: number, r: number) => q === 0 && r === 0 ? SKILL_TREE_ORIGIN : `star:${q}:${r}:heart`;
const spokeId = (q: number, r: number, side: number) => `star:${q}:${r}:${side}`;
const position = (q: number, r: number) => ({ x: 220 * (q + r / 2), y: 220 * Math.sqrt(3) / 2 * r });
function domainAt(x: number, y: number): SkillDomain {
  const angle = (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2);
  return DOMAINS[Math.floor(((angle + Math.PI / 6) % (Math.PI * 2)) / (Math.PI * 2 / 3))];
}

function buildTree(): { readonly nodes: readonly SkillNode[]; readonly edges: readonly SkillEdge[] } {
  const nodes: Array<Omit<SkillNode, 'neighbors'> & { neighbors: string[] }> = [], edges: SkillEdge[] = [];
  const byId = new Map<string, typeof nodes[number]>(), cells = new Set<string>();
  const add = (node: typeof nodes[number]) => { nodes.push(node); byId.set(node.id, node); };
  const link = (from: string, to: string) => {
    const a = byId.get(from), b = byId.get(to);
    if (!a || !b || a.neighbors.includes(to)) return;
    a.neighbors.push(to); b.neighbors.push(from); edges.push(Object.freeze({ from, to }));
  };
  for (let q = -11; q <= 11; q++) for (let r = -11; r <= 11; r++) {
    if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > 11) continue;
    cells.add(cellKey(q, r));
    const { x, y } = position(q, r), origin = q === 0 && r === 0;
    const distance = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
    const domain = origin ? 'Might' : domainAt(x, y);
    const index = Math.abs(q * 17 + r * 29), notable = NOTABLES[domain][index % 3];
    const majorIndex = DIRECTIONS.findIndex(([dq, dr]) => dq === q && dr === r);
    const skill = majorIndex >= 0 ? MAJOR_SKILLS[majorIndex] : undefined;
    const major = skill ? SKILL_DEFINITIONS[skill] : undefined;
    add({ id: hubId(q, r), x, y, kind: origin ? 'origin' : major ? 'major' : 'notable', domain,
      name: origin ? 'The First Star' : major?.name ?? `${notable.name} · ${CONSTELLATIONS[distance - 1]}`,
      description: origin ? 'Every path begins here. Shape your character by connecting constellations of strength, precision, and the arcane.'
        : major ? major.description : `A ${domain.toLowerCase()} constellation. Its heart grants a concentrated bonus.`,
      bonuses: Object.freeze(origin || major ? {} : { ...notable.bonuses }), ...(skill ? { skill } : {}), neighbors: [] });
    for (let side = 0; side < 6; side++) {
      const angle = side * Math.PI / 3, nodeDomain = origin ? domainAt(Math.cos(angle), Math.sin(angle)) : domain;
      const minor = MINORS[nodeDomain][(index + side) % 6];
      add({ id: spokeId(q, r, side), x: x + Math.cos(angle) * 63, y: y + Math.sin(angle) * 63,
        kind: 'minor', domain: nodeDomain, name: minor.name, description: `A minor star in the ${nodeDomain.toLowerCase()} path.`,
        bonuses: Object.freeze({ ...minor.bonuses }), neighbors: [] });
    }
  }
  for (const cell of cells) {
    const [q, r] = cell.split(',').map(Number);
    for (let side = 0; side < 6; side++) {
      link(hubId(q, r), spokeId(q, r, side));
      link(spokeId(q, r, side), spokeId(q, r, (side + 1) % 6));
      const [dq, dr] = DIRECTIONS[side];
      if (cells.has(cellKey(q + dq, r + dr))) link(spokeId(q, r, side), spokeId(q + dq, r + dr, (side + 3) % 6));
    }
  }
  for (const node of nodes) { Object.freeze(node.neighbors); Object.freeze(node); }
  return Object.freeze({ nodes: Object.freeze(nodes), edges: Object.freeze(edges) });
}

/** 397 connected constellations, seven stars apiece: 2,779 stable nodes. */
export const SKILL_TREE = buildTree();
export const SKILL_NODES: ReadonlyMap<string, SkillNode> = new Map(SKILL_TREE.nodes.map(node => [node.id, node]));

/** Merge only real, unique allocations. Repeated or unknown IDs never add power. */
export function getTreeBonuses(ids: readonly string[]): StatModifiers {
  const result: StatModifiers = {};
  for (const id of new Set(ids)) {
    const node = SKILL_NODES.get(id);
    if (!node) continue;
    for (const [key, value] of Object.entries(node.bonuses) as [StatKey, number][]) result[key] = (result[key] ?? 0) + value;
  }
  return result;
}
export function unlockedSkills(ids: readonly string[]): SkillId[] {
  const result = new Set<SkillId>();
  for (const id of ids) { const skill = SKILL_NODES.get(id)?.skill; if (skill) result.add(skill); }
  return [...result];
}
export function allocateNode(sheet: CharacterSheet, nodeId: string): ActionResult {
  const node = SKILL_NODES.get(nodeId);
  if (!node) return { ok: false, message: 'Unknown star.' };
  if (sheet.allocatedNodes.includes(nodeId)) return { ok: false, message: 'Already allocated.' };
  if (!Number.isSafeInteger(sheet.skillPoints) || sheet.skillPoints < 1) return { ok: false, message: 'Earn a skill point by leveling up.' };
  if (!node.neighbors.some(id => sheet.allocatedNodes.includes(id))) return { ok: false, message: 'Connect this star to your allocated path first.' };
  sheet.allocatedNodes.push(nodeId); sheet.skillPoints--;
  return { ok: true };
}
