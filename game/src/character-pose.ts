import { tintedOutfit } from './appearance-armor.ts';
import { SKILL_DEFINITIONS, skillWeapon } from './skill-content.ts';
import { outfitFromEquipment } from './item-art.ts';
import type { CharacterPose } from './art.ts';
import type { Attack, Player } from './model.ts';
import { COMBAT_TIMING, PLAYER_ABILITIES } from './combat-content.ts';
import { getWeaponGrip } from './equipment.ts';

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

/** The rig, ribbon, sparks and moving light all receive the same player pose. */
export function playerPose(player: Player, time: number,
  attack: Attack | null = player.attack, elapsed = attack?.elapsed ?? 0): CharacterPose {
  const castProgress = player.castTime > 0 ? Math.max(0, Math.min(1, 1 - player.castTime / Math.max(.001, player.castDuration))) : 0;
  const castingWeapon = player.activeSkill && player.castTime > 0 ? skillWeapon(player.activeSkill, player.equipment) : null;
  const gesture: CharacterPose['gesture'] = player.castTime <= 0 ? undefined : player.activeSkill === 'earthshatter' ? 'slam'
    : (player.activeSkill === 'shieldBash' || player.activeSkill === 'repulse' || player.activeSkill === 'ironCitadel') ? 'bash' : (player.activeSkill === 'backstab' || player.activeSkill === 'nightReaping') || player.activeSkill === 'lunge' ? 'thrust' : undefined;
  const off = player.equipment.offHand;
  const offHand: CharacterPose['offHand'] = off?.kind === 'weapon'
    ? { kind: 'weapon', visual: attack?.hand === 'off' ? attack.weapon.visual : off.weapon.visual }
    : off?.kind === 'shield' ? { kind: 'shield', visual: off.shield.visual } : off?.kind === 'focus' ? { kind: 'focus', visual: off.focus.visual } : null;
  return {
    kind: 'player', appearance:player.character.look.appearance, outfit:tintedOutfit(outfitFromEquipment(player.character),player.character.look.armorTints,player.character.look.showHelmet), angle: player.castTime > 0 ? player.castAngle : player.angle,
    time, gaitPhase: player.walkTime, moveAngle: Math.atan2(player.vy, player.vx),
    moving: player.dash ? 1 : Math.min(1, Math.hypot(player.vx, player.vy) / 130),
    attack: attack ? elapsed / attack.duration : 0,
    attackAngle: attack?.angle ?? player.angle,
    attackKind: attack?.kind, attackHand: attack?.hand ?? (castingWeapon && castingWeapon === (off?.kind === 'weapon' ? off.weapon : null) ? 'off' : 'main'), gesture,
    weapon: attack?.hand === 'main' ? attack.weapon.visual : player.equipment.mainHand.visual,
    offHand, guard: Math.min(1, Math.max(player.guardTime,player.skillEffects?.brace?.remaining??0,player.skillEffects?.rallyOfIron?.remaining??0) / .2),
    castColor: player.activeSkill ? SKILL_DEFINITIONS[player.activeSkill].color : player.equipment.mainHand.visual.glow ?? '#c0acf0',
    grip: getWeaponGrip(player.equipment),
    attackStart: attack ? attack.activeStart / attack.duration : undefined,
    attackEnd: attack ? attack.activeEnd / attack.duration : undefined,
    attackArc: attack?.arc,
    // Instant actions begin at contact/release, then recover over their snapshotted cadence.
    cast: player.castTime > 0 ? 1 - smooth(castProgress) : 0,
    hitFlash: player.hitFlash, impact: Math.min(1, player.hitFlash / COMBAT_TIMING.hitFlashDuration), impactAngle: player.hitAngle,
    dodging: player.dodgeTime > 0, dodgeProgress: 1 - player.dodgeTime / PLAYER_ABILITIES.dodge.duration, dead: player.dead,
  };
}
