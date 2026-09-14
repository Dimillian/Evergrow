export const FRAME_STAGES = ['simulation', 'world', 'sceneSetup', 'scenery', 'actors', 'props', 'structures', 'characters', 'terrain', 'water', 'lighting', 'postfx', 'ui', 'monitor'] as const;
export type FrameStage = typeof FRAME_STAGES[number];
export const FRAME_COUNTERS = ['enemies', 'projectiles', 'groundEffects', 'terrainTiles', 'terrainQueued'] as const;
export type FrameCounters = Record<typeof FRAME_COUNTERS[number], number>;
export const FRAME_METRICS = ['timestamp', 'frameInterval', 'frameCPU', ...FRAME_STAGES, 'other', ...FRAME_COUNTERS] as const;
export type FrameMetric = typeof FRAME_METRICS[number];
export const FRAME_CAPACITY = 600;
export const FRAME_STRIDE = FRAME_METRICS.length;
const index = Object.fromEntries(FRAME_METRICS.map((name, i) => [name, i])) as Record<FrameMetric, number>;
export const frameValue = (samples: Float64Array, frame: number, metric: FrameMetric) => samples[frame * FRAME_STRIDE + index[metric]];

/** Opt-in bounded CPU timings. Nested render stages overlap; only the top-level stages are additive. */
export class FrameProfiler {
  private times = new Float64Array(FRAME_CAPACITY * FRAME_STRIDE);
  private current = new Float64Array(FRAME_STRIDE);
  private count = 0;
  private cursor = 0;
  private previous: number | null = null;
  private started = 0;
  private recording = false;
  private active: boolean;
  private clock: () => number;
  constructor(enabled = false, clock = () => performance.now()) { this.active = enabled; this.clock = clock; }
  get enabled() { return this.active; }
  setEnabled(enabled: boolean) {
    if (enabled === this.active) return;
    this.active = enabled;
    this.reset();
  }
  start() { return this.active ? this.clock() : 0; }
  end(stage: FrameStage, start: number) {
    if (this.active && this.recording) this.current[index[stage]] += Math.max(0, this.clock() - start);
  }
  /** Break the cadence across backgrounding, phase changes and explicit capture boundaries. */
  suspend() { this.previous = null; this.recording = false; }
  begin(now: number) {
    if (!this.active) return;
    this.current.fill(0, 0, index.enemies);
    this.started = this.clock(); this.recording = true;
    this.current[index.timestamp] = now;
    this.current[index.frameInterval] = this.previous === null ? 0 : Math.max(0, now - this.previous);
    this.previous = now;
  }
  setCounters(counters: FrameCounters) {
    if (!this.active) return;
    for (const name of FRAME_COUNTERS) this.current[index[name]] = Math.max(0, counters[name]);
  }
  finish() {
    if (!this.active || !this.recording) return;
    this.current[index.frameCPU] = Math.max(0, this.clock() - this.started);
    this.current[index.other] = Math.max(0, this.current[index.frameCPU] -
      ['simulation', 'world', 'postfx', 'ui', 'monitor'].reduce((sum, name) => sum + this.current[index[name as FrameStage]], 0));
    this.times.set(this.current, this.cursor * FRAME_STRIDE);
    this.count = Math.min(FRAME_CAPACITY, this.count + 1);
    this.cursor = (this.cursor + 1) % FRAME_CAPACITY;
    this.recording = false;
  }
  reset() { this.count = this.cursor = 0; this.suspend(); this.times.fill(0); this.current.fill(0); }
  /** Copy oldest-to-newest into reusable graph storage; no per-frame objects or sorting. */
  copySamples(target: Float64Array) {
    if (target.length < this.count * FRAME_STRIDE) throw new RangeError('Frame sample buffer is too small.');
    const first = (this.cursor - this.count + FRAME_CAPACITY) % FRAME_CAPACITY;
    const tail = Math.min(this.count, FRAME_CAPACITY - first);
    target.set(this.times.subarray(first * FRAME_STRIDE, (first + tail) * FRAME_STRIDE));
    if (tail < this.count) target.set(this.times.subarray(0, (this.count - tail) * FRAME_STRIDE), tail * FRAME_STRIDE);
    return this.count;
  }
  snapshot() {
    const samples = new Float64Array(this.count * FRAME_STRIDE);
    this.copySamples(samples);
    const metrics: Record<string, { p50: number; p95: number; p99: number; max: number }> = {};
    for (const name of FRAME_METRICS) {
      if (name === 'timestamp') continue;
      const values = Array.from({ length: this.count }, (_, i) => frameValue(samples, i, name));
      // Zero marks the first frame of a continuous segment, not an instantaneous frame.
      const sorted = (name === 'frameInterval' ? values.filter(value => value > 0) : values).sort((a, b) => a - b);
      const at = (p: number) => Math.round((sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0) * 1000) / 1000;
      metrics[name] = { p50: at(.5), p95: at(.95), p99: at(.99), max: at(1) };
    }
    const timeline = Array.from({ length: this.count }, (_, i) => Object.fromEntries(FRAME_METRICS.map(name => [name, frameValue(samples, i, name)])));
    return { enabled: this.active, frames: this.count, units: 'milliseconds', counterUnits: 'count', metrics, timeline,
      slowFrames: [...timeline].sort((a, b) => b.frameCPU - a.frameCPU).slice(0, 10) };
  }
}
