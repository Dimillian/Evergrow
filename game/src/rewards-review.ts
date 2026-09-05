import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
if (!import.meta.env.DEV) throw new Error('Local review only');
await loadGameFont();
// Fixed presentation sample: no gameplay ticks, input handlers, audio or save access.
const canvas = document.querySelector<HTMLCanvasElement>('#review')!;
const world = new World(7319), sim = new Simulation(world, { spawn: false }), renderer = new Renderer();
const stage = document.createElement('canvas'), fx = new PostFX(stage);
renderer.pointerActive = false;
sim.groundGold = [7, 18, 52].map((amount, i) => ({ id: 600 + i, x: sim.player.x - 55 + i * 55,
  y: sim.player.y + 45, amount, age: 1 }));
const draw = () => {
  canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio;
  stage.width = canvas.width; stage.height = canvas.height;
  const height = 540, width = height * innerWidth / innerHeight;
  renderer.reset(); renderer.resize(width, height);
  renderer.cameraX = sim.player.x; renderer.cameraY = sim.player.y;
  sim.player.character.gold = 120; sim.player.xp = 5;
  const settings = { phase: 'playing' as const, reducedMotion: false, debug: false, fps: 60 };
  renderer.render(sim, world, 0, settings);
  sim.player.character.gold = 137; sim.player.xp = 45;
  renderer.handleEvents([{ type: 'gold', amount: 17, balance: 137, x: sim.player.x - 25, y: sim.player.y + 20 },
    { type: 'experience', amount: 40, x: sim.player.x + 85, y: sim.player.y - 20 }], false);
  renderer.render(sim, world, .4, settings);
  fx.render(renderer.canvas, 0);
  const ui = canvas.getContext('2d')!; ui.setTransform(1, 0, 0, 1, 0, 0); ui.drawImage(stage, 0, 0);
  ui.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  renderer.renderUI(ui, sim, world, settings);
};
draw(); window.addEventListener('resize', draw);
if (import.meta.hot) import.meta.hot.dispose(() => { window.removeEventListener('resize', draw); fx.dispose(); world.dispose(); });
