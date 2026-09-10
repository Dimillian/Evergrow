import { dungeonCollision } from './dungeon-collision.ts';
import type { ExpeditionModifier } from './expedition-modifiers.ts';
import { buildDungeonLayout } from './dungeon-layout.ts';
import { worldNavigation } from './world-navigation.ts';
import { dungeonTheme, type DungeonThemeId, type DungeonEventKind, DUNGEON_EVENTS } from './dungeon-content.ts';
import { cryptContains, cryptFloorContains } from './dungeon-contours.ts';
import type { EnemyKind, WorldQuery } from './model.ts';
import type { EnemyRank } from './progression-content.ts';
import type { BiomeId } from './biomes.ts';
export const DUNGEON_RULES = Object.freeze({ version: 4, minimumRooms: 7, maximumRooms: 9, cell: 64, corridor: 192 });
export interface DungeonChestTarget {
    kind: 'cryptChest';
    name: string;
    x: number;
    y: number;
    index: number;
}
export interface DungeonEntrance {
    theme?: DungeonThemeId;
    expedition?: { attempt: number; stage: number; choice: number; modifier: ExpeditionModifier };
    scaling?: import('./encounter-scaling.ts').EncounterScale;
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
    shape?: 'hall' | 'cross' | 'octagon';
    connection?: number;
    outline?: readonly { x: number; y: number }[];
    path?: readonly { x: number; y: number }[];
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
    event?: number;
    eventWave?: number;
}
export interface DungeonProp { id: string; x: number; y: number; kind: 'sarcophagus' | 'icePillar' | 'orrery' | 'bookshelf' | 'tomb' | 'roots' | 'anvil' | 'furnace' | 'crystal' | 'pool' | 'barrel' | 'crate'; seed: number }
export interface DungeonEvent { id: number; room: number; kind: DungeonEventKind; x: number; y: number; chest: number }
export interface DungeonFloor {
    theme?: DungeonThemeId;
    events?: readonly DungeonEvent[];
    props?: readonly DungeonProp[];
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
/** Grow a branching core, add two optional treasure leaves, then an exterior boss chamber. */
export function generateDungeon(seed: number, _level = 1, options: Pick<DungeonEntrance,'theme'|'expedition'> = {}): DungeonFloor {
    const theme=dungeonTheme(seed,options.theme), random=dungeonRandom(seed);
    const {rooms,edges,corridors,treasureIds,bossId}=buildDungeonLayout(random,theme.id,!!options.expedition);
    const center = (r: Room) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    const events: DungeonEvent[] = treasureIds.map((room,id)=>({id,room,kind: id===0 ? (theme.id==='foundry'?'champion':'reliquary') : (theme.id==='rootbound'?'champion':'ward'),...center(rooms[room]),chest:id}));
    const members: DungeonMember[] = [];
    for (const room of rooms) {
        if (room.kind === 'entry' || room.kind === 'boss')
            continue;
        const c = center(room), event=events.find(e=>e.room===room.id), recipe=event?DUNGEON_EVENTS[event.kind]:null, count = recipe ? recipe.size * recipe.rules.count : 6 + Math.floor(random() * 5);
        for (let i = 0; i < count; i++) {
            const modifier=options.expedition?.modifier;
            const replacements={ranged:'archer',brutes:'brute',coven:'caster',hunt:'hound'} as const;
            const replacement=modifier && modifier in replacements ? replacements[modifier as keyof typeof replacements] : undefined;
            const kind: EnemyKind = replacement && i%3===0 ? replacement : theme.roster[(i + room.id) % theme.roster.length];
            const slot=recipe?i%recipe.size:i;
            const baseRank: EnemyRank = recipe && slot === 0 ? (event!.kind === 'champion' || i >= count-recipe.size ? 'elite' : 'veteran') : i === 0 && room.id % 3 === 0 ? 'veteran' : 'normal';
            const rank: EnemyRank = modifier==='elite' && i%4===0 ? 'elite' : modifier==='veterans' && i%2===0 && baseRank==='normal' ? 'veteran' : baseRank;
            members.push({ id: `room:${room.id}:${i}`, kind, rank, room: room.id, x: c.x + (slot % 3 - 1) * 70, y: c.y + (Math.floor(slot / 3) - (Math.ceil((recipe?.size??count) / 3) - 1) / 2) * 75, seed: Math.floor(random() * 4294967296), ...(event?{event:event.id,eventWave:Math.floor(i/recipe!.size)}:{}) });
        }
    }
    const boss = center(rooms[bossId]);
    members.push({ id: 'warden', kind: options.theme ? (theme.boss ?? (theme.id==='foundry'?'ashColossus':theme.id==='drowned'?'briarMatriarch':'warden')) : 'warden', rank: options.expedition?'veteran':'normal', room: bossId, x: boss.x, y: boss.y, seed: (seed ^ 731) >>> 0 });
    for (let i = 0; i < 4; i++)
        members.push({ id: `buried:${i}`, kind: i % 2 ? 'stalker' : 'archer', rank: options.expedition?.modifier==='retinue'?'elite':'normal', room: bossId, x: boss.x + (i % 2 ? 560 : -560), y: boss.y + (i < 2 ? -400 : 400), seed: (seed + i + 900) >>> 0, wave: i < 2 ? 1 : 2 });
    const props: DungeonProp[] = [];
    const floor: DungeonFloor = { theme:theme.id, events, props, seed, rooms, edges, corridors, members, entry: center(rooms[0]), exit: { x: boss.x + 260, y: boss.y + 220 }, chests: [...treasureIds, bossId].map(id => { const p = center(rooms[id]); return { x: p.x, y: p.y + 140, room: id }; }) };
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
        for (const p of [...(r.outline??[]), ...(r.path??[])]) rotate(p);
        // Shared nonzero canvas clips need matching winding at room overlaps,
        // including mirrored floors, or doorway overlaps become punched-out holes.
        if(r.outline && r.outline.reduce((area,p,i)=>{const q=r.outline![(i+1)%r.outline!.length];return area+p.x*q.y-q.x*p.y;},0)<0)
            r.outline=[...r.outline].reverse();
        const a = { x: r.x, y: r.y }, b = { x: r.x + r.width, y: r.y + r.height };
        rotate(a);
        rotate(b);
        r.x = Math.min(a.x, b.x);
        r.y = Math.min(a.y, b.y);
        r.width = Math.abs(a.x - b.x);
        r.height = Math.abs(a.y - b.y);
    }
    for (const p of [...members, ...floor.chests, ...events, floor.entry, floor.exit])
        rotate(p);
    // Decorate perimeter alcoves, leaving room centers, doors and combat lanes clear.
    for(const room of rooms) {
        for(let i=0;i<8;i++) {
            const x=room.x+room.width*(i%2?.82:.18),y=room.y+room.height*(.18+Math.floor(i/2)*.21);
            if(corridors.some(r=>x>r.x-55&&x<r.x+r.width+55&&y>r.y-55&&y<r.y+r.height+55))continue;
            const kinds: DungeonProp['kind'][]=theme.id==='rime'?['icePillar','tomb','crystal','icePillar']:theme.id==='ossuary'?['sarcophagus','tomb','crate','sarcophagus']:theme.id==='astral'?['orrery','bookshelf','crystal','bookshelf']:theme.id==='foundry'?['anvil','furnace','crate','barrel']:theme.id==='drowned'?['pool','crystal','barrel','crystal']:['tomb','roots','crate','tomb'];
            if(dungeonBlocked(floor,x,y,40))continue;
            props.push({id:`dungeon-prop:${room.id}:${i}`,x,y,kind:kinds[(i+room.id)%kinds.length],seed:(seed+room.id*71+i*137)>>>0});
        }
    }
    events.forEach(Object.freeze);Object.freeze(events);
    props.forEach(Object.freeze);Object.freeze(props);
    for (const r of corridors) {
        r.outline?.forEach(Object.freeze); r.path?.forEach(Object.freeze);
        if(r.outline)Object.freeze(r.outline);if(r.path)Object.freeze(r.path);
    }
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
    if (Object.isFrozen(f)) return dungeonCollision(f).blocked(x,y,radius);
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
    navigationTarget(x: number, y: number, tx: number, ty: number, radius = 24) {
        return worldNavigation(this).target(x,y,tx,ty,radius);
    }
}
