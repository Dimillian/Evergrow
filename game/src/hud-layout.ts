/** Shared logical coordinates for Astral artwork, controls, and pointer routing. */
export const HUD_ART = Object.freeze({
  width: 520, height: 174, maxScale: .82,
  rail: Object.freeze({ x: 133, y: 35, width: 254, height: 26 }),
  crest: Object.freeze({ x: 260, y: 25, radius: 6.5 }),
  menu: Object.freeze({ x: 186, y: 38, width: 35, height: 20, step: 37, badgeRise: 13 }),
  skill: Object.freeze({ x: 135, y: 70, width: 38, height: 56, step: 42.4, count: 6 }),
  utility: Object.freeze({ left: 136, right: 340, y: 37, width: 44, height: 22 }),
  orb: Object.freeze({ left: 74, right: 446, y: 79, scale: 1.18 }),
  experience: Object.freeze({ x: 133, y: 141, width: 254, height: 28, railHeight: 7 }),
});

export const HUD_MENU_SHORTCUTS = [
  { id: 'character', label: 'Character', key: 'C' },
  { id: 'inventory', label: 'Inventory', key: 'I' },
  { id: 'skilltree', label: 'Skill tree', key: 'T' },
  { id: 'journal', label: 'Journeys', key: 'J' },
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
      x: x + (menu.x + i * menu.step) * scale, y: y + (menu.y - (i === 0 || i === 2 ? menu.badgeRise : 0)) * scale,
      width: menu.width * scale, height: (menu.height + (i === 0 || i === 2 ? menu.badgeRise : 0)) * scale,
    })),
  };
}

/** Block the instrument's surfaces while leaving its surrounding space playable. */
export function isHUDPoint(x: number, y: number, width: number, height: number): boolean {
  const h = getHUDLayout(width, height);
  if (h.scale <= 0 || x < h.x || x > h.x + h.width || y < h.y || y > h.y + h.height) return false;
  // Numbered seals belong to their menu target, even above the glass rail.
  if (h.shortcuts.some(s => x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height)) return true;
  const lx = (x - h.x) / h.scale, ly = (y - h.y) / h.scale;
  const rail = HUD_ART.rail;
  if (lx >= rail.x && lx <= rail.x + rail.width && ly >= rail.y && ly <= rail.y + rail.height) return true;
  // Include a small input margin between adjacent skill plates.
  if (lx >= 133 && lx <= 387 && ly >= 64 && ly <= 136) return true;
  const xp = HUD_ART.experience;
  if (lx >= xp.x && lx <= xp.x + xp.width && ly >= xp.y && ly <= xp.y + xp.height) return true;
  if (Math.hypot(lx - HUD_ART.crest.x, ly - HUD_ART.crest.y) <= HUD_ART.crest.radius) return true;
  return [HUD_ART.orb.left, HUD_ART.orb.right].some(cx =>
    Math.hypot(lx - cx, ly - HUD_ART.orb.y) <= 55
    || (Math.abs(lx - cx) <= 5 && ly >= 20 && ly <= 34)
    || (Math.abs(lx - cx) <= 34 && ly >= 120 && ly <= 142));
}
