import type { SkillExecution } from './skill-execution-content.ts';
import type { TouchTargeting } from './touch-input.ts';

/** Presentation classification follows the resolved recipe, including specializations. */
export function touchTargeting(recipe: SkillExecution): TouchTargeting {
  switch (recipe.kind) {
    case 'ground': return 'ground';
    case 'guard': case 'radial': return 'self';
    case 'sweep': return recipe.arc >= Math.PI * 1.9 ? 'self' : 'direction';
    case 'dash': case 'cone': case 'backstab': case 'projectile': case 'chain': return 'direction';
  }
}
