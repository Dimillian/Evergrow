import { PREVIOUS_NODE_IDS, PREVIOUS_EDGES } from './skill-tree-previous.ts';
import { SKILL_TREE_VERSION } from './skill-tree.ts';
type RecordValue=Record<string,unknown>;
const record=(v:unknown):v is RecordValue=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min:number,max:number):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const indices=new Map(PREVIOUS_NODE_IDS.map((id,i)=>[id,i]));
const oldSkills=new Set(PREVIOUS_NODE_IDS.filter(id=>id.startsWith('skill:')).map(id=>id.slice(6)));
/** Operates only on a parsed save copy. Reject unknown/disconnected allocations before refunding. */
export function upgradeSkillTree(checkpoint:RecordValue):boolean {
 const s=checkpoint.character;
 if(!record(s))return false;
 if(s.treeVersion!==undefined)return s.treeVersion===SKILL_TREE_VERSION;
 if(!integer(checkpoint.level,1,1000000)||!integer(s.skillPoints,0,1000000)||!Array.isArray(s.allocatedNodes)||s.allocatedNodes.length>PREVIOUS_NODE_IDS.length
  ||!s.allocatedNodes.every(id=>typeof id==='string'&&indices.has(id))||new Set(s.allocatedNodes).size!==s.allocatedNodes.length||!s.allocatedNodes.includes('origin'))return false;
 const owned=new Set(s.allocatedNodes as string[]), ownedIndices=new Set([...owned].map(id=>indices.get(id)!));
 const reached=new Set([indices.get('origin')!]);let change=true;
 while(change){change=false;for(const[a,b]of PREVIOUS_EDGES)if(ownedIndices.has(a)&&ownedIndices.has(b)&&reached.has(a)!==reached.has(b)){reached.add(a);reached.add(b);change=true;}}
 if(reached.size!==owned.size||!record(s.skillRanks)||!record(s.activeSkillRanks)||!record(s.skillSpecializations)||typeof s.arcaneOverload!=='boolean'||s.arcaneOverload&&!owned.has('keystone:arcane-overload'))return false;
 let paid=0;
 for(const[id,rank]of Object.entries(s.skillRanks)){if(!oldSkills.has(id)||!owned.has(`skill:${id}`)||!integer(rank,2,owned.has(`mastery:${id}`)?7:5))return false;paid+=rank-1;}
 for(const[id,rank]of Object.entries(s.activeSkillRanks)){if(!oldSkills.has(id)||!owned.has(`skill:${id}`)||!integer(rank,1,Number(s.skillRanks[id]??1)))return false;}
 const variants:Record<string,string>={"cleave-reach": "cleave", "cleave-force": "cleave", "cleave-economy": "cleave", "lunge-distance": "lunge", "lunge-force": "lunge", "lunge-swift": "lunge", "whirlwind-reach": "whirlwind", "whirlwind-force": "whirlwind", "whirlwind-economy": "whirlwind", "earthshatter-wide": "earthshatter", "earthshatter-force": "earthshatter", "earthshatter-swift": "earthshatter", "shield-wide": "shieldBash", "shield-force": "shieldBash", "shield-control": "shieldBash", "bulwark-duration": "bulwark", "bulwark-reduction": "bulwark", "bulwark-swift": "bulwark", "volley-fan": "volley", "volley-pierce": "volley", "volley-focus": "volley", "piercing-depth": "piercingShot", "piercing-force": "piercingShot", "piercing-twin": "piercingShot", "ricochet-chain": "ricochet", "ricochet-force": "ricochet", "ricochet-economy": "ricochet", "rain-wide": "rainOfArrows", "rain-lasting": "rainOfArrows", "rain-burst": "rainOfArrows", "backstab-reach": "backstab", "backstab-rear": "backstab", "backstab-economy": "backstab", "fireball-fork": "fireball", "fireball-ember": "fireball", "fireball-impact": "fireball", "meteor-shards": "meteor", "meteor-inferno": "meteor", "meteor-impact": "meteor", "nova-echo": "iceNova", "nova-deep": "iceNova", "nova-freeze": "iceNova", "lance-fan": "frostLance", "lance-chill": "frostLance", "lance-force": "frostLance", "arc-circuit": "arcLightning", "arc-focus": "arcLightning", "arc-economy": "arcLightning", "siphon-drain": "siphon", "siphon-pierce": "siphon", "siphon-force": "siphon", "cataclysm-many": "cataclysm", "cataclysm-force": "cataclysm", "cataclysm-fire": "cataclysm", "zero-wide": "absoluteZero", "zero-freeze": "absoluteZero", "zero-burst": "absoluteZero", "tempest-wide": "tempest", "tempest-fast": "tempest", "tempest-still": "tempest"};
 for(const[id,variant]of Object.entries(s.skillSpecializations))if(typeof variant!=='string'||variants[variant]!==id||!owned.has(`skill:${id}`)||!owned.has(`specialization:${variant}`))return false;
 if(s.skillPoints+owned.size-1+paid!==checkpoint.level-1||!Array.isArray(s.skillSlots)||s.skillSlots.length!==5||!s.skillSlots.every(id=>id===null||typeof id==='string'&&oldSkills.has(id)&&owned.has(`skill:${id}`))||new Set(s.skillSlots.filter(Boolean)).size!==s.skillSlots.filter(Boolean).length)return false;
 if(!record(checkpoint.skillCooldowns)||!Object.entries(checkpoint.skillCooldowns).every(([id,value])=>oldSkills.has(id)&&owned.has(`skill:${id}`)&&typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1000))return false;
 s.treeVersion=SKILL_TREE_VERSION;s.skillPoints=checkpoint.level-1;s.allocatedNodes=['origin'];s.skillRanks={};s.activeSkillRanks={};s.skillSpecializations={};s.skillSlots=[null,null,null,null,null];s.arcaneOverload=false;
 if(owned.size>1||paid>0)s.treeRefunded=true;
 checkpoint.skillCooldowns={};return true;
}
