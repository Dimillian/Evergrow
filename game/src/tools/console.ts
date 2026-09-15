import '../ui-kit.css';
import '../typography.css';
import './console.css';
import { installUITheme } from '../ui-theme.ts';
import { loadGameFont } from '../font.ts';
import { escapeUI } from '../ui-components.ts';
import { World } from '../world.ts';
import { Simulation } from '../simulation.ts';
import { Renderer } from '../renderer.ts';
import { PostFX } from '../postfx.ts';
import { ENEMY_DEFINITIONS } from '../combat-content.ts';
import { ITEM_MATERIALS, itemMaterialPool } from '../item-materials.ts';
import { WEAPON_PROFILES } from '../weapon-content.ts';

// A disposable visual study: no Game, session, repository, simulation updates or commands.
const root = document.querySelector<HTMLElement>('#console-study')!;
const abort = new AbortController();
let disposed = false;
let teardown = () => {};
interface Suggestion { label: string; detail: string; value: string; mark: string; }
const commands: Suggestion[] = [
  {label:'drop', detail:'Place a rolled item at your feet', value:'drop ', mark:'◇'},
  {label:'spawn', detail:'Summon a creature nearby', value:'spawn ', mark:'♧'},
  {label:'help', detail:'Browse commands and their arguments', value:'help', mark:'?'},
];
function suggestions(value: string): Suggestion[] {
  const q = value.toLowerCase();
  if (!q.includes(' ')) return commands.filter(s => s.label.startsWith(q));
  const [command, kind] = q.split(/\s+/);
  if (command === 'drop' && !q.trimEnd().slice(5).includes(' ') && !q.endsWith(' --')) {
    const kinds = ['helmet', 'weapon', 'chest', 'gloves', 'boots', 'ring', 'amulet'];
    const options = kinds.filter(k=>k.startsWith(kind)).map(k=>({label:k,detail:k==='helmet'?'Head armor · material and affixes rolled':'Generated equipment · random properties',value:`drop ${k} `,mark:'◇'}));
    if (!kind || !q.endsWith(' ')) return options;
  }
  if (command === 'spawn' && (!kind || !q.slice(6).includes(' '))) {
    return Object.entries(ENEMY_DEFINITIONS).filter(([id])=>id.toLowerCase().startsWith(kind??''))
      .map(([id, definition])=>({label:id, detail:definition.name, value:`spawn ${id} `, mark:'♧'})).slice(0,5);
  }
  if (!['drop','spawn'].includes(command)) return [];
  const match = /--(material|profile|rarity|rank|level|count)\s+([^\s]*)$/.exec(q);
  if (match) {
    const prefix=value.slice(0,value.length-match[2].length);
    const options = match[1]==='material' ? itemMaterialPool(kind==='helmet'?'head':'weapon').map(m=>({id:m.id,detail:ITEM_MATERIALS[m.id].name}))
      : match[1]==='profile' ? WEAPON_PROFILES.map(p=>({id:p.id,detail:p.name}))
      : (match[1]==='rarity'?['common','magic','rare','epic','legendary']:match[1]==='rank'?['normal','veteran','elite']:match[1]==='count'?['1','3','5']:['1','10','25','50','100']).map(id=>({id,detail:match[1]==='level'?'Item or monster level':match[1]==='count'?'Number to create':'Choose this quality'}));
    return options.filter(o=>o.id.startsWith(match[2])).slice(0,5).map(o=>({label:o.id,detail:o.detail,value:prefix+o.id+' ',mark:'›'}));
  }
  const flags = command==='drop' ? [
    ['--level','Set the item level','25'], ['--material','Choose its base material',''],
    ['--rarity','Choose quality; keep affixes random',''], ...(kind==='weapon'?[['--profile','Choose a weapon type','']]:[]),
  ] : [['--level','Set the monster level','20'],['--rank','Normal, veteran or elite',''],['--count','Summon a group','3']];
  const partial=/\s(--[^\s]*)$/.exec(q)?.[1]??'';
  const prefix=partial?value.slice(0,-partial.length):value.trimEnd()+' ';
  return flags.filter(([flag])=>!q.includes(flag+' ')&&flag.startsWith(partial)).map(([label,detail,example])=>({label,detail,value:prefix+label+' '+(example?example+' ':''),mark:'+'}));
}
async function boot() {
  if (!import.meta.env.DEV) throw new Error('Local development proposal only.');
  installUITheme(); await loadGameFont(); if(disposed)return;
  root.innerHTML = `<canvas class="scene" aria-label="Frozen Evergrow landscape"></canvas><div class="veil"></div>
    <header class="study-heading"><span>EVERGROW <i>/</i> INTERFACE STUDY</span><span>01 <i>—</i> COMMAND CONSOLE</span></header>
    <div class="scene-caption"><span>THE WORLD IS PAUSED</span><small>A quiet moment to change the rules.</small></div>
    <div class="console-anchor"><section class="console ui-window" role="dialog" aria-label="Local command console">
      <header class="console-heading"><span class="console-title"><span class="sigil">⌘</span> Command</span><span class="local"><i></i> LOCAL ONLY</span></header>
      <div class="entry-well"><span class="prompt" aria-hidden="true">&gt;</span><input id="command" type="text" role="combobox" aria-label="Command" aria-autocomplete="list" aria-controls="suggestions" aria-expanded="true" autocomplete="off" spellcheck="false" placeholder="Enter a command…" maxlength="200"><button class="close" aria-label="Close console">ESC</button></div>
      <div class="suggestions-heading"><span id="suggestion-label">SUGGESTED COMMANDS</span><span id="match-count"></span></div>
      <div id="suggestions" role="listbox" aria-label="Command suggestions"></div>
      <p class="result" role="status" hidden></p>
      <footer class="console-footer"><span><kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>Tab</kbd> complete</span><span><kbd>↵</kbd> submit</span></footer>
    </section><button class="reopen ui-button" hidden>Open command console <kbd>⌘ K</kbd></button></div>
    <aside class="study-controls" aria-label="Proposal states"><span>TRY A STATE</span><button data-state="">Discover</button><button data-state="drop helmet ">Item drop</button><button data-state="spawn ">Monster</button><button data-state="drop helmet --material ">Arguments</button></aside>
    <p class="study-note">Interactive visual proposal · commands are demonstrations · no saves or gameplay</p>`;
  const input=root.querySelector<HTMLInputElement>('input')!, list=root.querySelector<HTMLElement>('#suggestions')!;
  const panel=root.querySelector<HTMLElement>('.console')!, reopen=root.querySelector<HTMLButtonElement>('.reopen')!;
  const result=root.querySelector<HTMLElement>('.result')!;
  let active=0, options:Suggestion[]=[], history:string[]=[], historyIndex=0;
  function render() {
    options=suggestions(input.value);active=Math.min(active,Math.max(0,options.length-1));
    input.setAttribute('aria-expanded',String(options.length>0));
    if(options.length)input.setAttribute('aria-activedescendant',`suggestion-${active}`);else input.removeAttribute('aria-activedescendant');
    root.querySelector('#suggestion-label')!.textContent=input.value.includes(' ')?'COMPLETE YOUR COMMAND':'SUGGESTED COMMANDS';
    root.querySelector('#match-count')!.textContent=options.length?`${options.length} available`:'';
    list.innerHTML=options.length?options.map((s,i)=>`<div id="suggestion-${i}" class="suggestion" role="option" aria-selected="${i===active}" data-index="${i}"><span class="suggestion-mark">${s.mark}</span><span class="suggestion-copy"><strong>${escapeUI(s.label)}</strong><small>${escapeUI(s.detail)}</small></span><span class="complete-key">Tab ↹</span></div>`).join(''):`<div class="empty">${input.value.trim().startsWith('drop ')||input.value.trim().startsWith('spawn ')?'Press Enter to preview this command.':'No matching commands. Try drop, spawn or help.'}</div>`;
    for(const button of root.querySelectorAll<HTMLElement>('[data-state]'))button.setAttribute('aria-pressed',String(button.dataset.state===input.value));
  }
  function fill(value:string){input.value=value;active=0;result.hidden=true;render();input.focus();input.setSelectionRange(value.length,value.length);}
  function complete(){if(options[active])fill(options[active].value);}
  function toggle(open:boolean){panel.hidden=!open;reopen.hidden=open;root.classList.toggle('console-closed',!open);if(open)input.focus();else reopen.focus();}
  input.addEventListener('input',()=>{active=0;result.hidden=true;render();},{signal:abort.signal});
  list.addEventListener('mousedown',event=>event.preventDefault(),{signal:abort.signal});
  list.addEventListener('click',event=>{const row=(event.target as HTMLElement).closest<HTMLElement>('[data-index]');if(row){active=Number(row.dataset.index);complete();}},{signal:abort.signal});
  input.addEventListener('keydown',event=>{
    if(event.isComposing)return;
    if(event.key==='Tab'&&options.length&&!event.shiftKey){event.preventDefault();complete();}
    else if(['ArrowDown','ArrowUp'].includes(event.key)){
      event.preventDefault();const direction=event.key==='ArrowDown'?1:-1;
      if(event.altKey||!options.length){if(history.length){historyIndex=Math.max(0,Math.min(history.length-1,historyIndex+direction));fill(history[historyIndex]);}}
      else {active=(active+direction+options.length)%options.length;render();}
    } else if(event.key==='Enter'){
      event.preventDefault();if(!input.value.trim())return;
      if(!input.value.trim().includes(' ')&&input.value.trim()!=='help'){complete();return;}
      history.push(input.value.trim());history=history.slice(-20);historyIndex=history.length;
      result.hidden=false;result.textContent=input.value.trim()==='help'?'Choose drop or spawn, then use Tab to fill the next argument.':`Preview received: ${input.value.trim()} · nothing was changed.`;
    }
  },{signal:abort.signal});
  window.addEventListener('keydown',event=>{if(event.isComposing)return;if((event.metaKey||event.ctrlKey)&&event.code==='KeyK'){event.preventDefault();if(!event.repeat)toggle(panel.hidden);}else if(event.key==='Escape'&&!panel.hidden){event.preventDefault();toggle(false);}},{signal:abort.signal});
  root.querySelector('.close')!.addEventListener('click',()=>toggle(false),{signal:abort.signal});
  reopen.addEventListener('click',()=>toggle(true),{signal:abort.signal});
  for(const button of root.querySelectorAll<HTMLElement>('[data-state]'))button.addEventListener('click',()=>{toggle(true);fill(button.dataset.state!);},{signal:abort.signal});
  panel.addEventListener('keydown',event=>{if(event.defaultPrevented||event.key!=='Tab'||(!event.shiftKey&&event.target===input&&options.length))return;event.preventDefault();if(event.target===input)(root.querySelector('.close') as HTMLElement).focus();else input.focus();},{signal:abort.signal});
  fill('drop helmet ');
  const world=new World(7319), renderer=new Renderer(), sim=new Simulation(world,{seed:7319,spawn:false});
  const canvas=root.querySelector<HTMLCanvasElement>('canvas')!, postfx=new PostFX(canvas);
  renderer.pointerActive=false;sim.time=218;sim.player.angle=-.65;
  let frame=0;
  function draw(){frame=0;if(disposed||document.hidden)return;const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);renderer.reset();renderer.resize(Math.round(640*w/h),640);renderer.cameraX=sim.player.x;renderer.cameraY=sim.player.y-15;renderer.render(sim,world,1,{phase:'paused',reducedMotion:true});postfx.render(renderer.canvas,0);}
  const redraw=()=>{if(!frame)frame=requestAnimationFrame(draw);};
  const observer=new ResizeObserver(redraw);observer.observe(root);
  window.addEventListener('visibilitychange',redraw,{signal:abort.signal});
  teardown=()=>{observer.disconnect();cancelAnimationFrame(frame);renderer.reset();postfx.dispose();world.dispose();};
  draw();root.dataset.ready='true';
}
function dispose(){if(disposed)return;disposed=true;abort.abort();teardown();}
window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();},{signal:abort.signal});
if(import.meta.hot)import.meta.hot.dispose(dispose);
void boot().catch(error=>{dispose();root.textContent=String(error);});
