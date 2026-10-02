import type { GroundItem, ItemTier, Item } from './character-types.ts';
import type { CombatEvent } from './model.ts';
import { TREASURE_FLIGHT_DURATION } from './treasure-flight.ts';

export type LootLandingCue = 'metal' | 'armor' | 'cloth' | 'wood' | 'charm' | SpecialLootTier;
export function lootLandingMaterial(item: Item): Exclude<LootLandingCue, SpecialLootTier> {
  if (['charm','ring','amulet','orb','riftKey'].includes(item.kind)) return 'charm';
  if (item.kind === 'weapon') return item.weapon?.family === 'bow' || item.weapon?.family === 'staff' ? 'wood' : 'metal';
  if (item.appearance.style === 'cloth' || item.kind === 'grimoire') return 'cloth';
  return item.appearance.style === 'plate' || item.kind === 'shield' ? 'armor' : 'cloth';
}
export const MONSTER_DROP_FLIGHT = .46;
export type SpecialLootTier = 'legendary' | 'unique';
export const LOOT_BEACONS = {
  legendary: { color: '#ffb45f', core: '#fff0c0', accent: '#ef792e', height: 108, radius: 98, power: .48 },
  unique: { color: '#ef78b2', core: '#ffe4f5', accent: '#ac77f4', height: 132, radius: 112, power: .56 },
} as const;
export function specialLootTier(tier: ItemTier): tier is SpecialLootTier { return tier === 'legendary' || tier === 'unique'; }
export function lootDropEvent(drop: GroundItem): Extract<CombatEvent, { type: 'item-drop' }> {
  return { type: 'item-drop', x: drop.x, y: drop.y, dropId: drop.id, tier: drop.item.tier,
    landAt: drop.flight ? drop.flight.at + drop.flight.delay + TREASURE_FLIGHT_DURATION : null };
}

/** Transient reward presentation: never inferred from a loaded save or a manually discarded item. */
export class LootDropPresentation {
  private arrivals = new Map<number, { at: number | null; start: number | null; hop: boolean; tier: ItemTier; sounded: boolean }>();
  private lastSound = -Infinity;
  private lastOrdinarySound = -Infinity;
  private lastTier: SpecialLootTier | null = null;
  reset() { this.arrivals.clear(); this.lastSound = -Infinity; this.lastTier = null; this.lastOrdinarySound = -Infinity; }
  handle(events: readonly CombatEvent[]) {
    for (const event of events) if (event.type === 'item-drop') {
      if (this.arrivals.has(event.dropId)) continue;
      if (this.arrivals.size >= 64) {
        const ordinary = [...this.arrivals].find(([, arrival]) => !specialLootTier(arrival.tier));
        if (!ordinary && !specialLootTier(event.tier)) continue;
        this.arrivals.delete(ordinary?.[0] ?? this.arrivals.keys().next().value!);
      }
      this.arrivals.set(event.dropId, { at: event.landAt, start: null, hop: event.landAt === null, tier: event.tier, sounded: false });
    }
  }
  advance(drops: readonly GroundItem[], time: number, listener: { x: number; y: number }): LootLandingCue | null {
    if (!this.arrivals.size) return null;
    const present = new Map(drops.map(drop => [drop.id, drop]));
    let cue: LootLandingCue | null = null;
    let priority = -1;
    for (const [id, arrival] of this.arrivals) {
      arrival.start ??= time;
      arrival.at ??= time + MONSTER_DROP_FLIGHT + (id % 4) * .025;
      const drop = present.get(id);
      if (!drop || time - arrival.at > 1.4) { this.arrivals.delete(id); continue; }
      if (time < arrival.at || arrival.sounded) continue;
      // Coalesce treasure showers; discard suppressed cues rather than building an audio backlog.
      arrival.sounded = true;
      if (Math.hypot(drop.x - listener.x, drop.y - listener.y) >= 850) continue;
      const special = specialLootTier(arrival.tier);
      const rank = arrival.tier === 'unique' ? 3 : arrival.tier === 'legendary' ? 2 : 1;
      const audible = special
        ? time - this.lastSound >= .65 || arrival.tier === 'unique' && this.lastTier === 'legendary'
        : time - this.lastOrdinarySound >= .18 && time - this.lastSound >= .35;
      if (audible && rank > priority) { cue = special ? arrival.tier as SpecialLootTier : lootLandingMaterial(drop.item); priority = rank; }
    }
    if (cue) {
      if (cue === 'legendary' || cue === 'unique') { this.lastSound = time; this.lastTier = cue; }
      else this.lastOrdinarySound = time;
    }
    return cue;
  }
  /** A short visual hop only: loot ownership, pickup positions and saves never move. */
  pose(id: number, time: number, reducedMotion = false) {
    const arrival = this.arrivals.get(id);
    if (!arrival || arrival.at == null) return { height: 0, spin: 0, landed: true };
    const landed = time >= arrival.at;
    if (reducedMotion || !arrival.hop) return { height: 0, spin: 0, landed };
    const t = Math.max(0, Math.min(1, (time - arrival.start!) / (arrival.at - arrival.start!)));
    const bounce = Math.max(0, Math.min(1, (time - arrival.at) / .16));
    const settle = bounce < 1 ? Math.sin(bounce * Math.PI) : 0;
    return { height: landed ? settle * 3 : 18 * (1-t) + Math.sin(t*Math.PI) * 24,
      spin: (id % 2 ? 1 : -1) * (landed ? settle*.07 : Math.sin(t*Math.PI)*.48), landed };
  }
  flare(id: number, time: number): number {
    const at = this.arrivals.get(id)?.at;
    return at != null && time >= at ? Math.max(0, 1 - (time - at) / 1.4) : 0;
  }
}

/** Keep multi-item piles, labels and emitted lights on exactly the same display anchors. */
export function lootPositions(drops: readonly GroundItem[]) {
  const groups = new Map<string, GroundItem[]>();
  for (const drop of drops) {
    const key = `${drop.x}:${drop.y}`;
    const group = groups.get(key) ?? []; group.push(drop); groups.set(key, group);
  }
  return [...groups.values()].flatMap(group => group.sort((a, b) => a.id - b.id).map((drop, i) => ({
    drop, x: drop.x + (i - (group.length - 1) / 2) * 19,
    y: drop.y + (group.length > 1 ? Math.sin(i * 2.4) * 5 : 0),
  })));
}
export function lootBeaconLights(drops: readonly GroundItem[], time: number, listener: { x: number; y: number }, arrivals?: LootDropPresentation) {
  return lootPositions(drops).filter(({ drop, x, y }) => specialLootTier(drop.item.tier)
    && (!arrivals || arrivals.pose(drop.id,time).landed)
    && (!drop.flight || time >= drop.flight.at + drop.flight.delay + TREASURE_FLIGHT_DURATION)
    && Math.hypot(x - listener.x, y - listener.y) < 850)
    .sort((a, b) => Math.hypot(a.x - listener.x, a.y - listener.y) - Math.hypot(b.x - listener.x, b.y - listener.y))
    .slice(0, 3).map(({ drop, x, y }) => {
      const style = LOOT_BEACONS[drop.item.tier as SpecialLootTier];
      return { x, y: y - 4, radius: style.radius, color: style.color, power: style.power };
    });
}
