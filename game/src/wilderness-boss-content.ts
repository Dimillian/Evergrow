import type { EnemyKind } from './model.ts';
import type { BiomeId } from './biomes.ts';

export const WILDERNESS_BOSSES = ['briarMatriarch', 'ashColossus', 'graveMarshal'] as const;
export type WildernessBossKind = typeof WILDERNESS_BOSSES[number];
export function isWildernessBoss(kind: string): kind is WildernessBossKind {
  return (WILDERNESS_BOSSES as readonly string[]).includes(kind);
}
export const isBossKind = (kind: EnemyKind): boolean => kind === 'warden' || isWildernessBoss(kind);
export const LAIR_RULES = Object.freeze({ radius: 370, leash: 670, awareness: 430, minimumLevel: 3,
  sweepReach: 150, sweepArc: Math.PI * 1.2, rushLength: 330, rushWidth: 32,
  fractureLength: 410, fractureWidth: 24, eruptionRadius: 105, rallyRadius: 480, rallyDuration: 6 });
export const BOSS_PALETTES = Object.freeze({ briarMatriarch: '#91c67f', ashColossus: '#ffac61', graveMarshal: '#b4a3eb' });
export const BOSS_NAMES = Object.freeze({ briarMatriarch: 'Briar Matriarch', ashColossus: 'Ashbound Colossus', graveMarshal: 'Grave Marshal' });
export function bossForBiome(biome: BiomeId): WildernessBossKind {
  return biome === 'emberfall' || biome === 'sunscar' || biome === 'highlands' ? 'ashColossus'
    : biome === 'deadwood' || biome === 'frostpine' ? 'graveMarshal' : 'briarMatriarch';
}
