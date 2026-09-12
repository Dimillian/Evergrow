import type { SkillExecution } from './skill-execution-content.ts';
import type { TouchTargeting } from './touch-input.ts';

/** Presentation classification follows the resolved recipe, including specializations. */
export function touchTargeting(recipe: SkillExecution): TouchTargeting {
  switch (recipe.kind) {
    case 'ground': return recipe.follow || recipe.effect === 'frost' ? 'self' : 'ground';
    case 'ward': case 'stance': case 'guard': case 'radial': return 'self';
    case 'sweep': case 'cone': case 'backstab': return recipe.arc >= Math.PI * 1.9 ? 'self' : 'direction';
    case 'step':
    case 'dash': case 'projectile': case 'chain': return 'direction';
  }
}
