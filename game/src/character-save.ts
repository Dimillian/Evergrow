import { ROAMING_RULES } from './roaming-encounters.ts';
import { validJourneys, type JourneyState } from './journey-state.ts';
import type { Expeditions, StoredActor } from './dungeon-state.ts';
import type { Pickup } from './model.ts';
import { validExpeditions, validActors, validCampWounds, validPickups } from './dungeon-validation.ts';
import { validEvents, validBlessing } from './poi-validation.ts';
import type { EventState } from './poi-content.ts';
import { validSkillProgression } from './skill-progression.ts';
import { validTravel, type TravelState } from './travel.ts';
import { GOLD_RULES, type GroundGold } from './gold.ts';
import { validGold } from './wallet.ts';
import type { CharacterSheet, GroundItem, Item, SkillId } from './character-types.ts';
import { INVENTORY_CAPACITY, EQUIPMENT_SLOTS } from './items.ts';
import { object, number, integer, text, validItem, type ObjectValue } from './item-validation.ts';
import { validCommerce } from './commerce-validation.ts';
import { itemFitsSlot } from './inventory.ts';
import { SKILL_NODES, unlockedSkills } from './skill-tree.ts';
import { MAX_CONTENT_LEVEL } from './progression-content.ts';
import { xpForNextLevel } from './progression.ts';

export const CHARACTER_SLOT_COUNT = 8;
export const CHARACTER_SAVE_VERSION = 3;
export const SAVE_MAX_BYTES = 700_000;
export interface CharacterCheckpoint {
  journeys?: JourneyState;
  roaming?: {warmup:number;cooldown:number;requiredDistance:number};
  campWounds?: StoredActor[];
  expeditions?: Expeditions; actors?: StoredActor[]; pickups?: Pickup[];
  events?: EventState;
  /** Absent until travel has been initialized; no portal and Briarwatch home by default. */
  travel?: TravelState;
  character: CharacterSheet; level: number; xp: number; x: number; y: number; angle: number;
  hp: number; mana: number; dead: boolean; flasks: number; healCooldown: number;
  dodgeCharges: number; dodgeRecharge: number; skillCooldowns: Partial<Record<SkillId, number>>;
  time: number; kills: number; randomState: number; spawnOrdinal: number; killRecharge: number;
  clearedCamps: string[]; defeatedCampMembers: Record<string, string[]>; groundItems: GroundItem[]; groundGold?: GroundGold[];
}
export interface CharacterSave {
  version: typeof CHARACTER_SAVE_VERSION; id: string; name: string;
  createdAt: number; updatedAt: number; worldSeed: number; worldVersion: number;
  checkpoint: CharacterCheckpoint;
}

function validSheet(v: unknown, level: number): v is CharacterSheet {
  if (object(v) && v.recentItems !== undefined && (!Array.isArray(v.recentItems)
    || v.recentItems.length > INVENTORY_CAPACITY + EQUIPMENT_SLOTS.length
    || !v.recentItems.every(id => text(id, 160)) || new Set(v.recentItems).size !== v.recentItems.length)) return false;
  if (!object(v) || !validBlessing(v.blessing) || !validCommerce(v.commerce, level) || (v.gold !== undefined && !validGold(v.gold)) || !object(v.attributes) || !['strength', 'dexterity', 'intelligence', 'vitality'].every(k => integer((v.attributes as ObjectValue)[k], 10, 5e6 + 10))
    || !integer(v.statPoints, 0, 5e6) || !integer(v.skillPoints, 0, MAX_CONTENT_LEVEL)
    || !Array.isArray(v.inventory) || v.inventory.length !== INVENTORY_CAPACITY || !v.inventory.every(i => i === null || validItem(i))
    || !object(v.equipped) || Object.keys(v.equipped).length !== EQUIPMENT_SLOTS.length
    || !EQUIPMENT_SLOTS.every(slot => { const item = (v.equipped as ObjectValue)[slot]; return item === null || validItem(item) && itemFitsSlot(item, slot) && item.requiredLevel <= level; })
    || !Array.isArray(v.allocatedNodes) || v.allocatedNodes.length > SKILL_NODES.size || !v.allocatedNodes.includes('origin')
    || !v.allocatedNodes.every(id => typeof id === 'string' && SKILL_NODES.has(id)) || new Set(v.allocatedNodes).size !== v.allocatedNodes.length) return false;
  const sheet = v as unknown as CharacterSheet;
  if (!validSkillProgression(sheet)) return false;
  const ids = [...sheet.inventory, ...Object.values(sheet.equipped)].filter((i): i is Item => i !== null).map(i => i.id);
  if (new Set(ids).size !== ids.length || sheet.equipped.weapon?.weapon?.hands === 2 && sheet.equipped.offhand !== null) return false;
  const allocated = new Set(sheet.allocatedNodes), connected = new Set(['origin']), queue = ['origin'];
  for (let i = 0; i < queue.length; i++) for (const next of SKILL_NODES.get(queue[i])!.neighbors) {
    if (allocated.has(next) && !connected.has(next)) { connected.add(next); queue.push(next); }
  }
  if (connected.size !== allocated.size || sheet.skillPoints + allocated.size - 1 + Object.values(sheet.skillRanks).reduce((sum, rank) => sum + rank - 1, 0) !== level - 1
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
    if (!object(p) || (p.journeys !== undefined && !validJourneys(p.journeys)) || (p.campWounds!==undefined&&!validCampWounds(p.campWounds)) || (p.roaming !== undefined && (!object(p.roaming) || !integer(p.roaming.warmup,0,ROAMING_RULES.warmupPopulation) || !number(p.roaming.cooldown,-1,10) || !number(p.roaming.requiredDistance,0,300))) || (p.expeditions !== undefined && !validExpeditions(p.expeditions)) || (p.actors !== undefined && !validActors(p.actors)) || (p.pickups !== undefined && !validPickups(p.pickups)) || (p.events !== undefined && !validEvents(p.events)) || (p.travel !== undefined && !validTravel(p.travel)) || !integer(p.level, 1, MAX_CONTENT_LEVEL) || !integer(p.xp, 0) || (p.level < MAX_CONTENT_LEVEL && p.xp >= xpForNextLevel(p.level))
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
    if (p.groundGold !== undefined && (!Array.isArray(p.groundGold) || p.groundGold.length > GOLD_RULES.maxPiles
      || !p.groundGold.every(i => object(i) && integer(i.id, 1) && number(i.x, -4e7, 4e7)
        && number(i.y, -4e7, 4e7) && integer(i.amount, 1) && number(i.age, 0, 10)))) return null;
    const groundIds = [...p.groundItems, ...((p.groundGold ?? []) as GroundGold[])].map(i => i.id);
    if (new Set(groundIds).size !== groundIds.length) return null;
    const expedition=p.expeditions as Expeditions | undefined;
    const storedItems=expedition?[...(expedition.surface?.groundItems??[]),...expedition.runs.flatMap(r=>r.contents.groundItems)].map(i=>i.item):[];
    if (expedition?.location && !expedition.runs.some(r=>r.entrance.id===expedition.location)) return null;
    const dungeonReturn=(p.travel as TravelState | undefined)?.returnTo?.dungeon;
    if(dungeonReturn && !expedition?.runs.some(r=>r.entrance.id===dungeonReturn))return null;
    const items = [...storedItems,...p.character.inventory, ...Object.values(p.character.equipped), ...p.groundItems.map(i => i.item), ...p.character.commerce.buyback.map(i => i.item)].filter(Boolean) as Item[];
    if (new Set(items.map(i => i.id)).size !== items.length || new Set(p.groundItems.map(i => i.id)).size !== p.groundItems.length) return null;
    for (const item of items) {
      if (!item.id.startsWith('stock:')) continue;
      const source = /^stock:(town:[0-9]+:-?[0-9]+:building:[0-9]+:(blacksmith|jeweler)):([0-9]+):([0-9]+)$/.exec(item.id);
      if (!source) return null;
      const epoch = Number(source[3]), slot = Number(source[4]), state = p.character.commerce;
      if (!Number.isSafeInteger(epoch) || epoch > Math.floor((p.level - 1) / 3) || slot >= (source[2] === 'jeweler' ? 6 : 12)) return null;
      if (epoch >= state.epoch && !(state.sold[source[1]] & 1 << slot)) return null;
    }
    return v as unknown as CharacterSave;
  } catch { return null; }
}
