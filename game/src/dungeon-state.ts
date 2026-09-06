import type { Enemy } from './model.ts';
import type { GroundItem } from './character-types.ts';
import type { GroundGold } from './gold.ts';
import type { Pickup } from './model.ts';
import type { DungeonEntrance } from './dungeon.ts';
import { generateDungeon } from './dungeon.ts';
import { scaledEnemyStats } from './zone-progression.ts';
export interface StoredActor {
    kind: Enemy['kind'];
    rank: Enemy['rank'];
    level: number;
    biome: Enemy['biome'];
    seed: number;
    x: number;
    y: number;
    homeX: number;
    homeY: number;
    hp: number;
    campId?: string;
    memberId?: string;
    bossPhases?: number;
}
export interface LocationContents {
    campWounds?: StoredActor[];
    actors: StoredActor[];
    groundItems: GroundItem[];
    groundGold: GroundGold[];
    pickups: Pickup[];
    clearedCamps: string[];
    defeatedCampMembers: Record<string, string[]>;
}
export interface DungeonRun {
    entrance: DungeonEntrance;
    states: Record<string, {
        hp: number;
        x: number;
        y: number;
        admitted: boolean;
        bossPhases?: number;
    }>;
    explored: number[];
    chestMasks: number[];
    contents: LocationContents;
    x: number;
    y: number;
}
export interface Expeditions {
    location: string | null;
    runs: DungeonRun[];
    surface: LocationContents | null;
    surfaceX: number;
    surfaceY: number;
}
export const emptyContents = (): LocationContents => ({ actors: [], groundItems: [], groundGold: [], pickups: [], clearedCamps: [], defeatedCampMembers: {} });
export const freshExpeditions = (): Expeditions => ({ location: null, runs: [], surface: null, surfaceX: 0, surfaceY: 0 });
export function createDungeonRun(entrance: DungeonEntrance): DungeonRun { const f = generateDungeon(entrance.seed, entrance.level); return { entrance, states: Object.fromEntries(f.members.map(m => [m.id, { hp: scaledEnemyStats(m.kind, entrance.level, m.rank).maxHp, x: m.x, y: m.y, admitted: false }])), explored: [0], chestMasks: [0, 0, 0], contents: emptyContents(), x: f.entry.x, y: f.entry.y }; }
export function storedActor(e: Enemy): StoredActor { return { kind: e.kind, rank: e.rank, level: e.level, biome: e.biome, seed: e.lootSeed, x: e.x, y: e.y, homeX: e.homeX, homeY: e.homeY, hp: e.hp, campId: e.campId, memberId: e.campMemberId, bossPhases: e.bossPhases }; }
export function currentDungeon(state: Expeditions): DungeonRun | undefined { return state.runs.find(r => r.entrance.id === state.location); }
export function syncDungeon(run: DungeonRun, enemies: readonly Enemy[], x: number, y: number) { run.x = x; run.y = y; for (const e of enemies) {
    if (e.campId !== run.entrance.id || !e.campMemberId)
        continue;
    const s = run.states[e.campMemberId];
    if (s) {
        s.hp = Math.max(0, e.hp);
        s.x = e.x;
        s.y = e.y;
        s.admitted = true;
        s.bossPhases = e.bossPhases;
    }
} }
