import type { Player } from './model.ts';
import type { Expeditions } from './dungeon-state.ts';
import type { DungeonAction } from './dungeon-command.ts';
import { RIFT_RULES, riftModifiers, freshRiftLedger } from './rift-content.ts';
import { drawRiftPortal } from './rift-art.ts';
import { ItemTooltip } from './item-tooltip.ts';
import { TIER_COLORS, TIER_NAMES } from './items.ts';
import { itemPackIconSVG } from './item-art.ts';
import { escapeUI, trapDialogFocus } from './ui-components.ts';
import './rift-panel.css';
export const riftTime=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
export class RiftPanel {
  readonly element=document.createElement('section');
  private tooltip:ItemTooltip;
  private focus:ReturnType<typeof trapDialogFocus>|null=null;
  private animation=0;private offset=0;private selected='';private busy=false;
  private player?:Player;private state?:Expeditions;private portalId='';
  private actions:{close():void;enter(action:DungeonAction):Promise<boolean>};
  constructor(mount:HTMLElement,actions:RiftPanel['actions']){
    this.actions=actions;this.tooltip=new ItemTooltip(mount,'rift-key-tooltip');
    this.element.className='rift-panel ui-window';this.element.hidden=true;this.element.setAttribute('role','dialog');this.element.setAttribute('aria-modal','true');this.element.setAttribute('aria-label','Crimson Rift');mount.append(this.element);
    this.element.addEventListener('pointerover',e=>this.hover(e.target));
    this.element.addEventListener('focusin',e=>this.hover(e.target));
    this.element.addEventListener('pointerout',e=>{const cell=e.target instanceof Element?e.target.closest('[data-key]'):null;if(cell&&(!(e.relatedTarget instanceof Node)||!cell.contains(e.relatedTarget)))this.tooltip.hide();});
    this.element.addEventListener('focusout',()=>this.tooltip.hide());
    this.element.addEventListener('scroll',()=>this.tooltip.hide(),true);
    this.element.addEventListener('input',e=>{if((e.target as HTMLElement).matches('[data-level]')){this.offset=Number((e.target as HTMLInputElement).value);this.update();}});
    this.element.addEventListener('click',async e=>{
      const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b||this.busy)return;
      if(b.hasAttribute('data-close'))return this.actions.close();
      if(b.dataset.key!==undefined){this.selected=b.dataset.key;this.render();this.element.querySelector<HTMLButtonElement>(`[data-key="${CSS.escape(this.selected)}"]`)?.focus();return;}
      if(!b.hasAttribute('data-enter')||!this.player)return;
      this.busy=true;b.disabled=true;
      try {if(await this.actions.enter({kind:'rift',portalId:this.portalId,offset:this.offset,keyId:this.selected||undefined,attempt:this.state?.rifts?.attempts??0}))return;this.element.querySelector('[role=status]')!.textContent='Could not open the rift. Check your key and approach the portal.';}
      finally{this.busy=false;this.update();}
    });
  }
  open(state:Expeditions,player:Player,portalId:string){this.state=state;this.player=player;this.portalId=portalId;this.offset=0;this.selected='';this.element.hidden=false;this.render();this.focus?.dispose();this.focus=trapDialogFocus(this.element);this.animate();}
  private hover(target:EventTarget|null){
    const cell=target instanceof Element?target.closest<HTMLElement>('[data-key]'):null;
    const item=this.player?.character.inventory.find(i=>i?.id===cell?.dataset.key);
    if(!cell||!item||!this.player)return;
    this.tooltip.show(item,{sheet:this.player.character,level:this.player.level,compare:false},cell);
  }
  private render(){
    this.tooltip.hide();
    const ledger=this.state?.rifts??freshRiftLedger(),keys=this.player?.character.inventory.filter(i=>i?.kind==='riftKey'&&!i.locked)??[];
    this.element.innerHTML=`<header class="ui-window-header"><div><small>THE VEIL IS THIN</small><h2>Crimson Rift</h2></div><button class="ui-button" data-close aria-label="Close">×</button></header><div class="rift-body"><div class="rift-hero"><canvas aria-hidden="true" width="560" height="420"></canvas><div class="rift-records"><span><strong>${ledger.clears}</strong>Clears</span><span><strong>${ledger.highest||'—'}</strong>Highest level</span><span><strong data-best>—</strong>Best at this level</span></div><p>Ten minutes. A sea of monsters. One guardian.</p></div><div class="rift-setup"><div class="rift-level"><span>Rift level</span><strong data-level-label></strong></div><input data-level aria-label="Rift level offset" type="range" min="-10" max="10" step="1" value="${this.offset}"><div class="rift-range"><span>−10</span><span>Your level</span><span>+10</span></div><h3>Your rift keys <small>From your inventory · optional, single use</small></h3><div class="rift-keys"><button class="rift-key ${!this.selected?'selected':''}" data-key="" aria-pressed="${!this.selected}"><span>◇</span><small>No key</small></button>${keys.map(k=>`<button class="rift-key ${this.selected===k!.id?'selected':''}" data-key="${escapeUI(k!.id)}" data-tier="${k!.tier}" style="--key-color:${TIER_COLORS[k!.tier]}" aria-label="${TIER_NAMES[k!.tier]} ${escapeUI(k!.name)}" aria-pressed="${this.selected===k!.id}">${itemPackIconSVG(k!,1,2)}<small aria-hidden="true">${TIER_NAMES[k!.tier]}</small></button>`).join('')}</div><div data-modifiers class="rift-modifiers"></div><div class="rift-reward"><span>Final chest</span><strong>Equipment · Gold · Guaranteed key</strong><small>Monster kills grant XP. All loot waits at the end.</small></div></div></div><footer class="ui-window-footer"><p role="status">Death or timeout ends the run. Pausing stops the clock.</p><button class="ui-button ui-primary" data-enter>Enter rift <span>→</span></button></footer>`;this.update();
  }
  private update(){if(!this.player)return;const level=Math.max(1,Math.min(1e6,this.player.level+this.offset)),key=this.player.character.inventory.find(i=>i?.id===this.selected);
    this.element.querySelector('[data-level-label]')!.textContent=String(level);
    const best=this.state?.rifts?.best.find(b=>b.level===level&&b.keyTier===(key?.recipe.riftKeyTier??0));this.element.querySelector('[data-best]')!.textContent=best?riftTime(best.seconds):'—';
    const modifiers=riftModifiers({attempt:1,...(key?{keySeed:key.seed,keyTier:key.recipe.riftKeyTier}:{})});
    this.element.querySelector('[data-modifiers]')!.innerHTML=modifiers.length?modifiers.map(m=>`<div class="${m.beneficial?'boon':'hazard'}"><span>${m.beneficial?'✧':'◆'} ${m.label}</span><strong>+${m.value}${m.unit}</strong></div>`).join(''):'<p>An unkeyed rift. Unchanged monsters and rewards.</p>';
    const enter=this.element.querySelector<HTMLButtonElement>('[data-enter]')!;enter.disabled=this.busy||this.player.level<RIFT_RULES.minimumLevel;enter.textContent=this.player.level<20?'Unlocks at level 20':this.busy?'Opening…':'Enter rift →';
  }
  private animate=()=>{cancelAnimationFrame(this.animation);if(this.element.hidden)return;const canvas=this.element.querySelector('canvas')!,c=canvas.getContext('2d')!;c.clearRect(0,0,560,420);drawRiftPortal(c,280,320,matchMedia('(prefers-reduced-motion: reduce)').matches?0:performance.now()/1000,2.1);this.animation=requestAnimationFrame(this.animate);};
  close(){this.tooltip.hide();this.element.hidden=true;cancelAnimationFrame(this.animation);this.focus?.dispose();this.focus=null;}
  dispose(){this.close();this.tooltip.dispose();this.element.remove();}
}
