import type { CharacterPose } from './art-types.ts';
import { line, polygon } from './art-primitives.ts';
import { drawGlow } from './lighting.ts';

/** Cues are derived from remaining combat status timers, without adding gameplay state. */
export function drawCharacterStatus(c: CanvasRenderingContext2D, pose: CharacterPose): void {
  if (pose.dead) return;
  c.save();
  if ((pose.frozen ?? 0) > 0) {
    const fade = Math.min(1, pose.frozen! / .2);
    c.globalAlpha *= fade * .46;
    polygon(c, [[-16,0],[-20,-17],[-12,-40],[0,-48],[15,-37],[19,-15],[13,2]], '#77bedc');
    c.globalAlpha = fade * .85;
    line(c, [[-16,0],[-20,-17],[-12,-40],[0,-48],[15,-37],[19,-15],[13,2],[-16,0]], '#c6f4ff', 1.3);
    line(c, [[0,-48],[-4,-24],[13,2],[-4,-24],[-20,-17]], '#e1fbff', .9);
    c.globalAlpha = fade * .6;
    line(c, [[-12,-40],[7,-30],[19,-15]], '#b9eaff', 1.1);
  } else if ((pose.stunned ?? 0) > 0) {
    const t = pose.effectTime ?? pose.time;
    c.globalAlpha *= Math.min(1, pose.stunned! / .2);
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + i * Math.PI * 2 / 3, x = Math.cos(a) * 12, y = -48 + Math.sin(a) * 4;
      polygon(c, [[x-3,y],[x,y-4],[x+3,y],[x,y+4]], '#f4da92');
    }
  }
  if ((pose.slow ?? 0) > 0) {
    c.globalAlpha *= Math.min(1, pose.slow! / .3);
    drawGlow(c, 0, -8, 25, '#75c6e2', .2);
    c.strokeStyle = '#7ed6ec'; c.lineWidth = .7;
    c.beginPath(); c.ellipse(0, 0, 12, 5, 0, .2, Math.PI * 1.8); c.stroke();
    for (let i = 0; i < 5; i++) {
      const x = -9 + i * 4.5, height = 4 + Math.sin(i * 4) * 2;
      polygon(c, [[x, 1], [x - 1.4, -height], [x + .5, -height - 2], [x + 1.5, 1]], '#68a6b6');
      line(c, [[x + .5, -height - 2], [x + 1.5, 0]], '#c1f8ff', .6);
    }
  }
  if ((pose.burning ?? 0) > 0) {
    c.globalAlpha = Math.min(1, pose.burning! / .25) * .8;
    drawGlow(c, 0, -17, 25, '#ff7541', .22);
    for (let i = 0; i < 4; i++) {
      const phase = ((pose.effectTime ?? pose.time) * 1.6 + i * .23) % 1, x = Math.sin(i * 2.7) * 8;
      const y = -7 - phase * 22, width = 2.3 * Math.sin(phase * Math.PI);
      c.globalAlpha = Math.sin(phase * Math.PI) * .85;
      polygon(c, [[x - width, y], [x - 1, y - 4], [x + Math.sin((pose.effectTime ?? pose.time) * 15 + i) * 2, y - 9], [x + width, y - 2]], '#ed793c');
      line(c, [[x, y], [x, y - 4]], '#f7cc72', .7);
    }
  }
  c.restore();
}
