import test from 'node:test';
import assert from 'node:assert/strict';
import { JourneyHUDPreferences, DEFAULT_JOURNEY_HUD, JOURNEY_HUD_STORAGE_KEY } from '../src/journey-hud-settings.ts';
import { freshJourneys, miniJourneys, type JourneyGoal } from '../src/journey-state.ts';
const goal=(id:string,level:number,x:number):JourneyGoal=>({id,name:id,level,x,y:0,kind:'camp',region:'Forest'});

test('HUD preferences persist on the device, reject invalid updates and tolerate unavailable storage',()=>{
  const stored=new Map<string,string>();const storage={getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>{stored.set(key,value);}};
  const prefs=new JourneyHUDPreferences(storage);
  assert.deepEqual(prefs.settings,DEFAULT_JOURNEY_HUD);
  assert.equal(prefs.update({visible:false,count:8,sort:'distance'}),'saved');
  assert.deepEqual(new JourneyHUDPreferences(storage).settings,{visible:false,count:8,sort:'distance'});
  for(const patch of [{count:0},{count:9},{count:1.5},{count:NaN},{sort:'random' as never},{visible:null as never}])assert.equal(prefs.update(patch),'invalid');
  assert.deepEqual(new JourneyHUDPreferences(storage).settings,prefs.settings,'invalid choices cannot overwrite the stored settings');
  stored.set(JOURNEY_HUD_STORAGE_KEY,'{"count":999}');assert.deepEqual(new JourneyHUDPreferences(storage).settings,DEFAULT_JOURNEY_HUD);
  stored.set(JOURNEY_HUD_STORAGE_KEY,'{');assert.deepEqual(new JourneyHUDPreferences(storage).settings,DEFAULT_JOURNEY_HUD);
  const blocked=new JourneyHUDPreferences({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
  assert.equal(blocked.update({count:5,sort:'level'}),'session');assert.equal(blocked.settings.count,5);
});

test('HUD sorting is stable, keeps a pin first, respects count and leaves quest state untouched',()=>{
  const state=freshJourneys();state.accepted=[goal('first',8,100),goal('second',3,300),goal('third',3,50),goal('pinned',9,500),{...goal('done',1,0),finishedAt:1}];state.tracked='pinned';
  const before=structuredClone(state);
  const ids=(sort:'accepted'|'level'|'distance',count=3,position={x:0,y:0})=>miniJourneys(state,{visible:true,count,sort},position).map(g=>g.id);
  assert.deepEqual(ids('accepted'),['pinned','first','second']);
  assert.deepEqual(ids('level',8),['pinned','second','third','first'],'equal levels retain acceptance order');
  assert.deepEqual(ids('distance'),['pinned','third','first']);
  assert.deepEqual(ids('distance',3,{x:350,y:0}),['pinned','second','first'],'moving changes distance order');
  assert.deepEqual(ids('level',1),['pinned']);
  assert.deepEqual(miniJourneys(state,{visible:false,count:8,sort:'level'}),[]);
  assert.deepEqual(state,before,'sort and hide never mutate acceptance or navigation');
  state.tracked=null;assert.deepEqual(ids('level',2),['second','third'],'sorting does not create a pin');
  assert.equal(state.tracked,null);
});
