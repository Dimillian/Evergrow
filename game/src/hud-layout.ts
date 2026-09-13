/** Shared logical coordinates for Astral artwork, controls, and pointer routing. */
export const HUD_ART = Object.freeze({
  width: 520, height: 150, maxScale: .82,
  menu: Object.freeze({ x: 246, y: 31, width: 28, height: 28 }),
  skill: Object.freeze({ x: 134, y: 65, width: 40, height: 40, step: 42, count: 6 }),
  utility: Object.freeze({ left: 113, right: 379, y: 27, width: 28, height: 28 }),
  orb: Object.freeze({ left: 74, right: 446, y: 70, scale: 1.18, readoutY: 122 }),
  inventory: Object.freeze({ skillY: 51, experienceY: 99, height: 136 }),
  experience: Object.freeze({ x: 133, y: 117, width: 254, height: 28, railHeight: 7 }),
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
    shortcuts: [{ id: 'menu', label: 'Character menus', key: '',
      x: x + menu.x * scale, y: y + menu.y * scale,
      width: menu.width * scale, height: menu.height * scale }],
  };
}

/** Block the instrument's surfaces while leaving its surrounding space playable. */
export function isHUDPoint(x: number, y: number, width: number, height: number): boolean {
  const h = getHUDLayout(width, height);
  if (h.scale <= 0 || x < h.x || x > h.x + h.width || y < h.y || y > h.y + h.height) return false;
  // The menu button uses the same bounds as its native target.
  if (h.shortcuts.some(s => x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height)) return true;
  const lx = (x - h.x) / h.scale, ly = (y - h.y) / h.scale;
  const utility = HUD_ART.utility;
  if ([utility.left, utility.right].some((left, i) => lx >= left - (i ? 27 : 0) && lx <= left + utility.width + (i ? 0 : 15)
    && ly >= utility.y && ly <= utility.y + utility.height + 5)) return true;
  // Include a small input margin between adjacent skill plates.
  const skill = HUD_ART.skill;
  if (lx >= skill.x - 2 && lx <= skill.x + 5 * skill.step + skill.width + 2
    && ly >= skill.y - 4 && ly <= skill.y + skill.height + 7) return true;
  const xp = HUD_ART.experience;
  if (lx >= xp.x && lx <= xp.x + xp.width && ly >= xp.y && ly <= xp.y + xp.height) return true;
  return [HUD_ART.orb.left, HUD_ART.orb.right].some(cx =>
    Math.hypot(lx - cx, ly - HUD_ART.orb.y) <= 55
    || (Math.abs(lx - cx) <= 5 && ly >= HUD_ART.orb.y - 59 && ly <= HUD_ART.orb.y - 45)
    || (Math.abs(lx - cx) <= 34 && ly >= HUD_ART.orb.readoutY - 11 && ly <= HUD_ART.orb.readoutY + 11));
}
