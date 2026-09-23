import type { Item } from './character-types.ts';
import type { Point } from './art-primitives.ts';
import type { GearShape } from './weapon-shapes.ts';

/** Only weapons earn a persistent tempering effect; upgrades on other gear remain mechanical. */
export function weaponEnhancementRank(item: Item | null | undefined): number {
  return item?.kind === 'weapon' ? item.recipe.enhancement : 0;
}

/** Cosmetic tempering, independent of rarity, elemental damage and world lighting. */
const FINISHES = Object.freeze([
  { bloom: .35, power: .22, edge: .12, spread: .7, period: 5.8, motes: 0, trails: 0 },
  { bloom: .55, power: .34, edge: .2, spread: 1, period: 5, motes: 2, trails: 0 },
  { bloom: .8, power: .5, edge: .29, spread: 1.4, period: 4.4, motes: 4, trails: 1 },
  { bloom: 1.1, power: .7, edge: .4, spread: 1.9, period: 3.8, motes: 6, trails: 2 },
  { bloom: 1.45, power: .95, edge: .56, spread: 2.5, period: 3.2, motes: 9, trails: 3 },
].map(finish => Object.freeze(finish)));
export function enhancementFinish(rank = 0) {
  return Number.isInteger(rank) && rank >= 6 && rank <= 10 ? FINISHES[rank - 6] : null;
}
const GOLD = '#edc780', CORE = '#fff1cc';

const fract = (value: number) => ((value % 1) + 1) % 1;
/** Fixed motion lanes shared by the DOM and Canvas presentations; never gameplay RNG. */
export function enhancementMote(index: number, time: number, period: number) {
  const phase = fract(time / period + index * .381966);
  return { x: .18 + fract(index * .618034) * .64 + Math.sin(phase * Math.PI * 2 + index) * .07,
    y: .86 - phase * .68, alpha: Math.sin(phase * Math.PI) ** 2, phase };
}

/** Shared local resources preserve the actual silhouette throughout the moving sheen. */
export function enhancementIconSVG(shape: string, rank: number, prefix: string, width: number, height: number, seed = 0): string {
  const finish = enhancementFinish(rank);
  if (!finish) return shape;
  const id = `${prefix}-temper`, size = Math.min(width, height), phase = fract(seed * .0137), band = height * .3;
  const motes = Array.from({ length: finish.motes }, (_, i) => {
    const x = (.18 + fract(i * .618034) * .64) * width, radius = Math.min(1.15, size * (.009 + (i % 3) * .003));
    return `<g class="item-temper-mote" style="--mote-x:${x}px;--mote-y:${height * .86}px;--mote-rise:${height * .68}px;--mote-drift:${width * .07 * (i % 2 ? 1 : -1)}px;--temper-delay:${-(phase + i * .381966) * finish.period}s"><path d="M0 ${-radius}L${radius} 0 0 ${radius} ${-radius} 0Z" fill="${i % 3 ? GOLD : CORE}"/></g>`;
  }).join('');
  const trails = Array.from({ length: finish.trails }, (_, i) => {
    const flip = i % 2 ? -1 : 1, x = (u: number) => width * (.5 + (u - .5) * flip);
    return `<path class="item-temper-trail" d="M${x(.22)} ${height * .84}C${x(.86)} ${height * .59} ${x(.12)} ${height * .37} ${x(.73)} ${height * .14}" pathLength="100" fill="none" stroke="${i === 2 ? CORE : GOLD}" stroke-width="${i === 2 ? .7 : .5}" stroke-linecap="round" stroke-dasharray="${8 + i * 2} ${92 - i * 2}" style="--temper-delay:${-(phase + i / 3) * finish.period}s"/>`;
  }).join('');
  const spark = Math.min(2.6, size * .045);
  const glints = rank === 10 ? [[.3,.24],[.7,.74],[.63,.36]].map(([u,v],i) =>
    `<g transform="translate(${width * u} ${height * v})"><path class="item-temper-glint" d="M${-spark} 0H${spark}M0 ${-spark}V${spark}" stroke="${CORE}" stroke-width=".7" style="--temper-delay:${-(phase + i / 3) * finish.period}s"/></g>`).join('') : '';
  return `<defs><filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="${finish.bloom}" result="halo"/>
    <feFlood class="item-temper-heat" flood-color="${GOLD}" flood-opacity="${finish.power}" style="--temper-power:${finish.power};--temper-period:${finish.period}s;--temper-delay:${-phase * finish.period}s"/><feComposite in2="halo" operator="in" result="gold"/>
    <feMorphology in="SourceAlpha" operator="dilate" radius="${.2 + finish.edge}" result="rim"/>
    <feComposite in="rim" in2="SourceAlpha" operator="out" result="edge"/>
    <feFlood flood-color="${CORE}" flood-opacity="${finish.edge}"/><feComposite in2="edge" operator="in" result="light"/>
    <feMerge><feMergeNode in="gold"/><feMergeNode in="SourceGraphic"/><feMergeNode in="light"/></feMerge>
  </filter><mask id="${id}-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" style="mask-type:alpha"><use href="#${id}-art"/></mask>
  <linearGradient id="${id}-sheen" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${GOLD}" stop-opacity="0"/><stop offset=".46" stop-color="${GOLD}" stop-opacity=".25"/><stop offset=".55" stop-color="${CORE}" stop-opacity="${.3 + finish.edge}"/><stop offset="1" stop-color="${CORE}" stop-opacity="0"/></linearGradient></defs>
  <g data-enhancement-glow="${rank}" filter="url(#${id})"><g id="${id}-art">${shape}</g></g>
  <g class="item-temper-motion" aria-hidden="true" style="--temper-period:${finish.period}s;--temper-delay:${-phase * finish.period}s;--temper-travel:${height + band}px">
    <g mask="url(#${id}-mask)"><rect class="item-temper-sheen" x="0" y="${-band}" width="${width}" height="${band}" fill="url(#${id}-sheen)"/></g>
    ${trails}${motes}${glints ? `<g class="item-temper-glints">${glints}</g>` : ''}
  </g>`;
}

interface Bounds { left: number; top: number; right: number; bottom: number; }
const boundsCache = new WeakMap<readonly GearShape[], Bounds>();
function shapeBounds(shapes: readonly GearShape[], project?: (point: Point) => Point): Bounds | undefined {
  let bounds = project ? undefined : boundsCache.get(shapes);
  if (!bounds) {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const shape of shapes) if (!shape.fine) for (const point of shape.points) {
      const [x, y] = project ? project(point) : point;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (!Number.isFinite(left)) return;
    bounds = { left, top, right, bottom };
    if (!project) boundsCache.set(shapes, bounds);
  }
  return bounds;
}
function shapePath(c: CanvasRenderingContext2D, shapes: readonly GearShape[], project?: (point: Point) => Point): void {
  c.beginPath();
  for (const shape of shapes) {
    if (shape.fine || !shape.fill || !shape.points.length) continue;
    const first = project ? project(shape.points[0]) : shape.points[0]; c.moveTo(...first);
    for (let i = 1; i < shape.points.length; i++) c.lineTo(...(project ? project(shape.points[i]) : shape.points[i]));
    c.closePath();
  }
}
/** Bounded local halo; its clock is supplied by the existing renderer. */
export function drawEnhancementGlow(c: CanvasRenderingContext2D, shapes: readonly GearShape[], rank = 0, project?: (point: Point) => Point, time = 0): void {
  const finish = enhancementFinish(rank);
  if (!finish || !shapes.length) return;
  const bounds = shapeBounds(shapes, project); if (!bounds) return;
  const x = (bounds.left + bounds.right) / 2, y = (bounds.top + bounds.bottom) / 2;
  const rx = (bounds.right - bounds.left) / 2 + finish.spread, ry = (bounds.bottom - bounds.top) / 2 + finish.spread;
  c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha *= finish.power * (.72 + .28 * Math.sin(time / finish.period * Math.PI * 2) ** 2);
  c.translate(x, y); c.scale(rx, ry);
  const glow = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  glow.addColorStop(0, GOLD + '90'); glow.addColorStop(.55, GOLD + '60'); glow.addColorStop(1, GOLD + '00');
  c.fillStyle = glow; c.fillRect(-1, -1, 2, 2); c.restore();
  // A second narrow contour at the cap reads as white-gold without repainting the material.
  c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha *= finish.edge;
  c.strokeStyle = rank === 10 ? CORE : GOLD; c.lineWidth = .25 + finish.spread * .18; c.lineJoin = 'round';
  shapePath(c, shapes, project);
  c.stroke(); c.restore();
}

/** Surface light and finite procedural sparks draw after the material, so they cannot be buried by it. */
export function drawEnhancementMotion(c: CanvasRenderingContext2D, shapes: readonly GearShape[], rank = 0, time = 0, project?: (point: Point) => Point): void {
  const finish = enhancementFinish(rank);
  if (!finish || !shapes.length) return;
  const bounds = shapeBounds(shapes, project); if (!bounds) return;
  const w = Math.max(.1, bounds.right - bounds.left), h = Math.max(.1, bounds.bottom - bounds.top);
  const clock = time + bounds.left * .037 + bounds.top * .051;
  const phase = fract(clock / finish.period), horizontal = w > h;
  const length = horizontal ? w : h, band = Math.max(1, length * .3);
  const at = (1 - phase) * (length + band) - band;
  c.save(); c.globalCompositeOperation = 'screen';
  shapePath(c, shapes, project); c.clip();
  const x = bounds.left + (horizontal ? at : 0), y = bounds.top + (horizontal ? 0 : at);
  const sheen = c.createLinearGradient(x, y, x + (horizontal ? band : 0), y + (horizontal ? 0 : band));
  sheen.addColorStop(0, GOLD + '00'); sheen.addColorStop(.45, GOLD + '40'); sheen.addColorStop(.55, CORE + 'b0'); sheen.addColorStop(1, CORE + '00');
  c.globalAlpha *= .35 + finish.edge; c.fillStyle = sheen; c.fillRect(bounds.left, bounds.top, w, h); c.restore();
  c.save(); c.globalCompositeOperation = 'screen';
  const projectUV = (u: number, v: number): Point => [bounds.left + w * u, bounds.top + h * v];
  for (let i = 0; i < finish.trails; i++) {
    c.save(); c.globalAlpha *= .45 + finish.edge * .5; c.strokeStyle = i === 2 ? CORE : GOLD; c.lineWidth = .22 + i * .07; c.lineCap = 'round'; c.beginPath();
    for (let step = 0; step <= 6; step++) {
      const t = fract(clock / finish.period + i / 3 - step * .013);
      const u = .5 + Math.sin(t * Math.PI * 2 + i * 2) * .32, v = .84 - t * .7;
      const point = projectUV(u, v); if (step === 0 || t > .985) c.moveTo(...point); else c.lineTo(...point);
    }
    c.stroke(); c.restore();
  }
  const size = Math.max(.15, Math.min(.5, Math.min(w, h) * .07));
  for (let i = 0; i < finish.motes; i++) {
    const mote = enhancementMote(i, clock, finish.period), [x, y] = projectUV(mote.x, mote.y);
    c.save(); c.globalAlpha *= mote.alpha * (.5 + finish.edge * .5); c.fillStyle = i % 3 ? GOLD : CORE;
    c.fillRect(x - size / 2, y - size / 2, size, size); c.restore();
  }
  if (rank === 10) for (let i = 0; i < 3; i++) {
    const flare = Math.max(0, 1 - Math.abs(fract(clock / finish.period + i / 3) - .5) * 7);
    if (flare === 0) continue;
    const [x, y] = projectUV(.3 + i * .19, .24 + (i % 2) * .5), radius = size * (1 + flare * 2.2);
    c.save(); c.globalAlpha *= flare * .85; c.strokeStyle = CORE; c.lineWidth = .22;
    c.beginPath(); c.moveTo(x - radius, y); c.lineTo(x + radius, y); c.moveTo(x, y - radius); c.lineTo(x, y + radius); c.stroke(); c.restore();
  }
  c.restore();
}
