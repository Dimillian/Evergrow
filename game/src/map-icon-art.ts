import { POI_DEFINITIONS, type POIKind } from './world-pois.ts';
import { drawMapSymbol } from './map-symbol-art.ts';
import { UI_THEME } from './ui-theme.ts';
const palette = UI_THEME.palette;
export const MAP_ICON_SIZES = Object.freeze({ minimap: 4.1, overview: 5.4, map: 7 });

/** Every POI owns a semantic silhouette; no generic fallback. */
export function drawMapPOIIcon(c: CanvasRenderingContext2D, kind: POIKind, x: number, y: number, size: number, selected = false, cleared = false) {
  c.save(); c.translate(x, y);
  const color = selected ? palette.ivory : cleared ? palette.jade : POI_DEFINITIONS[kind].color;
  c.fillStyle = palette.well; c.beginPath(); c.arc(0, 0, size + 2.5, 0, Math.PI * 2); c.fill();
  if (selected) { c.strokeStyle = color; c.lineWidth = 1.2; c.stroke(); }
  drawMapSymbol(c, kind, size, color, palette.well);
  if (cleared && kind === 'camp') {
    c.strokeStyle = palette.well; c.lineWidth = 3; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(size * .35, size * .45); c.lineTo(size * .85, size * .9); c.lineTo(size * 1.45, 0); c.stroke();
    c.strokeStyle = color; c.lineWidth = 1.5; c.stroke();
  }
  c.restore();
}

export function drawMapPlayerIcon(c: CanvasRenderingContext2D, x: number, y: number, angle: number, mini: boolean) {
    c.save(); c.translate(x, y);
    c.strokeStyle = '#e3d39433'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, mini ? 17 : 14, 0, Math.PI * 2); c.stroke();
    c.rotate(angle);
    const r = mini ? 5 : 7;
    c.beginPath(); c.moveTo(r + 2, 0); c.lineTo(-r, -r * .75); c.lineTo(-r * .5, 0); c.lineTo(-r, r * .75); c.closePath();
    c.fillStyle = '#fff2ba'; c.fill(); c.strokeStyle = '#1b261f'; c.lineWidth = 1.3; c.stroke(); c.restore();
}

export function drawMapEnemyIcon(c: CanvasRenderingContext2D, x: number, y: number, kind?: string) {
    c.save();
      c.fillStyle = kind === 'brute' ? '#d18a62' : kind === 'caster' ? '#d4a677' : '#b26a62';
      c.strokeStyle = '#070d12'; c.lineWidth = .7;
      c.beginPath(); c.arc(x, y, kind === 'brute' ? 1.9 : 1.4, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();
}
