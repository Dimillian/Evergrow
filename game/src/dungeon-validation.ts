import { DUNGEON_EVENTS } from './dungeon-content.ts';
import { dungeonMemberLevel } from './dungeon-state.ts';
import type { DungeonEntrance } from './dungeon.ts';
import { validEncounterScale, validEncounterScales } from './encounter-scaling.ts';
import { validTreasureFlight } from './treasure-flight.ts';
import { object, number, integer, text, validItem } from './item-validation.ts';
import { ENEMY_DEFINITIONS, LOOT_RULES } from './combat-content.ts';
import { generateDungeon, dungeonBlocked, DUNGEON_RULES } from './dungeon.ts';
import { scaledEnemyStats } from './zone-progression.ts';
import { BIOMES } from './biomes.ts';
import type { Expeditions, StoredActor, LocationContents } from './dungeon-state.ts';
const point = (v: Record<string, unknown>) => number(v.x, -4e7, 4e7) && number(v.y, -4e7, 4e7);
export function validActors(v: unknown): v is StoredActor[] { return Array.isArray(v) && v.every(a => object(a) && typeof a.kind === 'string' && Object.hasOwn(ENEMY_DEFINITIONS, a.kind) && ['normal', 'veteran', 'elite'].includes(a.rank as string) && integer(a.level, 1, 1e6) && typeof a.biome === 'string' && Object.hasOwn(BIOMES, a.biome) && integer(a.seed, 0, 4294967295) && point(a) && number(a.homeX, -4e7, 4e7) && number(a.homeY, -4e7, 4e7) && number(a.hp, 0, scaledEnemyStats(a.kind as StoredActor['kind'], a.level as number, a.rank as StoredActor['rank']).maxHp) && (a.campId === undefined || text(a.campId, 180) && text(a.memberId, 180)) && (a.bossPhases === undefined || integer(a.bossPhases, 0, 3))); }
export function validCampWounds(v: unknown): v is StoredActor[] { return Array.isArray(v) && v.length <= 32768 && v.every(a => validActors([a]) && a.campId && a.memberId) && new Set(v.map(a => a.memberId)).size === v.length; }
export function validPickups(v: unknown): boolean { return Array.isArray(v) && v.length <= 32 && v.every(p => object(p) && point(p) && integer(p.id, 1) && ['health', 'mana'].includes(p.kind as string) && number(p.restoreFraction, 0, 1) && number(p.life, 0, 100) && number(p.radius, 0, 100)); }
export function validContents(v: unknown): v is LocationContents { return object(v) && (v.encounterScales === undefined || validEncounterScales(v.encounterScales)) && (v.campWounds === undefined || validCampWounds(v.campWounds)) && validActors(v.actors) && validPickups(v.pickups) && Array.isArray(v.groundItems) && v.groundItems.length <= LOOT_RULES.maxGroundItems && v.groundItems.every(i => object(i) && integer(i.id, 1) && point(i) && validItem(i.item) && validTreasureFlight(i.flight)) && Array.isArray(v.groundGold) && v.groundGold.length <= 128 && v.groundGold.every(i => object(i) && integer(i.id, 1) && point(i) && integer(i.amount, 1) && validTreasureFlight(i.flight) && number(i.age, 0, 10)) && Array.isArray(v.clearedCamps) && v.clearedCamps.every(id => text(id, 180)) && object(v.defeatedCampMembers) && Object.entries(v.defeatedCampMembers).every(([k, a]) => text(k, 180) && Array.isArray(a) && a.length <= 32 && a.every(id => text(id, 180))); }
export function validExpeditions(v: unknown): v is Expeditions {
    if (!object(v) || !(v.location === null || text(v.location, 180)) || !Array.isArray(v.runs) || !(v.surface === null || validContents(v.surface)) || !number(v.surfaceX, -4e7, 4e7) || !number(v.surfaceY, -4e7, 4e7))
        return false;
    if (v.cleared !== undefined && (!Array.isArray(v.cleared) || !v.cleared.every(id => text(id, 180) && id.startsWith('dungeon:')) || new Set(v.cleared).size !== v.cleared.length)) return false;
    const ids = new Set<string>(v.cleared as string[] | undefined);
    for (const run of v.runs) {
        if (!object(run) || run.layoutVersion !== DUNGEON_RULES.version || !object(run.entrance))
            return false;
        const e = run.entrance;
        if ((e.scaling !== undefined && (!validEncounterScale(e.scaling) || e.level !== e.scaling.base)) || !text(e.id, 180) || !e.id.startsWith('dungeon:') || ids.has(e.id) || !text(e.name, 80) || !point(e) || !integer(e.seed, 0, 4294967295) || !integer(e.level, 1, 1e6) || typeof e.biome !== 'string' || !Object.hasOwn(BIOMES, e.biome) || !object(run.states) || !validContents(run.contents) || !point(run))
            return false;
        ids.add(e.id);
        const floor = generateDungeon(e.seed, e.level);
        if(!object(run.events)||Object.keys(run.events).length!==(floor.events?.length??0)||!(floor.events??[]).every(event=>{
            const s=(run.events as Record<string,unknown>)[event.id],rules=DUNGEON_EVENTS[event.kind].rules;
            return object(s)&&integer(s.wave,0,rules.count)&&integer(s.cleared,0,rules.count)&&s.wave===s.cleared&&number(s.elapsed,0,1e9)&&number(s.rest,0,rules.interval)&&number(s.held,0,rules.hold)&&typeof s.started==='boolean'&&typeof s.finished==='boolean'&&s.finished===(s.wave===rules.count)
                &&(!s.finished||s.started)&&(s.started||s.wave===0&&s.held===0&&s.rest===0&&s.elapsed===0)&&floor.members.filter(m=>m.event===event.id&&(m.eventWave ?? 0) < Number(s.wave)).every(m=>((run.states as Record<string,{hp:number}>)[m.id]?.hp??1)<=0);
        }))return false;
        if (Object.keys(run.states).length !== floor.members.length || !floor.members.every(m => { const s = (run.states as Record<string, unknown>)[m.id]; return object(s) && number(s.hp, 0, scaledEnemyStats(m.kind, dungeonMemberLevel(e as unknown as DungeonEntrance, m), m.rank).maxHp) && point(s) && typeof s.admitted === 'boolean' && !dungeonBlocked(floor, s.x as number, s.y as number, 0) && (s.bossPhases === undefined || integer(s.bossPhases, 0, 3)); }))
            return false;
        if (dungeonBlocked(floor, run.x as number, run.y as number, 0) || !Array.isArray(run.explored) || run.explored.length > floor.rooms.length || !run.explored.every(id => integer(id, 0, floor.rooms.length-1)) || new Set(run.explored).size !== run.explored.length || !Array.isArray(run.chestMasks) || run.chestMasks.length !== 3 || !run.chestMasks.every((n, i) => integer(n, 0, 15) && (i === 2 || ((n as number) & 6) === 0)))
            return false;
    }
    return v.location === null ? v.surface === null : v.runs.some(r => r.entrance.id === v.location) && v.surface !== null;
}
