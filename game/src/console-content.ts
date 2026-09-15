import type { ItemKind, ItemTier } from './character-types.ts';
import type { EnemyKind } from './model.ts';
import type { EnemyRank } from './progression-content.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { isBossKind } from './wilderness-boss-content.ts';
import { ITEM_KINDS } from './items.ts';
import { ITEM_MATERIALS, itemMaterialPool, type ItemMaterialId } from './item-materials.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from './weapon-content.ts';
import { FOCUS_PROFILES } from './focus-content.ts';
import { JEWELRY_PROFILES } from './jewelry-content.ts';
import { CHARM_PROFILES } from './charm-content.ts';

export const CONSOLE_LIMITS = { text:240, count:32, history:30, candidates:2048 } as const;
export const CONSOLE_COMMANDS = [
  {id:'help', detail:'Browse commands and their arguments', syntax:'help [command]', flags:[]},
  {id:'drop', detail:'Drop generated equipment at your feet', syntax:'drop <item> [--level N] [--profile ID] [--material ID] [--rarity ID] [--count N] [--seed N]', flags:['level','profile','material','rarity','count','seed']},
  {id:'spawn', detail:'Summon monsters beyond the camera', syntax:'spawn <monster> [--level N] [--rank normal|veteran|elite] [--count N] [--seed N]', flags:['level','rank','count','seed']},
  {id:'hp', detail:'Refill health to maximum', syntax:'hp', flags:[]},
  {id:'mana', detail:'Refill available, unreserved mana', syntax:'mana', flags:[]},
  {id:'refill', detail:'Refill both health and available mana', syntax:'refill', flags:[]},
] as const;
export type ConsoleCommandName = typeof CONSOLE_COMMANDS[number]['id'];
export type ConsoleCommand = {type:'help'; command?:ConsoleCommandName} | {type:'hp'} | {type:'mana'} | {type:'refill'}
  | {type:'drop'; kind:ItemKind; level?:number; profile?:string; material?:ItemMaterialId; rarity?:ItemTier; count:number; seed?:number}
  | {type:'spawn'; kind:EnemyKind; level?:number; rank:EnemyRank; count:number; seed?:number};
export const consoleItems:ItemKind[] = ITEM_KINDS.filter(k=>k!=='riftKey');
export const consoleEnemies = (Object.keys(ENEMY_DEFINITIONS) as EnemyKind[]).filter(k=>!isBossKind(k)&&k!=='warden'&&k!=='goblinChief');
const rarities = ['common','magic','rare','epic','legendary'] as const;
const ranks = ['normal','veteran','elite'] as const;
const itemKind = (name:string) => name==='helmet'?'head':name;
export function consoleProfiles(kind:string) {
  return kind==='weapon'?WEAPON_PROFILES:kind==='shield'?SHIELD_PROFILES:kind==='charm'?CHARM_PROFILES
    :kind==='ring'||kind==='amulet'?JEWELRY_PROFILES.filter(p=>p.kind===kind):FOCUS_PROFILES.filter(p=>p.visual.kind===kind);
}
export function consoleMaterials(kind:ItemKind, profile?:string) {
  return kind==='charm'||kind==='weapon'&&!profile?[]:itemMaterialPool(kind, WEAPON_PROFILES.find(p=>p.id===profile)?.family);
}
function integer(raw:string|undefined, label:string, min:number, max:number):number|undefined {
  if(raw===undefined)return undefined;
  const value=Number(raw);
  if(!/^\d+$/.test(raw)||!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return value;
}
/** Strict grammar, never JavaScript evaluation. Parsing cannot mutate the game. */
export function parseConsoleCommand(raw:string):ConsoleCommand {
  if(raw.length>CONSOLE_LIMITS.text)throw new Error(`Keep commands under ${CONSOLE_LIMITS.text} characters.`);
  const tokens=raw.trim().split(/\s+/), name=tokens.shift()?.toLowerCase();
  const definition=CONSOLE_COMMANDS.find(c=>c.id===name);
  if(!definition)throw new Error('Unknown command. Type help to see available commands.');
  if(name==='help') {
    if(tokens.length>1||tokens[0]&&!CONSOLE_COMMANDS.some(c=>c.id===tokens[0]))throw new Error('Use help or help <command>.');
    return {type:'help',command:tokens[0] as ConsoleCommandName|undefined};
  }
  if(name==='hp'||name==='mana'||name==='refill') {
    if(tokens.length)throw new Error(`${name} takes no arguments.`);
    return {type:name};
  }
  const subject=tokens.shift();
  if(!subject||subject.startsWith('--'))throw new Error(`Use ${definition.syntax}`);
  const flags:Record<string,string>={};
  while(tokens.length) {
    const flag=tokens.shift()!, key=flag.slice(2), value=tokens.shift();
    if(!flag.startsWith('--')||!(definition.flags as readonly string[]).includes(key))throw new Error(`Unknown argument ${flag}. Use help ${name}.`);
    if(Object.hasOwn(flags,key))throw new Error(`Use --${key} only once.`);
    if(!value||value.startsWith('--'))throw new Error(`--${key} needs a value.`);
    flags[key]=value;
  }
  const level=integer(flags.level,'Level',1,1e6), count=integer(flags.count,'Count',1,CONSOLE_LIMITS.count)??1, seed=integer(flags.seed,'Seed',0,4294967295);
  if(name==='spawn') {
    const kind=consoleEnemies.find(k=>k.toLowerCase()===subject.toLowerCase());
    if(!kind)throw new Error('Choose an ordinary monster from the suggestions. Bosses require their own encounters.');
    const rank=flags.rank??'normal';if(!(ranks as readonly string[]).includes(rank))throw new Error('Rank must be normal, veteran or elite.');
    return {type:'spawn',kind,rank:rank as EnemyRank,level,count,seed};
  }
  const kind=itemKind(subject.toLowerCase()) as ItemKind;
  if(!consoleItems.includes(kind))throw new Error('Unknown item type. Try helmet, weapon, shield, ring or charm.');
  if(flags.profile&&!consoleProfiles(kind).some(p=>p.id===flags.profile))throw new Error('Choose a profile matching this item type.');
  if(kind==='weapon'&&flags.material&&!flags.profile)throw new Error('Choose --profile before setting a weapon material.');
  if(flags.material&&!consoleMaterials(kind,flags.profile).some(m=>m.id===flags.material))throw new Error('Choose a material matching this item type.');
  if(flags.rarity&&!(rarities as readonly string[]).includes(flags.rarity))throw new Error('Rarity must be common, magic, rare, epic or legendary.');
  return {type:'drop',kind,level,count,seed,profile:flags.profile,material:flags.material as ItemMaterialId|undefined,rarity:flags.rarity as ItemTier|undefined};
}
export function consoleHelp(command?:ConsoleCommandName):string {
  return CONSOLE_COMMANDS.filter(c=>!command||c.id===command).map(c=>`${c.syntax}\n${c.detail}`).join('\n\n')
    +(command==='drop'?'\n\nLevel defaults to your level. Unspecified rarity, material and affixes roll normally. Helmet is head armor.':command==='spawn'?'\n\nWithout --level, monsters use regional scaling. Spawn works in the wilderness, outside towns and dungeons.':'');
}
export interface ConsoleSuggestion {label:string; detail:string; value:string; mark:string}
const flagDetails:Record<string,string>={level:'Set an exact level',profile:'Choose an equipment profile',material:'Choose a base material',rarity:'Choose quality; keep affixes random',count:`Create 1–${CONSOLE_LIMITS.count}`,seed:'Repeat a specific random roll',rank:'Choose monster rank'};
/** Contextual completion uses the same content and accepted flags as the parser. */
export function consoleSuggestions(raw:string):ConsoleSuggestion[] {
  const tokens=raw.trimStart().split(/\s+/), last=tokens.at(-1)??'', prefix=raw.slice(0,raw.length-last.length);
  const names=()=>CONSOLE_COMMANDS.filter(c=>c.id.startsWith(last.toLowerCase())).map(c=>({label:c.id,detail:c.detail,value:prefix+c.id+(c.flags.length?' ':''),mark:c.id==='drop'?'◇':c.id==='spawn'?'♧':'›'}));
  if(tokens.length===1||tokens[0]==='help'&&tokens.length===2)return names();
  const def=CONSOLE_COMMANDS.find(c=>c.id===tokens[0]);if(!def||!def.flags.length)return [];
  const complete=(entries:Array<{id:string;detail:string}>):ConsoleSuggestion[]=>entries.filter(e=>e.id.toLowerCase().startsWith(last.toLowerCase())).map(e=>({label:e.id,detail:e.detail,value:prefix+e.id+' ',mark:'›'}));
  if(tokens.length===2)return complete(def.id==='spawn'?consoleEnemies.map(id=>({id,detail:ENEMY_DEFINITIONS[id].name})):consoleItems.map(id=>({id:id==='head'?'helmet':id,detail:'Generated equipment · random properties'})));
  const kind=itemKind(tokens[1]) as ItemKind, previous=tokens.at(-2), profile=tokens[tokens.indexOf('--profile')+1];
  if(previous?.startsWith('--')) {
    if(previous==='--profile')return complete(consoleProfiles(kind).map(p=>({id:p.id,detail:p.name})));
    if(previous==='--material'&&consoleItems.includes(kind))return complete(consoleMaterials(kind,profile).map(m=>({id:m.id,detail:ITEM_MATERIALS[m.id].name})));
    if(previous==='--rarity')return complete(rarities.map(id=>({id,detail:'Equipment quality'})));
    if(previous==='--rank')return complete(ranks.map(id=>({id,detail:'Monster rank'})));
    if(previous==='--level')return complete(['1','10','25','50','100'].map(id=>({id,detail:'Or type any level up to 1000000'})));
    if(previous==='--count')return complete(['1','3','5','10'].map(id=>({id,detail:'Number to create'})));
    return [];
  }
  if(last&&!last.startsWith('--'))return [];
  return def.flags.filter(f=>!(f==='profile'&&!consoleProfiles(kind).length)&&!(f==='material'&&(kind==='charm'||kind==='weapon'&&!tokens.includes('--profile')))&&!tokens.includes('--'+f)&&('--'+f).startsWith(last)).map(f=>({label:'--'+f,detail:flagDetails[f],value:prefix+'--'+f+' ',mark:'+'}));
}
