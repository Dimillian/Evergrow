/** Astral Instrument HUD frame; geometry is shared with native input and content. */
import { HUD_ART } from './hud-layout.ts';
import { drawCachedUIArt } from './ui-art-cache.ts';
import { drawHUDEnergy } from './hud-energy.ts';

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

function orbMetal(c: CanvasRenderingContext2D, side: number) {

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

}

function orbGlint(c: CanvasRenderingContext2D, side: number, time: number) {
  const angle = Math.PI * (1.18 + .46 * (.5 + .5 * Math.sin(time * .16 + side)));
  const glintX = Math.cos(angle) * 49.6, glintY = Math.sin(angle) * 49.6;
  const glow = c.createRadialGradient(glintX, glintY, 0, glintX, glintY, 5);
  glow.addColorStop(0, '#a7d5d264'); glow.addColorStop(1, '#79b8c000');
  c.fillStyle = glow; c.fillRect(glintX - 5, glintY - 5, 10, 10);
  star(c, glintX, glintY, 2.2, '#bdd8d9');
}

export function drawHUDOrbFrame(c: CanvasRenderingContext2D, x: number, y: number, side: number, time: number) {
  c.save(); c.translate(x, y);
  drawCachedUIArt(c, `orb:${side}`, -60, -62, 120, 124, art => orbMetal(art, side));
  orbGlint(c, side, time);
  c.restore();
}

function actionTray(c: CanvasRenderingContext2D) {
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

function shortcutRail(c: CanvasRenderingContext2D) {
  const { x, y, width, height } = HUD_ART.rail;
  // One shallow, aligned glass rail; the frame has a single fine silver edge.
  path(c, [x + 5, y, x + width - 5, y, x + width, y + 5,
    x + width, y + height - 4, x + width - 5, y + height,
    x + 5, y + height, x, y + height - 4, x, y + 5]);
  const glass = c.createLinearGradient(0, y, 0, y + height);
  glass.addColorStop(0, '#273c47f5'); glass.addColorStop(.12, '#14232dee');
  glass.addColorStop(.65, '#0b171ff2'); glass.addColorStop(1, '#10222af5');
  c.fillStyle = glass; c.fill(); c.strokeStyle = '#536f7b'; c.lineWidth = .65; c.stroke();
  const edge = c.createLinearGradient(x, 0, x + width, 0);
  edge.addColorStop(0, '#7d9aa740'); edge.addColorStop(.2, '#a2b8bcbb');
  edge.addColorStop(.5, '#b9d0cd'); edge.addColorStop(.8, '#a2b8bcbb'); edge.addColorStop(1, '#7d9aa740');
  c.beginPath(); c.moveTo(x + 6, y + .5); c.lineTo(x + width - 6, y + .5);
  c.strokeStyle = edge; c.lineWidth = .6; c.stroke();
  c.beginPath(); c.moveTo(x + 8, y + height - 1.2); c.lineTo(x + width - 8, y + height - 1.2);
  c.strokeStyle = '#6ca2aa45'; c.lineWidth = .55; c.stroke();
  // Quiet separators distinguish utilities from navigation without nested boxes.
  for (const divider of [182, 338]) {
    c.beginPath(); c.moveTo(divider, y + 5); c.lineTo(divider, y + height - 5);
    c.strokeStyle = '#8babb94a'; c.lineWidth = .55; c.stroke();
    c.fillStyle = '#9ab9be'; c.fillRect(divider - .5, y + height / 2 - .5, 1, 1);
  }
  for (const side of [-1, 1]) {
    const end = side < 0 ? x : x + width;
    c.beginPath(); c.moveTo(end - side * 6, y + 1.4); c.lineTo(end - side * 1.4, y + 5);
    c.lineTo(end - side * 1.4, y + 10); c.strokeStyle = '#b4c7c7'; c.lineWidth = .65; c.stroke();
  }

  // A small suspended compass diamond replaces the tall medallion and supports.
  const crest = HUD_ART.crest;
  c.save(); c.translate(crest.x, crest.y);
  path(c, [0, -crest.radius, 5, 0, 0, crest.radius, -5, 0]);
  c.fillStyle = '#10242c'; c.fill(); c.strokeStyle = '#739da9'; c.lineWidth = .6; c.stroke();
  star(c, 0, 0, 4.4, '#b8d9d8');
  c.beginPath(); c.moveTo(0, crest.radius + 1); c.lineTo(0, 9);
  c.strokeStyle = '#88b7ba70'; c.lineWidth = .55; c.stroke();
  for (const side of [-1, 1]) {
    c.beginPath(); c.moveTo(side * 9, 2); c.lineTo(side * 23, 7); c.lineTo(side * 37, 7);
    c.strokeStyle = '#7c9daa60'; c.lineWidth = .5; c.stroke();
    star(c, side * 24, 7, 1.5, '#9dbcbf');
  }
  c.restore();
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
  const t = Number.isFinite(time) ? time : 0;
  drawHUDEnergy(c, t);
  drawCachedUIArt(c, 'frame', 0, 0, HUD_ART.width, HUD_ART.height, art => {
    art.lineCap = 'round'; art.lineJoin = 'round';
    actionTray(art); shortcutRail(art);
    for (const side of [-1, 1]) {
      art.save(); art.translate(side < 0 ? HUD_ART.orb.left : HUD_ART.orb.right, HUD_ART.orb.y);
      orbMetal(art, side); art.restore();
    }
    resourceShelf(art, HUD_ART.orb.left); resourceShelf(art, HUD_ART.orb.right);
  });
  for (const side of [-1, 1]) {
    c.save(); c.translate(side < 0 ? HUD_ART.orb.left : HUD_ART.orb.right, HUD_ART.orb.y);
    orbGlint(c, side, t); c.restore();
  }
  c.restore();
}
