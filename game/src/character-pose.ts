import type { CharacterPose } from './art.ts';
import type { Attack, Player } from './model.ts';
import { COMBAT_TIMING, PLAYER_ABILITIES } from './combat-content.ts';
import { getWeaponGrip } from './equipment.ts';

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

/** The rig, ribbon, sparks and moving light all receive the same player pose. */
export function playerPose(player: Player, time: number,
  attack: Attack | null = player.attack, elapsed = attack?.elapsed ?? 0): CharacterPose {
  const castProgress = player.castTime > 0 ? Math.max(0, Math.min(1, 1 - player.castTime / PLAYER_ABILITIES.ember.duration)) : 0;
  return {
    kind: 'player', angle: player.castTime > 0 ? player.castAngle : player.angle,
    time, gaitPhase: player.walkTime, moveAngle: Math.atan2(player.vy, player.vx),
    moving: Math.min(1, Math.hypot(player.vx, player.vy) / 130),
    attack: attack ? elapsed / attack.duration : 0,
    attackAngle: attack?.angle ?? player.angle, weapon: player.equipment.mainHand.visual,
    grip: getWeaponGrip(player.equipment),
    attackStart: attack ? attack.activeStart / attack.duration : undefined,
    attackEnd: attack ? attack.activeEnd / attack.duration : undefined,
    attackArc: attack?.arc,
    cast: smooth(castProgress / .3) * (1 - smooth((castProgress - .6) / .4)),
    hitFlash: player.hitFlash, impact: Math.min(1, player.hitFlash / COMBAT_TIMING.hitFlashDuration), impactAngle: player.hitAngle,
    dodging: player.dodgeTime > 0, dodgeProgress: 1 - player.dodgeTime / PLAYER_ABILITIES.dodge.duration, dead: player.dead,
  };
}
