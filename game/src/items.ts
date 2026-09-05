import { STARTING_SWORD } from './equipment.ts';
import { SHIELD_PROFILES, WEAPON_PROFILES } from './weapon-content.ts';
import { itemAffixGrowthLevel, itemPercentageScale, itemPowerScale, normalizeLevel } from './progression-content.ts';
import type { CharacterSheet, EquipmentSlot, Item, ItemAffix, ItemKind, ItemTier, StatKey, StatModifiers } from './character-types.ts';

export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = Object.freeze([
  'weapon', 'offhand', 'head', 'chest', 'gloves', 'legs', 'boots', 'cloak', 'amulet', 'ring1', 'ring2',
]);
export const ITEM_KINDS: readonly ItemKind[] = Object.freeze(['weapon', 'shield', 'head', 'chest', 'gloves', 'legs', 'boots', 'cloak', 'amulet', 'ring']);
export const TIER_COLORS: Readonly<Record<ItemTier, string>> = Object.freeze({
  common: '#c5ccc8', magic: '#76b9ee', rare: '#e0c17a', epic: '#b895ef', legendary: '#f0a16b',
});
export const TIER_NAMES: Readonly<Record<ItemTier, string>> = Object.freeze({
  common: 'Common', magic: 'Magic', rare: 'Rare', epic: 'Epic', legendary: 'Legendary',
});
export const STAT_LABELS: Readonly<Record<StatKey, string>> = Object.freeze({
  strength: 'Strength', dexterity: 'Dexterity', intelligence: 'Intelligence', vitality: 'Vitality',
  maxHp: 'Maximum life', maxMana: 'Maximum mana', armor: 'Armor', damagePercent: 'Attack damage',
  attackSpeedPercent: 'Attack speed', castSpeedPercent: 'Cast speed', critChance: 'Critical chance', critDamage: 'Critical damage',
  moveSpeedPercent: 'Movement speed', spellDamagePercent: 'Spell damage', manaRegen: 'Mana / sec',
  lifeRegen: 'Life / sec', manaCostPercent: 'Mana cost reduction', cooldownPercent: 'Cooldown reduction', lifeOnHit: 'Life on hit',
  blockChance: 'Block chance', blockReduction: 'Blocked damage reduction',
});
const PERCENT_STATS = new Set<StatKey>(['damagePercent', 'attackSpeedPercent', 'castSpeedPercent', 'critChance', 'critDamage', 'moveSpeedPercent', 'spellDamagePercent', 'cooldownPercent', 'manaCostPercent', 'blockChance', 'blockReduction']);
export function formatStatValue(stat: StatKey, value: number): string {
  return `${value > 0 ? '+' : ''}${Number(value.toFixed(1))}${PERCENT_STATS.has(stat) ? '%' : ''}`;
}

export function itemModifiers(item: Item): StatModifiers {
  const modifiers: StatModifiers = { ...item.implicit };
  for (const affix of item.affixes) modifiers[affix.stat] = (modifiers[affix.stat] ?? 0) + affix.value;
  return modifiers;
}

// Local integer RNG keeps rolled equipment independent of encounter/combat randomness.
function randomSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let n = Math.imul(state ^ state >>> 15, state | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
const BASE_NAMES: Readonly<Record<Exclude<ItemKind, 'weapon' | 'shield'>, readonly string[]>> = {
  head: ['Crown Helm', 'Watcher Hood', 'Visored Helm'],
  chest: ['Brigandine', 'Warden Plate', 'Scale Vest'], gloves: ['Gauntlets', 'Grips', 'Vambraces'],
  legs: ['Greaves', 'Cuisses', 'Chausses'], boots: ['Sabatons', 'Treads', 'Longboots'],
  cloak: ['Mantle', 'Shroud', 'Halfcape'], amulet: ['Reliquary', 'Talisman', 'Moon Pendant'],
  ring: ['Signet', 'Band', 'Loop'],
};
const PREFIXES = ['Ashen', 'Starbound', 'Thornwrought', 'Gloaming', 'Hollow', 'Dawnforged', 'Mournful', 'Graveglass', 'Moonlit', 'Briar'];
const SUFFIXES = ['of the Watch', 'of Embers', 'of the Hollow', 'of Still Water', 'of the Pilgrim', 'of Thorns', 'of the Pale Star', 'of Dusk'];
const TITLES = ['Oath', 'Vigil', 'Remnant', 'Requiem', 'Promise', 'Echo', 'Witness', 'Memory'];
const PALETTES: readonly Item['appearance'][] = [
  { base: '#728c81', shadow: '#294750', edge: '#d1d6b0', trim: '#cfaa6c', style: 'plate' },
  { base: '#647e9b', shadow: '#29364c', edge: '#c8ddec', trim: '#bec0bc', style: 'plate' },
  { base: '#837075', shadow: '#3d303f', edge: '#d5bdb4', trim: '#d5ac78', style: 'plate' },
  { base: '#657962', shadow: '#293e36', edge: '#afbea0', trim: '#b99763', style: 'leather' },
  { base: '#735942', shadow: '#322a30', edge: '#c4ab86', trim: '#d5b270', style: 'leather' },
  { base: '#786994', shadow: '#343249', edge: '#c6badf', trim: '#c7d4d6', style: 'plate' },
];
const AFFIXES: readonly { name: string; stat: StatKey; base: number; growth: number }[] = [
  { name: 'Might', stat: 'strength', base: 2, growth: .25 },
  { name: 'Grace', stat: 'dexterity', base: 2, growth: .25 },
  { name: 'Insight', stat: 'intelligence', base: 2, growth: .25 },
  { name: 'Vigor', stat: 'vitality', base: 2, growth: .25 },
  { name: 'The Hart', stat: 'maxHp', base: 8, growth: 1.8 },
  { name: 'The Wellspring', stat: 'maxMana', base: 8, growth: 1.5 },
  { name: 'Shelter', stat: 'armor', base: 6, growth: 1.4 },
  { name: 'Ruin', stat: 'damagePercent', base: 4, growth: .35 },
  { name: 'Invocation', stat: 'castSpeedPercent', base: 3, growth: .18 },
  { name: 'Haste', stat: 'attackSpeedPercent', base: 3, growth: .18 },
  { name: 'Precision', stat: 'critChance', base: 1, growth: .08 },
  { name: 'Severity', stat: 'critDamage', base: 6, growth: .35 },
  { name: 'The Wanderer', stat: 'moveSpeedPercent', base: 2, growth: .12 },
  { name: 'Sorcery', stat: 'spellDamagePercent', base: 5, growth: .45 },
  { name: 'Clarity', stat: 'manaRegen', base: .5, growth: .08 },
  { name: 'Renewal', stat: 'lifeRegen', base: .3, growth: .05 },
  { name: 'Efficiency', stat: 'manaCostPercent', base: 4, growth: .15 },
  { name: 'Readiness', stat: 'cooldownPercent', base: 2, growth: .1 },
  { name: 'Sustenance', stat: 'lifeOnHit', base: 1, growth: .12 },
];
const SHIELD_AFFIXES: typeof AFFIXES = [
  { name: 'Deflection', stat: 'blockChance', base: 2, growth: .08 },
  { name: 'The Bulwark', stat: 'blockReduction', base: 4, growth: .12 },
];
const TIER_AFFIXES: Readonly<Record<ItemTier, number>> = { common: 0, magic: 1, rare: 2, epic: 3, legendary: 4 };
const TIER_POWER: Readonly<Record<ItemTier, number>> = { common: 1, magic: 1.09, rare: 1.2, epic: 1.34, legendary: 1.5 };

/** Item-local generation; reward sources may supply an explicitly rolled tier. Callers own seed uniqueness. */
export function generateItem(seed: number, itemLevel: number, kind?: ItemKind, profileId?: string, tierOverride?: ItemTier): Item {
  if (tierOverride !== undefined && !Object.hasOwn(TIER_POWER, tierOverride)) throw new RangeError(`Unknown item tier: ${tierOverride}`);
  seed = seed >>> 0;
  const level = normalizeLevel(itemLevel);
  const random = randomSource(seed), choose = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)];
  const selectedWeapon = profileId ? WEAPON_PROFILES.find(profile => profile.id === profileId) : undefined;
  const selectedShield = profileId ? SHIELD_PROFILES.find(profile => profile.id === profileId) : undefined;
  if (profileId && !selectedWeapon && !selectedShield) throw new RangeError(`Unknown equipment profile: ${profileId}`);
  const itemKind = kind ?? (selectedWeapon ? 'weapon' : selectedShield ? 'shield' : choose(ITEM_KINDS));
  if (profileId && (itemKind === 'weapon' ? !selectedWeapon : itemKind === 'shield' ? !selectedShield : true)) {
    throw new RangeError(`Profile ${profileId} does not describe an item of kind ${itemKind}.`);
  }
  const roll = random();
  // This default is for general content tools and starting gear. Enemy loot supplies its own table result.
  // Consume the same draw with an override so the underlying silhouette/material roll stays stable.
  const tier: ItemTier = tierOverride ?? (roll < .45 ? 'common' : roll < .77 ? 'magic' : roll < .94 ? 'rare' : roll < .99 ? 'epic' : 'legendary');
  const variant = random();
  const weaponProfile = itemKind === 'weapon' ? selectedWeapon ?? WEAPON_PROFILES[Math.floor(variant * WEAPON_PROFILES.length)] : undefined;
  const shieldProfile = itemKind === 'shield' ? selectedShield ?? SHIELD_PROFILES[Math.floor(variant * SHIELD_PROFILES.length)] : undefined;
  const baseName = weaponProfile?.name ?? shieldProfile?.name ?? BASE_NAMES[itemKind as Exclude<ItemKind, 'weapon' | 'shield'>][Math.floor(variant * 3)];
  const appearance = { ...choose(PALETTES) }, quality = TIER_POWER[tier];
  const growth = itemPowerScale(level) * quality;
  const affixes: ItemAffix[] = [], remaining = itemKind === 'shield' ? [...AFFIXES, ...SHIELD_AFFIXES] : [...AFFIXES];
  for (let index = 0; index < TIER_AFFIXES[tier]; index++) {
    const definition = remaining.splice(Math.floor(random() * remaining.length), 1)[0];
    const growthLevel = PERCENT_STATS.has(definition.stat) ? itemAffixGrowthLevel(level) : level - 1;
    const value = Math.round((definition.base + growthLevel * definition.growth) * (.85 + random() * .3) * quality * 10) / 10;
    affixes.push({ name: definition.name, stat: definition.stat, value });
  }
  const implicit: StatModifiers = {};
  const armorBase: Partial<Record<ItemKind, number>> = { head: 5, chest: 11, gloves: 3, legs: 7, boots: 4 };
  if (armorBase[itemKind]) implicit.armor = Math.max(1, Math.round(armorBase[itemKind]! * growth));
  if (shieldProfile) implicit.armor = Math.max(1, Math.round(({ buckler: 7, kite: 15, tower: 22 }[shieldProfile.visual.kind]) * growth));
  if (itemKind === 'cloak') implicit.maxHp = Math.round(6 * growth);
  if (itemKind === 'amulet') implicit.maxMana = Math.round(7 * growth);
  if (itemKind === 'ring') implicit.damagePercent = Math.round(2 * itemPercentageScale(level) * quality * 10) / 10;
  const prefix = choose(PREFIXES), suffix = choose(SUFFIXES);
  const name = tier === 'common' ? `${prefix} ${baseName}` : tier === 'magic' ? `${prefix} ${baseName} ${suffix}`
    : `${prefix} ${choose(TITLES)}`;
  const item: Item = {
    id: `item-${seed.toString(36)}-${level}-${weaponProfile?.id ?? shieldProfile?.id ?? itemKind}-${tier}`, seed, name, baseName, kind: itemKind, tier,
    itemLevel: level, requiredLevel: Math.max(1, level - 2),
    power: Math.round(level * 10 + quality * 12 + affixes.length * 7), implicit, affixes, appearance,
  };
  if (weaponProfile) {
    item.weapon = { ...weaponProfile, id: item.id, name, damage: Math.round(weaponProfile.damage * growth),
      visual: { ...weaponProfile.visual, metal: appearance.base, edge: appearance.edge, grip: appearance.shadow, guard: appearance.trim,
        ...(!weaponProfile.visual.glow && (tier === 'epic' || tier === 'legendary') ? { glow: TIER_COLORS[tier] } : {}) } };
  }
  if (shieldProfile) {
    item.shield = { ...shieldProfile, id: item.id, name,
      visual: { ...shieldProfile.visual, base: appearance.base, edge: appearance.edge, trim: appearance.trim, shadow: appearance.shadow } };
  }
  return item;
}

/** Starter pieces preserve the current appearance without quietly adding combat bonuses. */
export function createCharacterSheet(): CharacterSheet {
  const equipped = Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, null])) as CharacterSheet['equipped'];
  const starterPieces: readonly [EquipmentSlot, number][] = [['weapon', 1], ['head', 31], ['chest', 17], ['gloves', 23], ['legs', 59], ['boots', 11], ['cloak', 71]];
  for (const [slot, seed] of starterPieces) {
    const item = generateItem(seed, 1, slot as ItemKind);
    const wornNames: Partial<Record<EquipmentSlot, string>> = { weapon: 'Longsword', head: 'Crown Helm', chest: 'Warden Plate',
      gloves: 'Gauntlets', legs: 'Greaves', boots: 'Longboots', cloak: 'Mantle' };
    item.baseName = wornNames[slot]!;
    item.id = `starter-${slot}`; item.name = slot === 'weapon' ? STARTING_SWORD.name : `Worn ${item.baseName}`;
    item.tier = 'common'; item.implicit = {}; item.affixes = []; item.power = 1;
    item.appearance = { ...PALETTES[0] };
    if (slot === 'boots') item.appearance = { base: '#5c4c41', shadow: '#292b30', edge: '#a79873', trim: '#b18b58', style: 'leather' };
    if (slot === 'cloak') item.appearance = { base: '#92364e', shadow: '#4e2a3e', edge: '#cf5e69', trim: '#d4a070', style: 'leather' };
    if (slot === 'weapon') {
      item.weapon = { ...STARTING_SWORD, visual: { ...STARTING_SWORD.visual } };
      item.appearance = { base: STARTING_SWORD.visual.metal, shadow: STARTING_SWORD.visual.grip,
        edge: STARTING_SWORD.visual.edge, trim: STARTING_SWORD.visual.guard, style: 'plate' };
    }
    equipped[slot] = item;
  }
  const inventory: CharacterSheet['inventory'] = Array.from({ length: 48 }, () => null);
  const startingPack: readonly [ItemKind, string?][] = [
    ['weapon', 'longsword'], ['chest'], ['ring'], ['boots'], ['shield', 'iron-buckler'],
    ['weapon', 'thorn-shortbow'], ['weapon', 'ember-staff'], ['weapon', 'rondel-dagger'],
  ];
  startingPack.forEach(([kind, profileId], index) => {
    inventory[index] = generateItem(4201 + index * 313, 1, kind, profileId);
  });
  return { attributes: { strength: 10, dexterity: 10, intelligence: 10, vitality: 10 },
    statPoints: 0, skillPoints: 0, allocatedNodes: ['origin'], inventory, equipped, skillSlots: Array.from({ length: 5 }, () => null) };
}
