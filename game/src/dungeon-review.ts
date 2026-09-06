import './typography.css';
import './layout-review.css';
import { loadGameFont } from './font.ts';
import { generateDungeon, type DungeonEntrance } from './dungeon.ts';
import { DungeonWorld } from './dungeon-world.ts';
import { createDungeonRun, emptyContents } from './dungeon-state.ts';
import { drawDungeonMap, dungeonMapBounds } from './dungeon-map.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { Simulation } from './simulation.ts';
const root = document.querySelector<HTMLElement>('#dungeon-review')!, abort = new AbortController();
let fx: PostFX | undefined, world: DungeonWorld | undefined, disposed = false;
async function boot() {
    if (!import.meta.env.DEV)
        throw new Error('Local review only');
    await loadGameFont();
    if (disposed)
        return;
    const params = new URLSearchParams(location.search), seed = Number(params.get('seed') ?? 7319) >>> 0;
    const entrance: DungeonEntrance = { id: 'dungeon:review', name: 'Rootbound Crypt', seed, level: 3, biome: 'deadwood', x: -520, y: 380 };
    const floor = generateDungeon(seed, 3), run = createDungeonRun(entrance);
    world = new DungeonWorld(floor, entrance);
    const scene = world, renderer = new Renderer();
    root.innerHTML = '<header class="layout-review-header"><h1>Rootbound Crypt</h1></header><nav class="layout-review-toolbar"><button data-view="entry">Entrance</button><button data-view="chamber">Burial chamber</button><button data-view="boss">Hollow Warden</button><button data-view="map">Explored floor</button></nav><figure class="layout-review-figure layout-review-frame"><canvas class="layout-review-scene" aria-label="Frozen dungeon preview"></canvas></figure>';
    const canvas = root.querySelector('canvas')!, c = canvas.getContext('2d')!;
    canvas.width = 1440;
    canvas.height = 1000;
    const output = document.createElement('canvas');
    output.width = 1440;
    output.height = 1000;
    fx = new PostFX(output);
    function draw(view: string) {
        const room = floor.rooms[view === 'boss' ? 12 : view === 'chamber' ? 4 : 0], x = room.x + room.width / 2, y = room.y + room.height / 2;
        const sim = new Simulation(scene, { spawn: false, startX: x, startY: y + 150 });
        sim.expeditions = { location: entrance.id, runs: [run], surface: emptyContents(), surfaceX: 0, surfaceY: 0 };
        sim.dungeonFloor = floor;
        if (view === 'map') {
            run.explored = floor.rooms.map(r => r.id);
            const bounds = dungeonMapBounds(floor);
            drawDungeonMap(c, floor, run, { x: 0, y: 0, angle: 0 }, { x: 0, y: 0, width: 1440, height: 1000 }, Math.min(1300 / bounds.width, 900 / bounds.height), bounds.x, bounds.y);
        }
        else {
            for (const m of floor.members.filter(m => m.room === room.id && !m.wave)) {
                const e = sim.spawnEnemy(m.kind, m.x, m.y, m.rank, { campId: entrance.id, memberId: m.id, lootSeed: m.seed });
                if (e && m.id === 'warden') {
                    e.state = 'windup';
                    e.stateTime = .55;
                    e.stateDuration = 1;
                    e.bossMove = 'fracture';
                    e.attackAngle = Math.PI / 2;
                }
            }
            renderer.reset();
            renderer.resize(720, 500);
            renderer.cameraX = x;
            renderer.cameraY = y;
            renderer.render(sim, scene, 0, { phase: 'paused', reducedMotion: true, fps: 0, debug: false });
            fx!.render(renderer.canvas, 0);
            c.drawImage(output, 0, 0);
                c.save();c.scale(2,2);renderer.renderUI(c,sim,scene,{phase:'paused',reducedMotion:true,fps:0,debug:false});c.restore();
        }
        params.set('view', view);
        history.replaceState(null, '', `?${params}`);
        root.dataset.ready = 'true';
    }
    for (const b of root.querySelectorAll<HTMLButtonElement>('button'))
        b.addEventListener('click', () => draw(b.dataset.view!), { signal: abort.signal });
    draw(params.get('view') ?? 'entry');
}
void boot().catch(e => root.textContent = String(e));
function dispose() { disposed = true; abort.abort(); fx?.dispose(); world?.dispose(); }
window.addEventListener('pagehide', dispose, { signal: abort.signal });
if (import.meta.hot)
    import.meta.hot.dispose(dispose);
