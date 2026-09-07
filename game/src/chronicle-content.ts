export interface Achievement { id:string; name:string; group:string; metric:string; tiers:readonly number[]; description:string; glyph:string; }
const family=(id:string,name:string,group:string,metric:string,tiers:number[],description:string,glyph:string):Achievement=>({id,name,group,metric,tiers,description,glyph});
export const ACHIEVEMENTS:readonly Achievement[]=[
 family('slayer','Slayer','Combat','kills',[100,1000,10000],'Defeat enemies.','blade'),
 family('veterans','Battle tested','Combat','rank:veteran',[10,100,1000],'Defeat veterans.','blade'),
 family('elites','Elite hunter','Combat','rank:elite',[5,50,500],'Defeat elites.','crown'),
 family('bosses','Kingslayer','Combat','bosses',[1,10,50],'Defeat dungeon bosses.','crown'),
 family('damage','Force of nature','Combat','damage',[10000,100000,1000000],'Deal damage, excluding overkill.','spark'),
 family('critical','Perfect strike','Combat','crits',[50,500,5000],'Land critical hits.','spark'),
 family('largest','Heavy hitter','Combat','largestHit',[100,1000,10000],'Deal damage in a single hit.','blade'),
 family('fire','Ashmaker','Combat','damage:fire',[1000,10000,100000],'Deal fire damage.','flame'),
 family('frost','Winterborn','Combat','damage:frost',[1000,10000,100000],'Deal frost damage.','star'),
 family('lightning','Stormcaller','Combat','damage:lightning',[1000,10000,100000],'Deal lightning damage.','spark'),
 family('dot','Slow burn','Combat','periodicDamage',[1000,10000,100000],'Deal damage over time.','flame'),
 family('hybrid','Spellblade','Combat','feat:spellblade',[1],'Defeat an enemy after hitting it with melee and a spell.','star'),
 family('lastbreath','Last breath','Survival','feat:lastbreath',[1],'Defeat an elite below 10% life.','heart'),
 family('blocks','Hold the line','Survival','blocks',[25,250,2500],'Block incoming attacks.','shield'),
 family('prevented','Unbroken','Survival','damageBlocked',[1000,10000,100000],'Prevent damage by blocking.','shield'),
 family('healed','Second wind','Survival','healing',[1000,10000,100000],'Restore missing life.','heart'),
 family('potions','Deep draught','Survival','potions',[10,100,1000],'Use the dual potion.','flask'),
 family('distance','Wayfarer','Exploration','distance',[10000,100000,1000000],'Travel on foot. Teleports do not count.','compass'),
 family('biomes','Worldwalker','Exploration','biomes',[3,6,9],'Visit different biomes.','compass'),
 family('places','Trailblazer','Exploration','places',[10,50,250],'Discover places.','compass'),
 family('events','Answer the call','Exploration','events',[5,25,100],'Complete wilderness events.','star'),
 family('crypts','Crypt delver','Exploration','crypts',[1,10,50],'Clear dungeon bosses and finish crypts.','crown'),
 family('waves','Against the clock','Exploration','bestWaves',[3,6,10],'Complete waves in one cursed-chest trial.','flame'),
 family('journeys','A path of your own','Exploration','journeys',[5,25,100],'Complete Journey objectives.','compass'),
 family('wealth','Fortune seeker','Loot','goldEarned',[1000,10000,100000],'Earn gold from pickups and sales.','coin'),
 family('collector','Collector','Loot','items',[25,250,2500],'Collect equipment from the ground.','gem'),
 family('rare','Golden promise','Loot','items:rare',[1,25,100],'Collect Rare equipment.','gem'),
 family('legendary','Legend found','Loot','items:legendary',[1,5,25],'Collect Legendary equipment.','crown'),
 family('masterwork','Masterwork','Loot','highestEnhancement',[10],'Enhance an item to +10.','hammer'),
 family('level','Ever growing','Progression','highestLevel',[10,25,50,100],'Reach a character level.','star'),
 family('caster','Practiced hand','Progression','casts',[100,1000,10000],'Use assigned skills.','spark'),
 family('mana','Deep reserves','Progression','manaSpent',[1000,10000,100000],'Spend mana on attacks and skills.','flask'),
];
export function achievementValue(a:Achievement,values:Record<string,number>):number {
 return a.metric==='biomes'?Object.keys(values).filter(k=>k.startsWith('seen:biome:')&&values[k]>0).length:values[a.metric]??0;
}
export function achievementTier(a:Achievement,values:Record<string,number>):number {const n=achievementValue(a,values);return a.tiers.filter(t=>n>=t).length;}
export const STAT_GROUPS:Record<string,readonly [string,string][]>={
 Combat:[['kills','Enemies slain'],['damage','Damage dealt'],['directDamage','Direct damage'],['periodicDamage','Damage over time'],['hits','Hits landed'],['crits','Critical hits'],['largestHit','Largest hit'],['highestEnemy','Highest enemy level'],['bosses','Bosses defeated']],
 Survival:[['damageTaken','Damage taken'],['damageBlocked','Damage blocked'],['blocks','Blocks'],['healing','Life restored'],['manaRestored','Mana restored'],['manaSpent','Mana spent'],['potions','Potions used'],['dodges','Dodges'],['deaths','Deaths'],['longestLife','Longest life']],
 Loot:[['items','Equipment collected'],['goldEarned','Gold earned'],['goldFound','Gold picked up'],['goldSales','Gold from sales'],['goldSpent','Gold spent'],['largestGold','Largest gold pickup'],['containers','Containers broken'],['highestEnhancement','Best enhancement']],
 Exploration:[['distance','Distance travelled'],['places','Places discovered'],['events','Events completed'],['crypts','Crypts cleared'],['bestWaves','Best cursed-chest waves'],['journeys','Journey objectives']],
 Progression:[['time','Active playtime'],['highestLevel','Highest level'],['xp','Experience earned'],['casts','Skills used'],['basics','Basic attacks']],
};
