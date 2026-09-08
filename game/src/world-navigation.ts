import { hasLineOfSight } from './combat-geometry.ts';
import type { WorldQuery } from './model.ts';

type Point = { x: number; y: number };
type Terrain = Pick<WorldQuery, 'blocked' | 'isSanctuary'>;
interface Step extends Point { next: Point; distance: number }
interface Field { queue: Step[]; cursor: number; steps: Map<string, Step> }
const CELL = 32;
const keyOf = (x: number, y: number) => `${x}:${y}`;

/** Walking clearance differs from a ray of sight: test the whole actor along the lane. */
export function hasWalkableSegment(world: Terrain, x: number, y: number, tx: number, ty: number, radius: number): boolean {
    const distance = Math.hypot(tx - x, ty - y);
    if (![x, y, tx, ty, radius].every(Number.isFinite) || radius < 0 || distance > 4000) return false;
    const count = Math.max(1, Math.ceil(distance / 8));
    for (let i = 0; i <= count; i++) {
        const px = x + (tx - x) * i / count, py = y + (ty - y) * i / count;
        if (world.blocked(px, py, radius + (i > 0 && i < count ? 4 : 0)) || world.isSanctuary?.(px, py)) return false;
    }
    return true;
}

/** Incremental, body-sized flow fields share proven obstacle detours across a pack. */
export class WorldNavigation {
    private fields = new Map<string, Field>();
    private world: Terrain;
    constructor(world: Terrain) { this.world = world; }
    clear(): void { this.fields.clear(); }

    route(x: number, y: number, tx: number, ty: number, radius = 18, work = 128): { target: Point; distance: number } | null {
        if (![x, y, tx, ty, radius].every(Number.isFinite) || radius < 0 || Math.hypot(tx - x, ty - y) > 3600) return null;
        const clearance = Math.ceil(radius / 2) * 2;
        if (hasWalkableSegment(this.world, x, y, tx, ty, clearance))
            return { target: { x: tx, y: ty }, distance: Math.hypot(tx - x, ty - y) };
        // The nearest rounded cell can be inside a trunk even when the actual target is clear.
        // Use a reachable neighboring anchor, never seed a field across an intervening wall.
        const neighbors = (px: number, py: number) => {
            const gx = Math.round(px / CELL), gy = Math.round(py / CELL);
            const points: Point[] = [];
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
                points.push({ x: (gx + dx) * CELL, y: (gy + dy) * CELL });
            return points.sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
        };
        const root = neighbors(tx, ty).find(p => {
            if (hasWalkableSegment(this.world, p.x, p.y, tx, ty, clearance)) return true;
            // A player can stand closer to a trunk than a large guardian can. Route
            // to an attack approach beside them instead of requiring overlapping bodies.
            const distance = Math.hypot(p.x - tx, p.y - ty);
            if (!this.world.blocked(tx, ty, clearance) || distance > 48 || distance < 1
                || !hasLineOfSight(this.world, p.x, p.y, tx, ty)) return false;
            const stop = Math.min(distance, clearance + 8);
            return hasWalkableSegment(this.world, p.x, p.y,
                tx + (p.x - tx) / distance * stop, ty + (p.y - ty) / distance * stop, clearance);
        });
        if (!root) return null;
        const key = `${keyOf(root.x, root.y)}:${clearance}`;
        let field = this.fields.get(key);
        if (!field) {
            const step = { ...root, next: root, distance: 0 };
            field = { queue: [step], cursor: 0, steps: new Map([[keyOf(root.x, root.y), step]]) };
            this.fields.set(key, field);
            if (this.fields.size > 8) this.fields.delete(this.fields.keys().next().value!);
        }
        const sources = neighbors(x, y).filter(p => hasWalkableSegment(this.world, x, y, p.x, p.y, clearance));
        if (!sources.length) return null;
        for (let i = 0; i < work && field.cursor < field.queue.length && field.steps.size < 16384; i++) {
            if (field.steps.has(keyOf(sources[0].x, sources[0].y))) break;
            const p = field.queue[field.cursor++];
            for (const [dx, dy] of [[CELL, 0], [-CELL, 0], [0, CELL], [0, -CELL]]) {
                const nx = p.x + dx, ny = p.y + dy, k = keyOf(nx, ny);
                if (Math.abs(nx - root.x) > 1800 || Math.abs(ny - root.y) > 1800 || field.steps.has(k)) continue;
                if (!hasWalkableSegment(this.world, p.x, p.y, nx, ny, clearance)) continue;
                const step = { x: nx, y: ny, next: { x: p.x, y: p.y }, distance: p.distance + CELL };
                field.steps.set(k, step); field.queue.push(step);
            }
        }
        let best: { target: Point; distance: number } | null = null;
        let remaining=Infinity;
        for (const p of sources) {
            const step = field.steps.get(keyOf(p.x, p.y));
            if (!step) continue;
            for(const candidate of [step,field.steps.get(keyOf(step.next.x,step.next.y))!]) {
                if(!hasWalkableSegment(this.world,x,y,candidate.x,candidate.y,clearance))continue;
                // Score the connector actually returned, not a different neighboring
                // cell. Otherwise curved lanes can alternate between two waypoints.
                const distance=Math.hypot(x-candidate.x,y-candidate.y)+candidate.distance+Math.hypot(root.x-tx,root.y-ty);
                if(best&&(distance>best.distance+.001||Math.abs(distance-best.distance)<=.001&&candidate.distance>=remaining))continue;
                best={target:{x:candidate.x,y:candidate.y},distance};remaining=candidate.distance;
            }
        }
        return best;
    }

    target(x: number, y: number, tx: number, ty: number, radius = 18): Point {
        return this.route(x, y, tx, ty, radius)?.target ?? { x, y };
    }
}

const navigation = new WeakMap<Terrain, WorldNavigation>();
/** Admission and pursuit use the same cached terrain routes. No state is saved here. */
export function worldNavigation(world: Terrain): WorldNavigation {
    let value = navigation.get(world);
    if (!value) { value = new WorldNavigation(world); navigation.set(world, value); }
    return value;
}
