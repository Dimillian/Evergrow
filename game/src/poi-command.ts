import { treasureLanding } from './treasure-flight.ts';
import { eventRecipe, isTrialKind, recipeMembers, planSeals, sealPoint } from './event-recipes.ts';
import { freshWaves } from './wave-system.ts';
import { stageJourneyCompletion } from './journey-rewards.ts';
import { getZoneAt } from './zone-progression.ts';
import type { Simulation } from './simulation.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import { focusEvent, eventClaimed, compactEvents, EVENT_RULES, blessingChoices, type EventChoice, type EventSite, type EventRecord, type BlessingKind } from './poi-content.ts';
import { eventRewards } from './poi-rewards.ts';
import { scaledEnemyStats } from './zone-progression.ts';
import { awardCharacterExperience } from './character.ts';
import { xpLevelFactor } from './progression.ts';
import { LOOT_RULES } from './combat-content.ts';
import { GOLD_RULES } from './gold.ts';
import type { WorldPOI } from './world-pois.ts';
export interface EventResult {
  ok: boolean;
  message: string;
}
export function eventProblem(sim: Simulation, site: EventSite, choice: EventChoice | null): string | null {
  if (!focusEvent([site], sim.player, sim.world))
    return 'Move closer.';
  const record = sim.eventState.sites[site.id];
  if(record?.phase==='active'&&sim.eventState.trial?.sealReady&&!focusEvent([{...record,...sealPoint(record,sim.eventState.trial.wave)}],sim.player,sim.world))return 'Move to the seal.';
  if (eventClaimed(sim.eventState, site.id))
    return 'Already claimed.';
  if (record?.phase === 'active' && !(sim.eventState.trial?.siteId===site.id&&sim.eventState.trial.sealReady))
    return 'Defeat the guardians.';
  if (site.kind === 'camp' && sim.getCampState(site.id) !== 'cleared')
    return 'Clear the camp.';
  if (!record) {
    if (site.kind === 'caravan' && !['goods', 'coin'].includes(String(choice)))
      return 'Choose your cargo.';
    if (site.kind === 'standingStones' && !blessingChoices(site).includes(choice as BlessingKind))
      return 'Choose a blessing.';
    if (site.kind !== 'caravan' && site.kind !== 'standingStones' && choice !== null)
      return 'Invalid choice.';
    if (isTrialKind(site.kind) && sim.eventState.trial)
      return 'Finish the active trial.';
  }
  return null;
}
/** The runtime calls this after the channel. Persist the complete reward/ledger change before publishing it. */
export async function executeEvent(sim: Simulation, site: EventSite, choice: EventChoice | null, persist: (checkpoint: CharacterCheckpoint) => EventResult | Promise<EventResult>, beaconTarget?: WorldPOI): Promise<EventResult> {
  return commitEvent(sim,site,choice,persist,beaconTarget);
}

async function commitEvent(sim: Simulation, site: EventSite, choice: EventChoice | null, persist: (checkpoint: CharacterCheckpoint) => EventResult | Promise<EventResult>, beaconTarget?: WorldPOI, automatic=false): Promise<EventResult> {
  const problem = automatic ? null : eventProblem(sim, site, choice);
  if (problem)
    return { ok: false, message: problem };
  const checkpoint = sim.captureCheckpoint(), state = checkpoint.events!;
  const existing = state.sites[site.id], bonusAlreadyGranted = existing?.bonusGranted ?? false;
  const record: EventRecord = existing ?? { ...site, phase: 'completed', choice, delivered: 0, wavesCleared: 0, bonusGranted: false };
  state.sites[site.id] = record;
  if (existing?.phase==='active'&&state.trial?.sealReady) {
    const trial=state.trial;trial.sealReady=false;trial.cleared++;trial.wave++;
    const r=eventRecipe(existing)!;
    if(trial.wave>=r.rules.count){existing.wavesCleared=trial.cleared;existing.phase='completed';state.trial=null;}
    else trial.rest=r.rules.interval;
  } else if (!existing && isTrialKind(site.kind)) {
    if(eventRecipe(site)?.mode==='seals'){const seals=planSeals(site,sim.world);if(!seals)return {ok:false,message:'No clear route to the seals.'};record.seals=seals;}
    record.phase='active';
    state.trial={...freshWaves(),siteId:site.id,sealReady:false,guardians:recipeMembers(site).map(m=>({...m,hp:scaledEnemyStats(m.kind,site.level,m.rank).maxHp,x:site.x,y:site.y,admitted:false,dead:false}))};
  }
  else {
    const bundle = eventRewards(record);
    let nextId = sim.nextEntityIdentity;
    bundle.items.forEach((item, i) => {
      if ((record.delivered & 1 << i) || checkpoint.groundItems.length >= LOOT_RULES.maxGroundItems)
        return;
      checkpoint.groundItems.push({ id: nextId++, ...treasureLanding(sim.world,site.x,site.y,i,site.seed), flight:{x:site.x,y:site.y,at:sim.time,delay:i*.11}, item });
      record.delivered |= 1 << i;
    });
    if (bundle.gold && !(record.delivered & (1 << bundle.items.length)) && checkpoint.groundGold!.length < GOLD_RULES.maxPiles) {
      checkpoint.groundGold!.push({ id: nextId++, ...treasureLanding(sim.world,site.x,site.y,12,site.seed), flight:{x:site.x,y:site.y,at:sim.time,delay:.1}, amount: bundle.gold, age: 0 });
      record.delivered |= (1 << bundle.items.length);
    }
    if (!record.bonusGranted) {
      const reward = Math.round(bundle.xp * xpLevelFactor(checkpoint.level, site.level));
      const staged = { ...sim.player, character: checkpoint.character, level: checkpoint.level, xp: checkpoint.xp };
      if (reward)
        awardCharacterExperience(staged, reward);
      if (site.kind === 'standingStones')
        staged.character.blessing = { kind: record.choice as BlessingKind, remaining: EVENT_RULES.blessingDuration };
      checkpoint.character = staged.character;
      checkpoint.level = staged.level;
      checkpoint.xp = staged.xp;
      if (site.kind === 'watchtower' && beaconTarget)
        record.beaconTarget = { ...beaconTarget };
      record.bonusGranted = true;
    }
    if (record.delivered === ((1 << bundle.items.length) - 1 | (bundle.gold ? (1 << bundle.items.length) : 0)))
      record.phase = 'claimed';
  }
  const oldLevel = sim.player.level;
  const completion=record.phase==='claimed'?stageJourneyCompletion(checkpoint,{...site,region:getZoneAt(site.x,site.y,sim.world.seed).name},sim.player,sim.time,oldLevel):null;
  compactEvents(state);
  const result = await persist(checkpoint);
  if (!result.ok)
    return result;
  // Do not restore/reset the simulation: actors, projectiles, channels and world state remain live.
  const xpGain = !bonusAlreadyGranted && record.bonusGranted ? Math.round(eventRewards(record).xp * xpLevelFactor(oldLevel, site.level)) : 0;
  sim.commitEventCheckpoint(checkpoint, xpGain+(completion?.xp??0), checkpoint.level - oldLevel, completion);
  return { ok: true, message: record.phase === 'active' ? 'Guardians approaching' : record.phase === 'completed' ? 'Reward waiting' : site.kind === 'watchtower' ? 'Beacon lit' : site.kind === 'standingStones' ? 'Blessing bound' : 'Opened' };
}

/** The timed hoard opens automatically nearby; full-ground leftovers remain manually claimable. */
export async function claimCursedChest(sim:Simulation,id:string,persist:(checkpoint:CharacterCheckpoint)=>EventResult|Promise<EventResult>):Promise<EventResult> {
  const record=sim.eventState.sites[id];
  if(!record||record.kind!=='cursedChest'||record.phase!=='completed'||record.bonusGranted||sim.player.dead||sim.dungeonFloor||Math.hypot(sim.player.x-record.x,sim.player.y-record.y)>EVENT_RULES.trialRadius)return {ok:false,message:'Chest is not ready.'};
  return commitEvent(sim,record,record.choice,persist,undefined,true);
}
