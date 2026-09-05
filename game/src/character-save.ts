import type { CharacterSheet, GroundItem, Item, SkillId } from './character-types.ts';
import { INVENTORY_CAPACITY, EQUIPMENT_SLOTS, ITEM_KINDS, TIER_NAMES, STAT_LABELS } from './items.ts';
import { itemFitsSlot } from './inventory.ts';
import { SKILL_NODES, unlockedSkills } from './skill-tree.ts';
import { MAX_CONTENT_LEVEL } from './progression-content.ts';
import { xpForNextLevel } from './progression.ts';

export const CHARACTER_SLOT_COUNT = 8;
export const CHARACTER_SAVE_VERSION = 1;
export const SAVE_MAX_BYTES = 700_000;
export interface CharacterCheckpoint {
  character: CharacterSheet; level: number; xp: number; x: number; y: number; angle: number;
  hp: number; mana: number; dead: boolean; flasks: number; healCooldown: number;
  dodgeCharges: number; dodgeRecharge: number; skillCooldowns: Partial<Record<SkillId, number>>;
  time: number; kills: number; randomState: number; spawnOrdinal: number; killRecharge: number;
  clearedCamps: string[]; defeatedCampMembers: Record<string, string[]>; groundItems: GroundItem[];
}
export interface CharacterSave {
  version: typeof CHARACTER_SAVE_VERSION; id: string; name: string;
  createdAt: number; updatedAt: number; worldSeed: number; worldVersion: number;
  checkpoint: CharacterCheckpoint;
}
type ObjectValue = Record<string, unknown>;
const object = (v: unknown): v is ObjectValue => typeof v === 'object' && v !== null && !Array.isArray(v);
const number = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => number(v, min, max) && Number.isSafeInteger(v);
const text = (v: unknown, max = 100): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f]/u.test(v);
const color = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v);
const oneOf = (v: unknown, values: readonly unknown[]) => values.includes(v);
const modifiers = (v: unknown) => object(v) && Object.keys(v).every(key => Object.hasOwn(STAT_LABELS, key) && number(v[key], -1e9, 1e9));

function validItem(v: unknown): v is Item {
  if (!object(v) || !text(v.id, 160) || !integer(v.seed, -2147483648, 4294967295) || !text(v.name)
    || !text(v.baseName) || !oneOf(v.kind, ITEM_KINDS) || !Object.hasOwn(TIER_NAMES, String(v.tier))
    || !integer(v.itemLevel, 1, MAX_CONTENT_LEVEL) || !integer(v.requiredLevel, 1, MAX_CONTENT_LEVEL)
    || !number(v.power) || !modifiers(v.implicit) || !Array.isArray(v.affixes) || v.affixes.length > 12
    || !v.affixes.every(a => object(a) && text(a.name) && Object.hasOwn(STAT_LABELS, String(a.stat)) && number(a.value, -1e9, 1e9))) return false;
  const a = v.appearance;
  if (!object(a) || !oneOf(a.style, ['plate', 'leather']) || !['base', 'shadow', 'edge', 'trim'].every(key => color(a[key]))) return false;
  const w = v.weapon;
  if (v.kind === 'weapon') {
    if (!object(w) || !text(w.id) || !text(w.name) || !oneOf(w.family, ['sword', 'axe', 'mace', 'dagger', 'bow', 'staff'])
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
    if (!object(shield) || !text(shield.id) || !text(shield.name) || !number(shield.blockChance, 0, 100)
      || !number(shield.blockReduction, 0, 100) || !object(shield.visual)
      || !oneOf(shield.visual.kind, ['buckler', 'kite', 'tower'])
      || !['base', 'shadow', 'edge', 'trim'].every(key => color((shield.visual as ObjectValue)[key]))) return false;
  } else if (shield !== undefined) return false;
  return true;
}

function validSheet(v: unknown, level: number): v is CharacterSheet {
  if (!object(v) || !object(v.attributes) || !['strength', 'dexterity', 'intelligence', 'vitality'].every(k => integer((v.attributes as ObjectValue)[k], 10, 5e6 + 10))
    || !integer(v.statPoints, 0, 5e6) || !integer(v.skillPoints, 0, MAX_CONTENT_LEVEL)
    || !Array.isArray(v.inventory) || v.inventory.length !== INVENTORY_CAPACITY || !v.inventory.every(i => i === null || validItem(i))
    || !object(v.equipped) || Object.keys(v.equipped).length !== EQUIPMENT_SLOTS.length
    || !EQUIPMENT_SLOTS.every(slot => { const item = (v.equipped as ObjectValue)[slot]; return item === null || validItem(item) && itemFitsSlot(item, slot) && item.requiredLevel <= level; })
    || !Array.isArray(v.allocatedNodes) || v.allocatedNodes.length > SKILL_NODES.size || !v.allocatedNodes.includes('origin')
    || !v.allocatedNodes.every(id => typeof id === 'string' && SKILL_NODES.has(id)) || new Set(v.allocatedNodes).size !== v.allocatedNodes.length) return false;
  const sheet = v as unknown as CharacterSheet;
  const ids = [...sheet.inventory, ...Object.values(sheet.equipped)].filter((i): i is Item => i !== null).map(i => i.id);
  if (new Set(ids).size !== ids.length || sheet.equipped.weapon?.weapon?.hands === 2 && sheet.equipped.offhand !== null) return false;
  const allocated = new Set(sheet.allocatedNodes), connected = new Set(['origin']), queue = ['origin'];
  for (let i = 0; i < queue.length; i++) for (const next of SKILL_NODES.get(queue[i])!.neighbors) {
    if (allocated.has(next) && !connected.has(next)) { connected.add(next); queue.push(next); }
  }
  if (connected.size !== allocated.size || sheet.skillPoints + allocated.size - 1 !== level - 1
    || sheet.statPoints + Object.values(sheet.attributes).reduce((sum, n) => sum + n - 10, 0) !== (level - 1) * 5) return false;
  const unlocked = unlockedSkills(sheet.allocatedNodes);
  return Array.isArray(v.skillSlots) && v.skillSlots.length === 5 && v.skillSlots.every(id => id === null || unlocked.includes(id))
    && new Set(v.skillSlots.filter(Boolean)).size === v.skillSlots.filter(Boolean).length;
}

/** Reject the entire checkpoint before touching the current character. No partial repair or migration. */
export function decodeCharacterSave(raw: string): CharacterSave | null {
  if (raw.length > SAVE_MAX_BYTES) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!object(v) || v.version !== CHARACTER_SAVE_VERSION || !text(v.id, 64) || !/^[a-zA-Z0-9-]+$/.test(v.id)
      || !text(v.name, 24) || !integer(v.createdAt) || !integer(v.updatedAt) || v.updatedAt < v.createdAt
      || !integer(v.worldSeed, 0, 4294967295) || !integer(v.worldVersion, 1)) return null;
    const p = v.checkpoint;
    if (!object(p) || !integer(p.level, 1, MAX_CONTENT_LEVEL) || !integer(p.xp, 0) || (p.level < MAX_CONTENT_LEVEL && p.xp >= xpForNextLevel(p.level))
      || !validSheet(p.character, p.level) || !number(p.x, -4e7, 4e7) || !number(p.y, -4e7, 4e7) || !number(p.angle, -1000, 1000)
      || !number(p.hp, 0, 1e9) || !number(p.mana, 0, 1e9) || typeof p.dead !== 'boolean' || (!p.dead && p.hp <= 0)
      || !integer(p.flasks, 0, 2) || !number(p.healCooldown, 0, 1000) || !integer(p.dodgeCharges, 0, 2) || !number(p.dodgeRecharge, 0, 1000)
      || !number(p.time) || !integer(p.kills) || !integer(p.randomState, 0, 4294967295) || !integer(p.spawnOrdinal)
      || !integer(p.killRecharge, 0, 1000) || !object(p.skillCooldowns)
      || !Object.entries(p.skillCooldowns).every(([id, n]) => unlockedSkills((p.character as CharacterSheet).allocatedNodes).includes(id as SkillId) && number(n, 0, 1000))
      || !Array.isArray(p.clearedCamps) || p.clearedCamps.length > 1024 || !p.clearedCamps.every(id => text(id, 180))
      || new Set(p.clearedCamps).size !== p.clearedCamps.length
      || !object(p.defeatedCampMembers) || Object.keys(p.defeatedCampMembers).length > 1024
      || !Object.entries(p.defeatedCampMembers).every(([id, members]) => text(id, 180) && Array.isArray(members)
        && members.length <= 32 && members.every(member => text(member, 180)) && new Set(members).size === members.length)
      || new Set([...p.clearedCamps, ...Object.keys(p.defeatedCampMembers)]).size > 1024
      || !Array.isArray(p.groundItems) || p.groundItems.length > 96
      || !p.groundItems.every(i => object(i) && integer(i.id, 1) && number(i.x, -4e7, 4e7) && number(i.y, -4e7, 4e7) && validItem(i.item))) return null;
    const items = [...p.character.inventory, ...Object.values(p.character.equipped), ...p.groundItems.map(i => i.item)].filter(Boolean) as Item[];
    if (new Set(items.map(i => i.id)).size !== items.length || new Set(p.groundItems.map(i => i.id)).size !== p.groundItems.length) return null;
    return v as unknown as CharacterSave;
  } catch { return null; }
}
