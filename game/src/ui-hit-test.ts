import { isHUDPoint } from './hud.ts';
import { getMinimapRect } from './map-view.ts';

/** Input, hover focus and cursor drawing must agree on which pixels belong to UI. */
export function isGameUIPoint(x: number, y: number, width: number, height: number): boolean {
  const map = getMinimapRect(width, height);
  return isHUDPoint(x, y, width, height)
    || (x >= map.x && y >= map.y && x <= map.x + map.width && y <= map.y + map.height);
}
