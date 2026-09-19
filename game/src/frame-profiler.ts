export const FRAME_STAGES = ['simulation', 'world', 'sceneSetup', 'scenery', 'actors', 'props', 'structures', 'characters', 'terrain', 'water', 'lighting', 'postfx', 'ui', 'panels', 'monitor'] as const;
export type FrameStage = typeof FRAME_STAGES[number];
export const FRAME_COUNTERS = ['enemies', 'projectiles', 'groundEffects', 'terrainTiles', 'terrainQueued'] as const;
export type FrameCounters = Record<typeof FRAME_COUNTERS[number], number>;
export const FRAME_METRICS = ['timestamp', 'frameInterval', 'frameCPU', ...FRAME_STAGES, 'other', ...FRAME_COUNTERS] as const;
export type FrameMetric = typeof FRAME_METRICS[number];
export const FRAME_CAPACITY = 600;
export const FRAME_HISTORY_CAPACITY = 1800;
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
  private pendingPanels = 0;
  private externalCPU = 0;
  private phase = 'unknown';
  private phases = new Array<string>(FRAME_CAPACITY);
  private history: Array<{ phase: string; start: number; end: number; frames: number; intervals: number;
    elapsed: number; cpu: number; world: number; panels: number; maxInterval: number; hitches: number }> = [];
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
  /** Panel event handlers and their RAF can run outside the main game callback. */
  panelWork(draw: () => void) {
    if (!this.active) { draw(); return; }
    const start = this.clock();
    try { draw(); }
    finally {
      const cost = Math.max(0, this.clock() - start);
      if (this.recording) this.current[index.panels] += cost;
      else this.pendingPanels += cost;
    }
  }
  /** Break the cadence across backgrounding, phase changes and explicit capture boundaries. */
  suspend() { this.previous = null; this.recording = false; }
  begin(now: number, phase = 'unknown') {
    if (!this.active) return;
    if (phase !== this.phase) this.previous = null;
    this.phase = phase;
    this.current.fill(0, 0, index.enemies);
    this.current[index.panels] = this.externalCPU = this.pendingPanels;
    this.pendingPanels = 0;
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
    this.current[index.frameCPU] = Math.max(0, this.clock() - this.started) + this.externalCPU;
    this.current[index.other] = Math.max(0, this.current[index.frameCPU] -
      ['simulation', 'world', 'postfx', 'ui', 'panels', 'monitor'].reduce((sum, name) => sum + this.current[index[name as FrameStage]], 0));
    this.times.set(this.current, this.cursor * FRAME_STRIDE);
    this.phases[this.cursor] = this.phase;
    const now = this.current[index.timestamp], interval = this.current[index.frameInterval];
    let bucket = this.history.at(-1);
    if (!bucket || bucket.phase !== this.phase || now - bucket.start >= 1000) {
      bucket = { phase: this.phase, start: now, end: now, frames: 0, intervals: 0, elapsed: 0,
        cpu: 0, world: 0, panels: 0, maxInterval: 0, hitches: 0 };
      if (this.history.length === FRAME_HISTORY_CAPACITY) this.history.shift();
      this.history.push(bucket);
    }
    bucket.end = now; bucket.frames++;
    if (interval > 0) { bucket.intervals++; bucket.elapsed += interval; }
    bucket.maxInterval = Math.max(bucket.maxInterval, interval);
    if (interval > 50) bucket.hitches++;
    bucket.cpu += this.current[index.frameCPU]; bucket.world += this.current[index.world]; bucket.panels += this.current[index.panels];
    this.count = Math.min(FRAME_CAPACITY, this.count + 1);
    this.cursor = (this.cursor + 1) % FRAME_CAPACITY;
    this.recording = false;
  }
  reset() { this.count = this.cursor = 0; this.pendingPanels = this.externalCPU = 0; this.history = []; this.phase = 'unknown'; this.phases.fill('unknown'); this.suspend(); this.times.fill(0); this.current.fill(0); }
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
    const first = (this.cursor - this.count + FRAME_CAPACITY) % FRAME_CAPACITY;
    const timeline = Array.from({ length: this.count }, (_, i) => ({ ...Object.fromEntries(FRAME_METRICS.map(name => [name, frameValue(samples, i, name)])),
      phase: this.phases[(first + i) % FRAME_CAPACITY] } as Record<FrameMetric, number> & { phase: string }));
    const history = this.history.map(b => ({ phase: b.phase, start: b.start, end: b.end, frames: b.frames,
      fps: b.elapsed > 0 ? b.intervals * 1000 / b.elapsed : null, maxInterval: b.maxInterval, hitches: b.hitches,
      meanCPU: b.cpu / b.frames, meanWorld: b.world / b.frames, meanPanels: b.panels / b.frames }));
    return { enabled: this.active, frames: this.count, units: 'milliseconds', counterUnits: 'count', metrics, timeline,
      history,
      slowFrames: [...timeline].sort((a, b) => b.frameCPU - a.frameCPU).slice(0, 10) };
  }
}
