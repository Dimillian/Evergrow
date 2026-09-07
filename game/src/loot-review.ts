import './ui-kit.css';
import './typography.css';
import { installUITheme } from './ui-theme.ts';
import { GroundLootTooltip } from './ground-loot-tooltip.ts';
import type { GroundLootLabel } from './ground-loot-hover.ts';
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
await loadGameFont(); installUITheme();
// Frozen art study with passive item inspection; no gameplay ticks or browser storage.
const canvas = document.querySelector<HTMLCanvasElement>('#review')!;
const tooltip = new GroundLootTooltip(document.body, canvas);
let labels: GroundLootLabel[] = [];
const world = new World(7319), sim = new Simulation(world, { spawn: false }), renderer = new Renderer();
sim.player.level = 10;
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
      angle: -.5, facing: 1.2, kind, age, variant: 0, duration: kind === 'wisp' ? 5 : 14 }, false);
  }));
  drawGroundLoot(c, drops, 1, false);
  drawResourcePickups(c, ['health', 'mana'].map((kind, id) => ({ id, kind: kind as 'health' | 'mana', x: 460 + id * 65,
    y: 550, life: 10, radius: 4, restoreFraction: .1 })), 1, true);
  fx.render(renderer.canvas, 0);
  const ui = canvas.getContext('2d')!;
  const scale = Math.min(canvas.width / 1000, canvas.height / 600);
  const left = (canvas.width - 1000 * scale) / 2, top = (canvas.height - 600 * scale) / 2;
  ui.fillStyle = '#081217'; ui.fillRect(0, 0, canvas.width, canvas.height);
  ui.drawImage(stage, left, top, 1000 * scale, 600 * scale);
  ui.setTransform(scale, 0, 0, scale, left, top);
  text(ui, 'Death & ground loot', 35, 20, 1.7, '#d9e4de');
  ages.forEach((age, i) => text(ui, `${age}s`, 240 + i * 200, 52, 1, '#a3b8bf', 'center', 'interface'));
  kinds.forEach((kind, i) => text(ui, kind, 35, 85 + i * 54, 1.1, '#a3b8bf'));
  labels = drawLootLabels(ui, drops, (x, y) => ({ x, y }), 1000, 600).map(b => ({
    ...b, x: left + b.x * scale, y: top + b.y * scale, width: b.width * scale, height: b.height * scale,
    anchorX: left + b.anchorX * scale, anchorY: top + b.anchorY * scale,
  }));
  text(ui, 'Health', 460, 565, .9, '#d09b90', 'center'); text(ui, 'Mana', 525, 565, .9, '#9bbbcf', 'center');
};
const hover = (event: PointerEvent) => {
  const rect = canvas.getBoundingClientRect();
  tooltip.update(sim.player, drops, [], [], labels, { x: 0, y: 0, width: 1000, height: 600 }, canvas.width, canvas.height,
    event.pointerType === 'touch' ? null : { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height });
};
const leave = () => tooltip.hide();
canvas.addEventListener('pointermove', hover); canvas.addEventListener('pointerleave', leave);
draw(); window.addEventListener('resize', draw);
if (import.meta.hot) import.meta.hot.dispose(() => { window.removeEventListener('resize', draw); canvas.removeEventListener('pointermove', hover); canvas.removeEventListener('pointerleave', leave); tooltip.dispose(); fx.dispose(); world.dispose(); });
