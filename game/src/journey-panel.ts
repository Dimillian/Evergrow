import { formatWorldDistance } from './world-distance.ts';
import { journeyXP } from './journey-rewards.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { miniJourneys, recommendedJourney, nearbyJourneys, journeyLevelFit, JOURNEY_CONTENT, type JourneyState, type JourneyGoal, type JourneyCommand } from './journey-state.ts';
import { journeyObjective, journeyAvailable, type JourneyFacts } from './journey-director.ts';
import { getJourneyLogAnchor } from './map-view.ts';
import './journeys.css';
import './hud-sidebar.css';
const e=escapeUI;
interface Hooks { open(id?:string):void;close():void;command(c:JourneyCommand):boolean|Promise<boolean>;map(id:string):void }
/** One projection backs the HUD list and its dialog. No progression or rewards live here. */
export class JourneyPanel {
  readonly element:HTMLElement;readonly mini:HTMLElement;
  private abort=new AbortController();private focus:ReturnType<typeof trapDialogFocus>|null=null;
  private selected:string|null=null;private state:JourneyState|null=null;private facts:JourneyFacts|null=null;
  private signature='';private miniSignature='';
  constructor(mount:HTMLElement,hudMount:HTMLElement,hooks:Hooks){
    this.element=document.createElement('section');this.element.className='journey-panel';this.element.hidden=true;mount.append(this.element);
    this.mini=document.createElement('aside');this.mini.className='journey-mini hud-sidebar-surface';this.mini.hidden=true;this.mini.setAttribute('aria-label','Journeys');hudMount.append(this.mini);
    this.mini.addEventListener('click',event=>{
      const b=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b||!this.state)return;
      if(b.dataset.collapse!==undefined)hooks.command({type:'collapse',value:!this.state.collapsed});else hooks.open(b.dataset.goal);
    },{signal:this.abort.signal});
    this.element.addEventListener('click',event=>{
      const b=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b||!this.state)return;
      if(b.dataset.close!==undefined)hooks.close();
      else if(b.dataset.select){this.selected=b.dataset.select;this.render();}
      else if(b.dataset.action==='suggestions')hooks.command({type:'suggestions',value:!this.state.suggestions});
      else if(this.selected){
        if(b.dataset.action==='map')hooks.map(this.selected);
        else if(b.dataset.action==='track'||b.dataset.action==='untrack'||b.dataset.action==='dismiss')hooks.command({type:b.dataset.action,id:this.selected});
      }
    },{signal:this.abort.signal});
  }
  update(state:JourneyState,facts:JourneyFacts,playing:boolean,width:number,height:number){
    this.state=state;this.facts=facts;this.mini.hidden=!playing;
    const anchor=getJourneyLogAnchor(width,height);
    this.mini.style.left=`${anchor.x/width*100}%`;
    this.mini.style.top=`${anchor.y/height*100}%`;
    this.mini.style.width=`${anchor.width/width*100}%`;
    const list=miniJourneys(state,facts),recommended=recommendedJourney(state);
    const firstNearby=list.find(g=>g.id!==state.tracked&&g.id!==recommended?.id)?.id;
    const html=`<header><button class="journey-mini-title" data-open>Journeys<kbd class="hud-sidebar-key">J</kbd></button><button data-collapse aria-label="${state.collapsed?'Expand':'Collapse'} journeys" aria-expanded="${!state.collapsed}">${uiIcon('chevron')}</button></header>${state.collapsed?'':list.map(g=>`${g.id===recommended?.id?'<div class="journey-mini-section">Recommended</div>':g.id===firstNearby?'<div class="journey-mini-section">Nearby</div>':''}<button class="journey-mini-row ${g.id===state.tracked?'is-tracked':''}" data-goal="${e(g.id)}" data-tooltip="${e(g.name)} · ${e(journeyObjective(g,facts))} · Level ${g.level}${g.level>facts.level+2?' · Harder':''}" data-tooltip-align="end" aria-label="${e(g.name)} · Level ${g.level} · ${journeyLevelFit(g.level,facts.level)}"><span class="journey-symbol">${g.finishedAt!==undefined?'✓':g.id===state.tracked?'◆':'◇'}</span><span><strong>${e(g.name)}</strong></span><span class="journey-mini-level" data-fit="${journeyLevelFit(g.level,facts.level)}"><span>Lv</span> ${g.level}</span></button>`).join('')}`;
    if(html!==this.miniSignature){this.mini.innerHTML=html;this.miniSignature=html;}
    if(!this.element.hidden){const signature=JSON.stringify([state,Math.round(facts.x/100),Math.round(facts.y/100),facts.level,facts.expeditions.location,list.map(g=>journeyObjective(g,facts))]);if(signature!==this.signature){this.signature=signature;this.render();}}
  }
  bounds(width:number,height:number){
    if(this.mini.hidden)return null;
    const r=this.mini.getBoundingClientRect(),parent=this.mini.parentElement!.getBoundingClientRect();
    return {x:(r.left-parent.left)/parent.width*width,y:(r.top-parent.top)/parent.height*height,width:r.width/parent.width*width,height:r.height/parent.height*height};
  }
  open(id?:string){this.selected=id??this.state?.tracked??this.state?.accepted[0]?.id??this.state?.offers[0]?.id??null;this.element.hidden=false;this.render();this.focus=trapDialogFocus(this.element,{signal:this.abort.signal});}
  close(){this.focus?.dispose();this.focus=null;this.element.hidden=true;}
  private render(){
    const state=this.state,facts=this.facts;if(!state||!facts)return;
    const goals=[...state.accepted,...state.offers,...state.history.slice(-8).reverse()];
    const g=goals.find(v=>v.id===this.selected)??goals[0];this.selected=g?.id??null;
    const focus=(document.activeElement as HTMLElement|null)?.dataset;
    const recommended=recommendedJourney(state),nearby=nearbyJourneys(state,facts).filter(v=>v.id!==recommended?.id);
    const rows=(title:string,items:JourneyGoal[])=>items.length?`<h3>${title}</h3>${items.map(v=>`<button class="journey-list-row ${v.id===g?.id?'is-selected':''}" data-select="${e(v.id)}" aria-pressed="${v.id===g?.id}"><span>${v.finishedAt!==undefined?'✓':v.id===state.tracked?'◆':'◇'}</span><span>${e(v.name)}</span><span class="journey-list-level" data-fit="${journeyLevelFit(v.level,facts.level)}" aria-label="Level ${v.level} · ${journeyLevelFit(v.level,facts.level)}">${v.level}</span></button>`).join('')}`:'';
    const detail=g?JOURNEY_CONTENT[g.kind]:null,accepted=!!g&&state.accepted.some(v=>v.id===g.id);
    const distance=g?Math.hypot(g.x-facts.x,g.y-facts.y):0;
    const known=!!g&&facts.discovered(g.id),done=g?.finishedAt!==undefined,available=!!g&&journeyAvailable(g,facts);
    const distanceLabel=facts.expeditions.location?(facts.expeditions.location===g?.id?'Current crypt':'On the surface'):formatWorldDistance(distance);
    this.element.innerHTML=`<section class="ui-window journey-window" role="dialog" aria-modal="true" aria-labelledby="journey-title"><header class="ui-window-header"><span class="journey-heading-icon">${uiIcon('map')}</span><h2 class="ui-title" id="journey-title">Journeys</h2><button class="ui-button ui-button--icon" data-close aria-label="Close journeys">×</button></header><div class="journey-columns"><nav class="journey-list ui-scroll-area" aria-label="Activities">${rows('Recommended',recommended?[recommended]:[])}${rows('Accepted',state.accepted)}${rows('Nearby',nearby)}${rows('Completed',state.history.slice(-8).reverse())}${goals.length?'':'<p class="ui-muted">Explore to find new activities.</p>'}</nav><div class="journey-detail ui-scroll-area">${g?`<h3>${e(g.name)}</h3><div class="journey-meta"><span class="ui-badge">Level ${g.level}</span><span class="${g.level>facts.level+2?'journey-danger':''}">${e(detail!.category)}${journeyLevelFit(g.level,facts.level)==='Good level'?'':` · ${journeyLevelFit(g.level,facts.level)}`}</span></div><p class="journey-objective">${e(journeyObjective(g,facts))}</p><dl><dt>Location</dt><dd>${e(g.region)}${known?'':' · Search area'}</dd><dt>Distance</dt><dd>${distanceLabel}</dd><dt>Reward</dt><dd>${e(detail!.reward)}${!done||g.rewardXP?` · +${(done?g.rewardXP!:journeyXP(g.kind,g.level,facts.level)).toLocaleString()} XP`: ''}</dd></dl>${!done?`<div class="journey-actions"><button class="ui-button ui-button--primary" data-action="${g.id===state.tracked?'untrack':'track'}" ${g.id!==state.tracked&&(!available||!accepted&&state.accepted.length>=3)?'disabled':''}>${g.id===state.tracked?'Untrack':'Track'}</button><button class="ui-button" data-action="map">Show on map</button><button class="ui-button ui-button--quiet" data-action="dismiss">Dismiss</button></div>${!available?'<p class="ui-muted">Finish your current trial or expedition first.</p>':''}${!accepted&&state.accepted.length>=3?'<p class="ui-muted">Three activities accepted. Dismiss one to track another.</p>':''}`:''}`:'<p class="ui-muted">No activity selected.</p>'}</div></div><footer class="ui-window-footer"><button class="ui-button ui-button--quiet" data-action="suggestions" aria-pressed="${state.suggestions}">${state.suggestions?'Hide':'Show'} suggestions</button><span class="ui-muted">J</span></footer></section>`;
    if(focus?.select)this.element.querySelector<HTMLElement>(`[data-select="${CSS.escape(focus.select)}"]`)?.focus({preventScroll:true});
    else if(focus?.action)this.element.querySelector<HTMLElement>(`[data-action="${CSS.escape(focus.action)}"]`)?.focus({preventScroll:true});
  }
  dispose(){this.close();this.abort.abort();this.element.remove();this.mini.remove();}
}
