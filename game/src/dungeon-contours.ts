import type { DungeonFloor, Room } from './dungeon.ts';

export interface CryptPoint { readonly x: number; readonly y: number }
const outlines = new WeakMap<Room, readonly CryptPoint[]>();
/** Shared seeded chamber silhouettes; map, collision and lighting use this same outline. */
export function cryptOutline(r: Room): readonly CryptPoint[] {
    if (r.outline) return r.outline;
    const cached = outlines.get(r);
    if (cached) return cached;
    const points: CryptPoint[] = [];
    const cut = Math.min(r.width,r.height)*.16;
    const local = r.shape === 'octagon' ? [[cut,0],[r.width-cut,0],[r.width,cut],[r.width,r.height-cut],[r.width-cut,r.height],[cut,r.height],[0,r.height-cut],[0,cut]]
        : r.shape === 'cross' ? [[r.width*.28,0],[r.width*.72,0],[r.width*.72,r.height*.24],[r.width,r.height*.24],[r.width,r.height*.76],[r.width*.72,r.height*.76],[r.width*.72,r.height],[r.width*.28,r.height],[r.width*.28,r.height*.76],[0,r.height*.76],[0,r.height*.24],[r.width*.28,r.height*.24]]
        : [[0,0],[r.width,0],[r.width,r.height],[0,r.height]];
    const corners=local.map(([x,y])=>[x+r.x,y+r.y]);
    for (let side = 0; side < corners.length; side++) {
        const [ax, ay] = corners[side], [bx, by] = corners[(side + 1) % corners.length];
        const length = Math.hypot(bx - ax, by - ay), nx = (by - ay) / length, ny = -(bx - ax) / length;
        const sections = Math.max(3, Math.ceil(length / (r.id < 0 ? 140 : 180)));
        points.push(Object.freeze({ x: ax, y: ay }));
        for (let i = 1; i < sections; i++) {
            const hash = cryptHash(Math.round(ax + i * 31), Math.round(ay + side * 97), r.id);
            const depth = r.id < 0 ? 2 + hash % 7 : 6 + hash % 19;
            points.push(Object.freeze({ x: ax + (bx - ax) * i / sections + nx * depth,
                y: ay + (by - ay) * i / sections + ny * depth }));
        }
    }
    const result = Object.freeze(points);
    outlines.set(r, result);
    return result;
}
export function cryptContains(r: Room, x: number, y: number): boolean {
    if (!r.outline && (!r.shape || r.shape==='hall') && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return true;
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
