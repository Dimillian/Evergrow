import { isHUDPoint } from './hud.ts';
import { getMinimapRect, getPortalControlRect } from './map-view.ts';

export interface UIRect { x: number; y: number; width: number; height: number; }
interface ClientRect { left: number; top: number; width: number; height: number; }
export function isUIRectPoint(x: number, y: number, rect: UIRect | null): boolean {
  return !!rect && x >= rect.x && y >= rect.y && x <= rect.x + rect.width && y <= rect.y + rect.height;
}
/** DOM panels and Canvas input share logical coordinates, independent of native raster density. */
export function projectUIRect(rect: ClientRect | null, canvas: ClientRect, width: number, height: number): UIRect | null {
  if (!rect || canvas.width <= 0 || canvas.height <= 0 || rect.width <= 0 || rect.height <= 0) return null;
  return { x: (rect.left - canvas.left) * width / canvas.width, y: (rect.top - canvas.top) * height / canvas.height,
    width: rect.width * width / canvas.width, height: rect.height * height / canvas.height };
}

/** Input, hover focus and cursor drawing must agree on which pixels belong to UI. */
export function isGameUIPoint(x: number, y: number, width: number, height: number, extra: {x:number;y:number;width:number;height:number}|null = null, navigationVisible = true, overlay: UIRect | null = null, lootLog: UIRect | null = null): boolean {
  const map = getMinimapRect(width, height);
  const portal = getPortalControlRect(width, height);
  const sidebar = (!!extra && x >= extra.x && y >= extra.y && x <= extra.x + extra.width && y <= extra.y + extra.height)
    || (x >= portal.x && y >= portal.y && x <= portal.x + portal.width && y <= portal.y + portal.height)
    || (x >= map.x && y >= map.y && x <= map.x + map.width && y <= map.y + map.height);
  return isUIRectPoint(x, y, overlay) || isUIRectPoint(x, y, lootLog) || isHUDPoint(x, y, width, height) || (navigationVisible && sidebar);
}
