import type { CharacterSave } from './character-save.ts';
import { WorldLandscape } from './world-landscape.ts';
import { getZoneAt } from './zone-progression.ts';
import { BIOMES } from './biomes.ts';

const locations = new WeakMap<CharacterSave, { name: string; detail: string }>();

/** A read-only geographic query. Dungeon coordinates must never be treated as surface coordinates. */
export function titleLocation(record: CharacterSave): { name: string; detail: string } {
  const cached = locations.get(record); if (cached) return cached;
  const checkpoint = record.checkpoint, expedition = checkpoint.expeditions;
  const run = expedition?.location ? expedition.runs.find(r => r.entrance.id === expedition.location) : undefined;
  if (run) {
    const result = { name: run.entrance.name, detail: `${run.rift ? 'Crimson Rift' : 'Dungeon'} · ${BIOMES[run.entrance.biome].name}` };
    locations.set(record, result); return result;
  }
  const world = new WorldLandscape(record.worldSeed);
  try {
    const { x, y } = checkpoint, biome = world.sampleBiome(x, y);
    const town = world.getSettlements(x, y, .01, .01).find(t => Math.hypot(x - t.x, y - t.y) < t.radius);
    const result = { name: town?.name ?? getZoneAt(x, y, record.worldSeed).districtName,
      detail: `${town ? town.kind[0].toUpperCase() + town.kind.slice(1) : 'Wilderness'} · ${biome.name}` };
    locations.set(record, result); return result;
  } finally { world.dispose(); }
}

export function titlePlayTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return minutes < 1 ? 'Less than 1 min' : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}
