import { worldTimeLabel, WORLD_TIME } from './world-time.ts';
import { propDefinition } from './biome-props.ts';
import { FrameProfiler } from './frame-profiler.ts';
import { BIOME_IDS } from './biomes.ts';
import './typography.css';
import './layout-review.css';
import { loadGameFont } from './font.ts';
import { World, WORLD_GENERATION_VERSION } from './world.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { Simulation } from './simulation.ts';
import { biomeReviewScenes, type BiomeReviewScene } from './biome-review-data.ts';

const root = document.querySelector<HTMLElement>('#biome-review')!;
const lifetime = new AbortController();
let request = 0, renderer: Renderer | undefined;
let disposed = false, postfx: PostFX | undefined, world: World | undefined;

async function boot() {
  if (!import.meta.env.DEV) throw new Error('Biome studies are available on the local development server only.');
  await loadGameFont(); if (disposed) return;
  const params = new URLSearchParams(location.search);
  const lightingStudy=params.has('lighting'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const seed=Number(params.get('seed') ?? 7319)>>>0, variant=Math.max(0,Number(params.get('variant')??0)|0);
  world = new World(seed);
  const sceneWorld = world, scenes = biomeReviewScenes(sceneWorld,BIOME_IDS,variant).filter(scene=>!lightingStudy||BIOME_IDS.includes(scene.id as typeof BIOME_IDS[number]));
  if(!lightingStudy)scenes.push({ id: 'origin', name: `The first steps · ${world.sampleBiome(0, 0).name}`, description: 'The starting wilderness at world origin. A frozen scene from the current procedural renderer.', x: 0, y: -100 });
  let skyHour=Number(params.get('hour')??9);if(!Number.isFinite(skyHour))skyHour=9;skyHour=((skyHour%24)+24)%24;
  let cycle=false;
  const profiler=new FrameProfiler(lightingStudy),sceneRenderer=renderer=new Renderer(false,profiler);
  let present:((dt:number)=>void)|undefined,renderCount=0;
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1100;
  canvas.className = 'layout-review-scene'; canvas.style.aspectRatio = '1600 / 1100'; canvas.setAttribute('role', 'img');
  const c = canvas.getContext('2d', { alpha: false })!;
  const display = document.createElement('canvas'); display.width = 1600; display.height = 1100;
  root.innerHTML = `<header class="layout-review-header"><div><h1></h1></div><p class="layout-review-static">${lightingStudy?'Live light & atmosphere':`World generation ${WORLD_GENERATION_VERSION}`} · Seed ${seed}</p></header>
    <div class="layout-review-toolbar"><nav class="layout-review-views" aria-label="Biomes and transitions"></nav><button class="landscape-next">Another area</button><select style="font:inherit;color:#dddbc9;background:#132027;border:1px solid #40534f;padding:10px;border-radius:3px" class="landscape-seed" aria-label="World seed">${[7319,18427,90210].map(n=>`<option value="${n}" ${n===seed?'selected':''}>Seed ${n}</option>`).join('')}</select><a class="layout-review-download">Save PNG</a></div>
    ${lightingStudy?`<div class="layout-review-toolbar"><label>Time <input data-hour type="range" min="0" max="23.99" step=".05" value="${skyHour}" aria-label="Time of day"/></label><output data-clock></output><button data-hour-preset="6.5">Dawn</button><button data-hour-preset="12">Noon</button><button data-hour-preset="17.5">Dusk</button><button data-hour-preset="0">Midnight</button><button data-cycle aria-pressed="false">Play day cycle</button></div>`:''}
    <figure class="layout-review-figure"><div class="layout-review-frame"></div><figcaption class="layout-review-caption"><p class="layout-review-description"></p><p class="layout-review-location"></p></figcaption></figure>
    <p class="layout-review-status" role="status"></p>${lightingStudy?'<details><summary>Render timings</summary><output data-timings></output></details>':''}`;
  root.querySelector('.layout-review-frame')!.append(canvas);
  root.querySelector('.landscape-next')!.addEventListener('click',()=>{params.set('variant',String(variant+1));location.search=params.toString();},{signal:lifetime.signal});
  root.querySelector('.landscape-seed')!.addEventListener('change',e=>{params.set('seed',(e.target as HTMLSelectElement).value);params.delete('variant');location.search=params.toString();},{signal:lifetime.signal});
  const title = root.querySelector('h1')!, description = root.querySelector('.layout-review-description')!;
  const save = root.querySelector<HTMLAnchorElement>('.layout-review-download')!;
  const buttons = new Map<string, HTMLButtonElement>();
  let selected = scenes.find(scene => scene.id === params.get('view')) ?? scenes.find(s=>s.id===(lightingStudy?'verdant':'deadwood')) ?? scenes[0];
  function draw(scene: BiomeReviewScene) {
    if (disposed) return;
    selected = scene;
    let playerX = scene.x, playerY = scene.y + 100;
    const crowns = lightingStudy ? sceneWorld.getProps(scene.x-420,scene.y-250,840,700).filter(p=>propDefinition(p.kind).canopy) : [];
    const underCrown = (x:number,y:number) => crowns.some(p=>{const crown=propDefinition(p.kind).canopy!;
      return y<p.y+8&&y>p.y-(crown.height+crown.radius)*p.scale&&Math.abs(x-p.x-crown.offsetX*p.scale)<crown.radius*p.scale;});
    for (let ring = 0; ring < 12; ring++) {
      let clear = false;
      for (let i = 0; i < 12; i++) {
        const x = scene.x + Math.cos(i * Math.PI / 6) * ring * 14;
        const y = scene.y + 100 + Math.sin(i * Math.PI / 6) * ring * 14;
        if (!sceneWorld.blocked(x, y, 13) && !underCrown(x,y)) { playerX = x; playerY = y; clear = true; break; }
      }
      if (clear) break;
    }
    // Pose only. No simulation steps, enemy spawning, input, exploration, or save reads.
    const sim = new Simulation(sceneWorld, { seed, spawn: false, startX: playerX, startY: playerY });
    sim.time = 12; sim.player.angle = -Math.PI / 2;
    sceneRenderer.reset(); sceneRenderer.resize(800, 550); sceneRenderer.cameraX = scene.x; sceneRenderer.cameraY = scene.y - 20;
    profiler.reset();renderCount=0;
    present=dt=>{
      profiler.begin(performance.now());
      sceneRenderer.render(sim,sceneWorld,dt,{phase:'paused',reducedMotion:!lightingStudy||reduced.matches,fps:0,debug:false,skyHour:lightingStudy?skyHour:undefined});
      postfx??=new PostFX(display);const start=profiler.start();postfx.render(sceneRenderer.canvas,0);profiler.end('postfx',start);
      c.drawImage(display,0,0);profiler.finish();
      const clock=root.querySelector('[data-clock]');if(clock)clock.textContent=worldTimeLabel((skyHour-WORLD_TIME.startHour)/24*WORLD_TIME.daySeconds);
      if(lightingStudy&&++renderCount%30===0){const timing=profiler.snapshot(),out=root.querySelector<HTMLElement>('[data-timings]')!;
        out.textContent=`Frame CPU ${timing.metrics.frameCPU.p50.toFixed(1)} ms · Lighting ${timing.metrics.lighting.p50.toFixed(1)} ms (median; excludes GPU completion)`;out.dataset.profile=JSON.stringify(timing.metrics);}
    };
    present(lightingStudy?12:1);
    title.textContent = scene.name; description.textContent = scene.description;
    root.querySelector('.layout-review-location')!.textContent = `${scene.x}, ${scene.y} · ${lightingStudy?'Live atmosphere':'Frozen world renderer'} / CRT`;
    canvas.setAttribute('aria-label', `${scene.name}. ${scene.description}`);
    for (const [id, button] of buttons) button.setAttribute('aria-current', String(id === scene.id));
    params.set('view', scene.id); history.replaceState(null, '', `${location.pathname}?${params}`);
    save.href = canvas.toDataURL('image/png'); save.download = `evergrow-${scene.id}.png`;
    root.dataset.ready = 'true'; root.setAttribute('aria-busy', 'false');
    root.querySelector('.layout-review-status')!.textContent = `${scene.name} ready.`;
  }
  for (const scene of scenes) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = scene.name;
    button.addEventListener('click', () => draw(scene), { signal: lifetime.signal });
    buttons.set(scene.id, button); root.querySelector('nav')!.append(button);
  }
  display.addEventListener('webglcontextrestored', () => draw(selected), { signal: lifetime.signal });
  const setHour=(hour:number)=>{skyHour=hour;params.set('hour',String(hour));history.replaceState(null,'',`${location.pathname}?${params}`);const input=root.querySelector<HTMLInputElement>('[data-hour]');if(input)input.value=String(hour);present?.(0);};
  root.querySelector<HTMLInputElement>('[data-hour]')?.addEventListener('input',event=>setHour(Number((event.target as HTMLInputElement).value)),{signal:lifetime.signal});
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-hour-preset]'))button.addEventListener('click',()=>setHour(Number(button.dataset.hourPreset)),{signal:lifetime.signal});
  root.querySelector<HTMLButtonElement>('[data-cycle]')?.addEventListener('click',event=>{cycle=!cycle;const button=event.target as HTMLButtonElement;button.setAttribute('aria-pressed',String(cycle));button.textContent=cycle?'Pause day cycle':'Play day cycle';},{signal:lifetime.signal});
  draw(selected);
  save.onclick=()=>{save.href=canvas.toDataURL('image/png');};
  if(lightingStudy){let previous=performance.now();const animate=(now:number)=>{if(disposed)return;
    if(now-previous>=1000/30){if(!document.hidden&&!reduced.matches){const dt=Math.min(.05,(now-previous)/1000);if(cycle){skyHour=(skyHour+dt*.4)%24;root.querySelector<HTMLInputElement>('[data-hour]')!.value=String(skyHour);}present?.(dt);}previous=now-((now-previous)%(1000/30));}
    request=requestAnimationFrame(animate);};request=requestAnimationFrame(animate);}
}
void boot().catch(error => {
  if (disposed) return;
  root.setAttribute('aria-busy', 'false'); root.dataset.ready = 'error';
  const message = document.createElement('p'); message.setAttribute('role', 'alert'); message.textContent = String(error); root.replaceChildren(message);
});
function dispose() { disposed = true; cancelAnimationFrame(request); renderer?.reset(); lifetime.abort(); postfx?.dispose(); world?.dispose(); }
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); }, { signal: lifetime.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
