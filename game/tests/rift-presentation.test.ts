import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { drawRiftHUD } from '../src/rift-hud.ts';
import { createDungeonRun } from '../src/dungeon-state.ts';
import { generateDungeon } from '../src/dungeon.ts';
import { MAP_LEGEND_GROUPS, MapIconVisibility } from '../src/map-legend-content.ts';
const css=registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'',shortCircuit:true}:next(url,context);}});
const {DungeonMap}=await import('../src/dungeon-map.ts');css.deregister();
const entrance={id:'test',name:'Test',seed:7319,level:30,biome:'verdant' as const,x:0,y:0,rift:{attempt:1}};

test('rift HUD waits for the reward claim before showing completion and retains victory time',()=>{
 const run=createDungeonRun(entrance);run.rift!.elapsed=274.9;run.rift!.points=600;
 const labels:string[]=[];
 const context=new Proxy({getTransform:()=>({a:1,b:0,c:0,d:1,e:0,f:0}),measureText:()=>({width:30}),fillText:(s:string)=>labels.push(s)},{get:(o,k)=>Reflect.get(o,k)??(()=>{})}) as unknown as CanvasRenderingContext2D;
 run.rift!.phase='hunt';drawRiftHUD(context,run,1100);assert.ok(labels.includes('5:26'));
 labels.length=0;run.rift!.phase='complete';drawRiftHUD(context,run,1100);
 assert.ok(labels.includes('4:34'));assert.ok(!labels.includes('5:26'));assert.ok(labels.includes('REWARD WAITING'));assert.ok(labels.includes('CLAIM THE RIFT CHEST'));assert.ok(!labels.includes('RIFT COMPLETE'));
 labels.length=0;run.rift!.claimed=true;drawRiftHUD(context,run,1100);assert.ok(labels.includes('RIFT COMPLETE'));assert.ok(labels.includes('RETURN TO TOWN'));assert.ok(labels.includes('4:34'));
 labels.length=0;run.rift!.phase='failed';drawRiftHUD(context,run,1100);assert.ok(labels.includes('RETURNING TO TOWN'));
});

test('rift portal hover uses CSS-pixel coordinates and respects the new shared legend filter',()=>{
 const floor=generateDungeon(7319,30),run=createDungeonRun(entrance);
 run.explored=floor.rooms.map(r=>r.id);run.rift!.phase='complete';run.rift!.exit={x:50000,y:50000};
 const visibility=new MapIconVisibility();
 assert.ok(MAP_LEGEND_GROUPS.flatMap(g=>g.entries).some(e=>e.id==='dungeon:riftPortal'));
 const tooltip={hidden:true,textContent:'',style:{},offsetWidth:150,offsetHeight:30};
 const map=Object.assign(Object.create(DungeonMap.prototype),{floor,run,iconVisibility:visibility,tooltip,center:{x:50000,y:50000},zoom:.2,canvas:{getBoundingClientRect:()=>({left:100,top:50,width:600,height:400})}});
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{configurable:true,value:{innerWidth:1200,innerHeight:800}});
 try {
   map.hover(400,250);assert.equal(tooltip.hidden,false);assert.equal(tooltip.textContent,'Rift Portal · Return to town');
   visibility.set(['dungeon:riftPortal'],false);map.hover(400,250);assert.equal(tooltip.hidden,true);
   visibility.set(['dungeon:riftPortal'],true);map.hover(400,250);assert.equal(tooltip.hidden,false);
 } finally {if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});
