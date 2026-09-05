import { EXPLORATION_LIMITS } from './exploration-save.ts';
import type { MapRect } from './exploration.ts';

export interface MapView extends MapRect { centerX: number; centerY: number; zoom: number; }
export function projectMapPoint(x: number, y: number, view: MapView) {
  return { x: view.x + view.width / 2 + (x - view.centerX) * view.zoom,
    y: view.y + view.height / 2 + (y - view.centerY) * view.zoom };
}
export function unprojectMapPoint(x: number, y: number, view: MapView) {
  return { x: view.centerX + (x - view.x - view.width / 2) / view.zoom,
    y: view.centerY + (y - view.y - view.height / 2) / view.zoom };
}
export function clampMapCoordinate(value: number): number {
  return Math.max(-EXPLORATION_LIMITS.coordinate, Math.min(EXPLORATION_LIMITS.coordinate, Number.isFinite(value) ? value : 0));
}
export function zoomMapAt(view: MapView, x: number, y: number, zoom: number): MapView {
  const anchor = unprojectMapPoint(x, y, view);
  const next = { ...view, zoom: Math.max(.065, Math.min(.7, Number.isFinite(zoom) ? zoom : view.zoom)) };
  const after = unprojectMapPoint(x, y, next);
  next.centerX = clampMapCoordinate(next.centerX + anchor.x - after.x);
  next.centerY = clampMapCoordinate(next.centerY + anchor.y - after.y);
  return next;
}
export function getMinimapRect(width: number, _height: number): MapRect {
  const compact = width < 660;
  return { x: width - (compact ? 150 : 172) - 18, y: 18,
    width: compact ? 150 : 172, height: compact ? 143 : 155 };
}
