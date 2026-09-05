import type { CharacterPose } from './art-types.ts';
import { getSwingAngle, WEAPON_REST_ANGLE } from './character-motion.ts';
import { TAU, clamp, smooth, polygon, line, taper, type Color, type Point } from './art-primitives.ts';

function boot(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, color: Color): void {
  polygon(ctx, [[x - width, y - 6], [x + width - 0.5, y - 6], [x + width + 1, y], [x - width, y + 1]], color('#141e20'));
  line(ctx, [[x - width + 1, y - 5], [x - width + 1, y - 1]], color('#53605a'), 0.8);
}

export function stalker(ctx: CanvasRenderingContext2D, pose: CharacterPose, color: Color): void {
  const step = Math.sin(pose.gaitPhase ?? pose.time * 9) * clamp(pose.moving);
  const pulse = Math.sin(clamp(pose.attack) * Math.PI);
  const windup = pose.attack < 0 ? smooth(-pose.attack) : pose.attack > 0 ? 1 - smooth(pose.attack / 0.25) : 0;
  const faceX = Math.cos(pose.angle) * 2;
  const faceY = Math.sin(pose.angle);
  const bodyY = -18 + Math.abs(step) * 0.8 + windup * 3 - pulse;
  const shoulder: Point = [faceX, bodyY - 4];
  for (const side of [-1, 1]) {
    const ankle: Point = [side * 6.5, -1 + step * side * 2];
    const knee: Point = [side * 8, -8 - step * side];
    taper(ctx, [side * 3, -14], knee, 4.2, 2.8, color('#454c3d'));
    taper(ctx, knee, ankle, 2.9, 1.9, color('#9d9b7b'));
    polygon(ctx, [[ankle[0] - 1.5, ankle[1] - 1], [ankle[0] + 2, ankle[1] - 1], [ankle[0] + side * 3, ankle[1] + 2], [ankle[0] - 1, ankle[1] + 2]], color('#8a9074'));
  }
  polygon(ctx, [[-5, -13], [-9, bodyY - 2], [-5, bodyY - 8], [2, bodyY - 9], [8, bodyY - 3], [5, -12], [1, -9]], color('#323e34'));
  polygon(ctx, [[-6, bodyY - 3], [-4, bodyY - 7], [2, bodyY - 7], [5, bodyY - 2], [3, -13], [-1, -12]], color('#777f64'));
  for (let rib = 0; rib < 3; rib += 1) {
    const y = bodyY - 2 + rib * 2.4;
    line(ctx, [[-5 + rib, y - 1], [0, y + 1], [4 - rib * 0.5, y - 0.5]], color('#a9a78a'), 1);
  }
  for (const side of [-1, 1]) {
    const reach = pulse * 6;
    const elbow: Point = [side * (11 + reach * 0.3 + windup * 2), bodyY + 5 - windup * 6];
    const hand: Point = [side * (10 + reach - windup * 3) + Math.cos(pose.attackAngle) * pulse * 8,
      -3 + Math.sin(pose.attackAngle) * pulse * 9 - windup * 15];
    taper(ctx, [shoulder[0] + side * 5, shoulder[1]], elbow, 4.2, 2.8, color('#8e9579'));
    taper(ctx, elbow, hand, 2.7, 1.6, color('#b5b090'));
    for (let claw = 0; claw < 2; claw += 1) {
      taper(ctx, [hand[0] + claw * 1.8, hand[1]], [hand[0] + side * (2 + claw), hand[1] + 4 - claw], 0.9, 0.3, color('#cbc09a'));
    }
  }
  const headY = bodyY - 6 + faceY;
  polygon(ctx, [[faceX - 5, headY - 6], [faceX + 2, headY - 8], [faceX + 6, headY - 3], [faceX + 4, headY + 3], [faceX, headY + 5], [faceX - 4, headY + 1]], color('#b0ac8c'));
  polygon(ctx, [[faceX - 5, headY - 6], [faceX - 1, headY - 5], [faceX, headY + 5], [faceX - 4, headY + 1]], color('#727b65'));
  ctx.fillStyle = color('#27342d');
  ctx.fillRect(faceX - 2.5, headY - 1.5, 2, 2);
  ctx.fillRect(faceX + 1.7, headY - 1.5, 2, 2);
  ctx.fillStyle = color(windup > 0.65 ? '#ffe798' : '#ddc769');
  ctx.fillRect(faceX - 1.5, headY - 1, 1, 1);
  ctx.fillRect(faceX + 2, headY - 1, 1, 1);
}

export function brute(ctx: CanvasRenderingContext2D, pose: CharacterPose, color: Color): void {
  const step = Math.sin(pose.gaitPhase ?? pose.time * 6) * clamp(pose.moving);
  const windup = pose.attack < 0 ? smooth(-pose.attack) : pose.attack > 0 ? 1 - smooth(pose.attack / 0.35) : 0;
  const pulse = Math.sin(clamp(pose.attack) * Math.PI);
  const bob = Math.abs(step) * 0.8 + windup * 2.5 - pulse * 1.7;
  const facingX = Math.cos(pose.angle);
  boot(ctx, -6.5, -step * 2, 3.8, color);
  boot(ctx, 6.5, step * 2, 3.8, color);
  taper(ctx, [-6, -16], [-6.5, -4 - step * 2], 7, 5.2, color('#605d46'));
  taper(ctx, [6, -16], [6.5, -4 + step * 2], 7, 5.2, color('#454d3d'));
  polygon(ctx, [[-10, -27 + bob], [-15, -22 + bob], [-11, -10], [-5, -8], [7, -9], [13, -16], [12, -26 + bob], [5, -32 + bob], [-4, -32 + bob]], color('#4b4a38'));
  polygon(ctx, [[-7, -28 + bob], [5, -29 + bob], [9, -23 + bob], [8, -14], [-4, -12], [-9, -20]], color('#767258'));
  polygon(ctx, [[-9, -23 + bob], [5, -25 + bob], [8, -19], [-5, -17]], color('#5b3d37'));
  line(ctx, [[-9, -12], [8, -13]], color('#302e28'), 3);
  ctx.fillStyle = color('#928466');
  ctx.fillRect(-1, -14, 3, 3);
  for (const side of [-1, 1]) {
    const elbow: Point = [side * (17 + windup), -17 + bob - windup * 8];
    const hand: Point = [side * (16 + pulse * 5 - windup * 3) + Math.cos(pose.attackAngle) * pulse * 5,
      -8 - pulse * 8 - windup * 19 + Math.sin(pose.attackAngle) * pulse * 5];
    taper(ctx, [side * 10, -26 + bob], elbow, 8, 6.5, color('#64674f'));
    taper(ctx, elbow, hand, 6, 4.8, color('#8f8c6a'));
    polygon(ctx, [[side * 8, -30 + bob], [side * 14, -29 + bob], [side * 17, -24 + bob], [side * 14, -20 + bob], [side * 8, -23 + bob]], color('#333e38'));
    line(ctx, [[side * 9, -28 + bob], [side * 14, -27 + bob], [side * 16, -24 + bob]], color('#8e9177'), 1.1);
    if (side === (facingX >= 0 ? 1 : -1)) {
      const restAngle = pose.angle + WEAPON_REST_ANGLE;
      const readyAngle = pose.attackAngle - 1.25;
      const angle = pose.attack > 0
        ? getSwingAngle(pose.attackAngle, 0.2 + clamp(pose.attack) * 0.8, 0.2, 0.58, 2.5)
        : restAngle + Math.atan2(Math.sin(readyAngle - restAngle), Math.cos(readyAngle - restAngle)) * windup;
      ctx.save();
      ctx.translate(hand[0], hand[1]);
      ctx.rotate(angle);
      taper(ctx, [-3, 0], [20, 0], 3.8, 3, color('#6d583b'));
      polygon(ctx, [[13, -4], [22, -5], [27, -2], [26, 3], [21, 5], [13, 3]], color('#707768'));
      polygon(ctx, [[13, -4], [22, -5], [25, -2], [14, -1]], color('#a8aa8e'));
      ctx.restore();
    }
  }
  const headX = facingX * 1.8;
  polygon(ctx, [[headX - 6, -32 + bob], [headX - 4, -38 + bob], [headX + 3, -39 + bob], [headX + 7, -34 + bob], [headX + 5, -27 + bob], [headX - 3, -27 + bob]], color('#a3a180'));
  polygon(ctx, [[headX - 6, -32 + bob], [headX - 4, -38 + bob], [headX, -38 + bob], [headX - 1, -28 + bob], [headX - 3, -27 + bob]], color('#797f65'));
  line(ctx, [[headX - 3.5, -32 + bob], [headX + 4, -32 + bob]], color('#29352e'), 2);
  line(ctx, [[headX - 2, -28 + bob], [headX + 2, -28 + bob]], color('#4c503e'), 1);
}

export function caster(ctx: CanvasRenderingContext2D, pose: CharacterPose, color: Color): void {
  const moving = clamp(pose.moving);
  const sway = Math.sin(pose.time * 4) * (0.6 + moving);
  const bob = Math.sin(pose.time * 3) * 0.55;
  const windup = pose.attack < 0 ? smooth(-pose.attack) : 0;
  const attack = pose.attack < 0 ? windup : pose.attack > 0 ? 1 - smooth(pose.attack) : 0;
  const side = Math.cos(pose.angle) >= 0 ? 1 : -1;
  const headX = Math.cos(pose.angle) * 1.3;
  polygon(ctx, [[-5, -26 + bob], [5, -26 + bob], [8, -17], [9 + sway, -3], [5, -1], [1, -3], [-4, 0], [-8 + sway, -2], [-8, -14]], color('#162e32'));
  polygon(ctx, [[-4, -24 + bob], [2, -26 + bob], [4, -14], [5 + sway * 0.5, -3], [0, -5], [-4, -3], [-6, -14]], color('#28666a'));
  polygon(ctx, [[-3, -21 + bob], [-1, -22 + bob], [-1, -7], [-4, -4]], color('#54a08b'));
  line(ctx, [[-5, -4], [0, -6], [5, -4]], color('#84846a'), 0.9);
  const staffHand: Point = [side * 10.5, -17 - attack * 2];
  taper(ctx, [side * 4, -24 + bob], [side * 8, -17], 5.5, 4, color('#314a4b'));
  taper(ctx, [side * 8, -17], staffHand, 3.5, 2, color('#a2a589'));
  const release = pose.attack > 0 ? Math.sin(clamp(pose.attack) * Math.PI) : 0;
  const castingHand: Point = [-side * (9 + attack * 4) + Math.cos(pose.attackAngle) * release * 9,
    -17 - attack * 9 + Math.sin(pose.attackAngle) * release * 8];
  taper(ctx, [-side * 4, -23 + bob], [-side * 9, -19 - attack * 4], 5.5, 4, color('#395757'));
  taper(ctx, [-side * 9, -19 - attack * 4], castingHand, 3, 2, color('#b0ae90'));
  taper(ctx, [side * 11, -1], [side * 11.7, -35], 2, 1.4, color('#7c7050'));
  line(ctx, [[side * 11.7, -30], [side * 8, -35], [side * 11.5, -41], [side * 15, -35], [side * 11.7, -30]], color('#849681'), 1.2);
  polygon(ctx, [[side * 11.5, -39], [side * 13.5, -35], [side * 11.5, -32], [side * 9.4, -35]], color('#94d1be'));
  line(ctx, [[side * 11.4, -38], [side * 11.4, -34]], color('#daf0c9'), 0.8);
  polygon(ctx, [[headX - 6, -29 + bob], [headX - 6, -34 + bob], [headX - 2, -39 + bob], [headX + 2, -39 + bob], [headX + 6, -34 + bob], [headX + 5, -28 + bob], [headX, -25 + bob]], color('#425953'));
  polygon(ctx, [[headX - 4, -29 + bob], [headX - 3, -34 + bob], [headX, -36 + bob], [headX + 3.5, -33 + bob], [headX + 3, -28 + bob], [headX, -27 + bob]], color('#11282d'));
  ctx.fillStyle = color('#b1dbbd');
  ctx.fillRect(headX - 2, -31 + bob, 1.1, 1);
  ctx.fillRect(headX + 1, -31 + bob, 1.1, 1);
  if (attack > 0.12) {
    const radius = 1.5 + attack * 2;
    polygon(ctx, [[castingHand[0], castingHand[1] - radius], [castingHand[0] + radius, castingHand[1]], [castingHand[0], castingHand[1] + radius], [castingHand[0] - radius, castingHand[1]]], color('#a4f8ce'));
    for (let spark = 0; spark < 3; spark += 1) {
      const angle = pose.time * 4 + spark * TAU / 3;
      ctx.fillStyle = color('#77dcb8');
      ctx.fillRect(castingHand[0] + Math.cos(angle) * (4 + attack * 3), castingHand[1] + Math.sin(angle) * (4 + attack * 3), 1, 1);
    }
  }
}
