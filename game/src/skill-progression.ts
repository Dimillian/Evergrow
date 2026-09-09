import { AFFIX_COMBAT_RULES } from './equipment-affix-content.ts';
import type { ActionResult, CharacterSheet, DerivedCharacterStats, SkillId } from './character-types.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { SKILL_EXECUTION, type SkillExecution } from './skill-execution-content.ts';

export interface SkillSpecialization {
  readonly id: string; readonly skill: SkillId; readonly name: string; readonly description: string;
  readonly mana: number; readonly damage: number; readonly cooldown: number;
  readonly modify?: (recipe: SkillExecution) => void;
}
const spec = (id: string, skill: SkillId, name: string, description: string, mana: number, damage = 1, cooldown = 1, modify?: (recipe: SkillExecution) => void): SkillSpecialization =>
  Object.freeze({ id, skill, name, description, mana, damage, cooldown, modify });
const change = <K extends SkillExecution['kind']>(kind: K, patch: Partial<Extract<SkillExecution, { kind: K }>>) =>
  (recipe: SkillExecution) => {
    if (recipe.kind !== kind) throw new Error(`Specialization recipe mismatch: ${kind}`);
    for (const [key, value] of Object.entries(patch)) Object.assign(recipe, { [key]:
      Array.isArray(value) ? [...value] : value && typeof value === 'object' ? { ...value } : value });
  };
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
  spec('meteor-shards', 'meteor', 'Shattered Sky', 'Five impacts with 35% smaller radius spread across the target area at 45% damage each. Costs 90% more mana; 25% longer cooldown.', 1.9, .45, 1.25),
  spec("cleave-economy", "cleave", "Measured Cut", "25% less mana, 15% less damage.", 0.75, 0.85, 1, change('sweep', { arc: Math.PI * 1.4 })),
  spec("whirlwind-economy", "whirlwind", "Steady Revolutions", "30% less mana, 20% less damage.", 0.7, 0.8, 1, change('sweep', { arc: Math.PI * 2 })),
  spec("shield-control", "shieldBash", "Concussion", "2-second stun, 30% less damage. Costs 20% more mana.", 1.2, 0.7, 1, change('cone', { stun: 2 })),
  spec("volley-focus", "volley", "Needle Fan", "A tight three-arrow fan; 20% more damage. Costs 35% more mana.", 1.35, 1.2, 1, change('projectile', { offsets: [-.09, 0, .09] })),
  spec("ricochet-economy", "ricochet", "Skipping Arrow", "30% less mana; two rebounds instead of three.", 0.7, 1, 1, change('projectile', { effects: { ...SKILL_EXECUTION.ricochet.effects, chain: 2 } })),
  spec("backstab-economy", "backstab", "Quiet Blade", "35% less mana; rear strikes deal 1.6\u00d7 instead of 2\u00d7 damage.", 0.65, 1, 1, change('backstab', { rearMultiplier: 1.6 })),
  spec("fireball-impact", "fireball", "Flashfire", "40% wider explosion, 20% less damage. Costs 40% more mana.", 1.4, 0.8, 1, change('projectile', { effects: { ...SKILL_EXECUTION.fireball.effects, blastRadius: 119 } })),
  spec("arc-economy", "arcLightning", "Static Thread", "30% less mana, 20% less damage; jumps retain 85% damage.", 0.7, 0.8, 1, change('chain', { falloff: .85 })),
  spec("nova-freeze", "iceNova", "Snap Freeze", "Freezes for 0.6 seconds; 20% smaller radius, 20% less damage. Costs 35% more mana.", 1.35, 0.8, 1, change('radial', { radius: 92, stun: .6 })),
  spec("meteor-inferno", "meteor", "Lasting Inferno", "Ground fire lasts 8 seconds at 18% impact damage per second. Costs 45% more mana.", 1.45, 1, 1, change('ground', { scorch: { duration: 8, interval: .25, damageMultiplier: .18 } })),
  spec("meteor-impact", "meteor", "Worldbreaker", "60% more impact damage, 25% larger radius; no ground fire. Costs 50% more mana; 20% longer cooldown.", 1.5, 1.6, 1.2, change('ground', { radius: 156.25, scorch: undefined })),
  spec("lunge-distance", "lunge", "Farstrike", "50% longer dash, 15% less damage. Costs 20% more mana.", 1.2, 0.85, 1, change('dash', { duration: .36 })),
  spec("lunge-force", "lunge", "Impaling Rush", "50% more damage, 30% wider contact. Costs 50% more mana; 25% longer cooldown.", 1.5, 1.5, 1.25, change('dash', { radius: 29.9 })),
  spec("lunge-swift", "lunge", "Fleeting Step", "30% shorter cooldown and 20% less mana; 25% less damage, shorter dash.", 0.8, 0.75, 0.7, change('dash', { duration: .18 })),
  spec("earthshatter-wide", "earthshatter", "Faultline", "40% wider shockwave, 20% less damage. Costs 30% more mana.", 1.3, 0.8, 1, change('radial', { radius: 175 })),
  spec("earthshatter-force", "earthshatter", "Seismic Hammer", "60% more damage and 2-second stun; 20% smaller radius. Costs 60% more mana; 25% longer cooldown.", 1.6, 1.6, 1.25, change('radial', { radius: 100, stun: 2 })),
  spec("earthshatter-swift", "earthshatter", "Tremor", "35% shorter cooldown, 25% less damage; stun lasts 0.6 seconds.", 1, 0.75, 0.65, change('radial', { stun: .6 })),
  spec("bulwark-duration", "bulwark", "Enduring Guard", "Guard lasts 5 seconds. Costs 50% more mana; 25% longer cooldown.", 1.5, 1, 1.25, change('guard', { duration: 5 })),
  spec("bulwark-reduction", "bulwark", "Iron Aegis", "Base block reduction rises to 85%, guard lasts 2 seconds. Ranks above the 90% block cap add 0.25 seconds each. Costs 35% more mana.", 1.35, 1, 1, change('guard', { reduction: .85, duration: 2 })),
  spec("bulwark-swift", "bulwark", "Ready Guard", "25% less mana and 25% shorter cooldown; guard lasts 2 seconds.", 0.75, 1, 0.75, change('guard', { duration: 2 })),
  spec("piercing-depth", "piercingShot", "Unbroken Flight", "Hits up to 8 enemies; 15% less damage. Costs 40% more mana.", 1.4, 0.85, 1, change('projectile', { effects: { ...SKILL_EXECUTION.piercingShot.effects, pierce: 7 } })),
  spec("piercing-force", "piercingShot", "Siegebreaker", "60% more damage, hits up to 2 enemies. Costs 40% more mana; 20% longer cooldown.", 1.4, 1.6, 1.2, change('projectile', { effects: { ...SKILL_EXECUTION.piercingShot.effects, pierce: 1 } })),
  spec("piercing-twin", "piercingShot", "Twin Needles", "Two piercing arrows at 65% damage each. Costs 50% more mana.", 1.5, 0.65, 1, change('projectile', { offsets: [-.075, .075] })),
  spec("rain-wide", "rainOfArrows", "Blanket of Thorns", "50% larger radius; 25% less damage per wave. Costs 35% more mana.", 1.35, 0.75, 1, change('ground', { radius: 138 })),
  spec("rain-lasting", "rainOfArrows", "Relentless Rain", "Eight waves over 2.4 seconds, each at 75% damage. Costs 65% more mana; 25% longer cooldown.", 1.65, 0.75, 1.25, change('ground', { duration: 2.4 })),
  spec("rain-burst", "rainOfArrows", "Hail of Barbs", "Three rapid waves at 45% more damage. Costs 40% more mana.", 1.4, 1.45, 1, change('ground', { duration: .6, interval: .2, delay: .2 })),
  spec("lance-fan", "frostLance", "Glacial Trident", "Three lances at 55% damage each. Costs 70% more mana.", 1.7, 0.55, 1, change('projectile', { offsets: [-.18, 0, .18] })),
  spec("lance-chill", "frostLance", "Permafrost Spear", "70% slow for 5 seconds, 20% less damage. Costs 30% more mana.", 1.3, 0.8, 1, change('projectile', { effects: { ...SKILL_EXECUTION.frostLance.effects, slowFactor: .3, slowDuration: 5 } })),
  spec("lance-force", "frostLance", "Diamond Lance", "60% more damage, hits up to 2 enemies. Costs 45% more mana; 20% longer cooldown.", 1.45, 1.6, 1.2, change('projectile', { effects: { ...SKILL_EXECUTION.frostLance.effects, pierce: 1 } })),
  spec("siphon-drain", "siphon", "Soul Feast", "Heals 60% of actual damage dealt, but deals 20% less damage. Costs 35% more mana.", 1.35, 0.8, 1, change('projectile', { effects: { ...SKILL_EXECUTION.siphon.effects, lifeSteal: .6 } })),
  spec("siphon-pierce", "siphon", "Hollow Passage", "Hits up to 3 enemies, 15% less damage. Costs 50% more mana.", 1.5, 0.85, 1, change('projectile', { effects: { ...SKILL_EXECUTION.siphon.effects, pierce: 2 } })),
  spec("siphon-force", "siphon", "Soul Rend", "60% more damage, healing reduced to 15%. Costs 40% more mana; 20% longer cooldown.", 1.4, 1.6, 1.2, change('projectile', { effects: { ...SKILL_EXECUTION.siphon.effects, lifeSteal: .15 } })),
  spec("cataclysm-many", "cataclysm", "Falling Stars", "Eleven impacts at 65% damage each. Costs 60% more mana; 20% longer cooldown.", 1.6, 0.65, 1.2, change('ground', { scatter: 11 })),
  spec("cataclysm-force", "cataclysm", "Extinction", "Three impacts with 100% more damage and 40% more radius. Costs 40% more mana; 25% longer cooldown.", 1.4, 2, 1.25, change('ground', { scatter: 3, radius: 147 })),
  spec("cataclysm-fire", "cataclysm", "Sea of Cinders", "Ground fire lasts 9 seconds at 20% impact damage per second; 15% less impact damage. Costs 50% more mana.", 1.5, 0.85, 1, change('ground', { scorch: { duration: 9, interval: .25, damageMultiplier: .2 } })),
  spec("tempest-wide", "tempest", "Stormfront", "40% larger storm, 25% less damage. Casting and upkeep cost 30% more mana.", 1.3, 0.75, 1, change('ground', { radius: 273 })),
  spec("tempest-fast", "tempest", "Thunderhead", "Strikes every 0.3 seconds at 80% damage. Casting and upkeep cost 70% more mana.", 1.7, 0.8, 1, change('ground', { interval: .3 })),
  spec("tempest-still", "tempest", "Storm Anchor", "Stationary storm lasts 9 seconds, deals 20% more damage. Casting and upkeep cost 35% more mana; 25% longer cooldown.", 1.35, 1.2, 1.25, change('ground', { follow: false, duration: 9 })),
  spec("zero-wide", "absoluteZero", "Polar Horizon", "40% larger waves, 25% less damage. Costs 35% more mana.", 1.35, 0.75, 1, change('ground', { radius: 336 })),
  spec("zero-freeze", "absoluteZero", "Frozen Eternity", "Freeze lasts 2.5 seconds; 80% slow for 6 seconds. Costs 50% more mana; 25% longer cooldown.", 1.5, 1, 1.25, change('ground', { stun: 2.5, slow: { factor: .2, duration: 6 } })),
  spec("zero-burst", "absoluteZero", "Shattering Winter", "One wave deals 140% more damage, 25% smaller radius. Costs 25% more mana.", 1.25, 2.4, 1, change('ground', { duration: 0, radius: 180 })),
]);
export const OVERLOAD_NODE = 'keystone:arcane-overload';
export const specializationNode = (id: string) => `specialization:${id}`;
export const specializationPassiveNode = (id: string, kind: 'potency' | 'efficiency') => `specialization-passive:${id}:${kind}`;
export const SKILL_LEAF_BONUSES = Object.freeze({ potency: .06, efficiency: .04 });
export function skillLeafBonuses(sheet: CharacterSheet | undefined, skill: SkillId) {
  let potency = 0, efficiency = 0;
  if (sheet) for (const variant of SKILL_SPECIALIZATIONS) if (variant.skill === skill) {
    if (sheet.allocatedNodes.includes(specializationPassiveNode(variant.id, 'potency'))) potency += SKILL_LEAF_BONUSES.potency;
    if (sheet.allocatedNodes.includes(specializationPassiveNode(variant.id, 'efficiency'))) efficiency += SKILL_LEAF_BONUSES.efficiency;
  }
  return { potency, efficiency };
}
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
  sheet.skillRanks[id] = rank + 1;
  sheet.activeSkillRanks[id] = rank + 1;
  sheet.skillPoints--;
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
export function resolveSkill(id: SkillId, stats: Pick<DerivedCharacterStats, 'manaCostMultiplier' | 'cooldownMultiplier'> & Partial<Pick<DerivedCharacterStats, 'skillBonuses' | 'areaMultiplier' | 'projectilePierce'>>, sheet?: CharacterSheet, rankOverride?: number) {
  const base = SKILL_DEFINITIONS[id], rank = rankOverride ?? Math.max(1, sheet ? activeSkillRank(sheet, id) : 1);
  const bonusRanks = sheet && learnedSkillRank(sheet, id) ? Math.min(AFFIX_COMBAT_RULES.maxBonusRanks, stats.skillBonuses?.[id] ?? 0) : 0;
  const effectiveRank = rank + bonusRanks;
  const variant = sheet ? selectedSpecialization(sheet, id) : undefined;
  const overload = sheet?.arcaneOverload && sheet.allocatedNodes.includes(OVERLOAD_NODE) && base.domain === 'Arcana';
  const manaGrowth = [1, 14 / 12, 17 / 12, 20 / 12, 2, 2.4, 2.9][rank - 1];
  const development = skillLeafBonuses(sheet, id);
  const multiplier = (1 - development.efficiency) * manaGrowth * (variant?.mana ?? 1) * (overload ? 1.6 : 1);
  const cooldownFloor = id === 'bulwark' ? 4 : base.tier === 'ultimate' ? 12 : 0;
  const rankCooldown = base.tier === 'basic' ? 1 : 1 + .05 * (rank - 1);
  const cooldown = Math.max(cooldownFloor, base.cooldown * stats.cooldownMultiplier * rankCooldown * (variant?.cooldown ?? 1));
  const damageMultiplier = base.damageMultiplier * (1 + development.potency) * (1 + .15 * (effectiveRank - 1)) * (variant?.damage ?? 1) * (overload ? 1.3 : 1);
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
    if (v === 'backstab-rear') recipe.rearMultiplier = 3 / .85;
  }
  if (recipe.kind === 'projectile') {
    if (v === 'volley-fan') recipe.offsets = [-.4, -.2, 0, .2, .4];
    if (v === 'volley-pierce') recipe.effects = { ...recipe.effects, pierce: 1 };
    if (v === 'ricochet-chain') recipe.effects = { ...recipe.effects, chain: 6 };
    if (v === 'ricochet-force') recipe.effects = { ...recipe.effects, chain: 1 };
    if (v === 'fireball-fork') recipe.offsets = [-.24, 0, .24];
    if (v === 'fireball-ember') recipe.effects = { ...recipe.effects, groundDuration: 3, groundDamageMultiplier: .24 };
  }
  if (recipe.kind === 'chain') {
    if (v === 'arc-circuit') { recipe.jumps = 8; recipe.revisit = true; recipe.falloff = .7; }
    if (v === 'arc-focus') recipe.jumps = 3;
  }
  if (recipe.kind === 'radial') {
    if (v === 'nova-echo') recipe.echo = true;
    if (v === 'nova-deep') { recipe.radius *= 1.3; recipe.slow = { factor: .3, duration: 4 }; }
  }
  if (recipe.kind === 'ground' && v === 'meteor-shards') { recipe.scatter = 5; recipe.radius *= .65; }
  variant?.modify?.(recipe);
  if (recipe.kind === 'guard') {
    const growth = .025 * (effectiveRank - 1);
    // Once reduction caps, additional ranks extend the guard instead of only raising its cost.
    const excessRanks = Math.max(0, (recipe.reduction + growth - .9) / .025);
    recipe.duration += excessRanks * .25;
    recipe.reduction = Math.min(.9, recipe.reduction + growth);
  }
  if (recipe.kind === 'guard') recipe.duration *= 1 + development.potency;
  const area = stats.areaMultiplier ?? 1;
  if (recipe.kind === 'sweep') recipe.reachMultiplier *= area;
  if (recipe.kind === 'ground' || recipe.kind === 'radial' || recipe.kind === 'cone') recipe.radius *= area;
  if (recipe.kind === 'projectile') recipe.effects = { ...recipe.effects,
    ...(recipe.effects.blastRadius ? { blastRadius: recipe.effects.blastRadius * area } : {}),
    ...(!recipe.effects.blastRadius && stats.projectilePierce ? { pierce: Math.min(12, (recipe.effects.pierce ?? 0) + stats.projectilePierce) } : {}) };

  return { rank, bonusRanks, effectiveRank, variant, damageMultiplier, recipe, mana: Math.max(1, Math.round(base.manaCost * stats.manaCostMultiplier * multiplier * 10) / 10),
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
