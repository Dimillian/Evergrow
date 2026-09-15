import '../ui-kit.css';
import '../typography.css';
import './console.css';
import { installUITheme } from '../ui-theme.ts';
import { loadGameFont } from '../font.ts';
import { ConsolePanel } from '../console-panel.ts';
import { parseConsoleCommand, consoleHelp } from '../console-content.ts';
import { isConsoleShortcut } from '../console-access.ts';
import { World } from '../world.ts';
import { Simulation } from '../simulation.ts';
import { Renderer } from '../renderer.ts';
import { PostFX } from '../postfx.ts';

// A disposable visual study: no Game, session, repository, simulation updates or commands.
const root = document.querySelector<HTMLElement>('#console-study')!;
const abort = new AbortController();
let disposed = false;
let teardown = () => {};
async function boot() {
  if (!import.meta.env.DEV) throw new Error('Local development proposal only.');
  installUITheme(); await loadGameFont(); if(disposed)return;
  root.innerHTML = `<canvas class="scene" aria-label="Frozen Evergrow landscape"></canvas><div class="veil"></div>
    <header class="study-heading"><span>EVERGROW <i>/</i> INTERFACE STUDY</span><span>01 <i>—</i> COMMAND CONSOLE</span></header>
    <div class="scene-caption"><span>THE WORLD IS PAUSED</span><small>A quiet moment to change the rules.</small></div>
    <div class="console-mount"></div><button class="reopen ui-button" hidden>Open command console <kbd>⌘ K</kbd></button>
    <aside class="study-controls" aria-label="Proposal states"><span>TRY A STATE</span><button data-state="">Discover</button><button data-state="drop helmet ">Item drop</button><button data-state="spawn ">Monster</button><button data-state="drop helmet --material ">Arguments</button><button data-state="refill ">Refill</button></aside>
    <p class="study-note">Interactive visual proposal · commands are demonstrations · no saves or gameplay</p>`;
  const reopen=root.querySelector<HTMLButtonElement>('.reopen')!;
  const panel=new ConsolePanel(root.querySelector('.console-mount')!,{close:()=>toggle(false),execute:async raw=>{
    const parsed=parseConsoleCommand(raw);
    return {ok:true,message:parsed.type==='help'?consoleHelp(parsed.command):`Preview received: ${raw} · nothing was changed.`};
  }});
  function toggle(open:boolean){if(open)panel.open();else panel.close();reopen.hidden=open;root.classList.toggle('console-closed',!open);if(!open)reopen.focus();}
  window.addEventListener('keydown',event=>{if(isConsoleShortcut(event)){event.preventDefault();if(!event.repeat)toggle(panel.element.hidden);}},{signal:abort.signal});
  reopen.addEventListener('click',()=>toggle(true),{signal:abort.signal});
  for(const button of root.querySelectorAll<HTMLElement>('[data-state]'))button.addEventListener('click',()=>{
    toggle(true);panel.setDraft(button.dataset.state!);
    for(const b of root.querySelectorAll('[data-state]'))b.setAttribute('aria-pressed',String(b===button));
  },{signal:abort.signal});
  toggle(true);panel.setDraft('drop helmet ');
  const world=new World(7319), renderer=new Renderer(), sim=new Simulation(world,{seed:7319,spawn:false});
  const canvas=root.querySelector<HTMLCanvasElement>('canvas')!, postfx=new PostFX(canvas);
  renderer.pointerActive=false;sim.time=218;sim.player.angle=-.65;
  let frame=0;
  function draw(){frame=0;if(disposed||document.hidden)return;const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);renderer.reset();renderer.resize(Math.round(640*w/h),640);renderer.cameraX=sim.player.x;renderer.cameraY=sim.player.y-15;renderer.render(sim,world,1,{phase:'paused',reducedMotion:true});postfx.render(renderer.canvas,0);}
  const redraw=()=>{if(!frame)frame=requestAnimationFrame(draw);};
  const observer=new ResizeObserver(redraw);observer.observe(root);
  window.addEventListener('visibilitychange',redraw,{signal:abort.signal});
  teardown=()=>{panel.dispose();observer.disconnect();cancelAnimationFrame(frame);renderer.reset();postfx.dispose();world.dispose();};
  draw();root.dataset.ready='true';
}
function dispose(){if(disposed)return;disposed=true;abort.abort();teardown();}
window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();},{signal:abort.signal});
if(import.meta.hot)import.meta.hot.dispose(dispose);
void boot().catch(error=>{dispose();root.textContent=String(error);});
