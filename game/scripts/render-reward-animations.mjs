/** Native Canvas animation exports; authored presentation only, no gameplay ticks or saves.
 * CANVAS_MODULE=/path/to/@napi-rs/canvas node --experimental-strip-types scripts/render-reward-animations.mjs /output
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
if (!process.env.CANVAS_MODULE || !process.argv[2]) throw new Error('Provide CANVAS_MODULE and an output directory.');
const { createCanvas, GlobalFonts, Path2D } = require(process.env.CANVAS_MODULE);
globalThis.Path2D = Path2D;
globalThis.document = { createElement: () => createCanvas(1, 1), querySelector: () => null };
const source = new URL('../src/', import.meta.url);
for (const [file, name] of [['PixelifySans-Variable.ttf','Pixelify Sans'], ['Barlow-Medium.ttf','Evergrow Numerals']])
  GlobalFonts.registerFromPath(fileURLToPath(new URL('assets/fonts/' + file, source)), name);
const { World } = await import(new URL('world.ts', source));
const { Renderer } = await import(new URL('renderer.ts', source));
const { Simulation } = await import(new URL('simulation.ts', source));
const { resetRewardScene, rewardSceneEvents } = await import(new URL('reward-review-scene.ts', source));
const world = new World(7319), renderer = new Renderer(), sim = new Simulation(world, { spawn: false });
const canvas = createCanvas(840, 560), c = canvas.getContext('2d');
const settings = { phase: 'playing', reducedMotion: false, fps: 20, debug: false };
for (const scene of ['level', 'xp', 'gold', 'burst']) {
  const dir = resolve(process.argv[2], scene); mkdirSync(dir, { recursive: true });
  resetRewardScene(sim, scene); renderer.reset(); renderer.resize(840, 560); renderer.snapTo(sim.player);
  renderer.render(sim, world, 0, settings);
  for (let i = 0; i < 120; i++) {
    const events = rewardSceneEvents(sim, scene, i / 20, (i + 1) / 20);
    renderer.handleEvents(events, false); renderer.render(sim, world, .05, settings);
    c.drawImage(renderer.canvas, 0, 0); renderer.renderUI(c, sim, world, settings);
    writeFileSync(resolve(dir, `${String(i).padStart(3, '0')}.png`), canvas.toBuffer('image/png'));
  }
  console.log(scene);
}
world.dispose(); process.exit(0);
