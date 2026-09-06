import type { ActionResult, CharacterSheet, DerivedCharacterStats, SkillId } from './character-types.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { SKILL_EXECUTION, type SkillExecution } from './skill-execution-content.ts';

export interface SkillSpecialization {
  readonly id: string; readonly skill: SkillId; readonly name: string; readonly description: string;
  readonly mana: number; readonly damage: number;
}
const spec = (id: string, skill: SkillId, name: string, description: string, mana: number, damage = 1): SkillSpecialization =>
  Object.freeze({ id, skill, name, description, mana, damage });
export const SKILL_SPECIALIZATIONS: readonly SkillSpecialization[] = Object.freeze([
  spec('cleave-reach', 'cleave', 'Reaching Crescent', '40% more reach, 15% less hit damage. Costs 30% more mana.', 1.3, .85),
  spec('cleave-force', 'cleave', 'Crushing Crescent', '35% more damage, 20% less reach. Costs 60% more mana.', 1.6, 1.35),
  spec('whirlwind-reach', 'whirlwind', 'Gathering Steel', '45% more reach, 20% less damage. Costs 35% more mana.', 1.35, .8),
  spec('whirlwind-force', 'whirlwind', 'Iron Cyclone', '40% more damage, 15% less reach. Costs 70% more mana.', 1.7, 1.4),
  spec('shield-wide', 'shieldBash', 'Shield Wall', 'A wider, longer shield strike; 15% less damage. Costs 35% more mana.', 1.35, .85),
  spec('shield-force', 'shieldBash', 'Bellringer', '40% more damage and a longer stun. Costs 75% more mana.', 1.75, 1.4),
  spec('volley-fan', 'volley', 'Thornburst', 'Five arrows instead of three, each dealing 25% less damage. Costs 50% more mana.', 1.5, .75),
  spec('volley-pierce', 'volley', 'Barbed Volley', 'Each arrow pierces one additional enemy. Costs 65% more mana.', 1.65),
  spec('ricochet-chain', 'ricochet', 'Endless Pursuit', 'Three extra rebounds, 15% less damage. Costs 55% more mana.', 1.55, .85),
  spec('ricochet-force', 'ricochet', 'Heavy Rebound', '50% more damage, only one rebound. Costs 40% more mana.', 1.4, 1.5),
  spec('backstab-reach', 'backstab', 'Long Shadow', '50% more reach, 10% less damage. Costs 30% more mana.', 1.3, .9),
  spec('backstab-rear', 'backstab', 'Executioner', 'Rear strikes deal 3× instead of 2× damage; other hits deal 15% less. Costs 70% more mana.', 1.7, .85),
  spec('fireball-fork', 'fireball', 'Forked Flame', 'Three fireballs, each dealing 35% less damage. Costs 80% more mana.', 1.8, .65),
  spec('fireball-ember', 'fireball', 'Living Ember', 'Explosions leave burning ground for three seconds. Costs 65% more mana.', 1.65),
  spec('arc-circuit', 'arcLightning', 'Storm Circuit', 'Three extra jumps may revisit targets at reduced damage. Costs 70% more mana.', 1.7),
  spec('arc-focus', 'arcLightning', 'Concentrated Current', '60% more damage, but only three targets. Costs 45% more mana.', 1.45, 1.6),
  spec('nova-echo', 'iceNova', 'Echoing Frost', 'A second nova expands after 0.6 seconds at 60% damage. Costs 70% more mana.', 1.7),
  spec('nova-deep', 'iceNova', 'Deep Winter', '30% more radius and a stronger, longer slow; 15% less damage. Costs 40% more mana.', 1.4, .85),
  spec('meteor-shards', 'meteor', 'Shattered Sky', 'Five smaller impacts spread across the target area at 45% damage each. Costs 90% more mana; 25% longer cooldown.', 1.9, .45),
]);
export const OVERLOAD_NODE = 'keystone:arcane-overload';
export const specializationNode = (id: string) => `specialization:${id}`;
export const masteryNode = (id: SkillId) => `mastery:${id}`;
export function learnedSkillRank(sheet: CharacterSheet, id: SkillId): number {
  return sheet.allocatedNodes.includes(`skill:${id}`) ? sheet.skillRanks[id] ?? 1 : 0;
}
export function maximumSkillRank(sheet: CharacterSheet, id: SkillId): number {
  return sheet.allocatedNodes.includes(masteryNode(id)) ? 7 : 5;
}
export function activeSkillRank(sheet: CharacterSheet, id: SkillId): number {
  return Math.min(learnedSkillRank(sheet, id), sheet.activeSkillRanks[id] ?? learnedSkillRank(sheet, id));
}
export function selectedSpecialization(sheet: CharacterSheet, id: SkillId): SkillSpecialization | undefined {
  return SKILL_SPECIALIZATIONS.find(s => s.id === sheet.skillSpecializations[id] && s.skill === id && sheet.allocatedNodes.includes(specializationNode(s.id)));
}
export function upgradeSkill(sheet: CharacterSheet, id: SkillId): ActionResult {
  const rank = learnedSkillRank(sheet, id);
  if (!rank || rank >= maximumSkillRank(sheet, id)) return { ok: false, message: 'Unlock the skill or its next mastery rank first.' };
  if (!Number.isSafeInteger(sheet.skillPoints) || sheet.skillPoints < 1) return { ok: false, message: 'Requires one skill point.' };
  sheet.skillRanks[id] = rank + 1; sheet.skillPoints--;
  return { ok: true };
}
export function configureSkill(sheet: CharacterSheet, id: SkillId, rank: number, specialization: string | null): ActionResult {
  if (!Number.isInteger(rank) || rank < 1 || rank > learnedSkillRank(sheet, id)) return { ok: false, message: 'Choose a purchased rank.' };
  if (specialization !== null && !SKILL_SPECIALIZATIONS.some(s => s.id === specialization && s.skill === id && sheet.allocatedNodes.includes(specializationNode(s.id))))
    return { ok: false, message: 'Unlock this specialization first.' };
  sheet.activeSkillRanks[id] = rank;
  if (specialization === null) delete sheet.skillSpecializations[id]; else sheet.skillSpecializations[id] = specialization;
  return { ok: true };
}

/** One immutable cast configuration for combat and every cost/potency readout. */
export function resolveSkill(id: SkillId, stats: Pick<DerivedCharacterStats, 'manaCostMultiplier' | 'cooldownMultiplier'>, sheet?: CharacterSheet, rankOverride?: number) {
  const base = SKILL_DEFINITIONS[id], rank = rankOverride ?? Math.max(1, sheet ? activeSkillRank(sheet, id) : 1);
  const variant = sheet ? selectedSpecialization(sheet, id) : undefined;
  const overload = sheet?.arcaneOverload && sheet.allocatedNodes.includes(OVERLOAD_NODE) && base.domain === 'Arcana';
  const manaGrowth = [1, 14 / 12, 17 / 12, 20 / 12, 2, 2.4, 2.9][rank - 1];
  const multiplier = manaGrowth * (variant?.mana ?? 1) * (overload ? 1.6 : 1);
  const cooldownFloor = id === 'bulwark' ? 4 : base.tier === 'ultimate' ? 12 : 0;
  const rankCooldown = base.tier === 'basic' ? 1 : 1 + .05 * (rank - 1);
  const cooldown = Math.max(cooldownFloor, base.cooldown * stats.cooldownMultiplier * rankCooldown * (variant?.id === 'meteor-shards' ? 1.25 : 1));
  const damageMultiplier = base.damageMultiplier * (1 + .15 * (rank - 1)) * (variant?.damage ?? 1) * (overload ? 1.3 : 1);
  const recipe: SkillExecution = { ...SKILL_EXECUTION[id] };
  // Resolve variations once at release, never by inspecting a player's current gear mid-flight.
  const v = variant?.id;
  if (recipe.kind === 'sweep') {
    if (v === 'cleave-reach') recipe.reachMultiplier *= 1.4;
    if (v === 'cleave-force') recipe.reachMultiplier *= .8;
    if (v === 'whirlwind-reach') recipe.reachMultiplier *= 1.45;
    if (v === 'whirlwind-force') recipe.reachMultiplier *= .85;
  }
  if (recipe.kind === 'cone') {
    if (v === 'shield-wide') { recipe.arc = Math.PI * 1.25; recipe.radius *= 1.3; }
    if (v === 'shield-force') recipe.stun = 1.5;
  }
  if (recipe.kind === 'backstab') {
    if (v === 'backstab-reach') { recipe.reachMultiplier *= 1.5; recipe.minRange *= 1.5; }
    if (v === 'backstab-rear') recipe.rearMultiplier = 3;
  }
  if (recipe.kind === 'projectile') {
    if (v === 'volley-fan') recipe.offsets = [-.4, -.2, 0, .2, .4];
    if (v === 'volley-pierce') recipe.effects = { ...recipe.effects, pierce: 1 };
    if (v === 'ricochet-chain') recipe.effects = { ...recipe.effects, chain: 6 };
    if (v === 'ricochet-force') recipe.effects = { ...recipe.effects, chain: 1 };
    if (v === 'fireball-fork') recipe.offsets = [-.24, 0, .24];
    if (v === 'fireball-ember') recipe.effects = { ...recipe.effects, groundDuration: 3 };
  }
  if (recipe.kind === 'chain') {
    if (v === 'arc-circuit') { recipe.jumps = 8; recipe.revisit = true; recipe.falloff = .7; }
    if (v === 'arc-focus') recipe.jumps = 3;
  }
  if (recipe.kind === 'radial') {
    if (v === 'nova-echo') recipe.echo = true;
    if (v === 'nova-deep') { recipe.radius *= 1.3; recipe.slow = { factor: .3, duration: 4 }; }
  }
  if (recipe.kind === 'ground' && v === 'meteor-shards') recipe.scatter = 5;
  if (recipe.kind === 'guard') recipe.reduction = Math.min(.9, recipe.reduction + .025 * (rank - 1));
  return { rank, variant, damageMultiplier, recipe, mana: Math.max(1, Math.round(base.manaCost * stats.manaCostMultiplier * multiplier * 10) / 10),
    cooldown, upkeep: id === 'tempest' ? Math.round(18 * stats.manaCostMultiplier * multiplier * 10) / 10 : 0 };
}

/** Strict current-format state validation, including point conservation at the save boundary. */
export function validSkillProgression(sheet: CharacterSheet): boolean {
  const records = [sheet.skillRanks, sheet.activeSkillRanks, sheet.skillSpecializations];
  if (records.some(r => !r || typeof r !== 'object' || Array.isArray(r)) || typeof sheet.arcaneOverload !== 'boolean') return false;
  for (const [id, rank] of Object.entries(sheet.skillRanks)) {
    if (!(Object.hasOwn(SKILL_DEFINITIONS, id)) || !sheet.allocatedNodes.includes(`skill:${id}`) || !Number.isInteger(rank) || rank < 2 || rank > maximumSkillRank(sheet, id as SkillId)) return false;
  }
  for (const [id, rank] of Object.entries(sheet.activeSkillRanks)) {
    if (!(Object.hasOwn(SKILL_DEFINITIONS, id)) || !Number.isInteger(rank) || rank < 1 || rank > learnedSkillRank(sheet, id as SkillId)) return false;
  }
  for (const [id, variant] of Object.entries(sheet.skillSpecializations)) {
    if (!learnedSkillRank(sheet, id as SkillId) || !SKILL_SPECIALIZATIONS.some(s => s.skill === id && s.id === variant && sheet.allocatedNodes.includes(specializationNode(s.id)))) return false;
  }
  return !sheet.arcaneOverload || sheet.allocatedNodes.includes(OVERLOAD_NODE);
}
