import { JEWELRY_PROFILES } from '../jewelry-content.ts';
import { EVENT_RECIPES } from '../event-recipes.ts';
import { SPECIAL_AFFIXES, SKILL_AFFIXES } from '../equipment-affix-content.ts';
import { ENEMY_RANKS } from '../progression-content.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../weapon-content.ts';
import { FOCUS_PROFILES } from '../focus-content.ts';
import { ITEM_MATERIALS, MATERIAL_POOLS } from '../item-materials.ts';
import { AFFIXES, SHIELD_AFFIXES, TIER_POWER, TIER_AFFIXES, STAT_LABELS } from '../items.ts';
import { SKILL_DEFINITIONS } from '../skill-content.ts';
import { SKILL_EXECUTION } from '../skill-execution-content.ts';
import { SKILL_SPECIALIZATIONS } from '../skill-progression.ts';
import { SKILL_TREE } from '../skill-tree.ts';
import { ENEMY_DEFINITIONS, PLAYER_ABILITIES, PLAYER_DEFAULTS, PLAYER_MOVEMENT, ENEMY_AI_RULES } from '../combat-content.ts';
import { ENEMY_DEATHS } from '../death-content.ts';
import { BIOMES, BIOME_FIELD_RULES } from '../biomes.ts';
import { PROP_DEFINITIONS, BIOME_PROP_TABLES } from '../biome-props.ts';
import { POI_DEFINITIONS } from '../world-pois.ts';
import { BLESSINGS, EVENT_RULES } from '../poi-content.ts';
import { ENEMY_LOOT_TABLES, ENEMY_ITEM_KIND_WEIGHTS, BIOME_PROFILE_WEIGHTS } from '../loot-content.ts';
import { MATERIALS } from '../material-content.ts';
import { WILDERNESS_RULES, WILDERNESS_BIOME_THEMES, CAMP_BIOME_ROSTERS } from '../wilderness-sites.ts';
export interface DataRecord { id:string; name:string; value:unknown; search:string; }
export interface Dataset { id:string; name:string; source:string; records:DataRecord[]; }
function data(id:string,name:string,source:string,value:unknown):Dataset {
  const entries=Array.isArray(value)?value.map((v,i)=>[String(v.id??i),v] as const):Object.entries(value as object);
  return {id,name,source,records:entries.map(([key,value])=>({id:key,name:typeof value==='object'&&value!==null?String(value.name??value.label??key):key,value,search:JSON.stringify({key,value}).toLowerCase()}))};
}
/** Import live registries, never a manually copied content inventory. */
export const DATASETS:Dataset[]=[
  data('jewelry','Rings & amulets','jewelry-content.ts',JEWELRY_PROFILES),data('event-recipes','Event recipes','event-recipes.ts',EVENT_RECIPES),data('special-affixes','Special affixes','equipment-affix-content.ts',SPECIAL_AFFIXES),data('skill-affixes','Skill rank affixes','equipment-affix-content.ts',SKILL_AFFIXES),data('ranks','Enemy ranks','progression-content.ts',ENEMY_RANKS),
  data('weapons','Weapon profiles','weapon-content.ts',WEAPON_PROFILES),data('shields','Shields','weapon-content.ts',SHIELD_PROFILES),data('foci','Grimoires & orbs','focus-content.ts',FOCUS_PROFILES),
  data('materials','Equipment materials','item-materials.ts',ITEM_MATERIALS),data('material-pools','Material drop pools','item-materials.ts',MATERIAL_POOLS),data('affixes','Affixes','items.ts',[...AFFIXES,...SHIELD_AFFIXES]),
  data('tiers','Rarity budgets','items.ts',Object.fromEntries(Object.entries(TIER_POWER).map(([id,power])=>[id,{power,affixes:TIER_AFFIXES[id as keyof typeof TIER_AFFIXES]}]))),data('stats','Stat labels','items.ts',STAT_LABELS),
  data('skills','Active skills','skill-content.ts',SKILL_DEFINITIONS),data('execution','Skill execution recipes','skill-execution-content.ts',SKILL_EXECUTION),data('specializations','Skill specializations','skill-progression.ts',SKILL_SPECIALIZATIONS),
  data('tree','Skill tree nodes','skill-tree.ts',SKILL_TREE.nodes),data('enemies','Enemy archetypes','combat-content.ts',ENEMY_DEFINITIONS),data('deaths','Death animation recipes','death-content.ts',ENEMY_DEATHS),
  data('player','Player & AI rules','combat-content.ts',{defaults:PLAYER_DEFAULTS,abilities:PLAYER_ABILITIES,movement:PLAYER_MOVEMENT,enemyAI:ENEMY_AI_RULES}),
  data('biomes','Biomes','biomes.ts',BIOMES),data('props','Procedural props','biome-props.ts',PROP_DEFINITIONS),data('prop-pools','Biome prop mixtures','biome-props.ts',BIOME_PROP_TABLES),
  data('places','Point-of-interest kinds','world-pois.ts',POI_DEFINITIONS),data('blessings','Event blessings','poi-content.ts',BLESSINGS),data('world-rules','World & event rules','biomes.ts / wilderness-sites.ts / poi-content.ts',{climates:BIOME_FIELD_RULES,wilderness:WILDERNESS_RULES,events:EVENT_RULES}),
  data('themes','Wilderness biome themes','wilderness-sites.ts',WILDERNESS_BIOME_THEMES),data('camp-rosters','Camp biome rosters','wilderness-sites.ts',CAMP_BIOME_ROSTERS),
  data('loot','Rank loot tables','loot-content.ts',ENEMY_LOOT_TABLES),data('enemy-loot','Enemy item weights','loot-content.ts',ENEMY_ITEM_KIND_WEIGHTS),data('biome-loot','Biome equipment weights','loot-content.ts',BIOME_PROFILE_WEIGHTS),data('impacts','Impact materials','material-content.ts',MATERIALS),
];
