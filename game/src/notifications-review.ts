import './ui-kit.css';
import './style.css';
import './typography.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { GameNotifications } from './notifications.ts';
import { generateItem } from './items.ts';
import { Lifetime } from './lifetime.ts';
import { LootLogPanel } from './loot-log-panel.ts';
import { recordLoot } from './loot-log.ts';
if (!import.meta.env.DEV) throw new Error('Local review only.');
installUITheme(); await loadGameFont();
// Frozen presentation using real renderers: no simulation input, ticks or saved state.
const life = new Lifetime(), world = life.own(new World(7319));
const sim = new Simulation(world, { spawn: false });
const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = '<div class="game-shell"><canvas id="review-world"></canvas><canvas id="game-ui"></canvas></div>';
const shell = root.querySelector<HTMLElement>('.game-shell')!;
const canvas = root.querySelector<HTMLCanvasElement>('#review-world')!, ui = root.querySelector<HTMLCanvasElement>('#game-ui')!;
const renderer = new Renderer(), fx = life.own(new PostFX(canvas));
const log = life.own(new LootLogPanel(shell, () => { log.close(); notices.setLootLog(true, sim.lootLog.length); }));
const openLog = () => { notices.setLootLog(false, sim.lootLog.length); log.open({ entries:sim.lootLog, sheet:sim.player.character, level:sim.player.level, time:sim.time, ground:sim.groundItems }); };
const notices = life.own(new GameNotifications(shell, { autoAdvance: false, openLootLog:openLog }));
const mode = new URLSearchParams(location.search).get('view');
if (mode === 'loot-log') {
  sim.time = 500;
  for (const [index, kind] of (['weapon','ring','head','boots','weapon'] as const).entries()) {
    const item = generateItem(900 + index, 1, kind, undefined, index % 2 ? 'magic' : 'rare');
    recordLoot(sim.lootLog, item, index * 110, 'Verdant Forest');
    if (index === 0) sim.lootLog[0].sold = true;
    else if (index === 1) sim.player.character.equipped.ring1 = item;
    else if (index === 2) sim.player.character.stash = [item];
    else sim.player.character.inventory[index] = item;
  }
  openLog();
  shell.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.defaultPrevented) { log.close(); notices.setLootLog(true, sim.lootLog.length); } });
}
if (mode === 'discovery') notices.push({ kind: 'discovery', poi: { id: 'review-town', kind: 'town', name: 'Briarwatch', x: 0, y: 0, description: '' } });
else if (mode === 'area') notices.push({ kind: 'area', id: 'swamp', name: 'The Mire', level: 4 });
if (mode === 'loot-log') for (const entry of sim.lootLog.slice(-2)) notices.push({ kind:'loot', item:entry.item });
else {
  notices.push({ kind: 'loot', item: generateItem(94, 5, 'weapon', 'longsword', 'rare') });
  notices.push({ kind: 'loot', item: generateItem(138, 4, 'boots', undefined, 'magic') });
  notices.push({ kind: 'loot', item: generateItem(279, 4, 'head', undefined, 'common') });
}
const draw = () => {
  const ratio = devicePixelRatio || 1;
  canvas.width = ui.width = Math.round(innerWidth * ratio); canvas.height = ui.height = Math.round(innerHeight * ratio);
  renderer.resize(Math.round(600 * innerWidth / innerHeight), 600);
  renderer.cameraX = sim.player.x; renderer.cameraY = sim.player.y;
  const settings = { phase: 'playing' as const, reducedMotion: true };
  renderer.render(sim, world, 0, settings); fx.render(renderer.canvas, 0);
  const context = ui.getContext('2d')!;
  context.setTransform(ui.width / renderer.width, 0, 0, ui.height / renderer.height, 0, 0);
  renderer.renderUI(context, sim, world, settings);
};
draw(); const abort = new AbortController();
window.addEventListener('resize', draw, { signal: abort.signal }); life.defer(() => abort.abort());
if (import.meta.hot) import.meta.hot.dispose(() => life.dispose());
