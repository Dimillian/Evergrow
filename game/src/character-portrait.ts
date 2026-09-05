import type { Player } from './model.ts';
import { drawHumanoid, getPlayerSwordTip } from './art.ts';
import { playerPose } from './character-pose.ts';
import { outfitFromEquipment } from './item-art.ts';

/** Same layered rig and equipped appearance in the armory and character hall. */
export function drawCharacterPortrait(ctx: CanvasRenderingContext2D, player: Player, time: number, facing: number, width: number, height: number): void {
  const pose = playerPose(player, time, null, 0);
  pose.angle = facing; pose.attackAngle = facing; pose.moving = 0;
  pose.hitFlash = 0; pose.impact = 0; pose.cast = 0; pose.dodging = false; pose.dead = false;
  pose.outfit = outfitFromEquipment(player.character);
  ctx.clearRect(0, 0, width, height);
  ctx.save(); ctx.scale(width / 560, height / 720); ctx.translate(280, 500);
  const glow = ctx.createRadialGradient(0, -135, 10, 0, -135, 225);
  glow.addColorStop(0, '#83adc917'); glow.addColorStop(1, '#83adc900');
  ctx.fillStyle = glow; ctx.fillRect(-240, -430, 480, 540);
  ctx.fillStyle = '#02070cb0'; ctx.beginPath(); ctx.ellipse(0, 12, 77, 16, 0, 0, Math.PI * 2); ctx.fill();
  const tip = getPlayerSwordTip(pose);
  const scale = Math.min(6.8, 240 / Math.max(22, Math.abs(tip.x) + 6),
    460 / Math.max(50, -tip.y + 6), 160 / Math.max(20, tip.y + 6));
  ctx.scale(scale, scale); drawHumanoid(ctx, pose); ctx.restore();
}
