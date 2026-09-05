import type { CharacterPose } from './art-types.ts';
import { getSwingAngle, WEAPON_REST_ANGLE } from './character-motion.ts';
import { heldWeapon } from './equipment-art.ts';
import { bowStringOffset } from './weapon-shapes.ts';
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
  // Remnants of a burial shroud cling to one shoulder and tear below the ribs.
  polygon(ctx, [[-7, bodyY - 5], [-4, bodyY - 7], [-3, bodyY + 1], [-5, -7], [-7, -10], [-8, -4], [-9, -12]], color('#394f49'));
  line(ctx, [[-6.5, bodyY - 4], [-5, bodyY + 1], [-7, -9]], color('#769080'), .65);
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
  line(ctx, [[faceX + 1, headY - 7], [faceX - .3, headY - 3.8], [faceX + 1, headY - 2.2]], color('#535f50'), .7);
  line(ctx, [[faceX - 3, headY - 5], [faceX - 5, headY - 9], [faceX - 3.6, headY - 11.5]], color('#748169'), 1.5);
  line(ctx, [[faceX - 4.4, headY - 8.8], [faceX - 7.1, headY - 9.7]], color('#9ba180'), .85);
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
  polygon(ctx, [[-6, -29 + bob], [1, -31 + bob], [7, -27 + bob], [7, -18], [1, -14], [-5, -17]], color('#343d3b'));
  polygon(ctx, [[-5, -28 + bob], [1, -30 + bob], [1, -17], [-3.8, -18.5]], color('#778077'));
  line(ctx, [[-4.7, -27.5 + bob], [1, -29.5 + bob], [5.5, -26.5 + bob]], color('#b4b496'), 1);
  line(ctx, [[1, -27 + bob], [1, -19]], color('#b39b6e'), 1.1);
  line(ctx, [[-1.8, -23 + bob], [3.7, -23 + bob]], color('#b39b6e'), .9);
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
      line(ctx, [[16, -3.8], [16, 3], [21, 4]], color('#c1ad78'), 1);
      line(ctx, [[22, -3], [24, 0], [21.5, 2]], color('#363f3b'), 1.1);
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
  // A split ceremonial stole and reliquary pendant separate the hexer from scouts.
  polygon(ctx, [[-2.6, -25 + bob], [-.9, -25 + bob], [-1, -6], [-3, -2], [-4, -6]], color('#746d58'));
  polygon(ctx, [[1.8, -25 + bob], [3, -24 + bob], [5, -6], [3, -3], [2, -7]], color('#a0926a'));
  for (let seal = 0; seal < 3; seal++) line(ctx, [[2.2 + seal * .2, -18 + seal * 4], [3.3 + seal * .2, -16.8 + seal * 4], [2.7 + seal * .2, -15.8 + seal * 4]], color('#294644'), .7);
  polygon(ctx, [[-1, -23 + bob], [1, -21 + bob], [-1, -18 + bob], [-3, -21 + bob]], color('#c9bc8c'));
  polygon(ctx, [[-1, -22 + bob], [0, -21 + bob], [-1, -19.5 + bob], [-2, -21 + bob]], color('#93cdb0'));
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
  for (const horn of [-1, 1]) {
    line(ctx, [[headX + horn * 4, -34 + bob], [headX + horn * 7, -38 + bob], [headX + horn * 6, -43 + bob]], color('#6d8373'), 1.9);
    line(ctx, [[headX + horn * 4, -34 + bob], [headX + horn * 6.5, -38 + bob]], color('#c8c39a'), .65);
  }
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

/** A four-legged, forward-projecting skeleton. Its low body and skull remain
 * recognizable from every approach; legs articulate around the actual gait. */
export function hound(ctx: CanvasRenderingContext2D, pose: CharacterPose, color: Color): void {
  const moving = clamp(pose.moving), phase = pose.gaitPhase ?? pose.time * 13;
  const windup = pose.attack < 0 ? smooth(-pose.attack) : 0;
  const leap = pose.attack > 0 ? Math.sin(clamp(pose.attack) * Math.PI) : 0;
  const bodyHeight = 12 + Math.abs(Math.sin(phase)) * moving * 1.1 - windup * 3 + leap * 3;
  const forward = [Math.cos(pose.angle), Math.sin(pose.angle) * .55] as const;
  const across = [-Math.sin(pose.angle), Math.cos(pose.angle) * .55] as const;
  const p = (x: number, y: number, z: number): Point => [forward[0] * x + across[0] * y, forward[1] * x + across[1] * y - z];
  const poly = (points: readonly (readonly [number, number, number])[], fill: string) => polygon(ctx, points.map(q => p(...q)), color(fill));
  const limbs = [-1, 1].flatMap(end => [-1, 1].map(side => {
    const stride = Math.sin(phase + (end === side ? Math.PI : 0)) * moving * 4;
    const lift = Math.max(0, Math.cos(phase + (end === side ? Math.PI : 0))) * moving * 2.7 + leap * 2;
    const hip = p(end * 6.5, side * 3, bodyHeight - 1);
    const knee = p(end * 7.2 - stride * .45 - windup * 2, side * 4, bodyHeight * .44 + lift * .3);
    const paw = p(end * 7.2 + stride + leap * 3, side * 4.7, lift);
    return { hip, knee, paw, depth: p(end * 6.5, side * 3, 0)[1] };
  })).sort((a, b) => a.depth - b.depth);
  const leg = ({ hip, knee, paw }: typeof limbs[number]) => {
    taper(ctx, hip, knee, 3.6, 2.1, color('#3e514c'));
    taper(ctx, [hip[0] - .4, hip[1] - .3], [knee[0] - .4, knee[1]], 2.2, 1.5, color('#b2bba1'));
    taper(ctx, knee, paw, 1.8, 1.2, color('#82968b'));
    polygon(ctx, [[paw[0] - 2, paw[1] - 1], [paw[0] + 1.6, paw[1] - 1], [paw[0] + 2.2, paw[1] + 1], [paw[0] - 2, paw[1] + 1.2]], color('#d4cfaf'));
  };
  limbs.slice(0, 2).forEach(leg);
  line(ctx, [p(-8, 0, bodyHeight), p(-15, .8, bodyHeight + 2), p(-20, 1.3, bodyHeight + 8 + Math.sin(pose.time * 4) * 1.4)], color('#4c6056'), 2.3);
  line(ctx, [p(-9, 0, bodyHeight + 1), p(-15, .8, bodyHeight + 3), p(-19, 1.3, bodyHeight + 8)], color('#adb89a'), .8);
  poly([[-10, 0, bodyHeight + 1], [-7, -4, bodyHeight + 4], [5, -4, bodyHeight + 5], [9, 0, bodyHeight + 3], [6, 4, bodyHeight], [-6, 4, bodyHeight - 1]], '#263c3c');
  poly([[-8, -3, bodyHeight + 4], [5, -3, bodyHeight + 5], [8, 0, bodyHeight + 4], [1, 2, bodyHeight + 2], [-6, 2, bodyHeight + 1]], '#788f7e');
  for (let rib = 0; rib < 5; rib++) {
    const x = -5 + rib * 2.3;
    line(ctx, [p(x, -3.5, bodyHeight + 3), p(x + .8, 0, bodyHeight + 5.2), p(x + .3, 4.7, bodyHeight), p(x - .7, 3.2, bodyHeight - 3)], color('#c4c5a7'), 1.1);
  }
  for (let spike = 0; spike < 4; spike++) poly([[-6 + spike * 3, 0, bodyHeight + 4], [-5 + spike * 3, 0, bodyHeight + 8], [-3.6 + spike * 3, 0, bodyHeight + 4]], '#b7b493');
  limbs.slice(2).forEach(leg);
  const skull = bodyHeight + 3 - windup * 2;
  poly([[5, -3, skull + 1], [8, -4, skull + 6], [12, -3, skull + 7], [16, -2.5, skull + 2], [19, -1.8, skull + 1], [19, 1.8, skull + 1], [13, 3.8, skull], [8, 3, skull - 1]], '#e0d4ab');
  poly([[8, 1, skull + 4], [12, 1.5, skull + 4], [16, 2, skull + 1], [19, 1.8, skull + 1], [17, 2.6, skull - 1], [10, 3.8, skull - 1]], '#88947d');
  poly([[7, -2.8, skull + 4], [7, -3.5, skull + 10], [10, -3, skull + 6]], '#a6b394');
  poly([[7, 2.8, skull + 4], [7, 3.5, skull + 10], [10, 3, skull + 6]], '#c9c69f');
  const jaw = leap * 3 + windup;
  line(ctx, [p(11, -2.2, skull - 1 - jaw), p(18, -1.7, skull - 1 - jaw), p(19, 0, skull - jaw), p(18, 1.7, skull - 1 - jaw), p(11, 2.2, skull - 1 - jaw)], color('#a7b099'), 1.5);
  for (const side of [-1, 1]) {
    const eye = p(11.2, side * 3.15, skull + 3.7);
    polygon(ctx, [[eye[0] - 1.7, eye[1] - .8], [eye[0] + 1.5, eye[1] - .5], [eye[0] + .8, eye[1] + 1.6], [eye[0] - 1.3, eye[1] + 1.1]], color('#263833'));
    line(ctx, [[eye[0] - .7, eye[1] + .1], [eye[0] + .7, eye[1] + .1]], color(windup ? '#fff7a2' : '#e9bd63'), .9);
    taper(ctx, p(15, side * 2.4, skull), p(15.7, side * 2.4, skull - 2.5), 1.1, .15, color('#ede0ba'));
  }
}

export function archer(ctx: CanvasRenderingContext2D, pose: CharacterPose, color: Color): void {
  const move = clamp(pose.moving), phase = pose.gaitPhase ?? pose.time * 8;
  const stride = Math.sin(phase) * move, bob = Math.abs(stride) * .65;
  const charge = pose.attack < 0 ? smooth(-pose.attack) : pose.attack > 0 ? 1 - smooth(pose.attack / .28) : 0;
  const aim = pose.attack !== 0 ? pose.attackAngle : pose.angle;
  const back = Math.sin(pose.angle) < -.16;
  const facingX = Math.cos(pose.angle) * 1.1;
  // A shouldered quiver and thorn mantle break the silhouette above its hood.
  ctx.save(); ctx.translate(-4, -23 + bob); ctx.rotate(-.28);
  polygon(ctx, [[-3, -2], [3, -2], [3, 16], [0, 18], [-3, 15]], color('#343c35'));
  line(ctx, [[-3, -1], [3, -1], [3, 13]], color('#9b8656'), 1);
  for (let arrow = 0; arrow < 3; arrow++) {
    line(ctx, [[-2 + arrow * 2, 4], [-2 + arrow * 2, -10 - arrow % 2 * 2]], color('#b7a779'), .7);
    polygon(ctx, [[-2 + arrow * 2, -9], [-3.5 + arrow * 2, -12], [-2 + arrow * 2, -13], [-.5 + arrow * 2, -10]], color('#718e83'));
  }
  ctx.restore();
  for (const side of [-1, 1]) {
    const ankle: Point = [side * 4 + stride * side, stride * side * 2];
    taper(ctx, [side * 3, -14], [side * 5, -8 - stride * side], 4.2, 3.1, color('#465644'));
    taper(ctx, [side * 5, -8 - stride * side], ankle, 3.1, 2.5, color('#73684e'));
    boot(ctx, ankle[0], ankle[1], 2.3, color);
  }
  const sway = Math.sin(pose.time * 3 + phase * .2) * (1 + move * 1.3);
  polygon(ctx, [[-5, -27 + bob], [5, -27 + bob], [8, -19], [9 + sway, -4], [4, -7], [0 + sway, -2], [-7 + sway, -5], [-8, -18]], color('#233d39'));
  polygon(ctx, [[-4, -26 + bob], [0, -26 + bob], [1 + sway, -5], [-4, -8], [-6, -17]], color('#4f7056'));
  polygon(ctx, [[-4, -24 + bob], [4, -25 + bob], [6, -18], [4, -11], [-4, -12], [-6, -18]], color('#565c40'));
  line(ctx, [[-4, -21], [0, -19], [4, -21]], color('#a5a16e'), .8);
  line(ctx, [[-4, -13], [4, -13]], color('#ac8d56'), 1.8);
  polygon(ctx, [[-1, -14], [1.5, -14], [1.5, -11.7], [-1, -11.7]], color('#cbbb7d'));
  for (const side of [-1, 1]) {
    line(ctx, [[side * 4, -25 + bob], [side * 8, -30 + bob], [side * 10, -35 + bob]], color('#6b7460'), 1.6);
    line(ctx, [[side * 7, -29 + bob], [side * 12, -29 + bob], [side * 13, -32 + bob]], color('#a4a480'), .8);
  }
  const hand: Point = [Math.cos(aim) * (10 + charge * 3), -21 + Math.sin(aim) * (8 + charge * 2)];
  const support: Point = [hand[0] + Math.cos(aim) * bowStringOffset(charge), hand[1] + Math.sin(aim) * bowStringOffset(charge)];
  const arms = [
    { shoulder: [-Math.sin(aim) * 5.5, -25 + Math.cos(aim) * 2] as Point, hand, side: 1 },
    { shoulder: [Math.sin(aim) * 5.5, -25 - Math.cos(aim) * 2] as Point, hand: support, side: -1 },
  ];
  for (const arm of arms) {
    const elbow: Point = [(arm.shoulder[0] + arm.hand[0]) * .5 - Math.sin(aim) * arm.side * 3, (arm.shoulder[1] + arm.hand[1]) * .5 + 3];
    taper(ctx, arm.shoulder, elbow, 4.8, 3, color('#3a5242'));
    taper(ctx, elbow, arm.hand, 2.7, 1.8, color('#a0a587'));
    line(ctx, [[elbow[0] - .5, elbow[1]], [arm.hand[0] - .5, arm.hand[1]]], color('#d0c6a0'), .65);
  }
  polygon(ctx, [[facingX - 5, -29 + bob], [facingX - 5, -34 + bob], [facingX - 1, -39 + bob], [facingX + 3, -37 + bob], [facingX + 6, -31 + bob], [facingX + 3, -26 + bob], [facingX - 2, -27 + bob]], color('#48684c'));
  polygon(ctx, [[facingX - 4.4, -30 + bob], [facingX - 3.4, -34 + bob], [facingX - 1, -37.2 + bob], [facingX, -33 + bob], [facingX - 1, -28 + bob]], color('#829570'));
  if (!back) {
    polygon(ctx, [[facingX - 2.7, -31.5 + bob], [facingX, -34.5 + bob], [facingX + 3.4, -31 + bob], [facingX + 2, -28 + bob], [facingX - 1.4, -27.7 + bob]], color('#162c2c'));
    line(ctx, [[facingX - 1.8, -30.5 + bob], [facingX - .5, -30.5 + bob]], color('#f0cd85'), .8);
    line(ctx, [[facingX + 1, -30.5 + bob], [facingX + 2, -30.5 + bob]], color('#f0cd85'), .8);
  } else line(ctx, [[facingX - 3, -33 + bob], [facingX, -30 + bob], [facingX + 2, -28 + bob]], color('#263e34'), .8);
  heldWeapon(ctx, hand, aim, color, { kind: 'bow', length: 30, width: 15, gripLength: 9,
    metal: '#658c76', edge: '#d4cc9a', grip: '#5b6040', guard: '#a5a274' }, charge);
  for (const point of [hand, support]) polygon(ctx, [[point[0] - 1.3, point[1] - 1.3], [point[0] + 1.5, point[1] - 1], [point[0] + 1.2, point[1] + 1.3], [point[0] - 1.2, point[1] + 1.2]], color('#cec6a3'));
}

/** A suspended reliquary, with a living flame behind its iron cage. */
export function wisp(ctx: CanvasRenderingContext2D, pose: CharacterPose, color: Color): void {
  const charge = pose.attack < 0 ? smooth(-pose.attack) : 0;
  const release = pose.attack > 0 ? Math.sin(clamp(pose.attack) * Math.PI) : 0;
  const bob = Math.sin(pose.time * 3.2) * 2 - charge * 2;
  const center: Point = [Math.cos(pose.angle) * (1 + release * 3), -22 + bob];
  const pulse = .5 + Math.sin(pose.time * 6) * .5;
  for (let ribbon = 0; ribbon < 3; ribbon++) {
    const x = (ribbon - 1) * 4, drift = Math.sin(pose.time * 3.8 + ribbon * 1.8) * 3;
    polygon(ctx, [[center[0] + x - 1, center[1] + 8], [center[0] + x + 2, center[1] + 8], [center[0] + x + drift + 1, -5], [center[0] + x + drift - 3, -1 + ribbon], [center[0] + x + drift - 1, -7]], color(ribbon === 1 ? '#527e77' : '#263f43'));
    line(ctx, [[center[0] + x, center[1] + 9], [center[0] + x + drift, -7]], color('#6b9d8d'), .55);
  }
  ctx.save(); ctx.translate(...center);
  const inner = 5.5 + charge * 2.2 + pulse * .5;
  polygon(ctx, [[-inner, -3], [-3, -9 - charge * 3], [-1, -6], [1, -12], [3.5, -7], [inner, -3], [inner - 1, 5], [0, 8], [-inner + 1, 5]], color('#407c78'));
  polygon(ctx, [[-3, 3], [-2.4, -5], [.5, -9], [1, -4], [3.5, -1], [3, 4], [0, 6]], color('#a4ddbb'));
  polygon(ctx, [[-1.2, 2], [-.8, -3], [.8, -5], [1.8, 0], [.6, 3.4]], color('#eef5cb'));
  polygon(ctx, [[-9, -8], [-5, -11], [5, -11], [9, -8], [6, -6], [-6, -6]], color('#283f46'));
  polygon(ctx, [[-9, -8], [-5, -11], [0, -12.5], [5, -11], [7, -9], [-5, -8]], color('#7e958b'));
  line(ctx, [[-7.5, -8], [0, -9.8], [6.5, -8.8]], color('#d0c7a0'), .7);
  for (const side of [-1, 1]) {
    line(ctx, [[side * 7, -7.5], [side * 8, 3], [side * 4, 8]], color('#1c333b'), 2.2);
    line(ctx, [[side * 6.8 - .4, -7.1], [side * 7.5 - .4, 2.5], [side * 3.7, 7]], color('#a1b29b'), .65);
    line(ctx, [[side * 3, -8], [side * 3.5, 5]], color('#344c4d'), 1);
  }
  polygon(ctx, [[-7, 6], [7, 6], [5, 10], [0, 12], [-5, 10]], color('#344a4e'));
  line(ctx, [[-6, 6.3], [0, 7.7], [6, 6.3]], color('#c7b889'), .9);
  polygon(ctx, [[-1.4, 10], [1.4, 10], [2, 12], [0, 15], [-2, 12]], color('#9ca488'));
  line(ctx, [[-2, -12], [-3, -15], [0, -17], [3, -15], [2, -12]], color('#9aa88b'), 1.2);
  if (charge > .05) {
    const radius = 10 + charge * 3;
    for (let mote = 0; mote < 4; mote++) {
      const angle = pose.time * 2 + mote * TAU / 4;
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * .45;
      polygon(ctx, [[x - 1, y], [x, y - 2], [x + 1, y], [x, y + 2]], color('#d2f2be'));
    }
  }
  ctx.restore();
}
