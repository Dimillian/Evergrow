import type { Projectile, WeaponLaunch } from './model.ts';
import type { CharacterPose } from './art-types.ts';
import { getPlayerSwordTip } from './character-motion.ts';
import { PROJECTILE_HEIGHT } from './ranged-aim.ts';

export const PROJECTILE_LAUNCH_BLEND = .18;
const tips = new WeakMap<WeaponLaunch, { x: number; y: number }>();
/** The release pose stays independent of later aim, movement or gear changes. */
export function weaponReleasePose(launch: WeaponLaunch): CharacterPose {
  return { kind: 'player', weapon: launch.hand === 'off' ? launch.mainWeapon : launch.weapon,
    offHand: launch.hand === 'off' ? { kind: 'weapon', visual: launch.weapon } : null, grip: launch.hands === 2 ? 'two-handed' : 'one-handed',
    angle: launch.facing, attackAngle: launch.facing, time: launch.time, gaitPhase: launch.gaitPhase,
    moving: launch.moving, moveAngle: launch.moveAngle, attack: launch.skill ? 0 : launch.start, cast: launch.skill ? 1 : 0, attackStart: launch.start,
    attackEnd: launch.end, attackKind: 'ranged', attackHand: launch.hand, hitFlash: 0, dodging: false };
}
export function weaponReleaseTip(launch: WeaponLaunch) {
  let tip = tips.get(launch);
  if (!tip) { tip = getPlayerSwordTip(weaponReleasePose(launch)); tips.set(launch, tip); }
  return tip;
}
/** Elevated launch art settles onto the established collision/aim plane; never redirects combat. */
export function projectilePresentation(shot: Projectile, alpha = 1) {
  const x = shot.prevX + (shot.x - shot.prevX) * alpha, y = shot.prevY + (shot.y - shot.prevY) * alpha - PROJECTILE_HEIGHT;
  const age = Math.max(0, shot.maxLife - shot.life), launch = shot.launch;
  if (!launch || age >= PROJECTILE_LAUNCH_BLEND) return { x, y };
  const tip = weaponReleaseTip(launch);
  const t = age / PROJECTILE_LAUNCH_BLEND, blend = (1 - t) ** 2;
  return { x: x + tip.x * blend, y: y + (tip.y + PROJECTILE_HEIGHT) * blend };
}
