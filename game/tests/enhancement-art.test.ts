import test from 'node:test';
import assert from 'node:assert/strict';
import { weaponEnhancementRank, enhancementFinish, enhancementMote, drawEnhancementGlow, drawEnhancementMotion } from '../src/enhancement-art.ts';
import { itemIconSVG, itemPackIconSVG, outfitFromEquipment } from '../src/item-art.ts';
import { generateItem, deriveItem, ITEM_KINDS } from '../src/items.ts';
import { itemFootprint } from '../src/inventory-grid.ts';
import { Simulation } from '../src/simulation.ts';
import { playerPose } from '../src/character-pose.ts';
import { characterBounds } from '../src/character-framing.ts';
import { tintedOutfit } from '../src/appearance-armor.ts';
import type { GearShape } from '../src/weapon-shapes.ts';

test('only +6 through +10 earn progressively brighter, broader cosmetic finishes',()=>{
  for(const rank of [-1,0,1,2,3,4,5,11,6.5,NaN,Infinity])assert.equal(enhancementFinish(rank),null);
  for(let rank=6;rank<=10;rank++) {
    const finish=enhancementFinish(rank)!;assert.ok(Object.isFrozen(finish));
    if(rank>6)for(const key of ['bloom','power','edge','spread'] as const)assert.ok(finish[key]>enhancementFinish(rank-1)![key]);
  }
});

test('only weapon icons receive the finish without replacing geometry, materials or recipes',()=>{
  const ids=new Set<string>();
  for(const kind of ITEM_KINDS.filter(kind=>kind!=='riftKey')) {
    const base=generateItem(812,20,kind,undefined,'rare');
    const footprint=itemFootprint(base);
    for(let rank=5;rank<=10;rank++) {
      const item=deriveItem({...base,recipe:{...base.recipe,enhancement:rank}}),before=structuredClone(item);
      for(const svg of [itemIconSVG(item,120),itemPackIconSVG(item,footprint.width,footprint.height)]) {
        assert.equal(svg.includes('data-enhancement-glow'),kind==='weapon'&&rank>=6);
        assert.equal(svg.includes('item-temper-glints'),kind==='weapon'&&rank===10);
        assert.ok(!/NaN|Infinity|undefined|<animate|<image/.test(svg));
        const local=new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
        for(const id of local){assert.equal(ids.has(id),false);ids.add(id);}
        for(const ref of svg.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g))assert.ok(local.has(ref[1]??ref[2]),'glow resources are local to each icon');
        assert.equal([...svg.matchAll(/class="item-temper-mote"/g)].length,enhancementFinish(weaponEnhancementRank(item))?.motes??0);
        assert.equal([...svg.matchAll(/class="item-temper-trail"/g)].length,enhancementFinish(weaponEnhancementRank(item))?.trails??0);
        for(const ref of svg.matchAll(/href="([^"]+)"/g))assert.ok(ref[1].startsWith('#'),'only local silhouette references');
        assert.ok(svg.includes(base.appearance.base)||svg.includes('<polygon'),'retain authored surfaces and silhouette');
      }
      assert.deepEqual(item,before,'rendering never mutates persisted gear');
    }
  }
});

test('only owned weapons project cosmetic ranks; armor keeps its normal art through tinting and hiding',()=>{
  const sim=new Simulation({blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})},{spawn:false});
  const p=sim.player,s=p.character;
  for(const [slot,rank] of [['weapon',10],['offhand',9],['chest',8],['gloves',7],['boots',6],['cloak',10],['head',9]] as const) {
    const kind=slot==='offhand'?'shield':slot;
    const base=generateItem(841,20,kind,kind==='weapon'?'longsword':undefined,'rare');
    s.equipped[slot]=deriveItem({...base,recipe:{...base.recipe,enhancement:rank}});
  }
  const original=structuredClone(s),outfit=outfitFromEquipment(s),pose=playerPose(p,0,null);
  assert.equal(pose.weaponEnhancement,10);assert.equal(pose.offHandEnhancement,0);
  for(const piece of Object.values(outfit))if(piece)assert.equal('enhancement' in piece,false);
  const tinted=tintedOutfit(outfit,{chest:'crimson'},false);
  assert.equal(tinted.head,null);
  assert.ok(tinted.chest&&!('enhancement' in tinted.chest));
  const full=characterBounds(pose),plain=characterBounds({...pose,weaponEnhancement:0,offHandEnhancement:0,outfit:{}});
  assert.ok(full.left<plain.left&&full.right>plain.right&&full.top<plain.top&&full.bottom>plain.bottom,'portrait framing reserves glow clearance');
  assert.deepEqual(s,original);
  // The off hand earns the same finish only when it holds an actual weapon.
  for(const kind of ['weapon','shield','grimoire','orb'] as const) {
    const base=generateItem(912,20,kind,kind==='weapon'?'cinder-wand':undefined,'rare');
    s.equipped.offhand=deriveItem({...base,recipe:{...base.recipe,enhancement:9}});
    assert.equal(playerPose(p,0,null).offHandEnhancement,kind==='weapon'?9:0);
  }
  s.equipped.weapon=null;s.equipped.offhand=null;s.equipped.chest=null;
  assert.equal(playerPose(p,0,null).weaponEnhancement,0);assert.equal(playerPose(p,0,null).offHandEnhancement,0);
  assert.equal(outfitFromEquipment(s).chest,null);assert.equal(outfitFromEquipment(s).shoulders,null);
});

test('Canvas glow is bounded, restores drawing state and handles deformed geometry',()=>{
  const shapes:GearShape[]=[{points:[[-2,-5],[2,-5],[2,5],[-2,5]],fill:'#789abc'}];
  const before=structuredClone(shapes),calls:number[][]=[];
  let saves=0,restores=0;
  const context={globalAlpha:1,save(){saves++;},restore(){restores++;},translate(...v:number[]){calls.push(v);},scale(...v:number[]){calls.push(v);},
    createRadialGradient(){return{addColorStop(){}};},fillRect(...v:number[]){calls.push(v);},beginPath(){},moveTo(...v:number[]){calls.push(v);},lineTo(...v:number[]){calls.push(v);},closePath(){},stroke(){}} as unknown as CanvasRenderingContext2D;
  drawEnhancementGlow(context,shapes,5);assert.equal(saves,0);
  drawEnhancementGlow(context,shapes,10,([x,y])=>[x+2,y*.5]);
  assert.equal(saves,restores);assert.equal(saves,2);
  assert.ok(calls.flat().every(Number.isFinite));assert.ok(calls.flat().every(v=>Math.abs(v)<=5));
  assert.deepEqual(shapes,before);
});


test('rank effects add bounded particle lanes and trails without random or accumulated state',()=>{
  let previousMotes=-1,previousTrails=-1;
  for(let rank=6;rank<=10;rank++) {
    const finish=enhancementFinish(rank)!;
    assert.ok(finish.motes>previousMotes&&finish.motes<=9);assert.ok(finish.trails>=previousTrails&&finish.trails<=3);
    previousMotes=finish.motes;previousTrails=finish.trails;
    for(let i=0;i<finish.motes;i++)for(const time of [0,.13,1.7,13,600]) {
      const mote=enhancementMote(i,time,finish.period);
      assert.ok(mote.x>=.1&&mote.x<=.9&&mote.y>=.17&&mote.y<=.87);
      assert.ok(mote.alpha>=0&&mote.alpha<=1);
      assert.deepEqual(enhancementMote(i,time,finish.period),mote,'frozen clocks reproduce the same frame');
      const loop=enhancementMote(i,time+finish.period,finish.period);
      assert.ok(Math.abs(loop.x-mote.x)<1e-10&&Math.abs(loop.y-mote.y)<1e-10,'no particles accumulate across cycles');
    }
  }
  assert.notDeepEqual(enhancementMote(1,.1,3.2),enhancementMote(1,1.5,3.2));
});

test('Canvas surface effects change with the supplied clock and freeze exactly for reduced motion',()=>{
  const shapes:GearShape[]=[{points:[[-2,-5],[2,-5],[2,5],[-2,5]],fill:'#789abc'}],before=structuredClone(shapes);
  function frame(rank:number,time:number) {
    const trace:unknown[][]=[],stack:number[]=[];
    const ctx={globalAlpha:.8,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop()!;},
      createLinearGradient(...args:number[]){trace.push(['gradient',...args]);return{addColorStop(...args:unknown[]){trace.push(['stop',...args]);}};},
      beginPath(){trace.push(['begin']);},clip(){trace.push(['clip']);},closePath(){trace.push(['close']);},
      moveTo(...args:number[]){trace.push(['move',...args]);},lineTo(...args:number[]){trace.push(['line',...args]);},
      fillRect(...args:number[]){trace.push(['fill',this.globalAlpha,...args]);},stroke(){trace.push(['stroke',this.globalAlpha]);}};
    drawEnhancementMotion(ctx as unknown as CanvasRenderingContext2D,shapes,rank,time);
    assert.equal(stack.length,0);assert.equal(ctx.globalAlpha,.8);
    assert.ok(trace.flat().filter(v=>typeof v==='number').every(Number.isFinite));
    return trace;
  }
  assert.deepEqual(frame(5,1),[]);
  assert.notDeepEqual(frame(10,.1),frame(10,1.7));
  assert.deepEqual(frame(10,0),frame(10,0));
  assert.ok(frame(10,1).length>frame(8,1).length&&frame(8,1).length>frame(6,1).length);
  assert.deepEqual(shapes,before);
});
