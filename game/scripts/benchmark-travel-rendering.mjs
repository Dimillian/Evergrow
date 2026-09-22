// Frozen runtime rendering only: no browser, simulation ticks or character saves.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
if (!process.env.CANVAS_MODULE) throw new Error('Set CANVAS_MODULE to an installed @napi-rs/canvas module.');
const { createCanvas, Path2D } = require(process.env.CANVAS_MODULE);
let allocations = 0;
globalThis.Path2D = Path2D;
globalThis.document = { createElement: () => {
  allocations++;
  const canvas = createCanvas(1, 1), getContext = canvas.getContext.bind(canvas);
  canvas.getContext = (kind, ...args) => kind === '2d' ? getContext(kind, ...args) : null;
  canvas.addEventListener = () => {};
  return canvas;
} };
const { World } = await import('../src/world.ts');
const { Simulation } = await import('../src/simulation.ts');
const { Renderer } = await import('../src/renderer.ts');
const world = new World(7319), home = world.getPortalAnchor(0);
const sim = new Simulation(world, { spawn: false, startX: home.x, startY: home.y + 35 });
const full = new Renderer(), travel = new Renderer();
const points = [[home.x, home.y + 35], [home.x + 3000, home.y + 3000],
  [home.x, home.y + 35], [home.x + 3000, home.y + 3000], [home.x, home.y + 35]];
const report = [];
try {
  for (const reducedMotion of [true, false]) {
    full.reset(); travel.reset();
    for (const [visit, [x, y]] of points.entries()) {
      sim.relocate(x, y);
      const settings = { phase: 'playing', reducedMotion, fixedCamera: true };
      let before = allocations;
      full.reset(); full.snapTo(sim.player); full.render(sim, world, 1 / 60, settings);
      const fullAllocations = allocations - before;
      before = allocations;
      travel.reset('travel'); travel.snapTo(sim.player); travel.render(sim, world, 1 / 60, settings);
      const travelAllocations = allocations - before;
      const a = full.ctx.getImageData(0, 0, 960, 600).data;
      const b = travel.ctx.getImageData(0, 0, 960, 600).data;
      let differentChannels = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differentChannels++;
      report.push({ reducedMotion, visit, fullAllocations, travelAllocations, differentChannels });
    }
  }
} finally { full.reset(); travel.reset(); world.dispose(); }
console.log(JSON.stringify(report, null, 2));
process.exit(report.some(row => row.differentChannels) ? 1 : 0);
