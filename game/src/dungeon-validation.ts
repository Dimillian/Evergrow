import { object, number, integer, text, validItem } from './item-validation.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { generateDungeon, DUNGEON_RULES, dungeonBlocked } from './dungeon.ts';
import { scaledEnemyStats } from './zone-progression.ts';
import { BIOMES } from './biomes.ts';
import type { Expeditions, StoredActor, LocationContents } from './dungeon-state.ts';
const point = (v: Record<string, unknown>) => number(v.x, -4e7, 4e7) && number(v.y, -4e7, 4e7);
export function validActors(v: unknown): v is StoredActor[] { return Array.isArray(v) && v.length <= 32 && v.every(a => object(a) && typeof a.kind === 'string' && Object.hasOwn(ENEMY_DEFINITIONS, a.kind) && ['normal', 'veteran', 'elite'].includes(a.rank as string) && integer(a.level, 1, 1e6) && typeof a.biome === 'string' && Object.hasOwn(BIOMES, a.biome) && integer(a.seed, 0, 4294967295) && point(a) && number(a.homeX, -4e7, 4e7) && number(a.homeY, -4e7, 4e7) && number(a.hp, 0, scaledEnemyStats(a.kind as StoredActor['kind'], a.level as number, a.rank as StoredActor['rank']).maxHp) && (a.campId === undefined || text(a.campId, 180) && text(a.memberId, 180)) && (a.bossPhases === undefined || integer(a.bossPhases, 0, 3))); }
export function validCampWounds(v: unknown): v is StoredActor[] { return Array.isArray(v) && v.length <= 32768 && v.every(a => validActors([a]) && a.campId && a.memberId) && new Set(v.map(a => a.memberId)).size === v.length; }
export function validPickups(v: unknown): boolean { return Array.isArray(v) && v.length <= 32 && v.every(p => object(p) && point(p) && integer(p.id, 1) && ['health', 'mana'].includes(p.kind as string) && number(p.restoreFraction, 0, 1) && number(p.life, 0, 100) && number(p.radius, 0, 100)); }
export function validContents(v: unknown): v is LocationContents { return object(v) && (v.campWounds === undefined || validCampWounds(v.campWounds)) && validActors(v.actors) && validPickups(v.pickups) && Array.isArray(v.groundItems) && v.groundItems.length <= 96 && v.groundItems.every(i => object(i) && integer(i.id, 1) && point(i) && validItem(i.item)) && Array.isArray(v.groundGold) && v.groundGold.length <= 128 && v.groundGold.every(i => object(i) && integer(i.id, 1) && point(i) && integer(i.amount, 1) && number(i.age, 0, 10)) && Array.isArray(v.clearedCamps) && v.clearedCamps.length <= 1024 && v.clearedCamps.every(id => text(id, 180)) && object(v.defeatedCampMembers) && Object.keys(v.defeatedCampMembers).length <= 1024 && Object.entries(v.defeatedCampMembers).every(([k, a]) => text(k, 180) && Array.isArray(a) && a.length <= 32 && a.every(id => text(id, 180))); }
export function validExpeditions(v: unknown): v is Expeditions {
    if (!object(v) || !(v.location === null || text(v.location, 180)) || !Array.isArray(v.runs) || v.runs.length > DUNGEON_RULES.recordCap || !(v.surface === null || validContents(v.surface)) || !number(v.surfaceX, -4e7, 4e7) || !number(v.surfaceY, -4e7, 4e7))
        return false;
    const ids = new Set<string>();
    for (const run of v.runs) {
        if (!object(run) || !object(run.entrance))
            return false;
        const e = run.entrance;
        if (!text(e.id, 180) || !e.id.startsWith('dungeon:') || ids.has(e.id) || !text(e.name, 80) || !point(e) || !integer(e.seed, 0, 4294967295) || !integer(e.level, 1, 1e6) || typeof e.biome !== 'string' || !Object.hasOwn(BIOMES, e.biome) || !object(run.states) || !validContents(run.contents) || !point(run))
            return false;
        ids.add(e.id);
        const floor = generateDungeon(e.seed, e.level);
        if (Object.keys(run.states).length !== floor.members.length || !floor.members.every(m => { const s = (run.states as Record<string, unknown>)[m.id]; return object(s) && number(s.hp, 0, scaledEnemyStats(m.kind, e.level as number, m.rank).maxHp) && point(s) && typeof s.admitted === 'boolean' && !dungeonBlocked(floor, s.x as number, s.y as number, 0) && (s.bossPhases === undefined || integer(s.bossPhases, 0, 3)); }))
            return false;
        if (dungeonBlocked(floor, run.x as number, run.y as number, 0) || !Array.isArray(run.explored) || run.explored.length > 13 || !run.explored.every(id => integer(id, 0, 12)) || new Set(run.explored).size !== run.explored.length || !Array.isArray(run.chestMasks) || run.chestMasks.length !== 3 || !run.chestMasks.every((n, i) => integer(n, 0, 15) && (i === 2 || ((n as number) & 6) === 0)))
            return false;
    }
    return v.location === null ? v.surface === null : ids.has(v.location as string) && v.surface !== null;
}
