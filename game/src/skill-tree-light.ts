import { SKILL_NODES, SKILL_TREE } from './skill-tree.ts';
import { skillNodeScreenRadius, type SkillAtlasView } from './skill-tree-art.ts';

interface Point { x: number; y: number }
interface LightThread { points: Point[]; lengths: number[]; length: number; offset: number; owned: boolean; startRadius: number; endRadius: number }
export interface AtlasLightPlan { threads: LightThread[]; width: number; height: number }
const key = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`;

/** Geometry and route distances are rebuilt only when the view or allocation changes. */
export function buildAtlasLightPlan(view: SkillAtlasView): AtlasLightPlan {
  const distances = new Map<string, number>([['origin', 0]]), queue = ['origin'];
  for (let i = 0; i < queue.length; i++) {
    const a = SKILL_NODES.get(queue[i])!;
    for (const id of a.neighbors) if (view.allocated.has(id)) {
      const b = SKILL_NODES.get(id)!, next = distances.get(a.id)! + Math.hypot(b.x - a.x, b.y - a.y);
      if (next < (distances.get(id) ?? Infinity)) { distances.set(id, next); queue.push(id); }
    }
  }
  const route = new Map(view.route.slice(1).map((id, i) => [key(id, view.route[i]), view.route[i]]));
  for (let i = 1; i < view.route.length; i++) {
    const a = SKILL_NODES.get(view.route[i - 1])!, b = SKILL_NODES.get(view.route[i])!;
    if (!view.allocated.has(b.id)) distances.set(b.id, (distances.get(a.id) ?? 0) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const threads: LightThread[] = [];
  const candidates = [...SKILL_TREE.edges].sort((a, b) =>
    Number(route.has(key(b.from, b.to))) - Number(route.has(key(a.from, a.to))));
  for (const edge of candidates) {
    const owned = view.allocated.has(edge.from) && view.allocated.has(edge.to), routeFrom = route.get(key(edge.from, edge.to));
    if (!owned && !routeFrom) continue;
    let a = SKILL_NODES.get(edge.from)!, b = SKILL_NODES.get(edge.to)!;
    if (routeFrom ? b.id === routeFrom : (distances.get(a.id) ?? 0) > (distances.get(b.id) ?? 0)) [a, b] = [b, a];
    const control = edge.control ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const screen = (p: Point): Point => ({ x: (p.x - view.centerX) * view.zoom + view.width / 2, y: (p.y - view.centerY) * view.zoom + view.height / 2 });
    const [sa, sb, sc] = [a, b, control].map(screen);
    if (Math.max(sa.x, sb.x, sc.x) < -20 || Math.min(sa.x, sb.x, sc.x) > view.width + 20 || Math.max(sa.y, sb.y, sc.y) < -20 || Math.min(sa.y, sb.y, sc.y) > view.height + 20) continue;
    const points = Array.from({ length: 25 }, (_, i) => {
      const t = i / 24, u = 1 - t;
      return { x: u * u * sa.x + 2 * u * t * sc.x + t * t * sb.x, y: u * u * sa.y + 2 * u * t * sc.y + t * t * sb.y };
    });
    const lengths = [0];
    for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    threads.push({ points, lengths, length: lengths[24], offset: (distances.get(a.id) ?? 0) * view.zoom, owned,
      startRadius: skillNodeScreenRadius(a, view.zoom) + 2, endRadius: skillNodeScreenRadius(b, view.zoom) + 2 });
    if (threads.length >= 160) break;
  }
  return { threads, width: view.width, height: view.height };
}

/** A smooth traveling crest over an unbroken luminous thread; never a marching dash. */
export function atlasLightStrength(distance: number, seconds: number): number {
  const phase = ((distance - seconds * 42) % 150 + 150) % 150;
  const separation = Math.min(phase, 150 - phase);
  return Math.exp(-separation * separation / 380);
}

export function drawAtlasLight(c: CanvasRenderingContext2D, plan: AtlasLightPlan, seconds: number): void {
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  // Batch equal light levels: at most 64 strokes, even on a fully allocated atlas.
  const bands = Array.from({ length: 2 }, () => Array.from({ length: 16 }, () => new Path2D()));
  for (const thread of plan.threads) {
    for (let i = 1; i < thread.points.length; i++) {
      const along = (thread.lengths[i - 1] + thread.lengths[i]) / 2;
      if (thread.lengths[i - 1] < thread.startRadius || thread.lengths[i] > thread.length - thread.endRadius) continue;
      const strength = atlasLightStrength(thread.offset + along, seconds);
      if (strength < .025) continue;
      const a = thread.points[i - 1], b = thread.points[i];
      const path = bands[thread.owned ? 0 : 1][Math.min(15, Math.floor(strength * 16))];
      path.moveTo(a.x, a.y); path.lineTo(b.x, b.y);
    }
  }
  for (let kind = 0; kind < 2; kind++) for (let band = 0; band < 16; band++) {
    const strength = (band + .5) / 16, path = bands[kind][band];
    c.globalAlpha = strength * .16; c.strokeStyle = kind === 0 ? '#f3c774' : '#b4daef'; c.lineWidth = 6; c.stroke(path);
    c.globalAlpha = strength * .8; c.strokeStyle = kind === 0 ? '#fff1c3' : '#dff4ff'; c.lineWidth = 1.5; c.stroke(path);
  }
  // Sparse, slow drifting dust adds depth without obscuring nodes or labels.
  for (let i = 0; i < 22; i++) {
    const x = (i * 173.3 + Math.sin(seconds * .08 + i) * 12) % plan.width;
    const y = ((i * 127.7 - seconds * (1 + i % 3) + plan.height * 100) % plan.height);
    c.globalAlpha = .08 + .10 * (1 + Math.sin(seconds * .5 + i)) / 2;
    c.fillStyle = '#b1cbd3'; c.beginPath(); c.arc(x, y, i % 4 === 0 ? 1.1 : .65, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}
