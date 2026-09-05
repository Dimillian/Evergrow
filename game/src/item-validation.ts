import type { Item } from './character-types.ts';
import { ITEM_KINDS, TIER_NAMES, STAT_LABELS, TIER_AFFIXES } from './items.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from './weapon-content.ts';
import { STARTING_SWORD } from './equipment.ts';
import { MAX_CONTENT_LEVEL } from './progression-content.ts';
export type ObjectValue = Record<string, unknown>;
export const object = (v: unknown): v is ObjectValue => typeof v === 'object' && v !== null && !Array.isArray(v);
export const number = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
export const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => number(v, min, max) && Number.isSafeInteger(v);
export const text = (v: unknown, max = 100): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f]/u.test(v);
const color = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v);
const oneOf = (v: unknown, values: readonly unknown[]) => values.includes(v);
const modifiers = (v: unknown) => object(v) && Object.keys(v).every(key => Object.hasOwn(STAT_LABELS, key) && number(v[key], -1e9, 1e9));

export function validItem(v: unknown): v is Item {
  if (!object(v) || !text(v.id, 160) || !integer(v.seed, -2147483648, 4294967295) || !text(v.name)
    || !text(v.baseName) || !oneOf(v.kind, ITEM_KINDS) || !Object.hasOwn(TIER_NAMES, String(v.tier))
    || !integer(v.itemLevel, 1, MAX_CONTENT_LEVEL) || !integer(v.requiredLevel, 1, MAX_CONTENT_LEVEL)
    || !number(v.power) || !modifiers(v.implicit) || !Array.isArray(v.affixes) || v.affixes.length > 12
    || !v.affixes.every(a => object(a) && text(a.name) && Object.hasOwn(STAT_LABELS, String(a.stat)) && number(a.value, -1e9, 1e9))) return false;
  const r = v.recipe;
  if (!object(r) || typeof r.starter !== 'boolean' || !integer(r.enhancement, 0, 10) || !integer(r.revision)
    || !integer(r.targetedRolls) || !integer(r.fullRolls) || !Array.isArray(r.rolls) || r.rolls.length !== v.affixes.length
    || !r.rolls.every(n => number(n, 0, 1)) || new Set(v.affixes.map(a => a.stat)).size !== v.affixes.length
    || v.affixes.length !== TIER_AFFIXES[v.tier as Item['tier']]) return false;
  const profile = r.profileId;
  if (v.kind === 'weapon' && !(profile === STARTING_SWORD.id || WEAPON_PROFILES.some(p => p.id === profile))) return false;
  if (v.kind === 'shield' && !SHIELD_PROFILES.some(p => p.id === profile)) return false;
  if (v.kind !== 'weapon' && v.kind !== 'shield' && profile !== undefined) return false;
  const a = v.appearance;
  if (!object(a) || !oneOf(a.style, ['plate', 'leather']) || !['base', 'shadow', 'edge', 'trim'].every(key => color(a[key]))) return false;
  const w = v.weapon;
  const weaponProfile = profile === STARTING_SWORD.id ? STARTING_SWORD : WEAPON_PROFILES.find(p => p.id === profile);
  const shieldProfile = SHIELD_PROFILES.find(p => p.id === profile);
  if (v.kind === 'weapon') {
    if (!object(w) || !weaponProfile || w.family !== weaponProfile.family || w.hands !== weaponProfile.hands
      || w.attackKind !== weaponProfile.attackKind || w.damageType !== weaponProfile.damageType || !text(w.id) || !text(w.name) || !oneOf(w.family, ['sword', 'axe', 'mace', 'dagger', 'bow', 'staff'])
      || !oneOf(w.hands, [1, 2]) || !oneOf(w.attackKind, ['melee', 'arrow', 'bolt'])
      || !oneOf(w.damageType, ['physical', 'fire', 'frost', 'lightning', 'arcane'])
      || !number(w.damage, 1) || !number(w.baseAttacksPerSecond, .01, 100) || !number(w.reach, 1, 2000) || !number(w.arc, 0, Math.PI * 2)) return false;
    const visual = w.visual;
    if (!object(visual) || visual.kind !== w.family || !number(visual.length, 0, 500) || !number(visual.width, 0, 100)
      || !['metal', 'edge', 'grip', 'guard'].every(key => color(visual[key]))
      || visual.glow !== undefined && !color(visual.glow)
      || visual.gripLength !== undefined && !number(visual.gripLength, 0, 100)
      || visual.element !== undefined && !oneOf(visual.element, ['physical', 'fire', 'frost', 'lightning', 'arcane'])) return false;
  } else if (w !== undefined) return false;
  const shield = v.shield;
  if (v.kind === 'shield') {
    if (!object(shield) || !shieldProfile || !text(shield.id) || !text(shield.name) || !number(shield.blockChance, 0, 100)
      || !number(shield.blockReduction, 0, 150) || !object(shield.visual)
      || shield.visual.kind !== shieldProfile.visual.kind
      || !['base', 'shadow', 'edge', 'trim'].every(key => color((shield.visual as ObjectValue)[key]))) return false;
  } else if (shield !== undefined) return false;
  return true;
}
