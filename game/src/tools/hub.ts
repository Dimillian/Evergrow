import '../typography.css';
import './tools.css';
import { loadGameFont } from '../font.ts';
import { escapeUI as e } from '../ui-components.ts';
import { TOOLS, WORKSPACES, toolURL, safeToolPath, toolForPath } from './catalog.ts';
if (!import.meta.env.DEV) throw new Error('Tools require the local development server.');
await loadGameFont();
const root = document.querySelector<HTMLElement>('#tools')!;
const params = new URLSearchParams(location.search);
let active = TOOLS.find(t => t.id === params.get('tool'));
let group = active?.group ?? params.get('group') ?? '';
let query = '';
function render() {
  const workspace = WORKSPACES.find(w => w.id === group);
  root.innerHTML = `<aside class="tools-sidebar"><a class="tools-brand" href="/tools/">✦ <span>EVERGROW<small>Development tools</small></span></a><nav aria-label="Workspaces"><a href="/tools/" ${!group?'aria-current="page"':''}>All tools</a>${WORKSPACES.map(w=>`<a href="/tools/?group=${w.id}" ${group===w.id?'aria-current="page"':''}><span>${w.icon}</span>${w.name}</a>`).join('')}</nav><footer><span class="local-dot"></span> Local development<br><small>Staged data · no character saves</small><a href="/">Open game ↗</a></footer></aside><main class="tools-main ${active?'has-preview':''}"><header class="tools-header"><div><a class="tools-crumb" href="/tools/">Tools</a><h1>${e(active?.name ?? workspace?.name ?? 'The workshop')}</h1><p>${e(active?.description ?? workspace?.description ?? 'Inspect the game. Build a look, forge an item, replay a skill or explore a seed.')}</p></div>${active?`<a class="tools-button" href="${e(safeToolPath(active,params.get('view')))}">Open standalone ↗</a>`:`<label class="tools-search">Find a tool<input type="search" placeholder="Try armor, animation, seed, loot…" aria-label="Search tools" value="${e(query)}"></label>`}</header>${active?`<nav class="tools-tabs" aria-label="Related tools">${TOOLS.filter(t=>t.group===active!.group).map(t=>`<a href="${toolURL(t)}" ${t.id===active!.id?'aria-current="page"':''}>${e(t.name)}</a>`).join('')}</nav><iframe class="tools-preview" title="${e(active.name)}" src="${e(safeToolPath(active,params.get('view')))}"></iframe>`:`<div id="tools-results"></div>`}</main>`;
  root.querySelector<HTMLInputElement>('input[type=search]')?.addEventListener('input', ev => {query=(ev.target as HTMLInputElement).value;results();});
  results();
}
function results() {
  const mount=root.querySelector('#tools-results');if(!mount)return;
  const words=query.toLowerCase().split(/\s+/).filter(Boolean);
  const groups=WORKSPACES.filter(w=>(!group||w.id===group)&&(w.id!=='archive'||group==='archive'||query));
  let total=0;
  mount.innerHTML=groups.map(w=>{const tools=TOOLS.filter(t=>t.group===w.id&&words.every(word=>`${t.name} ${t.description} ${t.tags??''} ${w.name}`.toLowerCase().includes(word)));total+=tools.length;
    return tools.length?`<section class="tools-section"><h2>${w.icon} ${w.name}<small>${tools.length} views</small></h2><div class="tools-grid">${tools.map(t=>`<a class="tool-card" href="${toolURL(t)}"><h3>${e(t.name)}<span>↗</span></h3><p>${e(t.description)}</p></a>`).join('')}</div></section>`:'';}).join('');
  if(!total)mount.innerHTML='<p class="tools-empty">No matching tools. Try “world”, “skill” or “equipment”.</p>';
}
window.addEventListener('message',event=>{
  const frame=root.querySelector('iframe');
  if(event.origin!==location.origin||event.source!==frame?.contentWindow||event.data?.type!=='evergrow:tool-route'||typeof event.data.path!=='string')return;
  const tool=toolForPath(event.data.path);if(!tool)return;
  if(tool.id!==active?.id){location.href=toolURL(tool,event.data.path);return;}
  const path=safeToolPath(tool,event.data.path);history.replaceState(null,'',toolURL(tool,path));
  const standalone=root.querySelector<HTMLAnchorElement>('.tools-header .tools-button');if(standalone)standalone.href=path;
});
render();
