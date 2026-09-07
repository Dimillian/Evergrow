import type { CharacterPose } from './art-types.ts';
import type { WeaponVisual } from './model.ts';
import { playerMotion, characterTransform, PLAYER_ART_SCALE } from './character-motion.ts';
import { projectArmPoint } from './player-arm-rig.ts';
import { transformPoint, type Point } from './art-primitives.ts';
import { weaponArtLength } from './weapon-shapes.ts';
import { focusGlowCenter } from './focus-shapes.ts';
import { ELEMENT_COLORS } from './elemental-weapon.ts';

/** At most two emitters, attached to the same projected rig as the held geometry. */
export function heldEquipmentLights(pose: CharacterPose, x: number, y: number) {
  if (pose.dead) return [];
  const motion = playerMotion(pose), time = pose.effectTime ?? pose.time;
  const project = (local: Point) => {
    const body = transformPoint(motion.body, local);
    const p = transformPoint(characterTransform(pose), [body[0] * PLAYER_ART_SCALE, body[1] * PLAYER_ART_SCALE]);
    return { x: x + p[0], y: y + p[1] };
  };
  const lights: Array<{ x: number; y: number; radius: number; power: number; color: string; shadows: boolean; core: number; fire: boolean }> = [];
  const weapon = (v: WeaponVisual | undefined, origin: Point, angle: number, scale: number) => {
    const color = v?.element && ELEMENT_COLORS[v.element];
    if (!v || !color || v.kind === 'bow' || v.kind === 'unarmed') return;
    const caster = v.kind === 'staff' || v.kind === 'wand';
    const length = (weaponArtLength(v) * (caster ? 1 : .72) - (caster ? 1 : 0)) * scale;
    const center: Point = [origin[0] + Math.cos(angle) * length, origin[1] + Math.sin(angle) * length];
    const pulse = 1 + Math.sin(time * 2.2) * .035 + (v.element === 'fire' ? Math.sin(time * 7.1) * .025 : 0);
    lights.push({ ...project(center), color, radius: (v.kind === 'staff' ? 155 : caster ? 115 : 92) * pulse,
      core: v.kind === 'staff' ? 2.4 : caster ? 1.6 : 0, fire: v.element === 'fire',
      power: (caster ? .68 : .4) * pulse + (pose.cast ?? 0) * .2, shadows: true });
  };
  weapon(pose.weapon, motion.weaponOrigin, motion.weaponAngle, motion.weaponScale);
  if (pose.offHand?.kind === 'weapon') weapon(pose.offHand.visual, motion.offWeaponOrigin, motion.offWeaponAngle, motion.offWeaponScale);
  if (pose.offHand?.kind === 'focus') {
    const v = pose.offHand.visual, hand = projectArmPoint(motion.offArm.hand), center = focusGlowCenter(v, time);
    lights.push({ ...project([hand[0] + center[0], hand[1] + center[1]]), color: v.glow,
      core: v.kind === 'orb' ? 3 : .8, fire: v.motif === 'ember',
      radius: v.kind === 'orb' ? 128 : 78, power: (v.kind === 'orb' ? .57 : .3) * (1 + Math.sin(time * 1.6) * .045), shadows: true });
  }
  return lights;
}
