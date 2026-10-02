import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { WEAPON_PROFILES } from '../../game/src/weapon-content.ts';
import { SKILL_DEFINITIONS } from '../../game/src/skill-content.ts';
import { FOCUS_PROFILES } from '../../game/src/focus-content.ts';

// Stable cartridge IDs. Runtime families implement these authored actions;
// a new action must be deliberately mapped rather than silently omitted.
const ids = ['shieldBash','bulwark','brace','repulse','ironCitadel',
 'cleave','whirlwind','lunge','earthshatter','rallyOfIron',
 'volley','piercingShot','ricochet','rainOfArrows','ghostHunt',
 'backstab','smokeVeil','sidestep','nightReaping','vaultingShot',
 'fireball','frostLance','iceNova','arcLightning','meteor',
 'siphon','tempest','absoluteZero','runicWard','cataclysm'];
const executions = ['NOVA','GUARD','GUARD','NOVA','NOVA',
 'SWEEP','NOVA','DASH','NOVA','RALLY','FAN','PIERCE','CHAIN','RAIN','GHOST',
 'THRUST','SMOKE','STEP','NOVA','VAULT','BOLT','PIERCE','NOVA','CHAIN','METEOR',
 'SIPHON','STORM','NOVA','WARD','METEOR'];
const elements={physical:0,fire:1,frost:2,lightning:3,arcane:4};
const requirements={any:'ANY',melee:'REQ_MELEE',blade:'REQ_BLADE',heavy:'REQ_HEAVY',shield:'REQ_SHIELD',bow:'REQ_BOW',dagger:'REQ_DAGGER',magic:'REQ_MAGIC'};
const actions=Object.values(SKILL_DEFINITIONS).filter(s=>s.tier!=='aura');
if(actions.length!==30 || actions.some(s=>!ids.includes(s.id))) throw Error('Update native action mapping for current content');
const cstr=s=>JSON.stringify(s.toUpperCase());
const names=(key,values)=>`static const char * const ${key}[] = {${values.map(cstr).join(',')}};`;
let source=`/* Generated from current Evergrow content. Run npm run chromatic:content. */\n#pragma bank 255\n#include "ev.h"\n`;
source+=names('biomes',['Deadwood','Verdant Forest','The Mire','Frostpine Reach','Emberfall','Amberwood','Hollow Highlands','Whispering Steppe','Sunscar Expanse'])+'\n';
source+=names('weapons',WEAPON_PROFILES.map(w=>w.name))+'\n';
source+=names('skills',ids.map(id=>SKILL_DEFINITIONS[id].name))+'\n';
source+=names('items',['Weapon','Shield','Focus','Helm','Armor','Gloves','Leggings','Boots','Cloak','Amulet','Ring','Charm'])+'\n';
source+=names('focus_names',FOCUS_PROFILES.map(x=>x.name))+'\n';
source+=names('affixes',['Might','Precision','Arcana','Vitality','Guarding','Haste','Insight','Embers','Rime','Storm','Astral','Siphoning'])+'\n';
source+=names('enemies',['Scrap Goblin','Hollow Stalker','Gravebound Brute','Mire Hexer','Briar Hound','Ashen Ranger','Lantern Wisp','Hollow Warden','Thorn Reaver','Mire Spitter','Rime Revenant','Ember Acolyte','Dune Scuttler','Storm Sentinel','Briar Matriarch','Ashbound Colossus','Grave Marshal'])+'\n';
source+=names('territories',['Bastion','Forge','Hunt','Veil','Crucible','Wellspring'])+'\n';
source+=names('rarities',['Common','Magic','Rare','Epic','Legendary'])+'\n';
source+='static const EvWeapon weapon_data[17] = {\n';
for(const w of WEAPON_PROFILES) source+=` {${w.damage},EV_${['bow','staff','wand'].includes(w.family)?w.family.toUpperCase():'MELEE'},${w.hands},${elements[w.damageType]},${Math.round(60/(w.baseAttacksPerSecond*.8))},${w.attackKind==='melee'?Math.round(w.reach/3):100}},\n`;
source+='};\nstatic const EvSkill skill_data[30] = {\n';
ids.forEach((id,i)=>{const s=SKILL_DEFINITIONS[id];const element=id.match(/fire|meteor|cataclysm/i)?1:id.match(/frost|ice|zero/i)?2:id.match(/lightning|tempest/i)?3:s.requirement==='magic'?4:0;
 source+=` {${Math.round(s.cooldown*60)},EV_${requirements[s.requirement]},EV_${executions[i]},${s.manaCost},${Math.round(s.damageMultiplier*10)},${s.tier==='ultimate'?42:s.tier==='advanced'?32:24},${element},${['basic','advanced','ultimate'].indexOf(s.tier)}},\n`;
});
source+=`};
void ev_name(UINT8 kind,UINT8 id,char *out) BANKED {
 const char *p="UNKNOWN";
 switch(kind){
 case EV_NAME_BIOME: if(id<9)p=biomes[id];break;
 case EV_NAME_WEAPON: if(id<17)p=weapons[id];else if(id<23)p=focus_names[id-17];break;
 case EV_NAME_SKILL: if(id<30)p=skills[id];break;
 case EV_NAME_ITEM: if(id<12)p=items[id];break;
 case EV_NAME_AFFIX: if(id<12)p=affixes[id];break;
 case EV_NAME_ENEMY: if(id<17)p=enemies[id];break;
 case EV_NAME_TERRITORY: if(id<6)p=territories[id];break;
 case EV_NAME_RARITY: if(id<5)p=rarities[id];break;
 }
 {UINT8 i=0;while(p[i]&&i<20){out[i]=p[i];i++;}out[i]=0;}
}
void ev_weapon(UINT8 profile,EvWeapon *out) BANKED { *out=weapon_data[profile<17?profile:0]; }
void ev_skill(UINT8 id,EvSkill *out) BANKED { *out=skill_data[id<30?id:0]; }
`;
await writeFile(fileURLToPath(new URL('../plugins/evergrow/engine/src/ev_content.c',import.meta.url)),source);
await mkdir(fileURLToPath(new URL('../generated',import.meta.url)),{recursive:true});
await writeFile(fileURLToPath(new URL('../generated/content.json',import.meta.url)),JSON.stringify({schema:1,weapons:WEAPON_PROFILES.map(w=>({id:w.id,name:w.name})),skills:ids.map(id=>SKILL_DEFINITIONS[id]),focus:FOCUS_PROFILES.map(f=>({id:f.id,name:f.name}))},null,2)+'\n');
console.log('Exported 17 weapon profiles, 6 foci and 30 active skills.');
