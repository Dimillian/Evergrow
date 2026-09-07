import './character-editor-review.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { drawHumanoid, type CharacterPose } from './art.ts';
import { headArmor } from './equipment-art.ts';
import { UNARMED_WEAPON } from './equipment.ts';
import { characterBounds, fitCharacter, type CharacterBounds } from './character-framing.ts';
import { createCharacterSheet, STARTER_LOADOUTS, isStarterLoadoutId, type StarterLoadoutId } from './items.ts';
import { outfitFromEquipment, itemIconSVG } from './item-art.ts';
import type { CharacterSheet } from './character-types.ts';
import type { AppearanceInventoryReview } from './appearance-inventory-review.ts';
import { ARMOR_PARTS, ARMOR_TINTS, tintedOutfit, type ArmorPart, type ArmorTints } from './appearance-armor.ts';
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
let tints:ArmorTints={}, selectedPart:ArmorPart='chest', tab:'character'|'armor'='character';
let inventoryReview:AppearanceInventoryReview|undefined, inventoryLoading=false, inventoryOpen=false;
const pages={skin:0,hair:0,hairColor:0};
let frame = 0, disposed = false;
const directions = ['East', 'Southeast', 'Front', 'Southwest', 'West', 'Northwest', 'Back', 'Northeast'];
const selectOptions = (options: readonly { id: string; name: string }[]) => options.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
const swatches = (key: 'skin' | 'hairColor', palettes: readonly AppearancePalette[]) => palettes.map((p,index) => `<button type="button" class="swatch" style="--swatch:${p.base}" data-choice="${key}" data-value="${p.id}" data-page="${Math.floor(index/8)}" aria-label="${key === 'skin' ? 'Skin tone' : 'Hair color'}: ${p.name}" title="${p.name}" aria-pressed="false"></button>`).join('');
const pager=(key:keyof typeof pages,title:string)=>`<span class="section-pager"><button type="button" class="page-arrow prev" data-page-key="${key}" data-step="-1" aria-label="Previous ${title} page">${uiIcon('chevron')}</button><output data-page-label="${key}" aria-live="polite"></output><button type="button" class="page-arrow" data-page-key="${key}" data-step="1" aria-label="Next ${title} page">${uiIcon('chevron')}</button></span>`;
root.innerHTML = `<div class="editor-shell">
  <header class="editor-header"><div class="editor-brand">${uiIcon('star')}<span>EVERGROW</span></div><button type="button" class="ui-button ui-button--quiet" id="inventory-preview">${uiIcon('inventory')} Inventory preview</button></header>
  <div class="editor-layout">
    <section class="editor-stage" aria-label="Character preview">
      <div class="stage-title"><h1 id="preview-name">Rowan</h1><span>Appearance preview</span></div>
      <div class="figure-space"><canvas id="figure" role="img" aria-label="Full character wearing selected appearance and starting gear"></canvas>
        <div class="face-study"><canvas id="face" role="img" aria-label="Face close-up"></canvas><span>Face detail</span></div>
        <div class="world-study"><canvas id="world-size" role="img" aria-label="Small character preview"></canvas><span>Small scale</span></div></div>
      <div class="rotation"><button type="button" class="ui-button ui-button--quiet ui-button--icon rotate-left" id="rotate-left" aria-label="Rotate left">${uiIcon('chevron')}</button><output id="direction">Front</output><button type="button" class="ui-button ui-button--quiet ui-button--icon" id="rotate-right" aria-label="Rotate right">${uiIcon('chevron')}</button></div>
      <div class="stage-options"><label class="check-label"><input type="checkbox" id="hood">Show helmet</label><label class="gear-choice">Gear<select id="gear">${STARTER_LOADOUTS.map(p => `<option value="${p.id}">${p.label}</option>`).join('')}</select></label></div>
    </section>
    <section class="editor-controls ui-window" aria-label="Appearance editor">
      <div class="editor-tabs" role="tablist" aria-label="Appearance category"><button type="button" role="tab" id="character-tab" data-tab="character" aria-controls="character-options" aria-selected="true">Character</button><button type="button" role="tab" id="armor-tab" data-tab="armor" aria-controls="armor-options" aria-selected="false">Armor</button></div>
      <div id="character-options" class="editor-tab-panel" role="tabpanel" aria-labelledby="character-tab">
      <label class="editor-name">Name<input type="text" id="name" maxlength="24" value="Rowan" autocomplete="off"></label>
      <fieldset class="paged-section"><legend>Skin tone <span class="choice-value" id="skin-label"></span>${pager('skin','skin tone')}</legend><div class="swatches">${swatches('skin', SKIN_PALETTES)}</div></fieldset>
      <fieldset class="paged-section"><legend>Hairstyle <span class="choice-value" id="hair-label"></span>${pager('hair','hairstyle')}</legend><div class="hair-options">${HAIR_STYLES.map((p,index) => `<button type="button" class="hair-option" data-choice="hair" data-value="${p.id}" data-page="${Math.floor(index/8)}" aria-pressed="false"><canvas aria-hidden="true" data-hair="${p.id}"></canvas><span>${p.name}</span></button>`).join('')}</div></fieldset>
      <fieldset class="paged-section"><legend>Hair color <span class="choice-value" id="color-label"></span>${pager('hairColor','hair color')}</legend><div class="swatches">${swatches('hairColor', HAIR_PALETTES)}</div></fieldset>
      <div class="detail-row"><label>Facial hair<select id="facial-hair">${selectOptions(FACIAL_HAIR)}</select></label><label>Accessory<select id="accessory">${selectOptions(ACCESSORIES)}</select></label></div>
      <p class="editor-notice" id="coverage-note">Hair and accessories follow your selected facing.</p>
      </div>
      <div id="armor-options" class="editor-tab-panel" role="tabpanel" aria-labelledby="armor-tab" hidden>
        <div class="armor-heading"><h2>Armor colors</h2><label class="check-label"><input type="checkbox" id="helmet-visible">Show helmet</label></div>
        <div class="armor-parts" role="group" aria-label="Armor part">${ARMOR_PARTS.map(p=>`<button type="button" class="armor-part" data-part="${p.id}" aria-pressed="false"><span class="armor-part-icon" data-part-icon="${p.id}"></span><span>${p.name}</span><span class="armor-part-color" data-part-color="${p.id}"></span></button>`).join('')}</div>
        <fieldset class="armor-palette"><legend><span id="armor-part-label">Chest tint</span><span class="choice-value" id="tint-label">Original</span></legend><button type="button" class="original-color" id="original-color" aria-pressed="true">Use original color</button><div class="swatches armor-swatches">${ARMOR_TINTS.map(p=>`<button type="button" class="swatch" style="--swatch:${p.color}" data-tint="${p.id}" aria-label="Armor tint: ${p.name}" title="${p.name}" aria-pressed="false"></button>`).join('')}</div></fieldset>
        <p class="armor-note" id="armor-note">Select a part to tint. Shading and trim keep their original detail.</p>
        <button type="button" class="ui-button ui-button--quiet" id="reset-armor">Reset all armor colors</button>
      </div>
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
const helmet = root.querySelector<HTMLInputElement>('#helmet-visible')!;
gear.value = loadout;
let sheet = createCharacterSheet(loadout);
let envelope: CharacterBounds = { left:-60, right:60, top:-70, bottom:20 };
const label = <T extends {id: string; name: string}>(catalog: readonly T[], id: string) => catalog.find(p => p.id === id)!.name;
function pose(time: number, source:CharacterSheet=sheet, angle=facing): CharacterPose {
  const main = source.equipped.weapon?.weapon ?? UNARMED_WEAPON;
  const off = source.equipped.offhand;
  return { kind: 'player', appearance, time, angle, attackAngle: angle, moving: 0, attack: 0, hitFlash: 0, dodging: false,
    outfit: tintedOutfit(outfitFromEquipment(source),tints,showHood),
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
  headArmor(ctx, equipped ? tintedOutfit(outfitFromEquipment(sheet),tints,true).head ?? null : null, c => c, angle, recipe); ctx.restore();
}
function draw(time = 0) {
  if (disposed) return;
  if(inventoryOpen) return;
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
    button.hidden=Number(button.dataset.page)!==pages[key as keyof typeof pages];
  });
  for(const key of Object.keys(pages) as (keyof typeof pages)[]) {
    const total=key==='hair'?3:2;
    root.querySelector(`[data-page-label="${key}"]`)!.textContent=`${pages[key]+1} / ${total}`;
    root.querySelectorAll<HTMLButtonElement>(`[data-page-key="${key}"]`).forEach(b=>{b.disabled=Number(b.dataset.step)<0?pages[key]===0:pages[key]===total-1;});
  }
  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.tab===tab));b.tabIndex=b.dataset.tab===tab?0:-1;});
  root.querySelector<HTMLElement>('#character-options')!.hidden=tab!=='character';
  root.querySelector<HTMLElement>('#armor-options')!.hidden=tab!=='armor';
  root.querySelector<HTMLButtonElement>('#randomize')!.hidden=tab==='armor';
  helmet.checked=showHood;hood.checked=showHood;
  const slotFor=(part:ArmorPart)=>part==='shoulders'?'chest':part==='hands'?'gloves':part;
  for(const part of ARMOR_PARTS) {
    root.querySelector(`[data-part="${part.id}"]`)!.setAttribute('aria-pressed',String(selectedPart===part.id));
    const item=sheet.equipped[slotFor(part.id)], icon=root.querySelector<HTMLElement>(`[data-part-icon="${part.id}"]`)!;
    icon.innerHTML=item?itemIconSVG(item,34):uiIcon('minus');
    root.querySelector(`[data-part-color="${part.id}"]`)!.textContent=ARMOR_TINTS.find(p=>p.id===tints[part.id])?.name??'Original';
  }
  root.querySelector('#armor-part-label')!.textContent=label(ARMOR_PARTS,selectedPart)+' tint';
  root.querySelector('#tint-label')!.textContent=ARMOR_TINTS.find(p=>p.id===tints[selectedPart])?.name??'Original';
  root.querySelector('#original-color')!.setAttribute('aria-pressed',String(!tints[selectedPart]));
  root.querySelectorAll<HTMLButtonElement>('[data-tint]').forEach(b=>b.setAttribute('aria-pressed',String(tints[selectedPart]===b.dataset.tint)));
  root.querySelector('#armor-note')!.textContent=selectedPart==='head'&&!showHood?'Helmet is hidden. Enable Show helmet to preview its tint.':'Select a part to tint. Shading and trim keep their original detail.';
  root.querySelector('#skin-label')!.textContent = label(SKIN_PALETTES, appearance.skin);
  root.querySelector('#hair-label')!.textContent = label(HAIR_STYLES, appearance.hair);
  root.querySelector('#color-label')!.textContent = label(HAIR_PALETTES, appearance.hairColor);
  root.querySelector('#direction')!.textContent = directions[Math.round(((facing % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 4)) % 8];
  root.querySelector('#coverage-note')!.textContent = showHood ? 'The hood covers hair, hoops and circlets.' : 'Hair and accessories follow your selected facing.';
  root.querySelector('#preview-name')!.textContent = name.value.trim() || 'Wayfarer';
  facial.value = appearance.facialHair; accessory.value = appearance.accessory;
  for (const target of root.querySelectorAll<HTMLCanvasElement>('.hair-option:not([hidden]) [data-hair]')) {
    drawHead(target, { ...appearance, hair:target.dataset.hair as CharacterAppearance['hair'], facialHair:'none', accessory:'none' }, Math.PI / 2);
  }
  draw();
}
root.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button'); if (!button) return;
  const value = button.dataset.value;
  if(button.dataset.pageKey) {const key=button.dataset.pageKey as keyof typeof pages;pages[key]=Math.max(0,Math.min(key==='hair'?2:1,pages[key]+Number(button.dataset.step)));}
  if(button.dataset.tab==='character'||button.dataset.tab==='armor')tab=button.dataset.tab;
  if(ARMOR_PARTS.some(p=>p.id===button.dataset.part))selectedPart=button.dataset.part as ArmorPart;
  if(ARMOR_TINTS.some(p=>p.id===button.dataset.tint))tints={...tints,[selectedPart]:button.dataset.tint};
  if(button.id==='original-color'){tints={...tints};delete tints[selectedPart];}
  if(button.id==='reset-armor')tints={};
  if(button.id==='inventory-preview')void openInventory();
  if (button.dataset.choice === 'skin' && SKIN_PALETTES.some(p => p.id === value)) appearance.skin = value!;
  if (button.dataset.choice === 'hairColor' && HAIR_PALETTES.some(p => p.id === value)) appearance.hairColor = value!;
  if (button.dataset.choice === 'hair' && HAIR_STYLES.some(p => p.id === value)) appearance.hair = value as CharacterAppearance['hair'];
  if (button.id === 'rotate-left') facing -= Math.PI / 4;
  if (button.id === 'rotate-right') facing += Math.PI / 4;
  if (button.id === 'randomize') {
    const random = crypto.getRandomValues(new Uint32Array(5));
    appearance = { skin:SKIN_PALETTES[random[0] % SKIN_PALETTES.length].id, hairColor:HAIR_PALETTES[random[1] % HAIR_PALETTES.length].id,
      hair:HAIR_STYLES[random[2] % HAIR_STYLES.length].id, facialHair:FACIAL_HAIR[random[3] % FACIAL_HAIR.length].id, accessory:ACCESSORIES[random[4] % ACCESSORIES.length].id };
    pages.skin=Math.floor(SKIN_PALETTES.findIndex(p=>p.id===appearance.skin)/8);pages.hair=Math.floor(HAIR_STYLES.findIndex(p=>p.id===appearance.hair)/8);pages.hairColor=Math.floor(HAIR_PALETTES.findIndex(p=>p.id===appearance.hairColor)/8);
  }
  if (button.id === 'reset') { appearance = {...initial}; facing = Math.PI / 2; pages.skin=0;pages.hair=0;pages.hairColor=0; }
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
helmet.addEventListener('change',()=>{showHood=helmet.checked;refresh();},{signal:abort.signal});
root.querySelector('.editor-tabs')!.addEventListener('keydown',event=>{const e=event as KeyboardEvent;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();tab=tab==='character'?'armor':'character';refresh();root.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`)!.focus();}},{signal:abort.signal});
facial.addEventListener('change', () => { appearance.facialHair = facial.value as CharacterAppearance['facialHair']; refresh(); }, { signal:abort.signal });
accessory.addEventListener('change', () => { appearance.accessory = accessory.value as CharacterAppearance['accessory']; refresh(); }, { signal:abort.signal });
name.addEventListener('input', refresh, { signal:abort.signal });
let drag: { id:number; x:number; angle:number } | null = null;
figure.addEventListener('pointerdown', event => { if (event.button !== 0) return; drag = {id:event.pointerId,x:event.clientX,angle:facing}; figure.setPointerCapture(event.pointerId); }, { signal:abort.signal });
figure.addEventListener('pointermove', event => { if (drag?.id !== event.pointerId) return; facing = drag.angle + (event.clientX - drag.x) * .015; refresh(); }, { signal:abort.signal });
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) figure.addEventListener(type, () => { drag = null; }, { signal:abort.signal });
window.addEventListener('resize', refresh, { signal:abort.signal });
reduced.addEventListener('change', refresh, { signal:abort.signal });
async function openInventory(){
  if(inventoryLoading||disposed)return;inventoryLoading=true;
  try {
    if(!inventoryReview){
      const {AppearanceInventoryReview}=await import('./appearance-inventory-review.ts');if(disposed)return;
      const close=()=>{sheet=structuredClone(inventoryReview!.character);inventoryReview!.panel.close();inventoryOpen=false;refresh();root.querySelector<HTMLButtonElement>('#inventory-preview')!.focus();};
      inventoryReview=new AppearanceInventoryReview(root,(ctx,player,time,angle,width,height)=>{
        const current=pose(time,player.character,angle),fit=fitCharacter(characterBounds({...current,time:0}),width,height,.09);
        ctx.clearRect(0,0,width,height);ctx.save();ctx.translate(fit.x,fit.y);ctx.scale(fit.scale,fit.scale);drawHumanoid(ctx,current);ctx.restore();
      },()=>{close();tab='character';refresh();root.querySelector<HTMLButtonElement>('#character-tab')!.focus();},close);
    }
    inventoryOpen=true;inventoryReview.open(sheet);
  } finally {inventoryLoading=false;}
}
await loadGameFont();
if (!disposed) {
  refresh(); let previous = 0;
  const tick = (now:number) => {
    if (!document.hidden && !reduced.matches && now - previous >= 1000 / 60) { draw(now / 1000); previous = now; }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}
if (import.meta.hot) import.meta.hot.dispose(() => { disposed = true; inventoryReview?.dispose(); abort.abort(); cancelAnimationFrame(frame); });
