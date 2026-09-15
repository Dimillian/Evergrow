import { polygon, type Point } from './art-primitives.ts';

/** Ground origin uses the portrait's own fitted rig, so every loadout stands on the stones. */
export function drawTitlePlinth(c: CanvasRenderingContext2D): void {
  const ring = (rx: number, ry: number, y: number): Point[] => Array.from({ length: 12 }, (_, i) => {
    const angle = i / 12 * Math.PI * 2;
    return [Math.cos(angle) * rx, y + Math.sin(angle) * ry];
  });
  polygon(c, ring(25, 7.8, 6), '#111e22');
  polygon(c, ring(24, 7, 3.5), '#344443');
  polygon(c, ring(22, 6, 1.8), '#5b6b63');
  const upper = ring(22, 6, 1.8);
  for (let i = 0; i < upper.length; i++) {
    polygon(c, [[0, 1.8], upper[i], upper[(i + 1) % upper.length]], ['#58665e', '#414f4d', '#6a7668', '#4b5d55'][i % 4]);
    c.strokeStyle = '#182a2c'; c.lineWidth = .35;
    c.beginPath(); c.moveTo(0, 1.8); c.lineTo(...upper[i]); c.stroke();
  }
  c.strokeStyle = '#94a38a70'; c.lineWidth = .4;
  c.beginPath(); c.ellipse(0, 1.8, 21, 5.5, 0, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 12; i++) {
    const x = Math.cos(i * 2.3) * 22, y = 4 + Math.sin(i * 2.3) * 6;
    polygon(c, [[x - 2, y], [x, y - 1], [x + 2, y], [x + .5, y + 1]], i % 2 ? '#48664d' : '#304f40');
  }
}
