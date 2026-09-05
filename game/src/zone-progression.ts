import { MAX_CONTENT_LEVEL, normalizeLevel, ENEMY_RANKS, monsterDamageScale, monsterExperienceScale, monsterHealthScale, type EnemyRank } from './progression-content.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import type { EnemyKind } from './model.ts';

export const ZONE_RULES = Object.freeze({ bandWidth: 3200, originX: 0, originY: 0 });
export interface ZoneProgression {
  level: number; band: number; distance: number; minDistance: number; maxDistance: number;
}

/** Danger belongs to geography. Biomes, player level, kill count and render chunks do not move it. */
export function getZoneAt(x: number, y: number): ZoneProgression {
  const distance = Number.isFinite(x) && Number.isFinite(y)
    ? Math.min(MAX_CONTENT_LEVEL * ZONE_RULES.bandWidth, Math.hypot(x - ZONE_RULES.originX, y - ZONE_RULES.originY)) : 0;
  const level = normalizeLevel(1 + Math.floor(distance / ZONE_RULES.bandWidth)), band = level - 1;
  return { level, band, distance, minDistance: band * ZONE_RULES.bandWidth, maxDistance: level * ZONE_RULES.bandWidth };
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
