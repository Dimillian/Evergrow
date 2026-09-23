import type { Player } from '../model.ts';
import type { TownNPC } from '../npcs.ts';
import type { ServicePanel } from '../service-panel.ts';
import { generateItem, deriveItem } from '../items.ts';
import { refreshCharacter } from '../character.ts';
import { ENHANCEMENT_CHARGE_MS } from '../enhancement-feedback.ts';
import './enhancement-study.css';

/** Drives only the disposable service review and the runtime panel's actual animations. */
export class EnhancementStudy {
  private readonly panel: ServicePanel;
  private readonly player: Player;
  private readonly npc: TownNPC;
  private readonly baseline: Player['character'];
  private readonly toolbar = document.createElement('aside');
  private readonly life = new AbortController();
  private readonly observer: MutationObserver;
  private readonly resize: ResizeObserver;
  private paused = false;
  private chargeMs = ENHANCEMENT_CHARGE_MS;
  private frame = 0;
  private last = 0;
  private readonly sample: HTMLSelectElement;
  private readonly state: HTMLSelectElement;
  private readonly rank: HTMLInputElement;
  private readonly speed: HTMLSelectElement;
  private readonly soundToggle: HTMLInputElement;
  private readonly scrub: HTMLInputElement;
  private readonly replay: HTMLButtonElement;
  private readonly pause: HTMLButtonElement;
  private readonly status: HTMLOutputElement;

  constructor(panel: ServicePanel, player: Player, npc: TownNPC, params: URLSearchParams) {
    if (!import.meta.env.DEV) throw new Error('Local study only');
    this.panel=panel; this.player=player; this.npc=npc; this.baseline=structuredClone(player.character);
    document.documentElement.classList.add('enhancement-study');
    document.title='Evergrow · Enhancement workbench';
    this.toolbar.className='enhancement-study-controls'; this.toolbar.setAttribute('aria-label','Enhancement preview controls');
    this.toolbar.innerHTML=`<div><strong>Enhancement workbench</strong><span>Disposable preview</span>
      <label>Item <select data-study-sample><option value="weapon">Longsword</option><option value="shield">Shield</option><option value="armor">Armor</option><option value="charm">Charm</option></select></label>
      <label>Rank <input data-study-rank type="number" min="0" max="10" value="4"></label>
      <label>State <select data-study-state><option value="ready">Ready</option><option value="empty">No selection</option><option value="poor">Not enough gold</option><option value="max">Fully enhanced</option><option value="error">Save error</option></select></label>
      <button type="button" data-study-reset>Reset</button></div>
      <div><button type="button" data-study-replay>Replay enhance</button><button type="button" data-study-glow>Replay glow</button><button type="button" data-study-pause disabled>Pause</button>
      <label>Speed <select data-study-speed><option value="1">1×</option><option value="0.5">½×</option><option value="0.25">¼×</option></select></label>
      <label class="enhancement-study-scrub">Charge <input data-study-scrub type="range" min="0" max="100" value="0" step="1"></label>
      <label><input data-study-sound type="checkbox"> Sound</label><output data-study-status aria-live="off">Ready</output></div>`;
    const find=<T extends HTMLElement>(name:string)=>this.toolbar.querySelector<T>(`[data-study-${name}]`)!;
    this.sample=find('sample'); this.state=find('state'); this.rank=find('rank'); this.speed=find('speed');
    this.soundToggle=find('sound'); this.scrub=find('scrub'); this.replay=find('replay'); this.pause=find('pause'); this.status=find('status');
    for (const [select,key] of [[this.sample,'sample'],[this.state,'state'],[this.speed,'speed']] as const) {
      const value=params.get(key); if (value && [...select.options].some(option=>option.value===value)) select.value=value;
    }
    this.rank.value=String(this.boundedRank(params.get('rank')??'4')); this.soundToggle.checked=params.has('sound');
    const options={signal:this.life.signal};
    for (const input of [this.sample,this.state,this.rank]) input.addEventListener('change',()=>{
      this.reset(); this.saveRoute(); input.focus({preventScroll:true});
    },options);
    find('reset').addEventListener('click',()=>this.reset(),options);
    this.replay.addEventListener('click',()=>this.play(),options);
    find('glow').addEventListener('click',()=>{
      this.paused=false;
      for (const animation of this.glowAnimations()) animation.currentTime=0;
      this.applyPlayback();
    },options);
    this.pause.addEventListener('click',()=>{ this.paused=!this.paused; this.applyPlayback(); },options);
    this.speed.addEventListener('change',()=>{ this.applyPlayback(); this.saveRoute(); },options);
    this.soundToggle.addEventListener('change',()=>this.saveRoute(),options);
    panel.element.addEventListener('change',()=>this.sync(),options);
    this.scrub.addEventListener('input',()=>{
      const progress=Number(this.scrub.value);
      if (this.panel.element.dataset.forgeState!=='charging') this.play(true);
      if (this.panel.element.dataset.forgeState!=='charging') return;
      this.paused=true;
      // Hold the final charge frame; resuming crosses the real commitment boundary.
      const time=Math.min(this.chargeMs-1,progress/100*this.chargeMs);
      for (const animation of this.animations()) { animation.pause(); animation.currentTime=time; }
      this.applyPlayback(); this.scrub.focus({preventScroll:true});
    },options);
    document.addEventListener('visibilitychange',()=>this.applyPlayback(),options);
    this.observer=new MutationObserver(()=>{ this.attach(); this.applyPlayback(); });
    this.observer.observe(panel.element,{childList:true,attributes:true,attributeFilter:['data-forge-state','hidden']});
    this.resize=new ResizeObserver(()=>document.documentElement.style.setProperty('--enhancement-study-top',`${this.toolbar.getBoundingClientRect().height+12}px`));
    this.resize.observe(this.toolbar);
    this.reset();
  }
  get sound(): boolean { return this.soundToggle.checked; }
  get rejectSave(): boolean { return this.state.value==='error'; }
  private boundedRank(value:string): number { const rank=Number(value); return Number.isFinite(rank)?Math.max(0,Math.min(10,Math.round(rank))):4; }
  private attach(): void {
    // Inside the dialog for its normal keyboard focus trap, visually above the preview.
    const mount=this.panel.element.hidden?document.body:this.panel.element;
    if (this.toolbar.parentElement!==mount) mount.prepend(this.toolbar);
  }
  private reset(): void {
    this.paused=false; cancelAnimationFrame(this.frame); this.frame=0;
    this.panel.close(); this.player.character=structuredClone(this.baseline);
    this.rank.value=String(this.boundedRank(this.rank.value));
    const sample=this.sample.value;
    const item=generateItem(62147,12,sample==='armor'?'chest':sample==='charm'?'charm':sample==='shield'?'shield':'weapon',
      sample==='weapon'?'longsword':sample==='charm'?'jade-monolith':undefined,'epic');
    item.recipe.enhancement=this.state.value==='max'?10:Number(this.rank.value);
    this.player.character.inventory[0]=deriveItem(item);
    this.player.character.gold=this.state.value==='poor'?0:2_000_000;
    refreshCharacter(this.player);
    this.panel.open(this.player,this.npc);
    if (this.state.value==='empty') this.panel.element.querySelector<HTMLButtonElement>('[data-tab="improve"]')!.click();
    else this.panel.inspect({bag:0},'enhance');
    this.attach(); this.scrub.value='0'; this.sync();
  }
  private play(paused=false): void {
    this.reset(); this.paused=paused;
    const button=this.panel.element.querySelector<HTMLButtonElement>('[data-confirm]');
    if (!button || button.disabled) return;
    button.click(); this.applyPlayback();
  }
  private animations(): Animation[] { return this.panel.element.getAnimations({subtree:true}); }
  private glowAnimations(): Animation[] {
    return (this.panel.element.querySelector('.service-detail')?.getAnimations({subtree:true})??[])
      .filter(a=>a instanceof CSSAnimation&&a.animationName.startsWith('temper-'));
  }
  private transientAnimationRunning(): boolean {
    return this.animations().some(a=>a.effect?.getTiming().iterations!==Infinity&&(a.playState==='running'||a.pending));
  }
  private applyPlayback(): void {
    for (const animation of this.animations()) {
      if (animation.playbackRate!==Number(this.speed.value)) animation.updatePlaybackRate(Number(this.speed.value));
      if (animation.playState==='finished' || animation.playState==='idle') continue;
      if (this.paused || document.hidden) animation.pause();
      else if (animation.playState==='paused') animation.play();
    }
    this.sync();
    cancelAnimationFrame(this.frame); this.frame=0;
    if (!document.hidden && !this.paused && this.transientAnimationRunning()) this.frame=requestAnimationFrame(time=>this.tick(time));
  }
  private tick(time:number): void {
    if (time-this.last>70) { this.sync(); this.last=time; }
    if (!document.hidden && !this.paused && this.transientAnimationRunning()) this.frame=requestAnimationFrame(now=>this.tick(now));
    else { this.frame=0; this.sync(); }
  }
  private sync(): void {
    const phase=this.panel.element.dataset.forgeState;
    const charge=this.panel.element.querySelector('.forge-channel > span')?.getAnimations()[0];
    const duration=charge?.effect?.getTiming().duration;
    if (typeof duration==='number') this.chargeMs=duration;
    const elapsed=typeof charge?.currentTime==='number'?charge.currentTime:0;
    if (phase==='charging') this.scrub.value=String(Math.round(elapsed/this.chargeMs*100));
    else if (phase==='success'||phase==='error') this.scrub.value='100';
    const ready=['ready','error'].includes(this.state.value);
    this.replay.disabled=!ready||Number(this.rank.value)===10;
    this.scrub.disabled=this.replay.disabled||phase==='saving'||matchMedia('(prefers-reduced-motion: reduce)').matches
      ||Boolean(this.panel.element.querySelector<HTMLInputElement>('[data-skip-enhancement]')?.checked);
    this.rank.disabled=this.state.value==='max';
    this.toolbar.querySelector<HTMLButtonElement>('[data-study-glow]')!.disabled=phase==='charging'||phase==='saving'||!this.glowAnimations().length;
    this.pause.disabled=!this.animations().some(a=>a.playState==='running'||a.playState==='paused'||a.pending);
    this.pause.textContent=this.paused?'Resume':'Pause';
    this.status.value=this.panel.element.hidden?'Closed · Reset to reopen':phase==='charging'?`${this.paused?'Paused':'Charging'} · ${Math.round(elapsed/this.chargeMs*100)}%`:phase==='success'?'Enhanced':phase==='error'?'Save error':phase==='saving'?'Finishing':matchMedia('(prefers-reduced-motion: reduce)').matches?'Reduced motion':'Ready';
  }
  private saveRoute(): void {
    const url=new URL(location.href);
    for (const [key,value] of [['sample',this.sample.value],['state',this.state.value],['rank',this.rank.value],['speed',this.speed.value]]) url.searchParams.set(key,value);
    if (this.sound) url.searchParams.set('sound',''); else url.searchParams.delete('sound');
    history.replaceState(null,'',url);
    if (parent!==window) parent.postMessage({type:'evergrow:tool-route',path:url.pathname+url.search},location.origin);
  }
  dispose(): void {
    this.life.abort(); this.observer.disconnect(); this.resize.disconnect(); cancelAnimationFrame(this.frame);
    this.toolbar.remove(); document.documentElement.classList.remove('enhancement-study'); document.documentElement.style.removeProperty('--enhancement-study-top');
  }
}
