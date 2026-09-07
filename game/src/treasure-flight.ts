import type { WorldQuery } from './model.ts';
import { hasLineOfSight } from './combat-geometry.ts';
export interface TreasureFlight {
    x: number;
    y: number;
    at: number;
    delay: number;
}
export const TREASURE_FLIGHT_DURATION = 1.05;
export function treasureLanding(world: WorldQuery, x: number, y: number, index: number, seed: number) {
    const angle = index * 2.399963 + (seed % 97) * .17, radius = 65 + (index % 4) * 22;
    for (const scale of [1, .7, .4, 0]) {
        const p = { x: x + Math.cos(angle) * radius * scale, y: y + Math.sin(angle) * radius * .65 * scale };
        if (!world.blocked(p.x, p.y, 8) && hasLineOfSight(world, x, y, p.x, p.y))
            return p;
    }
    return { x, y };
}
export function treasurePose(drop: {
    x: number;
    y: number;
    flight?: TreasureFlight;
}, time: number, reduced = false) {
    if (!drop.flight)
        return { ...drop, height: 0, spin: 0, landed: true };
    const f = drop.flight, t = Math.max(0, Math.min(1, (time - f.at - f.delay) / TREASURE_FLIGHT_DURATION));
    if (reduced)
        return { x: drop.x, y: drop.y, height: 0, spin: 0, landed: t >= 1 };
    return { x: f.x + (drop.x - f.x) * t, y: f.y + (drop.y - f.y) * t, height: Math.sin(t * Math.PI) * 85 + (1 - t) * 20, spin: Math.sin(t * Math.PI) * 1.4, landed: t >= 1 };
}
export function validTreasureFlight(value: unknown): boolean {
    if (value === undefined)
        return true;
    if (!value || typeof value !== 'object')
        return false;
    const f = value as TreasureFlight;
    return [f.x, f.y, f.at, f.delay].every(Number.isFinite) && Math.abs(f.x) <= 4e7 && Math.abs(f.y) <= 4e7 && f.at >= 0 && f.at <= 1e9 && f.delay >= 0 && f.delay <= 3;
}
