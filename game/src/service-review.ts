import { planBulkSale } from './commerce-bulk.ts';
import { sortInventory } from './inventory-tools.ts';
import './ui-kit.css';
import './style.css';
import './typography.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { GameShell } from './game-shell.ts';
import { ServicePanel } from './service-panel.ts';
import { SkillAssignmentPanel } from './skill-assignment-panel.ts';
import { assignEmptySkill } from './skill-assignment.ts';
import { drawFloatingHUD } from './hud.ts';
import { getHUDSkillRect } from './hud-layout.ts';
import { buildingNPC, type TownNPC } from './npcs.ts';
import type { ItemKind } from './character-types.ts';
import type { Improvement } from './item-improvement.ts';
import { generateItem, deriveItem, createCharacterSheet } from './items.ts';
import { planService } from './commerce.ts';
import { refreshCharacter } from './character.ts';
import { Lifetime } from './lifetime.ts';

// Frozen review: no simulation updates, persistence, input or live character access.
if (!import.meta.env.DEV) throw new Error('Local review only.');
installUITheme(); await loadGameFont();
const life = new Lifetime(), world = life.own(new World(7319)), sim = new Simulation(world, { spawn: false });
const params = new URLSearchParams(location.search), role = params.get('role') ?? 'blacksmith';
const npc = world.getBuildings(-1500, params.has('distant') ? 26000 : -2200, 3000, params.has('distant') ? 3200 : 1600).map(buildingNPC).find((n): n is TownNPC => n?.role === role)!;
const p = sim.player; p.x = p.prevX = npc.x; p.y = p.prevY = npc.y + 30; p.level = 12;
const skillReview = params.get('view') === 'skills';
if (skillReview) {
  p.character = createCharacterSheet('sword-shield');
  p.character.allocatedNodes = ['origin', ...['cleave', 'lunge', 'whirlwind', 'shieldBash', 'bulwark', 'fireball'].map(id => `skill:${id}`)];
  p.character.skillSlots[0] = 'cleave';
}
p.character.statPoints = 55; p.character.skillPoints = 11; p.character.gold = 200_000;
for (let i = 0; i < (params.has('empty') ? 0 : 18); i++) {
  const item = generateItem(780 + i * 93, 6 + i % 3, ['weapon', 'shield', 'ring', 'chest', 'amulet', 'boots'][i % 6] as ItemKind, undefined,
    (['common', 'magic', 'rare', 'epic'] as const)[i % 4]);
  item.recipe.enhancement = [0, 5, 10][i % 3]; p.character.inventory[i] = deriveItem(item);
}
refreshCharacter(p);
const shell = life.own(new GameShell(document.querySelector('#app')!, { play() {}, returnToTitle() {}, openMap() {}, openCharacter() {}, openSkills() {} }));
const panel: ServicePanel = life.own(new ServicePanel(shell.panelMount, { close: () => panel.close(), sort: mode => { sortInventory(p.character, mode); panel.refresh(p); }, trade: async quote => {
  const plan = 'type' in quote ? planBulkSale(p.character, npc, p.level, quote) : planService(p.character, npc, p.level, quote);
  if (plan.ok) { p.character = plan.character; refreshCharacter(p); }
  return { ok: plan.ok, message: plan.message };
} }));
const picker: SkillAssignmentPanel = life.own(new SkillAssignmentPanel(shell.panelMount, {
  close: () => picker.close(), assign: async (slot, skill) => { const result = assignEmptySkill(p, slot, skill); draw(); return result; },
}));
const renderer = new Renderer(), fx = life.own(new PostFX(shell.canvas));
renderer.cameraX = p.x; renderer.cameraY = p.y - 40;
function draw() {
  shell.canvas.width = Math.round(innerWidth * Math.min(1.6, devicePixelRatio)); shell.canvas.height = Math.round(innerHeight * Math.min(1.6, devicePixelRatio));
  renderer.resize(Math.round(680 * innerWidth / innerHeight), 680);
  renderer.render(sim, world, 0, { phase: 'paused', reducedMotion: true, debug: false, fps: 60 }); fx.render(renderer.canvas, 0);
  if (skillReview) {
    shell.uiCanvas.width = Math.round(innerWidth * devicePixelRatio); shell.uiCanvas.height = Math.round(innerHeight * devicePixelRatio);
    const context = shell.uiCanvas.getContext('2d')!; context.scale(devicePixelRatio, devicePixelRatio);
    drawFloatingHUD(context, p, innerWidth, innerHeight, 0, { reducedMotion: true });
  }
}
shell.showMenu('service', 0, 0); draw();
if (skillReview) {
  const rect = getHUDSkillRect(1, innerWidth, innerHeight);
  picker.open(p, 1, { left: rect.x, top: rect.y, width: rect.width, height: rect.height });
} else if (params.get('view') !== 'town') {
  panel.open(p, npc);
  const operation = params.get('operation');
  if (operation) panel.inspect(params.has('empty') ? { equipped: 'weapon' } : { bag: Number(params.get('item') ?? 1) }, operation as Improvement);
}
window.addEventListener('resize', draw);
life.defer(() => window.removeEventListener('resize', draw));
if (import.meta.hot) import.meta.hot.dispose(() => life.dispose());
