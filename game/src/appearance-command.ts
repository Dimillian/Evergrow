import { cloneData } from './data-clone.ts';
import type { Player } from './model.ts';
import type { ActionResult, CharacterSheet } from './character-types.ts';
import { validCharacterLook, type CharacterLook } from './character-look.ts';
/** Cosmetic edits persist a detached sheet first. No stats, health, gear or live draft change on failure. */
export async function executeAppearanceChange(player:Player,look:CharacterLook,persist:(sheet:CharacterSheet)=>Promise<ActionResult>):Promise<ActionResult> {
  if(!validCharacterLook(look))return {ok:false,message:'Choose valid appearance options.'};
  const sheet=cloneData(player.character);sheet.look=cloneData(look);
  const result=await persist(sheet);
  if(result.ok)player.character=sheet;
  return result;
}
