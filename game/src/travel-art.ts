import type { PortalAnchor } from './travel.ts';

/** Layered procedural rings, threads and motes; no images or simulation-owned particles. */
export function drawPortal(c: CanvasRenderingContext2D, x: number, y: number, time: number, progress = 1, color = '#b5a0ee', reduced = false) {
  const t = reduced ? 0 : time, p = Math.max(0, Math.min(1, progress));
  c.save(); c.translate(x, y);
  c.fillStyle = '#080e1cb0'; c.beginPath(); c.ellipse(0, 1, 32, 13, 0, 0, Math.PI * 2); c.fill();
  for (let ring = 0; ring < 2; ring++) {
    c.strokeStyle = ring ? '#d8d8d788' : color; c.lineWidth = ring ? .6 : 1.3;
    c.beginPath(); c.ellipse(0, 0, 25 + ring * 7, 9 + ring * 4, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); c.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6; c.strokeStyle = '#cad3df88'; c.beginPath();
    c.moveTo(Math.cos(a) * 28, Math.sin(a) * 11); c.lineTo(Math.cos(a) * 32, Math.sin(a) * 14); c.stroke();
  }
  c.globalCompositeOperation = 'lighter';
  const height = 26 + p * 38, cy = -height * .51;
  const glow = c.createRadialGradient(0, cy, 1, 0, cy, height * .65);
  glow.addColorStop(0, `${color}24`); glow.addColorStop(1, `${color}00`);
  c.fillStyle = glow; c.fillRect(-48, -height - 20, 96, height + 34);
  for (let i = 0; i < 5; i++) {
    const phase = t * (.4 + i * .035) + i * 1.256;
    c.lineWidth = i === 0 ? 1.6 : .75; c.strokeStyle = i === 0 ? '#cec5ea' : `${color}99`;
    c.beginPath();
    for (let j = 0; j <= 65; j++) {
      const a = j / 65 * Math.PI * 2, wave = Math.sin(a * 4 + phase * 2) * (reduced ? .5 : 1.6);
      const px = Math.cos(a) * (18 + i * .65 + wave), py = cy + Math.sin(a) * height * .5;
      if (j === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
  }
  for (let i = 0; i < 24; i++) {
    const f = (i / 24 + t * .15) % 1, a = i * 2.39996 + t * .6;
    c.globalAlpha = Math.sin(f * Math.PI) * .75; c.fillStyle = i % 4 === 0 ? '#eff2fa' : color;
    c.fillRect(Math.cos(a) * (45 - f * 30), -f * height + Math.sin(a) * 8, i % 4 === 0 ? 2 : 1, 2);
  }
  c.restore();
}
export function drawTownAnchor(c: CanvasRenderingContext2D, anchor: PortalAnchor, home: boolean) {
  c.save(); c.translate(anchor.x, anchor.y);
  c.fillStyle = '#101c22'; c.beginPath(); c.ellipse(0, 0, 35, 16, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = home ? '#aba1cb' : '#697579'; c.lineWidth = 1.5; c.stroke();
  c.beginPath(); c.ellipse(0, -2, 27, 11, 0, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    c.beginPath(); c.moveTo(Math.cos(a) * 30, Math.sin(a) * 13); c.lineTo(Math.cos(a) * 35, Math.sin(a) * 16); c.stroke();
  }
  c.strokeStyle = home ? '#d7ccef' : '#7e939d'; c.beginPath();
  c.moveTo(0, -11); c.lineTo(8, -2); c.lineTo(0, 7); c.lineTo(-8, -2); c.closePath(); c.stroke(); c.restore();
}
