import type { Building } from './settlements.ts';
import { getZoneAt } from './zone-progression.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import type { WorldQuery } from './model.ts';

export type NPCRole = 'blacksmith' | 'jeweler' | 'enchanter';
export interface TownNPC { id: string; name: string; role: NPCRole; x: number; y: number; level: number; seed: number; buildingId: string; }
export const NPC_NAMES: Record<NPCRole, string> = { blacksmith: 'Blacksmith', jeweler: 'Jeweler', enchanter: 'Enchanter' };
export const NPC_COLORS: Record<NPCRole, string> = { blacksmith: '#e9ad68', jeweler: '#8fdbc8', enchanter: '#baa2eb' };
export function hashService(value: string): number {
  let n = 2166136261;
  for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619);
  return n >>> 0;
}
export function buildingNPC(building: Building): TownNPC | null {
  const role = building.kind === 'blacksmith' ? 'blacksmith' : building.kind === 'merchant' ? 'jeweler'
    : building.kind === 'chapel' ? 'enchanter' : null;
  if (!role) return null;
  const x = building.door.x, y = building.door.y - 57, id = `${building.id}:${role}`;
  const seed = hashService(id), names = ['Mara', 'Oswin', 'Vesper', 'Iona', 'Alden', 'Sable', 'Corvin', 'Edda'];
  return { id, buildingId: building.id, role, x, y, seed, name: names[seed % names.length], level: getZoneAt(x, y).level };
}
export function canInteractNPC(npc: TownNPC, player: { x: number; y: number; dead?: boolean }, world: WorldQuery): boolean {
  return !player.dead && !world.blocked(npc.x, npc.y, 0) && !world.blocked(player.x, player.y, 0) && Math.hypot(player.x - npc.x, player.y - npc.y) <= 70
    && hasLineOfSight(world, player.x, player.y, npc.x, npc.y);
}
export function focusNPC(npcs: readonly TownNPC[], player: { x: number; y: number; dead?: boolean }, world: WorldQuery,
  pointer?: { x: number; y: number }): TownNPC | null {
  return npcs.filter(npc => canInteractNPC(npc, player, world) && (!pointer || Math.hypot(pointer.x - npc.x, pointer.y - (npc.y - 17)) <= 28))
    .sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0] ?? null;
}
