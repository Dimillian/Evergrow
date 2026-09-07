import { gearSurface } from './gear-material.ts';
import { projectArmPoint } from './player-arm-rig.ts';
import type { CharacterPose, CharacterOutfit } from './art-types.ts';
import { PLAYER_ATTACHMENTS, playerFootCycle, playerMotion } from './character-motion.ts';
import { STARTER_OUTFIT, heldWeapon, heldShield, heldFocus, upperArm, forearm, gauntlet, armorBoot, armorSegment, kneeArmor, drawGearShapes, chestArmor, shoulderArmor, headArmor } from './equipment-art.ts';
import { hash, polygon, line, taper, type Color, type Point } from './art-primitives.ts';

export function player(ctx: CanvasRenderingContext2D, pose: CharacterPose, color: Color): void {
  const outfit: CharacterOutfit = { ...STARTER_OUTFIT, ...pose.outfit };
  const { moving, phase, step, moveX, moveY, bob, back, commitment, torsoTurn, cast,
    weaponAngle, offWeaponAngle, weaponScale, offWeaponScale, rangedDraw, weaponCharge, weaponBehind, supportHolding, hipX, hipY, lean, body, weaponOrigin, offWeaponOrigin, weaponArm, offArm } = playerMotion(pose);
  const legs = [-1, 1].map(side => {
    const foot = playerFootCycle(phase + (side > 0 ? Math.PI : 0));
    const travel = foot.travel * moving, lift = foot.lift * moving;
    const mount = side < 0 ? PLAYER_ATTACHMENTS.leftHip : PLAYER_ATTACHMENTS.rightHip;
    const hip: Point = [mount[0] + hipX, mount[1] + hipY];
    const ankle: Point = [side * 3.3 + moveX * travel, moveY * travel * 0.7 - lift];
    const knee: Point = [hip[0] * 0.45 + ankle[0] * 0.55 + moveX * lift * 0.4,
      -8 + ankle[1] * 0.48 - lift * 0.25];
    return { side, hip, ankle, knee };
  }).sort((a, b) => a.ankle[1] - b.ankle[1]);
  const cape = () => {
    const cloth = outfit.cloak;
    if (!cloth) return;
    const fabric = (points:readonly Point[],fill:string) => {
      const cx=points.reduce((sum,p)=>sum+p[0],0)/points.length;
      drawGearShapes(ctx,[{points,fill,surface:gearSurface('cloth',cloth.seed,[Math.max(-.5,Math.min(.5,cx*.06)),-.15,.95])}],color);
    };
    const offset = (hash(cloth.seed) % 11) * 0.1;
    const wind = Math.sin(pose.time * 3.6 - 0.6 + offset) * (0.8 + moving * 1.1);
    const lag = Math.sin(phase - 0.7) * moving * 1.8;
    const trailX = -moveX * moving * 5 - Math.cos(pose.attackAngle) * commitment * 2.3
      - Math.sin(pose.attackAngle) * torsoTurn * 3;
    const trailY = -moveY * moving * 3 + Math.cos(pose.attackAngle) * torsoTurn * 1.6;
    const hemX = wind + lag + trailX;
    const hemY = -5.2 + trailY + Math.sin(pose.time * 4.7 - 0.4) * 0.5;
    fabric([[-6, -27], [6, -27], [8 + hemX, hemY - 2],
      [3 + hemX * 0.9, hemY + 1], [-1 + hemX * 0.7, hemY - 0.5], [-7 + hemX * 0.6, hemY - 2]], '#281f2b');
    fabric([[-5, -26], [5, -26], [6.5 + hemX, hemY - 3],
      [2 + hemX * 0.9, hemY - 0.5], [-5.7 + hemX * 0.6, hemY - 3]], cloth.base);
    fabric([[-4, -25], [-0.5, -25], [hemX * 0.82, hemY - 2],
      [-4.5 + hemX * 0.6, hemY - 4]], cloth.highlight);
    fabric([[2, -24], [4, -24], [5 + hemX * 0.9, hemY - 4],
      [2 + hemX * 0.7, hemY - 2]], cloth.shadow);
    // The center pleat is an actual fold with an inset lining and a split hem.
    fabric([[-.8, -23], [.8, -23], [2.1 + hemX * .82, hemY - .8],
      [.5 + hemX * .7, hemY - 4.1], [-.9 + hemX * .7, hemY - 1.1]], cloth.shadow);
    line(ctx, [[-1.1, -22], [-.5 + hemX * .45, -13], [-1.2 + hemX * .7, hemY - 3.2]], color(cloth.highlight), .6);
    line(ctx, [[-5.7 + hemX * 0.6, hemY - 3], [2 + hemX * 0.9, hemY - 0.5],
      [6.5 + hemX, hemY - 3]], color(cloth.trim), 0.65);
    line(ctx, [[-4.5, -24], [-4.5 + hemX * 0.3, -17], [-4.5 + hemX * 0.6, hemY - 4]], color(cloth.trim), 0.45);
    line(ctx, [[-4, -26], [0, -24.5], [4, -26]], color(cloth.trim), 0.8);
    if (back) {
      // A small stitched wayfarer's seal supplies an identity without hiding cloth.
      line(ctx, [[-.8, -21.5], [1, -19.1], [-.5, -16.8], [-2.1, -19]], color(cloth.trim), .65);
      line(ctx, [[-.6, -20.6], [-.6, -17.8]], color(cloth.highlight), .5);
    }
  };
  // The front-facing cape is behind the whole rig, including both legs.
  if (!back) { ctx.save(); ctx.transform(...body); cape(); ctx.restore(); }
  for (const leg of legs) {
    const { hip, knee, ankle } = leg;
    taper(ctx, hip, knee, 4, 3.1, color('#293d39'));
    taper(ctx, knee, [ankle[0], ankle[1] - 2], 3.1, 2.4, color('#4d5a4c'));
    if (outfit.legs) {
      const m = outfit.legs.material;
      armorSegment(ctx,hip,[knee[0],knee[1]-.5],outfit.legs,color,'thigh');
      kneeArmor(ctx,knee,outfit.legs,color);
      if (outfit.legs.style === 'plate') {
        taper(ctx, [hip[0], hip[1] - 0.5], [hip[0] + step * 0.25, hip[1] + 3.4], 4.6, 4.1, color(m.shadow));
        line(ctx, [[hip[0] - 1.8, hip[1] + 2], [hip[0] + 1.8, hip[1] + 2.4]], color(m.trim), 0.65);
      }
    }
    armorBoot(ctx, ankle, outfit.boots, color, Math.cos(pose.angle) * .75 + leg.side * .15);
  }

  ctx.save();
  ctx.transform(...body);
  const bow = pose.weapon?.kind === 'bow';
  const mainWeapon = () => {
    const hand = projectArmPoint(weaponArm.hand);
    heldWeapon(ctx, weaponOrigin, weaponAngle, color, pose.weapon, rangedDraw, pose.effectTime ?? pose.time, weaponCharge, weaponScale);
    gauntlet(ctx, hand, outfit.hands, color, weaponAngle);
    if (supportHolding) gauntlet(ctx, projectArmPoint(offArm.hand), outfit.hands, color, weaponAngle);
    // Fingers cross the grip, keeping the weapon seated in the animated gauntlet.
    ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(weaponAngle);
    line(ctx, [[-0.6, -1.2], [-0.6, 1.3]], color(outfit.hands?.material.edge ?? '#baa078'), 0.7);
    ctx.restore();
    if (supportHolding && !bow) {
      const support = projectArmPoint(offArm.hand);
      ctx.save(); ctx.translate(support[0], support[1]); ctx.rotate(weaponAngle);
      line(ctx, [[-.6, -1.2], [-.6, 1.3]], color(outfit.hands?.material.edge ?? '#baa078'), .7);
      ctx.restore();
    }
  };
  const offEquipment = () => {
    const offHand = projectArmPoint(offArm.hand);
    if (pose.offHand?.kind === 'focus') {
      heldFocus(ctx, offHand, pose.offHand.visual, color, pose.effectTime ?? pose.time, pose.angle);
      gauntlet(ctx, offHand, outfit.hands, color, -.2, false);
    }
    if (pose.offHand?.kind === 'shield') heldShield(ctx, offHand, pose.angle, pose.offHand.visual, color, pose.guard);
    if (pose.offHand?.kind === 'weapon') {
      heldWeapon(ctx, offWeaponOrigin, offWeaponAngle, color, pose.offHand.visual, 0, pose.effectTime ?? pose.time, 0, offWeaponScale);
      gauntlet(ctx, offHand, outfit.hands, color, offWeaponAngle);
    }
  };
  const armLayers = [weaponArm, offArm].flatMap(arm => [
    { depth: (arm.shoulder[1] + arm.elbow[1]) / 2,
      draw: () => upperArm(ctx, projectArmPoint(arm.shoulder), projectArmPoint(arm.elbow), color) },
    { depth: supportHolding ? (weaponBehind ? -1 : 1) : (arm.elbow[1] + arm.hand[1]) / 2,
      draw: () => forearm(ctx, projectArmPoint(arm.elbow), projectArmPoint(arm.hand), outfit.hands, color) },
  ]).sort((a, b) => a.depth - b.depth);
  if (!supportHolding) {
    armLayers.push({ depth: offArm.hand[1], draw: () => gauntlet(ctx, projectArmPoint(offArm.hand), outfit.hands, color, -.5, false) });
    armLayers.sort((a, b) => a.depth - b.depth);
  }
  for (const layer of armLayers) if (layer.depth < 0) layer.draw();
  if (weaponBehind) mainWeapon();
  if (pose.offHand && offArm.hand[1] < 0) offEquipment();
  ctx.save();
  ctx.translate(0, PLAYER_ATTACHMENTS.chest[1]);
  ctx.transform(1 - Math.abs(torsoTurn) * 0.08, torsoTurn * 0.12, 0, 1, 0, 0);
  ctx.translate(0, -PLAYER_ATTACHMENTS.chest[1]);
  chestArmor(ctx, outfit.chest, color);
  if (outfit.cloak && !back) {
    const trim = outfit.cloak.trim;
    line(ctx, [[-5.1, -26.3], [-2.5, -24.1], [2.2, -24.1], [5.1, -26.3]], color('#29363d'), 1.7);
    line(ctx, [[-5.1, -26.3], [-2.5, -24.1], [2.2, -24.1], [5.1, -26.3]], color(trim), .65);
    polygon(ctx, [[-5.8, -26.2], [-4.6, -27.5], [-3.5, -26.2], [-4.6, -24.9]], color(trim));
    polygon(ctx, [[3.6, -26.2], [4.8, -27.5], [6, -26.2], [4.8, -24.9]], color(trim));
  }
  ctx.restore();
  if (back) cape();
  for (const layer of armLayers) if (layer.depth >= 0) layer.draw();
  const caps = [weaponArm, offArm].sort((a, b) => a.shoulder[1] - b.shoulder[1]);
  for (const arm of caps) {
    shoulderArmor(ctx, projectArmPoint(arm.shoulder), projectArmPoint(arm.elbow), outfit.shoulders, color);
  }
  // The neck counterbalances the moving torso; small facial features stay legible.
  ctx.save(); ctx.translate(lean * -12, -bob * 0.3);
  headArmor(ctx, outfit.head, color, pose.angle, pose.appearance);
  ctx.restore();
  const equipmentLayers = [
    ...(!weaponBehind ? [{ depth: weaponArm.hand[1], draw: mainWeapon }] : []),
    ...(pose.offHand && offArm.hand[1] >= 0 ? [{ depth: offArm.hand[1], draw: offEquipment }] : []),
  ];
  equipmentLayers.sort((a, b) => a.depth - b.depth).forEach(layer => layer.draw());
  if (cast > 0.05 && pose.weapon?.kind !== 'staff' && pose.weapon?.kind !== 'wand' && !bow && !pose.offHand && !pose.gesture) {
    const offHand = projectArmPoint(offArm.hand);
    ctx.save(); ctx.translate(offHand[0], offHand[1]); ctx.rotate(pose.time * 4.5);
    const radius = 1 + cast * 2.8;
    polygon(ctx, [[0, -radius], [radius, 0], [0, radius], [-radius, 0]], color(pose.castColor ?? '#c0acf0'));
    ctx.fillStyle = color('#fff5c0'); ctx.fillRect(-0.8, -0.8, 1.6, 1.6);
    ctx.restore();
  }
  ctx.restore();
}
