import type { CharacterPose } from './art-types.ts';
import { clamp, mixColor, type Color } from './art-primitives.ts';
import { characterTransform, PLAYER_ART_SCALE } from './character-motion.ts';
import { player } from './player-art.ts';
import { stalker, brute, caster, hound, archer, wisp } from './enemy-art.ts';

// Public art entry point: callers need not depend on individual drawing layers.
export type { Sprite, ArmorMaterial, ArmorPiece, CloakPiece, CharacterOutfit, CharacterPose } from './art-types.ts';
export { STARTER_OUTFIT } from './equipment-art.ts';
export { PLAYER_ART_SCALE, PLAYER_ATTACHMENTS, getSwingAngle, getPlayerArmRig, getPlayerSwordTip } from './character-motion.ts';
export { ArtLibrary } from './prop-art.ts';

// Adding an enemy kind must provide its drawing explicitly instead of silently
// falling through to another creature's artwork.
const enemies: Record<Exclude<CharacterPose['kind'], 'player'>,
  (ctx: CanvasRenderingContext2D, pose: CharacterPose, color: Color) => void> = { stalker, brute, caster, hound, archer, wisp };

/** Draw an articulated figure around (0, 0), its ground-contact point. */
export function drawHumanoid(ctx: CanvasRenderingContext2D, pose: CharacterPose): void {
  ctx.save();
  const flash = Math.pow(clamp(pose.hitFlash / 0.16), 3.2) * 0.97;
  const color: Color = flash > 0 ? (value) => mixColor(value, '#fff3d9', flash) : (value) => value;
  if (pose.dead) ctx.globalAlpha *= 0.6;
  ctx.transform(...characterTransform(pose));
  if (pose.kind === 'player') {
    ctx.scale(PLAYER_ART_SCALE, PLAYER_ART_SCALE);
    player(ctx, pose, color);
  }
  else enemies[pose.kind](ctx, pose, color);
  ctx.restore();
}
