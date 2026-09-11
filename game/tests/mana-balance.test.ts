import { itemTooltipMarkup } from '../src/item-ui.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { manaCostMultiplier, manaVialAmount, manaVialRestoration } from '../src/mana-content.ts';
import { createCharacterSheet, deriveItem, generateItem, rebalanceItemMana } from '../src/items.ts';
import { deriveCharacterStats } from '../src/character-stats.ts';
import { validItem } from '../src/item-validation.ts';
import { validPickups } from '../src/dungeon-validation.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { refreshCharacter } from '../src/character.ts';
import { awardKillRewards } from '../src/combat-rewards.ts';
import { addInventoryItem } from '../src/inventory.ts';

const world={blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
test('Intelligence adds mana without regeneration and preserves level-one casting',()=>{
  const s=createCharacterSheet();const base=deriveCharacterStats(s);s.attributes.intelligence+=100;
  const grown=deriveCharacterStats(s);assert.equal(base.maxMana,100);assert.equal(base.manaRegeneration,1);
  assert.equal(grown.maxMana,300);assert.equal(grown.spellDamageMultiplier,2.5);assert.equal(grown.manaRegeneration,1);
  assert.equal(manaCostMultiplier(0),1);assert.equal(manaCostMultiplier(20),.8);
  const samples=[20,30,50,75,150,1000].map(manaCostMultiplier);
  for(let i=1;i<samples.length;i++)assert.ok(samples[i]<=samples[i-1]&&samples[i]>=.6);
  assert.ok(manaCostMultiplier(75)>.6&&manaCostMultiplier(75)<.62);
});

test('integer regeneration rolls respect stone area instead of rounding every cell to one mana per second',()=>{
  const stone=(profile:string,seed:number)=>{const i=generateItem(seed,35,'charm',profile,'common');
    i.affixes[0]={name:'Clarity',stat:'manaRegen',value:1};i.recipe.rolls[0]=.5;return deriveItem(i);};
  const pebble=stone('astral-pebble',1),monolith=stone('astral-monolith',2);
  assert.equal(pebble.affixes[0].value,1);assert.ok(monolith.affixes[0].value>=8);
  const s=createCharacterSheet();s.inventory.fill(null);s.inventoryLayout={};
  for(let i=0;i<48;i++)assert.ok(addInventoryItem(s,stone('astral-pebble',100+i)));
  assert.equal(deriveCharacterStats(s,{},35).manaRegeneration,10.6);
  for(const i of [pebble,monolith])assert.ok(i.affixes.every(a=>Number.isInteger(a.value)));
});

test('old mana recipes reprice once while preserving offense, identity, lock and roll quantiles',()=>{
  const i=generateItem(89,35,'ring','moonstone-ring','rare');
  i.affixes=[{name:'Clarity',stat:'manaRegen',value:99},{name:'Sorcery',stat:'spellDamagePercent',value:42}];
  i.recipe.rolls=[.3,.6];i.implicit={manaRegen:9};i.locked=true;delete i.recipe.manaVersion;
  const before=structuredClone(i),next=rebalanceItemMana(i);
  assert.ok(validItem(next));assert.equal(next.id,i.id);assert.equal(next.locked,true);
  assert.deepEqual(next.recipe.rolls,i.recipe.rolls);assert.deepEqual(next.affixes[1],i.affixes[1]);
  assert.ok(next.affixes[0].value<99);assert.ok(next.implicit.manaRegen!<9);
  assert.deepEqual(rebalanceItemMana(next),next);assert.deepEqual(i,before);
});

test('mana vials snapshot defeated level, obey missing mana and ignore later pool inflation',()=>{
  const sim=new Simulation(world,{spawn:false});const p=sim.player;
  const enemy=sim.spawnEnemy('stalker',0,0,'normal',undefined,{base:35,min:35,max:35,fixed:true})!;
  p.mana=p.maxMana;let id=500;
  awardKillRewards(enemy,0,0,{player:p,groundItems:sim.groundItems,groundGold:sim.groundGold,pickups:sim.pickups,nextId:()=>++id,emit:()=>{}});
  assert.equal(sim.pickups[0].restoreAmount,20);assert.ok(validPickups(sim.pickups));sim.enemies=[];
  p.character.equipped.head!.implicit={maxMana:1000,manaRegen:-5};refreshCharacter(p);p.mana=0;
  sim.update(FIXED_STEP,{moveX:0,moveY:0,aimX:0,aimY:0,attack:false,dodge:false,heal:false,skillSlot:null});
  assert.equal(p.mana,20);assert.equal(manaVialAmount(1),8);
  assert.equal(manaVialRestoration(100,manaVialAmount(1000)),16);
  assert.equal(validPickups([{id:1,x:0,y:0,kind:'mana',restoreFraction:.16,restoreAmount:-5,life:1,radius:4}]),false);
});

test('item comparison keeps both regeneration columns in mana per five seconds',()=>{
  const item=generateItem(92,1,'ring','moonstone-ring','magic');
  item.implicit={};item.affixes=[{name:'Clarity',stat:'manaRegen',value:5}];
  const markup=itemTooltipMarkup(item,{sheet:createCharacterSheet(),level:1});
  assert.match(markup,/Mana \/ 5 sec<\/th><td>\+5<\/td><td class="is-gain">\+5<\/td>/);
});
