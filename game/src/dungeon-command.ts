import { stageJourneyCompletion } from './journey-rewards.ts';
import type { Simulation } from './simulation.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { DungeonEntrance } from './dungeon.ts';
import { DUNGEON_RULES } from './dungeon.ts';
import { currentDungeon, createDungeonRun, type LocationContents } from './dungeon-state.ts';
import { portalLanding, portalDepartureProblem, type PortalAnchor } from './travel.ts';
import type { WorldQuery } from './model.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import { rollEnemyLoot } from './loot.ts';
import { GOLD_RULES } from './gold.ts';
import { LOOT_RULES } from './combat-content.ts';
export type DungeonAction = {
    kind: 'enter';
    entrance: DungeonEntrance;
} | {
    kind: 'exit';
} | {
    kind: 'town';
    anchor: PortalAnchor;
} | {
    kind: 'return';
    anchor: PortalAnchor;
} | {
    kind: 'death';
};
export type DungeonResult = {
    ok: false;
    message: string;
} | {
    ok: true;
    checkpoint: CharacterCheckpoint;
    message: string;
};
export type PersistDungeon = (checkpoint: CharacterCheckpoint) => { ok: boolean; message: string } | Promise<{ ok: boolean; message: string }>;
/** Complete location and reward ownership are staged before persistence. No live mutation on failure. */
export async function planDungeonTravel(sim: Simulation, action: DungeonAction, surface: WorldQuery, persist: PersistDungeon): Promise<DungeonResult> {
    const checkpoint = sim.captureCheckpoint(), state = checkpoint.expeditions!, run = currentDungeon(state), p = sim.player;
    if (p.dead && action.kind !== 'death')
        return { ok: false, message: 'Recover in town first.' };
    const contents: LocationContents = sim.captureContents();
    let point: {
        x: number;
        y: number;
    };
    if (action.kind === 'enter' || action.kind === 'return') {
        if (run)
            return { ok: false, message: 'Already in a dungeon.' };
        const entrance = action.kind === 'enter' ? action.entrance : state.runs.find(r => r.entrance.id === sim.travel.returnTo?.dungeon)?.entrance;
        if (action.kind === 'return' && sim.travel.returnTo?.town !== action.anchor.band)
            return { ok: false, message: 'Return portal unavailable.' };
        if (!entrance)
            return { ok: false, message: 'Expedition unavailable.' };
        const target = action.kind === 'enter' ? entrance : action.anchor;
        if (Math.hypot(p.x - target.x, p.y - target.y) > 75 || !hasLineOfSight(surface, p.x, p.y, target.x, target.y))
            return { ok: false, message: 'Move closer to the entrance.' };
        let next = state.runs.find(r => r.entrance.id === entrance.id);
        if (!next) {
            if (state.runs.some(r => r.states.warden.hp > 0))
                return { ok: false, message: 'Finish your active expedition first.' };
            if (state.runs.length >= DUNGEON_RULES.recordCap)
                return { ok: false, message: 'Expedition journal full.' };
            next = createDungeonRun(entrance);
            state.runs.push(next);
        }
        state.surface = contents;
        state.surfaceX = p.x;
        state.surfaceY = p.y;
        state.location = entrance.id;
        point = action.kind === 'return' ? sim.travel.returnTo! : { x: next.x, y: next.y };
        applyContents(checkpoint, next.contents);
        next.contents = { ...next.contents, actors: [], groundItems: [], groundGold: [], pickups: [] };
        checkpoint.travel = { ...sim.travel, returnTo: null };
    }
    else {
        if (!run || !state.surface)
            return { ok: false, message: 'No active dungeon.' };
        const floor = sim.dungeonFloor!;
        if (action.kind === 'exit' && !([floor.entry, ...(run.states.warden.hp <= 0 ? [floor.exit] : [])].some(q => Math.hypot(p.x - q.x, p.y - q.y) <= 75)))
            return { ok: false, message: 'Move closer to the exit.' };
        if (action.kind === 'town' && (!sim.portal.ready || action.anchor.band !== sim.travel.homeTown || portalDepartureProblem(p, sim.world)))
            return { ok: false, message: 'The portal is not ready.' };
        run.contents = contents;
        run.x = p.x;
        run.y = p.y;
        const desired = action.kind === 'town' ? { x: action.anchor.x, y: action.anchor.y + 35 } : action.kind === 'death' ? { x: 0, y: 0 } : { x: run.entrance.x, y: run.entrance.y + 42 };
        const landing = portalLanding(surface, desired, p.radius);
        if (!landing)
            return { ok: false, message: 'Exit is blocked.' };
        point = landing;
        applyContents(checkpoint, state.surface);
        state.surface = null;
        state.location = null;
        checkpoint.travel = { ...sim.travel, returnTo: action.kind === 'town' ? { x: p.x, y: p.y, town: action.anchor.band, dungeon: run.entrance.id } : null };
    }
    checkpoint.x = point.x;
    checkpoint.y = point.y;
    const result = await persist(checkpoint);
    if (!result.ok)
        return { ok: false, message: result.message };
    return { ok: true, checkpoint, message: action.kind === 'enter' || action.kind === 'return' ? 'Rootbound Crypt' : 'Returned to the surface.' };
}
function applyContents(c: CharacterCheckpoint, contents: LocationContents) { c.campWounds = contents.campWounds ?? []; c.actors = contents.actors; c.groundItems = contents.groundItems; c.groundGold = contents.groundGold; c.pickups = contents.pickups; c.clearedCamps = contents.clearedCamps; c.defeatedCampMembers = contents.defeatedCampMembers; }
export function dungeonChestProblem(sim: Simulation, index: number): string | null {
    const run = currentDungeon(sim.expeditions), floor = sim.dungeonFloor;
    if (!run || !floor || !Number.isInteger(index) || index < 0 || index > 2)
        return 'Chest unavailable.';
    const chest = floor.chests[index];
    if (sim.player.dead || Math.hypot(sim.player.x - chest.x, sim.player.y - chest.y) > 75 || !hasLineOfSight(sim.world, sim.player.x, sim.player.y, chest.x, chest.y))
        return 'Move closer to the chest.';
    if (index === 2 ? run.states.warden.hp > 0 : floor.members.some(m => m.room === chest.room && run.states[m.id].hp > 0))
        return index === 2 ? 'Defeat the Hollow Warden.' : 'Defeat the chamber guards.';
    if (run.chestMasks[index] === (index === 2 ? 15 : 9))
        return 'Already claimed.';
    return null;
}
export async function claimDungeonChest(sim: Simulation, index: number, persist: PersistDungeon): Promise<{ ok: boolean; message: string }> {
    const problem = dungeonChestProblem(sim, index);
    if (problem)
        return { ok: false, message: problem };
    const checkpoint = sim.captureCheckpoint(), run = currentDungeon(checkpoint.expeditions!);
    if (!run || !Number.isInteger(index) || index < 0 || index > 2)
        return { ok: false, message: 'Chest unavailable.' };
    const floor = sim.dungeonFloor!, chest = floor.chests[index];
    if (sim.player.dead || Math.hypot(sim.player.x - chest.x, sim.player.y - chest.y) > 75 || !hasLineOfSight(sim.world, sim.player.x, sim.player.y, chest.x, chest.y))
        return { ok: false, message: 'Move closer to the chest.' };
    if (index === 2 ? run.states.warden.hp > 0 : floor.members.some(m => m.room === chest.room && run.states[m.id].hp > 0))
        return { ok: false, message: index === 2 ? 'Defeat the Hollow Warden.' : 'Defeat the chamber guards.' };
    const ranks = index === 2 ? ['normal', 'veteran', 'elite'] as const : ['veteran'] as const;
    const items = ranks.map((rank, i) => rollEnemyLoot({ seed: (run.entrance.seed + index * 1777 + i * 97) >>> 0, level: run.entrance.level, biome: run.entrance.biome, kind: 'stalker', rank, firstKill: true })[0]);
    const gold = Math.round((index === 2 ? 45 + run.entrance.seed % 26 : 18) * (1 + .1 * (run.entrance.level - 1)));
    let mask = run.chestMasks[index], next = Math.max(1, ...sim.groundItems.map(i => i.id + 1), ...sim.groundGold.map(i => i.id + 1), ...sim.pickups.map(i => i.id + 1), ...sim.enemies.map(i => i.id + 1), ...sim.projectiles.map(i => i.id + 1));
    for (let i = 0; i < items.length; i++)
        if (!(mask & 1 << i) && checkpoint.groundItems.length < LOOT_RULES.maxGroundItems) {
            checkpoint.groundItems.push({ id: next++, x: chest.x + (i - 1) * 26, y: chest.y - 32, item: items[i] });
            mask |= 1 << i;
        }
    if (!(mask & 8) && (checkpoint.groundGold ??= []).length < GOLD_RULES.maxPiles) {
        checkpoint.groundGold.push({ id: next++, x: chest.x + 30, y: chest.y - 25, age: 0, amount: gold });
        mask |= 8;
    }
    if (mask === run.chestMasks[index])
        return { ok: false, message: mask === (index === 2 ? 15 : 9) ? 'Already claimed.' : 'Collect nearby loot to make room.' };
    run.chestMasks[index] = mask;
    const completion=index===2&&mask===15?stageJourneyCompletion(checkpoint,{...run.entrance,kind:'dungeon',region:run.entrance.name},sim.player,sim.time):null;
    const result = await persist(checkpoint);
    if (!result.ok)
        return result;
    sim.expeditions = checkpoint.expeditions!;
    sim.groundItems = checkpoint.groundItems;
    sim.groundGold = checkpoint.groundGold!;
    sim.reserveIdentity(next);
    if(completion)sim.commitJourneyCheckpoint(checkpoint,completion);
    return { ok: true, message: 'Crypt treasure' };
}
