import type { Enemy, ProjectileStyle } from './model.ts';
import { isBossKind } from './wilderness-boss-content.ts';

export type ElementalReactionType = 'melt' | 'overload' | 'superconduct' | 'singularity' | 'combustion';

export interface ReactionResolution {
  readonly type: ElementalReactionType;
  readonly damageMultiplier: number;
  readonly message: string;
  readonly color: string;
  readonly radius?: number;
  readonly pullRadius?: number;
  readonly trueDamage?: boolean;
}

export const ELEMENTAL_REACTION_RULES = Object.freeze({
  meltMultiplier: 1.6,
  meltBossMultiplier: 1.3,
  overloadRadius: 140,
  overloadBaseDamageFraction: 0.5,
  superconductDuration: 3.0,
  superconductArmorShred: 0.20,
  superconductStaggerBonus: 0.25,
  singularityRadius: 180,
  singularityMultiplier: 1.45,
  singularityStaggerDuration: 1.2,
  combustionRadius: 120,
  combustionMultiplier: 1.5,
  normalIcd: 0.4,
  bossIcd: 2.5,
});

export function resolveElementalReaction(
  enemy: Enemy,
  incomingElement: ProjectileStyle | undefined,
  damage: number
): ReactionResolution | null {
  if (!incomingElement || enemy.state === 'dead' || damage <= 0) return null;
  if ((enemy.reactionCooldown ?? 0) > 0) return null;

  const isBoss = isBossKind(enemy.kind);
  const hasFrost = ((enemy.chillTime ?? 0) > 0) || ((enemy.freezeTime ?? 0) > 0);
  const hasFire = enemy.burnTime > 0 && enemy.burnDps > 0;

  // 1. Melt: Fire strikes Frost
  if (incomingElement === 'fire' && hasFrost) {
    enemy.reactionCooldown = isBoss ? ELEMENTAL_REACTION_RULES.bossIcd : ELEMENTAL_REACTION_RULES.normalIcd;
    // Melt consumes or significantly shortens the remaining frost
    if ((enemy.chillTime ?? 0) > 0) enemy.chillTime = Math.max(0, (enemy.chillTime ?? 0) * 0.35);
    if (enemy.slowTime > 0) enemy.slowTime = Math.max(0, enemy.slowTime * 0.35);
    if ((enemy.freezeTime ?? 0) > 0) enemy.freezeTime = Math.max(0, (enemy.freezeTime ?? 0) * 0.35);

    return {
      type: 'melt',
      damageMultiplier: isBoss ? ELEMENTAL_REACTION_RULES.meltBossMultiplier : ELEMENTAL_REACTION_RULES.meltMultiplier,
      message: 'MELT',
      color: '#ffd177',
    };
  }

  // 2. Overload: Lightning strikes a Burning target
  if (incomingElement === 'lightning' && hasFire) {
    enemy.reactionCooldown = isBoss ? ELEMENTAL_REACTION_RULES.bossIcd : ELEMENTAL_REACTION_RULES.normalIcd;
    // Overload consumes burn
    if (enemy.burnTime > 0) {
      enemy.burnTime = 0;
      enemy.burnDps = 0;
      enemy.burnTick = 0;
    }

    return {
      type: 'overload',
      damageMultiplier: 1.25,
      message: 'OVERLOAD',
      color: '#ff77aa',
      radius: ELEMENTAL_REACTION_RULES.overloadRadius,
    };
  }

  // 3. Superconduct: Lightning strikes a Frost-affected target
  if (incomingElement === 'lightning' && hasFrost) {
    enemy.reactionCooldown = isBoss ? ELEMENTAL_REACTION_RULES.bossIcd : ELEMENTAL_REACTION_RULES.normalIcd;
    // Apply fracture debuff and extend stagger
    (enemy.statusDurations ??= {}).fracture = ELEMENTAL_REACTION_RULES.superconductDuration;
    enemy.fractureTime = Math.max(enemy.fractureTime ?? 0, ELEMENTAL_REACTION_RULES.superconductDuration);
    enemy.stagger = Math.max(enemy.stagger, enemy.stagger + ELEMENTAL_REACTION_RULES.superconductStaggerBonus);

    return {
      type: 'superconduct',
      damageMultiplier: 1.15,
      message: 'SUPERCONDUCT',
      color: '#b0d5ff',
    };
  }

  // 4. Singularity / Gravitational Collapse: Arcane strikes Frost/Lightning, or Lightning strikes Arcane
  const hasArcaneExposure = (enemy.auraExposure?.arcane?.remaining ?? 0) > 0;
  const hasLightningExposure = (enemy.auraExposure?.lightning?.remaining ?? 0) > 0;
  if (((incomingElement === 'arcane' || incomingElement === 'spirit') && (hasFrost || hasLightningExposure))
    || (incomingElement === 'lightning' && hasArcaneExposure)) {
    enemy.reactionCooldown = isBoss ? ELEMENTAL_REACTION_RULES.bossIcd : ELEMENTAL_REACTION_RULES.normalIcd;
    if ((enemy.chillTime ?? 0) > 0) enemy.chillTime = Math.max(0, (enemy.chillTime ?? 0) * 0.5);
    if ((enemy.freezeTime ?? 0) > 0) enemy.freezeTime = Math.max(0, (enemy.freezeTime ?? 0) * 0.5);

    return {
      type: 'singularity',
      damageMultiplier: isBoss ? 1.25 : ELEMENTAL_REACTION_RULES.singularityMultiplier,
      message: 'SINGULARITY',
      color: '#c578ff',
      pullRadius: ELEMENTAL_REACTION_RULES.singularityRadius,
    };
  }

  // 5. Combustion / Voidfire: Arcane strikes Burning targets, or Fire strikes Arcane
  if (((incomingElement === 'arcane' || incomingElement === 'spirit') && hasFire)
    || (incomingElement === 'fire' && hasArcaneExposure)) {
    enemy.reactionCooldown = isBoss ? ELEMENTAL_REACTION_RULES.bossIcd : ELEMENTAL_REACTION_RULES.normalIcd;
    if (enemy.burnTime > 0) {
      enemy.burnTime = 0;
      enemy.burnDps = 0;
      enemy.burnTick = 0;
    }

    return {
      type: 'combustion',
      damageMultiplier: isBoss ? 1.3 : ELEMENTAL_REACTION_RULES.combustionMultiplier,
      message: 'COMBUSTION',
      color: '#ff4d79',
      radius: ELEMENTAL_REACTION_RULES.combustionRadius,
      trueDamage: true,
    };
  }

  return null;
}
