import { ITEM_MATERIALS } from './item-materials.ts';
import { STAT_LABELS, formatStatValue } from './items.ts';
import type { StatKey } from './character-types.ts';
import './typography.css';
import './ui-kit.css';
import './equipment-review.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { equipmentExhibits } from './equipment-review-fixtures.ts';
import { itemIconSVG, itemDropShapes } from './item-art.ts';
import { GearLightStudy } from './gear-light-study.ts';
import { Simulation } from './simulation.ts';
import { refreshCharacter } from './character.ts';
import { drawCharacterPortrait } from './character-portrait.ts';
import { withGearLight, type GearLight } from './gear-material.ts';
if(!import.meta.env.DEV)throw new Error('Local equipment gallery only.');
await loadGameFont();installUITheme();
const root=document.querySelector<HTMLElement>('#equipment-review')!;
let areaLevel=8, encounter:'normal'|'veteran'|'elite'|'bossChest'='normal',exhibits=equipmentExhibits(areaLevel);
const params=new URLSearchParams(location.search), requested=Number(params.get('item')??0);
let selected=Number.isInteger(requested)&&requested>=0&&requested<exhibits.length?requested:0;
let mode:'item'|'character'=params.has('portrait')?'character':'item',filter='All',materialFilter='All';
root.innerHTML=`<header><h1>Equipment</h1><span>${exhibits.length} pieces</span></header><nav class="filters" aria-label="Equipment categories">${['All','Weapons','Shields','Armor','Foci','Accessories'].map(group=>`<button data-group="${group}" class="${group==='All'?'active':''}">${group}</button>`).join('')}</nav><label class="material-filter">Material <select aria-label="Filter material"><option value="All">All materials</option>${Object.entries(ITEM_MATERIALS).map(([id,m])=>`<option value="${id}">${m.name}</option>`).join('')}</select><select aria-label="Area level">${[1,8,25,50,100].map(n=>`<option value="${n}" ${n===8?'selected':''}>Area level ${n}</option>`).join('')}</select><select aria-label="Encounter difficulty"><option value="normal">Normal</option><option value="veteran">Veteran</option><option value="elite">Elite</option><option value="bossChest">Boss chest</option></select></label><div class="workshop"><div class="gallery"></div><aside class="inspection"><h2></h2><p class="material"></p><div class="base-stats"></div><div class="modes"><button data-mode="item">Item</button><button data-mode="character">Equipped</button></div><canvas width="512" height="512" aria-label="Equipment material lighting"></canvas><canvas class="portrait-canvas" width="640" height="800" hidden></canvas><p class="hint">Move over the item to position the light</p><div class="inspector-controls"><select aria-label="Light color"><option value="moon">Moonlight</option><option value="day">Daylight</option><option value="fire">Firelight</option></select><label>Light <input type="range" aria-label="Light strength" min="0.3" max="1.5" step=".05" value="1"></label><label><input type="checkbox" aria-label="Rotate light"> Rotate</label></div></aside></div>`;
const gallery=root.querySelector<HTMLElement>('.gallery')!,inspection=root.querySelector<HTMLElement>('.inspection')!;
const canvas=inspection.querySelector('canvas')!,portraitCanvas=inspection.querySelector<HTMLCanvasElement>('.portrait-canvas')!;
const strength=inspection.querySelector<HTMLInputElement>('input[type=range]')!,rotate=inspection.querySelector<HTMLInputElement>('input[type=checkbox]')!,lamp=inspection.querySelector<HTMLSelectElement>('select')!;
const lifetime=new AbortController(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const sim=new Simulation({blocked:()=>false,move:(x,y)=>({x,y})},{spawn:false});
const colors={moon:{rgb:[.78,.88,1],hex:'#c7e0ff'},day:{rgb:[1,.98,.91],hex:'#fff9e8'},fire:{rgb:[1,.61,.3],hex:'#ff9b4d'}} as const;
let lightX=.22,lightY=.85,frame=0,lastFrame=0,study:GearLightStudy|undefined;
function renderGallery(){
  gallery.innerHTML=['Weapons','Shields','Armor','Foci','Accessories'].filter(group=>filter==='All'||filter===group).map(group=>`<section><h2>${group}</h2><div class="items">${exhibits.map((entry,index)=>entry.group===group&&(materialFilter==='All'||entry.item.recipe.materialId===materialFilter)?`<button class="item-card ${index===selected?'active':''}" data-item="${index}" aria-label="Inspect ${entry.name}" aria-pressed="${index===selected}">${itemIconSVG(entry.item,176)}<strong>${entry.name}</strong><small>${entry.material}</small></button>`:'').join('')}</div></section>`).join('');
}
function draw(){
  const color=colors[lamp.value as keyof typeof colors],power=Number(strength.value);
  if(mode==='item')study?.draw(lightX,lightY,color.rgb,power);
  else {const light:GearLight={direction:[(lightX-.5)*1.8,(.5-lightY)*1.8,.65],color:color.hex,power};
    withGearLight(portraitCanvas.getContext('2d')!,light,()=>drawCharacterPortrait(portraitCanvas.getContext('2d')!,sim.player,2,Math.PI/2,640,800));}
}
function equip(){
  const item=exhibits[selected].item,eq=sim.player.character.equipped;
  for(const key of Object.keys(eq) as Array<keyof typeof eq>)eq[key]=null;
  for(const entry of exhibits.filter(e=>e.group==='Armor'&&e.item.appearance.style==='leather')) {
    const slot=entry.item.kind==='gloves'?'gloves':entry.item.kind as 'head'|'chest'|'legs'|'boots';eq[slot]=entry.item;
  }
  eq.weapon=exhibits[0].item;
  if(item.kind==='weapon')eq.weapon=item;
  else if(['shield','orb','grimoire'].includes(item.kind)){eq.offhand=item;if(item.kind!=='shield')eq.weapon=exhibits.find(e=>e.item.weapon?.family==='wand')!.item;}
  else if(item.kind==='ring')eq.ring1=item;
  else eq[item.kind as 'chest'|'head'|'gloves'|'legs'|'boots'|'cloak'|'amulet']=item;
  sim.player.character.look.showHelmet=item.kind==='head';
  refreshCharacter(sim.player);
}
function select(){
  const entry=exhibits[selected];inspection.querySelector('h2')!.textContent=entry.name;inspection.querySelector('.material')!.textContent=`${entry.material} · ${Number(entry.chance.toFixed(2))}% in this area / encounter`;
  const stats=Object.entries(entry.item.implicit).map(([stat,value])=>`${STAT_LABELS[stat as StatKey]} ${formatStatValue(stat as StatKey,value!)}`);
  if(entry.item.weapon)stats.unshift(`${entry.item.weapon.damage} ${entry.item.weapon.damageType} damage`);
  inspection.querySelector('.base-stats')!.textContent=`${stats.join(' · ')}${entry.baseScale!==1?` · ${Math.round(entry.baseScale*100)}% base`:''}`;
  try{if(study)study.setShapes(itemDropShapes(entry.item));else study=new GearLightStudy(canvas,itemDropShapes(entry.item));}catch{inspection.querySelector('.hint')!.textContent='Lighting preview unavailable';}
  equip();canvas.hidden=mode!=='item';portraitCanvas.hidden=mode!=='character';inspection.classList.toggle('portrait-mode',mode==='character');
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-mode]'))button.classList.toggle('active',button.dataset.mode===mode);
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-item]')){button.classList.toggle('active',Number(button.dataset.item)===selected);button.setAttribute('aria-pressed',String(Number(button.dataset.item)===selected));}
  history.replaceState(null,'',`?item=${selected}${mode==='character'?'&portrait':''}`);draw();
}
function tick(time:number){frame=0;if(document.hidden||!rotate.checked||reduced.matches)return;
  if(time-lastFrame>=1000/30){lightX=.5+Math.cos(time*.0006)*.6;lightY=.5+Math.sin(time*.0006)*.6;draw();lastFrame=time;}frame=requestAnimationFrame(tick);}
function resume(){if(!frame&&!document.hidden&&rotate.checked&&!reduced.matches)frame=requestAnimationFrame(tick);}
root.addEventListener('click',event=>{const button=(event.target as Element).closest<HTMLButtonElement>('button');if(!button)return;
  if(button.dataset.item!==undefined){selected=Number(button.dataset.item);select();}
  if(button.dataset.group){filter=button.dataset.group;for(const b of root.querySelectorAll('[data-group]'))b.classList.toggle('active',(b as HTMLElement).dataset.group===filter);renderGallery();}
  if(button.dataset.mode){mode=button.dataset.mode as typeof mode;select();}
},{signal:lifetime.signal});
for(const target of [canvas,portraitCanvas])target.addEventListener('pointermove',event=>{if(rotate.checked)return;const r=target.getBoundingClientRect();lightX=(event.clientX-r.left)/r.width;lightY=1-(event.clientY-r.top)/r.height;draw();},{signal:lifetime.signal});
strength.addEventListener('input',draw,{signal:lifetime.signal});lamp.addEventListener('change',draw,{signal:lifetime.signal});rotate.addEventListener('change',resume,{signal:lifetime.signal});
document.addEventListener('visibilitychange',resume,{signal:lifetime.signal});reduced.addEventListener('change',resume,{signal:lifetime.signal});
root.querySelector<HTMLSelectElement>('[aria-label="Filter material"]')!.addEventListener('change',event=>{materialFilter=(event.target as HTMLSelectElement).value;renderGallery();},{signal:lifetime.signal});
for(const label of ['Area level','Encounter difficulty'])root.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!.addEventListener('change',()=>{
  areaLevel=Number(root.querySelector<HTMLSelectElement>('[aria-label="Area level"]')!.value);
  encounter=root.querySelector<HTMLSelectElement>('[aria-label="Encounter difficulty"]')!.value as typeof encounter;
  exhibits=equipmentExhibits(areaLevel,encounter==='bossChest'?{encounter:'bossChest'}:{rank:encounter});renderGallery();select();
},{signal:lifetime.signal});
renderGallery();select();
if(import.meta.hot)import.meta.hot.dispose(()=>{lifetime.abort();cancelAnimationFrame(frame);study?.dispose();});
