import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { bindArmorTintPrompt } from '../src/armor-tint-prompt.ts';
import { GamepadInput, PAD } from '../src/gamepad-input.ts';
import { ARMOR_TINTS } from '../src/appearance-armor-content.ts';

// Event/focus boundary only: exercise production gesture code without a browser or gameplay.
function setup(t:TestContext) {
  const doc=Object.assign(new EventTarget(),{activeElement:null as NodeElement|null,hidden:false});
  class NodeElement extends EventTarget {
    id='';dataset:Record<string,string>={};disabled=false;hidden=false;inert=false;tabIndex=0;clicks=0;
    parent:NodeElement|null=null;children:NodeElement[]=[];className='';innerHTML='';
    classList={add:(_s:string)=>{},remove:(_s:string)=>{}};
    append(child:NodeElement){child.parent=this;this.children.push(child);}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
    querySelector(selector:string):NodeElement|null {
      if(selector==='.editor-shell')return this.children.find(c=>c.className==='editor-shell')??null;
      const key=selector.startsWith('#')?selector.slice(1):selector.replace(/[\[\]]/g,'');
      return this.children.find(c=>c.id===key)??null;
    }
    querySelectorAll():NodeElement[]{return this.children.flatMap(c=>c.children.length?c.querySelectorAll():[c]);}
    closest(selector:string):NodeElement|null {
      if(selector.includes('[hidden]'))return this.hidden||this.inert?this:this.parent?.closest(selector)??null;
      return this.dataset.tint||this.id==='original-color'?this:null;
    }
    matches(selector:string){return selector===':disabled'?this.disabled:false;}
    getClientRects(){return this.hidden?[]:[1];}
    contains(el:NodeElement|null):boolean{return !!el&&(el===this||this.children.some(c=>c.contains(el)));}
    focus(){doc.activeElement=this;}
    scrollIntoView(){}
    click(){this.clicks++;this.dispatchEvent(new Event('click',{cancelable:true}));}
  }
  class Select extends NodeElement {}
  class Canvas extends NodeElement {}
  class Key extends Event {key:string;constructor(type:string,options:{key?:string}={}){super(type,{cancelable:true});this.key=options.key??'';}}
  const win=new EventTarget();
  const document=Object.assign(doc,{createElement:()=>{
    const overlay=new NodeElement();
    for(const id of ['all-tint-message','data-tint-cancel','data-tint-apply']){const child=new NodeElement();child.id=id;overlay.append(child);}
    return overlay;
  }});
  const globals={document,window:win,Element:NodeElement,HTMLElement:NodeElement,HTMLSelectElement:Select,HTMLCanvasElement:Canvas,KeyboardEvent:Key};
  for(const [key,value]of Object.entries(globals)){
    const old=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>{if(old)Object.defineProperty(globalThis,key,old);else Reflect.deleteProperty(globalThis,key);});
  }
  t.mock.timers.enable({apis:['setTimeout']});
  const root=new NodeElement(),shell=new NodeElement();shell.className='editor-shell';root.append(shell);
  const buttons=[...ARMOR_TINTS.map(c=>c.id),'original'].map(id=>{const b=new NodeElement();if(id==='original')b.id='original-color';else b.dataset.tint=id;shell.append(b);return b;});
  const applied:string[]=[],tabs:number[]=[];let available=true;
  const input=bindArmorTintPrompt(root as unknown as HTMLElement,()=>available,c=>applied.push(c),d=>tabs.push(d));
  t.after(()=>input.dispose());
  const overlay=root.children[1],confirm=overlay.querySelector('[data-tint-apply]')!,cancel=overlay.querySelector('[data-tint-cancel]')!;
  const pointer=(type:string,target=buttons[0],options:Record<string,unknown>={})=>{
    const event=new Event(type,{cancelable:true});
    for(const [key,value]of Object.entries({target,pointerId:1,isPrimary:true,button:0,clientX:10,clientY:10,detail:1,...options}))Object.defineProperty(event,key,{value});
    root.dispatchEvent(event);return event;
  };
  const pad=new GamepadInput();
  const update=(held:number[],pressed:number[],now:number)=>{pad.held.clear();pad.pressed.clear();held.forEach(b=>pad.held.add(b));pressed.forEach(b=>pad.pressed.add(b));input.updateGamepad(pad,now);};
  return {root,doc,win,shell,buttons,overlay,confirm,cancel,applied,tabs,input,pointer,update,setAvailable:(v:boolean)=>available=v};
}

test('every palette swatch including original opens a confirmation; cancellation never applies all',t=>{
  const f=setup(t);
  for(const [i,button]of f.buttons.entries()){
    f.pointer('dblclick',button);assert.equal(f.overlay.hidden,false);assert.equal(f.shell.inert,true);
    assert.equal(f.doc.activeElement,f.cancel);assert.equal(f.input.cancel(),true);assert.equal(f.input.cancel(),false);
    assert.deepEqual(f.applied,[]);assert.equal(f.doc.activeElement,button);
    if(i===f.buttons.length-1){f.pointer('dblclick',button);f.confirm.click();assert.deepEqual(f.applied,['original']);}
  }
});

test('touch hold waits 650 ms, suppresses release click and requires a separate confirmation',t=>{
  const f=setup(t);f.pointer('pointerdown',f.buttons[7]);
  f.pointer('focusout',f.buttons[0],{relatedTarget:f.buttons[7]});
  t.mock.timers.tick(649);assert.equal(f.overlay.hidden,true);
  t.mock.timers.tick(1);assert.equal(f.overlay.hidden,false);assert.deepEqual(f.applied,[]);
  assert.equal(f.pointer('click').defaultPrevented,true);t.mock.timers.tick(1000);assert.deepEqual(f.applied,[]);
  f.pointer('pointerdown',f.confirm);f.confirm.click();assert.deepEqual(f.applied,['teal']);
});

test('scroll, drag, release, cancellation, focus loss and disposal abort touch holds',t=>{
  const f=setup(t);
  for(const stop of [()=>f.pointer('pointermove',f.buttons[0],{clientX:30}),()=>f.root.dispatchEvent(new Event('scroll')),()=>f.win.dispatchEvent(new Event('pointerup')),()=>f.win.dispatchEvent(new Event('pointercancel')),()=>f.win.dispatchEvent(new Event('blur')),()=>f.root.dispatchEvent(new Event('focusout'))]){
    f.pointer('pointerdown');stop();t.mock.timers.tick(700);assert.equal(f.overlay.hidden,true);
  }
  f.pointer('pointerdown');f.input.dispose();t.mock.timers.tick(700);assert.deepEqual(f.applied,[]);
});

test('controller hold opens once, cannot auto-confirm, cancels on release/focus loss and supports shoulder tabs',t=>{
  const f=setup(t);f.buttons[7].focus();
  f.update([PAD.interact],[PAD.interact],0);f.update([PAD.interact],[],649);assert.equal(f.overlay.hidden,true);
  f.update([PAD.interact],[],650);assert.equal(f.overlay.hidden,false);
  f.update([PAD.interact],[],2000);assert.deepEqual(f.applied,[]);assert.equal(f.overlay.hidden,false);
  f.input.cancel();f.update([],[],2100);f.buttons[0].focus();
  f.update([PAD.interact],[PAD.interact],2200);f.update([],[],2250);f.update([PAD.interact],[],3000);assert.equal(f.overlay.hidden,true);
  f.update([PAD.interact],[PAD.interact],3100);f.buttons[1].focus();f.update([PAD.interact],[],3800);assert.equal(f.overlay.hidden,true);
  f.update([PAD.skill2],[PAD.skill2],4000);assert.deepEqual(f.tabs,[1]);
  f.update([PAD.potion],[PAD.potion],4100);assert.deepEqual(f.tabs,[1,-1]);
  f.setAvailable(false);f.pointer('dblclick');assert.equal(f.overlay.hidden,true);
});
