import type { DungeonJourney } from './dungeon-journey.ts';
import { settlementBenefits } from './settlement-services.ts';
import { formatWorldDistance } from './world-distance.ts';
import { journeyXP } from './journey-rewards.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { miniJourneys, journalJourneys, journeyLevelFit, JOURNEY_CONTENT, type JourneyState, type JourneyGoal, type JourneyCommand } from './journey-state.ts';
import { journeyObjective, type JourneyFacts } from './journey-director.ts';
import { getJourneyLogAnchor } from './map-view.ts';
import { journeyHUDPreferences } from './control-preferences.ts';
import { JourneyHUDPreferences, JOURNEY_HUD_LIMIT, type JourneyHUDSort } from './journey-hud-settings.ts';
import './journeys.css';
const e=escapeUI;
interface Hooks { open(id?:string):void;close():void;command(c:JourneyCommand):boolean|Promise<boolean>;map(id:string):void }
/** One projection backs the HUD list and its dialog. No progression or rewards live here. */
export class JourneyPanel {
  readonly element:HTMLElement;readonly mini:HTMLElement;
  private abort=new AbortController();private focus:ReturnType<typeof trapDialogFocus>|null=null;
  private selected:string|null=null;private state:JourneyState|null=null;private facts:JourneyFacts|null=null;
  private signature='';private miniSignature='';
  private dungeon:DungeonJourney|null=null;
  private scope='nearby';private townNavigation=false;
  private commandPending=false;private message='';
  private listScroll=0;private detailScroll=0;
  private hudSettingsOpen=false;private hudSettingsMessage='';
  private readonly hudPreferences:JourneyHUDPreferences;
  private readonly hudMount:HTMLElement;
  private hudView={playing:false,width:960,height:600};
  get hudVisible(){return this.hudPreferences.settings.visible;}
  get hudPreviewActive(){return this.hudSettingsOpen&&!this.element.hidden;}
  constructor(mount:HTMLElement,hudMount:HTMLElement,hooks:Hooks,hudPreferences=journeyHUDPreferences){
    this.hudPreferences=hudPreferences;
    this.hudMount=hudMount;
    this.element=document.createElement('section');this.element.className='journey-panel';this.element.hidden=true;mount.append(this.element);
    this.mini=document.createElement('aside');this.mini.className='journey-mini';this.mini.hidden=true;this.mini.setAttribute('aria-label','Journeys');hudMount.append(this.mini);
    const command=async(c:JourneyCommand)=>{
      if(this.commandPending)return;
      this.commandPending=true;this.message='';if(!this.element.hidden)this.render();
      try{if(!await hooks.command(c))this.message='The activity changed or could not be saved. Please try again.';}
      catch{this.message='Could not save the change. Please try again.';}
      finally{this.commandPending=false;if(!this.element.hidden)this.render();}
    };
    this.mini.addEventListener('click',event=>{
      if(this.hudPreviewActive)return;
      const b=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b||b.disabled||!this.state)return;
      // These actions keep gameplay live. Release focus before the save can rerender
      // the row, or the window keyboard handler treats WASD as button-owned input.
      if(b.dataset.collapse!==undefined||b.dataset.pin)b.blur();
      if(b.dataset.collapse!==undefined)void command({type:'collapse',value:!this.state.collapsed});
      else if(b.dataset.pin){
        const pinned=this.state.townPin?.id??this.state.tracked;
        void command({type:b.dataset.pin===pinned?'untrack':'track',id:b.dataset.pin});
      }else hooks.open(b.dataset.goal);
    },{signal:this.abort.signal});
    this.element.addEventListener('click',event=>{
      const b=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b||b.disabled||!this.state)return;
      if(b.dataset.close!==undefined)hooks.close();
      else if(b.dataset.action==='hudSettings')this.setHUDSettingsOpen(!this.hudSettingsOpen);
      else if(b.dataset.hudClose!==undefined)this.setHUDSettingsOpen(false);
      else if(b.dataset.hudCount){
        this.changeHUDSettings({count:this.hudPreferences.settings.count+Number(b.dataset.hudCount)});
      }
      else if(b.dataset.select){this.selected=b.dataset.select;this.townNavigation=b.dataset.town==='true';this.detailScroll=0;const detail=this.element.querySelector('.journey-detail');if(detail)detail.scrollTop=0;this.render();}
      else if(b.dataset.action==='acceptAll'){
        const rows=journalJourneys(this.state,this.origin(),this.scope);
        void command({type:'acceptAll',ids:rows.nearby.map(g=>g.id)});
      }else if(this.selected){
        if(b.dataset.action==='map')hooks.map(this.selected);
        else if(b.dataset.action==='accept'||b.dataset.action==='track'||b.dataset.action==='untrack'||b.dataset.action==='dismiss')void command({type:b.dataset.action,id:this.selected});
      }
    },{signal:this.abort.signal});
    this.element.addEventListener('change',event=>{
      const select=event.target as HTMLSelectElement;
      if(select.dataset.hudField==='visible'){this.changeHUDSettings({visible:(event.target as HTMLInputElement).checked});return;}
      if(select.dataset.hudField==='sort'){this.changeHUDSettings({sort:select.value as JourneyHUDSort});return;}
      if(select.dataset.area===undefined)return;
      this.scope=select.value;this.selected=null;this.townNavigation=false;this.listScroll=0;this.detailScroll=0;
      for(const surface of this.element.querySelectorAll('.journey-list,.journey-detail'))surface.scrollTop=0;
      this.render();
      this.element.querySelector<HTMLSelectElement>('[data-area]')?.focus({preventScroll:true});
    },{signal:this.abort.signal});
    this.element.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&this.hudSettingsOpen){event.preventDefault();event.stopPropagation();this.setHUDSettingsOpen(false);}
    },{signal:this.abort.signal});
    this.element.addEventListener('pointerdown',event=>{
      if(this.hudSettingsOpen&&!(event.target as HTMLElement).closest('[data-hud-popup],[data-action="hudSettings"]'))this.setHUDSettingsOpen(false);
    },{signal:this.abort.signal});
  }
  private setHUDSettingsOpen(open:boolean){
    this.hudSettingsOpen=open;
    this.refreshHUD();
    const popup=this.element.querySelector<HTMLElement>('[data-hud-popup]');if(popup)popup.hidden=!open;
    const trigger=this.element.querySelector<HTMLButtonElement>('[data-action="hudSettings"]');trigger?.setAttribute('aria-expanded',String(open));
    if(open){this.layoutHUDSettings();this.element.querySelector<HTMLInputElement>('[data-hud-field="visible"]')?.focus({preventScroll:true});}
    else trigger?.focus({preventScroll:true});
  }
  private changeHUDSettings(patch:Parameters<JourneyHUDPreferences['update']>[0]){
    const result=this.hudPreferences.update(patch);if(result==='invalid')return;
    this.hudSettingsMessage=result==='session'?'Storage unavailable. Settings apply for this session.':'';
    this.refreshHUD();
  }
  private refreshHUD(){
    if(!this.state||!this.facts)return;
    this.signature='';
    this.update(this.state,this.facts,this.hudView.playing,this.hudView.width,this.hudView.height,this.dungeon);
  }
  /** Settings preview owns visibility while gameplay remains paused. */
  setHUDVisibility(playing:boolean){
    this.hudView.playing=playing;
    const preview=this.hudPreviewActive,inline=preview&&this.hudView.width<850;
    const destination=inline?this.element.querySelector<HTMLElement>('[data-hud-preview]'):this.hudMount;
    if(destination&&this.mini.parentElement!==destination)destination.append(this.mini);
    this.mini.classList.toggle('is-settings-preview',preview);
    this.mini.classList.toggle('is-inline-preview',inline);
    this.mini.inert=preview;
    this.mini.hidden=!this.hudVisible||(!playing&&!preview);
    const anchor=getJourneyLogAnchor(this.hudView.width,this.hudView.height);
    this.element.style.paddingRight=preview&&!inline?`calc(${(this.hudView.width-anchor.x)/this.hudView.width*100}% + 20px)`:'';
    const slot=this.element.querySelector<HTMLElement>('[data-hud-preview]');if(slot)slot.hidden=!inline||!this.hudVisible;
  }
  private layoutHUDSettings(){
    if(!this.hudSettingsOpen)return;
    const popup=this.element.querySelector<HTMLElement>('[data-hud-popup]'),window=this.element.querySelector<HTMLElement>('.journey-window');
    if(popup&&window)popup.style.maxHeight=`${Math.max(64,window.getBoundingClientRect().bottom-popup.getBoundingClientRect().top-12)}px`;
  }
  /** Layout also changes while the journal pauses simulation-driven refreshes. */
  resize(width:number,height:number){
    this.hudView.width=width;this.hudView.height=height;
    const anchor=getJourneyLogAnchor(width,height);
    this.mini.style.right=`${(width-anchor.x-anchor.width)/width*100}%`;
    this.mini.style.top=`${anchor.y/height*100}%`;
    this.mini.style.width=`${anchor.width/width*100}%`;
    this.mini.style.maxHeight=`${Math.max(48,height-anchor.y-24)/height*100}%`;
    this.setHUDVisibility(this.hudView.playing);
    this.layoutHUDSettings();
  }
  resetSelection(){
    this.selected=null;this.scope='nearby';this.townNavigation=false;this.message='';this.signature='';this.hudSettingsOpen=false;
    this.listScroll=0;this.detailScroll=0;
    for(const surface of this.element.querySelectorAll('.journey-list,.journey-detail'))surface.scrollTop=0;
  }
  private origin(){return this.facts?.expeditions.runs.find(r=>r.entrance.id===this.facts?.expeditions.location)?.entrance??this.facts??{x:0,y:0};}
  update(state:JourneyState,facts:JourneyFacts,playing:boolean,width:number,height:number,dungeon:DungeonJourney|null=null){
    this.hudView={playing,width,height};
    this.dungeon=dungeon;
    this.state=state;this.facts=facts;
    const collapsed=state.collapsed&&!this.hudPreviewActive;
    this.mini.classList.toggle('is-collapsed',collapsed);
    const list=miniJourneys(state,this.hudPreferences.settings,this.origin());
    const header=`<header><button class="journey-mini-title" data-open>Journeys<kbd class="journey-mini-key">J</kbd></button><button data-collapse aria-label="${collapsed?'Expand':'Collapse'} journeys" aria-expanded="${!collapsed}">${uiIcon('chevron')}</button></header>`;
    const pinnedId=state.townPin?.id??state.tracked;
    const outdoorBody=collapsed?'':!list.length?'<p class="journey-mini-empty">Accept quests in the Journal &lt;J&gt; to track them.</p>':list.map(g=>{
      const pinned=g.id===pinnedId;
      const disabled=g.finishedAt!==undefined;
      const pinHint=pinned?'Unpin':'Pin destination';
      return `<div class="journey-mini-entry ${pinned?'is-pinned':''}"><button class="journey-mini-row ${pinned?'is-tracked':''}" data-goal="${e(g.id)}" data-tooltip="${e(g.name)} · ${e(g.kind==='town'?'Visit the town services':journeyObjective(g,facts))} · Level ${g.level}${g.level>facts.level+2?' · Harder':''}" data-tooltip-align="end" aria-label="${pinned?'Pinned':'Accepted'} · ${e(g.name)} · Level ${g.level} · ${journeyLevelFit(g.level,facts.level)}"><span class="journey-symbol">${g.finishedAt!==undefined?'✓':pinned?'◆':'◇'}</span><span><strong>${e(g.name)}</strong></span><span class="journey-mini-level" data-fit="${journeyLevelFit(g.level,facts.level)}"><span>Lv</span> ${g.level}</span></button><button class="journey-mini-pin" data-pin="${e(g.id)}" aria-label="${pinned?'Unpin':'Pin'} ${e(g.name)}" aria-pressed="${pinned}" data-tooltip="${pinHint}" data-tooltip-align="end" ${disabled?'disabled':''}>${uiIcon('pin')}</button></div>`;
    }).join('');
    const dungeonBody=!dungeon||collapsed?'':`<div class="journey-mini-section">${dungeon.stage?`Expedition · ${dungeon.stage} / 10`:'Dungeon'}</div><button class="journey-mini-row is-tracked is-dungeon" data-goal="${e(dungeon.id)}" data-tooltip="${e(dungeon.name)} · ${e(dungeon.objective)}" data-tooltip-align="end"><span class="journey-symbol">◆</span><span><strong>${e(dungeon.objective)}</strong></span><span class="journey-mini-level"><span>Lv</span> ${dungeon.level}</span></button>`;
    const html=header+(collapsed?'':`<div class="journey-mini-body">${dungeon?dungeonBody:outdoorBody}</div>`);
    if(html!==this.miniSignature){
      const focused=this.mini.contains(document.activeElement)?(document.activeElement as HTMLElement).dataset.pin:undefined;
      this.mini.innerHTML=html;this.miniSignature=html;
      if(focused)this.mini.querySelector<HTMLButtonElement>(`[data-pin="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
    }
    if(!this.element.hidden){const signature=JSON.stringify([dungeon?.id,dungeon?.phase,state,this.hudPreferences.settings,Math.round(facts.x/100),Math.round(facts.y/100),facts.level,facts.expeditions.location,list.map(g=>journeyObjective(g,facts))]);if(signature!==this.signature){this.signature=signature;this.render();}}
    this.resize(width,height);
  }
  bounds(width:number,height:number){
    if(this.mini.hidden)return null;
    const r=this.mini.getBoundingClientRect(),parent=this.mini.parentElement!.getBoundingClientRect();
    return {x:(r.left-parent.left)/parent.width*width,y:(r.top-parent.top)/parent.height*height,width:r.width/parent.width*width,height:r.height/parent.height*height};
  }
  open(id?:string){
    if(id&&id!==this.selected){
      this.selected=id;this.townNavigation=id===this.state?.townPin?.id||id===this.state?.nearestTown?.id;
      this.detailScroll=0;
    }
    if(this.state&&this.selected&&!this.townNavigation){
      const lists=journalJourneys(this.state,this.origin(),this.scope);
      if(![...lists.accepted,...lists.nearby,...lists.completed].some(g=>g.id===this.selected)){
        const goal=[...this.state.accepted,...this.state.offers,...this.state.history].find(g=>g.id===this.selected);
        if(goal)this.scope=goal.region;
      }
    }
    this.hudView.playing=false;this.element.hidden=false;this.render();this.focus=trapDialogFocus(this.element,{signal:this.abort.signal});
  }
  close(){
    this.hudSettingsOpen=false;
    this.setHUDVisibility(false);
    this.listScroll=this.element.querySelector('.journey-list')?.scrollTop??this.listScroll;
    this.detailScroll=this.element.querySelector('.journey-detail')?.scrollTop??this.detailScroll;
    this.focus?.dispose();this.focus=null;this.element.hidden=true;
  }
  private render(){
    const state=this.state,facts=this.facts;if(!state||!facts)return;
    const origin=this.origin(),lists=journalJourneys(state,origin,this.scope);
    const cities=[...new Map([state.nearestTown,state.townPin].filter((v):v is JourneyGoal=>!!v).map(g=>[g.id,g])).values()];
    const goals=[...lists.accepted,...lists.nearby,...lists.completed];
    const dungeon=this.dungeon;
    const dungeonGoal:JourneyGoal|undefined=dungeon?{id:dungeon.id,name:dungeon.name,kind:'dungeon',level:dungeon.level,x:origin.x,y:origin.y,region:facts.areaName??'Current expedition'}:undefined;
    const g=(this.selected===dungeon?.id?dungeonGoal:undefined)??(this.townNavigation?cities.find(g=>g.id===this.selected):goals.find(g=>g.id===this.selected))??(!this.selected?dungeonGoal:undefined)??goals[0]??cities[0];
    if(g?.id!==this.selected)this.townNavigation=!!g&&cities.includes(g);
    this.selected=g?.id??null;
    const focus=this.element.contains(document.activeElement)?(document.activeElement as HTMLElement).dataset:undefined;
    const scroll=this.element.querySelector('.journey-list');if(scroll&&!this.element.hidden)this.listScroll=scroll.scrollTop;
    const detailScroll=this.element.querySelector('.journey-detail');if(detailScroll&&!this.element.hidden)this.detailScroll=detailScroll.scrollTop;
    const pinned=state.townPin?.id??state.tracked,accepted=!!g&&state.accepted.some(v=>v.id===g.id);
    const currentDungeon=!!dungeon&&g?.id===dungeon.id;
    const done=g?.finishedAt!==undefined&&!this.townNavigation;
    const status=currentDungeon?'Current expedition':done?'Completed':this.townNavigation?'Town navigation':accepted?'Accepted':'Nearby';
    const regions=[...new Set([...state.accepted,...state.offers,...state.history].map(g=>g.region))].sort();
    const rows=(title:string,items:JourneyGoal[],town=false)=>`<section class="journey-group" data-group="${e(title)}"><h3><span>${title}</span><span class="journey-group-count">${items.length}</span></h3>${items.length?items.map(v=>{
      const finished=v.finishedAt!==undefined&&!town;
      const distance=formatWorldDistance(Math.hypot(v.x-origin.x,v.y-origin.y));
      return `<button class="journey-list-row ${v.id===g?.id&&town===this.townNavigation?'is-selected':''}" data-select="${e(v.id)}" data-town="${town}" aria-pressed="${v.id===g?.id&&town===this.townNavigation}"><span class="journey-list-symbol ${finished?'is-complete':v.id===pinned?'is-pinned':''}">${finished?uiIcon('check'):v.id===pinned?uiIcon('pin'):'◇'}</span><span class="journey-list-name"><strong>${e(v.name)}</strong><small>${finished?'Completed':distance}${!town&&v.id===pinned?' · Pinned':''}</small></span><span class="journey-list-level" data-fit="${journeyLevelFit(v.level,facts.level)}">Lv ${v.level}</span></button>`;
    }).join(''):`<p class="journey-empty">No ${title.toLowerCase()} activities in this area.</p>`}</section>`;
    const busy=this.commandPending?'disabled':'';
    const hud=this.hudPreferences.settings;
    const hudPopup=`<section class="journey-hud-settings ui-scroll-area" id="journey-hud-settings" data-hud-popup role="dialog" aria-modal="false" aria-labelledby="journey-hud-title" ${this.hudSettingsOpen?'':'hidden'}>
      <header><h3 id="journey-hud-title">HUD Settings</h3><button type="button" class="ui-button ui-button--quiet ui-button--icon" data-hud-close aria-label="Close HUD Settings">${uiIcon('close')}</button></header>
      <label class="journey-hud-visible"><span>Show quest HUD</span><input type="checkbox" data-hud-field="visible" ${hud.visible?'checked':''}></label>
      <fieldset ${hud.visible?'':'disabled'}><div class="journey-hud-count"><span id="journey-hud-count-label">Quests shown</span><div role="group" aria-labelledby="journey-hud-count-label"><button type="button" class="ui-button ui-button--icon" data-hud-count="-1" aria-label="Show fewer quests" ${hud.count<=JOURNEY_HUD_LIMIT.min?'disabled':''}>${uiIcon('minus')}</button><output aria-live="polite">${hud.count}</output><button type="button" class="ui-button ui-button--icon" data-hud-count="1" aria-label="Show more quests" ${hud.count>=JOURNEY_HUD_LIMIT.max?'disabled':''}>${uiIcon('plus')}</button></div></div>
      <label class="journey-hud-sort">Sort quests by<select data-hud-field="sort"><option value="accepted" ${hud.sort==='accepted'?'selected':''}>Acceptance order</option><option value="level" ${hud.sort==='level'?'selected':''}>Level · low to high</option><option value="distance" ${hud.sort==='distance'?'selected':''}>Distance · nearest first</option></select></label><p class="journey-action-hint">Pinned quest stays first.</p></fieldset>
      <p class="journey-command-status" role="status">${e(this.hudSettingsMessage)}</p><div class="journey-hud-inline-preview" data-hud-preview hidden></div></section>`;

    const known=!!g&&(this.townNavigation||done||facts.discovered(g.id));
    const objective=currentDungeon?dungeon!.objective:g?(this.townNavigation?settlementBenefits(g.settlementTier??'settlement'):journeyObjective(g,facts)):'';
    const total=goals.length;
    // The narrow layout hosts the actual HUD inside the popup. Preserve that node
    // (and its listeners) while replacing the surrounding journal markup.
    if(this.mini.parentElement!==this.hudMount)this.hudMount.append(this.mini);
    this.element.innerHTML=`<section class="ui-window journey-window" role="dialog" aria-modal="true" aria-labelledby="journey-title">
      <header class="ui-window-header"><span class="journey-heading-icon">${uiIcon('map')}</span><h2 class="ui-title" id="journey-title">Journeys</h2><button type="button" class="ui-button ui-button--icon" data-close aria-label="Close journeys">${uiIcon('close')}</button></header>
      <div class="journey-area-bar"><div><label class="journey-area-label" for="journey-area">Area</label><select id="journey-area" class="ui-select journey-area-select" data-area aria-label="Browse activities by area"><option value="nearby" ${this.scope==='nearby'?'selected':''}>Around you${facts.areaName?' · '+e(facts.areaName):''}</option><option value="all" ${this.scope==='all'?'selected':''}>All known areas</option>${regions.map(r=>`<option value="${e(r)}" ${r===this.scope?'selected':''}>${e(r)}</option>`).join('')}</select><div class="journey-area-count">${lists.completed.length} of ${total} known activities completed</div><div class="journey-area-progress" role="progressbar" aria-label="Known activities completed" aria-valuemin="0" aria-valuemax="${Math.max(1,total)}" aria-valuenow="${lists.completed.length}"><span style="width:${total?lists.completed.length/total*100:0}%"></span></div></div><div class="journey-toolbar-actions"><button type="button" class="ui-button" data-action="hudSettings" aria-controls="journey-hud-settings" aria-haspopup="dialog" aria-expanded="${this.hudSettingsOpen}">${uiIcon('options')}HUD Settings</button><button class="ui-button ui-button--primary" data-action="acceptAll" ${!lists.nearby.length||this.commandPending?'disabled':''}>Accept all nearby${lists.nearby.length?' · '+lists.nearby.length:''}</button>${hudPopup}</div></div>
      <div class="journey-columns"><nav class="journey-list ui-scroll-area" aria-label="Activities by status">${dungeonGoal?rows('Current expedition',[dungeonGoal]):''}${rows('Accepted',lists.accepted)}${rows('Nearby',lists.nearby)}${rows('Completed',lists.completed)}${cities.length?rows('Town navigation',cities,true):''}</nav>
      <article class="journey-detail ui-scroll-area">${g?`<div class="journey-detail-top"><span>${e(JOURNEY_CONTENT[g.kind].category)} · Level ${g.level}</span><span class="journey-status ${done?'is-complete':accepted?'is-accepted':''}">${done?'✓ ':''}${status}</span></div><h3>${e(g.name)}</h3><div class="journey-objective"><small>${done?'Completed':'Objective'}</small>${e(objective)}</div><dl><div><dt>Location</dt><dd>${e(g.region)}${known?'':' · Search area'}</dd></div><div><dt>Distance</dt><dd>${formatWorldDistance(Math.hypot(g.x-origin.x,g.y-origin.y))}</dd></div><div><dt>${done?'Rewards claimed':'Rewards'}</dt><dd>${e(JOURNEY_CONTENT[g.kind].reward)}${!this.townNavigation&&(!done||g.rewardXP!==undefined)?` · +${(done?g.rewardXP!:journeyXP(g.kind,g.level,facts.level)).toLocaleString()} XP`:''}</dd></div><div><dt>Level</dt><dd class="journey-detail-level" data-fit="${journeyLevelFit(g.level,facts.level)}">${g.level} (${journeyLevelFit(g.level,facts.level)})</dd></div></dl>
      <div class="journey-actions">${!done&&!this.townNavigation&&!currentDungeon?`<button class="ui-button ${accepted?'':'ui-button--primary'}" data-action="${accepted?'dismiss':'accept'}" ${busy}>${accepted?'Dismiss':'Accept'}</button>`:''}${!done&&!currentDungeon?`<button class="ui-button ${g.id===pinned?'journey-pin-active':''}" data-action="${g.id===pinned?'untrack':'track'}" aria-pressed="${g.id===pinned}" ${busy}>${uiIcon('pin')}${g.id===pinned?'Pinned':'Pin'}</button>`:''}<button class="ui-button" data-action="map" ${busy}>${uiIcon('map')}Show on Map</button></div><p class="journey-action-hint">${currentDungeon?'Complete this expedition to record it in your journal.':done?'Retained in your area completion history.':this.townNavigation?'Pin this town as your navigation destination.':accepted?'Dismiss returns this activity to Nearby. Pin only sets your destination.':'Accept adds this activity to your list. Pin only sets your destination.'}</p>`:'<p class="ui-muted">Explore to find activities in this area.</p>'}<p class="journey-command-status" role="status" aria-live="polite">${e(this.message)}</p></article></div>
      <footer class="ui-window-footer"><span>${lists.nearby.length} nearby · ${lists.accepted.length} accepted · ${lists.completed.length} completed</span></footer></section>`;
    this.element.querySelector('.journey-list')!.scrollTop=this.listScroll;
    this.element.querySelector('.journey-detail')!.scrollTop=this.detailScroll;
    this.setHUDVisibility(this.hudView.playing);
    this.layoutHUDSettings();
    if(focus?.hudField)this.element.querySelector<HTMLElement>(`[data-hud-field="${CSS.escape(focus.hudField)}"]`)?.focus({preventScroll:true});
    else if(focus?.hudCount){
      const button=this.element.querySelector<HTMLButtonElement>(`[data-hud-count="${CSS.escape(focus.hudCount)}"]`);
      (button?.disabled?this.element.querySelector<HTMLElement>(`[data-hud-count="${focus.hudCount==='1'?'-1':'1'}"]`):button)?.focus({preventScroll:true});
    }
    else if(focus?.select)this.element.querySelector<HTMLElement>(`[data-select="${CSS.escape(focus.select)}"][data-town="${focus.town??'false'}"]`)?.focus({preventScroll:true});
    else if(focus?.action){
      const action=focus.action==='accept'&&accepted?'dismiss':focus.action==='dismiss'&&!accepted?'accept':focus.action==='track'&&g?.id===pinned?'untrack':focus.action==='untrack'&&g?.id!==pinned?'track':focus.action;
      this.element.querySelector<HTMLElement>(`[data-action="${action}"]`)?.focus({preventScroll:true});
    }
  }
  dispose(){this.close();this.abort.abort();this.element.remove();this.mini.remove();}
}
