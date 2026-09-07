import type { GroundEffect, Player } from './model.ts';
import type { SkillId } from './character-types.ts';

/** Read-only active duration; cooldown and maintained-effect lifetime are independent. */
export function skillSustain(skill: SkillId | null, p: Player, effects: readonly GroundEffect[]) {
  if (p.dead) return null;
  if (skill === 'bulwark' && p.guardTime > 0 && p.equipment.offHand?.kind === 'shield')
    return { remaining: p.guardTime, upkeep: 0 };
  if (skill === 'tempest') {
    const storms = effects.filter(e => e.kind === 'storm');
    if (storms.length) return { remaining: Math.max(...storms.map(e => Math.max(0, e.delay) + Math.max(0, e.duration))),
      upkeep: storms.reduce((sum,e) => sum + (e.upkeep ?? 0), 0) };
  }
  return null;
}
