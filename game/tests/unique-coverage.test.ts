import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIQUES, uniqueSlot } from '../src/unique-content.ts';
import { generateUnique, generateItem } from '../src/items.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { resolveSkill, SKILL_SPECIALIZATIONS } from '../src/skill-progression.ts';
import { SKILL_EXECUTION } from '../src/skill-execution-content.ts';
import { Simulation } from '../src/simulation.ts';
import { refreshCharacter } from '../src/character.ts';
import { activateSkill, type SkillContext } from '../src/skill-combat.ts';
import { advanceGroundEffects, scheduleGroundEffect } from '../src/ground-effects.ts';
import { advanceProjectiles } from '../src/projectile-combat.ts';
import { advanceSkillEffects, consumeRally, mitigateSkillHit } from '../src/player-skill-effects.ts';
import { advanceAuras, bloodOathHit, resonanceHit, ironrootHitMultiplier } from '../src/auras.ts';
import { activeBuffs } from '../src/active-buffs.ts';
import { auraReservation, auraSummary } from '../src/aura-content.ts';
import { uniqueCollection } from '../src/unique-collection.ts';
import type { CombatEvent, Enemy, WorldQuery } from '../src/model.ts';
const world:WorldQuery={blocked:()=>false,move:(x,y,dx,dy)=>({x:x+dx,y:y+dy})};
const idle={moveX:0,moveY:0,aimX:300,aimY:0,attack:false,dodge:false,heal:false,skillSlot:null};
function fixture(id:string,variant?:string,terrain=world){
 const u=UNIQUES.find(u=>u.id===id)!,sim=new Simulation(terrain,{spawn:false,startX:0,startY:0}),p=sim.player;
 const req=SKILL_DEFINITIONS[u.skill].requirement;
 p.level=25;p.character.equipped.weapon=generateItem(93,25,'weapon',req==='magic'?'cinder-wand':req==='bow'?'crescent-recurve':req==='dagger'?'rondel-dagger':'longsword','common');
 p.character.equipped.offhand=req==='shield'?generateItem(4,25,'shield','iron-buckler','common'):null;
 p.character.equipped[uniqueSlot(u)]=generateUnique(42,25,id);
 p.character.allocatedNodes=['origin',`skill:${u.skill}`];p.character.skillSlots[0]=u.skill;
 if(variant){p.character.allocatedNodes.push(`specialization:${variant}`);p.character.skillSpecializations[u.skill]=variant;}
 refreshCharacter(p);p.hp=p.maxHp;p.maxMana=p.mana=10000;p.derived.critChance=0;
 const events:CombatEvent[]=[],hits:Array<{id:number;amount:number;melee:boolean}>=[];
 const damage=(e:Enemy,amount:number,_angle:number,melee:boolean)=>{hits.push({id:e.id,amount,melee});e.hp-=amount;};
 const ctx:SkillContext={chains:[],player:p,world:terrain,enemies:sim.enemies,aimX:250,aimY:0,availableGroundEffects:16,availableProjectiles:128,visible:(a,b,x,y)=>{for(let i=0;i<=100;i++)if(terrain.blocked(a+(x-a)*i/100,b+(y-b)*i/100,1))return false;return true;},onScreen:()=>true,
  damage,emit:e=>events.push(e),
  schedule:e=>scheduleGroundEffect(sim.groundEffects,e,{nextId:()=>sim.groundEffects.length+1,emit:()=>{}}),
  projectile:(x,y,angle,d,skill,effects)=>{const shot={id:sim.projectiles.length+1,sourceLevel:25,x,y,prevX:x,prevY:y,angle,vx:Math.cos(angle)*d.speed,vy:Math.sin(angle)*d.speed,radius:d.radius,damage:d.damage,life:d.life,maxLife:d.life,owner:d.owner,skill,effects:structuredClone(effects),hitIds:new Set<number>()};sim.projectiles.push(shot);return shot;}};
 const enemy=(x:number,y=0)=>{const e=sim.spawnEnemy('brute',x,y)!;e.hp=e.maxHp=100000;e.angle=Math.PI;return e;};
 return {u,sim,p,ctx,damage,events,hits,enemy,cast:()=>activateSkill(ctx,0),recipe:()=>resolveSkill(u.skill,p.derived,p.character).recipe};
}
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const variants=(skill:typeof UNIQUES[number]['skill'])=>[undefined,...SKILL_SPECIALIZATIONS.filter(v=>v.skill===skill).map(v=>v.id)];
function advance(f:ReturnType<typeof fixture>,dt:number,moving=false){advanceAuras(f.p,f.sim.enemies,dt,moving,()=>true,()=>{},()=>{});}

test('37 unique identities cover every skill exactly once; loot and Chronicles consume the same catalog',()=>{
 assert.equal(UNIQUES.length,37);assert.equal(new Set(UNIQUES.map(u=>u.id)).size,37);
 assert.deepEqual(UNIQUES.map(u=>u.skill).sort(),Object.keys(SKILL_DEFINITIONS).sort());
 assert.equal(uniqueCollection([]).length,37);assert.ok(uniqueCollection([]).every(u=>!u.found));
 const found=new Set<string>();for(let seed=1;seed<=10000;seed++)found.add(generateUnique(seed,50).recipe.uniqueId!);
 assert.deepEqual([...found].sort(),UNIQUES.map(u=>u.id).sort());
});

test('Horizon carries full Technique damage once per target, checks capacity and terrain, and snapshots release',()=>{
 for(const variant of variants('cleave')){
  const f=fixture('horizon-edge',variant),a=f.enemy(70),b=f.enemy(160),mana=f.p.mana;
  f.ctx.availableProjectiles=0;assert.equal(f.cast(),false);assert.equal(f.p.mana,mana);f.ctx.availableProjectiles=10;
  assert.ok(f.cast());assert.equal(f.p.attack,null);const shot=f.sim.projectiles[0],damage=shot.damage;
  f.p.character.equipped.gloves=null;refreshCharacter(f.p);let contacts=0;
  for(let i=0;i<150;i++)advanceProjectiles([shot],1/120,{...f.ctx,hurt:()=>{},damage:(e,n,_a,melee)=>{assert.ok(melee);assert.equal(n,damage);e.hp-=n;contacts++;}});
  assert.equal(contacts,2);assert.ok(a.hp<100000&&b.hp<100000);assert.ok(shot.life<=0);
 }
 const f=fixture('horizon-edge',undefined,{...world,blocked:x=>x>=80&&x<100});f.enemy(150);f.cast();
 for(let i=0;i<150;i++)advanceProjectiles(f.sim.projectiles,1/120,{...f.ctx,damage:f.damage,hurt:()=>{}});
 assert.equal(f.hits.length,0);
});

test('Undertow pulls ordinary enemies, preserves boss/elite positions and cannot pull through walls',()=>{
 const f=fixture('undertow-grasp');const a=f.enemy(85),elite=f.sim.spawnEnemy('brute',75,10,'elite')!;assert.ok(f.cast());assert.ok(a.x<85);assert.equal(elite.x,75);assert.ok(a.stagger>0);
 const wall=fixture('undertow-grasp',undefined,{...world,blocked:x=>x>30&&x<45});const e=wall.enemy(70);wall.cast();assert.equal(e.x,70);
});

test('Oathplate converts each Technique into a finite barrier, consumes once and clears on removal',()=>{
 for(const variant of variants('brace')){
  const f=fixture('oathplate',variant),r=f.recipe();assert.equal(r.kind,'stance');if(r.kind!=='stance')continue;
  assert.ok(f.cast());const amount=f.p.skillEffects!.brace!.capacity!;close(amount,f.p.maxHp*r.barrier!);assert.equal(r.reduction,0);
  assert.equal(mitigateSkillHit(f.p,10).damage,Math.max(0,10-amount));
  const rest=f.p.skillEffects!.brace!.capacity!;close(mitigateSkillHit(f.p,10000).absorbed,rest);assert.equal(mitigateSkillHit(f.p,10).damage,10);assert.equal(f.p.skillEffects!.brace,undefined);
  f.p.character.equipped.chest=null;refreshCharacter(f.p);assert.equal(f.p.skillEffects!.brace,undefined);
 }
});

test('War Drummer trades time for unlimited actions and removes the benefit on expiry or unequip',()=>{
 for(const variant of variants('rallyOfIron')){
  const f=fixture('war-drummers-crown',variant);f.cast();const buff=f.p.skillEffects!.rallyOfIron!;
  for(let i=0;i<15;i++)close(consumeRally(f.p,true),1+buff.bonus);
  assert.equal(consumeRally(f.p,false),1);assert.ok(buff.charges>0);
  advanceSkillEffects(f.p,buff.remaining+.1);assert.equal(consumeRally(f.p,true),1);
 }
 const f=fixture('war-drummers-crown');f.cast();f.p.character.equipped.head=null;refreshCharacter(f.p);assert.equal(consumeRally(f.p,true),1);
});

test('Foundation protects only inside its persistent visible anchor, until expiry',()=>{
 const f=fixture('foundation-of-kings');f.cast();const shelter=f.p.skillEffects!.shelters!.ironCitadel!,anchor=shelter.anchor!;
 const inside=mitigateSkillHit(f.p,100).damage;assert.ok(inside<100);f.p.x=anchor.radius+1;
 assert.equal(mitigateSkillHit(f.p,100).damage,100);assert.ok(activeBuffs(f.p).find(b=>b.id==='ironCitadel')?.summary.includes('inactive'));
 f.p.x=0;assert.equal(mitigateSkillHit(f.p,100).damage,inside);advanceSkillEffects(f.p,shelter.remaining+.1);assert.equal(mitigateSkillHit(f.p,100).damage,100);
});

test('Frostwake reserves one patch, slows at the departure and never damages or grants immunity',()=>{
 const f=fixture('frostwake-soles'),e=f.enemy(20),mana=f.p.mana;f.ctx.availableGroundEffects=0;assert.equal(f.cast(),false);assert.equal(f.p.mana,mana);
 f.ctx.availableGroundEffects=16;f.cast();assert.equal(f.p.invulnerable,0);f.p.x=200;
 advanceGroundEffects(f.sim.groundEffects,.1,{...f.ctx,damage:f.damage});assert.ok(e.slowTime>0);assert.equal(e.hp,100000);assert.equal(f.sim.groundEffects[0].x,0);
});

test('Skystrider keeps all Technique damage/piercing in three arrows and advances without invulnerability',()=>{
 for(const variant of variants('vaultingShot')){
  const f=fixture('skystrider-greaves',variant);f.cast();assert.equal(f.sim.projectiles.length,3);assert.equal(f.p.dash?.angle,f.p.angle);assert.equal(f.p.invulnerable,0);
  assert.ok(f.sim.projectiles.every(s=>s.damage===f.sim.projectiles[0].damage));assert.equal(f.sim.projectiles[0].angle,0);
 }
});

test('Reaper prioritizes wounded enemies, with rear bonus only on controlled or natural rear targets',()=>{
 const f=fixture('reapers-veil'),a=f.enemy(50),b=f.enemy(60);a.slowTime=3;b.slowTime=0;a.stagger=b.stagger=0;b.hp=20000;
 assert.ok(f.cast());assert.equal(f.hits[0].id,b.id);close(f.hits[1].amount,f.hits[0].amount*2);
});

test('Second Sun reserves repeat impacts up front and repeats full damage with every Technique',()=>{
 for(const variant of variants('meteor')){
  const f=fixture('second-sun',variant),r=f.recipe();if(r.kind!=='ground')throw Error('ground');
  const count=(r.scatter??1)*2,mana=f.p.mana;f.ctx.availableGroundEffects=count-1;assert.equal(f.cast(),false);assert.equal(f.p.mana,mana);
  f.ctx.availableGroundEffects=count;f.cast();assert.equal(f.sim.groundEffects.length,count);
  for(let i=0;i<count;i+=2){const [a,b]=f.sim.groundEffects.slice(i,i+2);close(b.delay-a.delay,.65);assert.equal(a.x,b.x);assert.equal(a.y,b.y);assert.equal(a.damage,b.damage);}
 }
});

test('Faultline retains every impact and orders them along a terrain-clamped aim line',()=>{
 for(const variant of variants('cataclysm')){
  const f=fixture('faultline-regalia',variant);f.cast();const shots=f.sim.groundEffects;
  assert.ok(shots.length>=3);assert.ok(shots.every(s=>s.y===0&&s.x>=0&&s.x<=250));
  assert.ok(shots.slice(1).every((s,i)=>s.x>shots[i].x));
 }
 const f=fixture('faultline-regalia',undefined,{...world,blocked:x=>x>=100});f.cast();assert.ok(f.sim.groundEffects.every(s=>s.x<100));
});

test('Stormwalker moves 300 units at its snapshotted heading, retains upkeep and stops at walls',()=>{
 for(const variant of variants('tempest')){
  const f=fixture('stormwalkers-mantle',variant);f.cast();const effect=f.sim.groundEffects[0];assert.ok(effect.upkeep);assert.equal(effect.follow,false);const damage=effect.damage;
  f.p.x=-300;f.p.angle=Math.PI;let active=f.sim.groundEffects;
  for(let i=0;i<1500&&active.length;i++)active=advanceGroundEffects(active,1/120,{...f.ctx,damage:f.damage});
  close(effect.x,300);assert.equal(effect.damage,damage);assert.ok(f.p.mana<10000);
 }
 const f=fixture('stormwalkers-mantle');f.cast();let active=f.sim.groundEffects;
 for(let i=0;i<1000&&active.length;i++)active=advanceGroundEffects(active,1/120,{...f.ctx,damage:f.damage,visible:(_a,_b,x)=>x<60});
 assert.ok(f.sim.groundEffects[0].x<60);
});

test('Winter Prison retains normal damaging waves, then applies only slow for six seconds',()=>{
 for(const variant of variants('absoluteZero')){
  const f=fixture('winter-prison',variant),e=f.enemy(20);f.cast();let active=f.sim.groundEffects;
  for(let i=0;i<500&&active[0]?.damage;i++)active=advanceGroundEffects(active,1/120,{...f.ctx,damage:f.damage});
  assert.ok(active.length);assert.equal(active[0].damage,0);assert.equal(active[0].stun,undefined);const hp=e.hp;e.stagger=0;e.slowTime=0;e.slowFactor=1;
  for(let i=0;i<600;i++)active=advanceGroundEffects(active,1/120,{...f.ctx,damage:f.damage});
  assert.equal(e.hp,hp);assert.ok(e.slowTime>0);assert.equal(e.stagger,0);assert.ok(active.length);
  for(let i=0;i<200;i++)active=advanceGroundEffects(active,1/120,{...f.ctx,damage:f.damage});assert.equal(active.length,0);
 }
});

test('World Roots needs stationary buildup, only adds elemental mitigation when ready, and clears on movement',()=>{
 const f=fixture('roots-of-the-world');assert.equal(ironrootHitMultiplier(f.p,false),1);advance(f,1);assert.equal(ironrootHitMultiplier(f.p,false),1);advance(f,.21);
 close(ironrootHitMultiplier(f.p,false),ironrootHitMultiplier(f.p,true));assert.ok(ironrootHitMultiplier(f.p,false)<1);assert.ok(activeBuffs(f.p).some(b=>b.id==='ironroot-rooted'));
 advance(f,.01,true);assert.equal(ironrootHitMultiplier(f.p,false),1);
});

test('Unbroken Vow transfers stacks even after death but never refreshes without melee hits',()=>{
 const f=fixture('unbroken-vow'),a=f.enemy(20),b=f.enemy(40);for(let i=0;i<5;i++)bloodOathHit(f.p,a,true);
 a.state='dead';advance(f,.1);assert.equal(f.p.auras!.blood!.stacks,5);assert.ok(bloodOathHit(f.p,b,true)>1);assert.equal(f.p.auras!.blood!.stacks,5);
 advance(f,3.1);assert.equal(f.p.auras!.blood,undefined);
});

test('Farflight adds exactly one piercing contact to actual basic arrows in the simulation',()=>{
 const f=fixture('farflight-circlet');f.p.character.equipped.weapon=generateItem(93,25,'weapon','crescent-recurve','common');refreshCharacter(f.p);
 for(let i=0;i<100&&!f.sim.projectiles.length;i++)f.sim.update(1/120,{...idle,attack:true});
 const shot=f.sim.projectiles.find(s=>s.effects?.style==='arrow');assert.ok(shot);assert.equal(shot.effects!.pierce,(f.p.derived.projectilePierce??0)+1);
});

test('Briarkeeper keeps the slow on departing targets and respects line of sight',()=>{
 const f=fixture('briarkeepers-wrap'),e=f.enemy(30),hidden=f.enemy(40);
 advanceAuras(f.p,f.sim.enemies,.61,false,(_a,_b,x)=>x!==hidden.x,()=>{},()=>{});assert.equal(e.slowTime,3);assert.equal(hidden.slowTime,0);
 f.p.x=500;advance(f,.61);assert.equal(e.slowTime,3);
});

test('Prismatic Heart exposes all four channels only on direct hits and never stacks exposure',()=>{
 const f=fixture('prismatic-heart'),e=f.enemy(40);assert.equal(resonanceHit(f.p,e,'fire',true),1);assert.equal(e.auraExposure,undefined);
 assert.equal(resonanceHit(f.p,e,'fire',false),1);assert.equal(Object.keys(e.auraExposure!).length,4);close(resonanceHit(f.p,e,'frost',false),1.1);close(resonanceHit(f.p,e,'lightning',false),1.1);
 assert.ok(Object.values(e.auraExposure!).every(v=>v.power===10));
});

test('Stillwater Treads drains built focus over two seconds without granting mana or changing reservation',()=>{
 const f=fixture('stillwater-treads'),mana=f.p.mana,reserve=auraReservation(f.p.character);advance(f,1.2);advance(f,1,true);close(f.p.auras!.still,.6);advance(f,1,true);assert.equal(f.p.auras!.still,0);
 assert.equal(f.p.mana,mana);assert.equal(f.p.auras!.reservation,reserve);
});

test('Triune pulses three full elements at 1.2s, with radius, weapon, walls and death gates',()=>{
 const f=fixture('triune-carapace'),e=f.enemy(80),styles:string[]=[],damage:number[]=[];
 const step=(dt:number)=>advanceAuras(f.p,[e],dt,false,()=>true,(_e,n,s)=>{styles.push(s);damage.push(n);},()=>{});
 step(.6);assert.equal(styles.length,0);step(.61);assert.deepEqual(styles,['fire','frost','lightning']);assert.ok(damage.every(n=>n===damage[0]));
 f.p.character.equipped.weapon=generateItem(93,25,'weapon','cinder-wand','common');refreshCharacter(f.p);step(1.3);assert.equal(styles.length,3);
});

test('aura uniques preserve reservations and clear live alterations on unequip; recipes remain immutable',()=>{
 const original=JSON.stringify(SKILL_EXECUTION);
 for(const id of ['roots-of-the-world','unbroken-vow','farflight-circlet','briarkeepers-wrap','prismatic-heart','stillwater-treads','triune-carapace']){
  const f=fixture(id),reserve=f.p.auras!.reservation;assert.equal(f.p.auras!.uniques![f.u.skill as keyof NonNullable<NonNullable<typeof f.p.auras>['uniques']>],true);
  f.p.character.equipped[uniqueSlot(f.u)]=null;refreshCharacter(f.p);assert.equal(f.p.auras!.reservation,reserve);assert.ok(Object.values(f.p.auras!.uniques!).every(v=>!v));
  f.p.dead=true;advance(f,2);assert.deepEqual(activeBuffs(f.p),[]);
 }
 assert.equal(JSON.stringify(SKILL_EXECUTION),original);
});


test('Night Reaping never consumes or creates Red Harvest marks intended for Backstab',()=>{
 const f=fixture('reapers-veil'),e=f.enemy(50);
 f.p.character.equipped.weapon=generateUnique(5,25,'red-harvest');refreshCharacter(f.p);
 f.p.skillEffects={echoes:[],harvest:[{target:e.id,remaining:4}]};
 f.cast();assert.equal(f.p.skillEffects.harvest!.length,1);assert.equal(f.p.skillEffects.harvest![0].remaining,4);
});

test('modified aura summaries expose actual rank-scaled values and timing',()=>{
 const f=fixture('triune-carapace');f.p.character.skillRanks.elementalSpikes=20;refreshCharacter(f.p);
 const text=auraSummary('elementalSpikes',20,f.p.character);assert.ok(text.includes('47.1%'));assert.ok(text.includes('1.2s'));assert.ok(text.includes('90 units'));
 const roots=fixture('roots-of-the-world');assert.ok(auraSummary('ironroot',1,roots.p.character).includes('5% less elemental'));
});
