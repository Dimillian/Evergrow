import { cloneData } from './data-clone.ts';
import type { Player } from './model.ts';
import type { ActionResult, CharacterSheet } from './character-types.ts';
import { validCharacterLook, type CharacterLook } from './character-look.ts';
import type { CharacterRepositoryPort, SaveSlot } from './character-storage.ts';
import type { CharacterSave } from './character-save.ts';
/** Cosmetic edits persist a detached sheet first. No stats, health, gear or live draft change on failure. */
export async function executeAppearanceChange(player:Player,look:CharacterLook,persist:(sheet:CharacterSheet)=>Promise<ActionResult>):Promise<ActionResult> {
  if(!validCharacterLook(look))return {ok:false,message:'Choose valid appearance options.'};
  const sheet=cloneData(player.character);sheet.look=cloneData(look);
  const result=await persist(sheet);
  if(result.ok)player.character=sheet;
  return result;
}

/** Edit a hall save without activating a session, upgrading its world or touching runtime state. */
export async function executeSavedAppearanceChange(repository: CharacterRepositoryPort, slot: SaveSlot, look: CharacterLook, now: number): Promise<{ok:true; record:CharacterSave; token:string} | {ok:false; message:string}> {
  if (!validCharacterLook(look)) return {ok:false, message:'Choose valid appearance options.'};
  if (!slot.record || slot.conflict) return {ok:false, message:'Resolve this character’s save before editing appearance.'};
  const record = cloneData(slot.record);
  record.checkpoint.character.look = cloneData(look);
  record.updatedAt = Math.max(record.updatedAt + 1, now);
  const current = await repository.read(slot.index);
  if (current.conflict || current.token !== slot.token || current.record?.id !== slot.record.id) {
    return {ok:false, message:'This character changed. Return to the hall and select it again before editing.'};
  }
  const result = await repository.write(slot.index, record, slot.token);
  return result.ok ? {ok:true, record, token:result.token} : result;
}
