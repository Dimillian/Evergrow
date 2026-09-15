import './typography.css';
import { DEFAULT_APPEARANCE } from './appearance-content.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from './weapon-content.ts';
import { FOCUS_PROFILES } from './focus-content.ts';
import { STARTER_OUTFIT } from './equipment-art.ts';
import { characterBounds } from './character-framing.ts';
import { drawHumanoid } from './art.ts';
import type { CharacterPose } from './art.ts';
import { loadGameFont, text } from './font.ts';
import { STARTING_SWORD, UNARMED_WEAPON } from './equipment.ts';

const directions = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const mount = document.querySelector<HTMLElement>('#poses')!;
const equipment = document.querySelector<HTMLSelectElement>('#equipment')!;
const params = new URLSearchParams(location.search);
equipment.value = params.get('equipment') ?? 'unarmed';
if (!equipment.value) equipment.value = 'unarmed';
const clothing = document.querySelector<HTMLSelectElement>('#clothing')!;
const helmet = document.querySelector<HTMLInputElement>('#helmet')!;
const stride = document.querySelector<HTMLInputElement>('#stride')!;
const abort = new AbortController();
let disposed = false;

async function boot() {
  if (!import.meta.env.DEV) throw new Error('Rig review is available only on the local development server.');
  await loadGameFont();
  if (disposed) return;
  const sheets = directions.map((direction, index) => {
    const section = document.createElement('section'), title = document.createElement('h2');
    title.textContent = direction;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${direction}-facing equipped character: idle above, walking below, at the selected stride phase.`);
    section.append(title, canvas); mount.append(section);
    return { canvas, angle: index * Math.PI / 4 };
  });
  function draw() {
    const profiles: Record<string, string> = {twohand:'greatblade',bow:'thorn-shortbow',staff:'ember-staff',frost:'rime-staff',wand:'cinder-wand'};
    const profileId = profiles[equipment.value];
    const profile = WEAPON_PROFILES.find(p => p.id === profileId);
    const weapon = equipment.value === 'unarmed' ? UNARMED_WEAPON : profile ?? STARTING_SWORD;
    const outfit = clothing.value === 'plate' ? {...STARTER_OUTFIT, head: helmet.checked ? STARTER_OUTFIT.head : null}
      : {head: helmet.checked ? STARTER_OUTFIT.head : null,chest:null,shoulders:null,hands:null,legs:null,boots:null,cloak:null};
    const poseAt = (angle: number, moving: number, gaitPhase = Number(stride.value) * Math.PI * 2): CharacterPose => ({
      kind: 'player', angle, time: 1.25, moving, weapon: weapon.visual,
      grip: weapon.hands === 1 ? 'one-handed' : 'two-handed', appearance: DEFAULT_APPEARANCE, outfit,
      offHand: equipment.value === 'shield' ? {kind:'shield',visual:SHIELD_PROFILES[1].visual}
        : equipment.value === 'wand' ? {kind:'focus',visual:FOCUS_PROFILES[0].visual} : null,
      gaitPhase, moveAngle: angle, attack: 0, attackAngle: angle, hitFlash: 0, dodging: false,
    });
    // One fixed envelope for every facing and the entire stride of this loadout.
    const bounds = sheets.flatMap(({angle}) => [0, 1, 2, 3].map(phase => characterBounds(poseAt(angle, 1, phase * Math.PI / 2))));
    const left = Math.min(...bounds.map(b=>b.left)), right = Math.max(...bounds.map(b=>b.right));
    const top = Math.min(...bounds.map(b=>b.top)), bottom = Math.max(...bounds.map(b=>b.bottom));
    const scale = Math.min(3.8, 280 / (right-left), 240 / (bottom-top));
    const center = 160 - (left+right) * scale / 2;
    for (const { canvas, angle } of sheets) {
      canvas.setAttribute('aria-label', `${directions[Math.round(angle / (Math.PI / 4))]}-facing ${weapon.name} character: idle above, walking below, at the selected stride phase.`);
      const pixels = canvas.getBoundingClientRect().width * (devicePixelRatio || 1);
      canvas.width = Math.round(pixels); canvas.height = Math.round(pixels * 600 / 320);
      const c = canvas.getContext('2d')!;
      c.setTransform(canvas.width / 320, 0, 0, canvas.height / 600, 0, 0);
      c.fillStyle = '#111c23'; c.fillRect(0, 0, 320, 600);
      c.strokeStyle = '#2a3b3e'; c.beginPath(); c.moveTo(12, 300); c.lineTo(308, 300); c.stroke();
      for (const [row, moving] of [0, 1].entries()) {
        const anchor = 32 - top * scale + row * 300;
        text(c, moving ? 'WALK' : 'IDLE', 14, row * 300 + 12, 1.5, '#a5b3a5');
        c.strokeStyle = '#48615b'; c.beginPath(); c.moveTo(center-10, anchor); c.lineTo(center+10, anchor);
        c.moveTo(center, anchor - 4); c.lineTo(center, anchor + 4); c.stroke();
        const pose = poseAt(angle, moving);
        c.save(); c.translate(center, anchor); c.scale(scale, scale); drawHumanoid(c, pose); c.restore();
      }
    }
    mount.dataset.ready = 'true'; mount.setAttribute('aria-busy', 'false');
  }
  draw();
  for (const control of [equipment, clothing, helmet]) control.addEventListener('change', draw, { signal: abort.signal });
  stride.addEventListener('input', draw, {signal:abort.signal});
  window.addEventListener('resize', draw, { signal: abort.signal });
}
void boot().catch(error => {
  if (disposed) return;
  mount.setAttribute('aria-busy', 'false'); mount.setAttribute('role', 'alert');
  mount.textContent = error instanceof Error ? error.message : 'The character rig could not be drawn.';
});
if (import.meta.hot) import.meta.hot.dispose(() => { disposed = true; abort.abort(); });
