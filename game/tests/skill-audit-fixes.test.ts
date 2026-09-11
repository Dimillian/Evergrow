import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import type { CombatEvent, Input, Projectile } from '../src/model.ts';
import type { SkillId } from '../src/character-types.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../src/weapon-content.ts';
import { resolveSkill, SKILL_SPECIALIZATIONS } from '../src/skill-progression.ts';
import { applyStun, advanceEnemyStatuses } from '../src/combat-status.ts';
import { damageEnemy } from '../src/combat-damage.ts';
import { advanceGroundEffects, scheduleGroundEffect, type ActiveGroundEffect } from '../src/ground-effects.ts';
import { GROUND_EFFECT_RULES } from '../src/skill-execution-content.ts';
import { MAX_PROJECTILES } from '../src/projectile-combat.ts';
import { touchTargeting } from '../src/touch-targeting.ts';
import { playerPose } from '../src/character-pose.ts';
import { weaponReleasePoint, projectilePresentation } from '../src/projectile-launch.ts';
import { getPlayerProjectileOrigin } from '../src/character-motion.ts';
import { skillSweepPoint, SkillMeleeArt } from '../src/skill-melee-art.ts';
import { getActiveSwingOffset } from '../src/attack-motion.ts';
import { enemyDebuffs } from '../src/enemy-debuffs.ts';
import { previewSkillVariant } from '../src/skill-variant-preview.ts';
import { skillSustain } from '../src/skill-sustain.ts';
import { skillSoundFamily } from '../src/skill-audio-content.ts';

const world = { blocked: () => false, move: (x: number,y: number,dx: number,dy: number) => ({x:x+dx,y:y+dy}) };
const input: Input = {moveX:0,moveY:0,aimX:100,aimY:0,attack:false,dodge:false,heal:false,skillSlot:null};
const close = (a: number,b: number) => assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function setup(id: SkillId, variant?: string) {
  const sim = new Simulation(world,{spawn:false});
  sim.setCombatViewport({x:-500,y:-400,width:1000,height:800});
  const p=sim.player, requirement=SKILL_DEFINITIONS[id].requirement;
  const family=requirement==='magic'?'staff':requirement==='bow'?'bow':requirement==='heavy'?'axe':requirement==='dagger'?'dagger':'sword';
  p.equipment={mainHand:WEAPON_PROFILES.find(w=>w.family===family)!,offHand:requirement==='shield'?{kind:'shield',shield:SHIELD_PROFILES[0]}:null};
  p.character.allocatedNodes=['origin',`skill:${id}`];p.character.skillSlots[0]=id;
  if(variant){p.character.allocatedNodes.push(`specialization:${variant}`);p.character.skillSpecializations[id]=variant;}
  p.mana=p.maxMana=10000;p.derived.critChance=0;p.derived.lifeRegeneration=0;p.derived.manaRegeneration=0;
  const target=(x=35)=>{const e=sim.spawnEnemy('stalker',x,0)!;e.hp=e.maxHp=100000;e.state='recover';e.stateDuration=999;return e;};
  const cast=()=>sim.update(FIXED_STEP,{...input,skillSlot:0});
  const step=(n=1)=>{for(let i=0;i<n;i++)sim.update(FIXED_STEP,input);};
  sim.drainEvents(); return {sim,p,target,cast,step};
}
function dummy(id: number): Projectile {return {id,sourceLevel:1,x:800,y:0,prevX:800,prevY:0,vx:0,vy:0,angle:0,radius:1,damage:1,life:100,maxLife:100,owner:'player',hitIds:new Set()};}
const ground=(id: number): ActiveGroundEffect=>({id,kind:'meteor',skill:'meteor',x:700,y:0,radius:20,damage:1,delay:10,duration:0,interval:1,tick:0,pulsesLeft:1,style:'fire'});

test('melee follow-ups preserve authored freeze/stun duration and their distinct feedback identity',()=>{
  for(const kind of ['freeze','stun'] as const){
    const h=setup('cleave'),enemy=h.target();applyStun(enemy,2.5,kind);
    damageEnemy(enemy,1,0,true,{player:h.p,enemies:[enemy],random:()=>1,visible:()=>true,emit:()=>{},killed:()=>{}});
    close(enemy.stagger,2.5);
    assert.ok(enemyDebuffs(enemy).some(d=>d.id===kind));
    advanceEnemyStatuses(enemy,.25,()=>{});close(enemy.stagger,2.25);
    advanceEnemyStatuses(enemy,3,()=>{});assert.equal(enemyDebuffs(enemy).some(d=>d.id===kind),false);
  }
});

test('following and anchored storms cancel before charging/hitting after gear loss or death; travel cancels both',()=>{
  for(const variant of [undefined,'tempest-still'])for(const reason of ['gear','death','travel']){
    const h=setup('tempest',variant);h.target();h.cast();assert.equal(h.sim.groundEffects.length,1);
    const mana=h.p.mana;
    if(reason==='travel'){h.sim.groundEffects.push(ground(99));h.sim.relocate(2000,0);assert.deepEqual(h.sim.groundEffects.map(e=>e.id),[99]);continue;}
    if(reason==='gear')h.p.equipment.mainHand=WEAPON_PROFILES.find(w=>w.family==='sword')!;else h.p.dead=true;
    const remaining=advanceGroundEffects(h.sim.groundEffects,.5,{player:h.p,enemies:h.sim.enemies,visible:()=>true,damage:()=>assert.fail('cancelled storm hit'),emit:()=>{}});
    assert.equal(remaining.length,0);assert.equal(h.p.mana,mana);
  }
});

test('a fan cannot partially consume resources at projectile capacity',()=>{
  for(const count of [MAX_PROJECTILES,MAX_PROJECTILES-2]){
    const h=setup('fireball','fireball-fork');h.sim.projectiles=Array.from({length:count},(_,i)=>dummy(i));
    const mana=h.p.mana;h.cast();assert.equal(h.sim.projectiles.length,count);assert.equal(h.p.mana,mana);
    assert.equal(h.p.skillCooldowns.fireball,undefined);assert.equal(h.sim.drainEvents().some(e=>e.type==='cast'),false);
  }
  const h=setup('fireball','fireball-fork');h.sim.projectiles=Array.from({length:MAX_PROJECTILES-3},(_,i)=>dummy(i));h.cast();assert.equal(h.sim.projectiles.length,MAX_PROJECTILES);assert.ok(h.p.mana<10000);
});

test('Living Ember reserves its impact patch; later casts cannot consume that reservation',()=>{
  const h=setup('fireball','fireball-ember');h.target(60);
  h.sim.groundEffects=Array.from({length:GROUND_EFFECT_RULES.maximum-1},(_,i)=>ground(i));
  h.cast();assert.ok(h.sim.projectiles[0].effects?.groundDuration);
  h.p.castTime=0;h.p.character.allocatedNodes.push('skill:iceNova','specialization:nova-echo');h.p.character.skillSlots[0]='iceNova';h.p.character.skillSpecializations.iceNova='nova-echo';
  const mana=h.p.mana;h.cast();assert.equal(h.p.mana,mana);assert.equal(h.p.skillCooldowns.iceNova,undefined);
  h.step(30);assert.equal(h.sim.groundEffects.length,GROUND_EFFECT_RULES.maximum);
  const embers=h.sim.groundEffects.find(e=>e.kind==='embers')!;assert.ok(embers);assert.equal(embers.damage,0);assert.ok(embers.burn!.dps>0);
  h.sim.drainEvents();h.step(65);assert.equal(h.sim.drainEvents().some(e=>e.type==='blast'&&e.skill==='fireball'),false);
});

test('released projectiles retain critical and life-on-hit bonuses across later stat changes',()=>{
  for(const original of [0,1]){
    const h=setup('siphon');h.target(70);h.p.hp=20;h.p.derived.critChance=original;h.p.derived.critMultiplier=2;h.p.derived.lifeOnHit=3;
    h.cast();const shot=h.sim.projectiles[0],expected=Math.round(shot.damage*(original?2:1));
    h.p.derived.critChance=1-original;h.p.derived.critMultiplier=5;h.p.derived.lifeOnHit=50;
    h.step(30);const hits=h.sim.drainEvents().filter((e):e is Extract<CombatEvent,{type:'hit'}>=>e.type==='hit');
    assert.equal(hits[0].value,expected);close(h.p.hp,Math.min(h.p.maxHp,20+3+expected*.35));
  }
});

test('delayed area offense is copied at scheduling and retained after equipment changes',()=>{
  const h=setup('meteor'),enemy=h.target();let effects:ActiveGroundEffect[]=[];
  const offense={critChance:1,critMultiplier:2,lifeOnHit:3};h.p.hp=20;
  scheduleGroundEffect(effects,{...ground(1),delay:0,offense,damage:10,x:0,radius:100},{nextId:()=>1,emit:()=>{}});
  offense.critChance=0;offense.critMultiplier=5;h.p.derived.lifeOnHit=60;
  effects=advanceGroundEffects(effects,FIXED_STEP,{player:h.p,enemies:[enemy],visible:()=>true,
    damage:(e,d,a,m,style,periodic,source)=>damageEnemy(e,d,a,m,{player:h.p,enemies:[e],random:()=>0,visible:()=>true,emit:()=>{},killed:()=>{}},periodic,style,undefined,source),emit:()=>{}});
  assert.equal(effects.length,0);close(enemy.hp,enemy.maxHp-20);close(h.p.hp,23);
});

test('Iron Aegis gains duration at every rank after reduction caps, including equipment ranks',()=>{
  const h=setup('bulwark','bulwark-reduction');let previous=resolveSkill('bulwark',h.p.derived,h.p.character,3);
  for(let rank=4;rank<=7;rank++){
    const next=resolveSkill('bulwark',h.p.derived,h.p.character,rank);
    assert.ok(next.recipe.kind==='guard'&&previous.recipe.kind==='guard');
    close(next.recipe.reduction,.9);close(next.recipe.duration,previous.recipe.duration+.25);previous=next;
  }
  h.p.derived.skillBonuses = { bulwark: 2 };
  const geared = resolveSkill('bulwark',h.p.derived,h.p.character,3);
  assert.ok(geared.recipe.kind === 'guard');close(geared.recipe.duration,2.5);
});

test('Executioner penalizes frontal hits only and Shattered Sky has a smaller authored footprint',()=>{
  const values:number[]=[];
  for(const [variant,rear] of [[undefined,false],['backstab-rear',false],['backstab-rear',true]] as const){
    const h=setup('backstab',variant);h.target().angle=rear?0:Math.PI;h.cast();
    values.push((h.sim.drainEvents().find(e=>e.type==='hit') as Extract<CombatEvent,{type:'hit'}>).value);
  }
  assert.ok(Math.abs(values[1]-values[0]*.85)<=1);assert.ok(Math.abs(values[2]-values[0]*3)<=2);
  const h=setup('meteor','meteor-shards'),r=resolveSkill('meteor',h.p.derived,h.p.character).recipe;
  assert.ok(r.kind==='ground');close(r.radius,125*.65);assert.equal(r.scatter,5);
});

test('touch targets following/frost ultimates at the caster and anchored storms at the aimed ground',()=>{
  for(const id of ['tempest','absoluteZero'] as const){
    const variants=[undefined,...SKILL_SPECIALIZATIONS.filter(v=>v.skill===id).map(v=>v.id)];
    for(const variant of variants){const h=setup(id,variant);assert.equal(touchTargeting(resolveSkill(id,h.p.derived,h.p.character).recipe),variant==='tempest-still'?'ground':'self');}
  }
});

test('instant actions start at the release/contact pose; projectile, light and sparks share the weapon release point',()=>{
  for(const id of ['fireball','frostLance','siphon','volley','earthshatter','shieldBash','backstab'] as const){
    const h=setup(id);h.cast();const pose=playerPose(h.p,h.sim.time);close(pose.cast!,1);
    const shot=h.sim.projectiles[0];
    if(shot){assert.equal(shot.launch?.skill,id);const tip=weaponReleasePoint(shot.launch!);const liveTip=getPlayerProjectileOrigin(pose);close(tip.x,liveTip.x);close(tip.y,liveTip.y);
      // Simulation may have advanced the shot within the release tick; inspect its release age.
      shot.life=shot.maxLife;shot.prevX=shot.x=0;shot.prevY=shot.y=0;const at=projectilePresentation(shot);close(at.x,tip.x);close(at.y,tip.y);
      const event=h.sim.drainEvents().find(e=>e.type==='cast');assert.ok(event?.type==='cast'&&event.launch===shot.launch);
    }
    h.step(120);assert.equal(h.p.castTime,0);
  }
});

test('skill crescents cover actual contact geometry across facings, hands and specializations; LMB has none',()=>{
  const recorder=()=>{const points:number[][]=[];let depth=0;
    const c=new Proxy({}, {get:(_t,k)=>k==='save'?()=>depth++:k==='restore'?()=>depth--:k==='moveTo'||k==='lineTo'? (...v:number[])=>{assert.ok(v.every(Number.isFinite));points.push(v);}:()=>{}}) as CanvasRenderingContext2D;
    return {c,points,depth:()=>depth};};
  for(const id of ['cleave','whirlwind'] as const)for(const v of [undefined,...SKILL_SPECIALIZATIONS.filter(s=>s.skill===id).map(s=>s.id)]){
    const h=setup(id,v);h.cast();const a=h.p.attack!;a.elapsed=(a.activeStart+a.activeEnd)/2;
    for(const hand of ['main','off'] as const)for(let facing=0;facing<8;facing++){
      const angle=facing*Math.PI/4,p=.5,pt=skillSweepPoint(angle,a.arc,hand,p,a.range);
      close(Math.hypot(...pt),a.range);close(Math.atan2(pt[1],pt[0]),Math.atan2(Math.sin(angle+getActiveSwingOffset(p,a.arc,hand)),Math.cos(angle+getActiveSwingOffset(p,a.arc,hand))));
    }
    const art=new SkillMeleeArt();art.update(h.p,FIXED_STEP);const draw=recorder();art.draw(draw.c,false);assert.ok(draw.points.length>60);assert.equal(draw.depth(),0);
    art.reset();const empty=recorder();art.draw(empty.c,true);assert.equal(empty.points.length,0);
    delete a.skill;art.update(h.p,FIXED_STEP);art.draw(empty.c,false);assert.equal(empty.points.length,0);
  }
});

test('variant previews show prospective passives without mutating the character or selecting the variant',()=>{
  const h=setup('fireball');const before=JSON.stringify(h.p.character);
  const preview=previewSkillVariant('fireball-fork',h.p.derived,h.p.character)!;
  close(preview.after.damageMultiplier,SKILL_DEFINITIONS.fireball.damageMultiplier*.65*1.06);
  assert.equal(preview.after.mana,20.7);assert.equal(JSON.stringify(h.p.character),before);
});

test('sustained feedback outlives cast recovery and skill audio distinguishes impact families',()=>{
  const h=setup('tempest');h.cast();h.step(120);assert.equal(h.p.activeSkill,null);
  const sustain=skillSustain('tempest',h.p,h.sim.groundEffects);assert.ok(sustain&&sustain.remaining>0&&sustain.upkeep>0);
  h.sim.relocate(1000,0);assert.equal(skillSustain('tempest',h.p,h.sim.groundEffects),null);
  for(const [id,family] of [['earthshatter','earth'],['meteor','fire'],['iceNova','frost'],['arcLightning','lightning'],['siphon','spirit'],['volley','arrow'],['shieldBash','shield']] as const)
    assert.equal(skillSoundFamily({type:'cast',skill:id,x:0,y:0,angle:0}),family);
});

test('every meteor in a barrage deals full damage to each overlapping target',()=>{
  const h=setup('cataclysm'),enemies=[h.target(100),h.target(105)];h.cast();
  const impacts=h.sim.groundEffects.filter(e=>e.kind==='meteor');assert.equal(impacts.length,7);
  const base=impacts[0].damage,totals=new Map<number,number>(),counts=new Map<number,number>();
  for(let i=0;i<360;i++){
    enemies.forEach((e,j)=>{e.x=100+j*5;e.y=0;e.stagger=60;e.knockbackX=e.knockbackY=0;});h.step();
    for(const event of h.sim.drainEvents())if(event.type==='hit'&&!event.periodic){totals.set(event.targetId,(totals.get(event.targetId)??0)+event.value);counts.set(event.targetId,(counts.get(event.targetId)??0)+1);}
  }
  for(const e of enemies){assert.equal(counts.get(e.id),7);assert.equal(totals.get(e.id),7*Math.round(base));}
});

test('every projectile in a fan deals full damage through direct and explosion contacts',()=>{
  const h=setup('fireball','fireball-fork'),enemies=[h.target(35),h.target(40)];h.cast();
  const shots=h.sim.projectiles;assert.equal(shots.length,3);
  const base=shots[0].damage,totals=new Map<number,number>(),counts=new Map<number,number>();
  for(let i=0;i<120;i++){
    enemies.forEach((e,j)=>{e.x=35+j*5;e.y=0;e.stagger=60;e.knockbackX=e.knockbackY=0;});h.step();
    for(const event of h.sim.drainEvents())if(event.type==='hit'&&!event.periodic){totals.set(event.targetId,(totals.get(event.targetId)??0)+event.value);counts.set(event.targetId,(counts.get(event.targetId)??0)+1);}
  }
  for(const e of enemies){assert.equal(counts.get(e.id),3);assert.equal(totals.get(e.id),3*Math.round(base));}
});

test('Fireball uses its authored burn without merging the generic contact rate',()=>{
  const h=setup('fireball'),enemy=h.target(35);h.cast();const damage=h.sim.projectiles[0].damage;
  for(let i=0;i<100&&enemy.burnTime===0;i++)h.step();
  assert.ok(enemy.burnTime>0);close(enemy.burnDps,damage*.12);
});


test('Shattered Sky spreads its five smaller impacts over wider ground',()=>{
  const h=setup('meteor','meteor-shards');h.cast();const effects=h.sim.groundEffects;
  assert.equal(effects.length,5);assert.ok(effects.some(e=>Math.hypot(e.x-100,e.y)>125));
});
