import './ui-kit.css';
import './typography.css';
import './bestiary-review.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { drawHumanoid, type CharacterPose } from './art.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from './weapon-content.ts';
import { generateItem } from './items.ts';
import { itemIconSVG } from './item-art.ts';
import { drawGroundLoot } from './loot-art.ts';
import { escapeUI } from './ui-components.ts';
import type { EnemyKind } from './model.ts';

// No simulation, input bindings, ticks, or saved state. These are frozen art poses.
if (!import.meta.env.DEV) throw new Error('Local review only.');
installUITheme();
await loadGameFont();
const root = document.querySelector<HTMLElement>('#bestiary-review')!;
const armory = new URLSearchParams(location.search).get('view') === 'armory';
const abort = new AbortController();
const scenes: Array<{ canvas: HTMLCanvasElement; poses: CharacterPose[]; groundItem?: ReturnType<typeof generateItem> }> = [];
const base = { angle: 1.15, time: 2.7, moving: 0, attack: 0, attackAngle: 1.15, hitFlash: 0, dodging: false };
const roles: Record<EnemyKind, { role: string; detail: string; attack: number }> = {
  stalker: { role: 'Flanker', detail: 'Burial shroud · split skull · hooked limbs', attack: -.72 },
  brute: { role: 'Heavy', detail: 'Ossuary cuirass · sealed grave hammer', attack: -.8 },
  caster: { role: 'Hexer', detail: 'Ceremonial stole · antlered cowl · reliquary', attack: -.78 },
  hound: { role: 'Skirmisher', detail: 'Four-legged gait · exposed ribs · pouncing jaw', attack: -.7 },
  archer: { role: 'Ranger', detail: 'Thorn mantle · shouldered quiver · drawn bow', attack: -.85 },
  wisp: { role: 'Spirit', detail: 'Caged flame · trailing cloth · suspended iron', attack: -.85 },
};
root.innerHTML = `<header class="bestiary-header"><div><div class="ui-kicker">EVERGROW / PROCEDURAL ASSET STUDY</div><h1>${armory ? 'The travelling armory' : 'Creatures of the wild'}</h1><p>${armory ? 'Shared forged geometry, dressed figures and recognisable field loot.' : 'Six silhouettes, each with a readable combat role and its own movement.'}</p></div>
  <nav class="bestiary-nav"><a class="ui-button${!armory ? ' ui-button--primary' : ''}" href="/bestiary.html">Bestiary</a><a class="ui-button${armory ? ' ui-button--primary' : ''}" href="/bestiary.html?view=armory">Armory</a></nav></header>
  <section class="bestiary-grid${armory ? ' bestiary-armory' : ''}" aria-label="Frozen procedural figures"></section>`;
const grid = root.querySelector<HTMLElement>('.bestiary-grid')!;
function card(name: string, role: string, detail: string, poses: CharacterPose[], groundItem?: ReturnType<typeof generateItem>) {
  const section = document.createElement('article'); section.className = 'bestiary-card';
  section.innerHTML = `<div class="bestiary-card-head"><h2>${escapeUI(name)}</h2><span class="ui-kicker">${escapeUI(role)}</span></div><canvas role="img" aria-label="${escapeUI(name)} in two frozen poses"></canvas><p>${escapeUI(detail)}</p>`;
  grid.append(section); scenes.push({ canvas: section.querySelector('canvas')!, poses, groundItem });
}
if (!armory) {
  for (const kind of Object.keys(ENEMY_DEFINITIONS) as EnemyKind[]) {
    const role = roles[kind];
    card(ENEMY_DEFINITIONS[kind].name, role.role, role.detail,
      [{ ...base, kind, angle: .5, attackAngle: .5 }, { ...base, kind, angle: 2.7, attackAngle: 2.7, attack: role.attack }]);
  }
} else {
  const loadouts = [
    { name: 'Vigil keeper', role: 'Sword & shield', id: 'longsword', off: 'vigil-kite' },
    { name: 'Knife pilgrim', role: 'Dual wield', id: 'longsword', off: 'rondel-dagger' },
    { name: 'Briar sentinel', role: 'Recurve', id: 'crescent-recurve', off: null },
    { name: 'Storm bearer', role: 'Staff', id: 'storm-staff', off: null },
  ];
  for (const loadout of loadouts) {
    const weapon = WEAPON_PROFILES.find(p => p.id === loadout.id)!;
    const shield = SHIELD_PROFILES.find(p => p.id === loadout.off);
    const second = WEAPON_PROFILES.find(p => p.id === loadout.off);
    const offHand: CharacterPose['offHand'] = shield ? { kind: 'shield', visual: shield.visual }
      : second ? { kind: 'weapon', visual: second.visual } : null;
    const poses = [Math.PI / 2, -Math.PI / 2].map((angle): CharacterPose => ({ ...base, kind: 'player', angle, attackAngle: angle,
      grip: weapon.hands === 2 ? 'two-handed' : 'one-handed', weapon: weapon.visual, offHand }));
    card(loadout.name, loadout.role, 'Front / rear · actual equipment attachments', poses, generateItem(6013, 8, 'weapon', loadout.id, 'rare'));
  }
  const list = document.createElement('section');
  list.innerHTML = `<div class="bestiary-items-title"><h2>Forged, bound, engraved</h2><p>Every profile keeps its silhouette in the bag and on the ground.</p></div><div class="bestiary-items"></div>`;
  root.append(list);
  const items = list.querySelector('.bestiary-items')!;
  for (const [index, profile] of [...WEAPON_PROFILES, ...SHIELD_PROFILES].entries()) {
    const item = generateItem(9091 + index * 17, 8, 'family' in profile ? 'weapon' : 'shield', profile.id, 'rare');
    const tile = document.createElement('div'); tile.className = 'bestiary-item';
    tile.innerHTML = `${itemIconSVG(item)}<span>${escapeUI(profile.name)}</span>`; items.append(tile);
  }
}
const footer = document.createElement('p'); footer.className = 'bestiary-footer';
footer.textContent = 'Local art review · frozen poses · native text · no gameplay or save access'; root.append(footer);
function draw() {
  for (const { canvas, poses, groundItem } of scenes) {
    const bounds = canvas.getBoundingClientRect(), width = bounds.width, height = bounds.height;
    if (!width || !height) continue;
    const density = devicePixelRatio || 1; canvas.width = Math.round(width * density); canvas.height = Math.round(height * density);
    const c = canvas.getContext('2d')!; c.setTransform(density, 0, 0, density, 0, 0);
    const positions = [width * .29, width * .72], floor = armory ? height - 66 : height - 18;
    const scale = armory ? 2 : 2.7;
    const vignette = c.createRadialGradient(width / 2, height * .5, 0, width / 2, height * .5, width * .56);
    vignette.addColorStop(0, '#355c572a'); vignette.addColorStop(1, '#10212900'); c.fillStyle = vignette; c.fillRect(0, 0, width, height);
    for (const [index, pose] of poses.entries()) {
      c.fillStyle = '#050d1399'; c.beginPath(); c.ellipse(positions[index], floor + 3, pose.kind === 'brute' ? 38 : 27, 7, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#68756c25'; c.lineWidth = .65; c.beginPath(); c.ellipse(positions[index], floor + 3, 37, 11, 0, 0, Math.PI * 2); c.stroke();
      c.save(); c.translate(positions[index], floor); c.scale(scale, scale); drawHumanoid(c, pose); c.restore();
    }
    if (groundItem) {
      c.save(); c.translate(width / 2, height - 8); c.scale(1.1, 1.1);
      drawGroundLoot(c, [{ id: 1, x: 0, y: 0, item: groundItem }], 1.4); c.restore();
    }
  }
  root.dataset.ready = 'true'; root.setAttribute('aria-busy', 'false');
}
draw();
window.addEventListener('resize', draw, { signal: abort.signal });
if (import.meta.hot) import.meta.hot.dispose(() => abort.abort());
