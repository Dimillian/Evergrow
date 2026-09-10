import test from 'node:test';
import assert from 'node:assert/strict';
import { DungeonLightEffects } from '../src/dungeon-light-effects.ts';
import { PostFX } from '../src/postfx.ts';
import { cameraView } from '../src/camera.ts';
import type { DungeonFloor } from '../src/dungeon.ts';

test('dungeon detail reuses masks while flickering, follows camera and light movement, and restores lost contexts', t => {
  const descriptors = ['document','Path2D'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)] as const);
  t.after(()=>{for(const [name,value] of descriptors)if(value)Object.defineProperty(globalThis,name,value);else Reflect.deleteProperty(globalThis,name);});
  const uploads: {unit:number;allocate:boolean}[]=[],uniforms:Record<string,number>={},handlers=new Map<string,(event:{preventDefault():void})=>void>();
  let unit=0;
  const gl=new Proxy({TEXTURE0:100,TEXTURE1:101,COMPILE_STATUS:1,LINK_STATUS:2,
    activeTexture:(n:number)=>{unit=n-100;},createShader:()=>({}),createProgram:()=>({}),createTexture:()=>({}),createBuffer:()=>({}),
    getShaderParameter:()=>true,getProgramParameter:()=>true,isContextLost:()=>false,getUniformLocation:(_:unknown,n:string)=>n,
    uniform1f:(n:string,v:number)=>{uniforms[n]=v;},texImage2D:()=>uploads.push({unit,allocate:true}),texSubImage2D:()=>uploads.push({unit,allocate:false}),
  },{get:(o,k)=>k in o?Reflect.get(o,k):()=>{}});
  const context=new Proxy({},{get:()=>()=>{}}),canvases:{width:number;height:number}[]=[];
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>{
    const canvas={width:1,height:1,getContext:(type:string)=>type==='2d'?context:gl,addEventListener:(name:string,callback:(event:{preventDefault():void})=>void)=>handlers.set(name,callback)};canvases.push(canvas);return canvas;
  }}});
  Object.defineProperty(globalThis,'Path2D',{configurable:true,value:class{moveTo(){}lineTo(){}closePath(){}}});
  const effects=new DungeonLightEffects(),view=cameraView(1440,900,0,0,1);
  const floor: DungeonFloor={seed:2,rooms:[{id:0,x:-400,y:-300,width:800,height:600,kind:'entry'}],corridors:[],edges:[],members:[],entry:{x:0,y:0},exit:{x:100,y:0},chests:[]};
  const light={x:0,y:0,radius:220,color:'#ff9900',power:1,clip:[{x:-80,y:-80},{x:80,y:-80},{x:80,y:80},{x:-80,y:80}]};
  const prepare=(time=0,reduced=false,v=view,l=light)=>effects.prepare(floor,v,[l],time,reduced,1440,900);
  assert(prepare());assert.deepEqual(uploads,[{unit:0,allocate:true},{unit:1,allocate:true}]);
  assert.equal(canvases[0].width,640);assert.equal(canvases[0].height,400);
  uploads.length=0;assert(prepare(4,false,view,{...light,power:.8}));assert.deepEqual(uploads,[],'flicker only changes uniforms');
  assert.equal(uniforms.time,4);prepare(20,true);assert.equal(uniforms.time,0,'reduced motion freezes procedural air');
  uploads.length=0;prepare(5,false,{...view,left:view.left+1});assert.deepEqual(uploads,[{unit:0,allocate:false}]);
  uploads.length=0;prepare(6,false,{...view,left:view.left+1},{...light,x:1});assert.deepEqual(uploads,[{unit:1,allocate:false}],'a moving light updates even if its quantized visibility fan is reused');
  effects.draw(context as CanvasRenderingContext2D,view,false);assert.equal(uniforms.mode,0);
  effects.draw(context as CanvasRenderingContext2D,view,true);assert.equal(uniforms.mode,1);
  handlers.get('webglcontextlost')!({preventDefault(){}});assert.equal(prepare(),false);
  handlers.get('webglcontextrestored')!({preventDefault(){}});uploads.length=0;assert(prepare());assert.equal(uploads.filter((u:{unit:number;allocate:boolean})=>u.allocate).length,2);
  effects.reset();uploads.length=0;assert(prepare());assert.equal(uploads.filter((u:{unit:number;allocate:boolean})=>u.allocate).length,2);
});

test('selective bloom resets on dungeon exit and releases its additional texture', () => {
  let unit=0,selective=-1,deleted=0;
  const handlers=new Map<string,(event:{preventDefault():void})=>void>(),uploads:{unit:number;allocate:boolean}[]=[];
  const gl=new Proxy({TEXTURE0:100,TEXTURE1:101,TEXTURE2:102,FRAMEBUFFER_COMPLETE:4,
    activeTexture:(n:number)=>{unit=n-100;},createShader:()=>({}),createProgram:()=>({}),createTexture:()=>({}),createBuffer:()=>({}),createFramebuffer:()=>({}),
    getShaderParameter:()=>true,getProgramParameter:()=>true,isContextLost:()=>false,checkFramebufferStatus:()=>4,getUniformLocation:(_:unknown,n:string)=>n,
    uniform1f:(n:string,v:number)=>{if(n==='u_selective')selective=v;},texImage2D:()=>uploads.push({unit,allocate:true}),texSubImage2D:()=>uploads.push({unit,allocate:false}),deleteTexture:()=>{deleted++;},
  },{get:(o,k)=>k in o?Reflect.get(o,k):()=>{}});
  const canvas={width:1440,height:900,getContext:()=>gl,addEventListener:(n:string,c:(e:{preventDefault():void})=>void)=>handlers.set(n,c),removeEventListener(){}} as unknown as HTMLCanvasElement;
  const fx=new PostFX(canvas),source={width:720,height:450} as HTMLCanvasElement,mask={width:360,height:225} as HTMLCanvasElement;
  fx.render(source,0,mask);assert.equal(selective,1);
  uploads.length=0;fx.render(source,0,mask);assert(uploads.every(u=>!u.allocate));assert.deepEqual(uploads.map(u=>u.unit),[0,2]);
  uploads.length=0;fx.render(source,0);assert.equal(selective,0);assert.deepEqual(uploads.map(u=>u.unit),[0],'no emission upload outside dungeons');
  handlers.get('webglcontextlost')!({preventDefault(){}});handlers.get('webglcontextrestored')!({preventDefault(){}});
  fx.render(source,0,mask);assert.equal(selective,1);deleted=0;fx.dispose();assert.equal(deleted,4,'scene, emission and both bloom targets released');
});
