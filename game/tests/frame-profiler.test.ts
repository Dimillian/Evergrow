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
