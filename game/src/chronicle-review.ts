import { UNIQUES } from './unique-content.ts';
import { ChroniclePanel } from './chronicle-panel.ts';
import { emptyChronicle, mergeChronicles } from './chronicle.ts';
import { ACHIEVEMENTS, achievementTier } from './chronicle-content.ts';
import { loadGameFont } from './font.ts';
import { installUITheme } from './ui-theme.ts';
import './typography.css';
import './ui-kit.css';
import './style.css';
// Authored sample history only. No Game, simulation, IndexedDB, or cloud requests.
await loadGameFont();installUITheme();
const ledger=emptyChronicle(),now=Date.UTC(2026,8,7,16);
for(const [index,name,level,values] of [
 [0,'Rowan',24,{time:16237,kills:2478,damage:842157,directDamage:691208,periodicDamage:150949,hits:7941,crits:624,largestHit:2874,highestEnemy:29,bosses:8,crypts:8,'rank:normal':2142,'rank:veteran':282,'rank:elite':54,'damage:physical':305121,'damage:fire':467036,'damage:arcane':70000,'enemy:goblin':1043,'enemy:stalker':480,'enemy:brute':394,'enemy:caster':561,damageTaken:48329,damageBlocked:12843,blocks:389,healing:47563,manaRestored:45271,manaSpent:44982,potions:172,dodges:584,deaths:6,longestLife:4328,distance:736194,places:74,'place:town':6,'place:dungeon':12,events:36,'event:cursedChest':8,'event:hamlet':12,'event:beastDen':16,bestWaves:7,journeys:48,goldEarned:93785,goldFound:63215,goldSales:30570,goldSpent:76942,largestGold:784,items:531,'items:common':304,'items:magic':165,'items:rare':51,'items:epic':9,'items:legendary':2,'material:iron':149,'material:steel':181,'material:silver':45,highestEnhancement:8,containers:148,highestLevel:24,xp:392054,casts:3497,basics:5038,'skillUses:fireball':2174,'skillUses:meteor':849,'skillUses:cleave':474,'skillDamage:fireball':318149,'skillDamage:meteor':205480,'feat:spellblade':1,'seen:biome:deadwood':1,'seen:biome:verdant':1,'seen:biome:mire':1,'seen:biome:frostpine':1,'seen:biome:emberfall':1}],
 [1,'Ash',12,{time:5380,kills:734,damage:148932,hits:3407,crits:228,largestHit:937,highestEnemy:14,bosses:2,crypts:2,'rank:normal':641,'rank:veteran':77,'rank:elite':16,'damage:physical':148932,damageTaken:18277,healing:16440,blocks:0,manaSpent:7120,potions:73,deaths:3,longestLife:2918,distance:315295,places:32,events:11,bestWaves:4,journeys:16,items:186,'items:common':112,'items:magic':57,'items:rare':15,'items:epic':2,goldEarned:24589,goldFound:19200,goldSales:5389,goldSpent:14700,highestLevel:12,highestEnhancement:4,xp:97184,casts:684,basics:2018,'skillUses:volley':532,'skillUses:rainOfArrows':152,'seen:biome:amberwood':1}],
 [2,'Briar',7,{time:2720,kills:294,damage:42714,largestHit:249,highestEnemy:9,deaths:2,longestLife:1135,distance:128942,goldEarned:7150,items:83,'items:rare':4,highestLevel:7,events:4,places:18,journeys:8,'seen:biome:highlands':1}],
] as const){const id='review-'+index,v={...values},unlocked:Record<string,number>={};for(const a of ACHIEVEMENTS)for(let tier=1;tier<=achievementTier(a,v);tier++)unlocked[a.id+':'+tier]=now-(32-index*4-tier)*3600000;ledger.sources[id]={id,name,started:now-72*3600000,values:v,unlocked};ledger.characters[id]={id,name,level,updatedAt:now-index*3600000,sources:[id],deleted:index===2};}
if(new URLSearchParams(location.search).has('uniques'))for(const [i,u] of UNIQUES.slice(0,3).entries()){
  const source=ledger.sources['review-'+i%2];source.unlocked[`unique:${u.id}`]=now-i*86400000;source.values[`best:unique:${u.id}`]=25+i*3;source.values[`seen:unique:${u.id}`]=1;
}
const data=mergeChronicles(ledger),mount=document.querySelector<HTMLElement>('#chronicle-review')!;
mount.style.cssText='min-height:100dvh;background:radial-gradient(ellipse at 25% 20%,#203e38,transparent 65%),#060e15';
const panel=new ChroniclePanel(mount,()=>{void panel.open(async()=>data);});
await panel.open(async()=>data,new URLSearchParams(location.search).get('character')??'all',new URLSearchParams(location.search).has('uniques')?'Uniques':'Overview');
if(import.meta.hot)import.meta.hot.dispose(()=>panel.dispose());
