import './area-banner-review.css';
import { installUITheme } from '../ui-theme.ts';
import { loadGameFont } from '../font.ts';
import { World } from '../world.ts';
import { Simulation } from '../simulation.ts';
import { Renderer } from '../renderer.ts';
import { PostFX } from '../postfx.ts';
import { Lifetime } from '../lifetime.ts';
import { getZoneAt } from '../zone-progression.ts';
import { drawAreaBanner } from '../area-banner-art.ts';
import { areaThreat, AREA_BANNER_TIMING } from '../area-banner.ts';

if (!import.meta.env.DEV) throw new Error('Local review only.');
installUITheme();
await loadGameFont();
const life = new Lifetime(), abort = new AbortController();
life.defer(() => abort.abort());
const world = life.own(new World(7319));
// Disposable, frozen scenery. No input adapter, simulation ticks, repositories or saves.
const sim = new Simulation(world, { spawn: false });
const renderer = new Renderer(), terrain = document.createElement('canvas');
const fx = life.own(new PostFX(terrain));
const backdrop = document.createElement('canvas');
const scenes = [{ label: 'Home district', x: 0, y: 0 }, { label: 'Beyond home', x: 9000, y: 6000 }, { label: 'Distant wilderness', x: 20000, y: -6000 }];
const concepts = [{ name: 'Gilded Horizon', detail: 'Shared runtime area announcement.', motion: 'A soft entrance and exit, centered in the upper quarter.' }];
const sizes = [[1280,720],[960,540],[800,360],[360,640]] as const;
const root = document.querySelector<HTMLElement>('#app')!;
root.className = 'banner-study';
root.innerHTML = `<header><div><div class="eyebrow">Evergrow · Interface studies</div><h1>Area announcements</h1><p>Gilded Horizon · Shared with the game · Centered in the upper quarter</p></div><a href="/notifications.html">Pickup feed ↗</a></header>
  <div class="banner-controls"><label>Area<select id="scene">${scenes.map((s, i) => `<option value="${i}">${s.label}</option>`).join('')}</select></label><label>Viewport<select id="viewport"><option value="0">Desktop · 1280 × 720</option><option value="1">Handheld · 960 × 540</option><option value="2">Phone landscape · 800 × 360</option><option value="3">Phone portrait · 360 × 640</option></select></label><label>Player level<input id="level" type="number" min="1" max="1000000" value="8"></label><button type="button" id="replay">Replay fade</button><button type="button" id="hold">Hold visible</button><label>Fade timeline<input id="timeline" type="range" min="0" max="${AREA_BANNER_TIMING.duration}" step="0.02" value="1.8" style="width:170px"></label><output id="status" aria-live="polite">Held at full visibility</output></div>
  <main class="banner-boards" data-mode="single">${concepts.map((c, i) => `<section class="banner-board"><canvas role="img" aria-label="${c.name} area banner"></canvas><div class="description"><h2>${String.fromCharCode(65 + i)} · ${c.name}</h2><p>${c.detail}</p><p>${c.motion}</p></div></section>`).join('')}</main>
  <div class="legend"><span><i style="--tone:#b9c5c5"></i>Outgrown</span><span><i style="--tone:#b9d7a3"></i>Within range</span><span><i style="--tone:#f0ca85"></i>Challenging</span><span><i style="--tone:#efa097"></i>Dangerous</span></div>
  <p class="footnote">Level colors: silver above the area maximum; sage within the range; amber 1–4 levels below its minimum; coral 5+ below. The banner shows only the colored mob-level text. Compare against the minimum when underlevelled: ordinary enemies scale within the region, so its maximum alone would exaggerate danger. Elites and bosses can exceed the range.</p>
  <p class="footnote">Frozen preview · Actual generated area names, regional ranges and frozen runtime scenery · 0.8s entrance / 2.8s hold / 1.2s exit · Reduced motion uses opacity only · No playable saves</p>`;
const boards = [...root.querySelectorAll<HTMLElement>('.banner-board')];
const canvases = [...root.querySelectorAll<HTMLCanvasElement>('.banner-board canvas')];
const levelInput = root.querySelector<HTMLInputElement>('#level')!;
const sceneInput = root.querySelector<HTMLSelectElement>('#scene')!;
const timeline = root.querySelector<HTMLInputElement>('#timeline')!;
const status = root.querySelector<HTMLOutputElement>('#status')!;
const viewport = root.querySelector<HTMLSelectElement>('#viewport')!;
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let area = getZoneAt(0, 0, world.seed), age = 1.8, frame = 0, last = 0;
function threat() { return areaThreat(area, Math.max(1, Math.min(1000000, Number(levelInput.value) || 1))); }
function draw() {
  const dpr = devicePixelRatio || 1;
  canvases.forEach((canvas,i) => {
    if (boards[i].hidden) return;
    const [w,h]=sizes[Number(viewport.value)];
    canvas.style.maxWidth=`${w}px`;canvas.style.aspectRatio=`${w}/${h}`;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)) { canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr); }
    const c=canvas.getContext('2d')!;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
    const factor=Math.max(w/backdrop.width,h/backdrop.height),bw=backdrop.width*factor,bh=backdrop.height*factor;
    c.drawImage(backdrop,(w-bw)/2,(h-bh)/2,bw,bh);drawAreaBanner(c,area,age,Math.max(1,Math.min(1000000,Number(levelInput.value)||1)),w,h,motion.matches);
    canvas.setAttribute('aria-label',`${concepts[i].name}: ${area.name}, mobs level ${area.level} to ${area.maxLevel}, ${threat().label}`);
  });
}
function scenery() {
  const scene=scenes[Number(sceneInput.value)] ?? scenes[0];
  area=getZoneAt(scene.x,scene.y,world.seed);
  sim.player.x=sim.player.prevX=scene.x;sim.player.y=sim.player.prevY=scene.y;
  renderer.resize(1100,650);renderer.cameraX=scene.x;renderer.cameraY=scene.y;
  terrain.width=1100;terrain.height=650;
  renderer.render(sim,world,0,{phase:'playing',reducedMotion:true});fx.render(renderer.canvas,0);
  backdrop.width=terrain.width;backdrop.height=terrain.height;backdrop.getContext('2d')!.drawImage(terrain,0,0);
  // Copy immediately: WebGL's presentation buffer need not survive the next task.
  sceneInput.options[sceneInput.selectedIndex].textContent=`${scene.label} · Lv ${area.level}–${area.maxLevel}`;
  draw();
}
function stop() { cancelAnimationFrame(frame);frame=0; }
function tick(now:number) {
  age=Math.min(AREA_BANNER_TIMING.duration,age+Math.min(.1,(now-last)/1000));last=now;timeline.value=String(age);draw();
  if(age<AREA_BANNER_TIMING.duration) frame=requestAnimationFrame(tick);else { frame=0;status.textContent='Fade complete · Replay or hold visible'; }
}
root.addEventListener('click',event=>{
  const button=(event.target as HTMLElement).closest('button');if(!button)return;
  if(button.id==='replay'){stop();age=0;last=performance.now();status.textContent='Playing fade · 4.8 seconds';frame=requestAnimationFrame(tick);}
  if(button.id==='hold'){stop();age=1.8;timeline.value=String(age);status.textContent='Held at full visibility';draw();}
},{signal:abort.signal});
viewport.addEventListener('change',draw,{signal:abort.signal});
levelInput.addEventListener('input',draw,{signal:abort.signal});
sceneInput.addEventListener('change',scenery,{signal:abort.signal});
timeline.addEventListener('input',()=>{stop();age=Number(timeline.value);status.textContent=`Paused at ${age.toFixed(2)}s`;draw();},{signal:abort.signal});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();status.textContent='Paused while hidden';}},{signal:abort.signal});
const resize=new ResizeObserver(draw);resize.observe(root);life.defer(()=>resize.disconnect());
life.defer(stop);window.addEventListener('pagehide',()=>life.dispose(),{once:true});
scenery();
if(import.meta.hot)import.meta.hot.dispose(()=>life.dispose());
