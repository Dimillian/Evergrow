import type { Element, ResistanceStat } from './resistance-content.ts';
import type { ItemMaterialId } from './item-materials.ts';
import type { GearMaterial } from './gear-material-content.ts';
import type { GoldWallet } from './wallet.ts';
import type { WeaponDefinition, FocusDefinition, ShieldDefinition } from './model.ts';

export type Attribute = 'strength' | 'dexterity' | 'intelligence' | 'vitality';
export type StatKey = Attribute | ResistanceStat | 'goldFindPercent' | 'xpGainPercent' | 'maxHp' | 'maxMana' | 'armor' | 'damagePercent' | 'attackSpeedPercent' | 'castSpeedPercent'
  | 'critChance' | 'critDamage' | 'moveSpeedPercent' | 'spellDamagePercent' | 'manaRegen'
  | `skill:${SkillId}` | 'manaOnKill' | 'areaPercent' | 'potionPercent' | 'projectilePierce' | 'spellweavePercent' | 'afterguardPercent'
  | 'lifeRegen' | 'manaCostPercent' | 'cooldownPercent' | 'lifeOnHit' | 'blockChance' | 'blockReduction' | 'fireDamage' | 'frostDamage' | 'lightningDamage';
export type StatModifiers = Partial<Record<StatKey, number>>;
export type EquipmentSlot = 'weapon' | 'offhand' | 'head' | 'chest' | 'gloves' | 'legs' | 'boots' | 'cloak' | 'amulet' | 'ring1' | 'ring2';
export type ItemKind = Exclude<EquipmentSlot, 'offhand' | 'ring1' | 'ring2'> | 'ring' | 'shield' | 'grimoire' | 'orb' | 'charm';
export type ItemTier = 'common' | 'magic' | 'rare' | 'epic' | 'legendary';
export interface ItemAffix { name: string; stat: StatKey; value: number; }
export interface ItemRecipe {
  charmVersion?: 1;
  materialId?: ItemMaterialId;
  profileId?: string; starter: boolean; enhancement: number; revision: number;
  targetedRolls: number; fullRolls: number; rolls: number[];
}
export interface CommerceState {
  epoch: number; revision: number; operations: number; sold: Record<string, number>;
  buyback: Array<{ item: Item; price: number }>;
}
export interface Item {
  locked?: boolean;
  recipe: ItemRecipe;
  id: string; seed: number; name: string; baseName: string; kind: ItemKind; tier: ItemTier;
  itemLevel: number; requiredLevel: number; power: number;
  implicit: StatModifiers; affixes: ItemAffix[]; weapon?: WeaponDefinition; shield?: ShieldDefinition; focus?: FocusDefinition;
  appearance: { surface?: GearMaterial; base: string; shadow: string; edge: string; trim: string; style: 'plate' | 'leather' | 'cloth' };
}
export type SkillId = 'cleave' | 'lunge' | 'whirlwind' | 'earthshatter' | 'shieldBash' | 'bulwark'
  | 'volley' | 'piercingShot' | 'ricochet' | 'rainOfArrows' | 'backstab'
  | 'cataclysm' | 'tempest' | 'absoluteZero' | 'fireball' | 'arcLightning' | 'iceNova' | 'frostLance' | 'meteor' | 'siphon';
export interface CharacterSheet extends GoldWallet {
  look: import('./character-look.ts').CharacterLook;
  blessing?: import('./poi-content.ts').Blessing;
  commerce: CommerceState;
  attributes: Record<Attribute, number>;
  statPoints: number; skillPoints: number;
  allocatedNodes: string[];
  inventory: Array<Item | null>;
  /** Item IDs map to top-left cells in the carried pack. Unplaced older items remain in overflow. */
  inventoryLayout?: Record<string, number>;
  /** Personal storage shared by settlement chests, separate from the carried bag. */
  stash?: Array<Item | null>;
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
  resistances: Record<Element, number>; goldFindMultiplier: number; xpGainMultiplier: number;
  attackSpeedMultiplier: number; castSpeedMultiplier: number; attackDamageMultiplier: number;
  maxHp: number; maxMana: number; armor: number; damageReduction: number;
  critChance: number; critMultiplier: number; moveSpeedMultiplier: number;
  spellDamageMultiplier: number; manaRegeneration: number; lifeRegeneration: number;
  manaCostMultiplier: number; cooldownMultiplier: number; lifeOnHit: number;
  blockChance: number; blockReduction: number;
  manaOnKill: number; areaMultiplier: number; potionMultiplier: number; projectilePierce: number;
  spellweavePercent: number; afterguardPercent: number; skillBonuses: Partial<Record<SkillId, number>>;
  attributes: Record<Attribute, number>;
}
export interface ActionResult { ok: boolean; message?: string; }
export interface GroundItem { flight?: import('./treasure-flight.ts').TreasureFlight; id: number; x: number; y: number; item: Item; }
