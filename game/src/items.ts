import { FOCUS_PROFILES } from './focus-content.ts';
import { STARTING_SWORD } from './equipment.ts';
import { SHIELD_PROFILES, WEAPON_PROFILES } from './weapon-content.ts';
import { itemAffixGrowthLevel, itemPercentageScale, itemPowerScale, normalizeLevel } from './progression-content.ts';
import type { CharacterSheet, EquipmentSlot, Item, ItemAffix, ItemKind, ItemTier, StatKey, StatModifiers } from './character-types.ts';

export const INVENTORY_CAPACITY = 64;

export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = Object.freeze([
  'weapon', 'offhand', 'head', 'chest', 'gloves', 'legs', 'boots', 'cloak', 'amulet', 'ring1', 'ring2',
]);
export const ITEM_KINDS: readonly ItemKind[] = Object.freeze(['weapon', 'shield', 'grimoire', 'orb', 'head', 'chest', 'gloves', 'legs', 'boots', 'cloak', 'amulet', 'ring']);
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
export const PERCENT_STATS = new Set<StatKey>(['damagePercent', 'attackSpeedPercent', 'castSpeedPercent', 'critChance', 'critDamage', 'moveSpeedPercent', 'spellDamagePercent', 'cooldownPercent', 'manaCostPercent', 'blockChance', 'blockReduction']);
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
export const AFFIXES: readonly { name: string; stat: StatKey; base: number; growth: number }[] = [
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
export const SHIELD_AFFIXES: typeof AFFIXES = [
  { name: 'Deflection', stat: 'blockChance', base: 2, growth: .08 },
  { name: 'The Bulwark', stat: 'blockReduction', base: 4, growth: .12 },
];
/** Shared pool for rolling, improving and previewing caster equipment. */
export function itemAffixPool(item: { kind: ItemKind; weapon?: { family: string } }): typeof AFFIXES {
  if (item.kind === 'shield') return [...AFFIXES, ...SHIELD_AFFIXES];
  if (item.kind === 'grimoire' || item.kind === 'orb' || item.weapon?.family === 'wand') {
    return AFFIXES.filter(a => !['strength', 'dexterity', 'damagePercent', 'attackSpeedPercent', 'lifeOnHit', 'armor'].includes(a.stat));
  }
  return AFFIXES;
}
function focusImplicit(profileId: string, level: number, quality: number): StatModifiers {
  const profile = FOCUS_PROFILES.find(p => p.id === profileId)!;
  return Object.fromEntries(Object.entries(profile.implicit).map(([stat, value]) => [stat,
    Math.round(value! * quality * (PERCENT_STATS.has(stat as StatKey) ? itemPercentageScale(level) : itemPowerScale(level)) * 10) / 10]));
}
export const TIER_AFFIXES: Readonly<Record<ItemTier, number>> = { common: 0, magic: 1, rare: 2, epic: 3, legendary: 4 };
export const TIER_POWER: Readonly<Record<ItemTier, number>> = { common: 1, magic: 1.09, rare: 1.2, epic: 1.34, legendary: 1.5 };

/** Item-local generation; reward sources may supply an explicitly rolled tier. Callers own seed uniqueness. */
export function generateItem(seed: number, itemLevel: number, kind?: ItemKind, profileId?: string, tierOverride?: ItemTier): Item {
  if (tierOverride !== undefined && !Object.hasOwn(TIER_POWER, tierOverride)) throw new RangeError(`Unknown item tier: ${tierOverride}`);
  seed = seed >>> 0;
  const level = normalizeLevel(itemLevel);
  const random = randomSource(seed), choose = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)];
  const selectedWeapon = profileId ? WEAPON_PROFILES.find(profile => profile.id === profileId) : undefined;
  const selectedShield = profileId ? SHIELD_PROFILES.find(profile => profile.id === profileId) : undefined;
  const selectedFocus = profileId ? FOCUS_PROFILES.find(profile => profile.id === profileId) : undefined;
  if (profileId && !selectedWeapon && !selectedShield && !selectedFocus) throw new RangeError(`Unknown equipment profile: ${profileId}`);
  const itemKind = kind ?? (selectedWeapon ? 'weapon' : selectedShield ? 'shield' : selectedFocus ? selectedFocus.visual.kind : choose(ITEM_KINDS));
  if (profileId && (itemKind === 'weapon' ? !selectedWeapon : itemKind === 'shield' ? !selectedShield : selectedFocus?.visual.kind !== itemKind)) {
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
  const baseName = weaponProfile?.name ?? shieldProfile?.name ?? focusProfile?.name ?? BASE_NAMES[itemKind as Exclude<ItemKind, 'weapon' | 'shield' | 'grimoire' | 'orb'>][Math.floor(variant * 3)];
  const appearance = { ...choose(PALETTES) }, quality = TIER_POWER[tier];
  const growth = itemPowerScale(level) * quality;
  const rolls: number[] = [];
  const affixes: ItemAffix[] = [], remaining = [...itemAffixPool({ kind: itemKind, weapon: weaponProfile })];
  for (let index = 0; index < TIER_AFFIXES[tier]; index++) {
    const definition = remaining.splice(Math.floor(random() * remaining.length), 1)[0];
    const growthLevel = PERCENT_STATS.has(definition.stat) ? itemAffixGrowthLevel(level) : level - 1;
    const rollQuality = random(); rolls.push(rollQuality);
    const value = Math.round((definition.base + growthLevel * definition.growth) * (.85 + rollQuality * .3) * quality * 10) / 10;
    affixes.push({ name: definition.name, stat: definition.stat, value });
  }
  const implicit: StatModifiers = focusProfile ? focusImplicit(focusProfile.id, level, quality) : {};
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
    recipe: { ...((weaponProfile ?? shieldProfile ?? focusProfile) ? { profileId: (weaponProfile ?? shieldProfile ?? focusProfile)!.id } : {}), starter: false, enhancement: 0, revision: 0, targetedRolls: 0, fullRolls: 0, rolls },
    id: `item-${seed.toString(36)}-${level}-${weaponProfile?.id ?? shieldProfile?.id ?? focusProfile?.id ?? itemKind}-${tier}`, seed, name, baseName, kind: itemKind, tier,
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
  if (focusProfile) item.focus = { id: item.id, name, visual: { ...focusProfile.visual, base: appearance.base, edge: appearance.edge, trim: appearance.trim, shadow: appearance.shadow } };
  return item;
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
  const item = generateItem(1, 1, 'weapon', id === 'sword' ? 'longsword' : profile.id, 'common');
  item.id = 'starter-weapon'; item.baseName = profile.name;
  item.name = id === 'sword' ? profile.name : `Worn ${profile.name}`;
  item.implicit = {}; item.affixes = []; item.power = 1;
  item.recipe = { ...item.recipe, profileId: profile.id, starter: true, rolls: [] };
  item.weapon = { ...profile, visual: { ...profile.visual } };
  item.appearance = { base: profile.visual.metal, shadow: profile.visual.grip,
    edge: profile.visual.edge, trim: profile.visual.guard, style: 'plate' };
  let offhand: Item | null = null;
  if (option.offhandProfileId) {
    offhand = generateItem(2, 1, undefined, option.offhandProfileId, 'common');
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
    const item = generateItem(seed, 1, slot as ItemKind);
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
  return { skillRanks: {}, activeSkillRanks: {}, skillSpecializations: {}, arcaneOverload: false, gold: 0, commerce: { epoch: 0, revision: 0, operations: 0, sold: {}, buyback: [] }, attributes: { strength: 10, dexterity: 10, intelligence: 10, vitality: 10 },
    statPoints: 0, skillPoints: 0, allocatedNodes: ['origin'], inventory, equipped, skillSlots: Array.from({ length: 5 }, () => null) };
}

/** Rebuild from authored bases and exact roll quality; never scale rounded existing stats. */
export function deriveItem(item: Item): Item {
  const next: Item = { ...item, implicit: {}, affixes: [], recipe: { ...item.recipe, rolls: [...item.recipe.rolls] } };
  const r = item.recipe, quality = TIER_POWER[item.tier], enhance = 1 + .05 * r.enhancement;
  const growth = itemPowerScale(item.itemLevel) * quality * enhance;
  const weapon = r.profileId === STARTING_SWORD.id ? STARTING_SWORD : WEAPON_PROFILES.find(p => p.id === r.profileId);
  const shield = SHIELD_PROFILES.find(p => p.id === r.profileId);
  const armor: Partial<Record<ItemKind, number>> = { head: 5, chest: 11, gloves: 3, legs: 7, boots: 4 };
  if (item.focus) next.implicit = focusImplicit(r.profileId!, item.itemLevel, quality * enhance);
  if (shield) next.implicit.armor = Math.round(({ buckler: 7, kite: 15, tower: 22 }[shield.visual.kind]) * growth);
  if (!r.starter) {
    if (armor[item.kind]) next.implicit.armor = Math.round(armor[item.kind]! * growth);
    if (item.kind === 'cloak') next.implicit.maxHp = Math.round(6 * growth);
    if (item.kind === 'amulet') next.implicit.maxMana = Math.round(7 * growth);
    if (item.kind === 'ring') next.implicit.damagePercent = Math.round(2 * itemPercentageScale(item.itemLevel) * quality * enhance * 10) / 10;
  }
  if (weapon && item.weapon) next.weapon = { ...item.weapon, damage: Math.round(weapon.damage * growth) };
  if (shield && item.shield) next.shield = { ...item.shield,
    blockChance: Math.round(shield.blockChance * enhance * 10) / 10,
    blockReduction: Math.round(shield.blockReduction * enhance * 10) / 10 };
  next.affixes = item.affixes.map((affix, index) => {
    const definition = [...AFFIXES, ...SHIELD_AFFIXES].find(a => a.stat === affix.stat)!;
    const level = PERCENT_STATS.has(affix.stat) ? itemAffixGrowthLevel(item.itemLevel) : item.itemLevel - 1;
    return { name: definition.name, stat: definition.stat,
      value: Math.round((definition.base + level * definition.growth) * (.85 + r.rolls[index] * .3) * quality * enhance * 10) / 10 };
  });
  next.requiredLevel = Math.max(1, item.itemLevel - 2);
  next.power = Math.round((item.itemLevel * 10 + quality * 12 + item.affixes.length * 7) * enhance);
  return next;
}
export const itemDisplayName = (item: Item): string => `${item.name}${item.recipe.enhancement ? ` +${item.recipe.enhancement}` : ''}`;
