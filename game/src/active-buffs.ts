import { AURA_IDS, AURAS, AURA_RULES, auraSummary, auraRank, resolveAura } from './aura-content.ts';
import { auraPower } from './auras.ts';
import type { Player } from './model.ts';
import type { SkillId } from './character-types.ts';
import { AFFIX_COMBAT_RULES } from './equipment-affix-content.ts';
import { SKILL_DEFINITIONS, canUseSkill } from './skill-content.ts';
import { resolveSkill } from './skill-progression.ts';
import { spellweaveMultiplier, canSpellweave } from './affix-combat.ts';

export interface ActiveBuff {
  persistent?: boolean; reservation?: number; progress?: number;
  id: string; name: string; remaining: number; duration: number; color: string;
  icon: SkillId | 'weave-melee' | 'weave-spell'; summary: string; term?: string; charges?: number;
}
const percent = (n: number) => `${Math.round(n * 100)}%`;
/** Read-only projection: no timers, combat mutations or save ownership in the HUD. */
export function activeBuffs(p: Player): ActiveBuff[] {
  if (p.dead) return [];
  const buffs: ActiveBuff[] = [];
  const add = (buff: ActiveBuff) => { if (Number.isFinite(buff.remaining) && buff.remaining > 0) buffs.push(buff); };
  if (canSpellweave(p)) for (const kind of ['spell', 'melee'] as const) {
    add({ id: `weave-${kind}`, name: `Next ${kind}`, icon: `weave-${kind}`, color: kind === 'spell' ? '#c7a0ef' : '#e5bd80',
      remaining: p.affixBuffs?.[kind] ?? 0, duration: AFFIX_COMBAT_RULES.weaveDuration,
      summary: `+${Math.round((spellweaveMultiplier(p) - 1) * 100)}% damage on your next ${kind === 'spell' ? 'spell or magic bolt' : 'melee action'}.`, term: 'spellweave' });
  }
  if (p.derived.afterguardPercent > 0 && p.equipment.offHand?.kind === 'shield') add({ id: 'afterguard', name: 'Afterguard', icon: 'brace', color: '#a9daca',
    remaining: p.affixBuffs?.guard ?? 0, duration: AFFIX_COMBAT_RULES.guardDuration, summary: `+${Number(p.derived.afterguardPercent.toFixed(1))}% armor.`, term: 'afterguard' });
  const skill = (id: SkillId, remaining: number, summary: string, term?: string, charges?: number) => {
    if (!canUseSkill(id, p.equipment)) return;
    const recipe = resolveSkill(id, p.derived, p.character).recipe;
    const duration = 'duration' in recipe ? recipe.duration : recipe.kind === 'radial' ? recipe.shelter?.duration ?? remaining : remaining;
    add({ id, name: SKILL_DEFINITIONS[id].name, icon: id, color: SKILL_DEFINITIONS[id].color,
      remaining, duration: Math.max(remaining, duration), summary, term, charges });
  };
  const effects = p.skillEffects;
  if (effects?.ward && effects.ward.capacity > 0) skill('runicWard', effects.ward.remaining, `Absorbs ${Math.ceil(effects.ward.capacity)} damage.`, 'ward');
  for (const id of ['brace', 'rallyOfIron', 'ghostHunt'] as const) {
    const b = effects?.[id]; if (!b || id === 'ghostHunt' && b.charges <= 0) continue;
    const defense = b.reduction ? `${percent(b.reduction)} less hit damage.` : '';
    const offense = b.charges ? id === 'ghostHunt' ? `Next ${b.charges} arrow actions echo for ${percent(b.bonus)} damage.` : `Next ${b.charges} melee actions: +${percent(b.bonus)} damage.` : '';
    skill(id, b.remaining, [defense, offense].filter(Boolean).join(' '), b.reduction ? 'mitigation' : undefined, b.charges || undefined);
  }
  for (const [id, b] of Object.entries(effects?.shelters ?? {})) skill(id as SkillId, b.remaining, `${percent(b.reduction)} less hit damage.`, 'mitigation');
  if (p.guardTime > 0 && p.equipment.offHand?.kind === 'shield') skill('bulwark', p.guardTime, `Blocks ${percent(Math.max(p.guardReduction, p.derived.blockReduction))} of hit damage.`);
  for(const id of AURA_IDS)if(auraPower(p,id)>0){
    const rank=auraRank(p.character,id),aura=resolveAura(id,rank);
    add({id:`aura:${id}`,name:AURAS[id].name,icon:id,color:AURAS[id].color,remaining:1,duration:1,persistent:true,reservation:aura.reservation,
      summary:`Reserves ${aura.reservation}% mana. ${auraSummary(id,rank)}`,term:'reservation'});
  }
  const blood=p.auras?.blood;
  if(blood&&auraPower(p,'bloodOath'))add({id:'blood-oath-stacks',name:'Blood Oath buildup',icon:'bloodOath',color:AURAS.bloodOath.color,remaining:blood.remaining,duration:AURA_RULES.bloodDuration,charges:blood.stacks,
    summary:`+${Number((blood.stacks*auraPower(p,'bloodOath')).toFixed(1))}% melee damage against the same target. Switching targets resets it.`});
  const still=p.auras?.still??0;
  if(still>0&&auraPower(p,'stillwater'))add({id:'stillwater-focus',name:'Stillwater focus',icon:'stillwater',color:AURAS.stillwater.color,remaining:1,duration:1,persistent:true,progress:still/AURA_RULES.stillDuration,
    summary:`${Number((auraPower(p,'stillwater')*still/AURA_RULES.stillDuration).toFixed(1))}% less mana cost. Moving ends the focus.`});
  return buffs;
}
