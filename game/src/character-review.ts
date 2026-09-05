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
import { InventoryPanel } from './inventory-panel.ts';
import { SkillTreePanel } from './skill-tree-panel.ts';
import { generateItem } from './items.ts';
import { equipItem, unequipItem, moveInventoryItem, allocateAttribute } from './inventory.ts';
import { allocateNode, SKILL_NODES } from './skill-tree.ts';
import { awardCharacterExperience, refreshCharacter, assignSkill } from './character.ts';
import { Lifetime } from './lifetime.ts';
import type { ActionResult, ItemKind } from './character-types.ts';

// Dev-only frozen review: real panels and item rules, no gameplay ticks or save access.
if (!import.meta.env.DEV) throw new Error('Local review only.');
installUITheme();
await loadGameFont();
const life = new Lifetime();
const world = life.own(new World(7319));
const sim = new Simulation(world, { seed: 7319, spawn: false });
const p = sim.player;
awardCharacterExperience(p, 2877);
for (let i = 0; i < 25; i++) allocateAttribute(p.character, i % 3 === 0 ? 'vitality' : i % 3 === 1 ? 'strength' : 'dexterity');
function unlock(id: string) {
  const queue = ['origin'], parents = new Map<string, string | null>([['origin', null]]);
  for (let i = 0; i < queue.length && !parents.has(id); i++) for (const next of SKILL_NODES.get(queue[i])!.neighbors) {
    if (!parents.has(next)) { parents.set(next, queue[i]); queue.push(next); }
  }
  const path: string[] = [];
  for (let at: string | null = id; at; at = parents.get(at) ?? null) path.unshift(at);
  for (const node of path) if (!p.character.allocatedNodes.includes(node)) allocateNode(p.character, node);
}
unlock('star:1:0:heart'); unlock('star:1:-1:heart');
assignSkill(p, 0, 'cleave'); assignSkill(p, 1, 'ember');
const kinds: ItemKind[] = ['weapon', 'chest', 'head', 'boots', 'gloves', 'cloak', 'ring', 'amulet', 'legs'];
for (let i = 0; i < 22; i++) p.character.inventory[i] = generateItem(1284 + i * 831, 7 + i % 4, kinds[i % kinds.length]);
for (const index of [0, 1, 2, 3, 4, 5, 6, 7, 8]) equipItem(p.character, index, p.level);
refreshCharacter(p); p.hp = p.maxHp; p.mana = p.maxMana;
const root = document.querySelector<HTMLElement>('#app')!;
let selected = new URLSearchParams(location.search).get('panel') === 'skills' ? 'skills' : 'character';
const shell = life.own(new GameShell(root, { play: () => {}, restart: () => {}, openMap: () => {},
  openCharacter: () => show('character'), openSkills: () => show('skills') }));
const result = (action: ActionResult) => {
  if (!action.ok) shell.toast(action.message ?? 'Unavailable');
  refreshCharacter(p); inventory.refresh(p); tree.refresh(p);
};
const inventory = life.own(new InventoryPanel(shell.panelMount, { close: () => show('skills'),
  equip: (i, slot) => result(equipItem(p.character, i, p.level, slot)),
  unequip: (slot, i) => result(unequipItem(p.character, slot, i)),
  move: (from, to) => result(moveInventoryItem(p.character, from, to)),
  allocate: attribute => result(allocateAttribute(p.character, attribute)),
}));
const tree = life.own(new SkillTreePanel(shell.panelMount, { close: () => show('character'),
  allocate: id => result(allocateNode(p.character, id)), assign: (slot, skill) => result(assignSkill(p, slot, skill)),
}));
const renderer = new Renderer(), fx = life.own(new PostFX(shell.canvas));
function background() {
  const w = innerWidth, h = innerHeight, density = devicePixelRatio || 1;
  shell.canvas.width = Math.round(w * density); shell.canvas.height = Math.round(h * density);
  renderer.resize(Math.round(680 * w / h), 680);
  renderer.render(sim, world, 0, { phase: 'paused', reducedMotion: true, debug: false, fps: 60 });
  fx.render(renderer.canvas, 0);
}
function show(panel: string) {
  selected = panel; inventory.close(); tree.close(); shell.showMenu(panel === 'skills' ? 'skills' : 'character', 0, 0);
  if (panel === 'skills') { tree.open(p); tree.inspectNode('star:1:0:heart', false); }
  else inventory.open(p);
  root.dataset.ready = 'true'; root.dataset.panel = panel;
}
background(); show(selected);
const observer = new ResizeObserver(background); observer.observe(root); life.defer(() => observer.disconnect());
if (import.meta.hot) import.meta.hot.dispose(() => life.dispose());
