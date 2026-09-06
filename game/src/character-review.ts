import { xpForNextLevel } from './progression.ts';
import { executeCharacterCommand } from './character-commands.ts';
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
import { allocateNode, SKILL_NODES, SKILL_TREE } from './skill-tree.ts';
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
p.character.gold = 1248;
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
unlock(SKILL_TREE.nodes.find(node => node.skill === 'cleave')!.id);
unlock(SKILL_TREE.nodes.find(node => node.skill === 'fireball')!.id);
assignSkill(p, 0, 'cleave'); assignSkill(p, 1, 'fireball');
const kinds: ItemKind[] = ['weapon', 'chest', 'head', 'boots', 'gloves', 'cloak', 'ring', 'amulet', 'legs'];
for (let i = 0; i < 22; i++) p.character.inventory[i] = generateItem(1284 + i * 831, 7 + i % 4, kinds[i % kinds.length]);
for (const index of [0, 1, 2, 3, 4, 5, 6, 7, 8]) equipItem(p.character, index, p.level);
const loadout = new URLSearchParams(location.search).get('loadout');
const profile = loadout === 'bow' ? 'crescent-recurve' : loadout === 'staff' ? 'storm-staff'
  : loadout === 'dual' || loadout === 'shield' ? 'longsword' : undefined;
if (profile) {
  p.character.inventory[46] = generateItem(8409, 8, 'weapon', profile);
  equipItem(p.character, 46, p.level);
  if (loadout === 'shield' || loadout === 'dual') {
    p.character.inventory[47] = generateItem(8410, 8, loadout === 'shield' ? 'shield' : 'weapon',
      loadout === 'shield' ? 'vigil-kite' : 'rondel-dagger');
    equipItem(p.character, 47, p.level, 'offhand');
  }
}
const comparisonReview = new URLSearchParams(location.search).get('comparison') === 'twohand';
if (comparisonReview) {
  p.character.equipped.weapon = generateItem(9900, 1, 'weapon', 'longsword', 'common');
  p.character.equipped.offhand = generateItem(9901, 1, 'shield', 'iron-buckler', 'common');
  p.character.inventory[0] = generateItem(9902, 1, 'weapon', 'ember-staff', 'common');
}
const progressionReview = new URLSearchParams(location.search).has('progression');
if (progressionReview) {
  while (p.level < 100) awardCharacterExperience(p, xpForNextLevel(p.level) - p.xp);
  for (const id of ['skill:fireball', 'specialization:fireball-fork', 'specialization:fireball-ember', 'mastery:fireball', 'skill:cataclysm'])
    executeCharacterCommand(p, { type: 'allocateNode', id });
  for (let rank = 2; rank <= 5; rank++) executeCharacterCommand(p, { type: 'upgradeSkill', skill: 'fireball' });
  executeCharacterCommand(p, { type: 'configureSkill', skill: 'fireball', rank: 3, specialization: 'fireball-fork' });
}
refreshCharacter(p); p.hp = p.maxHp; p.mana = p.maxMana;
const root = document.querySelector<HTMLElement>('#app')!;
let selected = new URLSearchParams(location.search).get('panel') === 'skills' ? 'skills' : 'character';
const shell = life.own(new GameShell(root, { play: () => {}, returnToTitle: () => {}, openMap: () => {},
  openCharacter: () => show('character'), openSkills: () => show('skills') }));
const result = (action: ActionResult) => {
  if (!action.ok) shell.notifications.info(action.message ?? 'Unavailable');
  refreshCharacter(p); inventory.refresh(p); tree.refresh(p);
};
const inventory = life.own(new InventoryPanel(shell.panelMount, { close: () => show('skills'),
  equip: (i, slot) => result(equipItem(p.character, i, p.level, slot)),
  unequip: (slot, i) => result(unequipItem(p.character, slot, i)),
  move: (from, to) => result(moveInventoryItem(p.character, from, to)),
  allocate: attribute => result(allocateAttribute(p.character, attribute)),
}));
const tree = life.own(new SkillTreePanel(shell.panelMount, {
  develop: command => result(executeCharacterCommand(p, command)), close: () => show('character'),
  allocate: id => result(executeCharacterCommand(p, { type: 'allocateNode', id })), assign: (slot, skill) => result(assignSkill(p, slot, skill)),
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
  if (panel === 'skills') {
    tree.open(p); tree.inspectNode(new URLSearchParams(location.search).get('node') ?? (progressionReview ? 'skill:fireball' : 'skill:cleave'), true);
    const zoom = new URLSearchParams(location.search).get('zoom');
    if (zoom === 'overview') tree.showOverview();
    else if (zoom === 'region' || zoom === 'detail') {
      const cluster = SKILL_TREE.clusters.find(cluster => cluster.domain === 'Might' && cluster.name === 'Heart of Iron')!;
      const notable = SKILL_TREE.nodes.find(node => node.cluster === cluster.id && node.kind === 'notable')!;
      tree.inspectNode(notable.id, false);
      tree.setView(cluster.x + (zoom === 'region' ? -350 : 0), cluster.y + (zoom === 'region' ? 250 : 0), zoom === 'detail' ? 1.2 : .3);
    }
  }
  else inventory.open(p);
  root.dataset.ready = 'true'; root.dataset.panel = panel;
}
background(); show(selected);
if (comparisonReview && selected === 'character') inventory.element.querySelector<HTMLButtonElement>('[data-bag="0"]')?.focus();
const observer = new ResizeObserver(background); observer.observe(root); life.defer(() => observer.disconnect());
if (import.meta.hot) import.meta.hot.dispose(() => life.dispose());
