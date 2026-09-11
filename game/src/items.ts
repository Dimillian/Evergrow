import { manaImplicitScale } from './mana-content.ts';
import { CHARM_DROP_CHANCE, CHARM_PROFILES, CHARM_SIZES, CHARM_FLAVORS, CHARM_UTILITY_AFFIXES, CHARM_WEIGHTS, charmProfile, charmAffixCount, charmThematicStat } from './charm-content.ts';
import { RESISTANCE_AFFIXES, RESISTANCE_LABELS, RESISTANCE_STATS, isResistanceStat, boundResistanceRoll } from './resistance-content.ts';
import { JEWELRY_PROFILES, jewelryProfiles } from './jewelry-content.ts';
import { ITEM_MATERIALS, isClothMaterial, sourceMaterialPool, type MaterialSource, itemMaterialPool, rollItemMaterial, itemMaterialScale, materialBaseName, type ItemMaterialId } from './item-materials.ts';
import { SPECIAL_AFFIXES, SPECIAL_AFFIX_LABELS, SKILL_AFFIXES, SKILL_STATS, isSkillStat, skillAffixPool, discreteAffixValue, type AffixDefinition } from './equipment-affix-content.ts';
import { ELEMENTAL_AFFIXES, ELEMENT_COLORS, isElementalAffix, meleeEnchantment } from './elemental-weapon.ts';
import { createCharacterLook } from './character-look.ts';
import { FOCUS_PROFILES } from './focus-content.ts';
import { STARTING_SWORD } from './equipment.ts';
import { SHIELD_PROFILES, WEAPON_PROFILES } from './weapon-content.ts';
import { itemAffixGrowthLevel, itemPercentageScale, itemPowerScale, normalizeLevel } from './progression-content.ts';
import type { CharacterSheet, EquipmentSlot, Item, ItemAffix, ItemKind, ItemTier, StatKey, StatModifiers } from './character-types.ts';

export const INVENTORY_CAPACITY = 120;

export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = Object.freeze([
  'weapon', 'offhand', 'head', 'chest', 'gloves', 'legs', 'boots', 'cloak', 'amulet', 'ring1', 'ring2',
]);
export const ITEM_KINDS: readonly ItemKind[] = Object.freeze(['weapon', 'shield', 'grimoire', 'orb', 'head', 'chest', 'gloves', 'legs', 'boots', 'cloak', 'amulet', 'ring', 'charm']);
export const TIER_COLORS: Readonly<Record<ItemTier, string>> = Object.freeze({
  common: '#c5ccc8', magic: '#76b9ee', rare: '#e0c17a', epic: '#b895ef', legendary: '#f0a16b',
});
export const TIER_NAMES: Readonly<Record<ItemTier, string>> = Object.freeze({
  common: 'Common', magic: 'Magic', rare: 'Rare', epic: 'Epic', legendary: 'Legendary',
});
export const STAT_LABELS: Readonly<Record<StatKey, string>> = Object.freeze({
  ...SPECIAL_AFFIX_LABELS, ...SKILL_STATS, ...RESISTANCE_LABELS, goldFindPercent: 'Gold found', xpGainPercent: 'Experience gained',
  fireDamage: 'Added fire damage', frostDamage: 'Added frost damage', lightningDamage: 'Added lightning damage',
  strength: 'Strength', dexterity: 'Dexterity', intelligence: 'Intelligence', vitality: 'Vitality',
  maxHp: 'Maximum life', maxMana: 'Maximum mana', armor: 'Armor', damagePercent: 'Attack damage',
  attackSpeedPercent: 'Attack speed', castSpeedPercent: 'Cast speed', critChance: 'Critical chance', critDamage: 'Critical damage',
  moveSpeedPercent: 'Movement speed', spellDamagePercent: 'Spell damage', manaRegen: 'Mana / 5 sec',
  lifeRegen: 'Life / sec', manaCostPercent: 'Mana cost reduction', cooldownPercent: 'Cooldown reduction', lifeOnHit: 'Life on hit',
  blockChance: 'Block chance', blockReduction: 'Blocked damage reduction',
});
export const PERCENT_STATS = new Set<StatKey>(['goldFindPercent', 'xpGainPercent', ...RESISTANCE_STATS, 'areaPercent', 'potionPercent', 'spellweavePercent', 'afterguardPercent', 'damagePercent', 'attackSpeedPercent', 'castSpeedPercent', 'critChance', 'critDamage', 'moveSpeedPercent', 'spellDamagePercent', 'cooldownPercent', 'manaCostPercent', 'blockChance', 'blockReduction']);
export function formatStatValue(stat: StatKey, value: number): string {
  return `${value > 0 ? '+' : ''}${Number(value.toFixed(1))}${PERCENT_STATS.has(stat) ? '%' : ''}`;
}

export function itemModifiers(item: Item): StatModifiers {
  const modifiers: StatModifiers = { ...item.implicit };
  for (const affix of item.affixes) modifiers[affix.stat] = (modifiers[affix.stat] ?? 0) + affix.value;
  return modifiers;
}

// Local integer RNG keeps rolled equipment independent of encounter/combat randomness.
export function randomSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let n = Math.imul(state ^ state >>> 15, state | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
const BASE_NAMES: Readonly<Record<Exclude<ItemKind, 'weapon' | 'shield' | 'grimoire' | 'orb'>, readonly string[]>> = {
  head: ['Crown Helm', 'Watcher Hood', 'Visored Helm'],
  chest: ['Brigandine', 'Warden Plate', 'Scale Vest'], gloves: ['Gauntlets', 'Grips', 'Vambraces'],
  legs: ['Greaves', 'Cuisses', 'Chausses'], boots: ['Sabatons', 'Treads', 'Longboots'],
  cloak: ['Mantle', 'Shroud', 'Halfcape'], amulet: ['Reliquary', 'Talisman', 'Moon Pendant'],
  ring: ['Signet', 'Band', 'Loop'], charm: ['Stone', 'Stone', 'Stone'],
};
const PREFIXES = ['Ashen', 'Starbound', 'Thornwrought', 'Gloaming', 'Hollow', 'Dawnforged', 'Mournful', 'Graveglass', 'Moonlit', 'Briar'];
const SUFFIXES = ['of the Watch', 'of Embers', 'of the Hollow', 'of Still Water', 'of the Pilgrim', 'of Thorns', 'of the Pale Star', 'of Dusk'];
const TITLES = ['Oath', 'Vigil', 'Remnant', 'Requiem', 'Promise', 'Echo', 'Witness', 'Memory'];
export const AFFIXES: readonly AffixDefinition[] = [
  ...SPECIAL_AFFIXES, ...RESISTANCE_AFFIXES,
  { name: 'Might', stat: 'strength', base: 2, growth: .25 },
  { name: 'Grace', stat: 'dexterity', base: 2, growth: .25 },
  { name: 'Insight', stat: 'intelligence', base: 2, growth: .25 },
  { name: 'Vigor', stat: 'vitality', base: 2, growth: .25 },
  { name: 'The Hart', stat: 'maxHp', base: 8, growth: 1.8 },
  { name: 'The Wellspring', stat: 'maxMana', base: 8, growth: .8 },
  { name: 'Shelter', stat: 'armor', base: 6, growth: 1.4 },
  { name: 'Ruin', stat: 'damagePercent', base: 4, growth: .35 },
  { name: 'Invocation', stat: 'castSpeedPercent', base: 3, growth: .18 },
  { name: 'Haste', stat: 'attackSpeedPercent', base: 3, growth: .18 },
  { name: 'Precision', stat: 'critChance', base: 1, growth: .08 },
  { name: 'Severity', stat: 'critDamage', base: 6, growth: .35 },
  { name: 'The Wanderer', stat: 'moveSpeedPercent', base: 2, growth: .12 },
  { name: 'Sorcery', stat: 'spellDamagePercent', base: 5, growth: .45 },
  { name: 'Clarity', stat: 'manaRegen', base: 2, growth: .12 },
  { name: 'Renewal', stat: 'lifeRegen', base: .3, growth: .05 },
  { name: 'Efficiency', stat: 'manaCostPercent', base: 4, growth: .15 },
  { name: 'Readiness', stat: 'cooldownPercent', base: 2, growth: .1 },
  { name: 'Sustenance', stat: 'lifeOnHit', base: 1, growth: .12 },
];
export const SHIELD_AFFIXES: typeof AFFIXES = [
  { name: 'Deflection', stat: 'blockChance', base: 2, growth: .08 },
  { name: 'The Bulwark', stat: 'blockReduction', base: 4, growth: .12 },
];
/** Explicit slot identity. Amulets share general stats, never weapon-local enchantments. */
const SLOT_AFFIXES: Partial<Record<ItemKind, readonly StatKey[]>> = {
  head: ['maxMana', 'intelligence', 'manaCostPercent', 'cooldownPercent', 'maxHp', 'armor'],
  chest: ['maxHp', 'armor', 'vitality', 'lifeRegen', 'strength'],
  gloves: ['attackSpeedPercent', 'castSpeedPercent', 'critChance', 'damagePercent', 'spellDamagePercent', 'dexterity', 'armor'],
  legs: ['maxHp', 'armor', 'vitality', 'lifeRegen', 'strength', 'dexterity'],
  boots: ['moveSpeedPercent', 'maxHp', 'armor', 'vitality', 'dexterity'],
  cloak: ['potionPercent', 'lifeRegen', 'manaRegen', 'cooldownPercent', 'maxHp', 'maxMana', 'intelligence'],
  ring: [...RESISTANCE_STATS, 'maxHp', 'vitality', 'lifeRegen', 'manaOnKill', 'critChance', 'critDamage', 'damagePercent', 'spellDamagePercent', 'strength', 'dexterity', 'intelligence', 'maxMana', 'manaRegen'],
  shield: [...RESISTANCE_STATS, 'afterguardPercent', 'blockChance', 'blockReduction', 'armor', 'maxHp', 'vitality', 'lifeRegen', 'strength'],
  grimoire: ['manaOnKill', 'spellweavePercent', 'maxMana', 'manaRegen', 'manaCostPercent', 'cooldownPercent', 'intelligence', 'spellDamagePercent'],
  orb: ['spellDamagePercent', 'critChance', 'critDamage', 'intelligence', 'maxMana', 'manaCostPercent'],
};
export function itemAffixPool(item: { kind: ItemKind; weapon?: { family: string; damageType?: string }; focus?: { visual: { motif: string } }; recipe?: {materialId?: ItemMaterialId; profileId?:string} }): typeof AFFIXES {
  if (item.kind === 'charm') {
    const flavor = CHARM_PROFILES.find(p=>p.id===item.recipe?.profileId)?.flavor;
    return [...AFFIXES, ...CHARM_UTILITY_AFFIXES].filter(a=>CHARM_WEIGHTS[a.stat]).map(a=>({...a,
      weight: CHARM_WEIGHTS[a.stat]! * (flavor?.stats.includes(a.stat) ? 2 : 1) }));
  }
  const melee = item.kind === 'weapon' && ['sword', 'axe', 'mace', 'dagger'].includes(item.weapon?.family ?? '');
  const armor=['head','chest','gloves','legs','boots'].includes(item.kind), construction=item.recipe?.materialId;
  const leather=armor&&construction==='leather', cloth=armor&&isClothMaterial(construction);
  const specialty:StatKey[]=leather?['dexterity','damagePercent','critChance','critDamage','lifeOnHit']:cloth?['intelligence','maxMana','manaRegen','spellDamagePercent','manaCostPercent']:[];
  const jewelry=JEWELRY_PROFILES.find(p=>p.id===item.recipe?.profileId);
  const preferred=jewelry?.affinity??specialty;
  const stats = leather||cloth ? [...specialty,'maxHp','armor',...(item.kind==='gloves'?[cloth?'castSpeedPercent':'attackSpeedPercent']:item.kind==='boots'?['moveSpeedPercent']:item.kind==='head'&&cloth?['cooldownPercent']:[])] : item.kind === 'amulet' ? [...AFFIXES, ...SHIELD_AFFIXES].map(a => a.stat)
    : item.kind === 'weapon' ? melee
      ? ['areaPercent', 'damagePercent', 'critChance', 'critDamage', 'lifeOnHit', 'strength', 'dexterity', 'intelligence', 'spellDamagePercent']
      : item.weapon?.family === 'bow' ? ['projectilePierce', 'damagePercent', 'critChance', 'critDamage', 'dexterity', 'lifeOnHit', 'strength']
      : [item.weapon?.family === 'staff' ? 'areaPercent' : 'projectilePierce', 'spellDamagePercent', 'intelligence', 'maxMana', 'critChance', 'critDamage', 'manaCostPercent', 'manaRegen']
    : SLOT_AFFIXES[item.kind] ?? [];
  return [...AFFIXES, ...SHIELD_AFFIXES].filter(a => stats.includes(a.stat)).map(a => ({ ...a,
    weight: (['cooldownPercent', 'manaCostPercent', 'critChance', 'lifeOnHit'].includes(a.stat) ? .55 : a.weight ?? 1) * (preferred.includes(a.stat)?2.2:preferred.length?.75:1),
  })).concat(melee ? ELEMENTAL_AFFIXES.map(a => ({ ...a, weight: .12 })) : [], skillAffixPool(item));
}
/** Shared weighted selection for drops and every enchanter operation. */
export function rollAffix(pool: typeof AFFIXES, random: () => number): (typeof AFFIXES)[number] {
  if (!pool.length) throw new RangeError('No eligible affix');
  let value = random() * pool.reduce((sum, a) => sum + (a.weight ?? 1), 0);
  return pool.find(a => (value -= a.weight ?? 1) < 0) ?? pool[pool.length - 1];
}
export function affixConflicts(stat: StatKey, occupied: readonly StatKey[]): boolean {
  return occupied.includes(stat) || isResistanceStat(stat) && occupied.some(isResistanceStat) || isSkillStat(stat) && occupied.some(isSkillStat) || isElementalAffix(stat) && occupied.some(isElementalAffix)
    || ['attackSpeedPercent', 'castSpeedPercent'].includes(stat) && occupied.some(s => ['attackSpeedPercent', 'castSpeedPercent'].includes(s));
}
/** Concentrated slots need meaningful rolls; percentage growth remains bounded. */
export function affixPotency(kind: ItemKind, stat: StatKey): number {
  if (stat === 'moveSpeedPercent') return kind === 'boots' ? 5 : 2.5;
  if (stat === 'attackSpeedPercent' || stat === 'castSpeedPercent') return kind === 'gloves' ? 4 : 2;
  if (kind === 'chest' && ['maxHp', 'armor', 'lifeRegen'].includes(stat)) return 1.75;
  if (kind === 'head' && ['maxMana', 'manaCostPercent'].includes(stat)) return 1.5;
  if (kind === 'cloak' && ['lifeRegen', 'manaRegen', 'cooldownPercent'].includes(stat)) return 1.5;
  if (kind === 'grimoire' && ['maxMana', 'manaRegen', 'manaCostPercent'].includes(stat)) return 1.5;
  if (kind === 'orb' && ['spellDamagePercent', 'critChance', 'critDamage'].includes(stat)) return 1.5;
  if (kind === 'shield' && ['blockChance', 'blockReduction'].includes(stat)) return 2;
  if (kind === 'weapon' && ['damagePercent', 'spellDamagePercent'].includes(stat)) return 2;
  return 1;
}
function focusImplicit(profileId: string, level: number, quality: number): StatModifiers {
  const profile = FOCUS_PROFILES.find(p => p.id === profileId)!;
  return Object.fromEntries(Object.entries(profile.implicit).map(([stat, value]) => [stat,
    value! * quality * (isManaBudgetStat(stat) ? manaImplicitScale(level) : PERCENT_STATS.has(stat as StatKey) ? itemPercentageScale(level) : itemPowerScale(level))]));
}
function jewelryImplicit(profileId:string,level:number,quality:number):StatModifiers {
  const profile=JEWELRY_PROFILES.find(p=>p.id===profileId)!;
  return Object.fromEntries(Object.entries(profile.implicit).map(([stat,value])=>[stat,value!*quality*(isManaBudgetStat(stat)?manaImplicitScale(level):PERCENT_STATS.has(stat as StatKey)?itemPercentageScale(level):itemPowerScale(level))]));
}
export const TIER_AFFIXES: Readonly<Record<ItemTier, number>> = { common: 0, magic: 1, rare: 2, epic: 3, legendary: 4 };
export const TIER_POWER: Readonly<Record<ItemTier, number>> = { common: 1, magic: 1.09, rare: 1.2, epic: 1.34, legendary: 1.5 };

/** Reward-only charm selection also covers authored equipment themes, with one roll per item. */
export function generateRewardItem(seed: number, itemLevel: number, kind?: ItemKind, profileId?: string, tier?: ItemTier, material?: ItemMaterialId, source: MaterialSource = {}): Item {
  const charm = randomSource(seed ^ 0x4c19ac)() < CHARM_DROP_CHANCE;
  return generateItem(seed, itemLevel, charm ? 'charm' : kind, charm ? undefined : profileId, tier, charm ? undefined : material, source);
}

/** Item-local generation; reward sources may supply an explicitly rolled tier. Callers own seed uniqueness. */
export function generateItem(seed: number, itemLevel: number, kind?: ItemKind, profileId?: string, tierOverride?: ItemTier, materialOverride?: ItemMaterialId, source:MaterialSource={}): Item {
  if (tierOverride !== undefined && !Object.hasOwn(TIER_POWER, tierOverride)) throw new RangeError(`Unknown item tier: ${tierOverride}`);
  if (kind === 'charm' || profileId && CHARM_PROFILES.some(p=>p.id===profileId)) {
    if (kind && kind !== 'charm' || materialOverride !== undefined) throw new RangeError('Charms use stone profiles, not equipment materials.');
    return generateCharm(seed, itemLevel, profileId, tierOverride);
  }
  seed = seed >>> 0;
  const level = normalizeLevel(itemLevel);
  const random = randomSource(seed), choose = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)];
  const selectedJewelry = profileId ? JEWELRY_PROFILES.find(p=>p.id===profileId) : undefined;
  const selectedWeapon = profileId ? WEAPON_PROFILES.find(profile => profile.id === profileId) : undefined;
  const selectedShield = profileId ? SHIELD_PROFILES.find(profile => profile.id === profileId) : undefined;
  const selectedFocus = profileId ? FOCUS_PROFILES.find(profile => profile.id === profileId) : undefined;
  if (profileId && !selectedWeapon && !selectedShield && !selectedFocus && !selectedJewelry) throw new RangeError(`Unknown equipment profile: ${profileId}`);
  const itemKind = kind ?? (selectedWeapon ? 'weapon' : selectedShield ? 'shield' : selectedFocus ? selectedFocus.visual.kind : selectedJewelry ? selectedJewelry.kind : choose(ITEM_KINDS.filter(k=>k!=='charm')));
  if (profileId && (itemKind === 'weapon' ? !selectedWeapon : itemKind === 'shield' ? !selectedShield : itemKind==='ring'||itemKind==='amulet' ? selectedJewelry?.kind!==itemKind : selectedFocus?.visual.kind !== itemKind)) {
    throw new RangeError(`Profile ${profileId} does not describe an item of kind ${itemKind}.`);
  }
  const roll = random();
  // This default is for general content tools and starting gear. Enemy loot supplies its own table result.
  // Consume the same draw with an override so the underlying silhouette/material roll stays stable.
  const tier: ItemTier = tierOverride ?? (roll < .45 ? 'common' : roll < .77 ? 'magic' : roll < .94 ? 'rare' : roll < .99 ? 'epic' : 'legendary');
  const variant = random();
  const weaponProfile = itemKind === 'weapon' ? selectedWeapon ?? WEAPON_PROFILES[Math.floor(variant * WEAPON_PROFILES.length)] : undefined;
  const shieldProfile = itemKind === 'shield' ? selectedShield ?? SHIELD_PROFILES[Math.floor(variant * SHIELD_PROFILES.length)] : undefined;
  const focusProfiles = FOCUS_PROFILES.filter(p => p.visual.kind === itemKind);
  const focusProfile = selectedFocus ?? focusProfiles[Math.floor(variant * focusProfiles.length)];
  const jewelryOptions=jewelryProfiles(itemKind), jewelryProfile=selectedJewelry??jewelryOptions[Math.floor(variant*jewelryOptions.length)];
  const profileName = weaponProfile?.name ?? shieldProfile?.name ?? focusProfile?.name ?? jewelryProfile?.name ?? BASE_NAMES[itemKind as Exclude<ItemKind, 'weapon' | 'shield' | 'grimoire' | 'orb'>][Math.floor(variant * 3)];
  random(); // Preserve the affix/name draw sequence; construction uses its own RNG.
  const materials = sourceMaterialPool(itemKind, weaponProfile?.family, {level,...source});
  const materialId = materialOverride ?? rollItemMaterial(materials, randomSource(seed ^ 0x73a45d91)());
  if (!materials.some(m => m.id === materialId)) throw new RangeError(`Invalid ${itemKind} material: ${materialId}`);
  const material = ITEM_MATERIALS[materialId], baseScale = materials.find(m => m.id === materialId)!.baseScale;
  const { base, shadow, edge, trim, surface } = material;
  const appearance: Item['appearance'] = { base, shadow, edge, trim, surface, style: isClothMaterial(materialId) ? 'cloth' : ['leather','wood'].includes(surface) ? 'leather' : 'plate' };
  const baseName = materialBaseName(itemKind, profileName, materialId), quality = TIER_POWER[tier];
  const growth = itemPowerScale(level) * quality * baseScale;
  const rolls: number[] = [];
  const affixes: ItemAffix[] = [], remaining = [...itemAffixPool({ kind: itemKind, weapon: weaponProfile, focus: focusProfile, recipe:{materialId,profileId:jewelryProfile?.id} })];
  for (let index = 0; index < TIER_AFFIXES[tier]; index++) {
    const definition = rollAffix(remaining, random);
    const growthLevel = (PERCENT_STATS.has(definition.stat) || isManaBudgetStat(definition.stat)) ? itemAffixGrowthLevel(level) : level - 1;
    const rollQuality = random(); rolls.push(rollQuality);
    const value = discreteAffixValue(definition.stat, rollQuality, level) ?? (definition.base + growthLevel * definition.growth) * (.85 + rollQuality * .3) * quality * affixPotency(itemKind, definition.stat);
    affixes.push({ name: definition.name, stat: definition.stat, value: boundResistanceRoll(definition.stat, value) });
    for (let i = remaining.length - 1; i >= 0; i--) if (affixConflicts(remaining[i].stat, affixes.map(a => a.stat))) remaining.splice(i, 1);
  }
  const implicit: StatModifiers = focusProfile ? focusImplicit(focusProfile.id, level, quality * baseScale) : {};
  const armorBase: Partial<Record<ItemKind, number>> = { head: 5, chest: 11, gloves: 3, legs: 7, boots: 4 };
  if (armorBase[itemKind]) implicit.armor = Math.max(1, Math.round(armorBase[itemKind]! * growth));
  if (shieldProfile) implicit.armor = Math.max(1, Math.round(({ buckler: 7, kite: 15, tower: 22 }[shieldProfile.visual.kind]) * growth));
  if (itemKind === 'cloak') implicit.maxHp = Math.round(6 * growth);
  if (jewelryProfile) Object.assign(implicit,jewelryImplicit(jewelryProfile.id,level,quality*baseScale));
  const prefix = choose(PREFIXES), suffix = choose(SUFFIXES);
  const name = tier === 'common' ? `${prefix} ${baseName}` : tier === 'magic' ? `${prefix} ${baseName} ${suffix}`
    : `${prefix} ${choose(TITLES)}`;
  const item: Item = {
    recipe: { manaVersion: 1, materialId, ...((weaponProfile ?? shieldProfile ?? focusProfile ?? jewelryProfile) ? { profileId: (weaponProfile ?? shieldProfile ?? focusProfile ?? jewelryProfile)!.id } : {}), starter: false, enhancement: 0, revision: 0, targetedRolls: 0, fullRolls: 0, rolls },
    id: `item-${seed.toString(36)}-${level}-${weaponProfile?.id ?? shieldProfile?.id ?? focusProfile?.id ?? jewelryProfile?.id ?? itemKind}-${materialId}-${tier}`, seed, name, baseName, kind: itemKind, tier,
    itemLevel: level, requiredLevel: Math.max(1, level - 2),
    power: Math.round(level * 10 + quality * baseScale * 12 + affixes.length * 7), implicit, affixes, appearance,
  };
  if (weaponProfile) {
    item.weapon = { ...weaponProfile, id: item.id, name, damage: Math.round(weaponProfile.damage * growth),
      visual: { ...weaponProfile.visual, material: surface, metal: appearance.base, edge: appearance.edge, grip: appearance.shadow, guard: appearance.trim } };
  }
  if (shieldProfile) {
    item.shield = { ...shieldProfile, id: item.id, name,
      visual: { ...shieldProfile.visual, material: surface, base: appearance.base, edge: appearance.edge, trim: appearance.trim, shadow: appearance.shadow } };
  }
  if (focusProfile) item.focus = { id: item.id, name, visual: { ...focusProfile.visual, material: surface, base: appearance.base, edge: appearance.edge, trim: appearance.trim, shadow: appearance.shadow } };
  return roundItemStats(item);
}

/** Display order is deliberate: melee, magic, then archery; light before heavy. */
export const STARTER_LOADOUTS = Object.freeze([
  { id: 'sword-shield', label: 'Sword & shield', detail: 'Quick · guarded', profileId: 'longsword', offhandProfileId: 'iron-buckler' },
  { id: 'sword', label: 'Two-handed sword', detail: 'Heavy · two-handed', profileId: 'weathered-sword', offhandProfileId: null },
  { id: 'wand', label: 'Wand & grimoire', detail: 'Quick casting · sustain', profileId: 'cinder-wand', offhandProfileId: 'ember-codex' },
  { id: 'fire', label: 'Fire staff', detail: 'Powerful · two-handed', profileId: 'ember-staff', offhandProfileId: null },
  { id: 'bow', label: 'Shortbow', detail: 'Fast · short range', profileId: 'thorn-shortbow', offhandProfileId: null },
  { id: 'longbow', label: 'Longbow', detail: 'Heavy · long range', profileId: 'warden-longbow', offhandProfileId: null },
] as const);
export type StarterLoadoutId = typeof STARTER_LOADOUTS[number]['id'];
export const isStarterLoadoutId = (value: string): value is StarterLoadoutId => STARTER_LOADOUTS.some(option => option.id === value);

/** Authored level-one common gear: no random rarity, affixes or starter-only powers. */
export function createStarterLoadout(id: StarterLoadoutId): { weapon: Item; offhand: Item | null } {
  const option = STARTER_LOADOUTS.find(option => option.id === id);
  if (!option) throw new RangeError('Unknown starter loadout');
  const profile = id === 'sword' ? STARTING_SWORD : WEAPON_PROFILES.find(profile => profile.id === option.profileId)!;
  const item = generateItem(1, 1, 'weapon', id === 'sword' ? 'longsword' : profile.id, 'common', itemMaterialPool('weapon', profile.family)[0].id);
  item.id = 'starter-weapon'; item.baseName = profile.name;
  item.name = id === 'sword' ? profile.name : `Worn ${profile.name}`;
  item.implicit = {}; item.affixes = []; item.power = 1;
  item.recipe = { ...item.recipe, profileId: profile.id, starter: true, rolls: [] };
  item.weapon = { ...profile, visual: { ...profile.visual } };
  item.appearance = { base: profile.visual.metal, shadow: profile.visual.grip,
    edge: profile.visual.edge, trim: profile.visual.guard, style: 'plate' };
  let offhand: Item | null = null;
  if (option.offhandProfileId) {
    offhand = generateItem(2, 1, undefined, option.offhandProfileId, 'common', option.id === 'wand' ? 'leather' : 'iron');
    offhand.id = 'starter-offhand'; offhand.name = `Worn ${offhand.baseName}`;
    offhand.recipe = { ...offhand.recipe, starter: true };
    if (offhand.shield) offhand.shield = { ...offhand.shield, id: offhand.id, name: offhand.name };
    if (offhand.focus) offhand.focus = { ...offhand.focus, id: offhand.id, name: offhand.name };
  }
  return { weapon: item, offhand };
}

/** The chosen weapon, the same modest leather outfit, and an empty bag. */
export function createCharacterSheet(starter: StarterLoadoutId = 'sword'): CharacterSheet {
  const equipped = Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, null])) as CharacterSheet['equipped'];
  const starterPieces: readonly [EquipmentSlot, number][] = [['head', 31], ['chest', 17], ['gloves', 23], ['legs', 59], ['boots', 11], ['cloak', 71]];
  for (const [slot, seed] of starterPieces) {
    const item = generateItem(seed, 1, slot as ItemKind, undefined, 'common', slot === 'cloak' ? 'cloth' : 'leather');
    const wornNames: Partial<Record<EquipmentSlot, string>> = { head: 'Leather Hood', chest: 'Leather Jerkin',
      gloves: 'Leather Gloves', legs: 'Leather Trousers', boots: 'Leather Boots', cloak: 'Travel Cloak' };
    item.baseName = wornNames[slot]!;
    item.id = `starter-${slot}`; item.name = `Worn ${item.baseName}`;
    item.tier = 'common'; item.implicit = {}; item.affixes = []; item.power = 1;
    item.recipe = { ...item.recipe, starter: true, rolls: [] };
    item.appearance = { base: '#655345', shadow: '#2c2826', edge: '#ac9470', trim: '#9e8156', style: 'leather' };
    if (slot === 'boots') item.appearance = { base: '#5c4c41', shadow: '#292b30', edge: '#a79873', trim: '#b18b58', style: 'leather' };
    if (slot === 'cloak') item.appearance = { base: '#555e50', shadow: '#292f2d', edge: '#89937c', trim: '#a28c64', style: 'leather' };
    equipped[slot] = item;
  }
  const loadout = createStarterLoadout(starter);
  equipped.weapon = loadout.weapon; equipped.offhand = loadout.offhand;
  const inventory: CharacterSheet['inventory'] = Array.from({ length: INVENTORY_CAPACITY }, () => null);
  return { look: createCharacterLook(), skillRanks: {}, activeSkillRanks: {}, skillSpecializations: {}, arcaneOverload: false, gold: 0, commerce: { epoch: 0, revision: 0, operations: 0, sold: {}, buyback: [] }, attributes: { strength: 10, dexterity: 10, intelligence: 10, vitality: 10 },
    statPoints: 0, skillPoints: 0, allocatedNodes: ['origin'], inventory, equipped, skillSlots: Array.from({ length: 5 }, () => null) };
}

/** Rebuild from authored bases and exact roll quality; never scale rounded existing stats. */
export function deriveItem(item: Item): Item {
  if (item.kind === 'charm') return deriveCharm(item);
  const next: Item = { ...item, implicit: {}, affixes: [], recipe: { ...item.recipe, manaVersion: 1, rolls: [...item.recipe.rolls] } };
  const r = item.recipe, quality = TIER_POWER[item.tier], enhance = 1 + .05 * r.enhancement;
  const baseScale = itemMaterialScale(item);
  const growth = itemPowerScale(item.itemLevel) * quality * enhance * baseScale;
  const weapon = r.profileId === STARTING_SWORD.id ? STARTING_SWORD : WEAPON_PROFILES.find(p => p.id === r.profileId);
  const shield = SHIELD_PROFILES.find(p => p.id === r.profileId);
  const armor: Partial<Record<ItemKind, number>> = { head: 5, chest: 11, gloves: 3, legs: 7, boots: 4 };
  if (item.focus) next.implicit = focusImplicit(r.profileId!, item.itemLevel, quality * enhance * baseScale);
  if (shield) next.implicit.armor = Math.round(({ buckler: 7, kite: 15, tower: 22 }[shield.visual.kind]) * growth);
  if (!r.starter) {
    if (armor[item.kind]) next.implicit.armor = Math.round(armor[item.kind]! * growth);
    if (item.kind === 'cloak') next.implicit.maxHp = Math.round(6 * growth);
    if (item.kind === 'amulet') next.implicit.maxMana = Math.round(7 * manaImplicitScale(item.itemLevel) * quality * enhance * baseScale);
    if (item.kind === 'ring') next.implicit.damagePercent = 2 * itemPercentageScale(item.itemLevel) * quality * enhance * baseScale;
  }
  if (JEWELRY_PROFILES.some(p=>p.id===r.profileId)) next.implicit=jewelryImplicit(r.profileId!,item.itemLevel,quality*enhance*baseScale);
  if (weapon && item.weapon) next.weapon = { ...item.weapon, damage: Math.round(weapon.damage * growth) };
  if (shield && item.shield) next.shield = { ...item.shield,
    blockChance: shield.blockChance * enhance,
    blockReduction: shield.blockReduction * enhance };
  next.affixes = item.affixes.map((affix, index) => {
    const definition = [...AFFIXES, ...SHIELD_AFFIXES, ...ELEMENTAL_AFFIXES, ...SKILL_AFFIXES].find(a => a.stat === affix.stat)!;
    const level = (PERCENT_STATS.has(affix.stat) || isManaBudgetStat(affix.stat)) ? itemAffixGrowthLevel(item.itemLevel) : item.itemLevel - 1;
    return { name: definition.name, stat: definition.stat,
      value: boundResistanceRoll(definition.stat, discreteAffixValue(definition.stat, r.rolls[index], item.itemLevel) ?? (definition.base + level * definition.growth) * (.85 + r.rolls[index] * .3) * quality * enhance * affixPotency(item.kind, definition.stat)) };
  });
  next.requiredLevel = Math.max(1, item.itemLevel - 2);
  next.power = Math.round((item.itemLevel * 10 + quality * baseScale * 12 + item.affixes.length * 7) * enhance);
  return roundItemStats(next);
}

/** Round actual item bonuses once after all multipliers. Small rolls remain useful. */
const wholeItemStat = (value: number): number => value === 0 ? 0 : Math.sign(value) * Math.max(1, Math.round(Math.abs(value)));
/** Also canonicalizes validated saved items without rerolling their recipes or changing ownership. */
export function roundItemStats(item: Item): Item {
  const next: Item = { ...item,
    implicit: Object.fromEntries(Object.entries(item.implicit).map(([key, value]) => [key, wholeItemStat(value!)])),
    affixes: item.affixes.map(affix => ({ ...affix, value: wholeItemStat(affix.value) })),
    ...(item.shield ? { shield: { ...item.shield, blockChance: wholeItemStat(item.shield.blockChance), blockReduction: wholeItemStat(item.shield.blockReduction) } } : {}),
  };
  return next.weapon?.enchantment || next.affixes.some(affix => isElementalAffix(affix.stat)) ? applyWeaponEnchantment(next) : next;
}

/** Rebuild elemental projection after generation or services, clearing removed affixes. */
function applyWeaponEnchantment(item: Item): Item {
  if (!item.weapon || item.weapon.attackKind !== 'melee') return item;
  const enchantment = meleeEnchantment(item.affixes);
  const { enchantment: _old, ...weapon } = item.weapon;
  const { glow: _glow, element: _element, ...visual } = weapon.visual;
  item.weapon = { ...weapon, ...(enchantment ? { enchantment } : {}), visual: { ...visual, element: enchantment?.element ?? 'physical',
    ...(enchantment ? { glow: ELEMENT_COLORS[enchantment.element] } : {}) } };
  return item;
}
export const itemDisplayName = (item: Item): string => `${item.name}${item.recipe.enhancement ? ` +${item.recipe.enhancement}` : ''}`;

/** Charms share item recipes, rarity and affix definitions; size owns their budget. */
function generateCharm(seed: number, itemLevel: number, profileId?: string, tierOverride?: ItemTier): Item {
  seed >>>= 0; const random = randomSource(seed), level=normalizeLevel(itemLevel);
  let sizeRoll=random()*100;
  const size=CHARM_SIZES.find(s=>(sizeRoll-=s.weight)<0) ?? CHARM_SIZES[0];
  const flavor=CHARM_FLAVORS[Math.floor(random()*CHARM_FLAVORS.length)];
  const selected=profileId ? CHARM_PROFILES.find(p=>p.id===profileId) : CHARM_PROFILES.find(p=>p.size.id===size.id && p.flavor===flavor);
  if(!selected) throw new RangeError(`Unknown charm profile: ${profileId}`);
  const roll=random(), tier=tierOverride??(roll<.45?'common':roll<.77?'magic':roll<.94?'rare':roll<.99?'epic':'legendary');
  const item:Item={id:`charm-${seed.toString(36)}-${level}-${selected.id}-${tier}`,seed,kind:'charm',tier,name:selected.name,baseName:selected.name,
    itemLevel:level,requiredLevel:Math.max(1,level-2),power:0,implicit:{},affixes:[],
    recipe:{charmVersion:1,manaVersion:1,profileId:selected.id,starter:false,enhancement:0,revision:0,targetedRolls:0,fullRolls:0,rolls:[]},
    appearance:{base:selected.flavor.base,edge:selected.flavor.edge,shadow:'#19252b',trim:selected.flavor.glow,style:'plate'}};
  const pool=itemAffixPool(item);
  for(let i=0;i<charmAffixCount(item);i++){
    const definition=rollAffix(pool.filter(a=>(i>0||charmThematicStat(item,a.stat))&&!affixConflicts(a.stat,item.affixes.map(a=>a.stat))),random);
    item.affixes.push({name:definition.name,stat:definition.stat,value:0});item.recipe.rolls.push(random());
  }
  return deriveCharm(item);
}
function deriveCharm(item:Item):Item {
  if (item.recipe.charmVersion !== 1) item = rebalanceCharm(item);
  const profile=charmProfile(item);if(!profile)throw new RangeError('Unknown charm profile');
  const quality=TIER_POWER[item.tier]*(1+.05*item.recipe.enhancement);
  const definitions=itemAffixPool(item);
  const affixes=item.affixes.map((a,i)=>{
    const definition=definitions.find(d=>d.stat===a.stat);if(!definition)throw new RangeError('Invalid charm affix');
    const growth=(PERCENT_STATS.has(a.stat)||isManaBudgetStat(a.stat))?itemAffixGrowthLevel(item.itemLevel):item.itemLevel-1;
    return {name:definition.name,stat:a.stat,value:boundResistanceRoll(a.stat,(definition.base+growth*definition.growth)*quality*(a.stat==='manaRegen'?profile.size.width*profile.size.height*.35:profile.size.potency)*(.85+item.recipe.rolls[i]*.3))};
  });
  return roundItemStats({...item,affixes,implicit:{},requiredLevel:Math.max(1,item.itemLevel-2),power:Math.round((item.itemLevel*10+affixes.length*7)*profile.size.potency*TIER_POWER[item.tier]*(1+.05*item.recipe.enhancement)),recipe:{...item.recipe,manaVersion:1,rolls:[...item.recipe.rolls]}});
}
export const itemAffixCount = (item:Pick<Item,'kind'|'tier'|'recipe'>) => item.kind==='charm'?charmAffixCount(item):TIER_AFFIXES[item.tier];

/** Upgrade validated pre-budget stones in place, retaining identity, roll quality and progress. */
export function rebalanceCharm(item: Item): Item {
  if (item.kind !== 'charm' || item.recipe.charmVersion === 1) return item;
  const next = {...item, recipe:{...item.recipe,charmVersion:1 as const,rolls:[] as number[]}, affixes:[] as ItemAffix[]};
  const random = randomSource(item.seed ^ 0x53ac914f), pool = itemAffixPool(item);
  const theme = item.affixes.findIndex(a=>charmThematicStat(item,a.stat));
  const indices = [theme, ...item.affixes.map((_,i)=>i).filter(i=>i!==theme)];
  for (let i=0;i<charmAffixCount(next);i++) {
    const index=indices[i], old=index>=0?item.affixes[index]:undefined;
    const choices=pool.filter(a=>(i>0||charmThematicStat(next,a.stat))&&!affixConflicts(a.stat,next.affixes.map(a=>a.stat)));
    const definition=old&&choices.find(a=>a.stat===old.stat)||rollAffix(choices,random);
    next.affixes.push({name:definition.name,stat:definition.stat,value:0});
    next.recipe.rolls.push(index>=0?item.recipe.rolls[index]:random());
  }
  return deriveCharm(next);
}

/** Reprice existing resource recipes once; preserve non-resource stats and every identity. */
export function rebalanceItemMana(item:Item):Item {
  if(item.recipe.manaVersion===1)return item;
  const current=deriveItem(item);
  const implicit={...item.implicit};
  for(const key of ['maxMana','manaRegen','manaOnKill'] as const) {
    if(current.implicit[key]!==undefined)implicit[key]=current.implicit[key];
    else delete implicit[key];
  }
  return {...item,implicit,recipe:{...item.recipe,manaVersion:1},affixes:item.affixes.map((a,i)=>isManaBudgetStat(a.stat)?current.affixes[i]:a)};
}
function isManaBudgetStat(stat:string):boolean { return stat==='maxMana'||stat==='manaRegen'||stat==='manaOnKill'; }
