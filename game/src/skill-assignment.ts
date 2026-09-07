import type { Player } from './model.ts';
import type { ActionResult, SkillId } from './character-types.ts';
import { canUseSkill } from './skill-content.ts';
import { unlockedSkills } from './skill-tree.ts';
import { assignSkill } from './character.ts';

/** Equipment compatibility, not current mana/cooldowns, determines assignability. */
export function assignableSkills(player: Player): SkillId[] {
  return unlockedSkills(player.character.allocatedNodes).filter(id =>
    !player.character.skillSlots.includes(id) && canUseSkill(id, player.equipment));
}

export function assignEmptySkill(player: Player, slot: number, skill: SkillId): ActionResult {
  if (!Number.isInteger(slot) || slot < 0 || slot >= 5) return { ok: false, message: 'Choose one of the five skill slots.' };
  if (player.character.skillSlots[slot] !== null) return { ok: false, message: 'This slot already has a skill.' };
  if (!assignableSkills(player).includes(skill)) return { ok: false, message: 'This skill is no longer available for this slot.' };
  return assignSkill(player, slot, skill);
}
