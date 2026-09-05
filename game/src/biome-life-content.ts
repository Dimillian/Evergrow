import { BIOME_IDS, type BiomeId, type BiomeWeights } from './biomes.ts';
import type { PropKind } from './biome-props.ts';

export type ParticleKind = 'leaf' | 'dust' | 'snow' | 'ash' | 'seed' | 'droplet' | 'ember';
export type BirdKind = 'crow' | 'jay' | 'snowfinch' | 'wader' | 'moorbird';
export type InsectKind = 'butterfly' | 'moth' | 'dragonfly';
interface LifeProfile {
  readonly wind: number;
  readonly debris: ParticleKind;
  readonly colors: readonly string[];
  readonly grass: readonly [string, string];
  readonly grassHeight: number;
  readonly footColor: string;
  readonly light: string;
  readonly dapple: number;
  readonly emitters: readonly PropKind[];
  readonly ground: readonly PropKind[];
  readonly bird: BirdKind | null;
  readonly perches: readonly PropKind[];
  readonly insect: InsectKind | null;
  readonly insectColor: string;
  readonly insectAnchors: readonly PropKind[];
}
export const BIOME_LIFE: Readonly<Record<BiomeId, LifeProfile>> = {
  deadwood: { wind: .8, debris: 'dust', colors: ['#9a9078', '#777f79', '#a9a593'], grass: ['#53645a', '#929782'], grassHeight: .65,
    footColor: '#142727', light: '#a9c3c7', dapple: .12, emitters: ['deadTree', 'tussock', 'stump'], ground: ['deadTree', 'tussock', 'stump', 'mushrooms'],
    bird: 'crow', perches: ['stump', 'rock', 'deadTree'], insect: 'moth', insectColor: '#bcbda9', insectAnchors: ['mushrooms', 'stump'] },
  verdant: { wind: 1, debris: 'leaf', colors: ['#aa9b58', '#7e9952', '#bbaf6a', '#688447'], grass: ['#577849', '#769354'], grassHeight: 1,
    footColor: '#0b1b14', light: '#dece87', dapple: 1, emitters: ['tree', 'canopy'], ground: ['tree', 'canopy', 'fern', 'flowers', 'stump'],
    bird: 'crow', perches: ['stump', 'rock', 'deadTree'], insect: 'butterfly', insectColor: '#d6c586', insectAnchors: ['flowers', 'fern'] },
  swamp: { wind: .72, debris: 'leaf', colors: ['#698d74', '#839c79', '#9eae83'], grass: ['#496e64', '#8aaf93'], grassHeight: 1.3,
    footColor: '#123036', light: '#b1d3b0', dapple: .35, emitters: ['willow', 'reeds'], ground: ['willow', 'reeds', 'fern'],
    bird: 'wader', perches: ['rock', 'stump', 'lilies'], insect: 'dragonfly', insectColor: '#a2d7d1', insectAnchors: ['lilies', 'reeds'] },
  frostpine: { wind: .9, debris: 'snow', colors: ['#dce7e7', '#accedb', '#f2eee0'], grass: ['#819fa6', '#c4d3d0'], grassHeight: .4,
    footColor: '#384f64', light: '#bfd9eb', dapple: .52, emitters: ['snowPine', 'iceCrystal'], ground: ['snowPine', 'iceCrystal', 'tussock'],
    bird: 'snowfinch', perches: ['rock', 'iceCrystal', 'stump'], insect: null, insectColor: '#d1dde0', insectAnchors: [] },
  emberfall: { wind: 1.12, debris: 'ash', colors: ['#a6968a', '#7f7774', '#bcaa94'], grass: ['#66564f', '#96806b'], grassHeight: 0,
    footColor: '#272429', light: '#e4a56e', dapple: 0, emitters: ['charredTree', 'basalt', 'emberRock'], ground: ['charredTree', 'basalt', 'emberRock'],
    bird: null, perches: [], insect: 'moth', insectColor: '#b09d8d', insectAnchors: ['charredTree', 'stump'] },
  autumn: { wind: 1.1, debris: 'leaf', colors: ['#d6aa53', '#b8753e', '#dfbf68', '#9d5738'], grass: ['#827846', '#bea764'], grassHeight: .8,
    footColor: '#3e3021', light: '#ecc079', dapple: .85, emitters: ['autumnTree', 'leafPile'], ground: ['autumnTree', 'leafPile', 'flowers', 'stump'],
    bird: 'jay', perches: ['stump', 'rock', 'deadTree'], insect: 'butterfly', insectColor: '#e5b65f', insectAnchors: ['flowers', 'leafPile'] },
  highlands: { wind: 1.55, debris: 'seed', colors: ['#c7bc9b', '#b0a7c0', '#e1d7b6'], grass: ['#65715a', '#a8ad85'], grassHeight: 1.15,
    footColor: '#32353c', light: '#c9c2d7', dapple: .3, emitters: ['windTree', 'heather', 'tussock'], ground: ['windTree', 'heather', 'tussock', 'limestone'],
    bird: 'moorbird', perches: ['limestone', 'rock', 'windTree'], insect: 'moth', insectColor: '#b8adc9', insectAnchors: ['heather'] },
};
for (const profile of Object.values(BIOME_LIFE)) {
  for (const value of Object.values(profile)) if (Array.isArray(value)) Object.freeze(value);
  Object.freeze(profile);
}
Object.freeze(BIOME_LIFE);

/** Choose individual pieces of debris from the same blended field as terrain. */
export function biomeForDebris(weights: BiomeWeights, random: number): BiomeId {
  let cumulative = 0;
  for (const id of BIOME_IDS) { cumulative += weights[id]; if (random < cumulative) return id; }
  return 'highlands';
}
