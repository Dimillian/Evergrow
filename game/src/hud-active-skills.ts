import type { SkillId } from './character-types.ts';
import { skillIconSVG, SKILL_DEFINITIONS } from './skill-content.ts';
const icons = new Map<SkillId, HTMLImageElement>();

/** Code-defined vectors rasterized once at high density for the native HUD. */
export function drawActiveSkillIcon(c: CanvasRenderingContext2D, skill: SkillId): void {
  let icon = icons.get(skill);
  if (!icon) {
    icon = new Image();
    const svg = skillIconSVG(skill, 144).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replaceAll('currentColor', SKILL_DEFINITIONS[skill].color);
    icon.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    icons.set(skill, icon);
  }
  if (icon.complete && icon.naturalWidth) c.drawImage(icon, -16, -16, 32, 32);
}
