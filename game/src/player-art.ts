import { getSupportGripOffset } from './equipment.ts';
import { projectArmPoint } from './player-arm-rig.ts';
import type { CharacterPose, CharacterOutfit } from './art-types.ts';
import { PLAYER_ATTACHMENTS, playerMotion } from './character-motion.ts';
import { STARTER_OUTFIT, heldWeapon, heldShield, upperArm, forearm, gauntlet, armorBoot, chestArmor, shoulderArmor, headArmor } from './equipment-art.ts';
import { hash, polygon, line, taper, type Color, type Point } from './art-primitives.ts';

export function player(ctx: CanvasRenderingContext2D, pose: CharacterPose, color: Color): void {
  const outfit: CharacterOutfit = { ...STARTER_OUTFIT, ...pose.outfit };
  const { moving, phase, step, moveX, moveY, bob, back, commitment, torsoTurn, cast,
    weaponAngle, offWeaponAngle, rangedDraw, swordBehind, hipX, hipY, lean, body, hand, weaponArm, offArm } = playerMotion(pose);
  const legs = [-1, 1].map(side => {
    const legPhase = phase + (side > 0 ? Math.PI : 0);
    const travel = Math.sin(legPhase) * 5.2 * moving;
    const lift = Math.max(0, Math.cos(legPhase)) * moving * 2.5;
    const mount = side < 0 ? PLAYER_ATTACHMENTS.leftHip : PLAYER_ATTACHMENTS.rightHip;
    const hip: Point = [mount[0] + hipX, mount[1] + hipY];
    const ankle: Point = [side * 3.6 + moveX * travel, moveY * travel * 0.7 - lift];
    const knee: Point = [hip[0] * 0.45 + ankle[0] * 0.55 + moveX * lift * 0.4,
      -6 + ankle[1] * 0.48 - lift * 0.35];
    return { side, hip, ankle, knee };
  }).sort((a, b) => a.ankle[1] - b.ankle[1]);
  for (const leg of legs) {
    const { hip, knee, ankle } = leg;
    taper(ctx, hip, knee, 4.5, 3.5, color('#293d39'));
    taper(ctx, knee, [ankle[0], ankle[1] - 2], 3.5, 2.8, color('#4d5a4c'));
    if (outfit.legs) {
      const m = outfit.legs.material;
      taper(ctx, [hip[0] - 0.3, hip[1]], [knee[0] - 0.3, knee[1] - 0.5], 3.8, 2.7, color(m.base));
      line(ctx, [[hip[0] - 1.4, hip[1]], [knee[0] - 1.2, knee[1] - 1]], color(m.edge), 0.65);
      // Each knee plate follows its actual joint, with exposed fabric behind it.
      polygon(ctx, [[knee[0] - 2, knee[1] - 1.8], [knee[0] + 1.9, knee[1] - 1.4],
        [knee[0] + 2, knee[1] + 0.7], [knee[0], knee[1] + 1.7], [knee[0] - 1.9, knee[1] + 0.3]], color(m.shadow));
      line(ctx, [[knee[0] - 1.6, knee[1] - 1.4], [knee[0] + 1.5, knee[1] - 1.1]], color(m.edge), 0.85);
      if (outfit.legs.style === 'plate') {
        taper(ctx, [hip[0], hip[1] - 0.5], [hip[0] + step * 0.25, hip[1] + 3.4], 4.6, 4.1, color(m.shadow));
        line(ctx, [[hip[0] - 1.8, hip[1] + 2], [hip[0] + 1.8, hip[1] + 2.4]], color(m.trim), 0.65);
      }
    }
    armorBoot(ctx, ankle, outfit.boots, color, moveX * moving);
  }

  ctx.save();
  ctx.transform(...body);
  const bow = pose.weapon?.kind === 'bow';
  const supportHolding = pose.grip !== 'one-handed' && (cast < .05 || bow || pose.weapon?.kind === 'staff' || !!pose.gesture);
  const mainWeapon = () => {
    heldWeapon(ctx, hand, weaponAngle, color, pose.weapon, rangedDraw);
    gauntlet(ctx, hand, outfit.hands, color);
    if (supportHolding) gauntlet(ctx, projectArmPoint(offArm.hand), outfit.hands, color);
    // Fingers cross the grip, keeping the weapon seated in the animated gauntlet.
    ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(weaponAngle);
    line(ctx, [[-0.6, -1.2], [-0.6, 1.3]], color(outfit.hands?.material.edge ?? '#baa078'), 0.7);
    if (supportHolding && !bow) {
      const support = getSupportGripOffset(pose.weapon);
      line(ctx, [[support - .6, -1.2], [support - .6, 1.3]], color(outfit.hands?.material.edge ?? '#baa078'), .7);
    }
    ctx.restore();
  };
  const offEquipment = () => {
    const offHand = projectArmPoint(offArm.hand);
    if (pose.offHand?.kind === 'shield') heldShield(ctx, offHand, pose.angle, pose.offHand.visual, color, pose.guard);
    if (pose.offHand?.kind === 'weapon') {
      heldWeapon(ctx, offHand, offWeaponAngle, color, pose.offHand.visual);
      gauntlet(ctx, offHand, outfit.hands, color);
    }
  };
  const armLayers = [weaponArm, offArm].flatMap(arm => [
    { depth: (arm.shoulder[1] + arm.elbow[1]) / 2,
      draw: () => upperArm(ctx, projectArmPoint(arm.shoulder), projectArmPoint(arm.elbow), color) },
    { depth: supportHolding ? (swordBehind ? -1 : 1) : (arm.elbow[1] + arm.hand[1]) / 2,
      draw: () => forearm(ctx, projectArmPoint(arm.elbow), projectArmPoint(arm.hand), outfit.hands, color) },
  ]).sort((a, b) => a.depth - b.depth);
  if (!supportHolding) {
    armLayers.push({ depth: offArm.hand[1], draw: () => gauntlet(ctx, projectArmPoint(offArm.hand), outfit.hands, color) });
    armLayers.sort((a, b) => a.depth - b.depth);
  }
  const cape = () => {
    const cloth = outfit.cloak;
    if (!cloth) return;
    const offset = (hash(cloth.seed) % 11) * 0.1;
    const wind = Math.sin(pose.time * 3.6 - 0.6 + offset) * (0.8 + moving * 1.1);
    const lag = Math.sin(phase - 0.7) * moving * 1.8;
    const trailX = -moveX * moving * 5 - Math.cos(pose.attackAngle) * commitment * 2.3
      - Math.sin(pose.attackAngle) * torsoTurn * 3;
    const trailY = -moveY * moving * 3 + Math.cos(pose.attackAngle) * torsoTurn * 1.6;
    const hemX = wind + lag + trailX;
    const hemY = -5.2 + trailY + Math.sin(pose.time * 4.7 - 0.4) * 0.5;
    polygon(ctx, [[-6, -27], [6, -27], [8 + hemX, hemY - 2],
      [3 + hemX * 0.9, hemY + 1], [-1 + hemX * 0.7, hemY - 0.5], [-7 + hemX * 0.6, hemY - 2]], color('#281f2b'));
    polygon(ctx, [[-5, -26], [5, -26], [6.5 + hemX, hemY - 3],
      [2 + hemX * 0.9, hemY - 0.5], [-5.7 + hemX * 0.6, hemY - 3]], color(cloth.base));
    polygon(ctx, [[-4, -25], [-0.5, -25], [hemX * 0.82, hemY - 2],
      [-4.5 + hemX * 0.6, hemY - 4]], color(cloth.highlight));
    polygon(ctx, [[2, -24], [4, -24], [5 + hemX * 0.9, hemY - 4],
      [2 + hemX * 0.7, hemY - 2]], color(cloth.shadow));
    line(ctx, [[-5.7 + hemX * 0.6, hemY - 3], [2 + hemX * 0.9, hemY - 0.5],
      [6.5 + hemX, hemY - 3]], color(cloth.trim), 0.65);
    line(ctx, [[-4.5, -24], [-4.5 + hemX * 0.3, -17], [-4.5 + hemX * 0.6, hemY - 4]], color(cloth.trim), 0.45);
    line(ctx, [[-4, -26], [0, -24.5], [4, -26]], color(cloth.trim), 0.8);
  };
  if (!back) cape();
  for (const layer of armLayers) if (layer.depth < 0) layer.draw();
  if (swordBehind) mainWeapon();
  if (pose.offHand && offArm.hand[1] < 0) offEquipment();
  ctx.save();
  ctx.translate(0, PLAYER_ATTACHMENTS.chest[1]);
  ctx.transform(1 - Math.abs(torsoTurn) * 0.08, torsoTurn * 0.12, 0, 1, 0, 0);
  ctx.translate(0, -PLAYER_ATTACHMENTS.chest[1]);
  chestArmor(ctx, outfit.chest, color);
  ctx.restore();
  if (back) cape();
  for (const layer of armLayers) if (layer.depth >= 0) layer.draw();
  const caps = [weaponArm, offArm].sort((a, b) => a.shoulder[1] - b.shoulder[1]);
  for (const arm of caps) {
    shoulderArmor(ctx, projectArmPoint(arm.shoulder), projectArmPoint(arm.elbow), outfit.shoulders, color);
  }
  // The neck counterbalances the moving torso; small facial features stay legible.
  ctx.save(); ctx.translate(lean * -12, -bob * 0.3);
  headArmor(ctx, outfit.head, color, pose.angle);
  ctx.restore();
  if (!swordBehind) mainWeapon();
  if (pose.offHand && offArm.hand[1] >= 0) offEquipment();
  if (cast > 0.05 && pose.weapon?.kind !== 'staff' && !bow && !pose.offHand && !pose.gesture) {
    const offHand = projectArmPoint(offArm.hand);
    ctx.save(); ctx.translate(offHand[0], offHand[1]); ctx.rotate(pose.time * 4.5);
    const radius = 1 + cast * 2.8;
    polygon(ctx, [[0, -radius], [radius, 0], [0, radius], [-radius, 0]], color(pose.castColor ?? '#c0acf0'));
    ctx.fillStyle = color('#fff5c0'); ctx.fillRect(-0.8, -0.8, 1.6, 1.6);
    ctx.restore();
  }
  ctx.restore();
}
