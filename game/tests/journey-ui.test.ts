import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { freshJourneys, planJourney, type JourneyGoal } from '../src/journey-state.ts';
import { freshEvents } from '../src/poi-content.ts';
import { freshExpeditions } from '../src/dungeon-state.ts';
import { JourneyHUDPreferences } from '../src/journey-hud-settings.ts';
const css=registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'',shortCircuit:true}:next(url,context);}});
const {JourneyPanel}=await import('../src/journey-panel.ts');
const {JourneyController}=await import('../src/journey-controller.ts');
css.deregister();

/** Event surfaces exercise the production journal without starting a browser or game. */
class Surface extends EventTarget {
  hidden=false;innerHTML='';className='';scrollTop=0;tabIndex=0;isConnected=true;
  dataset:Record<string,string>={};style:Record<string,string>={};parent:Surface|null=null;
  classList={toggle(){}};attributes=new Map<string,string>();children:Surface[]=[];
  ownerDocument!:Surface & {activeElement:Surface|null;defaultView:{getComputedStyle:()=>{visibility:string}}};
  sections=new Map<string,Surface>();
  get parentElement(){return this.parent;}
  append(child:Surface){if(child.parent)child.parent.children=child.parent.children.filter(c=>c!==child);child.parent=this;this.children.push(child);}
  remove(){}
  setAttribute(k:string,v:string){this.attributes.set(k,v);}
  hasAttribute(k:string){return this.attributes.has(k);}
  removeAttribute(k:string){this.attributes.delete(k);}
  matches(){return false;}
  closest(){return null;}
  contains(node:unknown):boolean{return node===this||this.children.some(c=>c.contains(node));}
  getClientRects(){return [{}];}
  getBoundingClientRect(){return {top:100,bottom:600,left:0,right:900,width:900,height:500};}
  focus(){this.ownerDocument.activeElement=this;}
  blur(){if(this.ownerDocument.activeElement===this)this.ownerDocument.activeElement=null;}
  querySelector(selector:string){
    if(!['.journey-list','.journey-detail','.journey-window','[data-hud-popup]','[data-hud-preview]','[data-action="hudSettings"]','[data-hud-field="visible"]','[data-hud-field="sort"]'].includes(selector))return null;
    if(!this.sections.has(selector)){const s=new Surface();s.ownerDocument=this.ownerDocument;this.sections.set(selector,s);}
    return this.sections.get(selector)!;
  }
  querySelectorAll(selector:string){return selector==='.journey-list,.journey-detail'?[...this.sections.values()]:[];}
}
const goal=(id:string):JourneyGoal=>({id,name:`Quest ${id}`,kind:'camp',level:3,x:500,y:100,region:'Forest'});

test('Area journal buttons separate acceptance from pinning and preserve selected details after map inspection',async t=>{
  const originals=new Map(['document','CSS'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const doc=Object.assign(new Surface(),{activeElement:null as Surface|null,defaultView:{getComputedStyle:()=>({visibility:'visible'})},createElement:()=>{const s=new Surface();s.ownerDocument=doc;return s;}});
  Object.defineProperty(globalThis,'document',{value:doc,configurable:true});
  Object.defineProperty(globalThis,'CSS',{value:{escape:(s:string)=>s},configurable:true});
  t.after(()=>{for(const [key,value]of originals){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}});
  let state=freshJourneys();state.offers=Array.from({length:8},(_,i)=>goal(String(i)));state.recommended='3';
  state.history=Array.from({length:80},(_,i)=>({...goal(`done:${i}`),finishedAt:i}));
  const facts={x:0,y:0,level:3,time:100,events:freshEvents(),expeditions:freshExpeditions(),discovered:()=>true,campCleared:()=>false};
  const mount=doc.createElement();let mapId:string|undefined;let commands=0;
  const stored=new Map<string,string>();const preferences=new JourneyHUDPreferences({getItem:key=>stored.get(key)??null,setItem:(key,value)=>{stored.set(key,value);}});
  const panel=new JourneyPanel(mount as unknown as HTMLElement,mount as unknown as HTMLElement,{
    open:id=>panel.open(id),close:()=>panel.close(),map:id=>{mapId=id;panel.close();},command:command=>{
      commands++;
      const next=planJourney(state,command);assert.ok(next);state=next;
      panel.update(state,facts,false,960,600);return true;
    },
  },preferences);t.after(()=>panel.dispose());
  panel.update(state,facts,false,960,600);panel.open('3');
  async function click(dataset:Record<string,string>,mini=false){
    const event=new Event('click');const button=Object.assign(doc.createElement(),{dataset,disabled:false});
    if(mini)button.focus();
    Object.defineProperty(event,'target',{value:{closest:()=>button}});
    (mini?panel.mini:panel.element).dispatchEvent(event);
    if(mini)assert.notEqual(doc.activeElement,button,'live HUD actions release button focus before the save finishes');
    await Promise.resolve();await Promise.resolve();
  }
  assert.match(panel.element.innerHTML,/80 of 88 known activities completed/);
  assert.ok(panel.element.innerHTML.includes('Quest done:0'),'old completion remains visible');
  const emptyHint='Accept quests in the Journal &lt;J&gt; to track them.';
  assert.ok(panel.mini.innerHTML.includes(emptyHint));
  assert.ok(!panel.mini.innerHTML.includes('data-goal='),'recommendations stay out of the empty HUD');
  panel.close();panel.update(state,facts,true,960,600);
  await click({collapse:''},true);assert.ok(!panel.mini.innerHTML.includes(emptyHint),'collapsed HUD hides the empty message');
  await click({collapse:''},true);assert.ok(panel.mini.innerHTML.includes(emptyHint));
  panel.open('3');
  await click({action:'track'});assert.equal(state.tracked,'3');assert.equal(state.accepted.length,0);
  await click({action:'accept'});assert.equal(state.accepted[0].id,'3');assert.match(panel.element.innerHTML,/>Dismiss<\/button>/);
  assert.ok(!panel.mini.innerHTML.includes(emptyHint));assert.ok(panel.mini.innerHTML.includes('data-goal="3"'));
  panel.close();panel.update(state,facts,true,960,600);
  await click({pin:'3'},true);assert.equal(state.tracked,null);
  assert.ok(!panel.mini.innerHTML.includes('journey-mini-row is-tracked'),'accepted quests are not automatically highlighted');
  await click({pin:'3'},true);assert.equal(state.tracked,'3');
  assert.ok(panel.mini.innerHTML.includes('journey-mini-row is-tracked'),'only explicit pinning highlights the row');
  panel.open('3');
  await click({action:'dismiss'});assert.equal(state.accepted.length,0);assert.ok(state.offers.some(g=>g.id==='3'));
  assert.ok(panel.mini.innerHTML.includes(emptyHint),'dismissing the last accepted quest restores the message');
  await click({action:'acceptAll'});assert.equal(state.accepted.length,8);assert.equal(state.offers.length,0);
  await click({action:'map'});assert.equal(mapId,'3');assert.equal(panel.element.hidden,true);
  panel.open(mapId);assert.match(panel.element.innerHTML,/<h3>Quest 3<\/h3>/);
  await click({select:'done:0',town:'false'});assert.match(panel.element.innerHTML,/<h3>Quest done:0<\/h3>/);
  assert.ok(!panel.element.innerHTML.includes('data-action="accept"'),'completed details cannot be reaccepted');
  assert.ok(!panel.element.innerHTML.includes('data-action="dismiss"'),'completion cannot be dismissed');
  await click({action:'map'});assert.equal(mapId,'done:0');panel.open(mapId);
  assert.match(panel.element.innerHTML,/<h3>Quest done:0<\/h3>/);
  state.accepted.forEach((g,i)=>{g.x=(8-i)*100;g.y=0;g.level=i+1;});
  state.collapsed=true;
  panel.update(state,facts,false,960,600);
  assert.equal(panel.mini.hidden,true,'the journal normally hides the HUD');
  const before=structuredClone(state),beforeCommands=commands;
  await click({action:'hudSettings'});
  assert.equal(panel.mini.hidden,false,'opening settings reveals the actual HUD while paused');
  assert.equal(panel.mini.inert,true,'the preview cannot steal focus or mutate quests');
  const hudIds=()=>[...panel.mini.innerHTML.matchAll(/data-goal="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(hudIds().length,3,'a collapsed tracker expands for preview without changing its saved state');
  panel.setHUDVisibility(false);assert.equal(panel.mini.hidden,false,'the runtime paused-phase update preserves the preview');
  assert.equal(panel.element.querySelector<HTMLElement>('[data-hud-popup]')!.hidden,false);
  await click({hudCount:'1'});assert.equal(preferences.settings.count,4);
  assert.equal(hudIds().length,4,'count changes repaint immediately without a game tick');
  const change=(dataset:Record<string,string>,value:unknown)=>{
    const event=new Event('change');Object.defineProperty(event,'target',{value:{dataset,value,checked:value}});panel.element.dispatchEvent(event);
  };
  change({hudField:'sort'},'distance');assert.equal(preferences.settings.sort,'distance');
  assert.deepEqual(hudIds(),['3','7','6','5'],'sorting repaints immediately, keeping the pin first');
  change({hudField:'visible'},false);
  assert.equal(panel.mini.hidden,true);assert.equal(panel.bounds(960,600),null);
  assert.equal(panel.hudVisible,false);
  const escape=Object.assign(new Event('keydown',{cancelable:true}),{key:'Escape'});panel.element.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented,true);assert.equal(panel.element.hidden,false,'Escape closes settings before the journal');
  assert.equal(panel.element.querySelector<HTMLElement>('[data-hud-popup]')!.hidden,true);
  await click({action:'hudSettings'});change({hudField:'visible'},true);
  assert.equal(panel.mini.hidden,false,'show HUD restores the preview immediately');
  assert.equal((panel.mini.innerHTML.match(/data-goal=/g)??[]).length,4);
  panel.update(state,facts,false,700,600);
  assert.equal(panel.mini.parentElement,panel.element.querySelector('[data-hud-preview]'),'narrow screens put the same HUD inside the popup');
  await click({hudCount:'1'});assert.equal(hudIds().length,5,'inline preview survives a settings rerender');
  await click({hudCount:'-1'});
  await click({hudClose:''});assert.equal(panel.mini.hidden,true);
  assert.equal(panel.mini.parentElement,mount,'closing settings restores the original HUD mount');
  assert.equal(panel.mini.inert,false);
  panel.close();panel.update(state,facts,true,960,600);
  assert.equal(panel.mini.hidden,false);assert.equal(hudIds().length,0,'gameplay restores the original collapsed state');
  assert.deepEqual(state,before);assert.equal(commands,beforeCommands,'HUD settings do not submit character commands');
  assert.equal(new JourneyHUDPreferences({getItem:key=>stored.get(key)??null,setItem(){}}).settings.count,4);
});

test('Show on Map resolves completed records and preserves the return selection',()=>{
  const state=freshJourneys(),g={...goal('old'),finishedAt:2};state.history=[g];
  const calls:string[]=[],targets:unknown[]=[];
  const controller=Object.assign(Object.create(JourneyController.prototype),{
    host:{savingAction:false,sim:{journeys:state,expeditions:freshExpeditions(),dungeonFloor:null},panels:{transition:(phase:string)=>calls.push(phase)},worldMap:{focusJourney:(target:unknown)=>targets.push(target)}},
    facts:()=>({discovered:()=>false}),
  });
  controller.showMap(g.id);
  assert.equal(controller.selected,g.id);assert.deepEqual(calls,['map']);
  assert.deepEqual(targets,[{x:g.x,y:g.y,known:true,name:g.name}]);
});

test('surface activity inspection underground switches to surface coordinates before focusing',()=>{
  const state=freshJourneys(),g=goal('surface');state.offers=[g];
  const expeditions=freshExpeditions();expeditions.surfaceX=800;expeditions.surfaceY=900;
  const calls:unknown[]=[];
  const controller=Object.assign(Object.create(JourneyController.prototype),{
    host:{savingAction:false,sim:{journeys:state,expeditions,dungeonFloor:{}},panels:{transition:(phase:string)=>calls.push(phase)},
      dungeonMap:{close:()=>calls.push('close dungeon')},worldMap:{open:(p:unknown)=>calls.push(p),focusJourney:(target:unknown)=>calls.push(target)}},
    facts:()=>({discovered:()=>true}),
  });
  controller.showMap(g.id);
  assert.deepEqual(calls,['map','close dungeon',{x:800,y:900,angle:0},{x:g.x,y:g.y,known:true,name:g.name}]);
});
