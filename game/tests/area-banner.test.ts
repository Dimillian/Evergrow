import test from 'node:test';
import assert from 'node:assert/strict';
import { AreaBanner, AreaNoticeTracker, areaThreat, areaLevelLabel, areaBannerOpacity, areaBannerLayout } from '../src/area-banner.ts';
const area = { id:'a', name:'Thorn Vale · Emberfall', level:18, maxLevel:35 };

test('area danger compares against the whole regional range, including boundaries and fixed-level dungeons',()=>{
  for(const [level,label] of [[36,'Outgrown'],[35,'Within range'],[18,'Within range'],[17,'Challenging'],[14,'Challenging'],[13,'Dangerous']] as const)
    assert.equal(areaThreat(area,level).label,label);
  assert.equal(areaThreat({level:18},19).label,'Outgrown');
  assert.equal(areaThreat({level:18},18).label,'Within range');
  assert.equal(areaLevelLabel(area),'Mobs Lv 18–35');
  assert.equal(areaLevelLabel({level:18}),'Mobs Lv 18');
});
test('one current area waits for celebrations, pauses, expires and discards stale destinations',()=>{
  const banner=new AreaBanner();banner.show(area);banner.update(1,false);assert.equal(banner.age,1);
  banner.update(20,true);assert.equal(banner.age,0);assert.equal(banner.notice?.id,'a');
  banner.update(0,false);assert.equal(banner.age,0);
  banner.retain('b');assert.equal(banner.notice,null);
  banner.show({...area,id:'b'});banner.update(4.7,false);assert.ok(banner.notice);
  banner.update(.11,false);assert.equal(banner.notice,null);
  banner.show(area);banner.clear();assert.equal(banner.notice,null);assert.equal(banner.age,0);
});
test('short border crossings do not announce; reset suppresses resume and can request a travel arrival',()=>{
  const tracker=new AreaNoticeTracker();tracker.reset('a');
  assert.equal(tracker.update('a',10),false);
  assert.equal(tracker.update('b',1),false);assert.equal(tracker.update('a',1),false);
  assert.equal(tracker.update('b',1.7),true);assert.equal(tracker.update('c',2),false);
  tracker.reset('');assert.equal(tracker.update('dungeon',1),false);assert.equal(tracker.update('dungeon',.7),true);
});
test('upper-quarter anchor and compact frame fit desktop, Thor and phone viewports',()=>{
  for(const [width,height] of [[1920,1080],[1280,720],[960,540],[800,360],[360,640],[640,280]]) {
    const layout=areaBannerLayout(width,height);
    assert.equal(layout.x,width/2);assert.equal(layout.y,height/8);
    assert.ok(layout.y-67*layout.vertical>=0,'upper brass remains inside viewport');
    assert.ok(layout.radius<width/2);assert.ok(layout.titleSize>=20);assert.ok(layout.smallSize>=12);
  }
  assert.equal(areaBannerOpacity(0),0);assert.equal(areaBannerOpacity(.8),1);
  assert.equal(areaBannerOpacity(3.6),1);assert.ok(areaBannerOpacity(4.2)>0);assert.equal(areaBannerOpacity(4.8),0);
});
