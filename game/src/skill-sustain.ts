import type { GroundEffect, Player } from './model.ts';
import type { SkillId } from './character-types.ts';

/** Read-only active duration; cooldown and maintained-effect lifetime are independent. */
export function skillSustain(skill: SkillId | null, p: Player, effects: readonly GroundEffect[]) {
  if (p.dead || !skill) return null;
  const shelter=p.skillEffects?.shelters?.[skill];if(shelter)return{remaining:shelter.remaining,upkeep:0};
  if(skill==='runicWard'&&p.skillEffects?.ward)return{remaining:p.skillEffects.ward.remaining,upkeep:0};
  if(skill==='brace'||skill==='rallyOfIron'||skill==='ghostHunt'){const b=p.skillEffects?.[skill];if(b)return{remaining:b.remaining,upkeep:0};}
  if (skill === 'bulwark' && p.guardTime > 0 && p.equipment.offHand?.kind === 'shield')
    return { remaining: p.guardTime, upkeep: 0 };
  if (skill === 'tempest') {
    const storms = effects.filter(e => e.kind === 'storm');
    if (storms.length) return { remaining: Math.max(...storms.map(e => Math.max(0, e.delay) + Math.max(0, e.duration))),
      upkeep: storms.reduce((sum,e) => sum + (e.upkeep ?? 0), 0) };
  }
  return null;
}
