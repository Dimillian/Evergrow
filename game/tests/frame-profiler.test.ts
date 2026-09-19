import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameProfiler, FRAME_CAPACITY, FRAME_STRIDE, frameValue } from '../src/frame-profiler.ts';
import { PERFORMANCE_GRAPHS, summarizeFrames } from '../src/performance-graphs.ts';
const buffer = () => new Float64Array(FRAME_CAPACITY * FRAME_STRIDE);

test('chronological ring stays bounded after wrap and retains aligned counters', () => {
  let clock = 0;
  const profiler = new FrameProfiler(true, () => clock);
  for (let i = 0; i < 750; i++) {
    profiler.begin(i * 16);
    profiler.setCounters({ enemies: i, projectiles: 1, groundEffects: 2, terrainTiles: 3, terrainQueued: 4 });
    clock += 2; profiler.finish();
  }
  const samples = buffer();
  assert.equal(profiler.copySamples(samples), 600);
  assert.equal(frameValue(samples, 0, 'timestamp'), 150 * 16);
  assert.equal(frameValue(samples, 599, 'timestamp'), 749 * 16);
  assert.equal(frameValue(samples, 0, 'enemies'), 150);
  assert.equal(frameValue(samples, 599, 'enemies'), 749);
  assert.equal(profiler.snapshot().timeline.length, 600);
  assert.throws(() => profiler.copySamples(new Float64Array(1)), RangeError);
});

test('enable, suspend and reset exclude inactive gaps, while real stalls remain uncapped', () => {
  let reads = 0;
  const profiler = new FrameProfiler(false, () => { reads++; return 0; });
  profiler.begin(0); profiler.start(); profiler.end('world', 0); profiler.finish();
  assert.equal(reads, 0);
  profiler.setEnabled(true);
  profiler.begin(0); profiler.finish(); profiler.begin(250); profiler.finish();
  let report = profiler.snapshot();
  assert.equal(report.metrics.frameInterval.p50, 250);
  profiler.suspend(); profiler.begin(100_000); profiler.finish(); profiler.finish();
  assert.equal(profiler.snapshot().frames, 3);
  assert.equal(profiler.snapshot().metrics.frameInterval.max, 250);
  const samples = buffer(); const count = profiler.copySamples(samples);
  assert.deepEqual(summarizeFrames(samples, count), { fps: 4, p95: 250, p99: 250, hitches: 1, intervals: 1 });
  profiler.setEnabled(false); assert.equal(profiler.snapshot().frames, 0);
  profiler.setEnabled(true); profiler.begin(200_000); profiler.finish();
  report = profiler.snapshot(); assert.equal(report.metrics.frameInterval.max, 0);
  profiler.reset(); assert.equal(profiler.copySamples(samples), 0);
});

test('unaccounted CPU subtracts top-level work only, never nested render timings', () => {
  let now = 0; const profiler = new FrameProfiler(true, () => now);
  profiler.begin(0);
  now = 2; profiler.end('simulation', 0);
  now = 12; profiler.end('world', 2); profiler.end('terrain', 4); profiler.end('lighting', 6);
  now = 14; profiler.end('postfx', 12);
  now = 16; profiler.end('ui', 14);
  now = 17; profiler.end('monitor', 16);
  now = 20; profiler.finish();
  const metrics = profiler.snapshot().metrics;
  assert.equal(metrics.frameCPU.max, 20); assert.equal(metrics.other.max, 3);
  assert.equal(metrics.monitor.max, 1);
});

test('graph summaries use frame-count over elapsed time and all dropdown metrics have data', () => {
  const profiler = new FrameProfiler(true, () => 0);
  for (const now of [0, 10, 20, 100]) { profiler.begin(now); profiler.finish(); }
  const samples = buffer(), count = profiler.copySamples(samples);
  const summary = summarizeFrames(samples, count);
  assert.equal(summary.fps, 30); assert.equal(summary.p95, 80); assert.equal(summary.hitches, 1);
  assert.equal(new Set(PERFORMANCE_GRAPHS.map(graph => graph.id)).size, 6);
  for (const graph of PERFORMANCE_GRAPHS) for (const series of graph.series) assert.ok(Number.isFinite(frameValue(samples, 0, series.metric)));
});

test('panel callbacks outside and inside the game frame contribute CPU exactly once', () => {
  let clock = 0; const p = new FrameProfiler(true, () => clock);
  p.panelWork(() => { clock += 5; });
  p.begin(0, 'character');
  p.panelWork(() => { clock += 3; });
  clock += 2; p.finish();
  let report = p.snapshot();
  assert.equal(report.metrics.panels.max, 8);
  assert.equal(report.metrics.frameCPU.max, 10);
  assert.equal(report.metrics.other.max, 2);
  p.begin(16, 'playing'); clock += 1; p.finish();
  report = p.snapshot();
  assert.equal(report.timeline[1].panels, 0);
  assert.equal(report.timeline[1].frameInterval, 0);
  assert.deepEqual(report.timeline.map(f => f.phase), ['character', 'playing']);
  assert.deepEqual(report.history.map(b => b.phase), ['character', 'playing']);
  assert.equal(report.history[0].meanPanels, 8);
  assert.throws(() => p.panelWork(() => { clock += 4; throw Error('draw'); }));
  p.begin(32, 'playing'); p.finish();
  assert.equal(p.snapshot().timeline[2].panels, 4);
  p.panelWork(() => { clock += 10; }); p.reset();
  assert.equal(p.snapshot().history.length, 0);
  p.begin(48); p.finish(); assert.equal(p.snapshot().metrics.panels.max, 0);
});

test('long history retains the baseline after raw frames wrap, with bounded phase-labelled buckets', () => {
  const p = new FrameProfiler(true, () => 0);
  for (let i = 0; i < 1200; i++) { p.begin(i * 1000 / 60, i < 600 ? 'playing' : 'service:blacksmith'); p.finish(); }
  const report = p.snapshot();
  assert.equal(report.timeline[0].phase, 'service:blacksmith');
  assert.equal(report.history[0].phase, 'playing');
  assert.ok(Math.abs(report.history[0].fps! - 60) < .01);
  const frozen = p.snapshot();
  for (let i = 1200; i < 3600; i++) { p.begin(i * 1000, 'playing'); p.finish(); }
  assert.equal(p.snapshot().history.length, 1800);
  assert.equal(frozen.history[0].start, 0, 'a frozen report is independent of live buckets');
  p.setEnabled(false); p.panelWork(() => {}); p.begin(4_000_000); p.finish();
  assert.equal(p.snapshot().history.length, 0);
});

test('tooltip rendering nested in a panel refresh is counted once', () => {
  let now = 0; const p = new FrameProfiler(true, () => now);
  p.panelWork(() => { now += 2; p.panelWork(() => { now += 3; }); now += 1; });
  p.begin(0, 'character'); p.finish();
  assert.equal(p.snapshot().metrics.panels.max, 6);
  assert.equal(p.snapshot().metrics.frameCPU.max, 6);
  assert.throws(() => p.panelWork(() => { p.panelWork(() => { now += 4; throw Error('tooltip'); }); }));
  p.panelWork(() => { now += 2; });
  p.begin(16, 'character'); p.finish();
  assert.equal(p.snapshot().timeline[1].panels, 6, 'failed nested work releases the measurement guard');
});
