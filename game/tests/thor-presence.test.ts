import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ThorNative } from '../src/thor-native.ts';
import { thorSnapshot } from '../src/thor-state.ts';
import { initialPlayer } from '../src/simulation.ts';
import { freshJourneys } from '../src/journey-state.ts';
import { isGameUIPoint } from '../src/ui-hit-test.ts';
import { getMinimapRect, getPortalControlRect } from '../src/map-view.ts';

test('companion transport availability is sampled at telemetry cadence and recovers after loss', t=>{
  const old=Object.getOwnPropertyDescriptor(globalThis,'window');
  const win=new EventTarget();Object.defineProperty(globalThis,'window',{value:win,configurable:true});
  t.after(()=>{if(old)Object.defineProperty(globalThis,'window',old);else Reflect.deleteProperty(globalThis,'window');});
  let available=false,polls=0,published=0;
  Object.assign(win,{EvergrowAndroid:{hasCompanion:()=>{polls++;return available;},publish:()=>published++}});
  const player=initialPlayer(0,0);
  const bridge=new ThorNative({snapshot:()=>thorSnapshot({player,journeys:freshJourneys()},'a','A','playing','Deadwood',1,null),
    command:()=>{},background:()=>{},foreground:()=>{},back:()=>{}});

  bridge.update(0);assert.equal(published,0);
  available=true;bridge.update(249);assert.equal(polls,1);
  bridge.update(250);assert.equal(published,1);
  available=false;bridge.update(500);assert.equal(published,1);
  available=true;bridge.update(750);assert.equal(published,2);
  bridge.dispose();
  Reflect.deleteProperty(win,'EvergrowAndroid');
  const browser=new ThorNative({snapshot:()=>{throw new Error('No native bridge');},command:()=>{},background:()=>{},foreground:()=>{},back:()=>{}});
  browser.update(1000);browser.dispose();
});
test('map, portal and quest log share one navigation hit region visibility',()=>{
  const width=900,height=600,map=getMinimapRect(width,height),portal=getPortalControlRect(width,height);
  assert.equal(isGameUIPoint(map.x+20,map.y+30,width,height,null,true),true);
  assert.equal(isGameUIPoint(map.x+20,map.y+30,width,height,null,false),false);
  assert.equal(isGameUIPoint(portal.x+10,portal.y+10,width,height,null,true),true);
  assert.equal(isGameUIPoint(portal.x+10,portal.y+10,width,height,null,false),false);
  const log={x:map.x,y:portal.y+portal.height,width:map.width,height:80};
  assert.equal(isGameUIPoint(log.x+10,log.y+20,width,height,log,true),true);
  assert.equal(isGameUIPoint(log.x+10,log.y+20,width,height,log,false),false);
});
test('native companion allowlist forwards tab presence alongside gameplay commands',()=>{
  const source=readFileSync(new URL('../../android/app/src/main/java/com/dimillian/evergrow/MainActivity.kt',import.meta.url),'utf8');
  const allowed=source.match(/parsed\.optString\("type"\) !in setOf\(([^)]+)\)/)?.[1];assert.ok(allowed);
  for(const type of ['tab','panel','inspect','equip','zoom','resume','portal','track','closeInspect'])
    assert.ok(allowed.includes(`"${type}"`),`${type} must reach the typed command parser`);
});
