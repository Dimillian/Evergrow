import { refreshCharacter } from './character.ts';
import { cloneData } from './data-clone.ts';
import { executeCharacterCommand, type CharacterCommand } from './character-commands.ts';
import type { ActionResult, CharacterSheet } from './character-types.ts';
import type { Player } from './model.ts';

/** Payment, refunded points and clamped resources persist together before live commitment. */
export async function executeSkillRespec(player: Player, command: Extract<CharacterCommand, { type: 'respecSkills' | 'refundNode' }>,
  persist: (sheet: CharacterSheet, hp: number, mana: number, cooldowns: Player['skillCooldowns']) => Promise<ActionResult>): Promise<ActionResult> {
  const candidate = cloneData(player);
  const result = executeCharacterCommand(candidate, command);
  if (!result.ok) return result;
  const saved = await persist(candidate.character, candidate.hp, candidate.mana, candidate.skillCooldowns);
  if (!saved.ok) return saved;
  player.character = candidate.character;
  player.skillCooldowns = candidate.skillCooldowns; player.affixBuffs = undefined; player.skillEffects = undefined;
  refreshCharacter(player);
  return result;
}
