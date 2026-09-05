import type { Player } from './model.ts';
import type { ActionResult, Attribute, EquipmentSlot, SkillId } from './character-types.ts';
import { equipItem, unequipItem, moveInventoryItem, allocateAttribute } from './inventory.ts';
import { allocateNode } from './skill-tree.ts';
import { assignSkill, refreshCharacter } from './character.ts';

export type CharacterCommand =
  | { type: 'equip'; index: number; slot?: EquipmentSlot }
  | { type: 'unequip'; slot: EquipmentSlot; index?: number }
  | { type: 'moveItem'; from: number; to: number }
  | { type: 'allocateAttribute'; attribute: Attribute }
  | { type: 'allocateNode'; id: string }
  | { type: 'assignSkill'; slot: number; skill: SkillId | null };

/** The runtime mutation boundary owns validation, commit and projection refresh.
 * Underlying sheet operations plan failures before changing state. Failed commands
 * leave combat projections and resources untouched; successful ones never heal. */
export function executeCharacterCommand(player: Player, command: CharacterCommand): ActionResult {
  let result: ActionResult;
  switch (command.type) {
    case 'equip': result = equipItem(player.character, command.index, player.level, command.slot); break;
    case 'unequip': result = unequipItem(player.character, command.slot, command.index); break;
    case 'moveItem': result = moveInventoryItem(player.character, command.from, command.to); break;
    case 'allocateAttribute': result = allocateAttribute(player.character, command.attribute); break;
    case 'allocateNode': result = allocateNode(player.character, command.id); break;
    case 'assignSkill': result = assignSkill(player, command.slot, command.skill); break;
    default: {
      const unhandled: never = command;
      throw new Error(`Unknown character command: ${unhandled}`);
    }
  }
  if (result.ok) refreshCharacter(player);
  return result;
}
