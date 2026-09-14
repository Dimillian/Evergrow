import { BIOMES, BIOME_IDS, type BiomeId } from '../biomes.ts';
import { generateDungeon, type DungeonEntrance } from '../dungeon.ts';
import { createDungeonRun } from '../dungeon-state.ts';
import { dungeonMapBounds, drawDungeonMap } from '../dungeon-map.ts';
import { RIFT_RULES } from '../rift-content.ts';
import { text } from '../font.ts';
import { escapeUI } from '../ui-components.ts';

/** Reveals only a disposable runtime floor; never accesses a character save. */
export function mountRiftMapReview(root:HTMLElement,params:URLSearchParams):()=>void {
  const life=new AbortController();
  let seed=Number(params.get('seed')??7319)>>>0;
  let biome:BiomeId=BIOME_IDS.find(id=>id===params.get('biome'))??'verdant';
  root.innerHTML=`<section class="ui-window" style="position:absolute;inset:16px 16px 48px;overflow:hidden"><header class="ui-window-header" style="flex-wrap:wrap"><h2 class="ui-title" style="flex:1">Rift layout</h2><select aria-label="Biome" class="ui-select">${BIOME_IDS.map(id=>`<option value="${id}" ${id===biome?'selected':''}>${escapeUI(BIOMES[id].name)}</option>`).join('')}</select><button class="ui-button" data-next>New layout</button><a class="ui-button" href="/tools/rifts.html">Portal UI</a></header><div style="flex:1;min-height:0;display:grid;place-items:center;background:#071018"><canvas width="1100" height="900" aria-label="Complete generated rift layout" style="width:100%;height:100%;object-fit:contain"></canvas></div><footer class="ui-window-footer" style="display:block;padding:12px 18px"><p data-summary style="margin:0 0 4px"></p><small>Full layout revealed for preview · Dots show monster spawns · Guardian appears when the kill bar fills</small></footer></section>`;
  const canvas=root.querySelector('canvas')!,c=canvas.getContext('2d')!;
  const draw=()=>{
    const entrance:DungeonEntrance={id:'dungeon:rift:1',name:'Rift preview',seed,level:30,biome,x:0,y:0,rift:{attempt:1}};
    const floor=generateDungeon(seed,30,entrance),run=createDungeonRun(entrance),bounds=dungeonMapBounds(floor);
    run.explored=floor.rooms.map(r=>r.id);run.rift!.phase='boss';run.rift!.points=RIFT_RULES.progress;
    const zoom=Math.min(1000/bounds.width,780/bounds.height),box={x:0,y:0,width:1100,height:900};
    drawDungeonMap(c,floor,run,{...floor.entry,angle:0},box,zoom,bounds.x,bounds.y);
    const screen=(x:number,y:number)=>({x:550+(x-bounds.x)*zoom,y:450+(y-bounds.y)*zoom});
    for(const m of floor.members){if(m.id==='warden')continue;const p=screen(m.x,m.y);c.fillStyle=m.rank==='elite'?'#e0c17a':m.rank==='veteran'?'#76b9ee':'#a3b1ac';c.beginPath();c.arc(p.x,p.y,m.rank==='normal'?1.5:2.2,0,Math.PI*2);c.fill();}
    const entry=screen(floor.entry.x,floor.entry.y-240),boss=floor.members.find(m=>m.id==='warden')!,end=screen(boss.x,boss.y-400);
    text(c,'ENTRY',entry.x,entry.y,1.1,'#d7e5df','center');text(c,'GUARDIAN',end.x,end.y,1.1,'#f1bbc9','center');
    const counts=(['normal','veteran','elite'] as const).map(rank=>floor.members.filter(m=>m.id!=='warden'&&m.rank===rank).length);
    root.querySelector('[data-summary]')!.textContent=`Seed ${seed} · ${floor.rooms.length} clearings · ${counts[0]} normal · ${counts[1]} champions · ${counts[2]} elites + guardian`;
    const url=new URL(location.href);url.searchParams.set('view','map');url.searchParams.set('seed',String(seed));url.searchParams.set('biome',biome);history.replaceState(null,'',url);
  };
  root.querySelector('select')!.addEventListener('change',e=>{biome=(e.target as HTMLSelectElement).value as BiomeId;draw();},{signal:life.signal});
  root.querySelector('[data-next]')!.addEventListener('click',()=>{seed=(seed+731991)>>>0;draw();},{signal:life.signal});
  draw();return ()=>life.abort();
}
