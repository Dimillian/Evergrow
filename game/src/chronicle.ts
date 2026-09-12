import { cloneData } from './data-clone.ts';
import { ACHIEVEMENTS, achievementTier } from './chronicle-content.ts';
import type { CharacterSave } from './character-save.ts';

export interface ChronicleSource { id: string; name: string; started: number; values: Record<string, number>; unlocked: Record<string, number>; }
export interface ChronicleProgress { version: 1; active: string; sources: ChronicleSource[]; }
export interface ChronicleCharacter { id: string; name: string; level: number; updatedAt: number; sources: string[]; deleted: boolean; }
export interface ChronicleLedger { version: 1; sources: Record<string, ChronicleSource>; characters: Record<string, ChronicleCharacter>; unlocked: Record<string,number>; }
export const emptyChronicle = (): ChronicleLedger => ({version:1,sources:{},characters:{},unlocked:{}});
export const freshChronicle = (id='current',name='Wayfarer',started=0):ChronicleProgress => ({version:1,active:id,sources:[{id,name,started,values:{},unlocked:{}}]});
export type ChronicleRecord = Pick<CharacterSave, 'id' | 'name' | 'createdAt' | 'updatedAt'> & {
  checkpoint: Pick<CharacterSave['checkpoint'], 'chronicle' | 'kills' | 'time' | 'level'>;
};
export const metricMode = (key:string):'sum'|'max' => /^(highest|largest|longest|best|fastest|seen:|feat:)/.test(key)?'max':'sum';
export function chronicleValues(sources: readonly ChronicleSource[]):Record<string,number> {
  const result:Record<string,number>={};
  for(const s of sources)for(const [key,n]of Object.entries(s.values))result[key]=metricMode(key)==='max'?Math.max(result[key]??0,n):Math.min(Number.MAX_SAFE_INTEGER,(result[key]??0)+n);
  return result;
}
export function metric(progress:ChronicleProgress|undefined,key:string,n=1):void {
  if(!progress||!Number.isFinite(n)||n<0)return;
  const s=progress.sources.find(s=>s.id===progress.active);if(!s)return;
  s.values[key]=Math.min(Number.MAX_SAFE_INTEGER,metricMode(key)==='max'?Math.max(s.values[key]??0,n):(s.values[key]??0)+n);
}
const safeKey=(s:string)=>/^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,159}$/.test(s)&&!['constructor','prototype','__proto__'].includes(s);
const counts=(v:unknown,limit:number):v is Record<string,number>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length<=limit&&Object.entries(v).every(([k,n])=>safeKey(k)&&typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER);
export function validChronicle(v:unknown):v is ChronicleProgress {
  const p=v as ChronicleProgress;
  return !!p&&p.version===1&&typeof p.active==='string'&&Array.isArray(p.sources)&&p.sources.length>0&&p.sources.length<=256
    &&p.sources.every(s=>s&&typeof s.id==='string'&&safeKey(s.id)&&typeof s.name==='string'&&s.name.length<=24&&Number.isSafeInteger(s.started)&&s.started>=0&&counts(s.values,768)&&counts(s.unlocked,256))
    &&new Set(p.sources.map(s=>s.id)).size===p.sources.length&&p.sources.some(s=>s.id===p.active);
}
/** Recover only recorded facts; never pretend historic damage, earnings or deaths were measured. */
export function progressForRecord(record:ChronicleRecord):ChronicleProgress {
  const stored=record.checkpoint.chronicle;
  const p=stored?cloneData(stored):freshChronicle(record.id,record.name,record.createdAt);
  for(const s of p.sources)if(s.id==='current')s.id=record.id;
  if(p.active==='current')p.active=record.id;
  const active=p.sources.find(s=>s.id===p.active)!;active.name=record.name;
  if(!stored){active.values.kills=record.checkpoint.kills;active.values.time=record.checkpoint.time;active.values['seen:legacy']=1;}
  metric(p,'highestLevel',record.checkpoint.level);
  const values=chronicleValues(p.sources);
  for(const a of ACHIEVEMENTS)for(let tier=1;tier<=achievementTier(a,values);tier++){
    const key=a.id+':'+tier;
    if(!p.sources.some(s=>s.unlocked[key]))active.unlocked[key]=record.updatedAt;
  }
  return p;
}
/** Imported history stays shared. Only subsequent play belongs to the new branch. */
export function forkChronicle(record:CharacterSave,id:string):ChronicleProgress {
  const p=progressForRecord(record);
  if(p.sources.length>=256)throw new Error('This save has too many imported history branches.');
  p.active=id;p.sources.push({id,name:record.name,started:Date.now(),values:{},unlocked:{}});return p;
}
function mergeSource(a:ChronicleSource|undefined,b:ChronicleSource):ChronicleSource {
  if(!a)return cloneData(b);
  const values={...a.values},unlocked={...a.unlocked};
  // Sources are cumulative: retries and older checkpoints can never add their totals twice.
  for(const [k,v]of Object.entries(b.values))values[k]=Math.max(values[k]??0,v);
  for(const [k,v]of Object.entries(b.unlocked))unlocked[k]=Math.min(unlocked[k]??v,v);
  return {...a,name:b.name,values,unlocked};
}
export function mergeChronicles(...ledgers:ChronicleLedger[]):ChronicleLedger {
  const out=emptyChronicle();
  for(const l of ledgers){for(const[k,v]of Object.entries(l.unlocked??{}))out.unlocked[k]=Math.min(out.unlocked[k]??v,v);for(const s of Object.values(l.sources))out.sources[s.id]=mergeSource(out.sources[s.id],s);
    for(const c of Object.values(l.characters))if(!out.characters[c.id]||out.characters[c.id].updatedAt<=c.updatedAt)out.characters[c.id]=cloneData(c);}
  const values=chronicleValues(Object.values(out.sources)),at=Math.max(0,...Object.values(out.characters).map(c=>c.updatedAt));
  for(const a of ACHIEVEMENTS)for(let tier=1;tier<=achievementTier(a,values);tier++)out.unlocked[a.id+':'+tier]??=at;
  return out;
}
export function recordChronicle(ledger:ChronicleLedger,record:ChronicleRecord,deleted=false):ChronicleLedger {
  const p=progressForRecord(record),addition=emptyChronicle();
  for(const s of p.sources)addition.sources[s.id]=s;
  addition.characters[record.id]={id:record.id,name:record.name,level:record.checkpoint.level,updatedAt:record.updatedAt,sources:p.sources.map(s=>s.id),deleted};
  return mergeChronicles(ledger,addition);
}
export function parseChronicleLedger(raw:string|null|undefined):ChronicleLedger {
  if(!raw)return emptyChronicle();
  const l=JSON.parse(raw) as ChronicleLedger;
  // The first local Chronicle preview stored sources before account unlock receipts existed.
  // Complete that missing index from its history; never discard characters or counters.
  if(l&&l.version===1&&l.unlocked===undefined)l.unlocked={};
  if(!l||l.version!==1||!l.sources||!l.characters||typeof l.sources!=='object'||typeof l.characters!=='object'||Array.isArray(l.sources)||Array.isArray(l.characters)||!counts(l.unlocked,256)||Object.keys(l.sources).length>4096||Object.keys(l.characters).length>4096)throw new Error('Chronicle could not be read.');
  for(const [id,s]of Object.entries(l.sources))if(!s||id!==s.id||!validChronicle({version:1,active:s.id,sources:[s]}))throw new Error('Invalid Chronicle history.');
  for(const [id,c]of Object.entries(l.characters))if(!c||!safeKey(id)||c.id!==id||typeof c.name!=='string'||c.name.length>24||!Number.isSafeInteger(c.level)||c.level<1||!Number.isSafeInteger(c.updatedAt)||c.updatedAt<0||typeof c.deleted!=='boolean'||!Array.isArray(c.sources)||c.sources.length>256||c.sources.some(s=>!Object.hasOwn(l.sources,s)))throw new Error('Invalid Chronicle character.');
  return l;
}
