import { vendorIdentity, vendorEmblem } from './vendor-identity.ts';
import { type TownNPC } from './npcs.ts';
import { drawHumanoid } from './art.ts';
import { UNARMED_WEAPON } from './equipment.ts';
import { SKIN_PALETTES, HAIR_PALETTES, HAIR_STYLES, FACIAL_HAIR, ACCESSORIES } from './appearance-content.ts';
import type { CharacterPose, ArmorPiece } from './art-types.ts';
import type { Resident } from './settlement-residents.ts';
const looks=new Map<number,Pick<CharacterPose,'appearance'|'outfit'>>();
function npcLook(seed:number,role:string):Pick<CharacterPose,'appearance'|'outfit'>{
  const key=seed,old=looks.get(key);if(old)return old;
  const colors=['#68775b','#756246','#646887','#825552','#426b66','#78717d','#8a784f','#4e6579'];
  const base=vendorIdentity(role)?.cloth??colors[seed%colors.length];
  const piece=(salt:number,style:'cloth'|'leather'='cloth'):ArmorPiece=>({seed:seed+salt,style,material:{surface:style==='cloth'?'cloth':'leather',base,shadow:'#283338',edge:'#a1997d',trim:'#baa476'}});
  const result={appearance:{skin:SKIN_PALETTES[seed%SKIN_PALETTES.length].id,hairColor:HAIR_PALETTES[(seed>>>4)%HAIR_PALETTES.length].id,hair:HAIR_STYLES[(seed>>>8)%HAIR_STYLES.length].id,facialHair:FACIAL_HAIR[(seed>>>13)%FACIAL_HAIR.length].id,accessory:ACCESSORIES[(seed>>>17)%ACCESSORIES.length].id},
    outfit:{head:null,chest:piece(1,role==='blacksmith'?'leather':'cloth'),shoulders:null,hands:null,legs:piece(2),boots:piece(3,'leather'),cloak:seed%3===0?{base,shadow:'#243238',highlight:'#9a977d',trim:'#b49a6a',seed}:null}};
  if(looks.size>=128)looks.delete(looks.keys().next().value!);looks.set(key,result);return result;
}
/** Keep civilian bodies and their ground shadows at the same scale. */
export function npcArtScale(npc:TownNPC|Resident):number{return 'household' in npc && npc.child ? .72 : 1;}
/** Merchants and families use the same full procedural body, face, hair, clothes and gait as players. */
export function drawNPC(c:CanvasRenderingContext2D,npc:TownNPC|Resident,time:number,reduced=false):void{
  if('role'in npc&&npc.role==='stash')return;
  const resident='household'in npc,role='role'in npc?npc.role:'resident';
  const look=npcLook(npc.seed,role);
  c.save();c.translate(npc.x,npc.y);const scale=npcArtScale(npc);c.scale(scale,scale);
  drawHumanoid(c,{kind:'player',...look,appearance:resident&&npc.child?{...look.appearance!,facialHair:'none'}:look.appearance,
    angle:resident?npc.angle:Math.PI/2,time:reduced?0:time+npc.seed%37,moving:resident&&!reduced?npc.moving:0,
    gaitPhase:time*2.2,attack:0,attackAngle:Math.PI/2,weapon:UNARMED_WEAPON.visual,offHand:null,hitFlash:0,dodging:false});
  c.restore();
}
export function npcEmblem(role:TownNPC['role']):string{return vendorEmblem(role);}
