import '../ui-kit.css';
import '../item-ui.css';
import { toolPage, boundedNumber, downloadJSON, reportRoute } from './common.ts';
import { forgeItem, forgeProfiles, forgeMaterials, type ForgeRecipe } from './forge-model.ts';
import { ITEM_KINDS, TIER_NAMES, createCharacterSheet } from '../items.ts';
import { ITEM_MATERIALS } from '../item-materials.ts';
import { itemIconSVG } from '../item-art.ts';
import { itemTooltipMarkup } from '../item-ui.ts';
import { escapeUI as e } from '../ui-components.ts';
import { Simulation } from '../simulation.ts';
import { refreshCharacter } from '../character.ts';
import { equipItem } from '../inventory.ts';
import { drawCharacterPortrait } from '../character-portrait.ts';
import type { Item, ItemKind, ItemTier } from '../character-types.ts';
const root=await toolPage('Item forge','Generate reproducible items with the real gear rules. Inspect affixes, preview equipment and export recipes. Everything stays in this study.');
const q=new URLSearchParams(location.search);
root.insertAdjacentHTML('beforeend',`<form class="tool-toolbar"><label>Seed<input name="seed" type="number" min="0" max="4294967295" value="${boundedNumber(q.get('seed'),7319,0,4294967295)}" required></label><label>Item level<input name="level" type="number" min="1" max="1000000" value="${boundedNumber(q.get('level'),10,1,1000000)}" required></label><label>Kind<select name="kind">${ITEM_KINDS.map(k=>`<option>${k}</option>`).join('')}</select></label><label>Profile<select name="profile"></select></label><label>Rarity<select name="tier">${Object.entries(TIER_NAMES).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><label>Material<select name="material"></select></label><label>Enhancement<input name="enhancement" type="number" min="0" max="10" value="${boundedNumber(q.get('enhancement'),0,0,10)}" required></label><button type="submit">Generate item</button><button type="button" id="random">Random seed</button><button type="button" id="batch">Generate 12</button></form><p class="tool-status" role="status"></p><div class="tool-split"><section class="tool-panel"><div id="gear"></div><div id="tooltip"></div><button id="export">Export item JSON</button><details><summary>Exact recipe & derived data</summary><pre id="recipe"></pre></details></section><section class="tool-panel"><h2>Equipped preview</h2><label>Facing <input id="facing" type="range" min="0" max="7" value="2"></label><canvas id="portrait" width="600" height="660" aria-label="Generated equipment on a staged character"></canvas><p>Neutral starter outfit. Hand conflicts use the real inventory rules.</p><h2>This session <small>latest 16</small></h2><div class="forge-history"></div></section></div>`);
const form=root.querySelector('form')!,field=(name:string)=>form.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement;
field('kind').value=ITEM_KINDS.includes(q.get('kind') as ItemKind)?q.get('kind')!:'weapon';
field('tier').value=Object.hasOwn(TIER_NAMES,q.get('tier')??'')?q.get('tier')!:'rare';
function profiles(){const kind=field('kind').value as ItemKind;field('profile').innerHTML=forgeProfiles(kind).map(p=>`<option value="${p.id}">${e(p.name)}</option>`).join('')||'<option value="">Automatic</option>';materials();}
function materials(){field('material').innerHTML='<option value="">Rolled naturally</option>'+forgeMaterials(field('kind').value as ItemKind,field('profile').value).map(m=>`<option value="${m.id}">${ITEM_MATERIALS[m.id].name}</option>`).join('');}
profiles();if(forgeProfiles(field('kind').value as ItemKind).some(p=>p.id===q.get('profile')))field('profile').value=q.get('profile')!;materials();if(forgeMaterials(field('kind').value as ItemKind,field('profile').value).some(m=>m.id===q.get('material')))field('material').value=q.get('material')!;
field('kind').addEventListener('change',profiles);field('profile').addEventListener('change',materials);
const sim=new Simulation({blocked:()=>false,move:(x,y,dx,dy)=>({x:x+dx,y:y+dy})},{spawn:false});
const history:Array<{item:Item;recipe:ForgeRecipe}>=[];let current:Item;
function draw(){const c=root.querySelector<HTMLCanvasElement>('#portrait')!;drawCharacterPortrait(c.getContext('2d')!,sim.player,2,Number(root.querySelector<HTMLInputElement>('#facing')!.value)*Math.PI/4,c.width,c.height);}
function inspect(entry:typeof history[number]){
  current=entry.item;for(const [k,v]of Object.entries(entry.recipe)){if(k==='kind'){field(k).value=String(v);profiles();}else if(k==='profile'){field(k).value=String(v);materials();}else field(k).value=String(v);}
  sim.player.character=createCharacterSheet();sim.player.level=entry.recipe.level;sim.player.character.inventory[0]=current;
  const result=equipItem(sim.player.character,0,sim.player.level);refreshCharacter(sim.player);
  root.querySelector('#gear')!.innerHTML=itemIconSVG(current,160);
  root.querySelector('#tooltip')!.innerHTML=itemTooltipMarkup(current,{sheet:createCharacterSheet(),level:sim.player.level});
  root.querySelector('#recipe')!.textContent=JSON.stringify(current,null,2);
  root.querySelector('.tool-status')!.textContent=result.ok?`${current.name} · seed ${entry.recipe.seed} · item level ${current.itemLevel}`:result.message??'Preview unavailable';
  const query=new URLSearchParams(Object.entries(entry.recipe).map(([k,v])=>[k,String(v)]));historyURL(query);draw();
}
function historyURL(query:URLSearchParams){window.history.replaceState(null,'',`?${query}`);reportRoute();}
function generate(count=1){if(!form.reportValidity())return;
  try{const recipe:ForgeRecipe={seed:Number(field('seed').value),level:Number(field('level').value),kind:field('kind').value as ItemKind,profile:field('profile').value,tier:field('tier').value as ItemTier,material:field('material').value,enhancement:Number(field('enhancement').value)};
    for(let i=0;i<count;i++){const r={...recipe,seed:(recipe.seed+i)>>>0};history.unshift({item:forgeItem(r),recipe:r});}history.splice(16);
    inspect(history[0]);root.querySelector('.forge-history')!.innerHTML=history.map((h,i)=>`<button data-history="${i}" title="${e(h.item.name)}">${itemIconSVG(h.item,48)}<small>${h.recipe.seed}</small></button>`).join('');
  }catch(error){root.querySelector('.tool-status')!.textContent=String(error);}}
form.addEventListener('submit',event=>{event.preventDefault();generate();});root.querySelector('#random')!.addEventListener('click',()=>{field('seed').value=String(crypto.getRandomValues(new Uint32Array(1))[0]);generate();});root.querySelector('#batch')!.addEventListener('click',()=>generate(12));
root.querySelector('#facing')!.addEventListener('input',draw);root.querySelector('#export')!.addEventListener('click',()=>downloadJSON(`evergrow-item-${current.seed}.json`,current));
root.querySelector('.forge-history')!.addEventListener('click',ev=>{const b=(ev.target as Element).closest<HTMLElement>('[data-history]');if(b)inspect(history[Number(b.dataset.history)]);});
generate();
