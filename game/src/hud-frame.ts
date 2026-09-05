/** Astral Instrument HUD frame; geometry is shared with native input and content. */
import { HUD_ARM, HUD_ART } from './hud-layout.ts';

const TAU = Math.PI * 2;

function path(c: CanvasRenderingContext2D, points: readonly number[]) {
  c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
}

function star(c: CanvasRenderingContext2D, x: number, y: number, radius: number, silver = '#a8bfc5') {
  c.beginPath();
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8 - Math.PI / 2;
    const r = i % 2 ? radius * .17 : i % 4 ? radius * .45 : radius;
    const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath(); c.fillStyle = silver; c.fill();
}

function arc(c: CanvasRenderingContext2D, radius: number, start: number, end: number, color: string, width = 1) {
  c.beginPath(); c.arc(0, 0, radius, start, end); c.strokeStyle = color; c.lineWidth = width; c.stroke();
}

function metal(c: CanvasRenderingContext2D, top: number, bottom: number) {
  const gradient = c.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, '#80969f');
  gradient.addColorStop(.045, '#3b4f5b');
  gradient.addColorStop(.13, '#233039');
  gradient.addColorStop(.53, '#101b23');
  gradient.addColorStop(.91, '#0a131b');
  gradient.addColorStop(1, '#344852');
  return gradient;
}

function glassInstrument(c: CanvasRenderingContext2D, x: number, side: number, time: number) {
  c.save(); c.translate(x, 79);

  // Nested, calibrated circles surround an unobstructed 36.6-radius glass area.
  c.beginPath(); c.arc(0, 0, 43.5, 0, TAU); c.arc(0, 0, 37.5, 0, TAU, true);
  c.fillStyle = metal(c, -44, 44); c.fill('evenodd');
  arc(c, 43.5, 0, TAU, '#0a1119', 1.5);
  arc(c, 42.7, Math.PI * 1.05, Math.PI * 1.95, '#a1b7be', .8);
  arc(c, 42.6, .02, Math.PI * .98, '#405660', .7);
  arc(c, 38.2, 0, TAU, '#b4c8cc', .7);
  arc(c, 39.3, 0, TAU, '#07121b', 1);
  arc(c, 40.8, 0, TAU, '#425c68', .5);

  // The outer scale is an open horseshoe: the readout is suspended below it.
  arc(c, 49.7, Math.PI * .72, Math.PI * 2.28, '#12212c', 3.4);
  arc(c, 50.8, Math.PI * .72, Math.PI * 2.28, '#627e89', .7);
  arc(c, 47.8, Math.PI * .72, Math.PI * 2.28, '#283f4b', .7);
  for (let i = 0; i <= 40; i++) {
    const angle = Math.PI * (.73 + i / 40 * 1.54);
    const major = i % 5 === 0, r = major ? 45.5 : 47.8;
    c.beginPath(); c.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    c.lineTo(Math.cos(angle) * 50.2, Math.sin(angle) * 50.2);
    c.strokeStyle = major ? '#91aab1' : '#4f6977'; c.lineWidth = major ? .8 : .55; c.stroke();
  }

  // A tilted orbital hoop, with a real aperture rather than decorative spokes.
  c.beginPath(); c.ellipse(0, 0, 55.4, 41.9, side * -.43, 0, TAU);
  c.strokeStyle = '#030a12'; c.lineWidth = 2.9; c.stroke();
  c.strokeStyle = '#66858f'; c.lineWidth = .85; c.stroke();
  c.beginPath(); c.ellipse(0, 0, 55.4, 41.9, side * -.43, Math.PI * 1.06, Math.PI * 1.78);
  c.strokeStyle = '#c1d2d4'; c.lineWidth = .85; c.stroke();
  for (const angle of [Math.PI * 1.08, Math.PI * 1.83]) {
    const dx = Math.cos(angle) * 48.8, dy = Math.sin(angle) * 48.8;
    c.beginPath(); c.arc(dx, dy, 2.5, 0, TAU); c.fillStyle = '#0c1721'; c.fill();
    c.strokeStyle = '#809ba4'; c.lineWidth = .7; c.stroke();
    c.beginPath(); c.arc(dx, dy, .8, 0, TAU); c.fillStyle = '#c6d5d4'; c.fill();
  }

  // Enamel zenith clasp and a small asymmetrical crescent in the upper scale.
  path(c, [-4, -52, 0, -58, 4, -52, 2.5, -45, -2.5, -45]);
  c.fillStyle = '#101d2a'; c.fill(); c.strokeStyle = '#8ca8b2'; c.lineWidth = .8; c.stroke();
  path(c, [-1.7, -52, 0, -55.2, 1.7, -52, 0, -48]);
  c.fillStyle = side < 0 ? '#6c9aaa' : '#82b0ac'; c.fill();
  const moonX = side * 25, moonY = -37.3;
  c.beginPath(); c.arc(moonX, moonY, 3.6, -.9, Math.PI * 1.1);
  c.bezierCurveTo(moonX - 1.8, moonY + 2, moonX - 1, moonY - 2.4, moonX + 2.2, moonY - 2.8);
  c.closePath(); c.fillStyle = '#afc4ca'; c.fill();

  const angle = Math.PI * (1.18 + .46 * (.5 + .5 * Math.sin(time * .16 + side)));
  const glintX = Math.cos(angle) * 49.6, glintY = Math.sin(angle) * 49.6;
  const glow = c.createRadialGradient(glintX, glintY, 0, glintX, glintY, 5);
  glow.addColorStop(0, '#a7d5d264'); glow.addColorStop(1, '#79b8c000');
  c.fillStyle = glow; c.fillRect(glintX - 5, glintY - 5, 10, 10);
  star(c, glintX, glintY, 2.2, '#bdd8d9');
  c.restore();
}

function actionTray(c: CanvasRenderingContext2D) {
  // Broad, gently swept shoulders terminate underneath the orb collars.
  for (const side of [-1, 1]) {
    const { upper, lower } = HUD_ARM;
    c.save(); c.translate(HUD_ARM.center, 0); c.scale(side, 1);
    c.beginPath(); c.moveTo(upper[0], upper[1]);
    c.bezierCurveTo(upper[2], upper[3], upper[4], upper[5], upper[6], upper[7]);
    c.lineTo(lower[0], lower[1]);
    c.bezierCurveTo(lower[2], lower[3], lower[4], lower[5], lower[6], lower[7]); c.closePath();
    c.fillStyle = metal(c, 82, 114); c.fill(); c.strokeStyle = '#4c6572'; c.lineWidth = .75; c.stroke();
    // One inset glint follows the same shallow sweep; no exposed hinge or loose tip.
    c.beginPath(); c.moveTo(127, 85); c.bezierCurveTo(139, 85, 149, 86, 166, 86);
    c.strokeStyle = '#77929a'; c.lineWidth = .55; c.stroke();
    c.beginPath(); c.moveTo(130, 90); c.bezierCurveTo(142, 93, 154, 94, 166, 94);
    c.strokeStyle = '#172b36'; c.lineWidth = .8; c.stroke();
    c.restore();
  }

  // Separate black-steel leaves; shared controls cover the recessed centers.
  const skill = HUD_ART.skill;
  for (let i = 0; i < skill.count; i++) {
    const x = skill.x + i * skill.step - 2, width = skill.width + 4;
    const top = 66, bottom = 133;
    path(c, [x + 5, top, x + width - 5, top, x + width, top + 5, x + width, bottom - 5,
      x + width - 7, bottom, x + 7, bottom, x, bottom - 5, x, top + 5]);
    c.fillStyle = metal(c, top, bottom); c.fill(); c.strokeStyle = '#344c59'; c.lineWidth = .9; c.stroke();
    c.beginPath(); c.moveTo(x + 5, top + .5); c.lineTo(x + width - 5, top + .5);
    c.strokeStyle = '#7e969f'; c.lineWidth = .6; c.stroke();
    c.strokeStyle = '#09121a'; c.lineWidth = 1.2;
    c.strokeRect(x + 1.5, skill.y - 1, width - 3, skill.height + 2.2);
    c.beginPath(); c.moveTo(x + 9, bottom - 2.5); c.lineTo(x + width - 9, bottom - 2.5);
    c.strokeStyle = '#526e7a'; c.lineWidth = .65; c.stroke();
    // Small blue enamel inlays lie below the action well, never over its contents.
    c.fillStyle = i % 2 ? '#709e9d' : '#5d8297'; c.fillRect(x + width / 2 - 3, 129.5, 6, 1);
    for (const px of [x + 7, x + width - 7]) {
      c.fillStyle = '#172733'; c.fillRect(px - 1.2, top + 1.8, 2.4, 1.1);
      c.fillStyle = '#657e87'; c.fillRect(px - .55, top + 1.8, 1.1, .55);
    }
  }

}

function utilityPlates(c: CanvasRenderingContext2D) {
  const { left, right, y, width, height } = HUD_ART.utility;
  for (const x of [left, right]) {
    // Shallow instrument plates flank navigation, leaving icon and binding clear.
    path(c, [x + 4, y, x + width - 4, y, x + width, y + 4,
      x + width, y + height - 4, x + width - 4, y + height,
      x + 4, y + height, x, y + height - 4, x, y + 4]);
    c.fillStyle = metal(c, y, y + height); c.fill();
    c.strokeStyle = '#526b77'; c.lineWidth = .85; c.stroke();
    c.beginPath(); c.moveTo(x + 5, y + .8); c.lineTo(x + width - 5, y + .8);
    c.strokeStyle = '#6d8792'; c.lineWidth = .55; c.stroke();
    c.beginPath(); c.moveTo(x + 5, y + height - 1.6); c.lineTo(x + width - 5, y + height - 1.6);
    c.strokeStyle = '#263f4d'; c.stroke();
    for (const px of [x + 3, x + width - 3]) {
      c.beginPath(); c.moveTo(px, y + 7); c.lineTo(px, y + height - 7);
      c.strokeStyle = '#344c59'; c.lineWidth = .5; c.stroke();
    }
  }
}

function crown(c: CanvasRenderingContext2D) {
  // Quiet navigation shelf, hung above the tray on a pair of curved supports.
  c.beginPath(); c.moveTo(189, 54); c.bezierCurveTo(188, 59, 180, 61, 173, 62);
  c.moveTo(331, 54); c.bezierCurveTo(332, 59, 340, 61, 347, 62);
  c.strokeStyle = '#1e3340'; c.lineWidth = 3; c.stroke();
  c.strokeStyle = '#455e6b'; c.lineWidth = .6; c.stroke();
  c.beginPath(); c.moveTo(181, 29); c.quadraticCurveTo(181, 24, 188, 24);
  c.lineTo(249, 24); c.quadraticCurveTo(260, 20, 271, 24);
  c.lineTo(332, 24); c.quadraticCurveTo(339, 24, 339, 29);
  c.lineTo(339, 51); c.quadraticCurveTo(339, 56, 332, 56);
  c.lineTo(188, 56); c.quadraticCurveTo(181, 56, 181, 51); c.closePath();
  const shelf = c.createLinearGradient(0, 24, 0, 56);
  shelf.addColorStop(0, '#354b56'); shelf.addColorStop(.12, '#15242e'); shelf.addColorStop(1, '#0a151ef5');
  c.fillStyle = shelf; c.fill(); c.strokeStyle = '#3c5663'; c.lineWidth = .7; c.stroke();
  c.beginPath(); c.moveTo(190, 25.3); c.lineTo(247, 25.3);
  c.moveTo(273, 25.3); c.lineTo(330, 25.3);
  c.strokeStyle = '#6d8792'; c.lineWidth = .55; c.stroke();
  c.beginPath(); c.moveTo(190, 54.3); c.lineTo(330, 54.3);
  c.strokeStyle = '#263f4d'; c.stroke();

  // The polar star is an engraved astronomical insignia, not a control.
  c.beginPath(); c.arc(260, 13.5, 8.7, 0, TAU); c.fillStyle = '#0b1722'; c.fill();
  c.strokeStyle = '#7898a6'; c.lineWidth = .75; c.stroke();
  c.beginPath(); c.arc(260, 13.5, 6.5, 0, TAU); c.strokeStyle = '#304f5d'; c.lineWidth = .5; c.stroke();
  star(c, 260, 13.5, 7.6, '#b1c8cd');
  c.beginPath(); c.arc(260, 13.5, 1.3, 0, TAU); c.fillStyle = '#83b6b3'; c.fill();
  for (const side of [-1, 1]) {
    c.beginPath(); c.moveTo(260 + side * 13, 14); c.lineTo(260 + side * 30, 18);
    c.lineTo(260 + side * 53, 18); c.lineTo(260 + side * 62, 22);
    c.strokeStyle = '#536f7d'; c.lineWidth = .65; c.stroke();
    star(c, 260 + side * 34, 18, 2.2, '#94afb8');
    c.beginPath(); c.arc(260 + side * 53, 18, 1.1, 0, TAU); c.fillStyle = '#8eafb3'; c.fill();
  }
}

function resourceShelf(c: CanvasRenderingContext2D, x: number) {
  // Opaque backing masks the lower orbit and leaves the full numeric line clear.
  c.beginPath(); c.moveTo(x - 34, 122); c.quadraticCurveTo(x, 121, x + 34, 122);
  c.lineTo(x + 30, 141); c.quadraticCurveTo(x, 143, x - 30, 141); c.closePath();
  c.fillStyle = metal(c, 121, 141); c.fill(); c.strokeStyle = '#4a6573'; c.lineWidth = .8; c.stroke();
  c.beginPath(); c.moveTo(x - 25, 122); c.quadraticCurveTo(x, 120.4, x + 25, 122);
  c.strokeStyle = '#90aab3'; c.lineWidth = .65; c.stroke();
  c.beginPath(); c.moveTo(x - 20, 140); c.quadraticCurveTo(x, 141.5, x + 20, 140);
  c.strokeStyle = '#718e99'; c.lineWidth = .6; c.stroke();
}

/** The Astral Instrument: calibrated silver circles and suspended black-steel leaves. */
export function drawHUDFrame(c: CanvasRenderingContext2D, time: number): void {
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  actionTray(c);
  crown(c);
  utilityPlates(c);
  const t = Number.isFinite(time) ? time : 0;
  glassInstrument(c, 61, -1, t);
  glassInstrument(c, 459, 1, t);
  resourceShelf(c, 61); resourceShelf(c, 459);
  c.restore();
}
