import { POI_DEFINITIONS, type POIKind, type WorldPOI } from './world-pois.ts';
import type { DungeonMapIcon } from './dungeon-map-icon-art.ts';

export type MapIconId = POIKind | `dungeon:${DungeonMapIcon}` | 'player' | 'journey:destination' | 'journey:search' | 'enemy:normal' | 'enemy:brute' | 'enemy:caster' | 'enemy:veteran' | 'enemy:elite';
export type MapServiceKind = 'blacksmith' | 'jeweler' | 'enchanter' | 'gambler' | 'stash';
export const MAP_SERVICES: readonly MapServiceKind[] = ['blacksmith', 'jeweler', 'enchanter', 'gambler', 'stash'];
export interface MapLegendEntry { id: MapIconId; label: string; description: string; service?: MapServiceKind }
export interface MapLegendGroup { id: string; label: string; entries: readonly MapLegendEntry[] }
const poi = (id: POIKind, description: string): MapLegendEntry => ({ id, label: POI_DEFINITIONS[id].label, description,
  ...(MAP_SERVICES.includes(id as MapServiceKind) ? { service: id as MapServiceKind } : {}) });
export const MAP_LEGEND_GROUPS: readonly MapLegendGroup[] = [
  { id: 'services', label: 'NPCs & services', entries: [poi('blacksmith', 'Trade and improve weapons'), poi('jeweler', 'Jewelry and accessories'), poi('enchanter', 'Magic gear and enchantments'), poi('gambler', 'Buy unidentified equipment'), poi('stash', 'Your personal item storage')] },
  { id: 'towns', label: 'Towns & travel', entries: [poi('town', 'Settlement, village or city'), poi('portal', 'A travel portal'), poi('merchant', 'Merchant location'), poi('inn', 'An inn building'), poi('chapel', 'A chapel building')] },
  { id: 'encounters', label: 'Encounters & dungeons', entries: [poi('camp', 'A hostile encampment'), poi('bossLair', 'A powerful wilderness foe'), poi('rift', 'An entrance to a Crimson Rift'), poi('dungeon', 'An underground entrance'), poi('cursedChest', 'A dangerous treasure encounter'), poi('ruinedChapel', 'An encounter at a ruined chapel'), poi('beastDen', 'A den occupied by beasts'), poi('quarry', 'An encounter in a quarry'), poi('hamlet', 'A hostile occupied settlement'), poi('crossing', 'A guarded crossing'), poi('corruptedGrove', 'A blighted woodland encounter')] },
  { id: 'landmarks', label: 'Shrines & landmarks', entries: [poi('shrine', 'A wilderness shrine'), poi('reliquary', 'A sacred relic site'), poi('landmark', 'A notable place'), poi('watchtower', 'An old watchtower'), poi('graveyard', 'A burial ground'), poi('standingStones', 'An ancient stone circle'), poi('caravan', 'An abandoned wagon site')] },
  { id: 'navigation', label: 'You & your Journey', entries: [
    { id: 'player', label: 'Your character', description: 'Your location and facing' },
    { id: 'journey:destination', label: 'Journey destination', description: 'Objective flag; edge arrow when offscreen' },
    { id: 'journey:search', label: 'Journey search area', description: 'Search circle; edge arrow when offscreen' },
  ] },
  { id: 'dungeons', label: 'Inside dungeons', entries: [
    { id: 'dungeon:entry', label: 'Entrance / exit', description: 'Return to the surface' },
    { id: 'dungeon:riftPortal', label: 'Rift portal', description: 'Return from the rift to town' },
    { id: 'dungeon:chest', label: 'Dungeon chest', description: 'A treasure chest' },
    { id: 'dungeon:boss', label: 'Dungeon boss', description: 'The dungeon boss or Rift guardian' },
    { id: 'dungeon:reliquary', label: 'Bound Reliquary', description: 'Defeat the awakened waves' },
    { id: 'dungeon:ward', label: 'Fading Ward', description: 'Hold the circle against its guardians' },
    { id: 'dungeon:champion', label: 'Oathbound Sentinel', description: 'An elite foe and its retinue' },
  ] },
  { id: 'enemies', label: 'Nearby enemies', entries: [
    { id: 'enemy:normal', label: 'Enemy', description: 'Minimap and dungeon · ordinary enemy' },
    { id: 'enemy:brute', label: 'Brute', description: 'Minimap and dungeon · larger orange dot' },
    { id: 'enemy:caster', label: 'Caster', description: 'Minimap and dungeon · gold dot' },
    { id: 'enemy:veteran', label: 'Veteran', description: 'Minimap and dungeon · blue ranked enemy' },
    { id: 'enemy:elite', label: 'Elite', description: 'Minimap and dungeon · gold ranked enemy' },
  ] },
];

/** Presentation preferences shared by a game's charts, never character or discovery data. */
export class MapIconVisibility {
  private hidden = new Set<MapIconId>();
  private listeners = new Set<() => void>();
  isVisible(id: MapIconId) { return !this.hidden.has(id); }
  set(ids: readonly MapIconId[], visible: boolean) {
    let changed = false;
    for (const id of ids) { if (this.isVisible(id) === visible) continue; changed = true; if (visible) this.hidden.delete(id); else this.hidden.add(id); }
    if (changed) for (const listener of this.listeners) listener();
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
}
export function mapIconVisible(visibility: MapIconVisibility | undefined, id: MapIconId) { return visibility?.isVisible(id) ?? true; }
export function enemyMapIconId(enemy: { kind?: string; rank?: string }): MapIconId {
  return enemy.rank === 'elite' ? 'enemy:elite' : enemy.rank === 'veteran' ? 'enemy:veteran' : enemy.kind === 'brute' ? 'enemy:brute' : enemy.kind === 'caster' ? 'enemy:caster' : 'enemy:normal';
}
/** Only supplied discovered services qualify. Camera position and visibility filters do not affect distance. */
export function nearestMapService(pois: readonly WorldPOI[], kind: MapServiceKind, player: { x: number; y: number }): WorldPOI | null {
  if (![player.x, player.y].every(Number.isFinite)) return null;
  let nearest: WorldPOI | null = null, distance = Infinity;
  for (const poi of pois) {
    if (poi.kind !== kind || poi.sighted || ![poi.x, poi.y].every(Number.isFinite)) continue;
    const d = Math.hypot(poi.x - player.x, poi.y - player.y);
    if (d < distance || (d === distance && nearest && poi.id < nearest.id)) { nearest = poi; distance = d; }
  }
  return nearest;
}
