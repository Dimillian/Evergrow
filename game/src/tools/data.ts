import { toolPage, downloadJSON, reportRoute } from './common.ts';
import { TOOLS, toolURL } from './catalog.ts';
import { DATASETS, type DataRecord } from './datasets.ts';
import { escapeUI as e } from '../ui-components.ts';
const root=await toolPage('Game data','Current source definitions, searchable and exportable. Values come directly from the game registries. Select a record to inspect its fields.');
const params=new URLSearchParams(location.search);
let dataset=DATASETS.find(d=>d.id===params.get('dataset'))??DATASETS[0],query=params.get('q')??'',selected:DataRecord|undefined;
root.insertAdjacentHTML('beforeend',`<div class="tool-toolbar"><label>Catalog<select id="dataset">${DATASETS.map(d=>`<option value="${d.id}">${e(d.name)} (${d.records.length})</option>`).join('')}</select></label><label>Search fields & values<input style="width:300px" type="search" id="search" placeholder="Name, ID, element, stat…" value="${e(query)}"></label><button id="export-data">Export catalog</button><button id="export-record">Export record</button></div><p class="tool-status" role="status"></p><div class="tool-split"><section class="tool-panel"><div class="tool-list"></div></section><section class="tool-panel" id="inspection"></section></div>`);
const list=root.querySelector<HTMLElement>('.tool-list')!,select=root.querySelector<HTMLSelectElement>('#dataset')!;select.value=dataset.id;
function records(){return dataset.records.filter(r=>query.toLowerCase().split(/\s+/).every(w=>r.search.includes(w)));}
function related(record:DataRecord){
 const links:Array<[string,string,string]>=[];
 if(['skills','execution'].includes(dataset.id))links.push(['Play this skill','playground',`/tools/skills.html?skill=${encodeURIComponent(record.id)}`]);
 if(dataset.id==='specializations'){const v=record.value as {skill:string;id:string};links.push(['Play this specialization','playground',`/tools/skills.html?skill=${encodeURIComponent(v.skill)}&specialization=${encodeURIComponent(v.id)}`]);}
 if(['weapons','shields','foci','jewelry'].includes(dataset.id)){const v=record.value as {kind?:string;visual?:{kind:string}};const kind=dataset.id==='weapons'?'weapon':dataset.id==='shields'?'shield':dataset.id==='foci'?v.visual?.kind:v.kind;links.push(['Generate this equipment','forge',`/tools/forge.html?kind=${kind}&profile=${encodeURIComponent(record.id)}`]);}
 if(dataset.id==='enemies')links.push(['View creature models','bestiary','/bestiary.html']);
 if(['places','event-recipes'].includes(dataset.id))links.push(['Find placements','placements',`/tools/placements.html?kind=${encodeURIComponent(record.id)}`]);
 return links.map(([name,id,path])=>`<a class="tools-button" target="_top" href="${toolURL(TOOLS.find(t=>t.id===id)!,path)}">${name} ↗</a>`).join('');
}
function inspect(record:DataRecord|undefined){selected=record;const view=root.querySelector('#inspection')!;
 if(!record){view.innerHTML='<p>No matching records.</p>';return;}
 const value=record.value,fields=value!==null&&typeof value==='object'?Object.entries(value):[['value',value]];
 view.innerHTML=`<h2>${e(record.name)}</h2><p>${e(dataset.source)} · ${e(record.id)}</p>${related(record)}<table class="tool-table"><tbody>${fields.map(([k,v])=>`<tr><th>${e(String(k))}</th><td>${e(typeof v==='object'?JSON.stringify(v):String(v))}</td></tr>`).join('')}</tbody></table><details><summary>Raw JSON</summary><pre>${e(JSON.stringify(value,null,2))}</pre></details>`;
 for(const button of list.querySelectorAll<HTMLElement>('button'))button.setAttribute('aria-pressed',String(Number(button.dataset.record)===dataset.records.indexOf(record)));
 root.querySelector<HTMLButtonElement>('#export-record')!.disabled=false;
 history.replaceState(null,'',`?${new URLSearchParams({dataset:dataset.id,record:record.id,q:query})}`);reportRoute();
}
function render(){const found=records();list.innerHTML=found.map(r=>`<button data-record="${dataset.records.indexOf(r)}">${e(r.name)}<small>${e(r.id)}</small></button>`).join('');root.querySelector('.tool-status')!.textContent=`${found.length} / ${dataset.records.length} records · ${DATASETS.length} catalogs · ${dataset.source}`;root.querySelector<HTMLButtonElement>('#export-record')!.disabled=!found.length;inspect(found.find(r=>r.id===params.get('record'))??found[0]);}
select.addEventListener('change',()=>{dataset=DATASETS.find(d=>d.id===select.value)!;params.delete('record');render();});root.querySelector<HTMLInputElement>('#search')!.addEventListener('input',ev=>{query=(ev.target as HTMLInputElement).value;render();});
list.addEventListener('click',ev=>{const b=(ev.target as Element).closest<HTMLElement>('[data-record]');if(b)inspect(dataset.records[Number(b.dataset.record)]);});
root.querySelector('#export-data')!.addEventListener('click',()=>downloadJSON(`evergrow-${dataset.id}.json`,{source:dataset.source,records:dataset.records.map(r=>({id:r.id,value:r.value}))}));root.querySelector('#export-record')!.addEventListener('click',()=>{if(selected)downloadJSON(`evergrow-${dataset.id}-${selected.id.replace(/[^a-z0-9_-]/gi,'-')}.json`,selected.value);});render();
