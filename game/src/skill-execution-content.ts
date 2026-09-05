import type { SkillId } from './character-types.ts';
import type { ProjectileEffects, ProjectileStyle } from './model.ts';
import type { SlowEffect } from './combat-status.ts';

export type SkillExecution = Readonly<
  | { kind: 'sweep'; reachMultiplier: number; arc: number; blast: boolean }
  | { kind: 'dash'; duration: number; speed: number; radius: number }
  | { kind: 'radial'; radius: number; melee: boolean; stun?: number; slow?: SlowEffect; style?: ProjectileStyle }
  | { kind: 'cone'; radius: number; arc: number; stun: number }
  | { kind: 'guard'; duration: number; reduction: number }
  | { kind: 'backstab'; minRange: number; reachMultiplier: number; arc: number; rearAngle: number; rearMultiplier: number }
  | { kind: 'projectile'; speed: number; radius: number; offsets: readonly number[];
      effects: Readonly<Omit<ProjectileEffects, 'burnDps'> & { burnDamageMultiplier?: number }> }
  | { kind: 'ground'; effect: 'meteor' | 'arrowRain'; radius: number; delay: number; duration: number; interval: number;
      style: ProjectileStyle; burn?: { readonly duration: number; readonly damageMultiplier: number } }
  | { kind: 'chain'; jumps: number; range: number; falloff: number; duration: number; style: ProjectileStyle }>;

export const GROUND_EFFECT_RULES = Object.freeze({ maximum: 16, minimumInterval: .05 });
export function groundEffectPulseCount(effect: { duration: number; interval: number }): number {
  return Math.max(1, Math.ceil(effect.duration / Math.max(GROUND_EFFECT_RULES.minimumInterval, effect.interval)));
}

export const SKILL_TARGETING = Object.freeze({ maximumRange: 900, probeStep: 4, probeRadius: 1,
  minimumProjectileLife: .1, blastDuration: .45 });

/** Execution tuning is content. Handlers operate on these recipes, never skill-name branches. */
export const SKILL_EXECUTION = {
  cleave: { kind: 'sweep', reachMultiplier: 1.4, arc: Math.PI * 1.4, blast: false },
  whirlwind: { kind: 'sweep', reachMultiplier: 1.25, arc: Math.PI * 2, blast: true },
  lunge: { kind: 'dash', duration: .24, speed: 520, radius: 23 },
  earthshatter: { kind: 'radial', radius: 125, melee: true, stun: 1.2 },
  shieldBash: { kind: 'cone', radius: 68, arc: Math.PI * .7, stun: 1.1 },
  bulwark: { kind: 'guard', duration: 3, reduction: .75 },
  backstab: { kind: 'backstab', minRange: 48, reachMultiplier: 1.25, arc: Math.PI / 2, rearAngle: Math.PI * .6, rearMultiplier: 2 },
  volley: { kind: 'projectile', speed: 550, radius: 3, offsets: [-.23, 0, .23], effects: { style: 'arrow' } },
  piercingShot: { kind: 'projectile', speed: 680, radius: 3, offsets: [0], effects: { style: 'arrow', pierce: 3 } },
  ricochet: { kind: 'projectile', speed: 530, radius: 3, offsets: [0], effects: { style: 'arrow', chain: 3, chainRange: 150 } },
  rainOfArrows: { kind: 'ground', effect: 'arrowRain', radius: 92, delay: .4, duration: 1.2, interval: .3, style: 'arrow' },
  fireball: { kind: 'projectile', speed: 320, radius: 5, offsets: [0], effects: { style: 'fire', blastRadius: 85, burnDuration: 3, burnDamageMultiplier: .12 } },
  frostLance: { kind: 'projectile', speed: 440, radius: 5, offsets: [0], effects: { style: 'frost', pierce: 3, slowFactor: .5, slowDuration: 2.5 } },
  siphon: { kind: 'projectile', speed: 350, radius: 5, offsets: [0], effects: { style: 'spirit', lifeSteal: .35 } },
  iceNova: { kind: 'radial', radius: 115, melee: false, slow: { duration: 2.5, factor: .5 }, style: 'frost' },
  meteor: { kind: 'ground', effect: 'meteor', radius: 125, delay: .85, duration: 0, interval: 1, style: 'fire', burn: { duration: 3, damageMultiplier: .12 } },
  arcLightning: { kind: 'chain', jumps: 5, range: 145, falloff: .78, duration: .28, style: 'lightning' },
} as const satisfies Record<SkillId, SkillExecution>;

function freeze(value: object): void {
  Object.freeze(value);
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
}
freeze(SKILL_EXECUTION);

/** Numeric UI labels read the same recipe as execution. */
export function skillDamageSuffix(id: SkillId): string {
  const recipe = SKILL_EXECUTION[id];
  if (recipe.kind === 'projectile' && recipe.effects.style === 'arrow' && recipe.offsets.length > 1) return ' / arrow';
  if (recipe.kind === 'ground' && groundEffectPulseCount(recipe) > 1) return ' / wave';
  return '';
}
export function skillUtilityLabel(id: SkillId): string {
  const recipe = SKILL_EXECUTION[id];
  return recipe.kind === 'guard' ? `${recipe.duration}s guard` : '';
}
