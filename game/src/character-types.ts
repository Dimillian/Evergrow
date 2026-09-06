import type { GoldWallet } from './wallet.ts';
import type { WeaponDefinition, FocusDefinition, ShieldDefinition } from './model.ts';

export type Attribute = 'strength' | 'dexterity' | 'intelligence' | 'vitality';
export type StatKey = Attribute | 'maxHp' | 'maxMana' | 'armor' | 'damagePercent' | 'attackSpeedPercent' | 'castSpeedPercent'
  | 'critChance' | 'critDamage' | 'moveSpeedPercent' | 'spellDamagePercent' | 'manaRegen'
  | 'lifeRegen' | 'manaCostPercent' | 'cooldownPercent' | 'lifeOnHit' | 'blockChance' | 'blockReduction';
export type StatModifiers = Partial<Record<StatKey, number>>;
export type EquipmentSlot = 'weapon' | 'offhand' | 'head' | 'chest' | 'gloves' | 'legs' | 'boots' | 'cloak' | 'amulet' | 'ring1' | 'ring2';
export type ItemKind = Exclude<EquipmentSlot, 'offhand' | 'ring1' | 'ring2'> | 'ring' | 'shield' | 'grimoire' | 'orb';
export type ItemTier = 'common' | 'magic' | 'rare' | 'epic' | 'legendary';
export interface ItemAffix { name: string; stat: StatKey; value: number; }
export interface ItemRecipe {
  profileId?: string; starter: boolean; enhancement: number; revision: number;
  targetedRolls: number; fullRolls: number; rolls: number[];
}
export interface CommerceState {
  epoch: number; revision: number; operations: number; sold: Record<string, number>;
  buyback: Array<{ item: Item; price: number }>;
}
export interface Item {
  recipe: ItemRecipe;
  id: string; seed: number; name: string; baseName: string; kind: ItemKind; tier: ItemTier;
  itemLevel: number; requiredLevel: number; power: number;
  implicit: StatModifiers; affixes: ItemAffix[]; weapon?: WeaponDefinition; shield?: ShieldDefinition; focus?: FocusDefinition;
  appearance: { base: string; shadow: string; edge: string; trim: string; style: 'plate' | 'leather' };
}
export type SkillId = 'cleave' | 'lunge' | 'whirlwind' | 'earthshatter' | 'shieldBash' | 'bulwark'
  | 'volley' | 'piercingShot' | 'ricochet' | 'rainOfArrows' | 'backstab'
  | 'cataclysm' | 'tempest' | 'absoluteZero' | 'fireball' | 'arcLightning' | 'iceNova' | 'frostLance' | 'meteor' | 'siphon';
export interface CharacterSheet extends GoldWallet {
  blessing?: import('./poi-content.ts').Blessing;
  commerce: CommerceState;
  attributes: Record<Attribute, number>;
  statPoints: number; skillPoints: number;
  allocatedNodes: string[];
  inventory: Array<Item | null>;
  /** Newest acquired first; absent until the first tracked pickup. */
  recentItems?: string[];
  equipped: Record<EquipmentSlot, Item | null>;
  skillSlots: Array<SkillId | null>;
  skillRanks: Partial<Record<SkillId, number>>;
  activeSkillRanks: Partial<Record<SkillId, number>>;
  skillSpecializations: Partial<Record<SkillId, string>>;
  arcaneOverload: boolean;
}
export interface DerivedCharacterStats {
  attackSpeedMultiplier: number; castSpeedMultiplier: number; attackDamageMultiplier: number;
  maxHp: number; maxMana: number; armor: number; damageReduction: number;
  critChance: number; critMultiplier: number; moveSpeedMultiplier: number;
  spellDamageMultiplier: number; manaRegeneration: number; lifeRegeneration: number;
  manaCostMultiplier: number; cooldownMultiplier: number; lifeOnHit: number;
  blockChance: number; blockReduction: number;
  attributes: Record<Attribute, number>;
}
export interface ActionResult { ok: boolean; message?: string; }
export interface GroundItem { id: number; x: number; y: number; item: Item; }
