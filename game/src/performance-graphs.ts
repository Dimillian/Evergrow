import { frameValue, type FrameMetric } from './frame-profiler.ts';
export interface PerformanceSeries { metric: FrameMetric; label: string; color: string; }
export interface PerformanceGraph { id: string; label: string; unit: 'ms' | 'count'; note: string; series: readonly PerformanceSeries[]; }
const series = (metric: FrameMetric, label: string, color: string): PerformanceSeries => ({ metric, label, color });
export const PERFORMANCE_GRAPHS: readonly PerformanceGraph[] = [
  { id: 'frames', label: 'Frame timing', unit: 'ms', note: 'Frame interval includes browser scheduling; CPU measures submitted work.', series: [series('frameInterval', 'Frame interval', '#dfc58b'), series('frameCPU', 'CPU work', '#8ddbc3')] },
  { id: 'cpu', label: 'CPU breakdown', unit: 'ms', note: 'Top-level CPU stages. Other includes input, events and unassigned work.', series: [series('simulation', 'Simulation', '#8ddbc3'), series('world', 'World', '#dfc58b'), series('postfx', 'Post FX', '#b3a4e8'), series('ui', 'UI', '#85bfe8'), series('other', 'Other', '#e39a91'), series('monitor', 'Monitor', '#afb8bf')] },
  { id: 'render', label: 'Rendering detail', unit: 'ms', note: 'Nested render timings overlap. These lines must not be added together.', series: [series('sceneSetup', 'Setup', '#afb8bf'), series('scenery', 'Scenery', '#dfc58b'), series('actors', 'Actors', '#e39a91'), series('terrain', 'Terrain', '#8ddbc3'), series('water', 'Water', '#85bfe8'), series('lighting', 'Lighting', '#b3a4e8')] },
  { id: 'actors', label: 'Props & characters', unit: 'ms', note: 'Drawing cost inside Actors; includes visible props, structures and rigs.', series: [series('props', 'Props', '#8ddbc3'), series('structures', 'Buildings', '#dfc58b'), series('characters', 'Characters', '#85bfe8')] },
  { id: 'scene', label: 'Scene load', unit: 'count', note: 'Living enemies, projectiles and ground effects across the active simulation.', series: [series('enemies', 'Enemies', '#dfc58b'), series('projectiles', 'Projectiles', '#85bfe8'), series('groundEffects', 'Ground effects', '#b3a4e8')] },
  { id: 'terrain', label: 'Terrain streaming', unit: 'count', note: 'Resident worker tiles (or synchronous cache) and outstanding worker tiles.', series: [series('terrainTiles', 'Cached tiles', '#8ddbc3'), series('terrainQueued', 'Pending tiles', '#dfc58b')] },
];
export function summarizeFrames(samples: Float64Array, count: number) {
  const intervals: number[] = [];
  let total = 0, hitches = 0;
  for (let i = 0; i < count; i++) {
    const interval = frameValue(samples, i, 'frameInterval');
    if (interval <= 0) continue;
    intervals.push(interval); total += interval;
    if (interval > 50) hitches++;
  }
  intervals.sort((a, b) => a - b);
  const percentile = (p: number) => intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * p))] ?? 0;
  return { fps: total > 0 ? intervals.length * 1000 / total : 0, p95: percentile(.95), p99: percentile(.99), hitches, intervals: intervals.length };
}
