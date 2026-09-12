import { AFFIX_COMBAT_RULES } from './equipment-affix-content.ts';
import type { ActionResult, CharacterSheet, DerivedCharacterStats, SkillId } from './character-types.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { SKILL_EXECUTION, type SkillExecution } from './skill-execution-content.ts';

/** Small additive purchased-rank gains; utility growth stays useful through rank twenty. */
export const SKILL_RANK_RULES = Object.freeze({ maximum: 20, mana: .015, duration: .05,
  stepSpeed: .02, protection: .0035, wardCapacity: .0035, empowerment: .05 });
/** First three equipment ranks remain strong; later stacks have a smaller marginal return. */
export const SKILL_DAMAGE_RANK_RULES = Object.freeze({ purchased: .05, bonus: .12, bonusKnee: 3, bonusTail: .05 });
export function skillRankDamageMultiplier(rank: number, bonusRanks: number): number {
  const r = SKILL_DAMAGE_RANK_RULES;
  return 1 + r.purchased * (rank - 1) + r.bonus * Math.min(bonusRanks, r.bonusKnee) + r.bonusTail * Math.max(0, bonusRanks - r.bonusKnee);
}

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
  spec('repulse-wide', 'repulse', 'Open the Line', 'A full circular shockwave with 20% more radius, but 25% less damage.', 1.2, .75, 1, change('cone', { radius: 114, arc: Math.PI * 2 })),
  spec('repulse-pin', 'repulse', 'Pinning Wall', '2-second stun, but the arc narrows to 120 degrees. Costs 30% more mana.', 1.3, 1, 1, change('cone', { stun: 2, arc: Math.PI * 2 / 3 })),
  spec('repulse-ready', 'repulse', 'Rolling Front', '30% less mana and cooldown; 20% less damage and a 0.5-second stun.', .7, .8, .7, change('cone', { stun: .5 })),
  spec('citadel-long', 'ironCitadel', 'Living Rampart', 'Protection lasts 8 seconds at 30% hit reduction; impact deals 20% less damage.', 1.2, .8, 1, change('radial', { shelter: { duration: 8, reduction: .3 } })),
  spec('citadel-seal', 'ironCitadel', 'Unbroken Seal', 'Protection rises to 65% hit reduction for only 2 seconds; 20% longer cooldown.', 1.1, 1, 1.2, change('radial', { shelter: { duration: 2, reduction: .65 } })),
  spec('citadel-break', 'ironCitadel', 'Breaking Siege', '50% more impact damage and a 1-second stun; protection falls to 25%.', 1.35, 1.5, 1, change('radial', { stun: 1, shelter: { duration: 5, reduction: .25 } })),
  spec('smoke-wide', 'smokeVeil', 'Spreading Haze', '50% larger smoke radius; only 10% hit reduction.', 1.15, 1, 1, change('radial', { radius: 172.5, shelter: { duration: 2, reduction: .1 } })),
  spec('smoke-deep', 'smokeVeil', 'Choking Mist', 'Enemies are 70% slower for 2 seconds; 25% smaller radius and 20% longer cooldown.', 1.2, 1, 1.2, change('radial', { radius: 86.25, slow: { duration: 2, factor: .3 } })),
  spec('smoke-ready', 'smokeVeil', 'Fading Shroud', '35% less mana and cooldown; only 1 second of protection and 1.5 seconds of slow.', .65, 1, .65, change('radial', { slow: { duration: 1.5, factor: .5 }, shelter: { duration: 1, reduction: .2 } })),
  spec('reaping-many', 'nightReaping', 'Harvest Circle', 'Strikes up to eight enemies with 25% more reach, but 25% less damage.', 1.35, .75, 1, change('backstab', { targets: 8, minRange: 200 })),
  spec('reaping-single', 'nightReaping', 'Marked for Death', 'One target takes 100% more damage; front-facing damage remains lower than a rear strike.', 1, 2, 1, change('backstab', { targets: 1 })),
  spec('reaping-rear', 'nightReaping', 'Midnight Execution', 'Rear strikes deal 3 times damage; 15% less base damage and a 20% longer cooldown.', 1.3, .85, 1.2, change('backstab', { rearMultiplier: 3 })),
  spec('sidestep-long', 'sidestep', 'Long Stride', '35% farther; 30% longer cooldown.', 1, 1, 1.3, change('step', { speed: 972 })),
  spec('sidestep-short', 'sidestep', 'Quick Footing', '25% shorter step; 25% shorter cooldown.', 1, 1, .75, change('step', { speed: 540 })),
  spec('brace-long', 'brace', 'Hold Fast', 'Brace lasts 3 seconds; reduction falls to 15%.', 1.1, 1, 1, change('stance', { duration: 3, reduction: .15 })),
  spec('brace-hard', 'brace', 'Set Like Stone', 'Brace reduces damage by 30% for 1 second.', 1, 1, 1, change('stance', { duration: 1, reduction: .3 })),
  spec('ward-deep', 'runicWard', 'Deep Inscription', 'Barrier holds 26% of maximum life, but expires after 2 seconds.', 1.3, 1, 1, change('ward', { fraction: .26, duration: 2 })),
  spec('ward-lasting', 'runicWard', 'Patient Rune', 'Barrier lasts 7 seconds, but holds only 12% of maximum life.', 1, 1, 1, change('ward', { fraction: .12, duration: 7 })),
  spec('vault-long', 'vaultingShot', 'Parting Arrow', 'Retreat 30% farther; arrow deals 20% less damage.', 1, .8, 1, change('step', { speed: 572 })),
  spec('vault-close', 'vaultingShot', 'Snap Shot', 'Retreat half as far; arrow deals 30% more damage.', 1.2, 1.3, 1, change('step', { speed: 220 })),
  spec('rally-last', 'rallyOfIron', 'Last Stand', '8 seconds and 35% hit reduction; only one empowered melee action.', 1.2, 1, 1, change('stance', { duration: 8, reduction: .35, charges: 1 })),
  spec('rally-march', 'rallyOfIron', 'Iron March', 'Five empowered actions; hit reduction falls to 10%.', 1.15, 1, 1, change('stance', { charges: 5, reduction: .1 })),
  spec('ghost-patient', 'ghostHunt', 'Patient Hunt', '10-second window, two echoes at 90% damage.', 1, 1, 1, change('stance', { duration: 10, charges: 2, bonus: .9 })),
  spec('ghost-flurry', 'ghostHunt', 'Pale Flurry', 'Five echoes at 40% damage; window lasts 4 seconds.', 1.15, 1, 1, change('stance', { duration: 4, charges: 5, bonus: .4 })),
  spec('sidestep-retreat', 'sidestep', 'Yielding Ground', 'Step backward while keeping your aim. Costs half as much mana; 15% shorter travel.', .5, 1, 1, change('step', { retreat: true, speed: 612 })),
  spec('brace-ready', 'brace', 'Measured Breath', 'Half the mana and 30% shorter cooldown; only 12% hit reduction.', .5, 1, .7, change('stance', { reduction: .12 })),
  spec('ward-renew', 'runicWard', 'Renewing Script', '40% shorter cooldown and 30% less mana; barrier holds 10% of maximum life for 3 seconds.', .7, 1, .6, change('ward', { fraction: .1, duration: 3 })),
  spec('vault-advance', 'vaultingShot', 'Pursuing Arrow', 'Vault forward through the opening; 20% less arrow damage and 20% shorter cooldown.', 1, .8, .8, change('step', { retreat: false })),
  spec('rally-burst', 'rallyOfIron', 'Decisive Banner', 'One melee action deals 140% more damage; window lasts 3 seconds, with no hit reduction.', 1, 1, 1, change('stance', { duration: 3, reduction: 0, charges: 1, bonus: 1.4 })),
  spec('ghost-focus', 'ghostHunt', 'One Perfect Shot', 'One echo at 200% damage within 4 seconds; 20% longer cooldown.', 1.1, 1, 1.2, change('stance', { duration: 4, charges: 1, bonus: 2 })),
  spec('cleave-economy', 'cleave', 'Steady Crescent', '45% less mana and 20% less damage; a narrower 180-degree sweep.', .55, .8, 1, change('sweep', { arc: Math.PI })),
  spec('whirlwind-economy', 'whirlwind', 'Patient Orbit', '40% less mana and 25% less damage; preserves the full circular sweep.', .6, .75),
  spec('ricochet-pierce', 'ricochet', 'Through the Pack', 'Pierces two enemies before its first rebound; only two rebounds. Costs 25% more mana.', 1.25, .9, 1, change('projectile', { effects: { style: 'arrow', pierce: 2, chain: 2, chainRange: 150 } })),
  spec('backstab-economy', 'backstab', 'Opportunist', '40% less mana, 10% less hit damage; rear strikes use a wider 90-degree threshold.', .6, .9, 1, change('backstab', { rearAngle: Math.PI / 2 })),
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
  spec('meteor-shards', 'meteor', 'Shattered Sky', 'Five impacts with 35% smaller radius spread across a wider target area at 45% damage each. Costs 90% more mana; 25% longer cooldown.', 1.9, .45, 1.25),
  spec("shield-control", "shieldBash", "Concussion", "2-second stun, 30% less damage. Costs 20% more mana.", 1.2, 0.7, 1, change('cone', { stun: 2 })),
  spec("volley-focus", "volley", "Needle Fan", "A tight three-arrow fan; 20% more damage. Costs 35% more mana.", 1.35, 1.2, 1, change('projectile', { offsets: [-.09, 0, .09] })),
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
  spec("bulwark-reduction", "bulwark", "Iron Aegis", "Base block reduction rises to 85%, guard lasts 2 seconds. Every additional rank extends the guard; block reduction caps at 90%. Costs 35% more mana.", 1.35, 1, 1, change('guard', { reduction: .85, duration: 2 })),
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
export function learnedSkillRank(sheet: CharacterSheet, id: SkillId): number {
  return sheet.allocatedNodes.includes(`skill:${id}`) ? sheet.skillRanks[id] ?? 1 : 0;
}
export function maximumSkillRank(_sheet: CharacterSheet, _id: SkillId): number {
  return SKILL_RANK_RULES.maximum;
}
export function activeSkillRank(sheet: CharacterSheet, id: SkillId): number {
  return Math.min(learnedSkillRank(sheet, id), sheet.activeSkillRanks[id] ?? learnedSkillRank(sheet, id));
}
export function selectedSpecialization(sheet: CharacterSheet, id: SkillId): SkillSpecialization | undefined {
  return SKILL_SPECIALIZATIONS.find(s => s.id === sheet.skillSpecializations[id] && s.skill === id && sheet.allocatedNodes.includes(specializationNode(s.id)));
}
export function upgradeSkill(sheet: CharacterSheet, id: SkillId): ActionResult {
  const rank = learnedSkillRank(sheet, id);
  if (!rank || rank >= maximumSkillRank(sheet, id)) return { ok: false, message: `Unlock this skill first; purchased ranks stop at ${SKILL_RANK_RULES.maximum}.` };
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
  const manaGrowth = 1 + SKILL_RANK_RULES.mana * (rank - 1);
  const multiplier = manaGrowth * (variant?.mana ?? 1) * (overload ? 1.6 : 1);
  const cooldownFloor = id === 'bulwark' ? 4 : base.tier === 'ultimate' ? 12 : 0;
  const rankCooldown = 1;
  const cooldown = Math.max(cooldownFloor, base.cooldown * stats.cooldownMultiplier * rankCooldown * (variant?.cooldown ?? 1));
  const damageMultiplier = base.damageMultiplier * skillRankDamageMultiplier(rank, bonusRanks) * (variant?.damage ?? 1) * (overload ? 1.3 : 1);
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
  if (recipe.kind === 'ground' && v === 'meteor-shards') { recipe.scatter = 5; recipe.radius *= .65; recipe.scatterRadiusMultiplier = 1.6; }
  variant?.modify?.(recipe);
  const growth=effectiveRank-1,rules=SKILL_RANK_RULES;
  if (recipe.kind === 'guard') {
    recipe.duration += rules.duration * growth;
    recipe.reduction = Math.min(.9, recipe.reduction + rules.protection * growth);
  }
  if (recipe.kind === 'step') recipe.speed *= 1 + rules.stepSpeed * growth;
  if (recipe.kind === 'ward') {
    recipe.fraction = Math.min(.35, recipe.fraction + rules.wardCapacity * growth);
    recipe.duration += rules.duration * growth;
  }
  if (recipe.kind === 'stance') {
    recipe.duration += rules.duration * growth;
    if (recipe.charges) recipe.bonus *= 1 + rules.empowerment * growth;
    if (recipe.reduction) recipe.reduction = Math.min(.5, recipe.reduction + rules.protection * growth);
  }
  if(recipe.kind==='radial'&&recipe.shelter)recipe.shelter={
    duration:recipe.shelter.duration+rules.duration*growth,
    reduction:Math.min(.75,recipe.shelter.reduction+rules.protection*growth)};
  if(recipe.kind==='step'&&recipe.shot&&stats.projectilePierce)recipe.pierce=Math.min(12,stats.projectilePierce);
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
