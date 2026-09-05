import { PROJECTILE_HEIGHT } from './ranged-aim.ts';
import type { Projectile, ProjectileStyle } from './model.ts';
import { drawGlow, type PointLight } from './lighting.ts';
import { line, polygon, type Point } from './art-primitives.ts';

export const PROJECTILE_COLORS: Readonly<Record<ProjectileStyle, string>> = Object.freeze({
  arrow: '#bdcca9', fire: '#ff803c', frost: '#8ee7ff', lightning: '#b7afff', arcane: '#a894ec', spirit: '#83dfb1',
});
export const projectileStyle = (shot: Projectile): ProjectileStyle => shot.effects?.style ?? (shot.owner === 'enemy' ? 'spirit' : 'arcane');

export function projectileLight(shot: Projectile): PointLight {
  const style = projectileStyle(shot);
  return { x: shot.x, y: shot.y - PROJECTILE_HEIGHT, color: PROJECTILE_COLORS[style],
    radius: style === 'arrow' ? 30 : style === 'fire' ? 150 : style === 'lightning' ? 130 : 105,
    power: style === 'arrow' ? .15 : .86, shadows: style !== 'arrow' };
}

/** Projectile art follows the simulation's snapshotted payload, never current gear. */
export function drawProjectile(c: CanvasRenderingContext2D, shot: Projectile, x: number, y: number, time: number): void {
  const style = projectileStyle(shot), color = PROJECTILE_COLORS[style];
  const flicker = Math.sin(time * 21 + shot.id * 1.7), radius = Math.max(2, shot.radius);
  if (style !== 'arrow') drawGlow(c, x, y, style === 'fire' ? 58 : 37, color, .65);
  c.save(); c.translate(x, y); c.rotate(shot.angle);
  if (style === 'arrow') {
    c.globalAlpha *= .45;
    line(c, [[-42, 0], [-14, 0]], '#d5ddc2', 1.5);
    c.globalAlpha /= .45;
    line(c, [[-23, .4], [6, .4]], '#473e32', 2);
    line(c, [[-23, -.2], [6, -.2]], '#c4ad80', .85);
    polygon(c, [[5, -2.4], [12, 0], [5, 2.4], [7, 0]], '#e4e7d0');
    polygon(c, [[-21, 0], [-28, -4], [-22, -3], [-16, 0]], '#92b8a5');
    polygon(c, [[-21, 0], [-28, 4], [-22, 3], [-16, 0]], '#586c69');
  } else if (style === 'fire') {
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const spread = (i - 1) * 3, tail = -34 - Math.sin(time * 25 + i * 3 + shot.id) * 9;
      polygon(c, [[radius, 0], [-5, -radius - spread], [tail * .5, -3 + spread], [tail, spread + flicker * 3],
        [tail * .45, 4 + spread], [-5, radius + spread]], i === 0 ? '#8f2e17' : i === 1 ? '#eb5727' : '#ef9338');
    }
    c.fillStyle = '#ffc66a'; c.beginPath(); c.ellipse(0, 0, radius + 2, radius * .8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff5c4'; c.beginPath(); c.ellipse(2, -.5, radius * .6, radius * .48, 0, 0, Math.PI * 2); c.fill();
    line(c, [[-22, -2], [-13, -4], [-5, -3]], '#ffd96f', 1);
  } else if (style === 'frost') {
    c.globalAlpha *= .35;
    polygon(c, [[7, 0], [-11, -7], [-43, 0], [-11, 7]], '#7a9edf');
    c.globalAlpha /= .35;
    polygon(c, [[radius + 9, 0], [-9, -4.5], [-17, 0], [-9, 4.5]], '#70bedc');
    polygon(c, [[radius + 9, 0], [-9, -4.5], [-7, .5]], '#e6fcff');
    line(c, [[-14, 0], [radius + 7, 0]], '#a5f4ff', .8);
    for (const side of [-1, 1]) polygon(c, [[-16, side * 6], [-24, side * 9], [-27, side * 6], [-21, side * 5]], '#a5ddee');
  } else if (style === 'lightning') {
    c.globalCompositeOperation = 'lighter';
    const points: Point[] = Array.from({ length: 7 }, (_, i): Point => [-35 + i * 7,
      i === 6 ? 0 : Math.sin(shot.id * 3 + i * 2.7 + Math.floor(time * 28)) * 4]);
    line(c, points, color, 3.5); line(c, points, '#edf5ff', 1.15);
    line(c, [points[2], [-24, -9], [-29, -12]], color, .85);
    line(c, [points[4], [-7, 9], [-14, 12]], '#b7d5ff', .7);
  } else {
    c.globalCompositeOperation = 'lighter';
    polygon(c, [[radius + 2, 0], [-6, -5], [-31, flicker * 3], [-8, 5]], color);
    c.strokeStyle = color; c.lineWidth = 1;
    c.beginPath(); c.ellipse(-2, 0, radius + 6, radius + 2, Math.sin(time * 9) * .35, 0, Math.PI * 1.6); c.stroke();
    polygon(c, [[radius + 2, 0], [-2, -radius * .55], [-9, 0], [-2, radius * .55]], '#e6ffe4');
  }
  c.restore();
}
