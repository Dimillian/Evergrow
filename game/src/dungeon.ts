import { cryptContains, cryptFloorContains } from './dungeon-contours.ts';
import type { EnemyKind, WorldQuery } from './model.ts';
import type { EnemyRank } from './progression-content.ts';
import type { BiomeId } from './biomes.ts';
export const DUNGEON_RULES = Object.freeze({ version: 1, rooms: 13, liveCap: 24, recordCap: 8, cell: 64, corridor: 192 });
export interface DungeonChestTarget {
    kind: 'cryptChest';
    name: string;
    x: number;
    y: number;
    index: number;
}
export interface DungeonEntrance {
    id: string;
    name: string;
    seed: number;
    level: number;
    biome: BiomeId;
    x: number;
    y: number;
}
export interface Room {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    kind: 'entry' | 'combat' | 'treasure' | 'boss';
}
export interface DungeonMember {
    id: string;
    kind: EnemyKind;
    rank: EnemyRank;
    room: number;
    x: number;
    y: number;
    seed: number;
    wave?: number;
}
export interface DungeonFloor {
    seed: number;
    rooms: readonly Room[];
    edges: readonly (readonly [
        number,
        number
    ])[];
    corridors: readonly Room[];
    members: readonly DungeonMember[];
    entry: {
        x: number;
        y: number;
    };
    exit: {
        x: number;
        y: number;
    };
    chests: readonly {
        x: number;
        y: number;
        room: number;
    }[];
}

export function dungeonRandom(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
/** Construct a connected route, two optional chambers and a loop before decorating. No unbounded retries. */
export function generateDungeon(seed: number, level = 1): DungeonFloor {
    const random = dungeonRandom(seed), cells = [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1], [0, 2], [1, 2], [2, 2], [2, 3], [0, 3], [1, 3], [3.5, 3]];
    const rooms: Room[] = cells.map(([cx, cy], id) => {
        const width = id === 12 ? 1408 : 448 + Math.floor(random() * 3) * 64, height = id === 12 ? 1088 : 448 + Math.floor(random() * 3) * 64;
        const offsetX=id===0?0:(Math.floor(random()*3)-1)*64,offsetY=id===0?0:(Math.floor(random()*3)-1)*64;
        return { id, x: cx * 896 + offsetX - width / 2, y: cy * 896 + offsetY - height / 2, width, height, kind: id === 0 ? 'entry' : id === 12 ? 'boss' : id >= 10 ? 'treasure' : 'combat' };
    });
    const edges: [
        number,
        number
    ][] = [];
    for (let i = 0; i < 9; i++)
        edges.push([i, i + 1]);
    edges.push([6, 10], [10, 11], [11, 8], [9, 12]);
    const center = (r: Room) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    const corridors: Room[] = [];
    for (const [a, b] of edges) {
        const p = center(rooms[a]), q = center(rooms[b]), w = DUNGEON_RULES.corridor;
        corridors.push({ id: -1, kind: 'combat', x: Math.min(p.x, q.x) - w / 2, y: p.y - w / 2, width: Math.abs(p.x - q.x) + w, height: w }, { id: -1, kind: 'combat', x: q.x - w / 2, y: Math.min(p.y, q.y) - w / 2, width: w, height: Math.abs(p.y - q.y) + w });
    }
    const members: DungeonMember[] = [];
    for (const room of rooms) {
        if (room.kind === 'entry' || room.kind === 'boss')
            continue;
        const c = center(room), count = room.kind === 'treasure' ? 4 : 4 + Math.floor(random() * 3);
        for (let i = 0; i < count; i++) {
            const kind: EnemyKind = room.id === 7 ? 'goblin' : (['stalker', 'stalker', 'hound', 'archer', 'caster', 'brute'] as const)[(i + room.id) % 6];
            members.push({ id: `room:${room.id}:${i}`, kind, rank: i === 0 && room.id % 3 === 0 ? 'veteran' : room.id === 11 && i === 0 && level >= 3 ? 'elite' : 'normal', room: room.id, x: c.x + (i % 3 - 1) * 85, y: c.y + (Math.floor(i / 3) - .5) * 100, seed: Math.floor(random() * 4294967296) });
        }
    }
    const boss = center(rooms[12]);
    members.push({ id: 'warden', kind: 'warden', rank: 'normal', room: 12, x: boss.x, y: boss.y, seed: (seed ^ 731) >>> 0 });
    for (let i = 0; i < 4; i++)
        members.push({ id: `buried:${i}`, kind: i % 2 ? 'stalker' : 'archer', rank: 'normal', room: 12, x: boss.x + (i % 2 ? 560 : -560), y: boss.y + (i < 2 ? -400 : 400), seed: (seed + i + 900) >>> 0, wave: i < 2 ? 1 : 2 });
    const floor: DungeonFloor = { seed, rooms, edges, corridors, members, entry: center(rooms[0]), exit: { x: boss.x + 260, y: boss.y + 220 }, chests: [10, 11, 12].map(id => { const p = center(rooms[id]); return { x: p.x + 100, y: p.y + 160, room: id }; }) };
    // Rotate and mirror the authored graph; proportions and encounter recipes remain seeded.
    const turn = (seed >>> 4) % 4, mirror = (seed & 1) ? -1 : 1;
    const rotate = (p: {
        x: number;
        y: number;
    }) => { let x = p.x * mirror, y = p.y; for (let i = 0; i < turn; i++) {
        const next = -y;
        y = x;
        x = next;
    } p.x = x; p.y = y; };
    for (const r of [...rooms, ...corridors]) {
        const a = { x: r.x, y: r.y }, b = { x: r.x + r.width, y: r.y + r.height };
        rotate(a);
        rotate(b);
        r.x = Math.min(a.x, b.x);
        r.y = Math.min(a.y, b.y);
        r.width = Math.abs(a.x - b.x);
        r.height = Math.abs(a.y - b.y);
    }
    for (const p of [...members, ...floor.chests, floor.entry, floor.exit])
        rotate(p);
    for (const value of [...rooms, ...corridors, ...members, ...edges, ...floor.chests])
        Object.freeze(value);
    Object.freeze(rooms);
    Object.freeze(edges);
    Object.freeze(corridors);
    Object.freeze(members);
    Object.freeze(floor.chests);
    Object.freeze(floor.entry);
    Object.freeze(floor.exit);
    return Object.freeze(floor);
}
export function dungeonRoomAt(f: DungeonFloor, x: number, y: number): Room | undefined { return f.rooms.find(r => cryptContains(r, x, y)); }
export function dungeonBlocked(f: DungeonFloor, x: number, y: number, radius: number): boolean {
    if (![x, y, radius].every(Number.isFinite) || radius < 0 || radius > 1000)
        return true;
    const open = (px: number, py: number) => cryptFloorContains(f, px, py);
    if (!open(x, y))
        return true;
    for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8;
        if (!open(x + Math.cos(a) * radius, y + Math.sin(a) * radius))
            return true;
    }
    return false;
}
/** Collision and navigation share the same room/corridor union. */
export class DungeonGeometry implements WorldQuery {
    readonly seed: number;
    private flows = new Map<string, Map<string, {
        x: number;
        y: number;
    }>>();
    readonly floor: DungeonFloor;
    constructor(floor: DungeonFloor) { this.floor = floor; this.seed = floor.seed; }
    blocked(x: number, y: number, r: number) { return dungeonBlocked(this.floor, x, y, r); }
    move(x: number, y: number, dx: number, dy: number, r: number) {
        if (![x, y, dx, dy, r].every(Number.isFinite) || Math.hypot(dx, dy) > 4096)
            return { x, y };
        const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
        for (let i = 0; i < n; i++) {
            if (!this.blocked(x + dx / n, y + dy / n, r)) {
                x += dx / n;
                y += dy / n;
            }
            else {
                if (!this.blocked(x + dx / n, y, r))
                    x += dx / n;
                if (!this.blocked(x, y + dy / n, r))
                    y += dy / n;
            }
        }
        return { x, y };
    }
    navigationTarget(x: number, y: number, tx: number, ty: number) {
        const cell = 64, gx = Math.round(tx / cell), gy = Math.round(ty / cell), key = `${gx}:${gy}`;
        if (this.blocked(gx * cell, gy * cell, 24))
            return { x: tx, y: ty };
        let flow = this.flows.get(key);
        if (!flow) {
            flow = new Map();
            const queue = [{ x: gx, y: gy }];
            flow.set(key, { x: tx, y: ty });
            for (let i = 0; i < queue.length && i < 12000; i++) {
                const p = queue[i];
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const q = { x: p.x + dx, y: p.y + dy }, k = `${q.x}:${q.y}`;
                    if (!flow.has(k) && !this.blocked(q.x * cell, q.y * cell, 24)) {
                        flow.set(k, { x: p.x * cell, y: p.y * cell });
                        queue.push(q);
                    }
                }
            }
            if (this.flows.size >= 4)
                this.flows.delete(this.flows.keys().next().value!);
            this.flows.set(key, flow);
        }
        return flow.get(`${Math.round(x / cell)}:${Math.round(y / cell)}`) ?? { x: tx, y: ty };
    }
}
