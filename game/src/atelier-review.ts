import { FOCUS_PROFILES } from './focus-content.ts';
import './typography.css';
import './atelier-review.css';
import { drawHumanoid, STARTER_OUTFIT, type CharacterPose } from './art.ts';
import { characterBounds, fitCharacter, type CharacterBounds } from './character-framing.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from './weapon-content.ts';
import { createCharacterSheet, generateItem } from './items.ts';
import { itemIconSVG, outfitFromEquipment } from './item-art.ts';
import { weaponActionRate } from './equipment.ts';
import { RANGED_BASIC_ATTACK_PHASES, BASIC_ATTACK_PHASES, PLAYER_MOVEMENT } from './combat-content.ts';
import { loadGameFont } from './font.ts';
import type { ItemKind } from './character-types.ts';

// Presentation clock only. No Simulation, input adapter, session or save access.
if (!import.meta.env.DEV) throw new Error('Local art review only.');
const root = document.querySelector<HTMLElement>('#atelier')!;
const abort = new AbortController(), reduced = matchMedia('(prefers-reduced-motion: reduce)');
let frame = 0, disposed = false, elapsed = 0, previous = 0;
const sheet = createCharacterSheet();
const params = new URLSearchParams(location.search);
root.innerHTML = `<header><div><small>EVERGROW / THE TRAVELLING ARMORY</small><h1>Forged & worn</h1><p>Character proportions, materials and motion · live procedural art</p></div><a href="/">Play locally ↗</a></header>
  <nav aria-label="Art controls"><label>Weapon <select id="weapon"></select></label><label>Clothing <select id="outfit"><option value="leather">Worn leather</option><option value="plate">Forged plate</option></select></label><label>Facing <select id="facing"></select></label><label>Off-hand <select id="offhand"><option value="none">Guarded hand</option><option value="shield">Kite shield</option><option value="dual">Dagger</option><option value="grimoire">Astral grimoire</option><option value="orb">Rimeglass orb</option></select></label><label class="motion"><input id="motion" type="checkbox"> Animate</label><label>Playback <select id="playback"><option value="1">Normal</option><option value="0.5">Half speed</option><option value="0.25">Quarter speed</option></select></label><label>Attack frame <input id="attack-frame" type="range" min="0" max="1" step="0.001" value="0"></label><button id="capture">Save PNG</button></nav>
  <section class="studies" aria-label="Character motion study"></section><section class="catalog"><h2>From the hand to the inventory</h2><p>Shared silhouettes at 48 pixels and in a closer inspection.</p><div id="items"></div></section><footer>Local art study · no gameplay or saved characters · reduced motion follows your system</footer>`;
const weaponSelect = root.querySelector<HTMLSelectElement>('#weapon')!;
for (const profile of WEAPON_PROFILES) weaponSelect.add(new Option(profile.name, profile.id));
weaponSelect.value = WEAPON_PROFILES.some(p => p.id === params.get('weapon')) ? params.get('weapon')! : 'ember-staff';
const outfitSelect = root.querySelector<HTMLSelectElement>('#outfit')!;
const facingSelect = root.querySelector<HTMLSelectElement>('#facing')!;
['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'].forEach((name, index) => facingSelect.add(new Option(name, String(index))));
facingSelect.value = '2';
const offSelect = root.querySelector<HTMLSelectElement>('#offhand')!;
offSelect.value = ['shield', 'dual', 'grimoire', 'orb'].includes(params.get('offhand') ?? '') ? params.get('offhand')! : 'none';
if (params.get('outfit') === 'plate') outfitSelect.value = 'plate';
const motion = root.querySelector<HTMLInputElement>('#motion')!;
motion.checked = !reduced.matches;
const playback = root.querySelector<HTMLSelectElement>('#playback')!;
const attackFrame = root.querySelector<HTMLInputElement>('#attack-frame')!;
if (['0.25', '0.5'].includes(params.get('speed') ?? '')) playback.value = params.get('speed')!;
const scenes = ['At rest', 'Travelling', 'Basic attack'].map((name, index) => {
  const card = document.createElement('article');
  const title = document.createElement('h2'); title.textContent = name;
  const canvas = document.createElement('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', name);
  const caption = document.createElement('p'); caption.textContent = ['Relaxed grip · breathing · cloth drift', 'Planted stride · lifted return · cape follow-through', 'Weapon-specific charge and recovery'][index];
  card.append(title, canvas, caption); root.querySelector('.studies')!.append(card);
  return { canvas, bounds: { left: -50, top: -75, right: 50, bottom: 25 } as CharacterBounds };
});
function poseAt(index: number, time: number, attackOverride?: number): CharacterPose {
  const weapon = WEAPON_PROFILES.find(p => p.id === weaponSelect.value)!;
  const phases = weapon.attackKind === 'melee' ? BASIC_ATTACK_PHASES : RANGED_BASIC_ATTACK_PHASES;
  const angle = Number(facingSelect.value) * Math.PI / 4;
  const attack = index === 2 ? attackOverride ?? (time * weaponActionRate(weapon)) % 1 : 0;
  const shield = SHIELD_PROFILES[1], dagger = WEAPON_PROFILES.find(p => p.id === 'rondel-dagger')!;
  return { kind: 'player', angle, attackAngle: angle, time, moving: index === 1 ? 1 : 0,
    moveAngle: angle, gaitPhase: time * PLAYER_MOVEMENT.speed / PLAYER_MOVEMENT.gaitDistance,
    attack, attackKind: weapon.attackKind === 'melee' ? 'melee' : 'ranged', attackArc: weapon.arc,
    attackStart: phases.activeStart, attackEnd: phases.activeEnd,
    hitFlash: 0, dodging: false, weapon: weapon.visual, grip: weapon.hands === 2 ? 'two-handed' : 'one-handed',
    outfit: outfitSelect.value === 'plate' ? STARTER_OUTFIT : outfitFromEquipment(sheet),
    offHand: weapon.hands === 2 || offSelect.value === 'none' ? null : offSelect.value === 'shield'
      ? { kind: 'shield', visual: shield.visual } : offSelect.value === 'dual' ? { kind: 'weapon', visual: dagger.visual }
      : { kind: 'focus', visual: FOCUS_PROFILES.find(p => p.id === (offSelect.value === 'orb' ? 'rime-orb' : 'astral-grimoire'))!.visual } };
}
function refresh() {
  elapsed = 0; attackFrame.value = "0";
  offSelect.disabled = WEAPON_PROFILES.find(p => p.id === weaponSelect.value)!.hands === 2;
  // Reserve the whole sampled motion envelope once; never zoom as the actor moves.
  for (const [index, scene] of scenes.entries()) {
    const bounds = Array.from({ length: 120 }, (_, i) => characterBounds(poseAt(index, i / 30)));
    scene.bounds = { left: Math.min(...bounds.map(b => b.left)), right: Math.max(...bounds.map(b => b.right)),
      top: Math.min(...bounds.map(b => b.top)), bottom: Math.max(...bounds.map(b => b.bottom)) };
  }
  // Every panel uses the same scale, making proportions comparable across poses.
  const common = { left: Math.min(...scenes.map(s => s.bounds.left)), right: Math.max(...scenes.map(s => s.bounds.right)),
    top: Math.min(...scenes.map(s => s.bounds.top)), bottom: Math.max(...scenes.map(s => s.bounds.bottom)) };
  scenes.forEach(scene => { scene.bounds = common; });
  render();
}
function render() {
  for (const [index, scene] of scenes.entries()) {
    const rect = scene.canvas.getBoundingClientRect(), density = devicePixelRatio || 1;
    const width = Math.round(rect.width * density), height = Math.round(rect.height * density);
    if (scene.canvas.width !== width || scene.canvas.height !== height) { scene.canvas.width = width; scene.canvas.height = height; }
    const ctx = scene.canvas.getContext('2d')!;
    ctx.setTransform(density, 0, 0, density, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
    const fit = fitCharacter(scene.bounds, rect.width, rect.height, .06);
    ctx.save(); ctx.translate(fit.x, fit.y); ctx.scale(fit.scale, fit.scale);
    const glow = ctx.createRadialGradient(0, -26, 0, 0, -26, 52);
    glow.addColorStop(0, '#70989818'); glow.addColorStop(1, '#70989800'); ctx.fillStyle = glow; ctx.fillRect(-55, -80, 110, 110);
    ctx.fillStyle = '#030a10a0'; ctx.beginPath(); ctx.ellipse(0, 2, 15, 3, 0, 0, Math.PI * 2); ctx.fill();
    drawHumanoid(ctx, poseAt(index, elapsed, motion.checked ? undefined : Number(attackFrame.value))); ctx.restore();
  }
}
const items = root.querySelector<HTMLElement>('#items')!;
const kinds: ItemKind[] = ['head', 'chest', 'gloves', 'legs', 'boots', 'cloak', 'amulet', 'ring'];
const catalog = [...WEAPON_PROFILES.map((p, i) => generateItem(9091 + i * 17, 8, 'weapon', p.id, 'rare')),
  ...SHIELD_PROFILES.map((p, i) => generateItem(9231 + i * 17, 8, 'shield', p.id, 'rare')),
  ...FOCUS_PROFILES.map((p, i) => generateItem(9341 + i * 17, 8, p.visual.kind, p.id, 'rare')),
  ...kinds.map((kind, i) => generateItem(871 + i * 17, 8, kind, undefined, 'rare'))];
for (const item of catalog) {
  const card = document.createElement('article'), title = document.createElement('span'); title.textContent = item.baseName;
  const art = document.createElement('div'); art.innerHTML = itemIconSVG(item, 120) + itemIconSVG(item, 48);
  card.append(art, title); items.append(card);
}
for (const select of [weaponSelect, outfitSelect, facingSelect, offSelect]) select.addEventListener('change', refresh, { signal: abort.signal });
attackFrame.addEventListener('input', () => { motion.checked = false; render(); }, { signal: abort.signal });
motion.addEventListener('change', () => { elapsed = Number(attackFrame.value) / weaponActionRate(WEAPON_PROFILES.find(p => p.id === weaponSelect.value)!); render(); }, { signal: abort.signal });
window.addEventListener('resize', render, { signal: abort.signal });
reduced.addEventListener('change', () => { motion.checked = !reduced.matches; render(); }, { signal: abort.signal });
root.querySelector('#capture')!.addEventListener('click', () => {
  const canvas = document.createElement('canvas'); canvas.width = scenes.reduce((sum, s) => sum + s.canvas.width, 0); canvas.height = scenes[0].canvas.height;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#101b22'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  let x = 0; for (const scene of scenes) { ctx.drawImage(scene.canvas, x, 0); x += scene.canvas.width; }
  const link = document.createElement('a'); link.href = canvas.toDataURL('image/png'); link.download = `evergrow-${weaponSelect.value}.png`; link.click();
}, { signal: abort.signal });
await loadGameFont();
if (!disposed) {
  refresh();
  const tick = (now: number) => {
    if (motion.checked && !reduced.matches) { elapsed += previous ? Math.min(.05, (now - previous) / 1000) * Number(playback.value) : 0; attackFrame.value = String(poseAt(2, elapsed).attack); render(); }
    previous = now; frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}
if (import.meta.hot) import.meta.hot.dispose(() => { disposed = true; abort.abort(); cancelAnimationFrame(frame); });
