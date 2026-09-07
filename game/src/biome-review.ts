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
let disposed = false, postfx: PostFX | undefined, world: World | undefined;

async function boot() {
  if (!import.meta.env.DEV) throw new Error('Biome studies are available on the local development server only.');
  await loadGameFont(); if (disposed) return;
  const params = new URLSearchParams(location.search);
  const seed=Number(params.get('seed') ?? 7319)>>>0, variant=Math.max(0,Number(params.get('variant')??0)|0);
  world = new World(seed);
  const sceneWorld = world, scenes = biomeReviewScenes(sceneWorld,BIOME_IDS,variant);
  scenes.push({ id: 'origin', name: `The first steps · ${world.sampleBiome(0, 0).name}`, description: 'The starting wilderness at world origin. A frozen scene from the current procedural renderer.', x: 0, y: -100 });
  const renderer = new Renderer();
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1100;
  canvas.className = 'layout-review-scene'; canvas.style.aspectRatio = '1600 / 1100'; canvas.setAttribute('role', 'img');
  const c = canvas.getContext('2d', { alpha: false })!;
  const display = document.createElement('canvas'); display.width = 1600; display.height = 1100;
  root.innerHTML = `<header class="layout-review-header"><div><h1></h1></div><p class="layout-review-static">World generation ${WORLD_GENERATION_VERSION} · Seed ${seed}</p></header>
    <div class="layout-review-toolbar"><nav class="layout-review-views" aria-label="Biomes and transitions"></nav><button class="landscape-next">Another area</button><select style="font:inherit;color:#dddbc9;background:#132027;border:1px solid #40534f;padding:10px;border-radius:3px" class="landscape-seed" aria-label="World seed">${[7319,18427,90210].map(n=>`<option value="${n}" ${n===seed?'selected':''}>Seed ${n}</option>`).join('')}</select><a class="layout-review-download">Save PNG</a></div>
    <figure class="layout-review-figure"><div class="layout-review-frame"></div><figcaption class="layout-review-caption"><p class="layout-review-description"></p><p class="layout-review-location"></p></figcaption></figure>
    <p class="layout-review-status" role="status"></p>`;
  root.querySelector('.layout-review-frame')!.append(canvas);
  root.querySelector('.landscape-next')!.addEventListener('click',()=>{params.set('variant',String(variant+1));location.search=params.toString();},{signal:lifetime.signal});
  root.querySelector('.landscape-seed')!.addEventListener('change',e=>{params.set('seed',(e.target as HTMLSelectElement).value);params.delete('variant');location.search=params.toString();},{signal:lifetime.signal});
  const title = root.querySelector('h1')!, description = root.querySelector('.layout-review-description')!;
  const save = root.querySelector<HTMLAnchorElement>('.layout-review-download')!;
  const buttons = new Map<string, HTMLButtonElement>();
  let selected = scenes.find(scene => scene.id === params.get('view')) ?? scenes.find(s=>s.id==='deadwood') ?? scenes[0];
  function draw(scene: BiomeReviewScene) {
    if (disposed) return;
    selected = scene;
    let playerX = scene.x, playerY = scene.y + 100;
    for (let ring = 0; ring < 12; ring++) {
      let clear = false;
      for (let i = 0; i < 12; i++) {
        const x = scene.x + Math.cos(i * Math.PI / 6) * ring * 14;
        const y = scene.y + 100 + Math.sin(i * Math.PI / 6) * ring * 14;
        if (!sceneWorld.blocked(x, y, 13)) { playerX = x; playerY = y; clear = true; break; }
      }
      if (clear) break;
    }
    // Pose only. No simulation steps, enemy spawning, input, exploration, or save reads.
    const sim = new Simulation(sceneWorld, { seed, spawn: false, startX: playerX, startY: playerY });
    sim.time = 12; sim.player.angle = -Math.PI / 2;
    renderer.reset(); renderer.resize(800, 550); renderer.cameraX = scene.x; renderer.cameraY = scene.y - 20;
    renderer.render(sim, sceneWorld, 1, { phase: 'paused', reducedMotion: true, fps: 0, debug: false });
    postfx ??= new PostFX(display); postfx.render(renderer.canvas, 0);
    c.drawImage(display, 0, 0);
    title.textContent = scene.name; description.textContent = scene.description;
    root.querySelector('.layout-review-location')!.textContent = `${scene.x}, ${scene.y} · Frozen world renderer / CRT`;
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
  draw(selected);
}
void boot().catch(error => {
  if (disposed) return;
  root.setAttribute('aria-busy', 'false'); root.dataset.ready = 'error';
  const message = document.createElement('p'); message.setAttribute('role', 'alert'); message.textContent = String(error); root.replaceChildren(message);
});
function dispose() { disposed = true; lifetime.abort(); postfx?.dispose(); world?.dispose(); }
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); }, { signal: lifetime.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
