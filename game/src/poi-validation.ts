import { object, number, integer, text } from './item-validation.ts';
import { EVENT_RULES, BLESSINGS, type EventState } from './poi-content.ts';
import { BIOMES } from './biomes.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { scaledEnemyStats } from './zone-progression.ts';
import { eventRewards } from './poi-rewards.ts';
import { validExplorationPOI } from './exploration-save.ts';
export function validBlessing(v: unknown): boolean {
  return v === undefined || object(v) && typeof v.kind === 'string' && Object.hasOwn(BLESSINGS, v.kind) && number(v.remaining, 0, 90);
}
export function validEvents(v: unknown): v is EventState {
  if (!object(v) || !object(v.sites) || Object.keys(v.sites).length > EVENT_RULES.capacity)
    return false;
  for (const [id, r] of Object.entries(v.sites)) {
    if (!object(r) || !text(id, 180) || !id.startsWith('site:') && !id.startsWith('reliquary:') || r.id !== id
      || !['camp', 'caravan', 'watchtower', 'graveyard', 'standingStones', 'reliquary'].includes(String(r.kind)) || !text(r.name, 100)
      || !number(r.x, -4e7, 4e7) || !number(r.y, -4e7, 4e7) || !integer(r.level, 1, 1e6) || !integer(r.seed, 0, 4294967295)
      || !Object.hasOwn(BIOMES, String(r.biome)) || !['active', 'completed', 'claimed'].includes(String(r.phase))
      || !(r.choice === null || ['goods', 'coin', ...Object.keys(BLESSINGS)].includes(String(r.choice)))
      || !integer(r.delivered, 0, 7) || typeof r.bonusGranted !== 'boolean'
      || r.beaconTarget !== undefined && !validExplorationPOI(r.beaconTarget))
      return false;
    if (r.kind === 'caravan' ? !['goods', 'coin'].includes(String(r.choice)) : r.kind === 'standingStones' ? !Object.hasOwn(BLESSINGS, String(r.choice)) : r.choice !== null)
      return false;
    const reward = eventRewards(r as unknown as EventState['sites'][string]);
    const mask = (1 << reward.items.length) - 1 | (reward.gold ? 4 : 0);
    if ((Number(r.delivered) & ~mask) !== 0 || r.phase === 'claimed' && (r.delivered !== mask || !r.bonusGranted)
      || r.phase === 'active' && (r.delivered !== 0 || r.bonusGranted))
      return false;
  }
  const active = Object.values(v.sites).filter(r => object(r) && r.phase === 'active');
  if (v.trial === null)
    return active.length === 0;
  const t = v.trial;
  if (!object(t) || !text(t.siteId, 180) || active.length !== 1 || !object(v.sites[t.siteId]) || active[0] !== v.sites[t.siteId]
    || !integer(t.wave, 0, 1) || !Array.isArray(t.guardians))
    return false;
  const site = v.sites[t.siteId] as EventState['sites'][string];
  if (!['graveyard', 'standingStones'].includes(site.kind) || t.guardians.length !== (site.kind === 'graveyard' ? 6 : 3))
    return false;
  return t.guardians.every((g, i) => object(g) && Object.hasOwn(ENEMY_DEFINITIONS, String(g.kind)) && ['normal', 'veteran', 'elite'].includes(String(g.rank))
    && integer(g.seed, 0, 4294967295) && number(g.hp, 0, scaledEnemyStats(g.kind as keyof typeof ENEMY_DEFINITIONS, site.level, g.rank as 'normal').maxHp)
    && number(g.x, -4e7, 4e7) && number(g.y, -4e7, 4e7) && typeof g.admitted === 'boolean' && typeof g.dead === 'boolean'
    && (g.dead ? g.admitted && g.hp === 0 : Number(g.hp) > 0) && (i < Number(t.wave) * 3 ? g.dead : true));
}
