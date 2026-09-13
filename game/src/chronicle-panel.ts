import { uniqueCollection } from './unique-collection.ts';
import { generateUnique, STAT_LABELS } from './items.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { itemIconSVG } from './item-art.ts';
import { formatWorldDistance } from './world-distance.ts';
import { ACHIEVEMENTS, CHRONICLE_STAT_HELP, achievementTier, achievementValue, STAT_GROUPS, type Achievement } from './chronicle-content.ts';
import { chronicleValues, emptyChronicle, type ChronicleLedger, type ChronicleSource } from './chronicle.ts';
import { escapeUI as esc, trapDialogFocus, uiIcon } from './ui-components.ts';
import { GamepadMenu } from './gamepad-menu.ts';
import { PAD, type GamepadInput } from './gamepad-input.ts';
import { UITooltip } from './ui-tooltip.ts';
import './chronicle-panel.css';
let nextTooltipId=0;
const tabs = ['Overview', 'Achievements', 'Statistics', 'Uniques'] as const;
const number = (n:number) => Math.floor(n).toLocaleString();
const duration = (n:number) => n < 3600 ? `${Math.floor(n/60)}m` : `${Math.floor(n/3600)}h ${Math.floor(n%3600/60)}m`;
const label = (s:string) => s.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase());
const format = (key:string,n:number) => ['time','longestLife'].includes(key)?duration(n):key==='distance'?formatWorldDistance(n):number(n);
const engraving:Record<string,string> = {
 blade:'M17 32 32 11 29 25 19 34M15 28 24 35M17 32 12 39', crown:'m10 19 7 7 7-14 7 14 7-7-4 18H14Z',
 spark:'m28 8-14 19h10l-4 13 15-21H25Z', flame:'M25 8c4 12 13 14 11 23-2 13-22 13-24 0-1-6 4-12 8-16-1 7 1 10 3 10 4-3 4-10 2-17Z',
 star:'m24 9 4 11 12 4-12 4-4 12-4-12-12-4 12-4Z',heart:'M24 37 11 25C0 10 20 9 24 18c4-9 24-8 13 7Z',
 shield:'m24 9 14 5-2 15-12 12-12-12-2-15Z',flask:'M19 9h10m-8 1v12L12 35q-2 6 5 6h14q7 0 5-6l-9-13V10M16 30h16',
 compass:'m31 15-5 13-13 5 5-13ZM24 5v4m0 31v4M5 24h4m31 0h4',coin:'M24 10a14 14 0 1 0 0 28 14 14 0 1 0 0-28m0 7v14m-4-11 4-3 4 3',
 gem:'m11 17 6-7h14l6 7-13 23ZM11 17h26M17 10l7 30 7-30',hammer:'m13 14 7-7 17 17-7 7ZM23 24 10 37l4 4 13-13',
};
function badge(a:Achievement,tier:number) {return `<svg class="chronicle-badge ${tier?'is-earned':''}" viewBox="0 0 64 64" aria-hidden="true"><path class="badge-frame" d="m32 2 26 15v30L32 62 6 47V17Z"/><path class="badge-inner" d="m32 7 22 13v24L32 57 10 44V20Z"/><g transform="translate(8 7)"><path d="${engraving[a.glyph]??engraving.star}"/></g></svg>`;}
/** Read-only projection: no storage writes or gameplay ownership. */
export class ChroniclePanel {
 readonly element:HTMLDivElement;
 private ledger=emptyChronicle(); private selected='all'; private tab=0; private group='All';
 private life=new AbortController(); private focus?:{dispose():void}; private controller=new GamepadMenu(); private revision=0; private lastTime=0;
 private uniqueFilter='All'; private uniqueSearch='';
 private embedded:boolean;
 private onClose:()=>void;
 private tooltip:UITooltip;
 private explainedAnchor:HTMLElement|null=null;
 private hideTimer:ReturnType<typeof setTimeout>|undefined;
 constructor(mount:HTMLElement,onClose:()=>void,embedded=false) {
  this.onClose=onClose;this.embedded=embedded;
  this.element=document.createElement('div');this.element.className='chronicle-overlay'+(embedded?' home-embedded':'');this.element.hidden=true;mount.append(this.element);
  this.tooltip=new UITooltip(embedded?(mount.parentElement??mount):mount,`chronicle-tooltip-${++nextTooltipId}`,'chronicle-tooltip');
  this.element.addEventListener('click',e=>{const anchor=(e.target as HTMLElement).closest<HTMLElement>('[data-achievement],[data-stat-help],[data-unique]');if(anchor)this.explain(anchor);else this.hideTooltip();
   const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(e.target===this.element||b?.hasAttribute('data-close'))this.close();else if(b?.dataset.tab!==undefined){this.tab=Number(b.dataset.tab);this.render();this.element.querySelector<HTMLElement>(`[data-tab="${this.tab}"]`)?.focus();}else if(b?.dataset.uniqueFilter){this.uniqueFilter=b.dataset.uniqueFilter;this.render();this.element.querySelector<HTMLElement>(`[data-unique-filter="${this.uniqueFilter}"]`)?.focus();}else if(b?.dataset.group){this.group=b.dataset.group;this.render();this.element.querySelector<HTMLElement>(`[data-group="${this.group}"]`)?.focus();}},{signal:this.life.signal});
  this.element.addEventListener('input',e=>{const input=e.target as HTMLInputElement;if(!input.matches('[data-unique-search]'))return;this.uniqueSearch=input.value;const caret=input.selectionStart;this.render();const next=this.element.querySelector<HTMLInputElement>('[data-unique-search]');next?.focus();if(caret!==null)next?.setSelectionRange(caret,caret);},{signal:this.life.signal});
  this.element.addEventListener('change',e=>{const s=e.target as HTMLSelectElement;if(s.matches('[data-character]')){this.selected=s.value;this.render();this.element.querySelector<HTMLElement>('[data-character]')?.focus();}},{signal:this.life.signal});
  this.element.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!this.tooltip.element.hidden)this.hideTooltip();else this.close();}},{signal:this.life.signal});
  this.element.addEventListener('pointerover',e=>{if(e.pointerType!=='touch')this.explain(e.target);},{signal:this.life.signal});
  this.element.addEventListener('focusin',e=>this.explain(e.target),{signal:this.life.signal});
  this.element.addEventListener('pointerout',e=>{
    if(e.pointerType==='touch')return;
    const anchor=(e.target as HTMLElement).closest('[data-achievement],[data-stat-help],[data-unique]');
    if(e.relatedTarget instanceof Node&&(anchor?.contains(e.relatedTarget)||this.tooltip.element.contains(e.relatedTarget)))return;
    this.cancelTooltipHide();this.hideTimer=setTimeout(()=>this.hideTooltip(),140);
  },{signal:this.life.signal});
  this.element.addEventListener('focusout',()=>this.hideTooltip(),{signal:this.life.signal});
  this.element.addEventListener('scroll',()=>this.hideTooltip(),{signal:this.life.signal,capture:true});
  this.tooltip.element.addEventListener('pointerenter',()=>this.cancelTooltipHide(),{signal:this.life.signal});
  this.tooltip.element.addEventListener('pointerleave',()=>this.hideTooltip(),{signal:this.life.signal});
  window.addEventListener('resize',()=>this.hideTooltip(),{signal:this.life.signal});
 }
 get opened(){return !this.element.hidden;}
 async open(load:(onCached:(ledger:ChronicleLedger)=>void)=>Promise<ChronicleLedger>,selected='all', initialTab:typeof tabs[number]='Overview') {
  this.hideTooltip();
  const revision=++this.revision;this.selected=selected;this.tab=tabs.indexOf(initialTab);this.group='All';this.element.hidden=false;
  this.element.innerHTML=`<section class="ui-window chronicle-window" role="${this.embedded?'region':'dialog'}" ${this.embedded?'':'aria-modal="true"'} aria-label="Chronicle"><header class="ui-window-header"><h2 class="ui-title">Chronicle</h2><button class="ui-button ui-button--quiet ui-button--icon" data-close aria-label="Close Chronicle">${uiIcon('close')}</button></header><p class="chronicle-loading" role="status">Loading…</p></section>`;
  this.focus?.dispose();if(!this.embedded)this.focus=trapDialogFocus(this.element,{signal:this.life.signal,restoreFocus:false,initialFocus:this.element});
  let shown=false;
  const show=(ledger:ChronicleLedger,final=false)=>{
    if(revision!==this.revision)return;
    if(!final&&!Object.keys(ledger.characters).length)return;
    if(shown&&JSON.stringify(this.ledger)===JSON.stringify(ledger)&&(this.selected==='all'||ledger.characters[this.selected]))return;
    const active=document.activeElement as HTMLElement|null;
    const focusKey=['data-tab','data-group','data-character','data-achievement','data-stat-help','data-unique','data-unique-filter','data-unique-search','data-close'].find(key=>active?.hasAttribute(key));
    const focusValue=focusKey?active!.getAttribute(focusKey):null;
    const scroll=this.element.querySelector('.chronicle-content')?.scrollTop??0;
    this.ledger=ledger;
    if(final&&this.selected!=='all'&&!ledger.characters[this.selected])this.selected='all';
    this.render();
    this.element.querySelector('.chronicle-content')!.scrollTop=scroll;
    const target=focusKey?[...this.element.querySelectorAll<HTMLElement>(`[${focusKey}]`)].find(el=>el.getAttribute(focusKey)===focusValue):null;
    if(!this.embedded||this.element.contains(active))(target??this.element).focus({preventScroll:true});
    shown=true;
  };
  try {show(await load(ledger=>show(ledger)),true);}
  catch (error) {console.error('Chronicle could not open',error);if(revision===this.revision&&!shown)this.element.querySelector('.chronicle-loading')!.textContent='History unavailable. Close and try again.';}
 }
 close(notify=true){if(!this.opened)return;this.hideTooltip();this.revision++;this.element.hidden=true;this.focus?.dispose();this.focus=undefined;this.controller.clear();if(notify)this.onClose();}
 private sources():ChronicleSource[]{const c=this.ledger.characters[this.selected];return c?c.sources.map(id=>this.ledger.sources[id]).filter(Boolean):Object.values(this.ledger.sources);}
 private unlocks(){const out:Record<string,number>=this.selected==='all'?{...this.ledger.unlocked}:{};for(const s of this.sources())for(const[k,v]of Object.entries(s.unlocked))out[k]=Math.min(out[k]??v,v);return out;}
 private card(a:Achievement,values:Record<string,number>) {const tier=achievementTier(a,values),value=achievementValue(a,values),target=a.tiers[Math.min(tier,a.tiers.length-1)],done=tier===a.tiers.length;
  return `<button class="chronicle-achievement ${tier?'is-earned':''}" data-achievement="${a.id}" aria-label="${esc(a.name)}. ${esc(a.description)} ${number(value)} of ${number(target)}">${badge(a,tier)}<span class="achievement-copy"><strong>${a.name}</strong><span class="achievement-tiers" aria-hidden="true">${a.tiers.map((_,i)=>`<i class="${i<tier?'earned':''}"></i>`).join('')}</span><span class="achievement-track"><i style="width:${Math.min(100,value/target*100)}%"></i></span><small>${done?'Complete':`${number(value)} <span>/ ${number(target)}</span>`}</small></span></button>`;
 }
 private render(){this.hideTooltip();const sources=this.sources(),values=chronicleValues(sources),earned=ACHIEVEMENTS.reduce((n,a)=>n+achievementTier(a,values),0),total=ACHIEVEMENTS.reduce((n,a)=>n+a.tiers.length,0);
  const chars=Object.values(this.ledger.characters).sort((a,b)=>Number(a.deleted)-Number(b.deleted)||b.updatedAt-a.updatedAt);
  this.element.innerHTML=`<section class="ui-window chronicle-window" role="${this.embedded?'region':'dialog'}" ${this.embedded?'':'aria-modal="true"'} aria-labelledby="chronicle-title"><header class="ui-window-header"><h2 id="chronicle-title" class="ui-title">Chronicle</h2><select data-character aria-label="Character history"><option value="all">All characters</option>${chars.map(c=>`<option value="${esc(c.id)}" ${c.id===this.selected?'selected':''}>${esc(c.name)} · Lv ${c.level}${c.deleted?' · Archived':''}</option>`).join('')}</select><button class="ui-button ui-button--quiet ui-button--icon" data-close aria-label="Close Chronicle">${uiIcon('close')}</button></header>
   <nav class="chronicle-tabs" aria-label="Chronicle sections">${tabs.map((t,i)=>`<button data-tab="${i}" aria-current="${i===this.tab?'page':'false'}">${t}</button>`).join('')}<span>${this.tab===3?uniqueCollection(sources).filter(u=>u.found).length:earned} <small>/ ${this.tab===3?uniqueCollection(sources).length:total}</small></span></nav>
   <div class="chronicle-content ui-scroll-area">${this.tab===0?this.overview(values):this.tab===1?this.achievements(values):this.tab===2?this.statistics(values):this.uniques()}</div>
   <footer class="chronicle-footer"><span>${values['seen:legacy']?'Older history is partial.':this.selected==='all'?`${chars.length} characters · Deleted characters retained`:'Character history'}</span><span>Esc / B <span>Close</span></span></footer></section>`;
 }
 private overview(v:Record<string,number>){const near=ACHIEVEMENTS.filter(a=>achievementTier(a,v)<a.tiers.length).sort((a,b)=>achievementValue(b,v)/b.tiers[achievementTier(b,v)]-achievementValue(a,v)/a.tiers[achievementTier(a,v)]).slice(0,4),unlocks=this.unlocks();
  const recent=ACHIEVEMENTS.filter(a=>achievementTier(a,v)>0).sort((a,b)=>(unlocks[b.id+':'+achievementTier(b,v)]??0)-(unlocks[a.id+':'+achievementTier(a,v)]??0)).slice(0,4);
  const totals:[string,string][]=[['time','Time played'],['kills','Enemies slain'],['highestLevel','Highest level'],['goldEarned','Gold earned'],['events','Events completed'],['crypts','Crypts cleared']];
  return `<div class="chronicle-totals">${totals.map(([k,l])=>`<div ${this.help(k)}><strong>${format(k,v[k]??0)}</strong><span>${l}</span></div>`).join('')}</div><section><h3>Within reach</h3><div class="chronicle-grid">${near.map(a=>this.card(a,v)).join('')}</div></section><section><h3>Personal bests</h3><div class="chronicle-records">${[['largestHit','Largest hit'],['highestEnemy','Strongest enemy'],['bestWaves','Cursed-chest waves'],['longestLife','Longest life']].map(([k,l])=>{const owner=this.sources().filter(s=>(s.values[k]??0)>0).sort((a,b)=>(b.values[k]??0)-(a.values[k]??0))[0];return `<div ${this.help(k)}><span>${l}</span><strong>${format(k,v[k]??0)}</strong><small>${owner?esc(owner.name):'—'}</small></div>`;}).join('')}</div></section><section><h3>Earned</h3>${recent.length?`<div class="chronicle-grid">${recent.map(a=>this.card(a,v)).join('')}</div>`:'<p class="chronicle-empty">Your first milestones begin here.</p>'}</section>`;
 }
 private achievements(v:Record<string,number>){return `<div class="chronicle-filters">${['All',...new Set(ACHIEVEMENTS.map(a=>a.group))].map(g=>`<button data-group="${g}" aria-pressed="${this.group===g}">${g}</button>`).join('')}</div><div class="chronicle-grid">${ACHIEVEMENTS.filter(a=>this.group==='All'||a.group===this.group).map(a=>this.card(a,v)).join('')}</div>`;}
 private statistics(v:Record<string,number>){const groups=Object.entries(STAT_GROUPS).map(([title,rows])=>`<section class="chronicle-stat-group"><h3>${title}</h3><dl>${rows.map(([k,l])=>`<div ${this.help(k)}><dt>${l}</dt><dd>${v[k]===undefined&&v['seen:legacy']?'—':format(k,v[k]??0)}</dd></div>`).join('')}</dl></section>`);
  const breakdown:[string,string][]=[['enemy:','Enemy families'],['rank:','Enemy ranks'],['damage:','Damage by element'],['skillDamage:','Damage by skill'],['skillUses:','Skill usage'],['items:','Equipment rarity'],['material:','Equipment materials'],['itemKind:','Equipment types'],['seen:biome:','Biomes visited'],['place:','Discoveries'],['event:','Events']];
  return `<div class="chronicle-stat-grid">${groups.join('')}${breakdown.filter(([prefix])=>Object.keys(v).some(k=>k.startsWith(prefix))).map(([prefix,title])=>`<section class="chronicle-stat-group"><h3>${title}</h3><dl>${Object.entries(v).filter(([k])=>k.startsWith(prefix)).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<div><dt>${esc(label(k.slice(prefix.length)))}</dt><dd>${prefix==='seen:biome:'?'Visited':number(n)}</dd></div>`).join('')}</dl></section>`).join('')}</div>`;
 }
 private uniques():string {
  const entries=uniqueCollection(this.sources()),query=this.uniqueSearch.trim().toLowerCase();
  const filtered=entries.filter(e=>(this.uniqueFilter==='All'||e.found===(this.uniqueFilter==='Found'))&&`${e.definition.name} ${SKILL_DEFINITIONS[e.definition.skill].name} ${e.definition.kind}`.toLowerCase().includes(query));
  return `<div class="chronicle-unique-controls"><div class="chronicle-filters">${['All','Found','Unfound'].map(f=>`<button data-unique-filter="${f}" aria-pressed="${this.uniqueFilter===f}">${f}</button>`).join('')}</div><input class="ui-input" data-unique-search type="search" aria-label="Search uniques or skills" placeholder="Search items or skills" value="${esc(this.uniqueSearch)}"/></div>
    <div class="chronicle-uniques">${filtered.map(({definition:u,found,level})=>`<button class="chronicle-unique ${found?'is-found':'is-unfound'}" data-unique="${u.id}" aria-label="${esc(u.name)} · ${found?'Found':'Unfound'}"><span class="chronicle-unique-art">${itemIconSVG(generateUnique(7319,Math.max(1,level),u.id),100)}</span><span class="chronicle-unique-caption"><small>${found?'✧ Discovered':'Undiscovered'}</small><strong>${esc(u.name)}</strong><span>${esc(SKILL_DEFINITIONS[u.skill].name)}</span></span></button>`).join('')}</div>${!filtered.length?'<p class="chronicle-empty">No matching uniques.</p>':''}`;
 }
 private cancelTooltipHide():void{clearTimeout(this.hideTimer);this.hideTimer=undefined;}
 private hideTooltip():void{this.cancelTooltipHide();this.explainedAnchor=null;this.tooltip.hide();}
 private help(key:string):string{return CHRONICLE_STAT_HELP[key]?`data-stat-help="${key}" tabindex="0"`:'';}
 private explain(target:EventTarget|null):void {
  const anchor=target instanceof Element?target.closest<HTMLElement>('[data-achievement],[data-stat-help],[data-unique]'):null;
  if(!anchor||!this.opened)return;
  this.cancelTooltipHide();
  if(this.explainedAnchor===anchor&&!this.tooltip.element.hidden)return;
  this.explainedAnchor=anchor;
  const entry=uniqueCollection(this.sources()).find(e=>e.definition.id===anchor.dataset.unique);
  if(entry){const u=entry.definition;
    this.tooltip.element.style.setProperty('--tooltip-color','#ef82ad');
    this.tooltip.show(`<header><div><small>${esc(u.kind)} · ${esc(SKILL_DEFINITIONS[u.skill].name)}</small><strong>${esc(u.name)}</strong></div></header><p>${esc(u.power)}</p><p class="chronicle-unique-affixes">${u.affixes.map(a=>esc(STAT_LABELS[a])).join(' · ')}</p><footer>${entry.found?`Found by ${esc(entry.finder??'Unknown')} · Highest level ${entry.level}${entry.firstAt?` · ${new Date(entry.firstAt).toLocaleDateString()}`:''}`:'Not yet discovered'}</footer>`,anchor);return;
  }
  const achievement=ACHIEVEMENTS.find(a=>a.id===anchor.dataset.achievement);
  if(achievement){
    const values=chronicleValues(this.sources()),tier=achievementTier(achievement,values),value=achievementValue(achievement,values);
    const at=this.unlocks()[achievement.id+':'+tier],done=tier===achievement.tiers.length;
    const target=achievement.tiers[Math.min(tier,achievement.tiers.length-1)];
    this.tooltip.element.style.setProperty('--tooltip-color',tier?'#ddc88b':'#9fc4d0');
    this.tooltip.show(`<header>${badge(achievement,tier)}<div><small>${esc(achievement.group)}</small><strong>${esc(achievement.name)}</strong></div></header><p>${esc(achievement.description)}</p><div class="chronicle-tooltip-progress"><span>${done?'Complete':'Next milestone'}</span><b>${format(achievement.metric,value)} / ${format(achievement.metric,target)}</b></div><div class="achievement-tiers" aria-hidden="true">${achievement.tiers.map((_,i)=>`<i class="${i<tier?'earned':''}"></i>`).join('')}</div>${at?`<footer>Earned ${new Date(at).toLocaleDateString()}</footer>`:''}`,anchor);
  }else{
    const key=anchor.dataset.statHelp!,description=CHRONICLE_STAT_HELP[key];if(!description)return;
    const title=Object.values(STAT_GROUPS).flat().find(([k])=>k===key)?.[1]??'Statistic';
    this.tooltip.element.style.setProperty('--tooltip-color','#9fc4d0');
    this.tooltip.show(`<strong>${esc(title)}</strong><p>${esc(description)}</p>`,anchor);
  }
 }
 updateGamepad(pad:GamepadInput,now:number){if(!this.opened)return false;if(pad.pressed.has(PAD.dodge)||pad.pressed.has(PAD.pause)){if(!this.tooltip.element.hidden)this.hideTooltip();else this.close();}else if(this.element.querySelector('.chronicle-content')){this.controller.update(this.element,pad,now,{switchTab:d=>{this.tab=(this.tab+d+tabs.length)%tabs.length;this.render();this.element.querySelector<HTMLElement>(`[data-tab="${this.tab}"]`)?.focus();}});const dt=this.lastTime?Math.min(.05,(now-this.lastTime)/1000):0;if(Math.abs(pad.aim.y)>.2)this.element.querySelector('.chronicle-content')!.scrollTop+=pad.aim.y*dt*550;}this.lastTime=now;return true;}
 dispose(){this.close(false);this.life.abort();this.tooltip.dispose();this.element.remove();}
}
