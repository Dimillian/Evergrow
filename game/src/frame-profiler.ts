export const FRAME_STAGES = ['simulation', 'world', 'terrain', 'water', 'lighting', 'postfx', 'ui'] as const;
export type FrameStage = typeof FRAME_STAGES[number];
const CAPACITY = 600;
/** Opt-in bounded CPU timings; cadence includes browser/GPU scheduling, stage times do not. */
export class FrameProfiler {
  private times = new Float64Array(CAPACITY * (FRAME_STAGES.length + 2));
  private current = new Float64Array(FRAME_STAGES.length);
  private count = 0;
  private cursor = 0;
  private previous = 0;
  private started = 0;
  private interval = 0;
  readonly enabled: boolean;
  private clock: () => number;
  constructor(enabled = false, clock = () => performance.now()) { this.enabled = enabled; this.clock = clock; }
  start() { return this.enabled ? this.clock() : 0; }
  end(stage: FrameStage, start: number) { if (this.enabled) this.current[FRAME_STAGES.indexOf(stage)] += Math.max(0, this.clock() - start); }
  begin(now: number) {
    if (!this.enabled) return;
    this.current.fill(0); this.started = this.clock();
    this.interval = this.previous ? Math.max(0, now - this.previous) : 0; this.previous = now;
  }
  finish() {
    if (!this.enabled) return;
    const stride = FRAME_STAGES.length + 2, offset = this.cursor * stride;
    this.times[offset] = this.interval; this.times[offset + 1] = this.clock() - this.started;
    this.times.set(this.current, offset + 2); this.count = Math.min(CAPACITY, this.count + 1); this.cursor = (this.cursor + 1) % CAPACITY;
  }
  reset() { this.count = this.cursor = this.previous = 0; this.times.fill(0); this.current.fill(0); }
  snapshot() {
    const names = ['frameInterval', 'frameCPU', ...FRAME_STAGES], stride = names.length;
    const metrics: Record<string, { p50: number; p95: number; p99: number; max: number }> = {};
    const frames: Record<string, number>[] = [];
    for (let i = 0; i < this.count; i++) frames.push(Object.fromEntries(names.map((name, j) => [name, this.times[i * stride + j]])));
    for (const name of names) {
      const sorted = frames.map(f => f[name]).sort((a, b) => a - b);
      const at = (p: number) => Math.round((sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0) * 1000) / 1000;
      metrics[name] = { p50: at(.5), p95: at(.95), p99: at(.99), max: at(1) };
    }
    return { enabled: this.enabled, frames: this.count, units: 'milliseconds', metrics,
      slowFrames: frames.sort((a, b) => b.frameCPU - a.frameCPU).slice(0, 10) };
  }
}
