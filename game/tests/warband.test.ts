import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { updateWarbands, goblinSpeed, goblinDamage } from '../src/warband.ts';
import { World } from '../src/world.ts';
import { CampPopulation } from '../src/camp-population.ts';
import { ENCOUNTER_RULES, chooseEncounterEnemy } from '../src/encounter-director.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import { rollEnemyLoot } from '../src/loot.ts';
import { isSpawnHidden } from '../src/spawn-visibility.ts';
import type { CampMember } from '../src/wilderness-sites.ts';
import type { WorldQuery, Input } from '../src/model.ts';
const open:WorldQuery={blocked:()=>false,move:(x,y,dx,dy)=>({x:x+dx,y:y+dy})};
const idle:Input={moveX:0,moveY:0,aimX:0,aimY:0,attack:false,heal:false,dodge:false,skillSlot:null};
function group(){
  const sim=new Simulation(open,{spawn:false});
  const chief=sim.spawnEnemy('goblinChief',180,0,'veteran',{campId:'band',memberId:'0',lootSeed:1})!;
  const goblin=sim.spawnEnemy('goblin',60,0,'normal',{campId:'band',memberId:'1',lootSeed:2})!;
  chief.awareness=1;chief.seesPlayer=true;chief.state='chase';return {sim,chief,goblin};
}
test('generated warbands have ten to fifteen small followers, a ranked chief and safe physical slots',()=>{
  const world=new World(7319), bands=world.getWildernessSites(-14000,-14000,28000,28000).filter(s=>s.members[0]?.kind==='goblinChief');
  assert.ok(bands.length>=3);
  for(const band of bands){
    assert.ok(band.members.length>=11&&band.members.length<=16);
    assert.ok(['veteran','elite'].includes(band.members[0].rank));
    assert.ok(band.members.slice(1).every(m=>m.kind==='goblin'&&m.rank==='normal'));
    for(const m of band.members)assert.equal(world.blocked(band.x+m.dx,band.y+m.dy,ENEMY_DEFINITIONS[m.kind].radius),false);
  }
  assert.deepEqual(world.getWildernessSites(-14000,-14000,28000,28000).filter(s=>s.members[0]?.kind==='goblinChief'),bands);
});
test('a complete warband shares the population cap, stays offscreen and preserves leader casualties',()=>{
  const sim=new Simulation(open,{spawn:false}),ledger=new CampPopulation();
  for(let i=0;i<9;i++)sim.spawnEnemy('stalker',-200-i*30,0);
  const camp={id:'band',x:900,y:0,radius:205,members:Array.from({length:16},(_,i)=>({id:`member:${i}`,kind:i?'goblin' as const:'goblinChief' as const,rank:i?'normal' as const:'elite' as const,dx:(i%5)*40,dy:Math.floor(i/5)*40}))};
  const view={x:-400,y:-300,width:800,height:600};
  const spawn=(m:CampMember,x:number,y:number,source:Parameters<Simulation['spawnEnemy']>[4])=>sim.spawnEnemy(m.kind,x,y,m.rank,source);
  ledger.update([camp],sim.player,sim.enemies,open,spawn,1200,{x:700,y:-300,width:800,height:600});assert.equal(sim.enemies.length,9);
  ledger.update([camp],sim.player,sim.enemies,open,spawn,1200,view);assert.equal(sim.enemies.length,25);assert.ok(sim.enemies.length<=ENCOUNTER_RULES.hardPopulationCap);
  assert.ok(sim.enemies.filter(e=>e.campId).every(e=>isSpawnHidden(e.x,e.y,view,e.radius)));
  const chief=sim.enemies.find(e=>e.kind==='goblinChief')!;chief.hp=0;chief.state='dead';
  const resumed=new CampPopulation();resumed.restoreDefeated(ledger.defeatedMembers());sim.enemies.length=0;
  resumed.update([camp],sim.player,sim.enemies,open,spawn,1200,view);assert.equal(sim.enemies.length,15);assert.ok(sim.enemies.every(e=>e.kind==='goblin'));
});
test('chief warnings precede rush bonuses, alternate with flanking, and affect only their own visible band',()=>{
  const {sim,chief,goblin}=group(),outsider=sim.spawnEnemy('goblin',90,40)!;
  updateWarbands(sim.enemies,sim.player,open,.4);assert.equal(goblinSpeed(goblin),1);assert.equal(chief.warband?.warning,true);
  updateWarbands(sim.enemies,sim.player,open,.5);assert.equal(goblinSpeed(goblin),1.2);assert.equal(goblinDamage(goblin),1.2);assert.equal(outsider.warband,undefined);
  updateWarbands(sim.enemies,sim.player,open,6);assert.equal(goblin.warband?.order,'surround');assert.equal(goblinSpeed(goblin),1);
  updateWarbands(sim.enemies,sim.player,{...open,blocked:()=>true},.2);assert.equal(goblin.warband,undefined);
});
test('killing the chief breaks morale once, never buffs or resurrects the survivors',()=>{
  const {sim,chief,goblin}=group();updateWarbands(sim.enemies,sim.player,open,1);
  const hp=goblin.hp,damage=goblin.damage;chief.state='dead';chief.hp=0;
  updateWarbands(sim.enemies,sim.player,open,FIXED_STEP);assert.equal(goblin.warband?.order,'rout');assert.equal(goblinSpeed(goblin),1);
  updateWarbands(sim.enemies,sim.player,open,3);assert.equal(goblin.warband,undefined);
  assert.equal(goblin.hp,hp);assert.equal(goblin.damage,damage);assert.equal(chief.state,'dead');
});
test('orders respect sanctuary and home return, and damage buffs snapshot at each attack windup',()=>{
  const {sim,chief,goblin}=group();chief.state='return';chief.awareness=0;goblin.awareness=1;goblin.seesPlayer=true;
  updateWarbands(sim.enemies,sim.player,open,1);assert.equal(chief.state,'return');assert.equal(goblin.warband,undefined);
  chief.state='chase';chief.awareness=1;updateWarbands(sim.enemies,sim.player,{...open,isSanctuary:()=>true},1);assert.equal(chief.warband,undefined);
  chief.commandClock=1;goblin.x=25;goblin.prevX=25;goblin.state='chase';sim.update(FIXED_STEP,idle);
  assert.equal(goblin.state,'windup');assert.equal(goblin.attackDamage,6*1.2);assert.equal(goblin.damage,6);
  chief.state='dead';chief.hp=0;updateWarbands(sim.enemies,sim.player,open,FIXED_STEP);assert.equal(goblin.attackDamage,6*1.2);
});
test('goblins remain warband-only and carry smaller independent equipment yields',()=>{
  let goblin=0,normal=0;
  for(let seed=0;seed<3000;seed++){
    const context={seed,level:1,rank:'normal' as const,biome:'deadwood' as const};
    goblin+=rollEnemyLoot({...context,kind:'goblin'}).length;normal+=rollEnemyLoot({...context,kind:'stalker'}).length;
    assert.ok(!['goblin','goblinChief'].includes(chooseEncounterEnemy([],1,'deadwood',()=>seed/3000)!));
  }
  assert.ok(goblin/normal>.23&&goblin/normal<.37);
  assert.equal(rollEnemyLoot({seed:100,level:1,rank:'normal',biome:'deadwood',kind:'goblin',firstKill:true}).length,1);
});

test('rush orders increase actual chase speed, not only the displayed order',()=>{
  const {sim,chief,goblin}=group();
  sim.player.x=250;chief.commandClock=1;goblin.state='chase';goblin.awareness=1;goblin.seesPlayer=true;
  sim.update(FIXED_STEP,idle);
  assert.ok(Math.hypot(goblin.vx,goblin.vy)>ENEMY_DEFINITIONS.goblin.speed*1.15);
});
