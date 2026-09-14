import { RIFT_RULES, freshRiftLedger, riftRandom, riftBonus } from './rift-content.ts';
import { riftRewardItems } from './rift-rewards.ts';
import { startingBiome, BIOMES } from './biomes.ts';
import { BOSS_CHEST_LOOT_TABLES } from './loot-content.ts';
import { newExpeditionRoute, expeditionChoices, expeditionRewardItems, completeExpeditionStage, dungeonChestMask, EXPEDITION_RULES } from './expedition-route.ts';
import { encounterScaleAt, encounterRewardLevel } from './encounter-scaling.ts';
import { interruptTrial } from './poi-content.ts';
import { treasureLanding } from './treasure-flight.ts';
import { stageJourneyCompletion } from './journey-rewards.ts';
import type { Simulation } from './simulation.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { DungeonEntrance } from './dungeon.ts';
import { currentDungeon, createDungeonRun, compactExpeditions, type LocationContents } from './dungeon-state.ts';
import { portalLanding, portalDepartureProblem, type PortalAnchor } from './travel.ts';
import type { WorldQuery } from './model.ts';
import type { Building } from './settlements.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import { rollEnemyLoot } from './loot.ts';
import { GOLD_RULES } from './gold.ts';
import { LOOT_RULES } from './combat-content.ts';
import { addGroundItem } from './ground-loot.ts';
export type DungeonAction = {kind:'rift';portalId:string;offset:number;keyId?:string;attempt:number} | {kind:'expedition';tableId:string;choice:number;attempt:number;restart?:boolean;resume?:string} | {
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
/** Reach the near edge of the solid table, from any side, without tracing through it. */
export function expeditionTableProblem(table: Building | undefined, player: {x:number;y:number;dead?:boolean}, world: WorldQuery): string | null {
    if (!table || table.kind !== 'expedition') return 'Visit an expedition table.';
    if (player.dead) return 'Recover in town first.';
    if (Math.hypot(player.x-table.door.x,player.y-table.door.y)>75) return 'Move closer to the expedition table.';
    const x=Math.max(table.x-3,Math.min(table.x+table.width+3,player.x));
    const y=Math.max(table.y-3,Math.min(table.y+table.height+3,player.y));
    if (world.blocked(player.x,player.y,0) || world.blocked(x,y,1) || !hasLineOfSight(world,player.x,player.y,x,y)) return 'The expedition table is blocked. Approach from another side.';
    return null;
}
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
    if (action.kind === 'enter' || action.kind === 'return' || action.kind === 'expedition' || action.kind==='rift') {
        if (run)
            return { ok: false, message: 'Already in a dungeon.' };
        let expeditionEntrance: DungeonEntrance | undefined;
        let expeditionPoint: {x:number;y:number}|undefined;
        if(action.kind==='rift') {
            const portal=surface.getBuildings?.(p.x-220,p.y-220,440,440).find(b=>b.id===action.portalId&&b.kind==='rift');
            if(p.level<RIFT_RULES.minimumLevel)return {ok:false,message:'Rifts unlock at level 20.'};
            if(!portal||Math.hypot(p.x-portal.door.x,p.y-portal.door.y)>90||!hasLineOfSight(surface,p.x,p.y,portal.door.x,portal.door.y))return {ok:false,message:'Approach a Crimson Rift in town.'};
            if(!Number.isInteger(action.offset)||Math.abs(action.offset)>RIFT_RULES.offset)return {ok:false,message:'Choose a level within ten of your own.'};
            const ledger=state.rifts??=freshRiftLedger();
            if(action.attempt!==ledger.attempts)return {ok:false,message:'This rift changed. Open the portal again.'};
            const keyIndex=checkpoint.character.inventory.findIndex(i=>i?.id===action.keyId),key=checkpoint.character.inventory[keyIndex];
            if(action.keyId&&(!key||key.kind!=='riftKey'||key.locked))return {ok:false,message:'Choose an unlocked rift key from your inventory.'};
            if(key){checkpoint.character.inventory[keyIndex]=null;if(checkpoint.character.inventoryLayout)delete checkpoint.character.inventoryLayout[key.id];}
            ledger.attempts++;
            const random=riftRandom(((surface.seed??0)^Math.imul(ledger.attempts,0x9e3779b9))>>>0),seed=Math.floor(random()*4294967296),biome=startingBiome(seed);
            expeditionEntrance={id:`dungeon:rift:${ledger.attempts}`,name:`Fractured ${BIOMES[biome].name}`,seed,biome,level:Math.max(1,Math.min(1e6,p.level+action.offset)),x:portal.door.x,y:portal.door.y,rift:{attempt:ledger.attempts,...(key?{keySeed:key.seed,keyTier:key.recipe.riftKeyTier}:{})}};
            state.runs=state.runs.filter(r=>!r.entrance.rift);
        }
        if(action.kind==='expedition') {
            const table=surface.getBuildings?.(p.x-200,p.y-200,400,400).find(b=>b.id===action.tableId&&b.kind==='expedition');
            if(p.level<EXPEDITION_RULES.minimumLevel)return {ok:false,message:`Expeditions unlock at level ${EXPEDITION_RULES.minimumLevel}.`};
            const problem=expeditionTableProblem(table,p,surface);
            if(problem||!table)return {ok:false,message:problem??'Visit an expedition table.'};
            expeditionPoint={x:table.door.x,y:table.door.y+14};
            const previous=state.route;
            if(action.attempt!==(previous?.attempt??0))return {ok:false,message:'This route changed. Open the table again.'};
            if(action.resume){
                expeditionEntrance=state.runs.find(r=>!!previous&&!!r.entrance.expedition&&r.entrance.id===action.resume&&r.entrance.expedition.attempt===previous.attempt)?.entrance;
                if(!expeditionEntrance||previous?.status==='failed')return {ok:false,message:'This dungeon is no longer available.'};
            }else {
            if(!previous||previous.status!=='active') {
                if(previous?.status==='complete'&&!action.restart)return {ok:false,message:'Start a new route to leave previous expedition loot behind.'};
                state.runs=state.runs.filter(r=>!r.entrance.expedition);
                state.route=newExpeditionRoute(surface.seed??0,p.level,(previous?.attempt??0)+1);
            }
            const route=state.route!;
            if(route.choice!==null&&route.choice!==action.choice)return {ok:false,message:'This route is already chosen.'};
            expeditionEntrance=state.runs.find(r=>r.entrance.expedition?.attempt===route.attempt&&r.entrance.expedition.stage===route.cleared&&r.entrance.expedition.choice===action.choice)?.entrance
                ??expeditionChoices(route,{x:table.door.x,y:table.door.y+14})[action.choice];
            if(!expeditionEntrance)return {ok:false,message:'Choose an available route.'};
            route.choice=action.choice;
            }
        }
        const entrance = action.kind==='expedition'||action.kind==='rift' ? expeditionEntrance : action.kind === 'enter' ? action.entrance : state.runs.find(r => r.entrance.id === sim.travel.returnTo?.dungeon)?.entrance;
        if(action.kind==='enter' && (entrance?.expedition||entrance?.rift))return {ok:false,message:'Use the expedition table.'};
        if (action.kind === 'return' && sim.travel.returnTo?.town !== action.anchor.band)
            return { ok: false, message: 'Return portal unavailable.' };
        if (!entrance)
            return { ok: false, message: 'Expedition unavailable.' };
        const target = action.kind === 'return' ? action.anchor : expeditionPoint??entrance;
        if (action.kind !== 'expedition' && action.kind!=='rift' && (Math.hypot(p.x - target.x, p.y - target.y) > 75 || !hasLineOfSight(surface, p.x, p.y, target.x, target.y)))
            return { ok: false, message: 'Move closer to the entrance.' };
        if (state.cleared?.includes(entrance.id)) return { ok: false, message: 'This dungeon has been cleared.' };
        let next = state.runs.find(r => r.entrance.id === entrance.id);
        if (!next) {
            if (state.runs.some(r => r.states.warden.hp > 0 && !r.entrance.expedition) && action.kind!=='expedition' && action.kind!=='rift')
                return { ok: false, message: 'Finish your active expedition first.' };
            const scaling = entrance.rift ? undefined : entrance.expedition ? entrance.scaling! : encounterScaleAt(entrance.x, entrance.y, surface.seed, p.level);
            next = createDungeonRun({ ...entrance, scaling, level: scaling?.base??entrance.level });
            state.runs.push(next);
        }
        interruptTrial(checkpoint.events!,contents.actors);
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
        const desired = action.kind === 'town' ? { x: action.anchor.x, y: action.anchor.y + 35 } : action.kind === 'death' && !run.rift ? { x: 0, y: 0 } : { x: run.entrance.x, y: run.entrance.y + 42 };
        const landing = portalLanding(surface, desired, p.radius);
        if (!landing)
            return { ok: false, message: 'Exit is blocked.' };
        point = landing;
        applyContents(checkpoint, state.surface);
        state.surface = null;
        state.location = null;
        if(action.kind==='death' && run.entrance.expedition && state.route){
            state.route.status='failed';state.route.choice=null;state.route.cleared=0;state.runs=state.runs.filter(r=>!r.entrance.expedition);
        }
        if(run.rift){if(action.kind==='death'){checkpoint.dead=false;checkpoint.hp=p.maxHp;checkpoint.mana=p.maxMana;checkpoint.flasks=2;checkpoint.healCooldown=0;checkpoint.skillCooldowns={};}
          if(run.rift.phase!=='complete')run.rift.phase='failed';state.runs=state.runs.filter(r=>r!==run);}
        checkpoint.travel = { ...sim.travel, returnTo: action.kind === 'town' && !run.rift ? { x: p.x, y: p.y, town: action.anchor.band, dungeon: run.entrance.id } : null };
    }
    compactExpeditions(state, checkpoint.travel?.returnTo?.dungeon);
    checkpoint.x = point.x;
    checkpoint.y = point.y;
    const result = await persist(checkpoint);
    if (!result.ok)
        return { ok: false, message: result.message };
    return { ok: true, checkpoint, message: state.location ? currentDungeon(state)!.entrance.name : 'Returned to the surface.' };
}
function applyContents(c: CharacterCheckpoint, contents: LocationContents) { c.encounterScales = contents.encounterScales ?? {}; c.campWounds = contents.campWounds ?? []; c.actors = contents.actors; c.groundItems = contents.groundItems; c.groundGold = contents.groundGold; c.pickups = contents.pickups; c.clearedCamps = contents.clearedCamps; c.defeatedCampMembers = contents.defeatedCampMembers; }
export function dungeonChestProblem(sim: Simulation, index: number): string | null {
    const run = currentDungeon(sim.expeditions), floor = sim.dungeonFloor;
    if (!run || !floor || !Number.isInteger(index) || index < 0 || index > 2)
        return 'Chest unavailable.';
    if(run.rift&&(index!==2||run.rift.phase!=='complete'||run.rift.claimed))return run.rift.claimed?'Already claimed.':'Defeat the rift guardian before time expires.';
    const chest = floor.chests[index];
    const event=floor.events?.find(e=>e.chest===index);
    const reach=event?250:75;
    if (sim.player.dead || Math.hypot(sim.player.x - chest.x, sim.player.y - chest.y) > reach || !hasLineOfSight(sim.world, sim.player.x, sim.player.y, chest.x, chest.y))
        return 'Move closer to the chest.';
    if(event&&!run.events?.[event.id]?.finished)return 'Complete the chamber encounter.';
    if (index === 2 ? run.states.warden.hp > 0 : floor.members.some(m => m.room === chest.room && run.states[m.id].hp > 0))
        return index === 2 ? 'Defeat the dungeon boss.' : 'Defeat the chamber guards.';
    if (run.chestMasks[index] === dungeonChestMask(run,index))
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
    const rewardLevel = run.entrance.scaling ? encounterRewardLevel(run.entrance.scaling, index === 2 ? 3 : 1) : run.entrance.level;
    const ranks = index === 2 ? ['normal', 'veteran', 'elite'] as const : ['veteran'] as const;
    const items = run.entrance.rift ? riftRewardItems(run.entrance,sim.player.level) : index===2 && run.entrance.expedition ? expeditionRewardItems(run.entrance,sim.player.level) : ranks.map((rank, i) => rollEnemyLoot({ playerLevel:sim.player.level, seed: (run.entrance.seed + index * 1777 + i * 97) >>> 0, level: rewardLevel, biome: run.entrance.biome, kind: 'stalker', rank, firstKill: true, tierWeights: index === 2 ? BOSS_CHEST_LOOT_TABLES.dungeon[i] : undefined, encounter:index===2?'bossChest':'chest' })[0]);
    const gold = Math.round((run.entrance.rift ? RIFT_RULES.goldMultiplier*(1+riftBonus(run.entrance.rift,'gold')/100) : 1)*(index === 2 ? 45 + run.entrance.seed % 26 : 18) * (1 + .1 * (rewardLevel - 1)));
    const goldBit=run.entrance.rift ? 1 << items.length : index===2 && run.entrance.expedition?.stage===9 ? 64 : 8;
    let mask = run.chestMasks[index], next = Math.max(1, ...sim.groundItems.map(i => i.id + 1), ...sim.groundGold.map(i => i.id + 1), ...sim.pickups.map(i => i.id + 1), ...sim.enemies.map(i => i.id + 1), ...sim.projectiles.map(i => i.id + 1));
    for (let i = 0; i < items.length; i++)
        if (!(mask & 1 << i)) {
            if(run.rift&&checkpoint.groundItems.length>=LOOT_RULES.maxGroundItems)break;
            addGroundItem(checkpoint.groundItems, { id: next++, ...treasureLanding(sim.world,chest.x,chest.y,i,run.entrance.seed), flight:{x:chest.x,y:chest.y,at:sim.time,delay:i*.12}, item: items[i] });
            mask |= 1 << i;
        }
    if (!(mask & goldBit) && (checkpoint.groundGold ??= []).length < GOLD_RULES.maxPiles) {
        checkpoint.groundGold.push({ id: next++, ...treasureLanding(sim.world,chest.x,chest.y,12,run.entrance.seed), flight:{x:chest.x,y:chest.y,at:sim.time,delay:.15}, age: 0, amount: Math.round(gold * sim.player.derived.goldFindMultiplier) });
        mask |= goldBit;
    }
    if (mask === run.chestMasks[index])
        return { ok: false, message: mask === dungeonChestMask(run,index) ? 'Already claimed.' : 'Collect nearby loot to make room.' };
    run.chestMasks[index] = mask;
    if(run.rift)run.rift.claimed=mask===dungeonChestMask(run,index);
    if(index===2)completeExpeditionStage(checkpoint.expeditions!,run);
    const completion=index===2&&!run.entrance.expedition&&!run.entrance.rift&&mask===15?stageJourneyCompletion(checkpoint,{...run.entrance,level:rewardLevel,kind:'dungeon',region:run.entrance.name},sim.player,sim.time):null;
    const result = await persist(checkpoint);
    if (!result.ok)
        return result;
    sim.expeditions = checkpoint.expeditions!;
    sim.groundItems = checkpoint.groundItems;
    sim.groundGold = checkpoint.groundGold!;
    sim.reserveIdentity(next);
    if(completion)sim.commitJourneyCheckpoint(checkpoint,completion);
    return { ok: true, message: 'Dungeon treasure' };
}
