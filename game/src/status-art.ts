import type { CharacterPose } from './art-types.ts';
import { line, polygon } from './art-primitives.ts';
import { drawGlow } from './lighting.ts';

/** Cues are derived from remaining combat status timers, without adding gameplay state. */
export function drawCharacterStatus(c: CanvasRenderingContext2D, pose: CharacterPose): void {
  if (pose.dead) return;
  if ((pose.frozen ?? 0) > 0) {
    c.save();
    const fade = Math.min(1, pose.frozen! / .2);
    c.globalAlpha *= fade * .46;
    polygon(c, [[-16,0],[-20,-17],[-12,-40],[0,-48],[15,-37],[19,-15],[13,2]], '#77bedc');
    c.globalAlpha = fade * .85;
    line(c, [[-16,0],[-20,-17],[-12,-40],[0,-48],[15,-37],[19,-15],[13,2],[-16,0]], '#c6f4ff', 1.3);
    line(c, [[0,-48],[-4,-24],[13,2],[-4,-24],[-20,-17]], '#e1fbff', .9);
    c.globalAlpha = fade * .6;
    line(c, [[-12,-40],[7,-30],[19,-15]], '#b9eaff', 1.1);
    c.restore();
  } else if ((pose.stunned ?? 0) > 0) {
    c.save();
    const t = pose.effectTime ?? pose.time;
    c.globalAlpha *= Math.min(1, pose.stunned! / .2);
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + i * Math.PI * 2 / 3, x = Math.cos(a) * 12, y = -48 + Math.sin(a) * 4;
      polygon(c, [[x-3,y],[x,y-4],[x+3,y],[x,y+4]], '#f4da92');
    }
    c.restore();
  }
  const frostTime = Math.max(pose.slow ?? 0, pose.chill ?? 0);
  if (frostTime > 0) {
    c.save();
    c.globalAlpha *= Math.min(1, frostTime / .3);
    drawGlow(c, 0, -12, 28, '#75c6e2', .32);
    c.strokeStyle = '#7ed6ec'; c.lineWidth = .9;
    c.beginPath(); c.ellipse(0, 0, 14, 6, 0, .2, Math.PI * 1.8); c.stroke();
    for (let i = 0; i < 6; i++) {
      const x = -11 + i * 4.4, height = 5 + Math.sin(i * 3.7) * 3;
      polygon(c, [[x, 1], [x - 1.8, -height], [x + .6, -height - 3], [x + 1.8, 1]], '#68a6b6');
      line(c, [[x + .6, -height - 3], [x + 1.8, 0]], '#c1f8ff', .8);
    }
    // Crystalline frost flakes floating around body
    for (let i = 0; i < 4; i++) {
      const t = (pose.effectTime ?? pose.time) * 1.2 + i * 1.57;
      const fx = Math.cos(t) * 13, fy = -18 + Math.sin(t * 1.5) * 10;
      polygon(c, [[fx - 2, fy], [fx, fy - 2], [fx + 2, fy], [fx, fy + 2]], '#d9f8ff');
    }
    c.restore();
  }
  if ((pose.burning ?? 0) > 0) {
    c.save();
    c.globalAlpha = Math.min(1, pose.burning! / .25) * .85;
    drawGlow(c, 0, -17, 30, '#ff6020', .35);
    // Fiery ember ring on ground
    c.strokeStyle = '#ff7b39'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(0, 0, 13, 5, 0, 0, Math.PI * 2); c.stroke();
    // Rising flame tongues
    for (let i = 0; i < 5; i++) {
      const phase = ((pose.effectTime ?? pose.time) * 1.8 + i * .21) % 1, x = Math.sin(i * 2.3) * 9;
      const y = -6 - phase * 25, width = 2.8 * Math.sin(phase * Math.PI);
      c.globalAlpha = Math.sin(phase * Math.PI) * .9;
      polygon(c, [[x - width, y], [x - 1, y - 5], [x + Math.sin((pose.effectTime ?? pose.time) * 14 + i) * 2, y - 11], [x + width, y - 2]], '#ed6328');
      line(c, [[x, y], [x, y - 5]], '#ffd464', .9);
    }
    // Floating ember motes
    for (let i = 0; i < 4; i++) {
      const t = (pose.effectTime ?? pose.time) * 2 + i * 1.57;
      const ex = Math.sin(t * 1.3) * 12, ey = -12 - ((t * 8) % 24);
      c.fillStyle = '#ffea78';
      c.fillRect(ex - 1, ey - 1, 2, 2);
    }
    c.restore();
  }
  if ((pose.fracture ?? 0) > 0) {
    c.save();
    c.globalAlpha = Math.min(1, pose.fracture! / .3) * .85;
    drawGlow(c, 0, -15, 24, '#5bb8f5', .25);
    // Cracked jagged armor sparks around body
    for (let i = 0; i < 4; i++) {
      const angle = (pose.effectTime ?? pose.time) * 1.6 + i * (Math.PI / 2);
      const cx = Math.cos(angle) * 14, cy = -16 + Math.sin(angle) * 9;
      line(c, [[cx - 3, cy - 3], [cx, cy], [cx + 3, cy - 2]], '#9ee3ff', 1.2);
    }
    c.restore();
  }
}
