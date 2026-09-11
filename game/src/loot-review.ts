import { drawMaterialBurst } from './material-response-art.ts';
import { createMaterialBurst } from './material-response.ts';
import { MATERIALS, type MaterialId } from './material-content.ts';
import { drawSiteDecor } from './wilderness-art.ts';
import { startingEnemyCamp } from './wilderness-sites.ts';
import './ui-kit.css';
import './typography.css';
import { installUITheme } from './ui-theme.ts';
import { GroundLootHighlight } from './ground-loot-highlight.ts';
import type { GroundLootLabel } from './ground-loot-hover.ts';
import { drawEnemyRemains } from './death-art.ts';
import { drawGroundLoot, drawLootLabels, drawResourcePickups } from './loot-art.ts';
import { generateItem, deriveItem } from './items.ts';
import { loadGameFont, text } from './font.ts';
import type { EnemyKind } from './model.ts';
import type { GroundItem, ItemTier } from './character-types.ts';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
if (!import.meta.env.DEV) throw new Error('Local review only');
await loadGameFont(); installUITheme();
// Frozen art study with ground highlights and corner item tooltips; no gameplay ticks or browser storage.
const canvas = document.querySelector<HTMLCanvasElement>('#review')!;
const highlight = new GroundLootHighlight(document.body, canvas);
let labels: GroundLootLabel[] = [];
const world = new World(7319), sim = new Simulation(world, { spawn: false }), renderer = new Renderer();
sim.player.level = 10;
const stage = document.createElement('canvas'), fx = new PostFX(stage);
const params = new URLSearchParams(location.search);
const pickupView = params.has('pickup') || params.has('charms') || params.has('greater');
const deathElement = params.get('element');
const materialsView = new URLSearchParams(location.search).has('materials');
const containersView = new URLSearchParams(location.search).has('containers');
const ages = [.15, .4, 1.2, 12.6];
const kinds: EnemyKind[] = ['stalker', 'brute', 'caster', 'hound', 'archer', 'wisp'];
const tiers: ItemTier[] = ['common', 'magic', 'rare', 'epic', 'legendary'];
const drops: GroundItem[] = tiers.map((tier, i) => ({ id: 300 + i, x: 100 + i * 190, y: 475,
  item: generateItem(94 + i, 4 + i, i % 2 ? 'head' : 'weapon', undefined, tier) }));
if (pickupView) {
  const { x, y } = sim.player;
  drops.splice(0, drops.length,
    { id: 301, x: x + 95, y: y - 15, item: generateItem(99, 8, 'weapon', 'longsword', 'magic') },
    { id: 302, x: x - 100, y: y + 30, item: generateItem(102, 8, 'boots', undefined, 'rare') },
    { id: 303, x: x + 25, y: y + 95, item: generateItem(104, 8, 'ring', undefined, 'common') });
  if (params.has('charms')) drops.push(
    {id:304,x:x-110,y:y-85,item:generateItem(105,8,'charm','jade-pebble','common')},
    {id:305,x:x+10,y:y-95,item:generateItem(106,12,'charm','rime-shard','magic')},
    {id:306,x:x+125,y:y+75,item:generateItem(107,20,'charm','astral-monolith','epic')});
  if (params.has('greater')) {
    drops[0].item = generateItem(99, 35, 'weapon', 'ember-staff', 'legendary');
    drops[0].item.recipe.rolls = drops[0].item.recipe.rolls.map((_, i) => i === 0 || i === 2 ? .97 : .5);
    drops[0].item = deriveItem(drops[0].item);
    drops[1].item = generateItem(102, 35, 'gloves', undefined, 'epic', 'cloth');
    drops[1].item.recipe.rolls = drops[1].item.recipe.rolls.map(() => .5);
    drops[1].item = deriveItem(drops[1].item);
    const stone = generateItem(107, 35, 'charm', 'astral-monolith', 'epic');
    stone.recipe.rolls = stone.recipe.rolls.map((_, i) => i === 0 ? .97 : .5);
    drops[2].item = deriveItem(stone);
    sim.player.level = 35;
  }
  sim.groundItems = drops;
  renderer.cameraX = x; renderer.cameraY = y;
  sim.player.angle = .5;
}
const draw = () => {
  canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio;
  stage.width = canvas.width; stage.height = canvas.height;
  renderer.resize(1000, 600);
  renderer.render(sim, world, 0, { phase: 'ready', reducedMotion: true, debug: false, fps: 60 });
  const c = renderer.ctx;
  if (!pickupView) { c.fillStyle = '#071118d8'; c.fillRect(0, 0, 1000, 600); }
  if (!containersView && !materialsView && !pickupView) {
  kinds.forEach((kind, row) => ages.forEach((age, column) => {
    drawEnemyRemains(c, { id: row + 1, x: 240 + column * 200, y: 98 + row * 54,
      angle: -.5, facing: 1.2, kind, age, ...(deathElement === 'frost' || deathElement === 'fire' ? { element: deathElement } : {}), variant: 0, duration: kind === 'wisp' ? 5 : 14 }, false);
  }));
  drawGroundLoot(c, drops, 1, false);
  drawResourcePickups(c, ['health', 'mana'].map((kind, id) => ({ id, kind: kind as 'health' | 'mana', x: 460 + id * 65,
    y: 550, life: 10, radius: 4, restoreFraction: .1 })), 1, true);
  } else if (materialsView) {
    (Object.keys(MATERIALS) as MaterialId[]).forEach((material, col) => {
      for (let row = 0; row < 2; row++) { c.save(); c.translate(85 + col * 140, 235 + row * 230); c.scale(1.8, 1.8);
        drawMaterialBurst(c, { ...createMaterialBurst({ x: 0, y: 0, angle: -.5, seed: 372, material, count: 18, strength: 1 }), age: row ? .7 : .2 }, false); c.restore(); }
    });
  } else if (containersView) {
    const site = startingEnemyCamp(7319);
    for (const [row, kind] of (['crate', 'barrel'] as const).entries()) for (let col = 0; col < 5; col++) {
      const source = site.decor.find(d => d.kind === kind)!;
      c.save(); c.translate(120 + col * 190, 215 + row * 215); c.scale(2.5, 2.5);
      if (col === 0) drawSiteDecor(c, site, { ...source, x: 0, y: 0 }, 0);
      else drawMaterialBurst(c, { ...createMaterialBurst({ x: 0, y: 0, material: 'wood', count: 14, strength: 1, hoops: kind === 'barrel' ? 2 : 0,
        seed: source.seed, angle: -.5 }), age: [.08, .08, .28, 1.2, 5.8][col] }, false);
      c.restore();
    }
  }
  fx.render(renderer.canvas, 0);
  const ui = canvas.getContext('2d')!;
  const scale = Math.min(canvas.width / 1000, canvas.height / 600);
  const left = (canvas.width - 1000 * scale) / 2, top = (canvas.height - 600 * scale) / 2;
  ui.fillStyle = '#081217'; ui.fillRect(0, 0, canvas.width, canvas.height);
  ui.drawImage(stage, left, top, 1000 * scale, 600 * scale);
  ui.setTransform(scale, 0, 0, scale, left, top);
  if (pickupView) {
    labels = drawLootLabels(ui, drops, (x, y) => renderer.worldToScreen(x, y), 1000, 600).map(b => ({
      ...b, x: left + b.x * scale, y: top + b.y * scale, width: b.width * scale, height: b.height * scale,
      anchorX: left + b.anchorX * scale, anchorY: top + b.anchorY * scale,
    }));
    const focus = labels.find(b => b.id === 301)!;
    highlight.update(sim.player, drops, labels, canvas.width, canvas.height,
      params.get('state') === 'hovered' ? { x: focus.x + focus.width / 2, y: focus.y + focus.height / 2 } : null, sim.time,
      params.get('state') === 'collecting' ? 301 : null);
  } else if (!containersView && !materialsView) {
  text(ui, 'Death & ground loot', 35, 20, 1.7, '#d9e4de');
  ages.forEach((age, i) => text(ui, `${age}s`, 240 + i * 200, 52, 1, '#a3b8bf', 'center', 'interface'));
  kinds.forEach((kind, i) => text(ui, kind, 35, 85 + i * 54, 1.1, '#a3b8bf'));
  labels = drawLootLabels(ui, drops, (x, y) => ({ x, y }), 1000, 600).map(b => ({
    ...b, x: left + b.x * scale, y: top + b.y * scale, width: b.width * scale, height: b.height * scale,
    anchorX: left + b.anchorX * scale, anchorY: top + b.anchorY * scale,
  }));
  text(ui, 'Health', 460, 565, .9, '#d09b90', 'center'); text(ui, 'Mana', 525, 565, .9, '#9bbbcf', 'center');
  } else if (materialsView) {
    text(ui, 'Material responses', 35, 30, 1.7, '#d9e4de');
    Object.keys(MATERIALS).forEach((name, i) => text(ui, name, 85 + i * 140, 85, 1.15, '#a3b8bf', 'center'));
    text(ui, 'Impact', 35, 120, .9, '#a3b8bf'); text(ui, 'Aftermath', 35, 355, .9, '#a3b8bf');
  } else {
    text(ui, 'Breakable containers', 35, 30, 1.7, '#d9e4de');
    ['Intact', 'Impact', 'Splinters', 'Settled', 'Fading'].forEach((label, i) => text(ui, label, 120 + i * 190, 78, 1.1, '#a3b8bf', 'center'));
  }
};
const hover = (event: PointerEvent) => {
  const rect = canvas.getBoundingClientRect();
  highlight.update(sim.player, drops, labels, canvas.width, canvas.height,
    event.pointerType === 'touch' ? null : { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height });
};
const leave = () => highlight.hide();
canvas.addEventListener('pointermove', hover); canvas.addEventListener('pointerleave', leave);
draw(); window.addEventListener('resize', draw);
if (import.meta.hot) import.meta.hot.dispose(() => { window.removeEventListener('resize', draw); canvas.removeEventListener('pointermove', hover); canvas.removeEventListener('pointerleave', leave); highlight.dispose(); fx.dispose(); world.dispose(); });
