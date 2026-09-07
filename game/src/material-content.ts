/** Shared immutable visual/acoustic materials. These recipes never modify gameplay damage. */
export type MaterialId = 'wood' | 'stone' | 'metal' | 'ice' | 'bone' | 'glass' | 'ember';
export interface MaterialRecipe {
  readonly shape: 'sliver' | 'chip' | 'spark' | 'shard' | 'bone' | 'ember';
  readonly colors: readonly string[]; readonly edge: string; readonly dust: string;
  readonly spread: number; readonly lift: number; readonly flight: number; readonly bounce: number;
  readonly length: number; readonly thickness: number; readonly duration: number; readonly glow: number;
  readonly sound: Readonly<{ crack: number; body: number; duration: number; gain: number }>;
}
function material(value: MaterialRecipe): Readonly<MaterialRecipe> {
  return Object.freeze({ ...value, colors: Object.freeze([...value.colors]), sound: Object.freeze({ ...value.sound }) });
}
export const MATERIALS: Readonly<Record<MaterialId, Readonly<MaterialRecipe>>> = Object.freeze({
  wood: material({ shape: 'sliver', colors: ['#76603c','#ab8b52','#574731','#c3a66b'], edge: '#d2b580', dust: '#baaa87', spread: 42, lift: 28, flight: .55, bounce: 3, length: 13, thickness: 3, duration: 6.5, glow: 0, sound: { crack: 2900, body: 560, duration: .18, gain: .3 } }),
  stone: material({ shape: 'chip', colors: ['#68767a','#9baba8','#475557'], edge: '#c1c9b7', dust: '#b0b6a5', spread: 25, lift: 13, flight: .32, bounce: 2, length: 6, thickness: 5, duration: 5.5, glow: 0, sound: { crack: 1850, body: 250, duration: .13, gain: .29 } }),
  metal: material({ shape: 'spark', colors: ['#fff1c4','#edc675','#a3c6c6'], edge: '#fff9de', dust: '#788689', spread: 55, lift: 20, flight: .46, bounce: 7, length: 8, thickness: 1.2, duration: .8, glow: .65, sound: { crack: 4400, body: 950, duration: .09, gain: .19 } }),
  ice: material({ shape: 'shard', colors: ['#9ce0ed','#4f99ae','#d5f4ee'], edge: '#e5ffff', dust: '#a6dfe6', spread: 39, lift: 30, flight: .58, bounce: 4, length: 12, thickness: 5, duration: 2.7, glow: .28, sound: { crack: 5800, body: 1300, duration: .12, gain: .22 } }),
  bone: material({ shape: 'bone', colors: ['#c7bb92','#827557','#e1d5b0'], edge: '#f1e3b9', dust: '#bbad88', spread: 30, lift: 19, flight: .43, bounce: 4, length: 8, thickness: 3, duration: 5, glow: 0, sound: { crack: 1900, body: 450, duration: .10, gain: .2 } }),
  glass: material({ shape: 'shard', colors: ['#92b0da','#ba9ddd','#c9eae5'], edge: '#e3f4ff', dust: '#a2b5d2', spread: 48, lift: 32, flight: .65, bounce: 5, length: 10, thickness: 4, duration: 2.2, glow: .38, sound: { crack: 6800, body: 1700, duration: .16, gain: .16 } }),
  ember: material({ shape: 'ember', colors: ['#ed994c','#b95432','#ffe0a0'], edge: '#ffe9b0', dust: '#68564d', spread: 32, lift: 44, flight: 1.1, bounce: 0, length: 4, thickness: 2, duration: 2.3, glow: .8, sound: { crack: 2600, body: 240, duration: .22, gain: .13 } }),
});
