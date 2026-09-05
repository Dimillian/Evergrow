/** Shared logical coordinates for Astral artwork, controls, and pointer routing. */
export const HUD_ART = Object.freeze({
  width: 520, height: 174, maxScale: .82,
  menu: Object.freeze({ x: 186, y: 30, width: 35, height: 22, step: 37 }),
  skill: Object.freeze({ x: 135, y: 70, width: 38, height: 56, step: 42.4, count: 6 }),
  utility: Object.freeze({ left: 114, right: 342, y: 29, width: 64, height: 27 }),
  orb: Object.freeze({ left: 61, right: 459, y: 79, scale: 1.18 }),
  experience: Object.freeze({ x: 133, y: 141, width: 254, height: 28, railHeight: 7 }),
});

/** Curved support edges in coordinates relative to the HUD's center. */
export const HUD_ARM = Object.freeze({
  center: 260,
  upper: Object.freeze([123, 83, 139, 83, 145, 84, 166, 84] as const),
  lower: Object.freeze([166, 96, 145, 96, 136, 91, 123, 91] as const),
});

type Point = readonly [number, number];

// Sample the same two cubic edges used by the artwork. The bounded contour is
// computed once and remains independent of Canvas or any browser globals.
const armContour: readonly Point[] = [HUD_ARM.upper, HUD_ARM.lower].flatMap(curve =>
  Array.from({ length: 17 }, (_, i): Point => {
    const t = i / 16, u = 1 - t;
    return [
      u ** 3 * curve[0] + 3 * u * u * t * curve[2] + 3 * u * t * t * curve[4] + t ** 3 * curve[6],
      u ** 3 * curve[1] + 3 * u * u * t * curve[3] + 3 * u * t * t * curve[5] + t ** 3 * curve[7],
    ];
  }));

function isArmPoint(x: number, y: number): boolean {
  x = Math.abs(x - HUD_ARM.center);
  if (x < 122 || x > 167 || y < 82 || y > 97) return false;
  let inside = false;
  for (let i = 0, j = armContour.length - 1; i < armContour.length; j = i++) {
    const [ax, ay] = armContour[j], [bx, by] = armContour[i];
    // Include the fine metal stroke and subpixel contour approximation without
    // filling the open space above and below the curved support.
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    if ((x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 <= .5 ** 2) return true;
    if ((ay > y) !== (by > y) && x < ax + (y - ay) * dx / dy) inside = !inside;
  }
  return inside;
}

export const HUD_MENU_SHORTCUTS = [
  { id: 'character', label: 'Character', key: 'C' },
  { id: 'inventory', label: 'Inventory', key: 'I' },
  { id: 'skilltree', label: 'Skill tree', key: 'T' },
  { id: 'journal', label: 'Journal', key: 'J' },
] as const;

/** Empty bindings reserve room for future equipped skills; they perform no action. */
export const HUD_SKILL_SLOTS = [
  { id: 'basic', key: 'LMB', action: 'attack' },
  { id: 'skill-1', key: 'RMB', action: null },
  { id: 'skill-2', key: '1', action: null },
  { id: 'skill-3', key: '2', action: null },
  { id: 'skill-4', key: '3', action: null },
  { id: 'skill-5', key: '4', action: null },
] as const;

export interface HUDRect { x: number; y: number; width: number; height: number; }
export interface HUDShortcut extends HUDRect { id: string; label: string; key: string; }
export interface HUDLayout extends HUDRect { scale: number; shortcuts: HUDShortcut[]; }

/** Art and native menu targets use the same responsive transform. */
export function getHUDLayout(width: number, height: number): HUDLayout {
  const scale = Math.max(0, Math.min(HUD_ART.maxScale,
    (width - 20) / HUD_ART.width, (height - 28) / HUD_ART.height));
  const hudWidth = HUD_ART.width * scale, hudHeight = HUD_ART.height * scale;
  const x = (width - hudWidth) / 2, y = height - hudHeight - 14;
  const menu = HUD_ART.menu;
  return {
    x, y, width: hudWidth, height: hudHeight, scale,
    shortcuts: HUD_MENU_SHORTCUTS.map((shortcut, i) => ({ ...shortcut,
      x: x + (menu.x + i * menu.step) * scale, y: y + menu.y * scale,
      width: menu.width * scale, height: menu.height * scale,
    })),
  };
}

/** Block the instrument's surfaces while leaving its surrounding space playable. */
export function isHUDPoint(x: number, y: number, width: number, height: number): boolean {
  const h = getHUDLayout(width, height);
  if (h.scale <= 0 || x < h.x || x > h.x + h.width || y < h.y || y > h.y + h.height) return false;
  const lx = (x - h.x) / h.scale, ly = (y - h.y) / h.scale;
  const utility = HUD_ART.utility;
  if (ly >= utility.y && ly <= utility.y + utility.height
    && [utility.left, utility.right].some(left => lx >= left && lx <= left + utility.width)) return true;
  if (lx >= 181 && lx <= 339 && ly >= 23 && ly <= 56) return true;
  // Include a small input margin between adjacent skill plates.
  if (lx >= 133 && lx <= 387 && ly >= 64 && ly <= 136) return true;
  if (isArmPoint(lx, ly)) return true;
  const xp = HUD_ART.experience;
  if (lx >= xp.x && lx <= xp.x + xp.width && ly >= xp.y && ly <= xp.y + xp.height) return true;
  if (Math.hypot(lx - 260, ly - 13.5) <= 9) return true;
  return [HUD_ART.orb.left, HUD_ART.orb.right].some(cx =>
    Math.hypot(lx - cx, ly - HUD_ART.orb.y) <= 55
    || (Math.abs(lx - cx) <= 5 && ly >= 20 && ly <= 34)
    || (Math.abs(lx - cx) <= 34 && ly >= 120 && ly <= 142));
}
