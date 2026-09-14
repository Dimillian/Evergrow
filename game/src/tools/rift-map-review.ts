import { BIOMES, BIOME_IDS, startingBiome, type BiomeId } from '../biomes.ts';
import { generateDungeon, type DungeonEntrance } from '../dungeon.ts';
import { createDungeonRun } from '../dungeon-state.ts';
import { dungeonMapBounds, drawDungeonMap } from '../dungeon-map.ts';
import { RIFT_RULES } from '../rift-content.ts';
import { text } from '../font.ts';
import { RiftWorld } from '../rift-world.ts';
import { Renderer } from '../renderer.ts';
import { PostFX } from '../postfx.ts';
import { Simulation } from '../simulation.ts';
import { RIFT_FIELD } from '../rift-floor.ts';
import { escapeUI } from '../ui-components.ts';

/** Reveals only a disposable runtime floor; never accesses a character save. */
export function mountRiftMapReview(root:HTMLElement,params:URLSearchParams):()=>void {
  const life=new AbortController();
  let seed=Number(params.get('seed')??7319)>>>0;
  let biome:BiomeId=BIOME_IDS.find(id=>id===params.get('biome'))??'verdant';
  let scene=params.get('scene')==='pack';
  const renderer=new Renderer();
  const display=document.createElement('canvas');display.width=1100;display.height=900;
  const post=new PostFX(display);
  let world:RiftWorld|undefined;
  root.innerHTML=`<section class="ui-window" style="position:absolute;inset:16px 16px 48px;overflow:hidden"><header class="ui-window-header" style="flex-wrap:wrap"><h2 class="ui-title" style="flex:1 0 140px;white-space:nowrap;margin:0">Open-world rift</h2><select aria-label="Biome" class="ui-select">${BIOME_IDS.map(id=>`<option value="${id}" ${id===biome?'selected':''}>${escapeUI(BIOMES[id].name)}</option>`).join('')}</select><button class="ui-button" data-scene>View pack</button><button class="ui-button" data-next>New layout</button><a class="ui-button" href="/tools/rifts.html">Portal UI</a></header><div style="flex:1;min-height:0;display:grid;place-items:center;background:#071018"><img alt="Generated open-world rift" style="width:100%;height:100%;object-fit:contain"/></div><footer class="ui-window-footer" style="display:block;padding:12px 18px"><p data-summary style="margin:0 0 4px"></p><small data-caption></small></footer></section>`;
  const image=root.querySelector('img')!,canvas=document.createElement('canvas');canvas.width=1100;canvas.height=900;
  const c=canvas.getContext('2d')!;
  const draw=()=>{
    // Select an actual world seed with this starting climate; never paint a fake biome.
    while(startingBiome(seed)!==biome)seed=(seed+1)>>>0;
    const entrance:DungeonEntrance={id:'dungeon:rift:1',name:'Rift preview',seed,level:30,biome,x:0,y:0,rift:{attempt:1}};
    const floor=generateDungeon(seed,30,entrance),run=createDungeonRun(entrance),bounds=dungeonMapBounds(floor);
    run.explored=floor.rooms.map(r=>r.id);run.rift!.phase='boss';run.rift!.points=RIFT_RULES.progress;
    world?.dispose();world=new RiftWorld(floor,entrance);
    if(scene){
      const groups=Array.from({length:RIFT_FIELD.packs},(_,i)=>floor.members.filter(m=>m.id.startsWith(`rift:${i}:`)));
      const centers=groups.map(g=>({x:g.reduce((n,m)=>n+m.x,0)/g.length,y:g.reduce((n,m)=>n+m.y,0)/g.length}));
      const center=centers.sort((a,b)=>(world!.sampleBiome(a.x,a.y).id===biome?0:10000)+Math.hypot(a.x,a.y)-(world!.sampleBiome(b.x,b.y).id===biome?0:10000)-Math.hypot(b.x,b.y))[0];
      const sim=new Simulation(world,{seed,spawn:false,startX:center.x,startY:center.y+400});
      sim.expeditions={location:entrance.id,runs:[run],surface:null,surfaceX:0,surfaceY:0};sim.dungeonFloor=floor;
      sim.time=12;sim.player.angle=-Math.PI/2;
      // Static pose only: no AI ticks, input or playable saves.
      for(const m of floor.members)if(m.id!=='warden'&&Math.hypot(m.x-center.x,m.y-center.y)<1100){
        const e=sim.spawnEnemy(m.kind,m.x,m.y,m.rank,{campId:entrance.id,memberId:m.id,lootSeed:m.seed,level:30});
        if(e)e.angle=Math.atan2(sim.player.y-e.y,sim.player.x-e.x);
      }
      renderer.reset();renderer.resize(1100,900);renderer.cameraX=center.x;renderer.cameraY=center.y;
      renderer.render(sim,world,1,{phase:'paused',reducedMotion:true,fps:0,debug:false,skyHour:10});
      post.render(renderer.canvas,0);c.drawImage(display,0,0,1100,900);
    }else{
    const zoom=Math.min(1000/bounds.width,780/bounds.height),box={x:0,y:0,width:1100,height:900};
    drawDungeonMap(c,floor,run,{...floor.entry,angle:0},box,zoom,bounds.x,bounds.y);
    const screen=(x:number,y:number)=>({x:550+(x-bounds.x)*zoom,y:450+(y-bounds.y)*zoom});
    for(const m of floor.members){if(m.id==='warden')continue;const p=screen(m.x,m.y);c.fillStyle=m.rank==='elite'?'#e0c17a':m.rank==='veteran'?'#76b9ee':'#a3b1ac';c.beginPath();c.arc(p.x,p.y,m.rank==='normal'?1.5:2.2,0,Math.PI*2);c.fill();}
    const entry=screen(floor.entry.x,floor.entry.y-240),boss=floor.members.find(m=>m.id==='warden')!,end=screen(boss.x,boss.y-400);
    text(c,'ENTRY',entry.x,entry.y,1.1,'#d7e5df','center');text(c,'GUARDIAN',end.x,end.y,1.1,'#f1bbc9','center');
    }
    image.src=canvas.toDataURL('image/png');image.alt=scene?'Rift pack in the actual game world':'Complete generated open-world rift map';
    root.querySelector('[data-scene]')!.textContent=scene?'View map':'View pack';
    root.querySelector('[data-caption]')!.textContent=scene?'Frozen scene · Actual game renderer and generated enemies':'Full terrain revealed for preview · Dots show monster spawns';
    const counts=(['normal','veteran','elite'] as const).map(rank=>floor.members.filter(m=>m.id!=='warden'&&m.rank===rank).length);
    root.querySelector('[data-summary]')!.textContent=`Seed ${seed} · ${RIFT_FIELD.packs} packs · ${counts[0]} normal · ${counts[1]} champions · ${counts[2]} elites + guardian`;
    const url=new URL(location.href);url.searchParams.set('view','map');url.searchParams.set('seed',String(seed));url.searchParams.set('biome',biome);if(scene)url.searchParams.set('scene','pack');else url.searchParams.delete('scene');history.replaceState(null,'',url);
  };
  root.querySelector('select')!.addEventListener('change',e=>{biome=(e.target as HTMLSelectElement).value as BiomeId;draw();},{signal:life.signal});
  root.querySelector('[data-next]')!.addEventListener('click',()=>{seed=(seed+731991)>>>0;draw();},{signal:life.signal});
  root.querySelector('[data-scene]')!.addEventListener('click',()=>{scene=!scene;draw();},{signal:life.signal});
  draw();return ()=>{life.abort();renderer.reset();world?.dispose();post.dispose();};
}
