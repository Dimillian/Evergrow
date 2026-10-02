import { GameAudio } from './audio.ts';
import { lootDropEvent } from './loot-drop-presentation.ts';
import { UNIQUES } from './unique-content.ts';
import { generateUnique } from './items.ts';
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
let previewPointer: { x: number; y: number } | null = null;
const world = new World(7319), sim = new Simulation(world, { spawn: false }), renderer = new Renderer();
sim.player.level = 10;
const stage = document.createElement('canvas'), fx = new PostFX(stage);
const params = new URLSearchParams(location.search);
const rarityView = params.has('rarities');
const pickupView = rarityView || params.has('pickup') || (params.has('charms')||params.has('uniques')) || params.has('greater');
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
  if(params.has('uniques'))drops.splice(0,drops.length,...UNIQUES.map((u,i)=>({id:400+i,x:x+(i%3-1)*115,y:y+(Math.floor(i/3)-(Math.ceil(UNIQUES.length/3)-1)/2)*110,item:generateUnique(7319+i,25,u.id)})));
  if(rarityView){
    const samples = [
      generateItem(94,25,'weapon','longsword','common'),
      generateItem(95,25,'head',undefined,'magic'),
      generateItem(96,25,'weapon','crescent-recurve','rare'),
      generateItem(97,25,'boots',undefined,'epic'),
      generateItem(98,25,'weapon','ember-staff','legendary'),
      generateUnique(99,25,'triune-carapace'),
    ];
    drops.splice(0,drops.length,...samples.map((item,i)=>({id:301+i,x:x+(i%3-1)*220,y:y+(i<3?-115:115),item})));
    sim.player.level=25;
  }
  sim.groundItems = drops;
  renderer.cameraX = x; renderer.cameraY = y;
  sim.player.angle = .5;
}
const previewAudio = new GameAudio();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let previewDt = 0;
const controls = document.createElement('div');
if (rarityView) {
  controls.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:20';
  for (const tier of ['legendary', 'unique'] as const) {
    const button = document.createElement('button');
    button.textContent = `Replay ${tier}`;
    button.className = 'ui-button';
    button.style.cssText = 'padding:10px 14px;color:' + (tier === 'unique' ? '#ef91bd' : '#efb776');
    button.onclick = async () => {
      await previewAudio.unlock();
      const drop = drops.find(drop => drop.item.tier === tier)!;
      drop.flight = { x: drop.x - 35, y: drop.y - 10, at: sim.time, delay: 0 };
      const event = lootDropEvent(drop)!;
      renderer.handleEvents([event], reduced.matches);
    };
    controls.append(button);
  }
  document.body.append(controls);
}
const draw = () => {
  canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio;
  stage.width = canvas.width; stage.height = canvas.height;
  const viewWidth=rarityView?innerWidth:1000,viewHeight=rarityView?innerHeight:600;
  if(rarityView){
    const columns=viewWidth<800?2:3,rows=Math.ceil(drops.length/columns);
    const gapX=Math.min(220,viewWidth/(columns+1)),gapY=Math.min(190,(viewHeight-100)/(rows+1));
    for(const [i,drop]of drops.entries()){drop.x=sim.player.x+(i%columns-(columns-1)/2)*gapX;drop.y=sim.player.y+(Math.floor(i/columns)-(rows-1)/2)*gapY;}
  }
  renderer.resize(viewWidth, viewHeight);
  const cue = renderer.lootDrops.advance(drops, sim.time, sim.player);
  if (cue) previewAudio.lootDrop(cue);
  renderer.render(sim, world, previewDt, { phase: 'ready', reducedMotion: rarityView ? reduced.matches : true });
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
  const scale = Math.min(canvas.width / viewWidth, canvas.height / viewHeight);
  const left = (canvas.width - viewWidth * scale) / 2, top = (canvas.height - viewHeight * scale) / 2;
  ui.fillStyle = '#081217'; ui.fillRect(0, 0, canvas.width, canvas.height);
  ui.drawImage(stage, left, top, viewWidth * scale, viewHeight * scale);
  ui.setTransform(scale, 0, 0, scale, left, top);
  if (pickupView) {
    labels = drawLootLabels(ui, drops, (x, y) => renderer.worldToScreen(x, y), viewWidth, viewHeight).map(b => ({
      ...b, x: left + b.x * scale, y: top + b.y * scale, width: b.width * scale, height: b.height * scale,
      anchorX: left + b.anchorX * scale, anchorY: top + b.anchorY * scale,
    }));
    const focus = labels.find(b => b.id === 301)!;
    highlight.update(sim.player, drops, labels, canvas.width, canvas.height,
      params.get('state') === 'hovered' ? { x: focus.x + focus.width / 2, y: focus.y + focus.height / 2 } : previewPointer, sim.time,
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
  previewPointer = event.pointerType === 'touch' ? null : { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  highlight.update(sim.player, drops, labels, canvas.width, canvas.height, previewPointer);
};
const leave = () => { previewPointer = null; highlight.hide(); };
canvas.addEventListener('pointermove', hover); canvas.addEventListener('pointerleave', leave);
draw(); window.addEventListener('resize', draw);
let animation = 0, lastFrame = performance.now();
const animate = (now: number) => {
  if (!document.hidden && now - lastFrame >= 1000 / 30) {
    previewDt = Math.min(.05, (now - lastFrame) / 1000); sim.time += previewDt; lastFrame = now; draw();
  } else if (document.hidden) lastFrame = now;
  animation = requestAnimationFrame(animate);
};
if (rarityView) animation = requestAnimationFrame(animate);
const visibility = () => previewAudio.setForeground(!document.hidden);
document.addEventListener('visibilitychange', visibility);
if (import.meta.hot) import.meta.hot.dispose(() => { cancelAnimationFrame(animation); previewAudio.dispose(); controls.remove(); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('resize', draw); canvas.removeEventListener('pointermove', hover); canvas.removeEventListener('pointerleave', leave); highlight.dispose(); fx.dispose(); world.dispose(); });
