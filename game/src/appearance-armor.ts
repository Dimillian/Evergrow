import type { CharacterOutfit, ArmorMaterial } from './art-types.ts';
import { mixColor } from './art-primitives.ts';
export const ARMOR_PARTS = [
  {id:'head',name:'Helmet'}, {id:'chest',name:'Chest'}, {id:'shoulders',name:'Shoulders'},
  {id:'hands',name:'Gloves'}, {id:'legs',name:'Legs'}, {id:'boots',name:'Boots'}, {id:'cloak',name:'Cloak'},
] as const;
export type ArmorPart = typeof ARMOR_PARTS[number]['id'];
export type ArmorTints = Partial<Record<ArmorPart,string>>;
export const ARMOR_TINTS = [
  {id:'crimson',name:'Crimson',color:'#a74749'}, {id:'wine',name:'Wine',color:'#6f3d59'},
  {id:'copper',name:'Copper',color:'#b17447'}, {id:'gold',name:'Antique gold',color:'#b6a168'},
  {id:'ivory',name:'Ivory',color:'#d6d0b7'}, {id:'moss',name:'Moss',color:'#748d55'},
  {id:'jade',name:'Jade',color:'#508875'}, {id:'teal',name:'Teal',color:'#42838c'},
  {id:'ocean',name:'Ocean',color:'#4b6c9c'}, {id:'indigo',name:'Indigo',color:'#625b95'},
  {id:'violet',name:'Violet',color:'#9770a8'}, {id:'rose',name:'Rose',color:'#b6828c'},
  {id:'silver',name:'Silver',color:'#a5b2b9'}, {id:'slate',name:'Slate',color:'#576e7a'},
  {id:'umber',name:'Umber',color:'#795942'}, {id:'obsidian',name:'Obsidian',color:'#343d49'},
] as const;
/** Recolor a projection only. Trim, seeds, contours and authoritative items remain untouched. */
export function tintedOutfit(outfit:Partial<CharacterOutfit>, tints:ArmorTints, showHelmet:boolean):Partial<CharacterOutfit> {
  const result={...outfit};
  for(const part of ARMOR_PARTS) {
    const tint=ARMOR_TINTS.find(p=>p.id===tints[part.id]); if(!tint) continue;
    const material=(m:ArmorMaterial):ArmorMaterial=>({...m,base:mixColor(m.base,tint.color,.72),shadow:mixColor(m.shadow,mixColor(tint.color,'#07131a',.62),.65),edge:mixColor(m.edge,mixColor(tint.color,'#f2e6ca',.48),.6)});
    if(part.id==='cloak') {const p=outfit.cloak;if(p){const m=material({base:p.base,shadow:p.shadow,edge:p.highlight,trim:p.trim});result.cloak={...p,base:m.base,shadow:m.shadow,highlight:m.edge};}}
    else {const p=outfit[part.id];if(p)result[part.id]={...p,material:material(p.material)};}
  }
  if(!showHelmet) result.head=null;
  return result;
}
