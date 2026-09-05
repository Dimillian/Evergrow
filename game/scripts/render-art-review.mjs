/** Static CPU exports using the actual game Renderer. No browser, simulation ticks or save access.
 * Supply an already-installed @napi-rs/canvas path; it is not a game dependency.
 * node scripts/render-art-review.mjs /path/to/@napi-rs/canvas /output/directory [source-directory]
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
if (!process.argv[2] || !process.argv[3]) throw new Error('Provide the installed Canvas package path and output directory.');
const { createCanvas, GlobalFonts } = require(resolve(process.argv[2]));
const source = process.argv[4] ? pathToFileURL(resolve(process.argv[4]) + '/') : new URL('../src/', import.meta.url);
GlobalFonts.registerFromPath(fileURLToPath(new URL('assets/fonts/PixelifySans-Variable.ttf', source)), 'Pixelify Sans');
globalThis.document = { createElement(tag) { if (tag !== 'canvas') throw new Error(tag); return createCanvas(1, 1); }, querySelector() { return null; } };
const { World, mainPathX } = await import(new URL('world.ts', source));
const { Renderer } = await import(new URL('renderer.ts', source));
const { Simulation } = await import(new URL('simulation.ts', source));
const { biomeReviewScenes } = await import(new URL('biome-review-data.ts', source));
const { FIRST_TOWN_Y } = await import(new URL('settlements.ts', source));
const world = new World(7319), renderer = new Renderer();
const scenes = biomeReviewScenes(world).map(scene => ({ ...scene, width: 800, height: 550,
  camera: { x: scene.x, y: scene.y - 20 }, hero: { x: scene.x, y: scene.y + 100 } }));
const town = world.getSettlements(mainPathX(FIRST_TOWN_Y) - 1, FIRST_TOWN_Y - 1, 2, 2)
  .find(town => town.y === FIRST_TOWN_Y);
const forge = town.buildings.find(b => b.kind === 'blacksmith');
const junction = { x: mainPathX(forge.door.y + 27), y: forge.door.y + 27 };
scenes.push({ id: 'town-street', name: `${town.name} / ${forge.name}`, width: 605, height: 420,
  camera: { x: (forge.x + forge.width / 2 + junction.x) / 2, y: forge.y + forge.height * .55 - 15 },
  hero: { x: (junction.x + forge.door.x) / 2, y: junction.y } });
const sites = world.getWildernessSites(-8000, -8000, 16000, 16000);
const stones = sites.filter(s => s.kind === 'standingStones').sort((a,b) => Math.hypot(a.x,a.y) - Math.hypot(b.x,b.y))[0];
scenes.push({ id: 'standing-stones', name: stones.name, width: 720, height: 500,
  camera: { x: stones.x, y: stones.y - 20 }, hero: { x: stones.x, y: stones.y + 158 } });
const output = resolve(process.argv[3]); mkdirSync(output, { recursive: true });
const exports = [];
for (const scene of scenes) {
 let px = scene.hero.x, py = scene.hero.y;
 outer: for (let ring = 0; ring < 12; ring++) for (let i = 0; i < 12; i++) {
  const x = scene.hero.x + Math.cos(i * Math.PI / 6) * ring * 14;
  const y = scene.hero.y + Math.sin(i * Math.PI / 6) * ring * 14;
  if (!world.blocked(x, y, 13)) { px = x; py = y; break outer; }
 }
 const sim = new Simulation(world, { seed: 7319, spawn: false, startX: px, startY: py });
 sim.time = 12; sim.player.angle = -Math.PI / 2;
 renderer.reset(); renderer.resize(scene.width, scene.height);
 renderer.cameraX = scene.camera.x; renderer.cameraY = scene.camera.y;
 renderer.render(sim, world, 1, { phase: 'paused', reducedMotion: true, fps: 0, debug: false });
 const height = Math.round(1600 * scene.height / scene.width), image = createCanvas(1600, height + 92), c = image.getContext('2d');
 c.fillStyle = '#091318'; c.fillRect(0, 0, image.width, image.height);
 c.font = '25px "Pixelify Sans"'; c.fillStyle = '#ddd3ae'; c.fillText(scene.name, 24, 36);
 c.font = '14px "Pixelify Sans"'; c.fillStyle = '#96aba3';
 c.textAlign = 'right'; c.fillText('EVERGROW / PROCEDURAL WORLD ART', 1576, 33); c.textAlign = 'left';
 c.imageSmoothingEnabled = false; c.drawImage(renderer.canvas, 0, 55, 1600, height);
 c.font = '13px "Pixelify Sans"'; c.fillStyle = '#96aba3';
 c.fillText('SEED 7319 · FROZEN ACTUAL RENDERER · CANVAS BEFORE CRT · NO GAMEPLAY OR SAVE ACCESS', 24, image.height - 13);
 writeFileSync(resolve(output, scene.id + '.png'), image.toBuffer('image/png'));
 exports.push({ id: scene.id, name: scene.name, camera: scene.camera, width: scene.width, height: scene.height, hero: { x: px, y: py } });
 console.log(scene.id);
}
writeFileSync(resolve(output, 'scenes.json'), JSON.stringify(exports, null, 2) + '\n');
world.dispose();
