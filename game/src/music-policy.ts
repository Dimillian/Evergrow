import type { BiomeId } from './biomes.ts';
import type { GamePhase } from './game-phase.ts';

export type MusicMood = 'home' | 'dark' | 'verdant' | 'arid' | 'cold' | 'ember' | 'town' | 'dungeon' | 'event' | 'boss';
export interface MusicScene {
  phase: GamePhase;
  biome: BiomeId;
  dungeon: boolean;
  town: boolean;
  encounter: 'none' | 'event' | 'boss';
}
export interface MusicIntent { mood: MusicMood; duck: number; }
const REGIONS: Record<BiomeId, MusicMood> = {
  deadwood: 'dark', swamp: 'dark', verdant: 'verdant', autumn: 'verdant',
  sunscar: 'arid', steppe: 'arid', frostpine: 'cold', highlands: 'cold', emberfall: 'ember',
};
const isBattle = (mood: MusicMood) => mood === 'boss' || mood === 'event';

/** Presentation clock only. Geographic hysteresis and encounter release prevent musical chatter. */
export class MusicPolicy {
  private mood: MusicMood = 'home';
  private candidate: MusicMood = 'home';
  private candidateAt = 0;
  private lastBattleAt = -Infinity;
  update(now: number, scene: MusicScene): MusicIntent {
    // Inventory/map/pause retain their place and encounter instead of selecting a menu song.
    if (scene.phase !== 'ready' && scene.phase !== 'playing' && scene.phase !== 'dead')
      return { mood: this.mood, duck: .6 };
    let desired: MusicMood = scene.phase === 'ready' ? 'home'
      : scene.dungeon ? 'dungeon' : scene.town ? 'town' : REGIONS[scene.biome];
    if (scene.phase === 'playing' && !scene.town && scene.encounter !== 'none') {
      desired = scene.encounter;
      if (desired === this.mood) this.lastBattleAt = now;
    }
    if (scene.phase === 'dead') {
      this.mood = desired; this.candidate = desired;
      return { mood: desired, duck: .25 };
    }
    if (scene.phase === 'ready') {
      this.mood = this.candidate = 'home'; this.lastBattleAt = -Infinity;
    } else {
      if (desired !== this.candidate) { this.candidate = desired; this.candidateAt = now; }
      const leavingBattle = isBattle(this.mood) && !isBattle(desired);
      const delay = desired === 'boss' ? 0 : desired === 'event' ? 1
        : desired === 'dungeon' || desired === 'town' || this.mood === 'home' ? 3 : 15;
      // Sanctuary/realm transitions override a battle's lingering release.
      const release = !leavingBattle || scene.town || scene.dungeon && this.mood !== 'boss' || now - this.lastBattleAt >= 12;
      // A boss cue survives short gaps between phases or minion waves.
      const bossHold = this.mood === 'boss' && desired === 'event' && now - this.lastBattleAt < 12;
      if (desired !== this.mood && now - this.candidateAt >= delay && release && !bossHold) {
        this.mood = desired;
        if (isBattle(desired)) this.lastBattleAt = now;
      }
    }
    return { mood: this.mood, duck: 1 };
  }
}

export function nextMusicTrack(pool: readonly string[], previous: string | undefined, random: number): string | undefined {
  const choices = pool.length > 1 ? pool.filter(id => id !== previous) : pool;
  return choices[Math.min(choices.length - 1, Math.floor(Math.max(0, Math.min(.999999, random)) * choices.length))];
}
