import type { Simulation } from './simulation.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { ActionResult, EquipmentSlot } from './character-types.ts';
import { EQUIPMENT_SLOTS, itemDisplayName } from './items.ts';
import { normalizePackLayout } from './inventory-grid.ts';
import { refreshCharacter } from './character.ts';
import { addGroundItem } from './ground-loot.ts';
import { treasureLanding } from './treasure-flight.ts';

export type DropItemSource = ({ type: 'bag'; index: number } | { type: 'equipment'; slot: EquipmentSlot }) & { id: string };

/** The caller holds simulation and other commands until this durable transfer completes. */
export async function executeDropItem(sim: Simulation, source: DropItemSource,
  persist: (checkpoint: CharacterCheckpoint) => Promise<ActionResult>): Promise<ActionResult> {
  if (sim.player.dead) return { ok: false, message: 'Cannot drop items while defeated.' };
  const sheet = sim.player.character;
  const item = source.type === 'bag'
    ? Number.isInteger(source.index) && source.index >= 0 ? sheet.inventory[source.index] : null
    : EQUIPMENT_SLOTS.includes(source.slot) ? sheet.equipped[source.slot] : null;
  if (!item || item.id !== source.id) return { ok: false, message: 'That item has changed.' };
  const checkpoint = sim.captureCheckpoint(), character = checkpoint.character;
  if (source.type === 'bag') character.inventory[source.index] = null;
  else character.equipped[source.slot] = null;
  if (character.inventoryLayout) delete character.inventoryLayout[item.id];
  character.recentItems = character.recentItems?.filter(id => id !== item.id);
  normalizePackLayout(character);
  const candidate = { ...sim.player, character, affixBuffs: sim.player.affixBuffs ? { ...sim.player.affixBuffs } : undefined };
  refreshCharacter(candidate);
  checkpoint.hp = candidate.hp; checkpoint.mana = candidate.mana;
  const id = sim.nextEntityIdentity;
  addGroundItem(checkpoint.groundItems, { id, item, ...treasureLanding(sim.world, sim.player.x, sim.player.y, id, item.seed),
    flight: { x: sim.player.x, y: sim.player.y, at: sim.time, delay: 0 } });
  let saved: ActionResult;
  try { saved = await persist(checkpoint); }
  catch { return { ok: false, message: 'Could not save. The item is still yours.' }; }
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. The item is still yours.' };
  sim.player.character = character;
  sim.groundItems = checkpoint.groundItems;
  sim.reserveIdentity(id + 1);
  refreshCharacter(sim.player);
  return { ok: true, message: `Dropped ${itemDisplayName(item)}` };
}
