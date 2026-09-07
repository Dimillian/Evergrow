import type { ActiveGroundEffect } from './ground-effects.ts';
import type { PointLight } from './lighting.ts';
import { drawGlow } from './lighting.ts';
import { line, polygon } from './art-primitives.ts';
import { drawAttackWarning } from './attack-warning-art.ts';
import { PROJECTILE_COLORS } from './projectile-art.ts';

const TAU = Math.PI * 2;
/** A visual sky trajectory ending exactly at the scheduled ground contact. */
export function meteorPose(effect: ActiveGroundEffect) {
  const duration = Math.max(.01, effect.initialDelay ?? .85);
  const progress = Math.max(0, Math.min(1, 1 - effect.delay / duration));
  const descent = Math.max(0, (progress - .15) / .85);
  const height = 460 * (1 - descent ** 1.65);
  return { x: effect.x - height * .34, y: effect.y - height, progress,
    size: (9 + descent * 14) * Math.max(.45, Math.min(2, effect.radius / 125)), opacity: Math.min(1, progress * 7) };
}
export function groundSpellLights(effect: ActiveGroundEffect, reduced = false): PointLight[] {
  const color = PROJECTILE_COLORS[effect.style];
  if (effect.kind === 'meteor' && effect.delay > 0) {
    const p = meteorPose(effect);
    return [{ x: reduced ? effect.x : p.x, y: reduced ? effect.y : p.y, radius: 110 + p.progress * 90, color, power: p.opacity * .85 },
      { x: effect.x, y: effect.y, radius: effect.radius * 1.5, color, power: .12 + p.progress * .5 }];
  }
  const fade = effect.delay > 0 ? .2 : Math.min(1, Math.max(0, effect.duration) / .5);
  return [{ x: effect.x, y: effect.y, radius: effect.radius * 1.4, color, power: fade * (effect.kind === 'embers' ? .5 : .3) }];
}
export function drawGroundSpell(c: CanvasRenderingContext2D, effect: ActiveGroundEffect, time: number, reduced: boolean): void {
  const color = PROJECTILE_COLORS[effect.style], r = effect.radius;
  const progress = effect.delay > 0 ? 1 - effect.delay / Math.max(.01, effect.initialDelay ?? effect.delay) : 1;
  const t = reduced ? 0 : time;
  c.save(); c.translate(effect.x, effect.y);
  if (effect.delay > 0 && effect.kind !== 'embers') {
    drawAttackWarning(c, { kind: 'circle', radius: r }, progress, color, t, reduced);
    if (effect.kind === 'arrowRain') for (let i = 0; i < 16; i++) {
      const a = i * 2.39996 + effect.id, d = Math.sqrt((i + .5) / 16) * r * .88;
      const x = Math.cos(a) * d, y = Math.sin(a) * d, height = reduced ? 20 : 110 * (1 - progress);
      c.globalAlpha = .65 * progress;
      line(c, [[x - height * .24, y - height - 14], [x - height * .24 + 3, y - height]], '#dce8cc', 1.2);
    }
  } else {
    const fade = Math.min(1, Math.max(0, effect.duration) / .45);
    c.globalAlpha = fade;
    if (effect.kind === 'embers') {
      // Scorched islands and fissures occupy the actual circular damage footprint.
      c.fillStyle = '#19130e'; c.globalAlpha = fade * .38;
      c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = i / 40 * TAU, extent = r * (.87 + Math.sin(i * 4.7 + effect.id) * .07);
        if (i === 0) c.moveTo(Math.cos(a) * extent, Math.sin(a) * extent);
        else c.lineTo(Math.cos(a) * extent, Math.sin(a) * extent);
      }
      c.closePath(); c.fill();
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 24; i++) {
        const a = i * 2.39996 + effect.id, distance = Math.sqrt((i + .5) / 24) * r * .9;
        const x = Math.cos(a) * distance, y = Math.sin(a) * distance;
        const pulse = reduced ? .65 : .65 + Math.sin(t * 3 + i * 1.7) * .2;
        c.globalAlpha = fade * pulse;
        line(c, [[x - 7, y + 3], [x - 2, y], [x + 3, y + 1], [x + 9, y - 3]], i % 3 ? '#d95a29' : '#ffbe68', 1.2);
        const lift = reduced ? 6 : 9 + Math.sin(t * 5 + i) * 4;
        polygon(c, [[x - 3, y], [x - 2, y - lift * .5], [x + Math.sin(t * 2 + i) * 3, y - lift], [x + 3, y - 2]], '#f8983d');
        if (i % 4 === 0) drawGlow(c, x, y - 3, 24, '#ff7b36', fade * .15);
      }
    } else {
      drawAttackWarning(c, { kind: 'circle', radius: r }, 1, color, t, reduced);
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 16; i++) {
        const a = i * 2.39996 + effect.id, d = Math.sqrt((i + .5) / 16) * r * .88;
        const x = Math.cos(a) * d, y = Math.sin(a) * d;
        const cycle = reduced ? .65 : effect.kind === 'arrowRain'
          ? Math.max(0, Math.min(1, 1 - effect.tick / effect.interval)) : (t * 1.8 + i * .137) % 1;
        c.globalAlpha = fade * (reduced ? .5 : Math.sin(cycle * Math.PI) * .65);
        if (effect.kind === 'arrowRain') {
          line(c, [[x - (1 - cycle) * 26, y - (1 - cycle) * 110], [x, y]], '#dce8cc', 1.2);
        } else if (effect.kind === 'frost') {
          polygon(c, [[x - 3, y], [x, y - 7 - cycle * 9], [x + 4, y], [x, y + 3]], '#a8e0ee');
        } else {
          line(c, [[x - 8, y - 24 * cycle], [x + 2, y - 14], [x - 2, y - 8], [x + 8, y]], '#a5ccff', 1.1);
        }
      }
    }
  }
  c.restore();
  if (effect.kind === 'meteor' && effect.delay > 0 && !reduced) drawMeteor(c, effect);
}
function drawMeteor(c: CanvasRenderingContext2D, effect: ActiveGroundEffect): void {
  const p = meteorPose(effect), size = p.size;
  c.save(); c.translate(p.x, p.y); c.globalAlpha = p.opacity;
  c.globalCompositeOperation = 'lighter';
  drawGlow(c, 0, 0, size * 4, '#f8772b', .6);
  // Broad hot wake, tapering into isolated embers rather than a rigid beam.
  for (let i = 0; i < 7; i++) {
    const length = 65 + i * 13, spread = Math.sin(i * 4.3) * size;
    c.globalAlpha = p.opacity * (.2 + (i % 3) * .08);
    polygon(c, [[-size * .7, 3], [spread - length * .34, -length], [size * .6, -4]], i % 2 ? '#ff7733' : '#ffce6e');
  }
  c.globalAlpha = p.opacity; c.globalCompositeOperation = 'source-over';
  polygon(c, [[-size, -size * .4], [-size * .3, -size], [size * .6, -size * .6], [size, size * .4], [0, size], [-size * .8, size * .5]], '#493028');
  c.globalCompositeOperation = 'lighter';
  line(c, [[-size * .7, -size * .3], [0, -size * .5], [size * .4, 0], [0, size * .8]], '#ffba62', 3);
  line(c, [[0, -size * .5], [-size * .2, size * .3], [size * .7, size * .4]], '#fff2c4', 2);
  drawGlow(c, size * .2, size * .45, size * 1.3, '#ffce73', .85);
  c.restore();
}
