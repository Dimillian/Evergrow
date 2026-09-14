import type { Item, ItemTier } from './character-types.ts';
import type { EnemyRank } from './progression-content.ts';
export const RIFT_RULES = Object.freeze({ minimumLevel:20, guardianArrival:2.4, duration:600, progress:600, offset:10, rewards:8, keyUpgradeChance:.35, maximumKeyTier:5, goldMultiplier:6 });
export interface RiftTag { attempt:number; layout?:'clearings'; keySeed?:number; keyTier?:number }
export interface RiftProgress { elapsed:number; points:number; phase:'hunt'|'boss'|'complete'|'failed'; claimed:boolean; guardian?:{x:number;y:number;at:number}; treasure?:{x:number;y:number}; exit?:{x:number;y:number} }
export interface RiftRecord { level:number; seconds:number; keyTier:number }
export interface RiftLedger { attempts:number; clears:number; highest:number; best:RiftRecord[] }
export const freshRiftLedger=():RiftLedger=>({attempts:0,clears:0,highest:0,best:[]});
export const riftPoints=(rank:EnemyRank)=>rank==='elite'?8:rank==='veteran'?4:1;
export function riftRandom(seed:number) { let n=seed>>>0; return ()=>{ n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296; }; }
export const RIFT_HAZARDS = [
  {id:'vital',name:'Unyielding',label:'Monster life',unit:'%',base:20,step:12},
  {id:'savage',name:'Savage',label:'Monster damage',unit:'%',base:8,step:5},
  {id:'swift',name:'Relentless',label:'Monster movement',unit:'%',base:8,step:3},
  {id:'court',name:'Royal Court',label:'Elite chance',unit:'%',base:5,step:3},
  {id:'density',name:'Teeming',label:'Monster density',unit:'%',base:25,step:10},
] as const;
export const RIFT_BOONS = [
  {id:'gold',name:'Gilded',label:'Chest gold',unit:'%',base:35,step:25},
  {id:'fortune',name:'Fortunate',label:'Chest magic find',unit:'%',base:25,step:20},
  {id:'bounty',name:'Bountiful',label:'Extra chest items',unit:'',base:1,step:1},
] as const;
export interface RiftModifier { id:string; label:string; value:number; unit:string; beneficial:boolean }
const modifierCache=new WeakMap<RiftTag,{seed:number;tier:number;modifiers:readonly RiftModifier[]}>();
const NO_MODIFIERS:readonly RiftModifier[]=Object.freeze([]);
export function riftModifiers(tag:RiftTag):readonly RiftModifier[] {
  if(tag.keySeed===undefined||tag.keyTier===undefined)return NO_MODIFIERS;
  const cached=modifierCache.get(tag);if(cached&&cached.seed===tag.keySeed&&cached.tier===tag.keyTier)return cached.modifiers;
  const random=riftRandom(tag.keySeed^0x719bef21), tier=tag.keyTier;
  const hazards=[...RIFT_HAZARDS],boons=[...RIFT_BOONS];
  const roll=(pool:typeof hazards|typeof boons,count:number,beneficial:boolean)=>Array.from({length:count},()=>{
    const d=pool.splice(Math.floor(random()*pool.length),1)[0];
    return {id:d.id,label:d.label,value:d.base+d.step*(tier-1),unit:d.unit,beneficial};
  });
  const modifiers=[...roll(hazards,Math.min(3,1+Math.floor(tier/2)),false),...roll(boons,Math.min(3,1+Math.floor((tier-1)/2)),true)];
  modifiers.forEach(Object.freeze);Object.freeze(modifiers);modifierCache.set(tag,{seed:tag.keySeed,tier,modifiers});return modifiers;
}
export function riftBonus(tag:RiftTag|undefined,id:string):number {return tag?riftModifiers(tag).find(m=>m.id===id)?.value??0:0;}
export function createRiftKey(seed:number,level:number,tier=1):Item {
  seed=seed>>>0;level=Math.max(1,Math.min(1e6,Math.floor(level)));tier=Math.max(1,Math.min(RIFT_RULES.maximumKeyTier,Math.floor(tier)));
  const tiers:ItemTier[]=['common','magic','rare','epic','legendary'];
  return {id:`rift-key:${seed}:${level}:${tier}`,seed,name:'Crimson Rift Key',baseName:'Crimson Rift Key',kind:'riftKey',tier:tiers[tier-1],itemLevel:level,requiredLevel:20,power:0,
    implicit:{},affixes:[],recipe:{riftKeyTier:tier,starter:false,enhancement:0,revision:0,targetedRolls:0,fullRolls:0,rolls:[]},
    appearance:{base:'#7c234b',shadow:'#260f2b',edge:'#ef739d',trim:'#daaaef',style:'plate'}};
}
export function validRiftKey(v:unknown):v is Item {
  if(!v||typeof v!=='object')return false;
  const k=v as Item,t=k.recipe?.riftKeyTier;
  if(!Number.isInteger(k.seed)||k.seed<0||k.seed>4294967295||!Number.isInteger(k.itemLevel)||k.itemLevel<1||k.itemLevel>1e6||!Number.isInteger(t)||t!<1||t!>5||k.locked!==undefined&&typeof k.locked!=='boolean')return false;
  const expected=createRiftKey(k.seed,k.itemLevel,t);
  return Object.keys(expected).every(key=>JSON.stringify(k[key as keyof Item])===JSON.stringify(expected[key as keyof Item]));
}
export function validRiftTag(v:unknown):v is RiftTag {
  if(!v||typeof v!=='object')return false;const t=v as RiftTag;
  return (t.layout===undefined||t.layout==='clearings')&&Number.isSafeInteger(t.attempt)&&t.attempt>0&&t.attempt<1e9&&(t.keySeed===undefined?t.keyTier===undefined:Number.isInteger(t.keySeed)&&t.keySeed>=0&&t.keySeed<=4294967295&&Number.isInteger(t.keyTier)&&t.keyTier!>=1&&t.keyTier!<=5);
}
export function validRiftLedger(v:unknown):v is RiftLedger {
  if(!v||typeof v!=='object')return false;const l=v as RiftLedger;
  return Number.isSafeInteger(l.attempts)&&l.attempts>=0&&l.attempts<1e9&&Number.isInteger(l.clears)&&l.clears>=0&&l.clears<=l.attempts&&Number.isInteger(l.highest)&&l.highest>=0&&l.highest<=1e6&&Array.isArray(l.best)&&l.best.length<=600&&l.best.every(r=>Number.isInteger(r.level)&&r.level>=1&&r.level<=1e6&&Number.isFinite(r.seconds)&&r.seconds>=0&&r.seconds<=600&&Number.isInteger(r.keyTier)&&r.keyTier>=0&&r.keyTier<=5);
}

export function riftEnemyStats<T extends {maxHp:number;damage:number}>(stats:T,tag?:RiftTag):T {
  if(!tag)return stats;
  return {...stats,maxHp:Math.round(stats.maxHp*(1+riftBonus(tag,'vital')/100)),damage:Math.round(stats.damage*(1+riftBonus(tag,'savage')/100))};
}

/** Gear rolls plus the guaranteed key; gold uses the following claim bit. */
export const riftRewardItemCount=(tag:RiftTag)=>RIFT_RULES.rewards+riftBonus(tag,'bounty')+1;
export const riftRewardMask=(tag:RiftTag)=>(1 << (riftRewardItemCount(tag)+1))-1;
