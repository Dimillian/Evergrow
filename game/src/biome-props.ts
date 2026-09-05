import { BIOME_IDS, type BiomeId, type BiomeWeights } from './biomes.ts';

export type PropKind = 'tree' | 'deadTree' | 'rock' | 'shrine' | 'willow' | 'reeds' | 'fern' | 'flowers'
  | 'canopy' | 'snowPine' | 'iceCrystal' | 'charredTree' | 'basalt' | 'emberRock' | 'autumnTree'
  | 'leafPile' | 'windTree' | 'heather' | 'limestone' | 'tussock' | 'mushrooms' | 'stump' | 'lilies';

export interface PropDefinition {
  readonly radius: readonly [number, number];
  readonly scale: readonly [number, number];
  /** Projected crown center above the ground contact, used for site clearance and player occlusion. */
  readonly canopy: Readonly<{ height: number; radius: number; offsetX: number }> | null;
  readonly shadow: readonly [number, number];
  readonly sway: number;
  readonly emissive: Readonly<{ offsetX: number; offsetY: number; radius: number; color: string; power: number }> | null;
}
const definition = (radius: readonly [number, number], canopy: PropDefinition['canopy'] = null,
  shadow: readonly [number, number] = [14, 6], sway = 0, emissive: PropDefinition['emissive'] = null,
  scale: readonly [number, number] = [.82, 1.2]): PropDefinition => Object.freeze({
  radius: Object.freeze(radius), scale: Object.freeze(scale), canopy: canopy ? Object.freeze(canopy) : null,
  shadow: Object.freeze(shadow), sway, emissive: emissive ? Object.freeze(emissive) : null,
});
const crown = (height: number, radius: number, offsetX = 0) => ({ height, radius, offsetX });

/** Collision, silhouette, wind and emitted light all consume this same immutable vocabulary. */
export const PROP_DEFINITIONS: Readonly<Record<PropKind, PropDefinition>> = Object.freeze({
  tree: definition([9, 14], crown(90, 66), [24, 9], .7),
  deadTree: definition([9, 14], crown(79, 55), [18, 7], .25),
  rock: definition([8, 13]),
  shrine: definition([15, 15], null, [15, 9], 0, { offsetX: -18, offsetY: -31, radius: 215, color: '#ffa64f', power: .92 }, [1, 1]),
  canopy: definition([10, 14], crown(100, 80), [28, 10], .65),
  willow: definition([10, 14], crown(99, 80), [27, 10], 1),
  reeds: definition([0, 0], null, [0, 0], 1),
  fern: definition([0, 0], null, [0, 0], .6),
  flowers: definition([0, 0], null, [0, 0], .7),
  snowPine: definition([9, 14], crown(96, 59), [25, 9], .35),
  iceCrystal: definition([7, 12], null, [16, 5], 0, { offsetX: 0, offsetY: -16, radius: 72, color: '#8cd7ec', power: .16 }),
  charredTree: definition([9, 13], crown(70, 55), [18, 7], .18),
  basalt: definition([9, 14], null, [17, 6]),
  emberRock: definition([8, 12], null, [17, 6], 0, { offsetX: 0, offsetY: -6, radius: 90, color: '#ed925d', power: .25 }),
  autumnTree: definition([10, 14], crown(97, 87), [29, 10], .8),
  leafPile: definition([0, 0], null, [0, 0], 0),
  windTree: definition([9, 13], crown(69, 64, 15), [24, 7], 1.1),
  heather: definition([0, 0], null, [0, 0], .85),
  limestone: definition([8, 14], null, [19, 6]),
  tussock: definition([0, 0], null, [0, 0], 1.1),
  mushrooms: definition([0, 0], null, [0, 0], 0, { offsetX: 0, offsetY: -7, radius: 36, color: '#a5cdb6', power: .07 }, [.8, 1.1]),
  stump: definition([7, 11], null, [13, 5], 0, null, [.8, 1.1]),
  lilies: definition([0, 0], null, [0, 0], .1),
});

export const PROP_KINDS = Object.freeze(Object.keys(PROP_DEFINITIONS) as PropKind[]);
export const propDefinition = (kind: PropKind): PropDefinition => PROP_DEFINITIONS[kind];
export interface PropWeight { readonly kind: PropKind; readonly weight: number; }
const table = (...entries: readonly (readonly [PropKind, number])[]): readonly PropWeight[] =>
  Object.freeze(entries.map(([kind, weight]) => Object.freeze({ kind, weight })));

/** Relative local abundance. At an ecotone, both biome identity and species are
 * sampled from the continuous material weights at the prop's actual position. */
export const BIOME_PROP_TABLES: Readonly<Record<BiomeId, readonly PropWeight[]>> = Object.freeze({
  deadwood: table(['deadTree', 48], ['tree', 14], ['rock', 14], ['stump', 10], ['mushrooms', 9], ['tussock', 5]),
  verdant: table(['canopy', 48], ['tree', 6], ['fern', 15], ['flowers', 10], ['mushrooms', 9], ['stump', 6], ['rock', 6]),
  swamp: table(['willow', 35], ['reeds', 22], ['lilies', 17], ['deadTree', 10], ['mushrooms', 7], ['stump', 4], ['rock', 5]),
  frostpine: table(['snowPine', 49], ['iceCrystal', 19], ['rock', 8], ['deadTree', 5], ['tussock', 11], ['stump', 8]),
  emberfall: table(['charredTree', 37], ['basalt', 29], ['emberRock', 19], ['stump', 9], ['tussock', 6]),
  autumn: table(['autumnTree', 45], ['leafPile', 18], ['fern', 8], ['mushrooms', 9], ['stump', 8], ['rock', 6], ['flowers', 6]),
  highlands: table(['windTree', 16], ['heather', 26], ['limestone', 24], ['tussock', 26], ['flowers', 6], ['stump', 2]),
});
const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1 - Number.EPSILON, value)) : 0;

export function chooseBiomeProp(weights: BiomeWeights, biomeRoll: number, kindRoll: number): { biome: BiomeId; kind: PropKind } {
  let roll = unit(biomeRoll), biome: BiomeId = BIOME_IDS[BIOME_IDS.length - 1];
  for (const candidate of BIOME_IDS) {
    if (roll < weights[candidate]) { biome = candidate; break; }
    roll -= weights[candidate];
  }
  const entries = BIOME_PROP_TABLES[biome], total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let choice = unit(kindRoll) * total;
  for (const entry of entries) {
    if (choice < entry.weight) return { biome, kind: entry.kind };
    choice -= entry.weight;
  }
  return { biome, kind: entries[entries.length - 1].kind };
}
