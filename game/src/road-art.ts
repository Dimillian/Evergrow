type RoadSample = { road: number; paved: number };
const COLUMN = 19, ROW = 12;
const UINT_RANGE = 0x100000000;
const STONE_COLORS = ['#4c514a', '#53534a', '#514d43', '#444c48', '#58564c', '#464941'];
const GRAVEL_COLORS = ['#747368', '#625f53', '#858071'];

function hash(x: number, y: number, seed: number, salt = 0): number {
  let value = (seed ^ salt ^ Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(y | 0, 0x27d4eb2d)
    ^ Math.imul(Math.floor(x / UINT_RANGE), 0x165667b1)
    ^ Math.imul(Math.floor(y / UINT_RANGE), 0x85ebca77)) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x7feb352d);
  value = Math.imul(value ^ value >>> 15, 0x846ca68b);
  return (value ^ value >>> 16) >>> 0;
}

function random(x: number, y: number, seed: number, salt: number): number {
  return hash(x, y, seed, salt) / UINT_RANGE;
}

function smooth(low: number, high: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

function wearNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const tx = smooth(0, 1, x - ix), ty = smooth(0, 1, y - iy);
  const a = random(ix, iy, seed, 703), b = random(ix + 1, iy, seed, 703);
  const c = random(ix, iy + 1, seed, 703), d = random(ix + 1, iy + 1, seed, 703);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

function stonePath(c: CanvasRenderingContext2D, x: number, y: number,
  width: number, height: number, corner: number, skew: number, nick: number) {
  c.beginPath(); c.moveTo(x + corner, y);
  if (nick > 0) {
    c.lineTo(x + width * .58 - 1, y + skew * .45);
    c.lineTo(x + width * .58, y + skew * .5 + nick);
    c.lineTo(x + width * .58 + 1.3, y + skew * .55);
  }
  c.lineTo(x + width - corner * .7, y + skew);
  c.lineTo(x + width, y + corner * .8 + skew);
  c.lineTo(x + width - .3, y + height - corner);
  c.lineTo(x + width - corner * 1.3, y + height);
  c.lineTo(x + width * .42, y + height - .25);
  c.lineTo(x + corner * .8, y + height - .1);
  c.lineTo(x, y + height - corner * .9);
  c.lineTo(x + .2, y + corner); c.closePath();
}

/**
 * A crop of one world-anchored illustration, not an independently tiled pattern.
 * The context is tile-local; the sampler receives world coordinates and should
 * exclude a 10px margin around interiors to accommodate each complete stone.
 */
export function drawRoadDetails(c: CanvasRenderingContext2D, originX: number, originY: number,
  tileSize: number, seed: number, sample: (x: number, y: number) => RoadSample): void {
  if (tileSize <= 0) return;
  c.save(); c.beginPath(); c.rect(0, 0, tileSize, tileSize); c.clip();
  const alpha = c.globalAlpha;
  // These margins include jitter, chipped edges and scuffs on neighbouring
  // cells. A 256px tile visits at most 384 cells, with one material query each.
  const firstRow = Math.floor((originY - 8) / ROW);
  const lastRow = Math.floor((originY + tileSize + 8) / ROW);
  for (let row = firstRow; row <= lastRow; row++) {
    const rowPhase = random(0, row, seed, 701) * Math.PI * 2;
    const stagger = (row & 1) * COLUMN / 2 + Math.sin(rowPhase) * 1.4;
    const firstColumn = Math.floor((originX - stagger - 12) / COLUMN);
    const lastColumn = Math.floor((originX + tileSize - stagger + 12) / COLUMN);
    for (let column = firstColumn; column <= lastColumn; column++) {
      const position = hash(column, row, seed, 702);
      const jitterX = ((position & 1023) / 1023 - .5) * 2.8;
      const jitterY = (((position >>> 10) & 1023) / 1023 - .5) * 1.1;
      const wx = (column + .5) * COLUMN + stagger + jitterX;
      const wy = (row + .5) * ROW + Math.sin(column * .63 + rowPhase) * .65 + jitterY;
      const material = sample(wx, wy);
      const paved = Math.max(0, Math.min(1, material.paved));
      const road = Math.max(0, Math.min(1, material.road));
      if (paved <= .015 && road <= .03) continue;
      const px = wx - originX, py = wy - originY;
      const pick = random(column, row, seed, 704);

      if (paved > .015) {
        const worn = smooth(.42, .82, wearNoise(wx / 118, wy / 104, seed));
        const fadeStart = .02 + random(column, row, seed, 705) * .17;
        const opacity = smooth(fadeStart, .67 + fadeStart, paved) * (.92 - worn * .3);
        if (opacity > .006 && pick > .065 + worn * .29) {
          const detail = hash(column, row, seed, 706);
          const width = 12 + (detail & 255) / 255 * 6;
          const height = 7 + ((detail >>> 8) & 255) / 255 * 4;
          const corner = 1 + ((detail >>> 16) & 255) / 255 * 1.15;
          const skew = ((detail >>> 24) / 255 - .5) * .9;
          const nick = pick > .73 ? .8 + worn * .7 : 0;
          const left = px - width / 2, top = py - height / 2;
          c.globalAlpha = alpha * opacity * .5;
          stonePath(c, left, top, width, height, corner, skew, nick);
          c.fillStyle = '#252c29'; c.fill();
          c.globalAlpha = alpha * opacity;
          stonePath(c, left + .55, top + .3, width - 1.1, height - 1,
            corner * .85, skew, nick * .75);
          c.fillStyle = STONE_COLORS[detail % STONE_COLORS.length]; c.fill();

          if (pick > .54) {
            c.globalAlpha = alpha * opacity * .23;
            c.lineWidth = .6; c.strokeStyle = '#a6a294';
            c.beginPath(); c.moveTo(left + corner + 1, top + .75);
            c.lineTo(left + width * (nick ? .48 : .72), top + .75 + skew * .4); c.stroke();
          }
          if (pick > .065 + worn * .29 && pick < .15 + worn * .29) {
            c.globalAlpha = alpha * opacity * .43;
            c.strokeStyle = '#35432d'; c.lineWidth = 1.05;
            c.beginPath(); c.moveTo(left + corner, top + height - .6);
            c.lineTo(left + width * .42, top + height - .9); c.stroke();
          } else if (pick > .91) {
            c.globalAlpha = alpha * opacity * .35;
            c.strokeStyle = '#303a33'; c.lineWidth = .55;
            c.beginPath(); c.moveTo(px + 1, top + 1.2); c.lineTo(px, py - .2);
            c.lineTo(px + 1.2, py + 1.2); c.stroke();
          }
        }
      }

      const dirt = smooth(.04, .78, road) * (1 - smooth(.08, .75, paved));
      if (dirt <= .006) continue;
      if (pick > .77) {
        const gravel = hash(column, row, seed, 707);
        const size = .8 + (gravel & 255) / 255 * 1.5;
        c.globalAlpha = alpha * dirt * (.25 + ((gravel >>> 8) & 255) / 255 * .2);
        c.fillStyle = GRAVEL_COLORS[gravel % GRAVEL_COLORS.length];
        c.beginPath(); c.moveTo(px - size, py + .2); c.lineTo(px - .3, py - size * .45);
        c.lineTo(px + size * .8, py - .1); c.lineTo(px + .4, py + size * .55);
        c.closePath(); c.fill();
      } else if (pick < .052) {
        const angle = random(column, row, seed, 708) * Math.PI;
        const length = 3.5 + random(column, row, seed, 709) * 3.5;
        const dx = Math.cos(angle) * length, dy = Math.sin(angle) * length * .6;
        c.globalAlpha = alpha * dirt * .19;
        c.strokeStyle = '#2c3029'; c.lineWidth = .75;
        c.beginPath(); c.moveTo(px - dx, py - dy); c.lineTo(px + dx, py + dy); c.stroke();
      }
    }
  }
  c.restore();
}
