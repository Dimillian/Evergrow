import type { Exploration } from './exploration.ts';
import { projectMapPoint, type MapView } from './map-view.ts';
import { getZoneAt, type ZoneProgression } from './zone-progression.ts';
import { text } from './font.ts';
export function mapZoneLabels(view: MapView, exploration: Pick<Exploration, 'isRevealed'>, seed: number, avoid: readonly {
  x: number;
  y: number;
}[]): ZoneProgression[] {
  const found = new Map<string, ZoneProgression>(), step = Math.max(1800, 60 / view.zoom);
  for (let y = view.centerY - view.height / view.zoom / 2; y < view.centerY + view.height / view.zoom / 2; y += step)
    for (let x = view.centerX - view.width / view.zoom / 2; x < view.centerX + view.width / view.zoom / 2; x += step) {
      if (exploration.isRevealed(x, y)) {
        const z = getZoneAt(x, y, seed);
        found.set(z.id, z);
      }
    }
  const placed = avoid.map(p => projectMapPoint(p.x, p.y, view)), result: ZoneProgression[] = [];
  const candidates = [...found.values()].sort((a, b) => Math.hypot(a.x - view.centerX, a.y - view.centerY) - Math.hypot(b.x - view.centerX, b.y - view.centerY) || a.id.localeCompare(b.id));
  for (const z of candidates) {
    const p = projectMapPoint(z.x, z.y, view);
    if (!exploration.isRevealed(z.x, z.y) || p.x < view.x + 75 || p.x > view.x + view.width - 75 || p.y < view.y + 35 || p.y > view.y + view.height - 45
      || placed.some(q => Math.abs(q.x - p.x) < 160 && Math.abs(q.y - p.y) < 72))
      continue;
    result.push(z);
    placed.push(p);
  }
  return result;
}
type Point = readonly [number, number];
interface ContourSegment { a: Point; b: Point; corners: readonly Point[]; }
const CONTOUR_CELLS = 16, CONTOUR_LIMIT = 512;
const contours = new Map<string, readonly ContourSegment[]>();

/** World-aligned contour geometry survives camera movement and never caches discovery state. */
function contourTile(tx: number, ty: number, step: number, seed: number): readonly ContourSegment[] {
  const key = `${seed}:${step}:${tx}:${ty}`, cached = contours.get(key);
  if (cached) { contours.delete(key); contours.set(key, cached); return cached; }
  const x0 = tx * step * CONTOUR_CELLS, y0 = ty * step * CONTOUR_CELLS;
  const rows = Array.from({ length: CONTOUR_CELLS + 1 }, (_, y) =>
    Array.from({ length: CONTOUR_CELLS + 1 }, (_, x) => getZoneAt(x0 + x * step, y0 + y * step, seed).id));
  const result: ContourSegment[] = [];
  for (let j = 0; j < CONTOUR_CELLS; j++) for (let i = 0; i < CONTOUR_CELLS; i++) {
    const ids = [rows[j][i], rows[j][i+1], rows[j+1][i+1], rows[j+1][i]];
    if (ids.every(id => id === ids[0])) continue;
    const x = x0 + i * step, y = y0 + j * step;
    const corners: Point[] = [[x,y],[x+step,y],[x+step,y+step],[x,y+step]];
    const edges: Point[] = [[x+step/2,y],[x+step,y+step/2],[x+step/2,y+step],[x,y+step/2]];
    const crossings = edges.filter((_, k) => ids[k] !== ids[(k+1)%4]);
    if (crossings.length === 2) result.push({ a: crossings[0], b: crossings[1], corners });
    else for (const edge of crossings) result.push({ a: edge, b: [x+step/2,y+step/2], corners });
  }
  if (contours.size >= CONTOUR_LIMIT) contours.delete(contours.keys().next().value!);
  contours.set(key, result); return result;
}

/** Marching boundaries follow gameplay districts and recheck every segment against current fog. */
export function drawMapZoneLevels(c: CanvasRenderingContext2D, view: MapView, exploration: Pick<Exploration, 'isRevealed'>, seed = 7319, labels: readonly ZoneProgression[] = mapZoneLabels(view, exploration, seed, [])): void {
  // Stable LOD bands avoid rebuilding geometry for every fractional wheel delta.
  const step = 96 * Math.max(1, Math.ceil(10 / view.zoom / 96)), size = step * CONTOUR_CELLS;
  const left = view.centerX - view.width / view.zoom / 2, top = view.centerY - view.height / view.zoom / 2;
  const right = left + Math.min(view.width / view.zoom, step * 300), bottom = top + Math.min(view.height / view.zoom, step * 300);
  c.save(); c.beginPath(); c.rect(view.x, view.y, view.width, view.height); c.clip();
  c.lineWidth = 1; c.strokeStyle = '#e6cd9380'; c.setLineDash([3, 4]); c.beginPath();
  for (let ty = Math.floor(top / size); ty <= Math.floor(bottom / size); ty++)
    for (let tx = Math.floor(left / size); tx <= Math.floor(right / size); tx++)
      for (const { a, b, corners } of contourTile(tx, ty, step, seed)) {
        if (Math.max(a[0],b[0]) < left || Math.min(a[0],b[0]) > right || Math.max(a[1],b[1]) < top || Math.min(a[1],b[1]) > bottom) continue;
        if (!corners.every(p => exploration.isRevealed(...p))) continue;
        const count = Math.max(1, Math.ceil(Math.hypot(b[0]-a[0], b[1]-a[1]) / 24));
        let revealed = true;
        for (let i = 0; i <= count; i++) if (!exploration.isRevealed(a[0]+(b[0]-a[0])*i/count, a[1]+(b[1]-a[1])*i/count)) { revealed = false; break; }
        if (!revealed) continue;
        const p = projectMapPoint(...a, view), q = projectMapPoint(...b, view);
        c.moveTo(p.x, p.y); c.lineTo(q.x, q.y);
      }
  c.stroke(); c.setLineDash([]);
  for (const zone of labels) {
    const p = projectMapPoint(zone.x, zone.y, view), color = zone.hazardous ? '#ffb28b' : '#f0dba6';
    c.shadowColor = '#030b10';
    c.shadowBlur = 5;
    text(c, zone.name.split(' · ')[0], p.x, p.y - 11, 1.15, '#d6ded5', 'center');
    text(c, `${zone.hazardous ? '! ' : ''}Lv ${zone.level}`, p.x, p.y + 5, 1.25, color, 'center');
    c.shadowBlur = 0;
  }
  c.restore();
}
