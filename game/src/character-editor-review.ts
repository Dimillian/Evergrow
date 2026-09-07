import './character-editor-review.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { drawHumanoid, type CharacterPose } from './art.ts';
import { headArmor } from './equipment-art.ts';
import { characterBounds, fitCharacter, type CharacterBounds } from './character-framing.ts';
import { createCharacterSheet, STARTER_LOADOUTS, isStarterLoadoutId, type StarterLoadoutId } from './items.ts';
import { outfitFromEquipment } from './item-art.ts';
import { uiIcon } from './ui-components.ts';
import { SKIN_PALETTES, HAIR_PALETTES, HAIR_STYLES, FACIAL_HAIR, ACCESSORIES, DEFAULT_APPEARANCE, type CharacterAppearance, type AppearancePalette } from './appearance-content.ts';

// Development-only appearance study. No simulation, session, storage, cloud or gameplay input.
if (!import.meta.env.DEV) throw new Error('Local appearance study only.');
installUITheme();
const root = document.querySelector<HTMLElement>('#editor')!;
const abort = new AbortController(), reduced = matchMedia('(prefers-reduced-motion: reduce)');
let appearance: CharacterAppearance = { ...DEFAULT_APPEARANCE, hair: 'braid', hairColor: 'copper', skin: 'sand' };
const initial = { ...appearance };
let facing = Math.PI / 2, loadout: StarterLoadoutId = 'sword-shield', showHood = false;
let frame = 0, disposed = false;
const directions = ['East', 'Southeast', 'Front', 'Southwest', 'West', 'Northwest', 'Back', 'Northeast'];
const selectOptions = (options: readonly { id: string; name: string }[]) => options.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
const swatches = (key: 'skin' | 'hairColor', palettes: readonly AppearancePalette[]) => palettes.map(p => `<button type="button" class="swatch" style="--swatch:${p.base}" data-choice="${key}" data-value="${p.id}" aria-label="${key === 'skin' ? 'Skin tone' : 'Hair color'}: ${p.name}" title="${p.name}" aria-pressed="false"></button>`).join('');
root.innerHTML = `<div class="editor-shell">
  <header class="editor-header"><div class="editor-brand">${uiIcon('star')}<span>EVERGROW</span></div><span>CHARACTER EDITOR</span></header>
  <div class="editor-layout">
    <section class="editor-stage" aria-label="Character preview">
      <div class="stage-title"><h1 id="preview-name">Rowan</h1><span>Appearance preview</span></div>
      <div class="figure-space"><canvas id="figure" role="img" aria-label="Full character wearing selected appearance and starting gear"></canvas>
        <div class="face-study"><canvas id="face" role="img" aria-label="Face close-up"></canvas><span>Face detail</span></div>
        <div class="world-study"><canvas id="world-size" role="img" aria-label="Small character preview"></canvas><span>Small scale</span></div></div>
      <div class="rotation"><button type="button" class="ui-button ui-button--quiet ui-button--icon rotate-left" id="rotate-left" aria-label="Rotate left">${uiIcon('chevron')}</button><output id="direction">Front</output><button type="button" class="ui-button ui-button--quiet ui-button--icon" id="rotate-right" aria-label="Rotate right">${uiIcon('chevron')}</button></div>
      <div class="stage-options"><label class="check-label"><input type="checkbox" id="hood">Show hood</label><label class="gear-choice">Gear<select id="gear">${STARTER_LOADOUTS.map(p => `<option value="${p.id}">${p.label}</option>`).join('')}</select></label></div>
    </section>
    <section class="editor-controls ui-window" aria-labelledby="appearance-title">
      <h2 id="appearance-title">Create your character</h2>
      <label class="editor-name">Name<input type="text" id="name" maxlength="24" value="Rowan" autocomplete="off"></label>
      <fieldset><legend>Skin tone <span class="choice-value" id="skin-label"></span></legend><div class="swatches">${swatches('skin', SKIN_PALETTES)}</div></fieldset>
      <fieldset><legend>Hairstyle <span class="choice-value" id="hair-label"></span></legend><div class="hair-options">${HAIR_STYLES.map(p => `<button type="button" class="hair-option" data-choice="hair" data-value="${p.id}" aria-pressed="false"><canvas aria-hidden="true" data-hair="${p.id}"></canvas><span>${p.name}</span></button>`).join('')}</div></fieldset>
      <fieldset><legend>Hair color <span class="choice-value" id="color-label"></span></legend><div class="swatches">${swatches('hairColor', HAIR_PALETTES)}</div></fieldset>
      <div class="detail-row"><label>Facial hair<select id="facial-hair">${selectOptions(FACIAL_HAIR)}</select></label><label>Accessory<select id="accessory">${selectOptions(ACCESSORIES)}</select></label></div>
      <p class="editor-notice" id="coverage-note">Hair and accessories follow your selected facing.</p>
      <div class="editor-actions"><button type="button" class="ui-button ui-button--quiet" id="randomize">Randomize</button><button type="button" class="ui-button ui-button--primary" id="review">Review look ${uiIcon('chevron')}</button></div>
    </section>
  </div>
  <footer class="editor-footer"><span>Local mockup · appearance only · no character is saved</span><button type="button" id="reset">Reset appearance</button></footer>
  <dialog class="look-dialog" aria-labelledby="look-title"><h2 id="look-title">Rowan</h2><canvas id="review-portrait" role="img" aria-label="Reviewed character appearance"></canvas><p id="look-description"></p><div class="dialog-actions"><button type="button" class="ui-button" id="edit">Back to editor</button><button type="button" class="ui-button ui-button--primary" id="export">Save portrait</button></div></dialog>
</div>`;
const canvas = (id: string) => root.querySelector<HTMLCanvasElement>(`#${id}`)!;
const figure = canvas('figure'), face = canvas('face'), small = canvas('world-size'), portrait = canvas('review-portrait');
const dialog = root.querySelector<HTMLDialogElement>('dialog')!;
const name = root.querySelector<HTMLInputElement>('#name')!;
const gear = root.querySelector<HTMLSelectElement>('#gear')!;
const hood = root.querySelector<HTMLInputElement>('#hood')!;
const facial = root.querySelector<HTMLSelectElement>('#facial-hair')!;
const accessory = root.querySelector<HTMLSelectElement>('#accessory')!;
gear.value = loadout;
let sheet = createCharacterSheet(loadout);
let envelope: CharacterBounds = { left:-60, right:60, top:-70, bottom:20 };
const label = <T extends {id: string; name: string}>(catalog: readonly T[], id: string) => catalog.find(p => p.id === id)!.name;
function pose(time: number): CharacterPose {
  const main = sheet.equipped.weapon!.weapon!;
  const off = sheet.equipped.offhand;
  return { kind: 'player', appearance, time, angle: facing, attackAngle: facing, moving: 0, attack: 0, hitFlash: 0, dodging: false,
    outfit: { ...outfitFromEquipment(sheet), head: showHood ? outfitFromEquipment(sheet).head : null },
    weapon: main.visual, grip: main.hands === 2 ? 'two-handed' : 'one-handed',
    offHand: off?.shield ? { kind: 'shield', visual: off.shield.visual } : off?.focus ? { kind: 'focus', visual: off.focus.visual } : null };
}
function surface(target: HTMLCanvasElement) {
  const rect = target.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr));
  if (target.width !== width || target.height !== height) { target.width = width; target.height = height; }
  const ctx = target.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
  return { ctx, width: rect.width, height: rect.height };
}
function drawFigure(target: HTMLCanvasElement, time: number, miniature = false) {
  const { ctx, width, height } = surface(target);
  const current = pose(time);
  const fit = fitCharacter(envelope, width * (target === figure ? .94 : 1), height, .045);
  ctx.save(); ctx.translate(fit.x, fit.y); ctx.scale(miniature ? Math.min(1.6, fit.scale) : fit.scale, miniature ? Math.min(1.6, fit.scale) : fit.scale);
  ctx.fillStyle = '#02080ba0'; ctx.beginPath(); ctx.ellipse(0, 3, 16, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  drawHumanoid(ctx, current); ctx.restore();
}
function drawHead(target: HTMLCanvasElement, recipe: CharacterAppearance, angle: number, equipped = false) {
  const { ctx, width, height } = surface(target);
  const scale = Math.min(width / 17, height / 24);
  ctx.save(); ctx.translate(width / 2, height * .52); ctx.scale(scale, scale); ctx.translate(0, 33);
  headArmor(ctx, equipped ? outfitFromEquipment(sheet).head ?? null : null, c => c, angle, recipe); ctx.restore();
}
function draw(time = 0) {
  if (disposed) return;
  drawFigure(figure, time); drawFigure(small, 0, true); drawHead(face, appearance, facing, showHood);
  if (dialog.open) drawFigure(portrait, time);
}
function refresh() {
  // Resolve geometry only on editor changes, never rebuild items/bounds per animation frame.
  const neutral = pose(0);
  const bounds = Array.from({length:8}, (_,i) => characterBounds({...neutral, angle:i * Math.PI / 4, attackAngle:i * Math.PI / 4}));
  envelope = {left:Math.min(...bounds.map(b=>b.left)), right:Math.max(...bounds.map(b=>b.right)), top:Math.min(...bounds.map(b=>b.top)) - 3, bottom:Math.max(...bounds.map(b=>b.bottom))};
  root.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(button => {
    const key = button.dataset.choice as keyof CharacterAppearance;
    button.setAttribute('aria-pressed', String(appearance[key] === button.dataset.value));
  });
  root.querySelector('#skin-label')!.textContent = label(SKIN_PALETTES, appearance.skin);
  root.querySelector('#hair-label')!.textContent = label(HAIR_STYLES, appearance.hair);
  root.querySelector('#color-label')!.textContent = label(HAIR_PALETTES, appearance.hairColor);
  root.querySelector('#direction')!.textContent = directions[Math.round(((facing % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 4)) % 8];
  root.querySelector('#coverage-note')!.textContent = showHood ? 'The hood covers hair, hoops and circlets.' : 'Hair and accessories follow your selected facing.';
  root.querySelector('#preview-name')!.textContent = name.value.trim() || 'Wayfarer';
  facial.value = appearance.facialHair; accessory.value = appearance.accessory;
  for (const target of root.querySelectorAll<HTMLCanvasElement>('[data-hair]')) {
    drawHead(target, { ...appearance, hair:target.dataset.hair as CharacterAppearance['hair'], facialHair:'none', accessory:'none' }, Math.PI / 2);
  }
  draw();
}
root.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button'); if (!button) return;
  const value = button.dataset.value;
  if (button.dataset.choice === 'skin' && SKIN_PALETTES.some(p => p.id === value)) appearance.skin = value!;
  if (button.dataset.choice === 'hairColor' && HAIR_PALETTES.some(p => p.id === value)) appearance.hairColor = value!;
  if (button.dataset.choice === 'hair' && HAIR_STYLES.some(p => p.id === value)) appearance.hair = value as CharacterAppearance['hair'];
  if (button.id === 'rotate-left') facing -= Math.PI / 4;
  if (button.id === 'rotate-right') facing += Math.PI / 4;
  if (button.id === 'randomize') {
    const random = crypto.getRandomValues(new Uint32Array(5));
    appearance = { skin:SKIN_PALETTES[random[0] % SKIN_PALETTES.length].id, hairColor:HAIR_PALETTES[random[1] % HAIR_PALETTES.length].id,
      hair:HAIR_STYLES[random[2] % HAIR_STYLES.length].id, facialHair:FACIAL_HAIR[random[3] % FACIAL_HAIR.length].id, accessory:ACCESSORIES[random[4] % ACCESSORIES.length].id };
  }
  if (button.id === 'reset') { appearance = {...initial}; facing = Math.PI / 2; showHood = false; hood.checked = false; }
  if (button.id === 'review') {
    root.querySelector('#look-title')!.textContent = name.value.trim() || 'Wayfarer';
    root.querySelector('#look-description')!.textContent = `${label(HAIR_STYLES, appearance.hair)} · ${label(HAIR_PALETTES, appearance.hairColor)} · ${label(SKIN_PALETTES, appearance.skin)}`;
    dialog.showModal();
  }
  if (button.id === 'edit') dialog.close();
  if (button.id === 'export') {
    const output = document.createElement('canvas'); output.width = 720; output.height = 900;
    const ctx = output.getContext('2d')!; ctx.fillStyle = '#101d24'; ctx.fillRect(0,0,720,900);
    const current = pose(0), fit = fitCharacter(characterBounds(current),720,900,.12);
    ctx.translate(fit.x,fit.y); ctx.scale(fit.scale,fit.scale); drawHumanoid(ctx,current);
    const link = document.createElement('a'); link.download = 'evergrow-character-look.png'; link.href = output.toDataURL('image/png'); link.click();
  }
  refresh();
}, { signal:abort.signal });
gear.addEventListener('change', () => { if (isStarterLoadoutId(gear.value)) { loadout = gear.value; sheet = createCharacterSheet(loadout); refresh(); } }, { signal:abort.signal });
hood.addEventListener('change', () => { showHood = hood.checked; refresh(); }, { signal:abort.signal });
facial.addEventListener('change', () => { appearance.facialHair = facial.value as CharacterAppearance['facialHair']; refresh(); }, { signal:abort.signal });
accessory.addEventListener('change', () => { appearance.accessory = accessory.value as CharacterAppearance['accessory']; refresh(); }, { signal:abort.signal });
name.addEventListener('input', refresh, { signal:abort.signal });
let drag: { id:number; x:number; angle:number } | null = null;
figure.addEventListener('pointerdown', event => { if (event.button !== 0) return; drag = {id:event.pointerId,x:event.clientX,angle:facing}; figure.setPointerCapture(event.pointerId); }, { signal:abort.signal });
figure.addEventListener('pointermove', event => { if (drag?.id !== event.pointerId) return; facing = drag.angle + (event.clientX - drag.x) * .015; refresh(); }, { signal:abort.signal });
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) figure.addEventListener(type, () => { drag = null; }, { signal:abort.signal });
window.addEventListener('resize', refresh, { signal:abort.signal });
reduced.addEventListener('change', refresh, { signal:abort.signal });
await loadGameFont();
if (!disposed) {
  refresh(); let previous = 0;
  const tick = (now:number) => {
    if (!document.hidden && !reduced.matches && now - previous >= 1000 / 60) { draw(now / 1000); previous = now; }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}
if (import.meta.hot) import.meta.hot.dispose(() => { disposed = true; abort.abort(); cancelAnimationFrame(frame); });
