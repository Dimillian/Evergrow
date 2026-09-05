import { polygon, line, randomFromSeed, hash, type Point } from './art-primitives.ts';
import type { Building, Rect } from './settlements.ts';

/** Roof coordinates follow each slope: courses and repairs share the building's actual roof plane. */
export function drawRoofCourses(c: CanvasRenderingContext2D, b: Building, edge: number, center: number,
  back: number, front: number, rise: number, side: number) {
  const random = randomFromSeed(hash(b.seed + (side < 0 ? 183 : 319)));
  const left = Math.min(edge, center), right = Math.max(edge, center), span = right - left;
  const palette = b.kind === 'blacksmith' ? ['#414c52', '#505957', '#63706c', '#8d9280']
    : b.kind === 'merchant' ? ['#3e5656', '#506964', '#647d71', '#a4ae8d']
      : ['#344d5a', '#456372', '#5b7982', '#9aa99e'];
  const project = (x: number, y: number): Point => [x, y - rise * Math.abs((x - edge) / span)];
  for (let y = back - 8, row = 0; y < front + 8; y += 8, row++) {
    for (let x = left - 14 + row % 2 * 7; x < right; x += 14) {
      const wear = random(), chip = random() * 2;
      const points: Point[] = [project(x + .6, y + .4), project(x + 13.2, y + .3), project(x + 13.1, y + 7),
        project(x + 9, y + 7.4), project(x + 7.5, y + 7.3 - chip), project(x + .7, y + 7.2)];
      polygon(c, points, palette[wear < .13 ? 0 : wear > .7 && side < 0 ? 2 : 1]);
      line(c, [points[2], points[3], points[4], points[5]], side < 0 ? palette[3] + '7a' : palette[2] + 'aa', .7);
      if (wear > .84) line(c, [project(x + 4, y + 2), project(x + 7, y + 4), project(x + 6, y + 7)], '#142b3266', .65);
      if (wear < .07) polygon(c, [project(x + 2, y + 1), project(x + 11, y + 1), project(x + 10, y + 6), project(x + 3, y + 6)], '#79817b5c');
    }
  }
  // Moss grows in sheltered eave joints; soot trails down from the chimney side.
  for (let bed = 0; bed < 5; bed++) {
    const x = left + span * (.1 + random() * .75), y = front - random() * 29;
    for (let lobe = 0; lobe < 8; lobe++) {
      const mx = x + (random() - .5) * 24, my = y + (random() - .5) * 11;
      polygon(c, [project(mx - 5, my), project(mx - 3, my - 3), project(mx + 2, my - 4), project(mx + 6, my - 1), project(mx + 3, my + 2)], lobe % 3 ? '#697b4e55' : '#9b9d6955');
    }
  }
  if (side > 0 && b.kind !== 'chapel') {
    const x = b.width * .75;
    polygon(c, [project(x - 6, back + b.height * .27), project(x + 6, back + b.height * .27),
      project(x + 13, back + b.height * .52), project(x + 1, back + b.height * .63)], '#14232938');
  }
}

/** Flat activity marks and foundation skirts. All upright architecture stays on its shared walls. */
export function drawBuildingApron(c: CanvasRenderingContext2D, b: Building) {
  const random = randomFromSeed(b.seed + 7867), w = b.width, h = b.height;
  for (let strip = 0; strip < 4; strip++) {
    const spread = 13 - strip * 2.5;
    c.fillStyle = `rgba(14,28,29,${.045 + strip * .025})`;
    c.fillRect(-spread, -4, spread, h + 10); c.fillRect(w, -4, spread, h + 10);
    c.fillRect(-spread, h, w + spread * 2, spread * .7);
  }
  for (let i = 0; i < 65; i++) {
    const side = i % 3, x = side === 0 ? -3 - random() * 9 : side === 1 ? w + 3 + random() * 8 : random() * w;
    const y = side === 2 ? h + random() * 12 : random() * h;
    const d = 1 + random() * 3;
    polygon(c, [[x - d, y], [x, y - 1.5], [x + d, y], [x + d * .3, y + 1]], i % 4 ? '#65705b80' : '#a19a7766');
  }
  const door = b.door.x;
  // The threshold receives foot wear; nothing crosses or narrows its passable opening.
  for (let i = 0; i < 14; i++) {
    const x = door + (random() - .5) * b.door.width * 1.1, y = h + 5 + random() * 12;
    line(c, [[x - 2, y], [x + 3, y - .8]], '#c1ae7c40', 1.4);
  }
  const serviceX = door > w * .5 ? w * .2 : w * .8;
  for (let mark = 0; mark < 17; mark++) {
    const x = serviceX + (random() - .5) * 28, y = h + 1 + random() * 13;
    if (b.kind === 'blacksmith') polygon(c, [[x - 3, y], [x - 1, y - 2], [x + 3, y - 1], [x + 1, y + 2]], mark % 4 ? '#1e292ca0' : '#a68c5b88');
    else if (b.kind === 'inn' || b.kind === 'house') line(c, [[x, y], [x + 5, y - 2]], '#b1a27465', .75);
    else if (b.kind === 'chapel') polygon(c, [[x - 1, y], [x, y - 2], [x + 1.7, y + .5]], '#b6ab8a65');
  }
}

export function drawWallWeathering(c: CanvasRenderingContext2D, r: Rect, height: number, stone: boolean) {
  const bottom = r.y + r.height;
  c.fillStyle = '#182c304d'; c.fillRect(r.x, bottom - 4, r.width, 4);
  // Low foundation stones ground timber walls without changing their footprint.
  if (r.width > 15) for (let x = r.x; x < r.x + r.width; x += 12) {
    const width = Math.min(11.2, r.x + r.width - x), n = hash(Math.floor(x * 13 + r.y * 17));
    c.fillStyle = stone ? '#71807955' : '#616c6099'; c.fillRect(x + .3, bottom - 6, width, 4.8);
    line(c, [[x + .8, bottom - 5.8], [x + width - .5, bottom - 5.8]], '#a4a28580', .65);
    if (n % 3 === 0) {
      c.fillStyle = '#56745377'; c.fillRect(x + 2, bottom - 3, width * .6, 3);
      line(c, [[x + 4, bottom - 5], [x + 3, bottom - 10], [x + 5, bottom - 14]], '#7c875c77', .8);
    }
    if (n % 5 === 0 && height > 15) {
      line(c, [[x + 4, r.y - height + 5], [x + 6, r.y - height + 12], [x + 5, r.y - height + 20]], '#2b36324d', 1.3);
    }
  }
}
