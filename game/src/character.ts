import type { Player } from './model.ts';
import type { ActionResult, SkillId } from './character-types.ts';
import { deriveCharacterStats } from './character-stats.ts';
import { getTreeBonuses, unlockedSkills } from './skill-tree.ts';
import { UNARMED_WEAPON } from './equipment.ts';
import { awardExperience } from './progression.ts';

/** Rebuild combat projections from the character's single source of truth. */
export function refreshCharacter(player: Player): void {
  const derived = deriveCharacterStats(player.character, getTreeBonuses(player.character.allocatedNodes));
  player.derived = derived;
  player.stats = { attackDamageMultiplier: derived.attackDamageMultiplier, attackSpeedMultiplier: derived.attackSpeedMultiplier };
  player.equipment = { mainHand: player.character.equipped.weapon?.weapon ?? UNARMED_WEAPON, offHand: null };
  player.maxHp = derived.maxHp; player.maxMana = derived.maxMana;
  player.hp = Math.min(player.hp, player.maxHp); player.mana = Math.min(player.mana, player.maxMana);
}

export function awardCharacterExperience(player: Player, amount: number): number {
  const before = player.level;
  awardExperience(player, amount);
  const levels = player.level - before;
  player.character.skillPoints += levels;
  player.character.statPoints += levels * 5;
  return levels;
}

export function assignSkill(player: Player, slot: number, skill: SkillId | null): ActionResult {
  if (!Number.isInteger(slot) || slot < 0 || slot >= 5) return { ok: false, message: 'Choose one of the five skill slots.' };
  if (skill !== null && !unlockedSkills(player.character.allocatedNodes).includes(skill)) return { ok: false, message: 'Unlock this skill in the tree first.' };
  if (skill) player.character.skillSlots = player.character.skillSlots.map(id => id === skill ? null : id);
  player.character.skillSlots[slot] = skill;
  return { ok: true };
}
