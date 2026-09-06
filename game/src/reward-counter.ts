/** A bounded presentation batch. The simulation's balance is already committed. */
export class RewardCounter {
  value = 0;
  target = 0;
  pulse = 0;
  private quiet = 0;
  private age = 0;
  private draining = false;
  readonly delay: number;
  constructor(delay = .55) { this.delay = delay; }
  get pending() { return Math.max(0, this.target - this.value); }
  reset(value = 0): void { this.value = this.target = value; this.pulse = this.quiet = this.age = 0; this.draining = false; }
  add(amount: number, flight = .8): void {
    if (!(amount > 0) || !Number.isFinite(amount)) return;
    if (this.pending < .01) { this.age = 0; this.draining = false; }
    this.target += amount;
    this.quiet = this.delay + flight;
  }
  shift(amount: number): void { this.value -= amount; this.target -= amount; }
  update(dt: number, reducedMotion: boolean, ceiling = Infinity): void {
    const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
    this.pulse = Math.max(0, this.pulse - step * 3);
    if (reducedMotion) { this.value = this.target; this.quiet = 0; return; }
    const wait = this.draining ? 0 : Math.max(0, Math.min(this.quiet, 2 - this.age));
    this.age += step; this.quiet = Math.max(0, this.quiet - step);
    const travel = Math.max(0, step - wait);
    if (travel > 0 && this.pending > 0) {
      this.draining = true;
      const before = this.value;
      this.value = Math.min(ceiling, this.value + this.pending * (1 - Math.exp(-travel * 7)));
      if (this.pending < .1 || (this.value === before && this.value < ceiling)) { this.value = Math.min(ceiling, this.target); this.pulse = 1; }
    }
  }
}
