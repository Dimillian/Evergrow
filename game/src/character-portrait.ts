import type { Player } from './model.ts';
import { drawHumanoid } from './art.ts';
import { characterBounds, fitCharacter } from './character-framing.ts';
import { playerPose } from './character-pose.ts';
import { outfitFromEquipment } from './item-art.ts';

/** Same layered rig and equipped appearance in the armory and character hall. */
export function drawCharacterPortrait(ctx: CanvasRenderingContext2D, player: Player, time: number, facing: number, width: number, height: number): void {
  const pose = playerPose(player, time, null, 0);
  pose.angle = facing; pose.attackAngle = facing; pose.moving = 0;
  pose.hitFlash = 0; pose.impact = 0; pose.cast = 0; pose.dodging = false; pose.dead = false;
  pose.outfit = outfitFromEquipment(player.character);
  ctx.clearRect(0, 0, width, height);
  // Fit a neutral pose, so breathing never makes the whole portrait pump in size.
  const fit = fitCharacter(characterBounds({ ...pose, time: 0, gaitPhase: 0, attack: 0 }), width, height);
  ctx.save(); ctx.translate(fit.x, fit.y); ctx.scale(fit.scale, fit.scale);
  const glow = ctx.createRadialGradient(0, -28, 2, 0, -28, 40);
  glow.addColorStop(0, '#83adc917'); glow.addColorStop(1, '#83adc900');
  ctx.fillStyle = glow; ctx.fillRect(-45, -75, 90, 95);
  ctx.fillStyle = '#02070cb0'; ctx.beginPath(); ctx.ellipse(0, 2, 13, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  drawHumanoid(ctx, pose); ctx.restore();
}
