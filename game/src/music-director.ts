import type { GamePhase } from './game-phase.ts';

export type MusicLocation = 'town' | 'field' | 'crypt';
export type MusicCue = MusicLocation | 'encounter';
export interface MusicSituation {
  phase: GamePhase;
  location: MusicLocation;
  engaged: boolean;
}
export interface MusicSelection { cue: MusicCue | null; level: number; fade: number; }

/** Presentation-only policy: never changes actors, encounters, time or saves. */
export class MusicDirector {
  private location: MusicLocation = 'town';
  private fieldDelay = 0;
  private combatHold = 0;

  update(state: MusicSituation, dt: number): MusicSelection {
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, .25)) : 0;
    if (state.phase === 'ready') {
      this.reset();
      return { cue: 'town', level: 1, fade: 3 };
    }
    if (state.phase === 'dead') {
      this.reset();
      return { cue: null, level: 0, fade: 2 };
    }
    if (state.location !== this.location) {
      // Sanctuary arrival and crypt transitions are immediate. Leaving town has
      // a little grace so walking along its boundary doesn't alternate songs.
      if (this.location === 'town' && state.location === 'field') {
        if (state.phase === 'playing') this.fieldDelay += dt;
        if (state.engaged || this.fieldDelay >= 1.25) this.setLocation(state.location);
      } else this.setLocation(state.location);
    } else this.fieldDelay = 0;
    if (this.location === 'town') this.combatHold = 0;
    else if (state.phase === 'playing') {
      if (state.engaged) this.combatHold = 6;
      else this.combatHold = Math.max(0, this.combatHold - dt);
    }
    const cue = this.combatHold > 0 ? 'encounter' : this.location;
    return { cue, level: state.phase === 'playing' ? 1 : .4, fade: cue === 'encounter' ? 1.2 : 3 };
  }

  reset(): void { this.location = 'town'; this.fieldDelay = 0; this.combatHold = 0; }
  private setLocation(location: MusicLocation): void {
    this.location = location; this.fieldDelay = 0; this.combatHold = 0;
  }
}
