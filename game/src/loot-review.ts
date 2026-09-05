import { drawEnemyRemains } from './death-art.ts';
import { drawGroundLoot, drawLootLabels, drawResourcePickups } from './loot-art.ts';
import { generateItem } from './items.ts';
import { loadGameFont, text } from './font.ts';
import type { EnemyKind } from './model.ts';
import type { ItemTier } from './character-types.ts';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
if (!import.meta.env.DEV) throw new Error('Local review only');
await loadGameFont();
// Frozen art study. No gameplay ticks, browser storage or input handlers.
const canvas = document.querySelector<HTMLCanvasElement>('#review')!;
const world = new World(7319), sim = new Simulation(world, { spawn: false }), renderer = new Renderer();
const stage = document.createElement('canvas'), fx = new PostFX(stage);
const ages = [.15, .4, 1.2, 12.6];
const kinds: EnemyKind[] = ['stalker', 'brute', 'caster', 'hound', 'archer', 'wisp'];
const tiers: ItemTier[] = ['common', 'magic', 'rare', 'epic', 'legendary'];
const drops = tiers.map((tier, i) => ({ id: 300 + i, x: 100 + i * 190, y: 475,
  item: generateItem(94 + i, 4 + i, i % 2 ? 'head' : 'weapon', undefined, tier) }));
const draw = () => {
  canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio;
  stage.width = canvas.width; stage.height = canvas.height;
  renderer.resize(1000, 600);
  renderer.render(sim, world, 0, { phase: 'ready', reducedMotion: true, debug: false, fps: 60 });
  const c = renderer.ctx;
  c.fillStyle = '#071118d8'; c.fillRect(0, 0, 1000, 600);
  kinds.forEach((kind, row) => ages.forEach((age, column) => {
    drawEnemyRemains(c, { id: row + 1, x: 240 + column * 200, y: 98 + row * 54,
      angle: -.5, facing: 1.2, kind, age, duration: kind === 'wisp' ? 5 : 14 }, false);
  }));
  drawGroundLoot(c, drops, 1, false);
  drawResourcePickups(c, ['health', 'mana'].map((kind, id) => ({ id, kind: kind as 'health' | 'mana', x: 460 + id * 65,
    y: 550, life: 10, radius: 4, restoreFraction: .1 })), 1, true);
  fx.render(renderer.canvas, 0);
  const ui = canvas.getContext('2d')!; ui.drawImage(stage, 0, 0);
  ui.setTransform(canvas.width / 1000, 0, 0, canvas.height / 600, 0, 0);
  text(ui, 'Death & ground loot', 35, 20, 1.7, '#d9e4de');
  ages.forEach((age, i) => text(ui, `${age}s`, 240 + i * 200, 52, 1, '#a3b8bf', 'center', 'interface'));
  kinds.forEach((kind, i) => text(ui, kind, 35, 85 + i * 54, 1.1, '#a3b8bf'));
  drawLootLabels(ui, drops, (x, y) => ({ x, y }), 1000, 600);
  text(ui, 'Health', 460, 565, .9, '#d09b90', 'center'); text(ui, 'Mana', 525, 565, .9, '#9bbbcf', 'center');
};
draw(); window.addEventListener('resize', draw);
if (import.meta.hot) import.meta.hot.dispose(() => { window.removeEventListener('resize', draw); fx.dispose(); world.dispose(); });
