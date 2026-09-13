import { groundEffectPulseCount, skillUtilityLabel, type SkillExecution } from './skill-execution-content.ts';
import type { SkillId } from './character-types.ts';
/** Numeric inspection facts use the selected, fully resolved execution recipe. */
export function skillMechanicFacts(id: SkillId, r: SkillExecution): string {
  const n = (v: number) => Number(v.toFixed(2));
  const parts: string[] = [];
  const utility = skillUtilityLabel(id, r); if (utility) parts.push(utility);
  if ('radius' in r && r.kind !== 'projectile' && r.kind !== 'dash') parts.push(`${n(r.radius)} radius`);
  if ('arc' in r) parts.push(`${Math.round(r.arc * 180 / Math.PI)}° arc`);
  if ('stun' in r && r.stun) parts.push(`${n(r.stun)}s ${id === 'iceNova' || id === 'absoluteZero' ? 'Frozen' : 'stun'}`);
  if ('slow' in r && r.slow && !(r.kind === 'radial' && r.shelter)) parts.push(`${n((1-r.slow.factor)*100)}% slow · ${n(r.slow.duration)}s`);
  if (r.kind === 'sweep') parts.push(`${n(r.reachMultiplier)}× weapon reach`);
  if (r.kind === 'dash') parts.push(`${n(r.speed * r.duration)} travel · ${n(r.radius)} contact radius`);
  if (r.kind === 'backstab') parts.push(`${r.targets ?? 1} targets · ${n(r.rearMultiplier)}× rear damage · ${n(r.minRange)} minimum reach`);
  if (r.kind === 'chain') parts.push(`${r.jumps} targets · ${n(r.falloff * 100)}% damage retained per jump`);
  if (r.kind === 'projectile') {
    const e = r.effects;
    if (r.offsets.length > 1) parts.push(`${r.offsets.length} projectiles`);
    if (e.pierce) parts.push(`Pierce ${e.pierce} extra targets`);
    if (e.chain) parts.push(`${e.chain} rebounds`);
    if (e.blastRadius) parts.push(`${n(e.blastRadius)} explosion radius`);
    if (e.slowDuration && e.slowFactor !== undefined) parts.push(`${n((1-e.slowFactor)*100)}% slow · ${n(e.slowDuration)}s`);
    if (e.burnDuration && e.burnDamageMultiplier) parts.push(`Burn: ${n(e.burnDamageMultiplier*100)}% hit damage / s · ${n(e.burnDuration)}s`);
    if (e.lifeSteal) parts.push(`Heal ${n(e.lifeSteal*100)}% of actual damage`);
    if (e.groundDuration) parts.push(`${n(e.groundDuration)}s ground fire`);
  }
  if (r.kind === 'ground') {
    if (r.scatter) parts.push(`${r.scatter} impacts`);
    else parts.push(`${groundEffectPulseCount(r)} waves${r.duration ? ` · ${n(r.duration)}s` : ''}`);
    if (r.scorch) parts.push(`${n(r.scorch.duration)}s ground fire · ${n(r.scorch.damageMultiplier*100)}% impact / s`);
  }
  return parts.join(' · ');
}
