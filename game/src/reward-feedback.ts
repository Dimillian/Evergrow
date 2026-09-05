import type { CombatEvent } from './model.ts';
export interface RewardMote { x: number; y: number; age: number; kind: 'gold' | 'experience'; phase: number; }
export interface RewardBurst { amount: number; remaining: number; pulse: number; }
const burst = (): RewardBurst => ({ amount: 0, remaining: 0, pulse: 0 });
/** Bounded, disposable presentation. Currency and XP have already been awarded by simulation. */
export class RewardFeedback {
  readonly motes: RewardMote[] = [];
  readonly gold = burst();
  readonly experience = burst();
  balance = 0;
  private initialized = false;
  reset(): void {
    this.motes.length = 0; Object.assign(this.gold, burst()); Object.assign(this.experience, burst());
    this.balance = 0; this.initialized = false;
  }
  handleEvents(events: readonly CombatEvent[], reducedMotion: boolean): void {
    for (const event of events) {
      if (event.type !== 'gold' && event.type !== 'experience') continue;
      const gain = this[event.type];
      if (gain.remaining <= 0) gain.amount = 0;
      gain.amount += event.amount; gain.remaining = 2; gain.pulse = 1;
      if (event.type === 'gold' && !this.initialized) {
        this.balance = event.balance - event.amount; this.initialized = true;
      }
      if (reducedMotion) continue;
      for (let i = 0; i < 3; i++) {
        if (this.motes.length >= 96) this.motes.shift();
        this.motes.push({ x: event.x, y: event.y - 7, age: -i * .065, kind: event.type, phase: i * 2.1 });
      }
    }
  }
  update(balance: number, dt: number, reducedMotion: boolean): void {
    const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
    if (!this.initialized || reducedMotion || balance < this.balance) this.balance = balance;
    this.initialized = true;
    this.balance += (balance - this.balance) * (1 - Math.exp(-step * 11));
    if (Math.abs(this.balance - balance) < .1) this.balance = balance;
    for (const gain of [this.gold, this.experience]) {
      gain.remaining = Math.max(0, gain.remaining - step);
      gain.pulse = Math.max(0, gain.pulse - step * 4);
    }
    for (const mote of this.motes) mote.age += step;
    for (let i = this.motes.length - 1; i >= 0; i--) if (reducedMotion || this.motes[i].age >= .8) this.motes.splice(i, 1);
  }
}
