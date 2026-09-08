import '../typography.css';
import '../layout-review.css';
import './dungeon-review.css';
import { loadGameFont, text } from '../font.ts';
import { generateDungeon, dungeonRoomAt, type DungeonEntrance } from '../dungeon.ts';
import { dungeonTheme, DUNGEON_EVENTS } from '../dungeon-content.ts';
import { DungeonWorld } from '../dungeon-world.ts';
import { createDungeonRun, emptyContents } from '../dungeon-state.ts';
import { drawDungeonMap, dungeonMapBounds } from '../dungeon-map.ts';
import { Renderer } from '../renderer.ts';
import { PostFX } from '../postfx.ts';
import { Simulation } from '../simulation.ts';

const root=document.querySelector<HTMLElement>('#dungeon-review')!,abort=new AbortController(),params=new URLSearchParams(location.search);
let disposed=false,frame=0,fx:PostFX|undefined,world:DungeonWorld|undefined;
let seed=Number(params.get('seed')??7319)>>>0,view=params.get('view')??'gallery',roomId=Number(params.get('room')??4);
let present:((dt:number)=>void)|null=null;
const renderer=new Renderer(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const entranceFor=(seed:number):DungeonEntrance=>({id:'dungeon:review',name:dungeonTheme(seed).name,seed,level:8,biome:'deadwood',x:0,y:0});
function download(canvas:HTMLCanvasElement,name:string){const a=document.createElement('a');a.download=name;a.href=canvas.toDataURL('image/png');a.click();}
function floorMap(canvas:HTMLCanvasElement,seed:number,labels=true){
    const floor=generateDungeon(seed,8),run=createDungeonRun(entranceFor(seed)),c=canvas.getContext('2d')!,bounds=dungeonMapBounds(floor);
    run.explored=floor.rooms.map(r=>r.id);
    const zoom=Math.min((canvas.width-100)/bounds.width,(canvas.height-100)/bounds.height);
    drawDungeonMap(c,floor,run,{...floor.entry,angle:-Math.PI/2},{x:0,y:0,width:canvas.width,height:canvas.height},zoom,bounds.x,bounds.y);
    if(labels){
        for(const room of floor.rooms){
            const event=floor.events?.find(e=>e.room===room.id);
            const label=room.kind==='entry'?'ENTRY':room.kind==='boss'?'WARDEN':event?DUNGEON_EVENTS[event.kind].name: String(room.id);
            const x=canvas.width/2+(room.x+room.width/2-bounds.x)*zoom,y=canvas.height/2+(room.y+room.height/2-bounds.y)*zoom;
            c.fillStyle='#060d13d9';c.font='16px "Evergrow Numerals", "Pixelify Sans", sans-serif';const width=c.measureText(label).width+12;c.fillRect(x-width/2,y+10,width,22);
            text(c,label,x,y+14,.9,event?'#f2d69c':'#cfddd4','center');
        }
    }
    return {floor,bounds,zoom};
}
function render(){
    present=null;fx?.dispose();fx=undefined;world?.dispose();world=undefined;
    const theme=dungeonTheme(seed);
    params.set('seed',String(seed));params.set('view',view);params.set('room',String(roomId));history.replaceState(null,'',`?${params}`);
    root.innerHTML=`<header class="layout-review-header"><div><p class="layout-review-eyebrow">WORLD WORKSHOP</p><h1>${view==='gallery'?'Dungeon atlas':theme.name}</h1></div><p class="layout-review-static">Live generator · Disposable preview</p></header>
      <nav class="dungeon-workshop-toolbar"><label>Seed <input data-seed type="number" value="${seed}" min="0" max="4294967295"></label><button data-generate>Generate</button><button data-random>New seed</button><span></span><button data-view="gallery">Three themes</button><button data-view="map">Floor map</button><button data-view="chamber">Chamber</button><button data-view="corridor">Corridor</button><button data-view="event">Encounter</button><button data-export>Export PNG</button></nav><section data-content></section><footer class="dungeon-workshop-footer"><span>◎ Entrance · ◇ Encounter · ■ Treasure · ● Warden</span><span>Click a room to inspect its art. Maps use the actual collision contours.</span></footer>`;
    const content=root.querySelector<HTMLElement>('[data-content]')!;
    let exportCanvas:HTMLCanvasElement;
    if(view==='gallery'){
        content.className='dungeon-gallery';
        const composite=document.createElement('canvas');composite.width=1800;composite.height=1060;const cc=composite.getContext('2d')!;cc.fillStyle='#080e12';cc.fillRect(0,0,1800,1060);
        for(let i=0;i<3;i++){
            const n=(seed-seed%3+i)>>>0,t=dungeonTheme(n),f=generateDungeon(n,8);
            const card=document.createElement('article');card.innerHTML=`<header><h2>${t.name}</h2><p>${t.description}</p></header><canvas width="600" height="800" aria-label="${t.name} floor map"></canvas><footer><span>${f.rooms.length} rooms · ${f.edges.length-f.rooms.length+1} loops · 2 encounters</span><button>Inspect · ${n}</button></footer>`;
            content.append(card);const canvas=card.querySelector('canvas')!;floorMap(canvas,n);
            cc.drawImage(canvas,i*600,120);text(cc,t.name,i*600+28,35,1.5,t.accent);text(cc,`Seed ${n} · ${f.rooms.length} rooms · ${f.edges.length-f.rooms.length+1} loops`,i*600+28,78,1,'#9aacaf');
            text(cc,'◎ Entry   ◇ Encounter   ■ Treasure',i*600+28,970,.9,'#a9b9b5');
            card.querySelector('button')!.onclick=()=>{seed=n;view='map';render();};
            canvas.onclick=()=>{seed=n;view='map';render();};
        }
        exportCanvas=composite;
    }else{
        content.className='dungeon-single';content.innerHTML='<canvas width="1440" height="1000" aria-label="Dungeon inspection"></canvas><aside></aside>';
        const canvas=content.querySelector('canvas')!,c=canvas.getContext('2d')!,floor=generateDungeon(seed,8),run=createDungeonRun(entranceFor(seed));exportCanvas=canvas;
        const event=floor.events?.[0];
        const room=view==='corridor'?floor.corridors.find(r=>Math.max(r.width,r.height)>400)!:view==='event'?floor.rooms[event!.room]:view==='boss'?floor.rooms.at(-1)!:floor.rooms[Math.max(0,Math.min(floor.rooms.length-1,roomId))];
        content.querySelector('aside')!.innerHTML=`<strong>${view==='map'?'Explore the floor':view==='event'?DUNGEON_EVENTS[event!.kind].name:view==='corridor'?'Connecting passage':`Chamber ${room.id}`}</strong><p>${theme.description}</p><p>${floor.rooms.length} rooms · ${floor.edges.length-floor.rooms.length+1} loops</p><div class="room-buttons">${floor.rooms.map(r=>`<button data-room="${r.id}">${r.kind==='entry'?'Entry':r.kind==='boss'?'Warden':r.kind==='treasure'?'Encounter':r.id}</button>`).join('')}</div><p>${view==='event'?DUNGEON_EVENTS[event!.kind].objective:'Frozen actors; only lighting and material effects animate.'}</p>`;
        content.querySelectorAll<HTMLButtonElement>('[data-room]').forEach(b=>b.onclick=()=>{roomId=Number(b.dataset.room);view='chamber';render();});
        if(view==='map'){
            const map=floorMap(canvas,seed);
            canvas.onclick=e=>{const rect=canvas.getBoundingClientRect(),x=map.bounds.x+((e.clientX-rect.left)*canvas.width/rect.width-canvas.width/2)/map.zoom,y=map.bounds.y+((e.clientY-rect.top)*canvas.height/rect.height-canvas.height/2)/map.zoom;
                const selected=dungeonRoomAt(floor,x,y);if(selected){roomId=selected.id;view='chamber';render();}};
        }else{
            const entrance=entranceFor(seed);world=new DungeonWorld(floor,entrance);const scene=world,focus=room.path?.[Math.floor(room.path.length/2)],x=focus?.x??room.x+room.width/2,y=focus?.y??room.y+room.height/2;
            const sim=new Simulation(scene,{spawn:false,startX:x,startY:y+(view==='corridor'?0:70)});sim.dungeonFloor=floor;sim.expeditions={location:entrance.id,runs:[run],surface:emptyContents(),surfaceX:0,surfaceY:0};
            for(const m of floor.members.filter(m=>m.room===room.id&&!m.wave&&(m.eventWave??0)===0))sim.spawnEnemy(m.kind,m.x,m.y,m.rank,{campId:entrance.id,memberId:m.id,lootSeed:m.seed});
            const output=document.createElement('canvas');output.width=1440;output.height=1000;fx=new PostFX(output);renderer.reset();renderer.resize(720,500);renderer.cameraX=x;renderer.cameraY=y;
            present=dt=>{renderer.render(sim,scene,dt,{phase:'paused',reducedMotion:reduced.matches,fps:0,debug:false});fx!.render(renderer.canvas,0);c.drawImage(output,0,0);};present(0);
        }
    }
    root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>{b.setAttribute('aria-current',String(b.dataset.view===view));b.onclick=()=>{view=b.dataset.view!;render();};});
    root.querySelector<HTMLButtonElement>('[data-generate]')!.onclick=()=>{seed=Number(root.querySelector<HTMLInputElement>('[data-seed]')!.value)>>>0;render();};
    root.querySelector<HTMLButtonElement>('[data-random]')!.onclick=()=>{seed=crypto.getRandomValues(new Uint32Array(1))[0];render();};
    root.querySelector<HTMLButtonElement>('[data-export]')!.onclick=()=>download(exportCanvas,`evergrow-dungeons-${seed}-${view}.png`);
    root.dataset.ready='true';
}
async function boot(){if(!import.meta.env.DEV)throw Error('Local tool only');await loadGameFont();if(disposed)return;render();let previous=performance.now();const animate=(now:number)=>{if(disposed)return;if(now-previous>=1000/30){if(!document.hidden&&!reduced.matches)present?.(Math.min(.05,(now-previous)/1000));previous=now;}frame=requestAnimationFrame(animate);};frame=requestAnimationFrame(animate);}
void boot().catch(e=>{root.textContent=String(e);});
function dispose(){disposed=true;cancelAnimationFrame(frame);abort.abort();fx?.dispose();world?.dispose();renderer.reset();}
window.addEventListener('pagehide',dispose,{signal:abort.signal});if(import.meta.hot)import.meta.hot.dispose(dispose);
