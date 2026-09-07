import { toolPage, boundedNumber, downloadJSON, reportRoute } from './common.ts';
import { surveyPlaces, type Survey } from './placements-model.ts';
import { World } from '../world.ts';
import { Simulation } from '../simulation.ts';
import { Renderer } from '../renderer.ts';
import { PostFX } from '../postfx.ts';
import { biomeMapColor } from '../biomes.ts';
import { POI_DEFINITIONS } from '../world-pois.ts';
import { escapeUI as e } from '../ui-components.ts';
const root=await toolPage('Seed & placement inspector','Survey actual generated places without exploring a saved map. Filter events, towns, services and dungeon entrances; select a marker for a frozen scene.');
const q=new URLSearchParams(location.search);
let query:Survey={seed:boundedNumber(q.get('seed'),7319,0,4294967295),x:boundedNumber(q.get('x'),0,-1000000,1000000),y:boundedNumber(q.get('y'),0,-1000000,1000000),size:boundedNumber(q.get('size'),8000,1000,24000)};
root.insertAdjacentHTML('beforeend',`<form class="tool-toolbar">${Object.entries(query).map(([key,v])=>`<label>${{seed:'Seed',x:'Center X',y:'Center Y',size:'Survey width'}[key]}<input name="${key}" type="number" value="${v}" min="${key==='seed'?0:key==='size'?1000:-1000000}" max="${key==='seed'?4294967295:key==='size'?24000:1000000}" required></label>`).join('')}<button>Survey seed</button><label>Place type<select id="kind"><option value="">All places</option>${Object.entries(POI_DEFINITIONS).map(([id,d])=>`<option value="${id}">${d.label}</option>`).join('')}</select></label><button type="button" id="export">Export placements</button></form><p class="tool-status" role="status"></p><div class="tool-split"><section class="tool-panel"><canvas id="survey" width="850" height="650" aria-label="Generated placement map; select a place below for keyboard access"></canvas><p>Climate colors · gold selected marker · coordinates in world units. This survey shows all placements, independent of exploration fog.</p><div class="tool-list" style="max-height:320px"></div></section><section class="tool-panel"><h2 id="name">Place inspection</h2><p id="description"></p><canvas id="scene" width="900" height="650" aria-label="Selected location in the game renderer"></canvas><p>Frozen real renderer with CRT. No simulation ticks or saved exploration.</p><button id="png">Export scene PNG</button><pre id="details"></pre></section></div>`);
const form=root.querySelector('form')!,map=root.querySelector<HTMLCanvasElement>('#survey')!,ctx=map.getContext('2d')!,canvas=root.querySelector<HTMLCanvasElement>('#scene')!,renderer=new Renderer(),fx=new PostFX(canvas);
let world=new World(query.seed),places:ReturnType<typeof surveyPlaces>=[],selected:typeof places[number]|undefined,kind='';
function visible(){return places.filter(p=>!kind||p.kind===kind);}
function mapPoint(x:number,y:number){return {x:(x-query.x)/query.size*map.width+map.width/2,y:(y-query.y)/query.size*map.height+map.height/2};}
function drawMap(){
  for(let y=0;y<32;y++)for(let x=0;x<42;x++){const rgb=biomeMapColor(world.sampleBiome(query.x+(x/42-.5)*query.size,query.y+(y/32-.5)*query.size).weights);ctx.fillStyle=`rgb(${rgb.map(v=>Math.round(v)).join(',')})`;ctx.fillRect(x*map.width/42,y*map.height/32,Math.ceil(map.width/42),Math.ceil(map.height/32));}
  ctx.fillStyle='#08151b88';ctx.fillRect(0,0,map.width,map.height);
  for(const p of visible()){const pos=mapPoint(p.x,p.y);ctx.beginPath();ctx.arc(pos.x,pos.y,p===selected?7:4,0,Math.PI*2);ctx.fillStyle=p===selected?'#fff1af':POI_DEFINITIONS[p.kind].color;ctx.fill();if(p===selected){ctx.strokeStyle='#fff1af';ctx.strokeRect(pos.x-10,pos.y-10,20,20);}}
}
function select(p:typeof places[number]|undefined){selected=p;drawMap();
  root.querySelector('#name')!.textContent=p?.name??'No places in this survey';root.querySelector('#description')!.textContent=p?`${POI_DEFINITIONS[p.kind].label} · ${p.biome} · Level ${p.zone.level}`:'Try another center, seed or a wider survey.';
  if(!p){renderer.reset();fx.render(renderer.canvas,0);root.querySelector('#details')!.textContent='';return;}
  root.querySelector('#details')!.textContent=JSON.stringify(p,null,2);
  const sim=new Simulation(world,{seed:query.seed,spawn:false,startX:p.x,startY:p.y+80});sim.time=12;
  renderer.reset();renderer.resize(700,500);renderer.cameraX=p.x;renderer.cameraY=p.y-35;renderer.render(sim,world,0,{phase:'paused',reducedMotion:true,fps:0,debug:false});fx.render(renderer.canvas,12);
  for(const b of root.querySelectorAll<HTMLElement>('[data-place]'))b.setAttribute('aria-pressed',String(b.dataset.place===p.id));
  const state=new URLSearchParams({...Object.fromEntries(Object.entries(query).map(([k,v])=>[k,String(v)])),kind,place:p.id});history.replaceState(null,'',`?${state}`);reportRoute();
}
function listing(){root.querySelector('.tool-list')!.innerHTML=visible().map(p=>`<button data-place="${e(p.id)}">${e(p.name)}<small>${POI_DEFINITIONS[p.kind].label} · Lv ${p.zone.level} · ${Math.round(p.x)}, ${Math.round(p.y)}</small></button>`).join('');root.querySelector('.tool-status')!.textContent=`${visible().length} shown / ${places.length} placements · ${query.size} × ${query.size} world units · seed ${query.seed}`;select(visible().find(p=>p.id===q.get('place'))??visible()[0]);}
function survey(){root.querySelector('.tool-status')!.textContent='Surveying…';places=surveyPlaces(world,query);listing();}
form.addEventListener('submit',ev=>{ev.preventDefault();if(!form.reportValidity())return;const values=new FormData(form);query={seed:Number(values.get('seed')),x:Number(values.get('x')),y:Number(values.get('y')),size:Number(values.get('size'))};world.dispose();world=new World(query.seed);try{survey();}catch(error){root.querySelector('.tool-status')!.textContent=String(error);}});
const filter=root.querySelector<HTMLSelectElement>('#kind')!;if(Object.hasOwn(POI_DEFINITIONS,q.get('kind')??''))kind=q.get('kind')!;filter.value=kind;filter.addEventListener('change',()=>{kind=filter.value;listing();});
root.querySelector('.tool-list')!.addEventListener('click',ev=>{const b=(ev.target as Element).closest<HTMLElement>('[data-place]');if(b)select(places.find(p=>p.id===b.dataset.place));});
map.addEventListener('click',ev=>{const r=map.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width*map.width,y=(ev.clientY-r.top)/r.height*map.height;const closest=visible().map(p=>({p,d:Math.hypot(mapPoint(p.x,p.y).x-x,mapPoint(p.x,p.y).y-y)})).sort((a,b)=>a.d-b.d)[0];if(closest&&closest.d<22)select(closest.p);});
root.querySelector('#export')!.addEventListener('click',()=>downloadJSON(`evergrow-placements-${query.seed}.json`,{query,places:visible()}));root.querySelector('#png')!.addEventListener('click',()=>{if(!selected)return;const a=document.createElement('a');a.download=`place-${query.seed}.png`;a.href=canvas.toDataURL('image/png');a.click();});
function dispose(){world.dispose();renderer.reset();fx.dispose();}window.addEventListener('pagehide',dispose,{once:true});if(import.meta.hot)import.meta.hot.dispose(dispose);
survey();
