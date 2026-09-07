import type { CombatEvent } from './model.ts';
import { SKILL_EXECUTION } from './skill-execution-content.ts';

export type SkillSoundFamily = 'steel' | 'shield' | 'earth' | 'arrow' | 'fire' | 'frost' | 'lightning' | 'spirit' | 'arcane';
export function skillSoundFamily(event: CombatEvent): SkillSoundFamily {
  if (event.skill === 'earthshatter') return 'earth';
  if (event.skill === 'shieldBash' || event.skill === 'bulwark') return 'shield';
  if (event.style) return event.style;
  const recipe = event.skill ? SKILL_EXECUTION[event.skill] : undefined;
  if (recipe?.kind === 'projectile') return recipe.effects.style;
  if (recipe && 'style' in recipe && recipe.style) return recipe.style;
  return event.skill ? 'steel' : 'arcane';
}
export const SKILL_SOUNDS = {
  steel: { start: 260, end: 90, noise: 2000, duration: .2 },
  shield: { start: 580, end: 130, noise: 3200, duration: .22 },
  earth: { start: 100, end: 32, noise: 430, duration: .45 },
  arrow: { start: 410, end: 160, noise: 4200, duration: .13 },
  fire: { start: 150, end: 44, noise: 750, duration: .38 },
  frost: { start: 1800, end: 690, noise: 6400, duration: .32 },
  lightning: { start: 130, end: 720, noise: 7500, duration: .12 },
  spirit: { start: 520, end: 850, noise: 1700, duration: .4 },
  arcane: { start: 340, end: 960, noise: 2800, duration: .25 },
} as const;
