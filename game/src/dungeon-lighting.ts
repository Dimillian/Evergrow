import type { DungeonFloor } from './dungeon.ts';
import { cryptFloorContains, cryptHash, type CryptPoint } from './dungeon-contours.ts';
import type { PointLight } from './lighting.ts';

export const CRYPT_AMBIENT = '#171c29';
export interface CryptFixture { readonly x: number; readonly y: number; readonly kind: 'torch' | 'orb'; readonly phase: number; readonly side: number }
const fixtures = new WeakMap<DungeonFloor, readonly CryptFixture[]>();
/** Stable shared anchors for fixtures, illumination and emissive effects. */
export function cryptFixtures(f: DungeonFloor): readonly CryptFixture[] {
    const cached = fixtures.get(f);
    if (cached) return cached;
    const result: CryptFixture[] = [];
    const add = (x: number, y: number, kind: CryptFixture['kind'], side = 0) => {
        if (!cryptFloorContains(f, x, y)) return;
        if (result.some(p => Math.hypot(p.x - x, p.y - y) < 100)) return;
        result.push(Object.freeze({ x, y, kind, side, phase: cryptHash(Math.round(x), Math.round(y), f.seed) % 628 / 100 }));
    };
    for (const r of f.rooms) {
        for (const side of [-1, 1]) for (const fraction of [.24, .76]) {
            const y = r.y + r.height * fraction;
            let x = r.x + r.width / 2 + side * r.width / 2;
            // Stop at the actual worn wall, then place the bracket just inside it.
            for (let n = 0; n < 12 && cryptFloorContains(f, x + side * 8, y); n++) x += side * 8;
            if (!cryptFloorContains(f, x + side * 8, y)) add(x - side * 22, y, 'torch', side);
        }
        if (r.id % 3 === 0 || r.kind === 'treasure')
            add(r.x + r.width * .5, r.y + r.height * .22, 'orb');
        if (r.kind === 'boss') for (const side of [-1, 1])
            add(r.x + r.width * .5 + side * 290, r.y + r.height * .65, 'orb');
    }
    for (const r of f.corridors) {
        if (Math.max(r.width, r.height) < 400) continue;
        const horizontal = r.width > r.height;
        const count = Math.floor(Math.max(r.width, r.height) / 420) * 2 + 1;
        for (let i = 1; i <= count; i++) {
            const t = i / (count + 1);
            let x = r.x + (horizontal ? r.width * t : 0), y = r.y + (horizontal ? 0 : r.height * t);
            // The overlapping part of a room already has its own fixtures.
            if (f.rooms.some(room => x > room.x - 90 && x < room.x + room.width + 90 && y > room.y - 90 && y < room.y + room.height + 90)) continue;
            for (let step = 0; step < 8 && cryptFloorContains(f, x - (horizontal ? 0 : 8), y - (horizontal ? 8 : 0)); step++) {
                x -= horizontal ? 0 : 8; y -= horizontal ? 8 : 0;
            }
            x += horizontal ? 0 : 22; y += horizontal ? 22 : 0;
            add(x, y, 'torch', horizontal ? 0 : -1);
        }
    }
    const frozen = Object.freeze(result);
    fixtures.set(f, frozen);
    return frozen;
}
export function cryptFlicker(p: CryptFixture, time: number): number {
    return p.kind === 'orb' ? .92 + Math.sin(time * 1.7 + p.phase) * .08
        : .88 + Math.sin(time * 9 + p.phase) * .07 + Math.sin(time * 17.3 + p.phase * 3) * .05;
}
export function cryptLights(f: DungeonFloor, time: number): PointLight[] {
    return cryptFixtures(f).map(p => ({ x: p.x, y: p.y, radius: p.kind === 'orb' ? 270 : 265,
        color: p.kind === 'orb' ? '#67bde3' : '#ffc079', power: cryptFlicker(p, time) * (p.kind === 'orb' ? .9 : 1) }));
}
interface LightCache { masks: Map<string, readonly CryptPoint[]>; samples: Map<string, boolean> }
const masks = new WeakMap<DungeonFloor, LightCache>();
/** Bounded cached visibility fans: each source stops at masonry, including moving combat lights. */
export function cryptLightMask(f: DungeonFloor, light: PointLight): readonly CryptPoint[] {
    let cache = masks.get(f);
    if (!cache) { cache = { masks: new Map(), samples: new Map() }; masks.set(f, cache); }
    const x = Math.round(light.x / 8) * 8, y = Math.round(light.y / 8) * 8, radius = Math.min(600, Math.ceil(light.radius / 8) * 8);
    const key = `${x}:${y}:${radius}`, old = cache.masks.get(key);
    if (old) return old;
    const open = (px: number, py: number) => {
        const gx = Math.round(px / 8), gy = Math.round(py / 8), k = `${gx}:${gy}`;
        let value = cache!.samples.get(k);
        if (value === undefined) {
            value = cryptFloorContains(f, gx * 8, gy * 8);
            if (cache!.samples.size >= 32768) cache!.samples.clear();
            cache!.samples.set(k, value);
        }
        return value;
    };
    const points: CryptPoint[] = [];
    for (let i = 0; i < 96; i++) {
        const angle = i * Math.PI * 2 / 96, dx = Math.cos(angle), dy = Math.sin(angle);
        let distance = 8;
        for (; distance < radius; distance += 12) if (!open(x + dx * distance, y + dy * distance)) break;
        // Illuminate the exposed wall face, but not the chamber on its far side.
        distance = Math.min(radius, distance + 20);
        points.push(Object.freeze({ x: x + dx * distance, y: y + dy * distance }));
    }
    const result = Object.freeze(points);
    if (cache.masks.size >= 256) cache.masks.delete(cache.masks.keys().next().value!);
    cache.masks.set(key, result);
    return result;
}
