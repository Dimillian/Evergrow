import type { GroundItem, ItemTier } from './character-types.ts';
import type { CombatEvent } from './model.ts';
import { TREASURE_FLIGHT_DURATION } from './treasure-flight.ts';

export type SpecialLootTier = 'legendary' | 'unique';
export const LOOT_BEACONS = {
  legendary: { color: '#ffb45f', core: '#fff0c0', accent: '#ef792e', height: 108, radius: 98, power: .48 },
  unique: { color: '#ef78b2', core: '#ffe4f5', accent: '#ac77f4', height: 132, radius: 112, power: .56 },
} as const;
export function specialLootTier(tier: ItemTier): tier is SpecialLootTier { return tier === 'legendary' || tier === 'unique'; }
export function lootDropEvent(drop: GroundItem): Extract<CombatEvent, { type: 'item-drop' }> | null {
  if (!specialLootTier(drop.item.tier)) return null;
  return { type: 'item-drop', x: drop.x, y: drop.y, dropId: drop.id, tier: drop.item.tier,
    landAt: drop.flight ? drop.flight.at + drop.flight.delay + TREASURE_FLIGHT_DURATION : null };
}

/** Transient reward presentation: never inferred from a loaded save or a manually discarded item. */
export class LootDropPresentation {
  private arrivals = new Map<number, { at: number | null; tier: SpecialLootTier; sounded: boolean }>();
  private lastSound = -Infinity;
  private lastTier: SpecialLootTier | null = null;
  reset() { this.arrivals.clear(); this.lastSound = -Infinity; this.lastTier = null; }
  handle(events: readonly CombatEvent[]) {
    for (const event of events) if (event.type === 'item-drop') {
      if (this.arrivals.size >= 64) this.arrivals.delete(this.arrivals.keys().next().value!);
      this.arrivals.set(event.dropId, { at: event.landAt, tier: event.tier, sounded: false });
    }
  }
  advance(drops: readonly GroundItem[], time: number, listener: { x: number; y: number }): SpecialLootTier | null {
    if (!this.arrivals.size) return null;
    const present = new Map(drops.map(drop => [drop.id, drop]));
    let cue: SpecialLootTier | null = null;
    for (const [id, arrival] of this.arrivals) {
      arrival.at ??= time;
      const drop = present.get(id);
      if (!drop || time - arrival.at > 1.4) { this.arrivals.delete(id); continue; }
      if (time < arrival.at || arrival.sounded) continue;
      // Coalesce treasure showers; discard suppressed cues rather than building an audio backlog.
      arrival.sounded = true;
      if ((time - this.lastSound >= .65 || arrival.tier === 'unique' && this.lastTier === 'legendary') && Math.hypot(drop.x - listener.x, drop.y - listener.y) < 850)
        if (cue !== 'unique') cue = arrival.tier;
    }
    if (cue) { this.lastSound = time; this.lastTier = cue; }
    return cue;
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
export function lootBeaconLights(drops: readonly GroundItem[], time: number, listener: { x: number; y: number }) {
  return lootPositions(drops).filter(({ drop, x, y }) => specialLootTier(drop.item.tier)
    && (!drop.flight || time >= drop.flight.at + drop.flight.delay + TREASURE_FLIGHT_DURATION)
    && Math.hypot(x - listener.x, y - listener.y) < 850)
    .sort((a, b) => Math.hypot(a.x - listener.x, a.y - listener.y) - Math.hypot(b.x - listener.x, b.y - listener.y))
    .slice(0, 3).map(({ drop, x, y }) => {
      const style = LOOT_BEACONS[drop.item.tier as SpecialLootTier];
      return { x, y: y - 4, radius: style.radius, color: style.color, power: style.power };
    });
}
