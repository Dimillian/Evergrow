import type { JourneyCompletion } from './journey-rewards.ts';
import type { CombatEvent } from './model.ts';
import { RewardCounter } from './reward-counter.ts';
export const REWARD_FLIGHT_SECONDS = .8;
export interface RewardMote { x: number; y: number; age: number; kind: 'gold' | 'experience'; phase: number; screen?: { x: number; y: number }; }
export interface JourneyCelebration extends JourneyCompletion { age: number; }
export interface LevelCelebration { age: number; level: number; skillPoints: number; statPoints: number; }
/** Bounded, disposable presentation. Currency and XP have already been awarded by simulation. */
export class RewardFeedback {
  readonly motes: RewardMote[] = [];
  readonly gold = new RewardCounter(.5);
  level: LevelCelebration | null = null;
  journey: JourneyCelebration | null = null;
  private journeys: JourneyCompletion[] = [];
  xpPulse = 0;
  private initialized = false;
  get balance() { return this.gold.value; }
  reset(): void { this.motes.length = 0; this.gold.reset(); this.initialized = false; this.level = null; this.journey=null; this.journeys=[]; this.xpPulse = 0; }
  handleEvents(events: readonly CombatEvent[], reducedMotion: boolean): void {
    for (const event of events) {
      if(event.type==='journey'&&this.journey?.id!==event.id&&!this.journeys.some(j=>j.id===event.id)){
        this.journeys.push({id:event.id,name:event.name,xp:event.xp});if(this.journeys.length>8)this.journeys.shift();
      }
      if (event.type === 'level') {
        const previous = this.level && this.level.age < 1.2 ? this.level : null;
        this.level = { age: 0, level: event.level, skillPoints: event.skillPoints + (previous?.skillPoints ?? 0), statPoints: event.statPoints + (previous?.statPoints ?? 0) };
      }
      if (event.type !== 'gold' && event.type !== 'experience') continue;
      if (event.type === 'gold') {
        if (!this.initialized) { this.gold.reset(event.balance - event.amount); this.initialized = true; }
        this.gold.add(event.amount, reducedMotion ? 0 : REWARD_FLIGHT_SECONDS);
      }
      if (reducedMotion) continue;
      // At most four bundles of each kind per frame; their numerical value is never dropped.
      if (this.motes.filter(m => m.kind === event.type && m.age <= 0).length >= 12) continue;
      for (let i = 0; i < 3; i++) {
        if (this.motes.length >= 72) this.motes.shift();
        this.motes.push({ x: event.x, y: event.y - 12, age: -i * .045, kind: event.type, phase: i * 2.1 + this.motes.length });
      }
    }
  }
  update(balance: number, dt: number, reducedMotion: boolean): void {
    const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
    // Purchases, vendor income and restored saves reconcile immediately, without replaying pickups.
    if (!this.initialized || balance !== this.gold.target) this.gold.reset(balance);
    this.initialized = true;
    this.gold.update(step, reducedMotion);
    this.xpPulse = Math.max(0, this.xpPulse - step * 3);
    if (this.level) { this.level.age += step; if (this.level.age >= 2.4) this.level = null; }
    if(!this.level){
      if(this.journey){this.journey.age+=step;if(this.journey.age>=3)this.journey=null;}
      if(!this.journey&&this.journeys.length)this.journey={...this.journeys.shift()!,age:0};
    }
    for (const mote of this.motes) {
      const before = mote.age; mote.age += step;
      if (before < REWARD_FLIGHT_SECONDS && mote.age >= REWARD_FLIGHT_SECONDS) {
        if (mote.kind === 'gold') this.gold.pulse = 1; else this.xpPulse = 1;
      }
    }
    for (let i = this.motes.length - 1; i >= 0; i--) if (reducedMotion || this.motes[i].age >= REWARD_FLIGHT_SECONDS + .12) this.motes.splice(i, 1);
  }
}
