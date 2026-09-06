import type { Simulation } from './simulation.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import { focusEvent, EVENT_RULES, blessingChoices, type EventChoice, type EventSite, type EventRecord, type BlessingKind } from './poi-content.ts';
import { eventRewards } from './poi-rewards.ts';
import { CAMP_BIOME_ROSTERS, siteHash } from './wilderness-sites.ts';
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
  if (!sim.eventState.sites[site.id] && Object.keys(sim.eventState.sites).length >= EVENT_RULES.capacity)
    return 'Event journal is full.';
  const record = sim.eventState.sites[site.id];
  if (record?.phase === 'claimed')
    return 'Already claimed.';
  if (record?.phase === 'active')
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
    if (['graveyard', 'standingStones'].includes(site.kind) && sim.eventState.trial)
      return 'Finish the active trial.';
  }
  return null;
}
/** The runtime calls this after the channel. Persist the complete reward/ledger change before publishing it. */
export async function executeEvent(sim: Simulation, site: EventSite, choice: EventChoice | null, persist: (checkpoint: CharacterCheckpoint) => EventResult | Promise<EventResult>, beaconTarget?: WorldPOI): Promise<EventResult> {
  const problem = eventProblem(sim, site, choice);
  if (problem)
    return { ok: false, message: problem };
  const checkpoint = sim.captureCheckpoint(), state = checkpoint.events!;
  const existing = state.sites[site.id], bonusAlreadyGranted = existing?.bonusGranted ?? false;
  const record: EventRecord = existing ?? { ...site, phase: 'completed', choice, delivered: 0, bonusGranted: false };
  state.sites[site.id] = record;
  if (!existing && ['graveyard', 'standingStones'].includes(site.kind)) {
    record.phase = 'active';
    state.trial = { siteId: site.id, wave: 0, guardians: Array.from({ length: site.kind === 'graveyard' ? 6 : 3 }, (_, i) => {
        const kind = CAMP_BIOME_ROSTERS[site.biome][i % 6];
        const rank = i === 0 ? 'veteran' as const : 'normal' as const;
        return { kind, rank, seed: siteHash(site.seed, i, 8791), hp: scaledEnemyStats(kind, site.level, rank).maxHp, x: site.x, y: site.y, admitted: false, dead: false };
      }) };
  }
  else {
    const bundle = eventRewards(record);
    let nextId = sim.nextEntityIdentity;
    bundle.items.forEach((item, i) => {
      if ((record.delivered & 1 << i) || checkpoint.groundItems.length >= LOOT_RULES.maxGroundItems)
        return;
      checkpoint.groundItems.push({ id: nextId++, x: site.x + (i - .5) * 24, y: site.y - 28, item });
      record.delivered |= 1 << i;
    });
    if (bundle.gold && !(record.delivered & 4) && checkpoint.groundGold!.length < GOLD_RULES.maxPiles) {
      checkpoint.groundGold!.push({ id: nextId++, x: site.x + 24, y: site.y - 22, amount: bundle.gold, age: 0 });
      record.delivered |= 4;
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
    if (record.delivered === ((1 << bundle.items.length) - 1 | (bundle.gold ? 4 : 0)))
      record.phase = 'claimed';
  }
  const oldLevel = sim.player.level;
  const result = await persist(checkpoint);
  if (!result.ok)
    return result;
  // Do not restore/reset the simulation: actors, projectiles, channels and world state remain live.
  const xpGain = !bonusAlreadyGranted && record.bonusGranted ? Math.round(eventRewards(record).xp * xpLevelFactor(oldLevel, site.level)) : 0;
  sim.commitEventCheckpoint(checkpoint, xpGain, checkpoint.level - oldLevel);
  return { ok: true, message: record.phase === 'active' ? 'Guardians approaching' : record.phase === 'completed' ? 'Reward waiting' : site.kind === 'watchtower' ? 'Beacon lit' : site.kind === 'standingStones' ? 'Blessing bound' : 'Opened' };
}
