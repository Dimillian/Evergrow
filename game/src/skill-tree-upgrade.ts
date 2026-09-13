import { PREVIOUS_NODE_IDS, PREVIOUS_EDGES } from './skill-tree-previous.ts';
import { ATLAS_V2_NODE_IDS, ATLAS_V2_EDGES, ATLAS_V2_VARIANTS } from './skill-tree-v2.ts';
import { SKILL_TREE_VERSION } from './skill-tree.ts';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const legacyVariants: Readonly<Record<string, string>> = {"cleave-reach": "cleave", "cleave-force": "cleave", "cleave-economy": "cleave", "lunge-distance": "lunge", "lunge-force": "lunge", "lunge-swift": "lunge", "whirlwind-reach": "whirlwind", "whirlwind-force": "whirlwind", "whirlwind-economy": "whirlwind", "earthshatter-wide": "earthshatter", "earthshatter-force": "earthshatter", "earthshatter-swift": "earthshatter", "shield-wide": "shieldBash", "shield-force": "shieldBash", "shield-control": "shieldBash", "bulwark-duration": "bulwark", "bulwark-reduction": "bulwark", "bulwark-swift": "bulwark", "volley-fan": "volley", "volley-pierce": "volley", "volley-focus": "volley", "piercing-depth": "piercingShot", "piercing-force": "piercingShot", "piercing-twin": "piercingShot", "ricochet-chain": "ricochet", "ricochet-force": "ricochet", "ricochet-economy": "ricochet", "rain-wide": "rainOfArrows", "rain-lasting": "rainOfArrows", "rain-burst": "rainOfArrows", "backstab-reach": "backstab", "backstab-rear": "backstab", "backstab-economy": "backstab", "fireball-fork": "fireball", "fireball-ember": "fireball", "fireball-impact": "fireball", "meteor-shards": "meteor", "meteor-inferno": "meteor", "meteor-impact": "meteor", "nova-echo": "iceNova", "nova-deep": "iceNova", "nova-freeze": "iceNova", "lance-fan": "frostLance", "lance-chill": "frostLance", "lance-force": "frostLance", "arc-circuit": "arcLightning", "arc-focus": "arcLightning", "arc-economy": "arcLightning", "siphon-drain": "siphon", "siphon-pierce": "siphon", "siphon-force": "siphon", "cataclysm-many": "cataclysm", "cataclysm-force": "cataclysm", "cataclysm-fire": "cataclysm", "zero-wide": "absoluteZero", "zero-freeze": "absoluteZero", "zero-burst": "absoluteZero", "tempest-wide": "tempest", "tempest-fast": "tempest", "tempest-still": "tempest"};

function evidence(ids: readonly string[], edges: readonly (readonly [number, number])[], variants: Readonly<Record<string, string>>, version: 1 | 2) {
  const indices = new Map(ids.map((id, index) => [id, index]));
  const graph = ids.map(() => [] as number[]);
  for (const [a, b] of edges) { graph[a].push(b); graph[b].push(a); }
  return { ids, indices, graph, variants, version, skills: new Set(ids.filter(id => id.startsWith('skill:')).map(id => id.slice(6))) };
}
const legacy = evidence(PREVIOUS_NODE_IDS, PREVIOUS_EDGES, legacyVariants, 1);
const atlasV2 = evidence(ATLAS_V2_NODE_IDS, ATLAS_V2_EDGES, ATLAS_V2_VARIANTS, 2);

/** Refund only an allocation proved valid against its published graph, on the parsed copy. */
export function upgradeSkillTree(checkpoint: RecordValue): boolean {
  const sheet = checkpoint.character;
  if (!record(sheet)) return false;
  if (sheet.treeVersion === SKILL_TREE_VERSION) return true;
  const source = sheet.treeVersion === undefined ? legacy : sheet.treeVersion === 2 ? atlasV2 : undefined;
  if (!source || !integer(checkpoint.level, 1, 1000000) || !integer(sheet.skillPoints, 0, 1000000)
    || sheet.treeRefunded !== undefined && sheet.treeRefunded !== true
    || !Array.isArray(sheet.allocatedNodes) || sheet.allocatedNodes.length > source.ids.length
    || !sheet.allocatedNodes.every(id => typeof id === 'string' && source.indices.has(id))
    || new Set(sheet.allocatedNodes).size !== sheet.allocatedNodes.length || !sheet.allocatedNodes.includes('origin')) return false;
  const owned = new Set(sheet.allocatedNodes as string[]);
  const ownedIndices = new Set([...owned].map(id => source.indices.get(id)!));
  const root = source.indices.get('origin')!, reached = new Set([root]), queue = [root];
  for (let i = 0; i < queue.length; i++) for (const next of source.graph[queue[i]]) {
    if (ownedIndices.has(next) && !reached.has(next)) { reached.add(next); queue.push(next); }
  }
  if (reached.size !== owned.size || !record(sheet.skillRanks) || !record(sheet.activeSkillRanks)
    || !record(sheet.skillSpecializations) || typeof sheet.arcaneOverload !== 'boolean'
    || sheet.arcaneOverload && !owned.has('keystone:arcane-overload')) return false;
  const doctrines = new Set<string>();
  for (const id of owned) if (id.startsWith('doctrine:')) {
    const family = id.slice(0, id.lastIndexOf(':'));
    if (doctrines.has(family)) return false;
    doctrines.add(family);
  }
  let paidRanks = 0;
  for (const [id, rank] of Object.entries(sheet.skillRanks)) {
    const maximum = source.version === 2 ? 20 : owned.has(`mastery:${id}`) ? 7 : 5;
    if (!source.skills.has(id) || !owned.has(`skill:${id}`) || !integer(rank, 2, maximum)) return false;
    paidRanks += rank - 1;
  }
  for (const [id, rank] of Object.entries(sheet.activeSkillRanks)) {
    if (!source.skills.has(id) || !owned.has(`skill:${id}`) || !integer(rank, 1, Number(sheet.skillRanks[id] ?? 1))) return false;
  }
  for (const [id, variant] of Object.entries(sheet.skillSpecializations)) {
    if (typeof variant !== 'string' || source.variants[variant] !== id
      || !owned.has(`skill:${id}`) || !owned.has(`specialization:${variant}`)) return false;
  }
  if (sheet.skillPoints + owned.size - 1 + paidRanks !== checkpoint.level - 1
    || !Array.isArray(sheet.skillSlots) || sheet.skillSlots.length !== 5
    || !sheet.skillSlots.every(id => id === null || typeof id === 'string' && source.skills.has(id) && owned.has(`skill:${id}`))
    || new Set(sheet.skillSlots.filter(Boolean)).size !== sheet.skillSlots.filter(Boolean).length
    || !record(checkpoint.skillCooldowns)
    || !Object.entries(checkpoint.skillCooldowns).every(([id, value]) => source.skills.has(id) && owned.has(`skill:${id}`)
      && typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000)) return false;
  sheet.treeVersion = SKILL_TREE_VERSION;
  sheet.skillPoints = checkpoint.level - 1;
  sheet.allocatedNodes = ['origin'];
  sheet.skillRanks = {}; sheet.activeSkillRanks = {}; sheet.skillSpecializations = {};
  sheet.skillSlots = [null, null, null, null, null]; sheet.arcaneOverload = false;
  if (owned.size > 1 || paidRanks > 0) sheet.treeRefunded = true;
  checkpoint.skillCooldowns = {};
  return true;
}
