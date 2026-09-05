import { drawHumanoid } from './art.ts';
import { polygon, randomFromSeed } from './art-primitives.ts';
import { deathPose, type EnemyRemains } from './death-presentation.ts';

/** The actual creature folds into the ground, retaining its silhouette and gear. */
export function drawEnemyRemains(c: CanvasRenderingContext2D, r: EnemyRemains, reducedMotion: boolean): void {
  const pose = deathPose(r, reducedMotion), random = randomFromSeed(r.id);
  const large = r.kind === 'brute', spectral = r.kind === 'wisp';
  const side = Math.cos(r.angle) >= 0 ? 1 : -1;
  c.save(); c.translate(r.x + pose.x, r.y + pose.y); c.globalAlpha = pose.opacity;
  c.fillStyle = spectral ? '#16343170' : '#080f13a0';
  c.beginPath(); c.ellipse(side * pose.fall * 7, 1, large ? 24 : 18, 4 + pose.fall * 3, 0, 0, Math.PI * 2); c.fill();
  // Small, stable shards and scraps scatter only once; they never emit light.
  for (let i = 0; i < (spectral ? 9 : 12); i++) {
    const a = random() * Math.PI * 2, spread = (6 + random() * 17) * pose.fall;
    const x = Math.cos(a) * spread, y = Math.sin(a) * spread * .46;
    const size = .7 + random() * 1.4;
    c.globalAlpha = pose.opacity * pose.fall * (spectral ? .4 : .65);
    polygon(c, [[x-size,y], [x,y-size*.7], [x+size*1.7,y+.4], [x+.2,y+size]],
      spectral ? '#5b9b90' : i % 3 ? '#716b53' : '#343f37');
  }
  c.globalAlpha = pose.opacity * (spectral ? Math.max(0, 1 - r.age / 1.1) : 1 - pose.fall * .22);
  c.save();
  // Directional shear, loss of height and a small impact bounce, all anchored at the feet.
  const bounce = reducedMotion ? 0 : Math.sin(pose.fall * Math.PI) * 2;
  c.transform(1, side * pose.fall * .07, -side * pose.fall * .72, 1 - pose.fall * .72, 0, -bounce);
  if (spectral) c.scale(1 - pose.fall * .7, 1 - pose.fall * .6);
  drawHumanoid(c, { kind: r.kind, angle: r.facing, time: r.id,
    moving: 0, attack: 0, attackAngle: r.facing, hitFlash: 0, dodging: false });
  c.restore();
  // A short low dust plume replaces the old death ring and persistent glowing spot.
  c.globalAlpha = pose.opacity * pose.dust * .19;
  c.fillStyle = spectral ? '#7ca99c' : '#b0a184';
  for (let i = 0; i < 6; i++) {
    const angle = random() * Math.PI * 2, distance = 8 + Math.min(1, r.age) * 18;
    c.beginPath(); c.ellipse(Math.cos(angle) * distance, Math.sin(angle) * distance * .4 - 2,
      2 + pose.dust * 3, 1.2 + pose.dust, angle, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}
