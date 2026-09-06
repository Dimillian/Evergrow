import type { DungeonFloor, Room } from './dungeon.ts';

export interface CryptPoint { readonly x: number; readonly y: number }
const outlines = new WeakMap<Room, readonly CryptPoint[]>();
/** The old clear rectangle stays inside the worn outline, preserving routes and saved positions. */
export function cryptOutline(r: Room): readonly CryptPoint[] {
    const cached = outlines.get(r);
    if (cached) return cached;
    const points: CryptPoint[] = [];
    const corners = [[r.x, r.y], [r.x + r.width, r.y], [r.x + r.width, r.y + r.height], [r.x, r.y + r.height]];
    for (let side = 0; side < 4; side++) {
        const [ax, ay] = corners[side], [bx, by] = corners[(side + 1) % 4];
        const length = Math.hypot(bx - ax, by - ay), nx = (by - ay) / length, ny = -(bx - ax) / length;
        const sections = Math.max(3, Math.ceil(length / (r.id < 0 ? 140 : 180)));
        points.push(Object.freeze({ x: ax, y: ay }));
        for (let i = 1; i < sections; i++) {
            const hash = cryptHash(Math.round(ax + i * 31), Math.round(ay + side * 97), r.id);
            const depth = r.id < 0 ? 8 + hash % 25 : 24 + hash % 65;
            points.push(Object.freeze({ x: ax + (bx - ax) * i / sections + nx * depth,
                y: ay + (by - ay) * i / sections + ny * depth }));
        }
    }
    const result = Object.freeze(points);
    outlines.set(r, result);
    return result;
}
export function cryptContains(r: Room, x: number, y: number): boolean {
    if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return true;
    if (x < r.x - 88 || x > r.x + r.width + 88 || y < r.y - 88 || y > r.y + r.height + 88) return false;
    const points = cryptOutline(r);
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i], b = points[j];
        if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}
export function cryptFloorContains(f: DungeonFloor, x: number, y: number): boolean {
    return f.rooms.some(r => cryptContains(r, x, y)) || f.corridors.some(r => cryptContains(r, x, y));
}
export function cryptHash(x: number, y: number, seed: number): number {
    let n = Math.imul(x ^ seed, 374761393) ^ Math.imul(y, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return (n ^ (n >>> 16)) >>> 0;
}
