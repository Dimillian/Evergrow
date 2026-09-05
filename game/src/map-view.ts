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
export const MAP_ZOOM = Object.freeze({ min: .025, max: .7 });

export function fitMapBounds(view: MapView, region: MapRect, padding = 40): MapView {
  if (![region.x, region.y, region.width, region.height, padding].every(Number.isFinite)
    || region.width <= 0 || region.height <= 0) return { ...view };
  const availableWidth = Math.max(1, view.width - Math.max(0, padding) * 2);
  const availableHeight = Math.max(1, view.height - Math.max(0, padding) * 2);
  return { ...view, centerX: clampMapCoordinate(region.x + region.width / 2), centerY: clampMapCoordinate(region.y + region.height / 2),
    zoom: Math.max(MAP_ZOOM.min, Math.min(MAP_ZOOM.max, availableWidth / region.width, availableHeight / region.height)) };
}

export function zoomMapAt(view: MapView, x: number, y: number, zoom: number): MapView {
  const anchor = unprojectMapPoint(x, y, view);
  const next = { ...view, zoom: Math.max(MAP_ZOOM.min, Math.min(MAP_ZOOM.max, Number.isFinite(zoom) ? zoom : view.zoom)) };
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

export function getPortalControlRect(width: number, height: number): MapRect {
  const map = getMinimapRect(width, height);
  return { x: map.x + map.width - 112, y: map.y + map.height + 8, width: 112, height: 32 };
}
