import { eventRecipe, recipeMembers } from './event-recipes.ts';
import { object, number, integer, text } from './item-validation.ts';
import { isEventKind, BLESSINGS, type EventState } from './poi-content.ts';
import { BIOMES } from './biomes.ts';
import { scaledEnemyStats } from './zone-progression.ts';
import { eventRewards } from './poi-rewards.ts';
import { validExplorationPOI } from './exploration-save.ts';
export function validBlessing(v: unknown): boolean {
  return v === undefined || object(v) && typeof v.kind === 'string' && Object.hasOwn(BLESSINGS, v.kind) && number(v.remaining, 0, 90);
}
export function validEvents(v: unknown): v is EventState {
  if (!object(v) || !object(v.sites))
    return false;
  if (v.claimed !== undefined && (!Array.isArray(v.claimed) || !v.claimed.every(id => text(id, 180) && (id.startsWith('site:') || id.startsWith('reliquary:')) && !Object.hasOwn(v.sites as object, id)) || new Set(v.claimed).size !== v.claimed.length)) return false;
  for (const [id, r] of Object.entries(v.sites)) {
    if (!object(r) || !text(id, 180) || !id.startsWith('site:') && !id.startsWith('reliquary:') || r.id !== id
      || !isEventKind(String(r.kind)) || !text(r.name, 100)
      || !number(r.x, -4e7, 4e7) || !number(r.y, -4e7, 4e7) || !integer(r.level, 1, 1e6) || !integer(r.seed, 0, 4294967295)
      || !Object.hasOwn(BIOMES, String(r.biome)) || !['active', 'completed', 'claimed'].includes(String(r.phase))
      || !(r.choice === null || ['goods', 'coin', ...Object.keys(BLESSINGS)].includes(String(r.choice)))
      || !integer(r.wavesCleared, 0, 20) || !integer(r.delivered, 0, 2047) || typeof r.bonusGranted !== 'boolean'
      || r.beaconTarget !== undefined && !validExplorationPOI(r.beaconTarget))
      return false;
    if (r.kind === 'caravan' ? !['goods', 'coin'].includes(String(r.choice)) : r.kind === 'standingStones' ? !Object.hasOwn(BLESSINGS, String(r.choice)) : r.choice !== null)
      return false;
    if(r.seals!==undefined&&(!Array.isArray(r.seals)||r.seals.length!==3||!r.seals.every(p=>object(p)&&number(p.x,-4e7,4e7)&&number(p.y,-4e7,4e7)&&Math.hypot(Number(p.x)-Number(r.x),Number(p.y)-Number(r.y))<=250)))return false;
    if(eventRecipe(r as unknown as EventState['sites'][string])?.mode==='seals'&&!r.seals)return false;
    const reward = eventRewards(r as unknown as EventState['sites'][string]);
    const mask = (1 << reward.items.length) - 1 | (reward.gold ? 1 << reward.items.length : 0);
    if ((Number(r.delivered) & ~mask) !== 0 || r.phase === 'claimed' && (r.delivered !== mask || !r.bonusGranted)
      || r.phase === 'active' && (r.delivered !== 0 || r.bonusGranted))
      return false;
  }
  const active = Object.values(v.sites).filter(r => object(r) && r.phase === 'active');
  if (v.trial === null)
    return active.length === 0;
  const t = v.trial;
  if (!object(t) || !text(t.siteId, 180) || active.length !== 1 || !object(v.sites[t.siteId]) || active[0] !== v.sites[t.siteId]
    || !integer(t.wave,0,19) || !integer(t.cleared,0,20) || !number(t.elapsed,0,1e9) || !number(t.rest,0,2) || !number(t.held,0,12)
    || typeof t.started!=='boolean'||t.finished!==false||typeof t.sealReady!=='boolean'||!Array.isArray(t.guardians)) return false;
  const site=v.sites[t.siteId] as EventState['sites'][string],recipe=eventRecipe(site);
  if(!recipe||Number(t.wave)>=recipe.rules.count||t.cleared!==t.wave||recipe.rules.duration&&Number(t.elapsed)>recipe.rules.duration)return false;
  const expected=recipeMembers(site);
  if(t.guardians.length!==expected.length)return false;
  return t.guardians.every((g,i)=>{const m=expected[i];return object(g)&&g.wave===m.wave&&g.kind===m.kind&&g.rank===m.rank&&g.seed===m.seed
    && number(g.hp,0,scaledEnemyStats(m.kind,site.level,m.rank).maxHp)&&number(g.x,-4e7,4e7)&&number(g.y,-4e7,4e7)
    && typeof g.admitted==='boolean'&&typeof g.dead==='boolean'&&(g.dead?g.admitted&&g.hp===0:Number(g.hp)>0)
    && (m.wave<Number(t.wave)?g.dead:true)&&(m.wave>Number(t.wave)?!g.admitted&&!g.dead:true);});
}
