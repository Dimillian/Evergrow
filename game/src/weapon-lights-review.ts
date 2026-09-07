import { deriveAttackStats } from './equipment.ts';
import { RANGED_BASIC_ATTACK_PHASES } from './combat-content.ts';
import './typography.css';
import { loadGameFont } from './font.ts';
import { installUITheme } from './ui-theme.ts';
import { generateDungeon, type DungeonEntrance } from './dungeon.ts';
import { DungeonWorld } from './dungeon-world.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { Simulation } from './simulation.ts';
import { generateItem, createCharacterSheet, deriveItem } from './items.ts';
import { refreshCharacter } from './character.ts';
import { ELEMENTAL_AFFIXES } from './elemental-weapon.ts';
if (!import.meta.env.DEV) throw new Error('Local weapon light study only.');
await loadGameFont(); installUITheme();
const root = document.querySelector<HTMLElement>('#weapon-lights')!;
const params = new URLSearchParams(location.search), selected = params.get('sample');
const attackPhase = Math.max(0, Math.min(.99, Number(params.get('attack')) || 0));
const samples = [
  ['Ember staff', 'ember-staff', ''], ['Rime staff', 'rime-staff', ''], ['Storm staff', 'storm-staff', ''],
  ['Cinder wand & orb', 'cinder-wand', 'cinder-orb'], ['Rime wand & orb', 'hoarfrost-wand', 'rime-orb'], ['Star wand & orb', 'star-wand', 'astral-orb'],
  ['Kindling sword', 'longsword', 'fireDamage'], ['Rime sword', 'longsword', 'frostDamage'], ['Stormbound sword', 'longsword', 'lightningDamage'],
];
root.innerHTML = `<style>body{margin:0;background:#080e14;color:#d6e0dd;font:16px var(--ui-font)}main{max-width:1400px;margin:auto;padding:20px}h1{font-size:22px;font-weight:500}section{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}article{background:#101820;border:1px solid #29383e;border-radius:6px;overflow:hidden}canvas{width:100%;display:block}h2{margin:12px 16px;font-size:16px;font-weight:500}a{color:inherit;text-decoration:none}.single{display:block;max-width:960px;margin:auto}@media(max-width:650px){section{grid-template-columns:1fr 1fr}}</style><h1>Enchanted weapons</h1>${selected !== null && Number(selected) < 6 ? `<nav style="display:flex;gap:20px;margin-bottom:16px">${[[0,'Idle'],[.2,'Windup'],[.42,'Release'],[.57,'Recovery']].map(([phase,label]) => `<a href="?sample=${selected}&attack=${phase}">${label}</a>`).join('')}</nav>` : ''}<section class="${selected === null ? '' : 'single'}"></section>`;
const entrance: DungeonEntrance = { id: 'dungeon:light-review', name: 'Rootbound Crypt', seed: 7319, level: 3, biome: 'deadwood', x: 0, y: 0 };
const floor = generateDungeon(7319, 3), world = new DungeonWorld(floor, entrance), room = floor.rooms[4];
const x = room.x + room.width / 2, y = room.y + room.height / 2;
const renderer = new Renderer(), width = selected === null ? 440 : 960, height = selected === null ? 340 : 650;
renderer.resize(width, height);
const output = document.createElement('canvas'); output.width = width; output.height = height;
const post = new PostFX(output);
for (const [index, [label, profile, extra]] of samples.entries()) {
  if (selected !== null && Number(selected) !== index) continue;
  const sim = new Simulation(world, { spawn: false, seed: 7319, startX: x, startY: y });
  sim.dungeonFloor = floor; sim.player.character = createCharacterSheet();
  let item = generateItem(110 + index, 8, 'weapon', profile, extra.endsWith('Damage') ? 'magic' : 'common');
  if (extra.endsWith('Damage')) {
    const affix = ELEMENTAL_AFFIXES.find(a => a.stat === extra)!;
    item.affixes = [{ name: affix.name, stat: affix.stat, value: 0 }]; item.recipe.rolls = [.7]; item = deriveItem(item);
  }
  sim.player.character.equipped.weapon = item;
  sim.player.character.equipped.offhand = extra.endsWith('orb') ? generateItem(771, 8, 'orb', extra, 'common') : null;
  refreshCharacter(sim.player); sim.player.angle = Math.PI / 2; sim.time = 3;
  if (attackPhase > 0 && item.weapon!.attackKind === 'bolt') {
    const weapon = item.weapon!, stats = deriveAttackStats(sim.player.stats, weapon), duration = 1 / stats.attacksPerSecond;
    const start = RANGED_BASIC_ATTACK_PHASES.activeStart, end = RANGED_BASIC_ATTACK_PHASES.activeEnd;
    const style = weapon.damageType === 'physical' ? 'arcane' : weapon.damageType;
    sim.player.attack = { kind: 'ranged', weapon, hand: 'main', elapsed: attackPhase * duration, duration,
      activeStart: start * duration, activeEnd: end * duration, angle: sim.player.angle, range: stats.range, arc: stats.arc,
      damage: stats.damage, hitIds: new Set(), released: attackPhase >= start };
    if (attackPhase >= start) {
      const age = (attackPhase - start) * duration, speed = 380, vx = Math.cos(sim.player.angle) * speed, vy = Math.sin(sim.player.angle) * speed;
      sim.projectiles.push({ id: 1, sourceLevel: 8, owner: 'player', x: x + vx * age, y: y + vy * age,
        prevX: x + vx * age, prevY: y + vy * age, vx, vy, angle: sim.player.angle, radius: 5, damage: stats.damage,
        life: 2 - age, maxLife: 2, effects: { style }, hitIds: new Set(), launch: { weapon: weapon.visual, mainWeapon: weapon.visual, hand: 'main', hands: weapon.hands,
          facing: sim.player.angle, time: sim.time, gaitPhase: 0, moving: 0, moveAngle: 0, start, end } });
    }
  }
  renderer.reset(); renderer.cameraX = x; renderer.cameraY = y - 22;
  for (let i = 0; i < 4; i++) renderer.zoomByWheel(-300, 0, height);
  renderer.render(sim, world, 1 / 60, { phase: 'paused', reducedMotion: true, fps: 60, debug: false });
  post.render(renderer.canvas, 0);
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const c = canvas.getContext('2d')!;
  if (selected === null) c.drawImage(output, 0, 0);
  else {
    const cropWidth = 360, cropHeight = cropWidth * height / width;
    c.drawImage(output, (width - cropWidth) / 2, (height - cropHeight) / 2, cropWidth, cropHeight, 0, 0, width, height);
  }
  const article = document.createElement('article'); article.innerHTML = `<h2><a href="?sample=${index}">${label}</a></h2>`;
  article.prepend(canvas); root.querySelector('section')!.append(article);
}
post.dispose(); world.dispose();
