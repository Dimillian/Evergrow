import { geoHash } from './world-geography.ts';
import { routeDangerDistance } from './road-shape.ts';
import { sampleBiome } from './biomes.ts';
import { normalizeLevel, ENEMY_RANKS, monsterDamageScale, monsterExperienceScale, monsterHealthScale, type EnemyRank } from './progression-content.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import type { EnemyKind } from './model.ts';
export const ZONE_RULES = Object.freeze({ regionSize: 3600, travelPerLevel: 6000 });
export interface ZoneProgression {
  id: string;
  name: string;
  level: number;
  x: number;
  y: number;
  hazardous: boolean;
  travel: number;
}
const zones = new Map<string, ZoneProgression>();
function warp(x: number, y: number, seed: number): [
  number,
  number
] {
  const phase = seed % 997 / 997 * Math.PI * 2;
  return [x + Math.sin(y / 2100 + phase) * 560 + Math.sin((x + y) / 970) * 170,
    y + Math.sin(x / 2400 - phase) * 620 + Math.cos((y - x) / 1230) * 190];
}
function center(cx: number, cy: number, seed: number): [
  number,
  number
] {
  if (!cx && !cy)
    return [0, 0];
  return [(cx + (geoHash(cx, cy, seed + 41) / 4294967296 - .5) * .6) * ZONE_RULES.regionSize,
    (cy + (geoHash(cx, cy, seed + 59) / 4294967296 - .5) * .6) * ZONE_RULES.regionSize];
}
/** Fixed, warped geographic districts. Road travel establishes progression; remote pockets add risk. */
export function getZoneAt(x: number, y: number, seed = 7319): ZoneProgression {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    x = 0;
    y = 0;
  }
  x = Math.max(-40000000, Math.min(40000000, x));
  y = Math.max(-40000000, Math.min(40000000, y));
  const [wx, wy] = warp(x, y, seed), gx = Math.round(wx / ZONE_RULES.regionSize), gy = Math.round(wy / ZONE_RULES.regionSize);
  let nearest = Infinity, cx = 0, cy = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const p = center(gx + dx, gy + dy, seed), distance = (p[0] - wx) ** 2 + (p[1] - wy) ** 2;
      if (distance < nearest) {
        nearest = distance;
        cx = gx + dx;
        cy = gy + dy;
      }
    }
  const id = `${seed}:${cx}:${cy}`, cached = zones.get(id);
  if (cached)
    return cached;
  const p = center(cx, cy, seed);
  let px = p[0], py = p[1];
  for (let i = 0; i < 8; i++) {
    const w = warp(px, py, seed);
    px += (p[0] - w[0]) * .7;
    py += (p[1] - w[1]) * .7;
  }
  const route = routeDangerDistance(px, py, seed), hash = geoHash(cx, cy, seed + 831);
  const starting = !cx && !cy;
  const hazardous = !starting && route.remoteness > 2500 && hash % 7 < 2;
  const level = starting ? 1 : normalizeLevel(1 + Math.floor((route.travel + route.remoteness * 1.1) / ZONE_RULES.travelPerLevel) + (hazardous ? 3 + hash % 3 : 0));
  const biome = sampleBiome(px, py, seed).name;
  const name = starting ? 'Briar March' : `${['Raven', 'Ashen', 'Silver', 'Thorn', 'Gloam', 'Elder', 'Moon', 'Wandering', 'Sable', 'Hollow', 'Bramble', 'Whispering', 'Iron', 'Copper', 'Wren', 'Dusk', 'Windswept', 'Shrouded', 'Silent', 'Lost', 'Pale', 'Gilded', 'Cinder', 'Fallow'][hash % 24]} ${hazardous ? ['Wilds', 'Deeps', 'Banes', 'Wastes'][hash >>> 8 & 3] : ['March', 'Vale', 'Reach', 'Expanse', 'Glen', 'Basin'][Math.floor(hash / 13) % 6]}`;
  const zone = Object.freeze({ id, name: `${name} · ${biome}`, level, x: px, y: py, hazardous, travel: route.travel });
  if (zones.size >= 2048)
    zones.delete(zones.keys().next().value!);
  zones.set(id, zone);
  return zone;
}
export function scaledEnemyStats(kind: EnemyKind, level: number, rank: EnemyRank) {
  const base = ENEMY_DEFINITIONS[kind], quality = ENEMY_RANKS[rank];
  return {
    maxHp: Math.max(1, Math.round(base.hp * monsterHealthScale(level) * quality.healthMultiplier)),
    damage: Math.max(1, Math.round(base.damage * monsterDamageScale(level) * quality.damageMultiplier)),
    xpReward: Math.max(1, Math.round(base.xpReward * monsterExperienceScale(level) * quality.xpMultiplier)),
  };
}
/** Stable source identity, isolated from crits, attacks, pickup IDs and the eventual death location. */
export function enemyLootSeed(worldSeed: number, spawnOrdinal: number, x: number, y: number): number {
  let value = (worldSeed ^ Math.imul(spawnOrdinal, 0x9e3779b1) ^ Math.imul(Math.floor(x), 0x45d9f3b)
    ^ Math.imul(Math.floor(y), 0x27d4eb2d)) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x7feb352d);
  value = Math.imul(value ^ value >>> 15, 0x846ca68b);
  return (value ^ value >>> 16) >>> 0;
}
