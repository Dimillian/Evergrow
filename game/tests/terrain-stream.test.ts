import assert from 'node:assert/strict';
import test from 'node:test';
import { TerrainStream } from '../src/terrain-stream.ts';
import { FrameProfiler } from '../src/frame-profiler.ts';

test('terrain worker prioritizes current coverage and releases stale/transferred resources', () => {
  const requests: Array<{ id: number; seed: number; x: number; y: number }> = [];
  let terminated = false, closed = 0;
  const port = { onmessage: null as ((event: MessageEvent<{ id: number; bitmap?: ImageBitmap; error?: boolean }>) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    postMessage: (v: unknown) => requests.push(v as typeof requests[number]), terminate: () => { terminated = true; } };
  const stream = new TerrainStream(() => port);
  const reply = (id: number) => port.onmessage!({ data: { id, bitmap: { close: () => { closed++; } } as ImageBitmap } } as MessageEvent);
  stream.update(1, [{ x: 0, y: 0 }, { x: 1, y: 0 }]); assert.equal(requests.length, 1);
  stream.update(2, [{ x: 5, y: 5 }]); reply(requests[0].id);
  assert.equal(closed, 1); assert.equal(requests[1].seed, 2);
  reply(requests[1].id); assert(stream.get(5, 5)); assert.equal(stream.size, 1);
  stream.update(2, Array.from({ length: 300 }, (_, x) => ({ x, y: 1 })));
  assert.equal(stream.queued, 256); assert.equal(closed, 2);
  stream.dispose(); assert(terminated); reply(requests.at(-1)!.id); assert.equal(closed, 3);
});

test('worker errors stop retrying and permit synchronous terrain fallback', () => {
  const port = { onmessage: null as ((event: MessageEvent<{ id: number; error?: boolean }>) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null, postMessage() {}, terminate() {} };
  const stream = new TerrainStream(() => port); stream.update(1, [{ x: 0, y: 0 }]);
  port.onmessage!({ data: { id: 1, error: true } } as MessageEvent);
  assert(stream.failed); assert.equal(stream.size, 0); assert.equal(stream.queued, 0);
});

test('profiler reports bounded percentiles and separates frame cadence from CPU work', () => {
  let time = 0; const profiler = new FrameProfiler(true, () => time);
  for (let i = 0; i < 1000; i++) {
    time = i * 16; profiler.begin(time); const start = profiler.start(); time += i === 999 ? 30 : 2;
    profiler.end('terrain', start); profiler.finish();
  }
  const report = profiler.snapshot(); assert.equal(report.frames, 600);
  assert.equal(report.metrics.terrain.p50, 2); assert.equal(report.metrics.terrain.max, 30);
  assert.equal(report.metrics.frameInterval.p50, 16); assert.equal(report.slowFrames[0].terrain, 30);
  profiler.reset(); assert.equal(profiler.snapshot().frames, 0);
  const disabled = new FrameProfiler(false, () => { throw Error('Disabled profiler read clock'); });
  disabled.begin(0); disabled.start(); disabled.end('world', 0); disabled.finish(); assert.equal(disabled.snapshot().frames, 0);
});
