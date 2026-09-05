import type { CharacterPose } from './art.ts';
import type { Attack, Player } from './model.ts';
import { HIT_FLASH_DURATION } from './simulation.ts';

/** The rig, ribbon, sparks and moving light all receive the same player pose. */
export function playerPose(player: Player, time: number,
  attack: Attack | null = player.attack, elapsed = attack?.elapsed ?? 0): CharacterPose {
  return {
    kind: 'player', angle: player.castTime > 0 ? player.castAngle : player.angle,
    time, gaitPhase: player.walkTime, moveAngle: Math.atan2(player.vy, player.vx),
    moving: Math.min(1, Math.hypot(player.vx, player.vy) / 130),
    attack: attack ? elapsed / attack.duration : 0,
    attackAngle: attack?.angle ?? player.angle, weapon: player.equipment.mainHand.visual,
    attackStart: attack ? attack.activeStart / attack.duration : undefined,
    attackEnd: attack ? attack.activeEnd / attack.duration : undefined,
    attackArc: attack?.arc,
    cast: player.castTime > 0 ? Math.min(1, (.22 - player.castTime) / .075) : 0,
    hitFlash: player.hitFlash, impact: Math.min(1, player.hitFlash / HIT_FLASH_DURATION), impactAngle: player.hitAngle,
    dodging: player.dodgeTime > 0, dodgeProgress: 1 - player.dodgeTime / .22, dead: player.dead,
  };
}
