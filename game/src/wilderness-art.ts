import { line, polygon, randomFromSeed, type Point } from './art-primitives.ts';
import { drawGlow, type PointLight } from './lighting.ts';
import { WILDERNESS_BIOME_THEMES, type WildernessSite, type SiteDecor } from './wilderness-sites.ts';

const TAU = Math.PI * 2;
const palette = { stone: '#596665', edge: '#a7b2a0', dark: '#273637', wood: '#66533d', woodEdge: '#a08b5d', iron: '#778582' };

/** World-space ground layer; actor/decor drawing happens later in shared depth order. */
export function drawSiteGround(c: CanvasRenderingContext2D, site: WildernessSite, time: number): void {
  c.save(); c.translate(site.x, site.y);
  const random = randomFromSeed(site.seed);
  const points: Point[] = Array.from({ length: 26 }, (_, i) => {
    const angle = i / 26 * TAU, r = site.radius * (.79 + random() * .15);
    return [Math.cos(angle) * r, Math.sin(angle) * r * .91];
  });
  c.save();
  c.beginPath(); c.moveTo(...points[0]); for (const point of points.slice(1)) c.lineTo(...point); c.closePath(); c.clip();
  const earth = WILDERNESS_BIOME_THEMES[site.biome].earthRgb;
  // Overlapping soft soil stains make an irregular clearing; no nested contour bands.
  for (let stain = 0; stain < 6; stain++) {
    const angle = stain / 5 * TAU, offset = stain === 0 ? 0 : site.radius * .28;
    const x = Math.cos(angle) * offset, y = Math.sin(angle) * offset * .83;
    const radius = site.radius * (stain === 0 ? .88 : .51);
    const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${earth},${stain === 0 ? .26 : .095})`);
    gradient.addColorStop(.5, `rgba(${earth},${stain === 0 ? .19 : .065})`);
    gradient.addColorStop(.8, `rgba(${earth},${stain === 0 ? .045 : .014})`);
    gradient.addColorStop(1, `rgba(${earth},0)`);
    c.fillStyle = gradient; c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  c.restore();
  c.lineCap = 'round';
  // Several scuffed tracks lead from the open south gate to the authored activity centers.
  const tracks = site.kind === 'camp' ? [[-87, -55], [88, -71], [-108, 28]]
    : site.kind === 'graveyard' ? [[0, -98]] : site.kind === 'caravan' ? [[-52, -51], [66, 32]] : [[0, -45]];
  for (const [x, y] of tracks) {
    c.beginPath(); c.moveTo(0, site.radius * .99); c.bezierCurveTo(-8, 85, x * .34 - 12, y * .3, x, y);
    c.lineWidth = 29; c.strokeStyle = '#171e1920'; c.stroke();
    c.lineWidth = 20; c.strokeStyle = '#baac7a13'; c.stroke();
  }
  for (let i = 0; i < 130; i++) {
    const angle = random() * TAU, distance = Math.sqrt(random()) * site.radius * .84;
    const x = Math.cos(angle) * distance, y = Math.sin(angle) * distance * .89;
    c.globalAlpha = .17 + random() * .22;
    c.fillStyle = i % 4 === 0 ? '#a8a18a' : i % 3 === 0 ? '#141e1c' : '#75806b';
    c.fillRect(x, y, 1 + random() * 3, .7 + random() * 1.3);
  }
  c.globalAlpha = 1;
  if (site.kind === 'standingStones') {
    c.strokeStyle = '#b1ded34a'; c.lineWidth = 1;
    for (const radius of [65, 75, 104]) { c.beginPath(); c.ellipse(0, 0, radius, radius * .78, 0, 0, TAU); c.stroke(); }
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * TAU, x = Math.cos(angle) * 72, y = Math.sin(angle) * 56;
      line(c, [[x - 3, y - 2], [x, y - 7], [x + 3, y - 1], [x - 1, y + 3]], '#81c8bd80', .8);
    }
    drawGlow(c, 0, -3, 70, '#61c8ba', .18 + Math.sin(time * 1.2) * .025);
  } else if (site.kind === 'graveyard') {
    for (const grave of site.decor.filter(d => d.kind === 'gravestone')) {
      const x = grave.x - site.x, y = grave.y - site.y;
      polygon(c, [[x - 10, y + 3], [x + 8, y + 3], [x + 11, y + 26], [x - 12, y + 27]], '#131c1c50');
      line(c, [[x - 11, y + 5], [x - 13, y + 25], [x + 8, y + 26]], '#8f968644', 1);
    }
  } else if (site.kind === 'camp') {
    c.fillStyle = '#162023a8'; c.beginPath(); c.ellipse(0, 4, 32, 24, 0, 0, TAU); c.fill();
    for (let i = 0; i < 12; i++) {
      const a = (i + random() * .28) / 12 * TAU;
      const x = Math.cos(a) * (22 + random() * 3), y = Math.sin(a) * (16 + random() * 2);
      const width = 3.3 + random() * 2.5, height = 2.5 + random() * 1.3;
      const stone: Point[] = Array.from({ length: 6 }, (_, j) => {
        const angle = j / 6 * TAU, irregular = .75 + random() * .35;
        return [x + Math.cos(angle) * width * irregular, y + Math.sin(angle) * height * irregular];
      });
      polygon(c, stone, ['#777967', '#606f64', '#9a9677', '#6d7462'][i % 4]);
      line(c, [stone[3], stone[4], stone[5]], '#aaa08080', .7);
    }
  }
  c.restore();
}

function tent(c: CanvasRenderingContext2D, site: WildernessSite, seed: number, time: number): void {
  const { cloth, lining, trim } = WILDERNESS_BIOME_THEMES[site.biome];
  const wave = Math.sin(time * 1.9 + seed) * .8;
  line(c, [[-42, -48], [-56, 9]], '#a8a57b', .8); line(c, [[39, -47], [52, 10]], '#a8a57b', .8);
  polygon(c, [[-46, -5], [-31, -51], [28, -58], [48, -3], [6, 7]], '#263732');
  polygon(c, [[-46, -5], [-31, -51], [3 + wave, -67], [7, 6]], cloth);
  polygon(c, [[3 + wave, -67], [28, -58], [48, -3], [7, 6]], lining);
  polygon(c, [[-21, -2], [3 + wave, -60], [28, 0]], '#152624');
  polygon(c, [[-18, -2], [3 + wave, -58], [1, -5]], '#5a6045');
  polygon(c, [[3 + wave, -58], [28, 0], [16, -5]], lining);
  line(c, [[-46, -5], [-31, -51], [3 + wave, -67], [28, -58], [48, -3]], trim, 1.3);
  line(c, [[3 + wave, -66], [6, 5]], '#d3c592', 1); line(c, [[-36, -35], [-9, -45]], '#cab88a65', 1);
  line(c, [[-25, -28], [-14, -35], [-17, -21], [-6, -29]], '#d1ba87', 1.1);
  for (let i = 0; i < 5; i++) line(c, [[-39 + i * 3.4, -10 - i * 6], [-35 + i * 3.4, -9 - i * 6]], '#ded0a280', .7);
  polygon(c, [[-12, 2], [18, 2], [26, 12], [-20, 11]], '#7c4e42');
  line(c, [[-16, 9], [22, 10]], '#c79d70', 1);
}
function fire(c: CanvasRenderingContext2D, time: number, seed: number): void {
  const p = time * 7 + seed, lean = Math.sin(p) * 2;
  drawGlow(c, 0, -8, 35, '#ed8e45', .55);
  line(c, [[-13, 1], [12, -2]], '#9a7545', 5); line(c, [[-9, -5], [10, 4]], '#6b4530', 4);
  polygon(c, [[-11, 1], [-8, -12], [-3, -6], [lean - 1, -29 - Math.sin(p * .7) * 3], [5, -15], [10, -20], [11, -6], [7, 3]], '#df7136');
  polygon(c, [[-6, 1], [-4, -10], [1 + lean, -20], [3, -7], [7, -12], [6, 2]], '#ffc778');
  polygon(c, [[-3, 1], [0, -12], [4, 1]], '#f5e5a1');
  for (let i = 0; i < 5; i++) {
    const t = (time * .6 + i * .21 + seed % 9) % 1;
    c.globalAlpha = (1 - t) * .75; c.fillStyle = '#edc779'; c.fillRect(Math.sin(t * 8 + i) * 11, -10 - t * 50, 1, 2);
  }
  c.globalAlpha = 1;
}
function crate(c: CanvasRenderingContext2D): void {
  polygon(c, [[-13, -1], [-13, -21], [9, -24], [14, -17], [14, 2]], '#745c3e');
  polygon(c, [[-13, -21], [9, -24], [14, -17], [-8, -14]], '#a18855');
  polygon(c, [[-8, -14], [14, -17], [14, 2], [-8, 4]], '#856c49');
  line(c, [[-7, -13], [13, -16], [13, 1], [-7, 3], [-7, -13]], '#b39d6b', 1.2);
  for (let x = -1; x < 13; x += 6) line(c, [[x, -13], [x, 1]], '#544731', .8);
  line(c, [[-6, -10], [10, -1]], '#b19864', 2); line(c, [[-10, -18], [-10, -2]], '#4b4333', 1);
}
function barrel(c: CanvasRenderingContext2D): void {
  polygon(c, [[-8, -1], [-11, -15], [-8, -26], [8, -26], [11, -15], [8, 0]], '#7e6847');
  c.fillStyle = '#a18b5b'; c.beginPath(); c.ellipse(0, -26, 8, 3.5, 0, 0, TAU); c.fill();
  for (let x = -5; x <= 5; x += 5) line(c, [[x, -24], [x * 1.4, -14], [x, -1]], '#514932', .9);
  line(c, [[-9, -21], [0, -19], [9, -21]], '#a3aaa0', 2); line(c, [[-9, -6], [0, -4], [9, -6]], '#778c83', 2);
}
function lantern(c: CanvasRenderingContext2D, time: number): void {
  line(c, [[0, 2], [0, -30], [8, -30], [8, -25]], '#7c795b', 2);
  polygon(c, [[3, -26], [7, -31], [12, -26], [13, -15], [2, -15]], '#68716a');
  c.fillStyle = '#f4d998'; c.fillRect(5, -24, 5, 8); line(c, [[7.5, -24], [7.5, -16]], '#7e7955', .7);
  drawGlow(c, 7, -20, 23, '#ffcf82', .38 + Math.sin(time * 5) * .03);
}
function standingStone(c: CanvasRenderingContext2D, seed: number, time: number): void {
  polygon(c, [[-17, 2], [-13, -43], [-5, -66], [10, -59], [16, -12], [13, 3]], '#4e6865');
  polygon(c, [[-13, -43], [-5, -66], [0, -58], [-3, -2], [-17, 2]], '#899789');
  line(c, [[-5, -64], [10, -59], [15, -14]], '#b2c2a6', 1.1);
  const light = .75 + Math.sin(time * 1.4 + seed) * .12;
  c.globalAlpha = light;
  line(c, [[3, -50], [-3, -42], [6, -37], [-2, -27], [5, -19]], '#a3e7d9', 1.6);
  line(c, [[-5, -43], [5, -43], [5, -47]], '#6dabaa', 1);
  c.globalAlpha = 1; drawGlow(c, 2, -34, 18, '#77d0cb', .23);
  polygon(c, [[-17, 2], [-10, -6], [-3, -4], [0, 5]], '#425844');
}
function tower(c: CanvasRenderingContext2D): void {
  // The ragged silhouette and surviving buttress read as a ruin instead of a small intact house.
  polygon(c, [[-38, 3], [-40, -72], [-31, -72], [-31, -92], [-21, -95], [-19, -80], [-6, -89], [4, -59], [20, -65], [28, -45], [38, -40], [36, 4]], '#4a5857');
  polygon(c, [[-38, 3], [-40, -72], [-31, -72], [-31, -92], [-21, -95], [-20, -4]], '#718079');
  polygon(c, [[-40, 3], [-40, -41], [-50, -8], [-49, 6]], '#8a9080');
  polygon(c, [[25, 5], [28, -39], [40, -32], [45, 8]], '#67716b');
  for (let row = 0; row < 7; row++) {
    const y = -5 - row * 11;
    line(c, [[-35, y], [-22, y - 1]], '#bdc0a4', .8);
    line(c, [[-18, y], [row > 4 ? -6 : 28, y]], '#89988b', .6);
    for (let i = 0; i < (row > 4 ? 1 : 3); i++) {
      const x = -14 + i * 14 + (row % 2) * 7;
      line(c, [[x, y], [x, y - 10]], '#303d3c', .8);
    }
  }
  polygon(c, [[-9, 2], [-9, -30], [-3, -40], [5, -40], [12, -28], [12, 2]], '#122627');
  line(c, [[-11, 1], [-11, -31], [-4, -42], [6, -42], [14, -29], [14, 2]], '#adb49a', 2);
  line(c, [[-9, 2], [-9, -30], [-3, -40]], '#344543', 2);
  line(c, [[-5, -58], [-1, -49], [-7, -43], [-3, -40]], '#192d2e', 1.5);
  polygon(c, [[16, 7], [11, -2], [21, -7], [30, 1], [26, 8]], '#929785');
  polygon(c, [[-30, 10], [-33, 1], [-20, -3], [-13, 7]], '#687b6e');
}
function wagon(c: CanvasRenderingContext2D): void {
  line(c, [[-20, 0], [-43, 18]], '#b49a64', 3); line(c, [[20, 0], [40, 18]], '#7d7354', 3);
  polygon(c, [[-29, -4], [-27, -32], [25, -38], [31, -8], [3, 2]], '#5f503d');
  for (const x of [-25, 28]) { c.fillStyle = '#343d35'; c.beginPath(); c.ellipse(x, -4, 10, 14, .08, 0, TAU); c.fill(); c.strokeStyle = '#a2976e'; c.lineWidth = 2; c.stroke();
    line(c, [[x - 7, -4], [x + 7, -4]], '#b2a176', 1); line(c, [[x, -14], [x, 7]], '#b2a176', 1); }
  polygon(c, [[-30, -25], [-27, -52], [-18, -61], [13, -65], [25, -58], [30, -30]], '#8d906e');
  polygon(c, [[-30, -25], [-27, -52], [-18, -61], [-3, -52], [0, -25]], '#b4ad80');
  polygon(c, [[-20, -27], [-19, -48], [-14, -53], [-7, -48], [-3, -27]], '#283c35');
  line(c, [[-29, -26], [-27, -52], [-18, -61], [13, -65], [25, -58], [30, -30]], '#d3c397', 1.2);
  line(c, [[0, -61], [11, -54], [14, -32]], '#62725c', 1.3); line(c, [[-28, -18], [28, -23]], '#ba9c65', 2);
  line(c, [[21, -56], [18, -48], [22, -41], [17, -31]], '#263a32', 1.1);
  polygon(c, [[10, -31], [16, -41], [18, -28]], '#c2b995');
}

/** One ground-contact object per depth layer; every solid anchor is the collision blueprint. */
export function drawSiteDecor(c: CanvasRenderingContext2D, site: WildernessSite, decor: SiteDecor, time: number): void {
  c.save(); c.translate(decor.x, decor.y); c.rotate(decor.angle); c.scale(decor.scale, decor.scale);
  c.fillStyle = '#07141668'; c.beginPath(); c.ellipse(4, 3, Math.max(8, decor.radius / decor.scale + 4), Math.max(3, decor.radius / decor.scale * .35), 0, 0, TAU); c.fill();
  switch (decor.kind) {
    case 'tent': tent(c, site, decor.seed, time); break;
    case 'fire': fire(c, time, decor.seed); break;
    case 'crate': crate(c); break;
    case 'barrel': barrel(c); break;
    case 'lantern': lantern(c, time); break;
    case 'standingStone': standingStone(c, decor.seed, time); break;
    case 'tower': tower(c); break;
    case 'wagon': wagon(c); break;
    case 'banner': {
      const wave = Math.sin(time * 2 + decor.seed) * 2;
      line(c, [[0, 1], [0, -64], [-4, -71]], '#aaa17b', 2);
      polygon(c, [[2, -61], [28 + wave, -57], [23, -40], [26 + wave, -30], [14, -36], [2, -35]], WILDERNESS_BIOME_THEMES[site.biome].banner);
      line(c, [[3, -60], [27 + wave, -56]], WILDERNESS_BIOME_THEMES[site.biome].trim, 1.2);
      line(c, [[12, -52], [20, -46], [11, -42], [14, -52]], WILDERNESS_BIOME_THEMES[site.biome].trim, 1.2);
      line(c, [[0, -34], [20, -29]], '#493c32', 1); break;
    }
    case 'fence':
      polygon(c, [[-5, 3], [-6, -26], [-1, -33], [5, -25], [6, 3]], '#66644a');
      line(c, [[-4, -24], [-1, -31], [1, 1]], '#a29d73', 1);
      line(c, [[-18, -14], [15, -11]], '#918466', 3); line(c, [[-19, 5], [24, 9]], '#73634b', 2);
      line(c, [[-4, -12], [4, -16], [-4, -18]], '#b8aa82', .8); break;
    case 'gravestone':
      polygon(c, [[-10, 3], [-8, -25], [-4, -30], [4, -30], [10, -25], [11, 3]], palette.stone);
      line(c, [[-10, 2], [-8, -25], [-4, -30], [4, -30], [9, -25]], palette.edge, 1.4);
      line(c, [[0, -23], [0, -11]], '#b7b9a2', 1); line(c, [[-4, -19], [4, -19]], '#b7b9a2', 1);
      line(c, [[-5, -7], [6, -7]], '#1d3535', 1); line(c, [[-3, -4], [4, -4]], '#243b38', 1);
      polygon(c, [[-12, 3], [-9, -3], [-3, -1], [0, 5]], '#49664b'); break;
    case 'altar':
      polygon(c, [[-24, 3], [-22, -15], [22, -15], [26, 3]], '#566765');
      polygon(c, [[-26, -15], [-18, -26], [18, -26], [27, -15]], '#8c9c87');
      line(c, [[-25, -15], [26, -15]], '#bac2a4', 1.5);
      line(c, [[-15, -10], [-12, -3], [-9, -10]], '#a1bda7', 1); line(c, [[10, -10], [13, -3], [16, -10]], '#a1bda7', 1);
      polygon(c, [[-10, -24], [0, -32], [11, -23], [0, -18]], '#3e6665');
      line(c, [[-5, -24], [0, -28], [6, -23], [0, -21], [-5, -24]], '#a6ddd0', 1.3);
      if (site.kind === 'standingStones') drawGlow(c, 0, -24, 35, '#65d7ce', .4); break;
    case 'bedroll':
      polygon(c, [[-11, 2], [-12, -17], [10, -21], [13, 0]], '#6f6850');
      polygon(c, [[-12, -17], [-9, -25], [8, -28], [10, -21]], '#a0946b');
      line(c, [[-10, -8], [11, -11]], '#8c593f', 3); line(c, [[-8, -21], [8, -24]], '#c2b18a', 1); break;
    case 'bones':
      for (const [x, y, angle] of [[0, -3, .3], [-9, 4, -.6], [8, 3, .9]]) {
        const dx = Math.cos(angle) * 7, dy = Math.sin(angle) * 3;
        line(c, [[x - dx, y - dy], [x + dx, y + dy]], '#b1ad85', 1.7);
        c.fillStyle = '#d3cfa6'; c.fillRect(x - dx - 1, y - dy - 1, 2, 2); c.fillRect(x + dx - 1, y + dy - 1, 2, 2);
      }
      polygon(c, [[-2, -8], [-4, -13], [1, -16], [6, -14], [6, -9], [2, -6]], '#b9b89b');
      c.fillStyle = '#263d35'; c.fillRect(0, -12, 2, 2); c.fillRect(4, -12, 2, 2); break;
    case 'wheel':
      c.strokeStyle = '#9e8d64'; c.lineWidth = 3; c.beginPath(); c.ellipse(0, -2, 14, 10, 0, 0, TAU); c.stroke();
      for (let i = 0; i < 4; i++) line(c, [[Math.cos(i * Math.PI / 4) * -13, Math.sin(i * Math.PI / 4) * -9 - 2], [Math.cos(i * Math.PI / 4) * 13, Math.sin(i * Math.PI / 4) * 9 - 2]], '#7e7552', 1.4);
      c.fillStyle = '#c2b285'; c.fillRect(-2, -4, 4, 4); break;
  }
  c.restore();
}

export function wildernessLights(site: WildernessSite, time: number): PointLight[] {
  return site.decor.flatMap(decor => {
    if (decor.kind === 'fire') return [{ x: decor.x, y: decor.y - 10, radius: 150 * decor.scale,
      color: '#ffad60', power: .72 + Math.sin(time * 6 + decor.seed) * .06, shadows: true }];
    if (decor.kind === 'lantern') return [{ x: decor.x + 7, y: decor.y - 20, radius: 84, color: '#f7d89e', power: .45, shadows: true }];
    if (decor.kind === 'standingStone') return [{ x: decor.x, y: decor.y - 30, radius: 61, color: '#77d0cb', power: .3 }];
    if (decor.kind === 'altar' && site.kind === 'standingStones') return [{ x: decor.x, y: decor.y - 20, radius: 100, color: '#83ddd6', power: .4 }];
    return [];
  });
}
