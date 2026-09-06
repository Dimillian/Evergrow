/** Native Canvas water exports; authored presentation only, no gameplay ticks or saves.
 * CANVAS_MODULE=/path/to/@napi-rs/canvas node --experimental-strip-types scripts/render-water-animations.mjs /output
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
const { waterReviewScene, stageWaterScene } = await import(new URL('water-review-scene.ts', source));
const world = new World(Number(process.env.WATER_SEED ?? 7319)), renderer = new Renderer();
renderer.resize(960, 620);
const settings = { phase: 'playing', reducedMotion: false, fps: 20, debug: false };
for (const kind of ['river', 'lake']) {
  const scene = waterReviewScene(world, kind), sim = new Simulation(world, { spawn: false, startX: scene.x, startY: scene.y });
  const dir = resolve(process.argv[2], kind); mkdirSync(dir, { recursive: true });
  renderer.reset();
  // Complete static terrain before recording the authored presentation.
  for (let y = Math.floor((scene.y - 500) / 256); y <= Math.floor((scene.y + 400) / 256); y++)
    for (let x = Math.floor((scene.x - 600) / 256); x <= Math.floor((scene.x + 600) / 256); x++) world.getGroundTile(x, y);
  const start = performance.now();
  for (let i = 0; i < 240; i++) {
    renderer.cameraX = scene.x; renderer.cameraY = scene.y - 80;
    const events = stageWaterScene(sim, scene, i / 20, (i + 1) / 20);
    renderer.handleEvents(events, false); renderer.render(sim, world, .05, settings);
    if (process.env.WATER_FRAMES || [0, 69, 105, 167, 193, 239].includes(i)) writeFileSync(resolve(dir, `${String(i).padStart(3, '0')}.png`), renderer.canvas.toBuffer('image/png'));
  }
  console.log(kind, scene, 'ms/frame', (performance.now() - start) / 240);
}
world.dispose(); process.exit(0);
