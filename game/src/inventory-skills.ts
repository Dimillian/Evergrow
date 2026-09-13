import { skillIconSVG } from './skill-icon.ts';
import type { Player } from './model.ts';
import { HUD_ART, HUD_SKILL_SLOTS } from './hud-layout.ts';
import { SKILL_DEFINITIONS, canUseSkill, skillRequirementLabel } from './skill-content.ts';
import { resolveSkill } from './skill-progression.ts';
import { unlockedSkills } from './skill-tree.ts';
import { escapeUI } from './ui-components.ts';

export const INVENTORY_SKILL_BINDINGS = HUD_SKILL_SLOTS.slice(1);

/** One transform for the shared HUD artwork and native targets inside the inventory footer. */
export function inventoryHUDLayout(width: number, height: number) {
  const topTrim = 8;
  const scale = Math.max(0, Math.min(HUD_ART.maxScale, (width - 12) / HUD_ART.width,
    (height - 8) / (HUD_ART.inventory.height - topTrim)));
  const hud = { x: (width - HUD_ART.width * scale) / 2, y: 4 - topTrim * scale, scale };
  const field = HUD_ART.skill;
  return {
    hud,
    slots: INVENTORY_SKILL_BINDINGS.map((binding, slot) => ({ ...binding,
      x: hud.x + (field.x + (slot + 1) * field.step) * scale,
      y: hud.y + HUD_ART.inventory.skillY * scale,
      width: field.width * scale, height: field.height * scale,
    })),
  };
}

/** A compact assignment menu; full descriptions and progression stay in the atlas. */
export function inventorySkillPickerMarkup(player: Player, slot: number): string {
  const binding = INVENTORY_SKILL_BINDINGS[slot].key;
  const skills = unlockedSkills(player.character.allocatedNodes).map(id => SKILL_DEFINITIONS[id])
    .sort((a, b) => Number(canUseSkill(b.id, player.equipment)) - Number(canUseSkill(a.id, player.equipment)) || a.name.localeCompare(b.name));
  return `<div class="inventory-skill-choices ui-scroll-area">${skills.length ? skills.map(skill => {
    const resolved = resolveSkill(skill.id, player.derived, player.character);
    const compatible = canUseSkill(skill.id, player.equipment), assigned = player.character.skillSlots.indexOf(skill.id);
    const selected = assigned === slot;
    const detail = `${resolved.mana} mana${compatible ? '' : ` · Requires ${skillRequirementLabel(skill.requirement)}`}`;
    return `<button type="button" class="inventory-skill-choice" data-assign-skill="${skill.id}" aria-pressed="${selected}" title="${escapeUI(detail)}" style="--skill-color:${skill.color}">
      <span class="inventory-skill-icon">${skillIconSVG(skill.id, 24)}</span><span class="inventory-skill-copy"><strong>${escapeUI(resolved.variant?.name ?? skill.name)}</strong><small class="${compatible ? '' : 'is-loss'}">${escapeUI(detail)}</small></span>
      <span class="inventory-skill-binding">${selected ? '✓' : assigned >= 0 ? `← ${INVENTORY_SKILL_BINDINGS[assigned].key}` : ''}</span></button>`;
  }).join('') : '<p class="inventory-skill-empty">No unlocked skills yet. Learn one in the skill atlas.</p>'}</div>
  <footer class="inventory-skill-picker-footer"><button type="button" class="ui-button ui-button--quiet" data-assign-skill="" ${player.character.skillSlots[slot] ? '' : 'disabled'}>Clear ${binding}</button><button type="button" class="ui-button ui-button--quiet" data-skill-details>Skill details</button></footer>`;
}
