import type { CharacterOutfit, ArmorMaterial } from './art-types.ts';
import { ARMOR_PARTS, ARMOR_TINTS, type ArmorTints } from './appearance-armor-content.ts';
export { ARMOR_PARTS, ARMOR_TINTS, type ArmorPart, type ArmorTints } from './appearance-armor-content.ts';
// Armor shading performs additional hex-only blends; keep every projected material in that format.
function mixColor(from:string,to:string,amount:number):string {
  return '#'+[1,3,5].map(offset=>Math.round(
    Number.parseInt(from.slice(offset,offset+2),16)*(1-amount)
    +Number.parseInt(to.slice(offset,offset+2),16)*amount
  ).toString(16).padStart(2,'0')).join('');
}
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
