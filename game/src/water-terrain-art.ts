import type { WaterSampler } from './water-simulation.ts';
/** Fine static shoreline contours and submerged stones are baked into the terrain cache. */
export function drawWaterTerrain(c: CanvasRenderingContext2D, left: number, top: number, size: number, sample: WaterSampler) {
  const step = 8;
  c.save(); c.translate(-left, -top); c.lineCap = 'round';
  for (let y = top - step; y <= top + size; y += step) for (let x = left - step; x <= left + size; x += step) {
    const a = sample(x, y), b = sample(x + step, y), d = sample(x, y + step), e = sample(x + step, y + step);
    if (a.coverage + b.coverage + d.coverage + e.coverage === 0) continue;
    const corners = [[x, y, a.coverage], [x + step, y, b.coverage], [x + step, y + step, e.coverage], [x, y + step, d.coverage]];
    const crossings: number[][] = [];
    for (let i = 0; i < 4; i++) {
      const p = corners[i], q = corners[(i + 1) % 4];
      if ((p[2] >= .45) === (q[2] >= .45)) continue;
      const t = (.45 - p[2]) / (q[2] - p[2]); crossings.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
    if (crossings.length === 2) {
      c.strokeStyle = '#071f2760'; c.lineWidth = 4; c.beginPath(); c.moveTo(...crossings[0] as [number, number]); c.lineTo(...crossings[1] as [number, number]); c.stroke();
      c.strokeStyle = '#94b3a452'; c.lineWidth = 1; c.stroke();
    }
    const random = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, pick = random - Math.floor(random);
    if (a.coverage > .75 && a.depth < .8 && pick > .77) {
      const px = x + pick * 5, py = y + pick * 3, r = 1 + pick * 3;
      c.fillStyle = '#112d3660'; c.beginPath(); c.ellipse(px, py, r * 1.4, r * .65, pick * 2, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#88afa330'; c.lineWidth = .7; c.beginPath(); c.moveTo(px - r, py - .7); c.lineTo(px + r * .5, py - r * .5); c.stroke();
    }
  }
  c.restore();
}
