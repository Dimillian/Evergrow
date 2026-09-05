import type { WeaponDefinition } from './model.ts';

export type Attribute = 'strength' | 'dexterity' | 'intelligence' | 'vitality';
export type StatKey = Attribute | 'maxHp' | 'maxMana' | 'armor' | 'damagePercent' | 'attackSpeedPercent'
  | 'critChance' | 'critDamage' | 'moveSpeedPercent' | 'spellDamagePercent' | 'manaRegen'
  | 'lifeRegen' | 'cooldownPercent' | 'lifeOnHit';
export type StatModifiers = Partial<Record<StatKey, number>>;
export type EquipmentSlot = 'weapon' | 'head' | 'chest' | 'gloves' | 'legs' | 'boots' | 'cloak' | 'amulet' | 'ring1' | 'ring2';
export type ItemKind = Exclude<EquipmentSlot, 'ring1' | 'ring2'> | 'ring';
export type ItemTier = 'common' | 'magic' | 'rare' | 'epic' | 'legendary';
export interface ItemAffix { name: string; stat: StatKey; value: number; }
export interface Item {
  id: string; seed: number; name: string; baseName: string; kind: ItemKind; tier: ItemTier;
  itemLevel: number; requiredLevel: number; power: number;
  implicit: StatModifiers; affixes: ItemAffix[]; weapon?: WeaponDefinition;
  appearance: { base: string; shadow: string; edge: string; trim: string; style: 'plate' | 'leather' };
}
export type SkillId = 'cleave' | 'ember' | 'nova' | 'lunge' | 'volley' | 'siphon';
export interface CharacterSheet {
  attributes: Record<Attribute, number>;
  statPoints: number; skillPoints: number;
  allocatedNodes: string[];
  inventory: Array<Item | null>;
  equipped: Record<EquipmentSlot, Item | null>;
  skillSlots: Array<SkillId | null>;
}
export interface DerivedCharacterStats {
  attackSpeedMultiplier: number; attackDamageMultiplier: number;
  maxHp: number; maxMana: number; armor: number; damageReduction: number;
  critChance: number; critMultiplier: number; moveSpeedMultiplier: number;
  spellDamageMultiplier: number; manaRegeneration: number; lifeRegeneration: number;
  cooldownMultiplier: number; lifeOnHit: number;
  attributes: Record<Attribute, number>;
}
export interface ActionResult { ok: boolean; message?: string; }
export interface GroundItem { id: number; x: number; y: number; item: Item; }
