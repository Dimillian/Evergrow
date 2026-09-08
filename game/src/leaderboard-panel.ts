import type { LeaderboardEntry, LeaderboardOrder, LeaderboardSnapshot } from './leaderboard.ts';
import { escapeUI as esc } from './ui-components.ts';
import { GamepadMenu } from './gamepad-menu.ts';
import { PAD, type GamepadInput } from './gamepad-input.ts';
import './leaderboard-panel.css';
export type LeaderboardLoader=(order:LeaderboardOrder)=>Promise<LeaderboardSnapshot>;
const num=(n:number)=>Math.round(n).toLocaleString();
const empty:LeaderboardSnapshot={entries:[],own:[],signedIn:false,total:0};
/** Read-only cloud rankings. Every saved cloud character is eligible. Never flushes saves. */
export class LeaderboardPanel {
  readonly element=document.createElement('section');
  private order:LeaderboardOrder='level';private value:LeaderboardSnapshot|null=null;
  private cache=new Map<LeaderboardOrder,{at:number;value:LeaderboardSnapshot}>();
  private revision=0;private busy=false;private error='';private controller=new GamepadMenu();private lastTime=0;
  private life=new AbortController();private load:LeaderboardLoader;private onClose:()=>void;
  private refreshTimer:ReturnType<typeof setTimeout>|undefined;
  constructor(mount:HTMLElement,load:LeaderboardLoader,onClose:()=>void){
    this.load=load;this.onClose=onClose;this.element.className='leaderboard-panel';this.element.hidden=true;this.element.setAttribute('aria-label','Leaderboard');mount.append(this.element);
    this.element.addEventListener('click',e=>{
      const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button)return;
      if(button.dataset.rankOrder){this.order=button.dataset.rankOrder as LeaderboardOrder;void this.refresh();}
      if(!this.busy&&button.hasAttribute('data-rank-retry'))void this.refresh();
    },{signal:this.life.signal});
    this.element.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();this.onClose();}
      if((e.target as HTMLElement).hasAttribute('data-rank-scroll')&&['ArrowDown','ArrowUp'].includes(e.key)){
        e.preventDefault();(e.target as HTMLElement).scrollTop+=e.key==='ArrowDown'?64:-64;
      }
    },{signal:this.life.signal});
  }
  get opened(){return !this.element.hidden;}
  open(){this.element.hidden=false;this.controller.clear();void this.refresh();}
  close(){this.revision++;clearTimeout(this.refreshTimer);this.element.hidden=true;this.controller.clear();}
  private async refresh(){
    clearTimeout(this.refreshTimer);
    const ticket=++this.revision;
    const cached=this.cache.get(this.order);this.value=cached?.value??null;this.error='';
    if(cached&&!cached.value.updating&&Date.now()-cached.at<30000){this.busy=false;this.render();return;}
    this.busy=true;this.render();
    try {const value=await this.load(this.order);if(ticket!==this.revision)return;this.value=value;this.cache.set(this.order,{at:Date.now(),value});}
    catch(error){if(ticket!==this.revision)return;this.error=error instanceof Error?error.message:'Leaderboard unavailable.';}
    finally {if(ticket===this.revision){this.busy=false;this.render();
      if(this.value?.updating&&!this.error&&this.opened)this.refreshTimer=setTimeout(()=>{void this.refresh();},2000);
    }}
  }
  private row(entry:LeaderboardEntry,pinned=false){return `<div class="rank-row${entry.mine?' is-mine':''}${pinned?' is-pinned':''}" role="row">
    <span class="rank-place${entry.rank<=3?' is-medal':''}" role="cell">${num(entry.rank)}</span>
    <span class="rank-name" role="cell"><strong>${esc(entry.name)}</strong>${entry.mine?'<small>You</small>':''}</span>
    <span class="rank-level" role="cell">${num(entry.level)}</span><span class="rank-power" role="cell">${entry.gearPower===null?'—':num(entry.gearPower)}</span></div>`;}
  private render(){
    const v=this.value??empty,active=document.activeElement as HTMLElement|null;
    const focusKey=active?.closest('[data-rank-order]')?.getAttribute('data-rank-order');
    const scroll=this.element.querySelector('[data-rank-scroll]')?.scrollTop??0;
    this.element.setAttribute('aria-busy',String(this.busy));
    this.element.innerHTML=`<header class="rank-heading"><h2>Leaderboard</h2><div class="rank-total"><strong>${num(v.total)}</strong><span>characters</span></div></header>
      <div class="rank-toolbar"><div class="rank-switch" role="group" aria-label="Rank by"><button data-rank-order="level" aria-pressed="${this.order==='level'}">Level</button><button data-rank-order="gear" aria-pressed="${this.order==='gear'}">Gear power</button></div><span class="rank-score-help" title="Average equipped item power across eleven slots. Two-handed weapons count for both hands.">Equipped gear only</span></div>
      <div class="rank-table" role="table" aria-label="${this.order==='level'?'Level':'Gear power'} rankings"><div class="rank-columns" role="row"><span role="columnheader">Rank</span><span role="columnheader">Character</span><span role="columnheader">Level</span><span role="columnheader">Gear power</span></div>
      <div class="rank-scroll ui-scroll-area" data-rank-scroll tabindex="0" role="rowgroup" aria-label="Rankings">${v.entries.length?v.entries.map(r=>this.row(r)).join(''):`<div class="rank-empty" role="status"><span class="rank-empty-star">✧</span><h3>${this.busy?'Gathering champions…':this.error?'The trail is quiet':'An unwritten legend'}</h3><p>${this.busy?'':this.error?esc(this.error):'Be the first to leave your mark.'}</p>${this.error?'<button class="ui-button" data-rank-retry>Try again</button>':''}</div>`}</div></div>
      ${v.own.some(r=>r.rank>100)?`<div class="rank-own" aria-label="Your characters outside the top 100">${v.own.filter(r=>r.rank>100).map(r=>this.row(r,true)).join('')}</div>`:''}
      <footer class="rank-footer">${this.error&&v.entries.length?`<span class="rank-error" role="status">${esc(this.error)}</span>`:''}<span>Top 100</span></footer>`;
    this.element.querySelector('[data-rank-scroll]')!.scrollTop=scroll;
    if(focusKey)this.element.querySelector<HTMLElement>(`[data-rank-order="${focusKey}"]`)?.focus({preventScroll:true});
  }
  updateGamepad(pad:GamepadInput,now:number){if(!this.opened)return false;
    if(pad.pressed.has(PAD.dodge)||pad.pressed.has(PAD.pause))this.onClose();
    else {this.controller.update(this.element,pad,now);const dt=this.lastTime?Math.min(.05,(now-this.lastTime)/1000):0;
      if(Math.abs(pad.aim.y)>.2)this.element.querySelector('[data-rank-scroll]')!.scrollTop+=pad.aim.y*dt*650;}
    this.lastTime=now;return true;
  }
  dispose(){this.close();this.life.abort();this.element.remove();}
}
