import type { Simulation } from './simulation.ts';
import type { ActionResult } from './character-types.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { Enemy } from './model.ts';
import { parseConsoleCommand, consoleHelp, CONSOLE_LIMITS } from './console-content.ts';
import { generateItem, itemDisplayName, assignItemIdentity } from './items.ts';
import { addGroundItem } from './ground-loot.ts';
import { treasureLanding } from './treasure-flight.ts';
import { manaCapacity } from './auras.ts';
import { createEnemy } from './enemy-factory.ts';
import { storedActor } from './dungeon-state.ts';
import { encounterMemberLevel, encounterScaleAt } from './encounter-scaling.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { ENCOUNTER_RULES } from './encounter-director.ts';
import { isSpawnHidden, type SpawnExclusion } from './spawn-visibility.ts';
import { ROAMING_RULES } from './roaming-encounters.ts';
import { sampleBiome } from './biomes.ts';
import { worldDifficulty } from './world-difficulty.ts';

export interface ConsoleExecution {
  /** Rechecked by every dispatch, including read-only help. Never infer local from connectivity. */
  allowed():boolean;
  view:SpawnExclusion|null;
  seed():number;
  identity():string;
  persist(checkpoint:CharacterCheckpoint):Promise<ActionResult>;
}
/** Caller holds simulation and all other commands until saving and commitment finish. */
export async function executeConsoleCommand(sim:Simulation, raw:string, context:ConsoleExecution):Promise<ActionResult> {
  if(!context.allowed())return {ok:false,message:'Commands are available only in local play.'};
  try {
    const command=parseConsoleCommand(raw);
    if(command.type==='help')return {ok:true,message:consoleHelp(command.command)};
    if(sim.player.dead)return {ok:false,message:'Return to the refuge before using commands.'};
    const p=sim.player, checkpoint=sim.captureCheckpoint();
    let commit:()=>void, message:string;
    if(command.type==='refill') {
      const hp=command.resource!=='mp'?p.maxHp:p.hp, mana=command.resource!=='hp'?manaCapacity(p):p.mana;
      checkpoint.hp=hp;checkpoint.mana=mana;
      commit=()=>{p.hp=hp;p.mana=mana;};
      message=command.resource==='hp'?'Health refilled.':command.resource==='mp'?'Available mana refilled.':'Health and available mana refilled.';
    } else if(command.type==='drop') {
      const seed=command.seed??context.seed(), identity=context.identity(), next=sim.nextEntityIdentity;
      const items=[];
      for(let i=0;i<command.count;i++) {
        const item=generateItem((seed+Math.imul(i,0x9e3779b9))>>>0,command.level??p.level,command.kind,command.profile,command.rarity,command.material);
        // A repeated roll is another physical item. Identity is independent of its recipe seed.
        assignItemIdentity(item, `console:${identity}:${i}`);
        const id=next+i;
        addGroundItem(checkpoint.groundItems,{id,item,...treasureLanding(sim.world,p.x,p.y,id,item.seed),flight:{x:p.x,y:p.y,at:sim.time,delay:Math.min(i*.05,1.5)}});
        items.push(item);
      }
      commit=()=>{sim.groundItems=checkpoint.groundItems;sim.reserveIdentity(next+items.length);};
      message=items.length===1?`Dropped ${itemDisplayName(items[0])} · level ${items[0].itemLevel}.`:`Dropped ${items.length} items · level ${items[0].itemLevel}.`;
    } else {
      if(sim.world.dungeonLevel!==undefined||sim.expeditions.location)return {ok:false,message:'Spawn is available in the surface wilderness. Leave the dungeon first.'};
      if(sim.world.isSanctuary?.(p.x,p.y))return {ok:false,message:'Leave town before spawning monsters.'};
      const view=context.view;
      if(!view||![view.x,view.y,view.width,view.height].every(Number.isFinite)||view.width<=0||view.height<=0)return {ok:false,message:'Wait for the world camera before spawning monsters.'};
      const radius=ENEMY_DEFINITIONS[command.kind].radius, next=sim.nextEntityIdentity, seed=command.seed??context.seed();
      const nearby=command.placement==='nearby';
      const centerDistance=nearby?p.radius+radius+40:Math.max(view.width,view.height)*.5+220;
      const center={x:p.x+Math.cos(p.angle)*centerDistance,y:p.y+Math.sin(p.angle)*centerDistance};
      const maxDistance=nearby?CONSOLE_LIMITS.nearbyRadius:Math.max(ENCOUNTER_RULES.despawnDistance,Math.hypot(view.width,view.height)*.5+ROAMING_RULES.retirementMargin)-32;
      const enemies:Enemy[]=[], identity=context.identity();
      for(let attempt=0;attempt<CONSOLE_LIMITS.candidates&&enemies.length<command.count;attempt++) {
        const angle=attempt*2.399963, distance=Math.sqrt(attempt)*(radius*2+12);
        const x=center.x+Math.cos(angle)*distance,y=center.y+Math.sin(angle)*distance;
        const playerDistance=Math.hypot(x-p.x,y-p.y);
        if(Math.abs(x)>4e7||Math.abs(y)>4e7||playerDistance>maxDistance||playerDistance<p.radius+radius+12
          ||(!nearby&&!isSpawnHidden(x,y,view,radius))||sim.world.isSanctuary?.(x,y)||sim.world.blocked(x,y,radius+6)
          ||[...sim.enemies,...enemies].some(e=>e.hp>0&&Math.hypot(e.x-x,e.y-y)<e.radius+radius+12))continue;
        const lootSeed=(seed+Math.imul(enemies.length,0x9e3779b9))>>>0;
        const level=command.level??encounterMemberLevel(encounterScaleAt(x,y,sim.world.seed,p.level),command.rank,lootSeed);
        const difficulty=worldDifficulty(p.character.difficulty).id;
        enemies.push(createEnemy({id:next+enemies.length,kind:command.kind,rank:command.rank,level,lootSeed,lootIdentity:`console:${identity}:${enemies.length}`,x,y,difficulty,rewardDifficulty:difficulty,
          biome:(sim.world.sampleBiome?.(x,y)??sampleBiome(x,y)).id,
          idleDuration:ENCOUNTER_RULES.initialIdleMin+(lootSeed/4294967296)*ENCOUNTER_RULES.initialIdleRange}));
      }
      if(enemies.length!==command.count)return {ok:false,message:`No clear ${nearby?'nearby':'offscreen'} space for this group. Move to open ground or request fewer monsters.`};
      checkpoint.actors=[...(checkpoint.actors??[]),...enemies.map(storedActor)];
      commit=()=>{sim.enemies.push(...enemies);sim.reserveIdentity(next+enemies.length);};
      const dx=enemies[0].x-p.x,dy=enemies[0].y-p.y, direction=Math.abs(dx)>Math.abs(dy)?dx>0?'east':'west':dy>0?'south':'north';
      message=`Spawned ${enemies.length} ${ENEMY_DEFINITIONS[command.kind].name} (${command.rank}) to the ${direction}, ${nearby?'nearby':'beyond the camera'}.`;
    }
    if(!context.allowed())return {ok:false,message:'Local command access changed. Nothing was changed.'};
    const saved=await context.persist(checkpoint);
    if(!saved.ok)return {ok:false,message:saved.message||'Could not save. Nothing was changed.'};
    commit();return {ok:true,message};
  } catch(error) {return {ok:false,message:error instanceof Error?error.message:'Could not complete this command.'};}
}
