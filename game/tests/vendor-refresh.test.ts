import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, generateItem, itemModifiers } from '../src/items.ts';
import { quoteService, planService, vendorStock, vendorRefreshPrice, COMMERCE_LIMITS } from '../src/commerce.ts';
import { validCommerce } from '../src/commerce-validation.ts';
import { executeService } from '../src/commerce-command.ts';
import { Simulation } from '../src/simulation.ts';
import { World } from '../src/world.ts';
import { buildingNPC, type TownNPC } from '../src/npcs.ts';
import { improveItem, improvementProblem } from '../src/item-improvement.ts';
import { enhancementGains, stockCategory } from '../src/service-presentation.ts';
import { storageGridLayout, itemFootprint, PACK_COLUMNS } from '../src/inventory-grid.ts';

const smith:TownNPC={id:'town:7319:0:building:0:blacksmith',buildingId:'town:7319:0:building:0',role:'blacksmith',name:'Edda',seed:7,x:0,y:0,level:10};
const jeweler:TownNPC={...smith,id:'town:7319:0:building:1:jeweler',role:'jeweler'};
const fresh=()=>{const sheet=createCharacterSheet();sheet.gold=1e9;return sheet;};

test('refresh replaces all stock atomically, preserves owned items, and survives serialization',()=>{
  const before=fresh(),original=JSON.stringify(before),initial=vendorStock(before,smith,10);
  const buy=quoteService(before,smith,10,{type:'buy',slot:0});assert.ok(buy.ok);
  const bought=planService(before,smith,10,buy.quote);assert.ok(bought.ok);
  const oldQuote=quoteService(bought.character,smith,10,{type:'buy',slot:1});assert.ok(oldQuote.ok);
  const q=quoteService(bought.character,smith,10,{type:'refreshStock'});assert.ok(q.ok);assert.equal(q.quote.price,285);
  const refreshed=planService(bought.character,smith,10,q.quote);assert.ok(refreshed.ok);
  assert.equal(refreshed.character.gold,bought.character.gold!-285);
  assert.deepEqual(refreshed.character.inventory,bought.character.inventory);
  assert.deepEqual(refreshed.character.equipped,bought.character.equipped);
  const stock=vendorStock(refreshed.character,smith,10);assert.ok(stock.every(Boolean));
  assert.ok(stock.every(item=>!initial.some(old=>old!.id===item!.id)));
  assert.deepEqual(stock,vendorStock(JSON.parse(JSON.stringify(refreshed.character)),smith,12));
  assert.equal(vendorRefreshPrice(refreshed.character,smith,10),570);
  assert.equal(vendorRefreshPrice(refreshed.character,jeweler,10),285);
  assert.equal(planService(refreshed.character,smith,10,q.quote).ok,false);
  assert.equal(planService(refreshed.character,smith,10,oldQuote.quote).ok,false);
  assert.equal(JSON.stringify(before),original);
  assert.ok(validCommerce(refreshed.character.commerce,10));
  assert.deepEqual(vendorStock(refreshed.character,jeweler,10),vendorStock(before,jeweler,10));
  const next=quoteService(refreshed.character,smith,13,{type:'refreshStock'});assert.ok(next.ok);assert.equal(next.quote.price,285);
  const nextPlan=planService(refreshed.character,smith,13,next.quote);assert.ok(nextPlan.ok);
  assert.equal(nextPlan.character.commerce.refreshes![smith.id],1);
});
test('refresh validates funds, price, role, persistence limits and numeric bounds',()=>{
  const c=fresh();const q=quoteService(c,smith,10,{type:'refreshStock'});assert.ok(q.ok);
  assert.equal(planService(c,smith,10,{...q.quote,price:1}).ok,false);
  c.gold=0;const unchanged=JSON.stringify(c);assert.equal(planService(c,smith,10,q.quote).ok,false);assert.equal(JSON.stringify(c),unchanged);
  assert.equal(quoteService(c,{...smith,role:'gambler'},10,{type:'refreshStock'}).ok,false);
  c.commerce.epoch=3;c.commerce.sold[smith.id]=0;c.commerce.refreshes={[smith.id]:53};
  assert.equal(quoteService(c,smith,10,{type:'refreshStock'}).ok,false);
  assert.equal(validCommerce({...c.commerce,refreshes:{[jeweler.id]:1}},10),false);
  assert.equal(validCommerce({...c.commerce,refreshes:{[smith.id]:1.5}},10),false);
  assert.ok(validCommerce({...c.commerce,refreshes:undefined},10));
  c.commerce.sold=Object.fromEntries(Array.from({length:COMMERCE_LIMITS.vendors},(_,i)=>[`town:7319:0:building:${i+10}:blacksmith`,0]));
  c.commerce.refreshes={};assert.equal(quoteService(c,smith,10,{type:'refreshStock'}).ok,false);
});
test('a failed durable refresh never changes gold or stock',async()=>{
  const world=new World(7319),sim=new Simulation(world,{spawn:false}),p=sim.player;
  const npc=world.getBuildings(-1500,-2200,3000,1600).map(buildingNPC).find(n=>n?.role==='blacksmith')!;
  p.x=npc.x;p.y=npc.y;p.character.gold=10000;
  const q=quoteService(p.character,npc,p.level,{type:'refreshStock'});assert.ok(q.ok);
  const original=JSON.stringify(p.character),stock=vendorStock(p.character,npc,p.level);
  const result=await executeService(p,npc,world,q.quote,async()=>({ok:false,message:'disk full'}));
  assert.equal(result.ok,false);assert.equal(JSON.stringify(p.character),original);assert.deepEqual(vendorStock(p.character,npc,p.level),stock);
});
test('category trays retain footprints, do not overlap, and keep bought holes reserved',()=>{
  for(const role of ['blacksmith','jeweler'] as const)for(const settlementTier of ['settlement','village','city'] as const){
    const npc={...(role==='blacksmith'?smith:jeweler),settlementTier};const c=fresh();
    for(const category of ['weapons','armor','accessories']){
      const items=vendorStock(c,npc,10,true).filter(item=>item&&stockCategory(item)===category),layout=storageGridLayout(items),cells=new Set<number>();
      items.forEach((item,index)=>{const pos=layout.cells[index]!,size=itemFootprint(item!);assert.ok(pos%PACK_COLUMNS+size.width<=PACK_COLUMNS);
        for(let y=0;y<size.height;y++)for(let x=0;x<size.width;x++){const cell=pos+y*PACK_COLUMNS+x;assert.ok(!cells.has(cell));cells.add(cell);}
      });
    }
    const original=vendorStock(c,npc,10,true);c.commerce.epoch=3;c.commerce.sold[npc.id]=1;
    assert.equal(vendorStock(c,npc,10)[0],null);assert.deepEqual(vendorStock(c,npc,10,true),original);
  }
});
test('enhancement preview reports actual changes, including shields and small rolls',()=>{
  for(const kind of ['weapon','shield','chest','ring','orb','charm'] as const){
    const item=generateItem(430,20,kind,undefined,'epic');
    if(improvementProblem(item,'enhance',20))continue;
    const next=improveItem(item,'enhance',20,1),rows=enhancementGains(item,next);
    assert.ok(rows.length);assert.ok(rows.every(row=>row.before!==row.after));
    if(item.weapon)assert.equal(rows[0].after,String(next.weapon!.damage));
    if(item.shield){const expected=next.shield!.blockChance+(itemModifiers(next).blockChance??0);
      const row=rows.find(row=>row.label==='Block chance');if(row)assert.equal(row.after,`+${expected}%`);}
    assert.deepEqual(enhancementGains(item,item),[]);
  }
});
