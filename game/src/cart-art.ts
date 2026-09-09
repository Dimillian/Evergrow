import type { Building } from './settlements.ts';

type Point = readonly [number, number];

/** A shallow cargo box on a rear axle, with independent shafts toward the street. */
export function drawSupplyCart(c: CanvasRenderingContext2D, b: Building): void {
  c.save();
  c.translate(b.x, b.y);
  c.scale(b.width / 34, b.height / 48);
  // Slightly oblique ground projection exposes the box sides without rotating its footprint.
  const p = (x: number, depth: number, height = 0): Point => [x + depth * .28 + 1, depth * .72 - height + 8];
  const face = (points: readonly Point[], color: string): void => {
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath(); c.fillStyle = color; c.fill();
  };
  const line = (points: readonly Point[], color: string, width: number): void => {
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.strokeStyle = color; c.lineWidth = width; c.stroke();
  };
  const wheel = (x: number): void => {
    const [cx, cy] = p(x, 11, 10);
    c.save(); c.translate(cx, cy); c.rotate(-.12);
    // Open spokes: the ground stays visible between the rim and the wooden hub.
    c.beginPath(); c.ellipse(0, 0, 5.7, 13, 0, 0, Math.PI * 2);
    c.strokeStyle = '#303a37'; c.lineWidth = 3; c.stroke();
    c.strokeStyle = '#a18759'; c.lineWidth = 1.6; c.stroke();
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      line([[0, 0], [Math.cos(angle) * 5.2, Math.sin(angle) * 12.1]], '#93764e', 1.3);
    }
    c.fillStyle = '#52412f'; c.beginPath(); c.ellipse(0, 0, 2.7, 3.4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c4b18a'; c.fillRect(-1, -1.3, 1.7, 2.3);
    c.restore();
  };

  // One grounded shadow beneath the load and wheels, rather than a blob at the handles.
  face([p(-6, 0), p(29, 0), p(31, 31), p(1, 36), p(-5, 23)], '#08100d50');
  line([p(1, 25), p(1, 52)], '#08100d40', 3);
  line([p(22, 25), p(22, 52)], '#08100d40', 3);
  wheel(28);
  line([p(-4, 11, 10), p(29, 11, 10)], '#494033', 3.8);

  // Shafts attach under the bed and extend separately; no chair-like front crossbar.
  for (const x of [1, 22]) {
    line([p(x, 12, 9), p(x, 34, 7), p(x, 52, 4)], '#54432e', 3.8);
    line([p(x - .7, 15, 10), p(x - .7, 34, 8), p(x - .7, 51, 5)], '#ad8b57', 1.1);
    line([p(x, 46, 4.9), p(x, 52, 4)], '#665540', 2.6);
  }
  line([p(4, 28, 9), p(4, 30, 0)], '#5e4933', 2.5);

  // Interior floor, far side and rear headboard.
  face([p(0, 0, 10), p(24, 0, 10), p(24, 30, 10), p(0, 30, 10)], '#59432e');
  for (let x = 0; x < 24; x += 4) {
    face([p(x, 1, 10), p(x + 3.5, 1, 10), p(x + 3.5, 29, 10), p(x, 29, 10)], x % 8 ? '#927147' : '#80633e');
  }
  face([p(24, 0, 10), p(24, 30, 10), p(24, 30, 20), p(24, 0, 23)], '#514333');
  face([p(0, 0, 10), p(24, 0, 10), p(24, 0, 23), p(0, 0, 23)], '#7d6241');
  line([p(1, 0, 16), p(23, 0, 16)], '#4d3d2c', .8);
  line([p(0, 0, 23), p(24, 0, 23), p(24, 30, 20)], '#b19461', 2);

  // A tied sack and a small braced crate leave some of the cargo bed visible.
  const sack = b.seed % 2 ? '#9c9676' : '#a79a78';
  face([p(3, 5, 11), p(2, 10, 22), p(5, 9, 30), p(10, 9, 30), p(14, 11, 20), p(13, 17, 11), p(5, 18, 11)], sack);
  face([p(10, 9, 30), p(14, 11, 20), p(13, 17, 11), p(10, 16, 13)], '#736e55');
  line([p(5, 9, 28), p(10, 9, 28)], '#514b36', 1.4);
  line([p(5, 11, 23), p(4, 14, 16)], '#c2b68f', .8);
  face([p(14, 15, 10), p(22, 15, 10), p(22, 25, 10), p(14, 25, 10)], '#6c5035');
  face([p(14, 15, 20), p(22, 15, 20), p(22, 25, 20), p(14, 25, 20)], '#a88955');
  face([p(14, 15, 10), p(14, 25, 10), p(14, 25, 20), p(14, 15, 20)], '#7d613c');
  face([p(14, 25, 10), p(22, 25, 10), p(22, 25, 20), p(14, 25, 20)], '#8e7046');
  line([p(15, 25, 11), p(21, 25, 19)], '#c0a16a', 1.5);
  line([p(18, 15, 20), p(18, 25, 20)], '#5d4c34', .8);

  // Near side planks and the low tailgate occlude cargo at the same projected height.
  face([p(0, 0, 10), p(0, 30, 10), p(0, 30, 20), p(0, 0, 23)], '#8c6d43');
  line([p(0, 0, 16), p(0, 30, 15)], '#51402d', .8);
  line([p(0, 0, 23), p(0, 30, 20)], '#c0a16d', 2);
  face([p(0, 30, 10), p(24, 30, 10), p(24, 30, 19), p(0, 30, 19)], '#816039');
  line([p(0, 30, 19), p(24, 30, 19)], '#b89a65', 1.6);
  line([p(1, 30, 14), p(23, 30, 14)], '#54412d', .8);
  for (const x of [1, 22]) {
    line([p(x, 30, 10), p(x, 30, 19)], '#424740', 1.7);
    const [nx, ny] = p(x, 30, 17); c.fillStyle = '#b7b198'; c.fillRect(nx - .5, ny - .5, 1, 1);
  }
  wheel(-4);
  c.restore();
}
