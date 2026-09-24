import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ThorNative } from '../src/thor-native.ts';
import { thorSnapshot } from '../src/thor-state.ts';
import { initialPlayer } from '../src/simulation.ts';
import { freshJourneys } from '../src/journey-state.ts';
import { isGameUIPoint } from '../src/ui-hit-test.ts';
import { getMinimapRect, getJourneyLogAnchor } from '../src/map-view.ts';

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
test('right-side map and Journey log share visibility while their gap remains world input',()=>{
  for(const [width,height] of [[540,450],[900,600],[1600,680]]){
    const map=getMinimapRect(width,height),log={...getJourneyLogAnchor(width,height),height:80};
    assert.equal(map.x+map.width,log.x+log.width,'both modules align to the right edge');
    assert.ok(log.y-map.y-map.height>=20,'the modules have a visible gap');
    assert.equal(isGameUIPoint(map.x+20,map.y+30,width,height,log,true),true);
    assert.equal(isGameUIPoint(map.x+20,map.y+30,width,height,log,false),false);
    assert.equal(isGameUIPoint(log.x+10,log.y+20,width,height,log,true),true);
    assert.equal(isGameUIPoint(log.x+10,log.y+20,width,height,log,false),false);
    for(const x of [map.x+1,map.x+map.width/2,map.x+map.width-1])
      assert.equal(isGameUIPoint(x,(map.y+map.height+log.y)/2,width,height,log,true),false,'no invisible portal control remains');
    assert.equal(isGameUIPoint(log.x+10,log.y+20,width,height,null,true),false,'a hidden log does not reserve space');
  }
});
test('native companion allowlist forwards tab presence alongside gameplay commands',()=>{
  const source=readFileSync(new URL('../../android/app/src/main/java/com/dimillian/evergrow/MainActivity.kt',import.meta.url),'utf8');
  const allowed=source.match(/parsed\.optString\("type"\) !in setOf\(([^)]+)\)/)?.[1];assert.ok(allowed);
  for(const type of ['tab','panel','inspect','equip','zoom','resume','portal','track','closeInspect'])
    assert.ok(allowed.includes(`"${type}"`),`${type} must reach the typed command parser`);
});
