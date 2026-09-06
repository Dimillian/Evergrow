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
/** Marching boundaries follow the exact gameplay region query and stop at fog. */
export function drawMapZoneLevels(c: CanvasRenderingContext2D, view: MapView, exploration: Pick<Exploration, 'isRevealed'>, seed = 7319, labels: readonly ZoneProgression[] = mapZoneLabels(view, exploration, seed, [])): void {
  const step = Math.max(96, 10 / view.zoom), left = view.centerX - view.width / view.zoom / 2, top = view.centerY - view.height / view.zoom / 2;
  const startX = Math.floor(left / step) * step, startY = Math.floor(top / step) * step;
  const nx = Math.min(300, Math.ceil(view.width / view.zoom / step) + 1), ny = Math.min(300, Math.ceil(view.height / view.zoom / step) + 1);
  const rows: Array<Array<ZoneProgression | null>> = [];
  for (let j = 0; j <= ny; j++) {
    const row: Array<ZoneProgression | null> = [];
    for (let i = 0; i <= nx; i++) {
      const x = startX + i * step, y = startY + j * step;
      const zone = exploration.isRevealed(x, y) ? getZoneAt(x, y, seed) : null;
      row.push(zone);
    }
    rows.push(row);
  }
  c.save();
  c.beginPath();
  c.rect(view.x, view.y, view.width, view.height);
  c.clip();
  const segment = (a: readonly number[], b: readonly number[]) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 24));
    for (let i = 0; i <= steps; i++)
      if (!exploration.isRevealed(a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps))
        return;
    const p = projectMapPoint(a[0], a[1], view), q = projectMapPoint(b[0], b[1], view);
    c.moveTo(p.x, p.y);
    c.lineTo(q.x, q.y);
  };
  c.lineWidth = 1;
  c.strokeStyle = '#e6cd9380';
  c.setLineDash([3, 4]);
  c.beginPath();
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const corners = [rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]];
      if (corners.some(z => !z))
        continue;
      const x = startX + i * step, y = startY + j * step;
      const edges = [[x + step / 2, y], [x + step, y + step / 2], [x + step / 2, y + step], [x, y + step / 2]];
      const crossings = edges.filter((_, k) => corners[k]!.id !== corners[(k + 1) % 4]!.id);
      if (crossings.length === 2) {
        segment(crossings[0], crossings[1]);
      }
      else if (crossings.length > 2)
        for (const edge of crossings) {
          segment(edge, [x + step / 2, y + step / 2]);
        }
    }
  c.stroke();
  c.setLineDash([]);
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
