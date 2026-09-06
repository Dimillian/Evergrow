import { isHUDPoint } from './hud.ts';
import { getMinimapRect, getPortalControlRect } from './map-view.ts';

/** Input, hover focus and cursor drawing must agree on which pixels belong to UI. */
export function isGameUIPoint(x: number, y: number, width: number, height: number, extra: {x:number;y:number;width:number;height:number}|null = null, navigationVisible = true): boolean {
  const map = getMinimapRect(width, height);
  const portal = getPortalControlRect(width, height);
  const sidebar = (!!extra && x >= extra.x && y >= extra.y && x <= extra.x + extra.width && y <= extra.y + extra.height)
    || (x >= portal.x && y >= portal.y && x <= portal.x + portal.width && y <= portal.y + portal.height)
    || (x >= map.x && y >= map.y && x <= map.x + map.width && y <= map.y + map.height);
  return isHUDPoint(x, y, width, height) || (navigationVisible && sidebar);
}
