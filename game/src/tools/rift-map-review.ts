import { updateRiftGuardian } from '../rift-runtime.ts';
import { drawEnemyPlate } from '../enemy-plate.ts';
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
import { FrameProfiler } from '../frame-profiler.ts';
import { RIFT_FIELD, riftPackCount } from '../rift-floor.ts';
import { escapeUI } from '../ui-components.ts';

/** Reveals only a disposable runtime floor; never accesses a character save. */
export function mountRiftMapReview(root:HTMLElement,params:URLSearchParams):()=>void {
  const life=new AbortController();
  let seed=Number(params.get('seed')??7319)>>>0;
  let biome:BiomeId=BIOME_IDS.find(id=>id===params.get('biome'))??'verdant';
  let arrival=params.has('arrival'),scene=params.get('scene')==='pack'||arrival;
  const profiler=new FrameProfiler(true),renderer=new Renderer(false,profiler);
  let present:(()=>void)|undefined,staged=0,epoch=0;
  const display=document.createElement('canvas');display.width=1100;display.height=900;
  const post=new PostFX(display);
  let world:RiftWorld|undefined;
  root.innerHTML=`<section class="ui-window" style="position:absolute;inset:16px 16px 48px;overflow:hidden"><header class="ui-window-header" style="flex-wrap:wrap"><h2 class="ui-title" style="flex:1 0 140px;white-space:nowrap;margin:0">Open-world rift</h2><select aria-label="Biome" class="ui-select">${BIOME_IDS.map(id=>`<option value="${id}" ${id===biome?'selected':''}>${escapeUI(BIOMES[id].name)}</option>`).join('')}</select><button class="ui-button" data-scene>View pack</button><button class="ui-button" data-arrival>Guardian arrival</button><button class="ui-button" data-profile>Profile rendering</button><button class="ui-button" data-next>New layout</button><a class="ui-button" href="/tools/rifts.html">Portal UI</a></header><div style="flex:1;min-height:0;display:grid;place-items:center;background:#071018"><img alt="Generated open-world rift" style="width:100%;height:100%;object-fit:contain"/></div><footer class="ui-window-footer" style="display:block;padding:12px 18px"><p data-summary style="margin:0 0 4px"></p><small data-caption></small><output data-profile-result style="display:block"></output></footer></section>`;
  const image=root.querySelector('img')!,canvas=document.createElement('canvas');canvas.width=1100;canvas.height=900;
  const c=canvas.getContext('2d')!;
  const draw=()=>{
    epoch++;present=undefined;
    const output=root.querySelector<HTMLOutputElement>('[data-profile-result]')!;output.textContent='';delete output.dataset.profile;
    // Select an actual world seed with this starting climate; never paint a fake biome.
    while(startingBiome(seed)!==biome)seed=(seed+1)>>>0;
    const entrance:DungeonEntrance={id:'dungeon:rift:1',name:'Rift preview',seed,level:30,biome,x:0,y:0,rift:{attempt:1}};
    const floor=generateDungeon(seed,30,entrance),run=createDungeonRun(entrance),bounds=dungeonMapBounds(floor);
    run.explored=floor.rooms.map(r=>r.id);run.rift!.phase=arrival?'boss':'hunt';run.rift!.points=arrival?RIFT_RULES.progress:0;
    world?.dispose();world=new RiftWorld(floor,entrance);
    if(scene){
      const groups=Array.from({length:riftPackCount(entrance.rift!)},(_,i)=>floor.members.filter(m=>m.id.startsWith(`rift:${i}:`)));
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
      if(arrival){updateRiftGuardian(sim);if(run.rift!.guardian){run.rift!.elapsed=run.rift!.guardian.at+2.1;center.x=run.rift!.guardian.x;center.y=run.rift!.guardian.y-60;}}
      renderer.reset();renderer.resize(1100,900);renderer.cameraX=center.x;renderer.cameraY=center.y;
      const sceneWorld=world;staged=sim.enemies.length;
      present=()=>{
        profiler.begin(performance.now());
        renderer.render(sim,sceneWorld,1/60,{phase:'paused',reducedMotion:false,skyHour:10});
        const started=profiler.start();post.render(renderer.canvas,0);profiler.end('postfx',started);profiler.finish();
      };
      present();c.drawImage(display,0,0,1100,900);
      if(!arrival){const elite=sim.enemies.find(e=>e.rank==='elite');if(elite)drawEnemyPlate(c,elite,1100,900,{time:12});}
    }else{
    const zoom=Math.min(1000/bounds.width,780/bounds.height),box={x:0,y:0,width:1100,height:900};
    drawDungeonMap(c,floor,run,{...floor.entry,angle:0},box,zoom,bounds.x,bounds.y);
    const screen=(x:number,y:number)=>({x:550+(x-bounds.x)*zoom,y:450+(y-bounds.y)*zoom});
    for(const m of floor.members){if(m.id==='warden')continue;const p=screen(m.x,m.y);c.fillStyle=m.rank==='elite'?'#e0c17a':m.rank==='veteran'?'#76b9ee':'#a3b1ac';c.beginPath();c.arc(p.x,p.y,m.rank==='normal'?1.5:2.2,0,Math.PI*2);c.fill();}
    const entry=screen(floor.entry.x,floor.entry.y-240);
    text(c,'ENTRY',entry.x,entry.y,1.1,'#d7e5df','center');
    }
    image.src=canvas.toDataURL('image/png');image.alt=arrival?'Rift guardian arrival':scene?'Rift pack in the actual game world':'Complete generated open-world rift map';
    root.querySelector('[data-scene]')!.textContent=scene?'View map':'View pack';
    root.querySelector('[data-caption]')!.textContent=scene?'Frozen scene · Actual game renderer and generated enemies':'Full terrain revealed for preview · Dots show monster spawns';
    const counts=(['normal','veteran','elite'] as const).map(rank=>floor.members.filter(m=>m.id!=='warden'&&m.rank===rank).length);
    root.querySelector('[data-summary]')!.textContent=`Seed ${seed} · ${RIFT_FIELD.packs} packs · ${counts[0]} normal · ${counts[1]} champions · ${counts[2]} elites + guardian`;
    const url=new URL(location.href);url.searchParams.set('view','map');url.searchParams.set('seed',String(seed));url.searchParams.set('biome',biome);if(arrival)url.searchParams.set('arrival','');else url.searchParams.delete('arrival');if(scene)url.searchParams.set('scene','pack');else url.searchParams.delete('scene');history.replaceState(null,'',url);
  };
  root.querySelector('select')!.addEventListener('change',e=>{biome=(e.target as HTMLSelectElement).value as BiomeId;draw();},{signal:life.signal});
  root.querySelector('[data-next]')!.addEventListener('click',()=>{seed=(seed+731991)>>>0;draw();},{signal:life.signal});
  root.querySelector('[data-scene]')!.addEventListener('click',()=>{arrival=false;scene=!scene;draw();},{signal:life.signal});
  root.querySelector('[data-arrival]')!.addEventListener('click',()=>{arrival=true;scene=true;draw();},{signal:life.signal});
  root.querySelector('[data-profile]')!.addEventListener('click',async()=>{
    if(!scene){scene=true;draw();}
    const serial=++epoch,button=root.querySelector<HTMLButtonElement>('[data-profile]')!,output=root.querySelector<HTMLOutputElement>('[data-profile-result]')!;
    button.disabled=true;output.textContent='Measuring frozen rendering…';
    try{
      for(let i=0;i<150;i++){
        await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
        if(life.signal.aborted||serial!==epoch)return;
        if(i===30)profiler.reset();present!();
      }
      const result=profiler.snapshot();
      output.textContent=`${staged} staged enemies · Render CPU ${result.metrics.frameCPU.p50.toFixed(1)} ms median / ${result.metrics.frameCPU.p95.toFixed(1)} ms p95`;
      output.dataset.profile=JSON.stringify(result);
    }finally{button.disabled=false;}
  },{signal:life.signal});
  draw();return ()=>{life.abort();renderer.reset();world?.dispose();post.dispose();};
}
