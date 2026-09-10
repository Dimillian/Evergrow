import type { Expeditions } from './dungeon-state.ts';
import type { DungeonAction } from './dungeon-command.ts';
import { newExpeditionRoute, expeditionChoices, EXPEDITION_MODIFIERS } from './expedition-route.ts';
import { dungeonTheme } from './dungeon-content.ts';
import { escapeUI, trapDialogFocus } from './ui-components.ts';
import { drawCryptGate } from './dungeon-art.ts';
import './expedition-panel.css';
export class ExpeditionPanel {
  readonly element:HTMLElement;
  private focus:{dispose():void}|null=null;
  private abort=new AbortController();
  private action:((choice:number)=>DungeonAction)|null=null;
  private busy=false;
  private actions:{close():void;enter(action:DungeonAction):Promise<boolean>};
  constructor(mount:HTMLElement,actions:ExpeditionPanel['actions']) {
    this.actions=actions;
    this.element=document.createElement('section');this.element.className='expedition-panel ui-window';this.element.hidden=true;
    this.element.setAttribute('role','dialog');this.element.setAttribute('aria-modal','true');this.element.setAttribute('aria-labelledby','expedition-title');mount.append(this.element);
    this.element.addEventListener('click',async e=>{
      const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button||this.busy)return;
      if(button.hasAttribute('data-close')){this.actions.close();return;}
      if(button.dataset.choice===undefined||!this.action)return;
      this.busy=true;this.element.querySelectorAll('button').forEach(b=>b.disabled=true);
      try{const ok=await this.actions.enter(this.action(Number(button.dataset.choice)));if(!ok){this.element.querySelector('[role=status]')!.textContent='Could not enter. Close and try again.';}}
      finally{this.busy=false;this.element.querySelectorAll<HTMLButtonElement>('button:not([data-locked])').forEach(b=>b.disabled=false);}
    },{signal:this.abort.signal});
  }
  open(state:Expeditions,level:number,worldSeed:number,tableId:string):void {
    const existing=state.route,route=existing?.status==='active'?existing:newExpeditionRoute(worldSeed,level,(existing?.attempt??0)+1);
    const choices=expeditionChoices(route),locked=level<20;
    const lastRun=state.runs.filter(r=>r.entrance.expedition?.attempt===existing?.attempt).at(-1);
    this.action=choice=>({...(choice===-1?{resume:lastRun?.entrance.id}:{}),kind:'expedition',tableId,choice,attempt:existing?.attempt??0,restart:existing?.status==='complete'});
    this.element.hidden=false;
    this.element.innerHTML=`<header class="ui-window-header"><h2 class="ui-title" id="expedition-title">Expeditions</h2><span class="expedition-progress">${route.cleared} / 10 cleared</span><button class="ui-button ui-button--icon" data-close aria-label="Close expeditions">×</button></header>
      <div class="expedition-body ui-scroll-area"><nav class="expedition-route" aria-label="Dungeon route">${Array.from({length:10},(_,i)=>`<div class="expedition-step ${i<route.cleared?'is-cleared':i===route.cleared?'is-current':''}" ${i===route.cleared?'aria-current="step"':''}><span>${i<route.cleared?'✓':i+1}</span><small>${i===9?'Grand chest':i<route.cleared?'Cleared':i===route.cleared?'Next':''}</small></div>`).join('')}</nav>
      <div class="expedition-section"><h3>${locked?'Unlocks at level 20':existing?.status==='failed'?'Begin a new attempt':existing?.status==='complete'?'Route complete · Venture again':route.choice!==null?'Continue your dungeon':choices.length===2?'Choose your next dungeon':'Your next dungeon'}</h3><span>${lastRun&&route.choice===null?'<button class="ui-button ui-button--quiet" data-choice="-1">Return to last dungeon</button>':''} Stage ${route.cleared+1} / 10</span></div>
      <div class="expedition-choices">${choices.map((entry,i)=>{
        const theme=dungeonTheme(entry.seed,entry.theme),modifier=EXPEDITION_MODIFIERS[entry.expedition!.modifier],unavailable=locked||route.choice!==null&&route.choice!==i;
        return `<article class="expedition-card ${unavailable?'is-unavailable':''}" style="--dungeon-accent:${theme.accent}"><div class="expedition-card-art"><canvas width="480" height="240" data-gate="${i}" aria-label="${theme.name} entrance"></canvas><span class="expedition-level">Lv ${entry.level} · Boss ${entry.level+3}</span></div><div class="expedition-card-body"><h4>${theme.name}</h4><p>${theme.description}</p><div class="expedition-modifier"><b>${modifier.name}</b><span>${modifier.description}</span></div><div class="expedition-boss"><span>Boss</span><strong>${theme.bossName??(theme.id==='foundry'?'Furnace Sovereign':theme.id==='drowned'?'The Drowned Matron':'Hollow Warden')}</strong></div><button class="ui-button ui-button--primary" data-choice="${i}" ${unavailable?'disabled data-locked':''}>${route.choice===i?'Resume dungeon':existing?.status==='complete'?'Start new route':'Enter dungeon'}</button></div></article>`;
      }).join('')}</div>
      <aside class="expedition-reward"><div class="expedition-chest-icon" aria-hidden="true">▱<span>✦</span></div><div><h3>Tenth dungeon · Grand chest</h3><p>6 rewards · 65% Epic · 20% Legendary · 15% Rare per roll</p></div></aside></div>
      <footer class="ui-window-footer"><span role="status">${escapeUI(existing?.status==='complete'?'Starting again leaves uncollected expedition loot behind.':'Death in an expedition resets this route. Keep your character and collected loot.')}</span><span class="ui-muted">Save and return anytime</span></footer>`;
    this.element.querySelectorAll<HTMLCanvasElement>('[data-gate]').forEach(canvas=>{const entry=choices[Number(canvas.dataset.gate)],c=canvas.getContext('2d')!;c.translate(240,198);c.scale(1.8,1.8);drawCryptGate(c,{...entry,x:0,y:0},0);});
    this.focus?.dispose();this.focus=trapDialogFocus(this.element,{initialFocus:this.element,restoreFocus:false});
  }
  close(){this.focus?.dispose();this.focus=null;this.element.hidden=true;this.action=null;}
  dispose(){this.close();this.abort.abort();this.element.remove();}
}
