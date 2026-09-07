import { ACCESSORIES, DEFAULT_APPEARANCE, FACIAL_HAIR, HAIR_PALETTES, HAIR_STYLES, SKIN_PALETTES, type CharacterAppearance } from './appearance-content.ts';
import { ARMOR_PARTS, ARMOR_TINTS, type ArmorTints } from './appearance-armor-content.ts';
export interface CharacterLook { appearance:CharacterAppearance; armorTints:ArmorTints; showHelmet:boolean; }
export function createCharacterLook():CharacterLook {return {appearance:{...DEFAULT_APPEARANCE},armorTints:{},showHelmet:false};}
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
/** Only bounded catalog IDs cross command/save boundaries. Unknown keys are rejected. */
export function validCharacterLook(v:unknown):v is CharacterLook {
  if(!record(v)||Object.keys(v).length!==3||!record(v.appearance)||Object.keys(v.appearance).length!==5||typeof v.showHelmet!=='boolean'||!record(v.armorTints))return false;
  const a=v.appearance;
  return SKIN_PALETTES.some(p=>p.id===a.skin)&&HAIR_PALETTES.some(p=>p.id===a.hairColor)&&HAIR_STYLES.some(p=>p.id===a.hair)
    &&FACIAL_HAIR.some(p=>p.id===a.facialHair)&&ACCESSORIES.some(p=>p.id===a.accessory)
    &&Object.entries(v.armorTints).every(([part,tint])=>ARMOR_PARTS.some(p=>p.id===part)&&ARMOR_TINTS.some(p=>p.id===tint));
}
