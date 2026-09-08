import type { MusicMood } from './music-policy.ts';
export const MUSIC_POOLS: Readonly<Record<MusicMood, readonly string[]>> = {
  home: ['menu', 'menu-long'], dark: ['dark-forest', 'dark-forest-long'],
  verdant: ['verdant-forest', 'verdant-forest-long'], arid: ['wilderness', 'wilderness-long'],
  cold: ['cold-wilds', 'cold-wilds-2'], ember: ['ember-wilds', 'ember-wilds-2'],
  town: ['town', 'menu-long'], dungeon: ['dungeon', 'dungeon-long'],
  event: ['event'], boss: ['boss'],
};
export const MUSIC_RULES = Object.freeze({ crossfade: 8, battleFade: 3, gapMin: 15, gapMax: 30, loadTimeout: 20 });

export function musicGap(mood: MusicMood, random: number): number {
  if (mood === 'boss' || mood === 'event') return 0;
  if (mood === 'home' || mood === 'town' || mood === 'dungeon') return 3 + random * 4;
  return MUSIC_RULES.gapMin + random * (MUSIC_RULES.gapMax - MUSIC_RULES.gapMin);
}
