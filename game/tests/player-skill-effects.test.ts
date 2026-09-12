import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { activateSkill, type SkillContext } from '../src/skill-combat.ts';
import { damageEnemy, damagePlayer } from '../src/combat-damage.ts';
import { skillEffects, consumeRally, advanceSkillEffects, queueSkillEcho, snapshotSkillOffense, type SkillEcho } from '../src/player-skill-effects.ts';
import { refreshCharacter } from '../src/character.ts';
import { generateItem } from '../src/items.ts';
import { SKILL_EXECUTION } from '../src/skill-execution-content.ts';
import type { SkillId } from '../src/character-types.ts';
const world={blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
function setup(id:SkillId,weapon='longsword'){
 const sim=new Simulation(world,{spawn:false});const p=sim.player;p.character.equipped.weapon=generateItem(401,1,'weapon',weapon,'common');p.character.equipped.offhand=null;p.character.allocatedNodes=['origin',`skill:${id}`];p.character.skillSlots[0]=id;refreshCharacter(p);p.mana=p.maxMana=1000;p.derived.manaRegeneration=0;
 const context:SkillContext={availableGroundEffects:16,availableProjectiles:128,player:p,world,enemies:sim.enemies,aimX:100,aimY:0,visible:()=>true,onScreen:()=>true,damage:()=>{},projectile:()=>{},schedule:()=>{},emit:()=>{}};return{sim,p,context};
}
test('Sidestep respects movement collision without damage, invulnerability or dodge charges',()=>{
 const sim=new Simulation({...world,move:(x,y,dx,dy)=>({x:Math.min(35,x+dx),y:y+dy})},{spawn:false}),p=sim.player;p.character.allocatedNodes=['origin','skill:sidestep'];p.character.skillSlots[0]='sidestep';const charges=p.dodgeCharges,enemy=sim.spawnEnemy('brute',25,0)!;enemy.stagger=100;enemy.hp=1000;
 for(let i=0;i<40;i++)sim.update(1/120,{moveX:0,moveY:0,aimX:100,aimY:0,attack:false,dodge:false,heal:false,skillSlot:i===0?0:null});
 assert.equal(p.x,35);assert.equal(enemy.hp,1000);assert.equal(p.invulnerable,0);assert.equal(p.dodgeCharges,charges);assert.equal(p.dash,null);
});
test('Brace and Rally use the strongest stance while wards absorb a finite post-mitigation budget',()=>{
 const{p,context}=setup('brace');assert.ok(activateSkill(context,0));p.hp=p.maxHp=1000;
 const hurt=(amount:number)=>{p.invulnerable=0;damagePlayer(amount,0,1,'physical',{player:p,world:{},random:()=>1,emit:()=>{}});};p.derived.armor=0;hurt(100);assert.equal(p.hp,920);
 skillEffects(p).rallyOfIron={remaining:6,reduction:.25,charges:3,bonus:.35};hurt(100);assert.equal(p.hp,845,'stance reductions do not multiply');
 p.equipment.mainHand={...p.equipment.mainHand,family:'wand',attackKind:'bolt'};skillEffects(p).ward={remaining:4,capacity:50};hurt(100);assert.equal(p.hp,815);assert.equal(p.skillEffects?.ward,undefined);
 skillEffects(p).ward={remaining:4,capacity:200};const hp=p.hp;hurt(100);assert.equal(p.hp,hp);assert.equal(p.skillEffects!.ward!.capacity,120);
 advanceSkillEffects(p,5);assert.equal(p.skillEffects?.ward,undefined);assert.equal(p.skillEffects?.brace,undefined);
});
test('Rally consumes one charge per melee action and cannot empower bows or grant charges on hits',()=>{
 const{p,context}=setup('rallyOfIron');assert.ok(activateSkill(context,0));assert.equal(consumeRally(p,false),1);for(let i=0;i<3;i++)assert.equal(consumeRally(p,true),1.35);assert.equal(consumeRally(p,true),1);assert.equal(p.skillEffects!.rallyOfIron!.charges,0);
});
test('Ghost Hunt queues a bounded delayed snapshot with critical and chain snapshots, without life gain or recursive budget',()=>{
 const{p,context}=setup('ghostHunt','thorn-shortbow');assert.ok(activateSkill(context,0));const shot={owner:'player' as const,speed:560,life:1,radius:3,damage:100},payload={style:'arrow' as const,chain:6,lifeSteal:.5,offense:snapshotSkillOffense(p)};
 for(let i=0;i<10;i++)queueSkillEcho(p,10,20,.5,shot,payload);assert.equal(p.skillEffects!.echoes.length,3);assert.equal(p.skillEffects!.ghostHunt!.charges,0);shot.damage=1000;p.derived.lifeOnHit=100;
 const released:SkillEcho[]=[];advanceSkillEffects(p,.31,e=>released.push(e));assert.equal(released.length,0);advanceSkillEffects(p,.02,e=>released.push(e));assert.equal(released.length,3);for(const e of released){assert.equal(e.definition.damage,60);assert.equal(e.x,10);assert.equal(e.angle,.5);assert.equal(e.effects.offense!.critChance,payload.offense.critChance);assert.equal(e.effects.offense!.lifeOnHit,0);assert.equal(e.effects.chain,6);assert.equal(e.effects.lifeSteal,undefined);}assert.equal(p.skillEffects!.echoes.length,0);
});
test('new skill casts preflight capacity and gear before spending mana, and gear changes clear dependent effects',()=>{
 const{p,context}=setup('vaultingShot','thorn-shortbow');context.availableProjectiles=0;const mana=p.mana;assert.equal(activateSkill(context,0),false);assert.equal(p.mana,mana);assert.deepEqual(p.skillCooldowns,{});
 context.availableProjectiles=1;assert.ok(activateSkill(context,0));assert.ok(p.dash!.angle>3);assert.equal(p.dash!.damage,0);
 p.character.equipped.weapon=generateItem(402,1,'weapon','longsword','common');skillEffects(p).ward={remaining:4,capacity:20};skillEffects(p).ghostHunt={remaining:6,charges:3,bonus:.45,reduction:0};refreshCharacter(p);assert.equal(p.skillEffects?.ward,undefined);assert.equal(p.skillEffects?.ghostHunt,undefined);assert.ok(p.skillCooldowns.vaultingShot!>0);
});
test('Measured Force snapshots direct damage without crit and leaves periodic damage unchanged',()=>{
 const{sim,p}=setup('cleave');p.character.allocatedNodes.push('keystone:measured-force','hunt:2:5');p.character.attributes.dexterity=410;refreshCharacter(p);assert.equal(p.derived.critChance,0);assert.equal(p.derived.directDamageMultiplier,1.3);const offense=snapshotSkillOffense(p),enemy=sim.spawnEnemy('brute',30,0)!;enemy.hp=1000;
 const context={player:p,enemies:sim.enemies,random:()=>0,visible:()=>true,emit:()=>{},killed:()=>{}};damageEnemy(enemy,100,0,false,context,false,undefined,undefined,offense);assert.equal(enemy.hp,870);damageEnemy(enemy,100,0,false,context,true,undefined,undefined,offense);assert.equal(enemy.hp,770);
});
test('Open Hand and Borrowed Flame enforce their loadout and damage tradeoffs',()=>{
 const{p}=setup('cleave');const base=p.derived.attackDamageMultiplier;p.character.allocatedNodes.push('keystone:open-hand');refreshCharacter(p);assert.equal(p.derived.attackDamageMultiplier,base*1.2);
 p.character.equipped.offhand=generateItem(902,1,'shield',undefined,'common');refreshCharacter(p);assert.equal(p.derived.attackDamageMultiplier,base*.9);
 p.character.allocatedNodes.push('keystone:borrowed-flame');refreshCharacter(p);assert.equal(p.derived.attackDamageMultiplier,base*.9*.85);assert.equal(p.derived.spellweavePercent,0);
 assert.equal(SKILL_EXECUTION.rallyOfIron.charges,3);
});

test('refunding a tree clears skill effects without granting a fresh cooldown',()=>{const{p,context}=setup('ghostHunt','thorn-shortbow');assert.ok(activateSkill(context,0));const cd=p.skillCooldowns.ghostHunt;p.character.allocatedNodes=['origin'];refreshCharacter(p);assert.equal(p.skillEffects?.ghostHunt,undefined);assert.deepEqual(p.skillEffects?.echoes,[]);assert.equal(p.skillCooldowns.ghostHunt,cd);});
