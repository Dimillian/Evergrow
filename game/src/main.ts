import './style.css';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import type { VisualMode } from './postfx.ts';
import type { Input } from './model.ts';
import { GameAudio } from './audio.ts';

type Phase='ready'|'playing'|'paused'|'dead';
interface Preferences{mode:VisualMode;muted:boolean;reducedMotion:boolean;}
const app=document.querySelector<HTMLElement>('#app')!;
app.innerHTML=`<div class="game-shell">
  <canvas id="game" tabindex="0" aria-label="Evergrowing combat arena. WASD to move, left mouse to attack, right mouse to cast, Space to dodge, Q to heal, Escape to pause."></canvas>
  <div class="toolbar"><button id="visual" title="Cycle display effect (V)">CRT</button><button id="sound" title="Toggle sound (M)" aria-label="Toggle sound">SOUND ON</button><button id="pause" title="Pause (Escape)" aria-label="Pause game">ESC</button></div>
  <div id="overlay" class="overlay" role="dialog" aria-modal="true" aria-labelledby="menu-title"></div>
  <div class="corner-help">WASD MOVE · LMB CLEAVE · RMB EMBER · SPACE DODGE · Q MEND</div>
  <div id="toast" class="toast" role="status"></div>
  <p id="state-description" class="sr-only" aria-live="polite"></p>
</div>`;

class Game {
  world=new World(7319);
  sim=new Simulation(this.world,{seed:7319});
  renderer=new Renderer();
  audio=new GameAudio();
  canvas=document.querySelector<HTMLCanvasElement>('#game')!;
  fx:PostFX;
  phase:Phase='ready';
  preferences:Preferences={mode:'crt',muted:false,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
  private keys=new Set<string>();
  private mouse={x:0,y:0,left:false,right:false};
  private pendingDodge=false;private pendingHeal=false;
  private pendingAttack=false;private pendingCast=false;
  private last=performance.now();private accumulator=0;private animation=0;private fps=60;
  private hitPause=0;private lastHitPause=-1;private toastTimer=0;
  private abort=new AbortController();
  private debug=false;
  constructor(){
    this.fx=new PostFX(this.canvas);
    try{const saved=JSON.parse(localStorage.getItem('evergrowing-preferences')??'null');if(saved){if(['crt','phosphor','clean'].includes(saved.mode))this.preferences.mode=saved.mode;if(typeof saved.muted==='boolean')this.preferences.muted=saved.muted;if(typeof saved.reducedMotion==='boolean')this.preferences.reducedMotion=saved.reducedMotion;}}catch{/* Preferences are optional; play remains available when storage is disabled. */}
    this.audio.setEnabled(!this.preferences.muted);this.resize();this.bind();this.updateToolbar();this.showMenu();this.animation=requestAnimationFrame(this.frame);
  }
  private bind(){
    const signal=this.abort.signal;
    window.addEventListener('resize',()=>this.resize(),{signal});
    window.addEventListener('blur',()=>{this.clearInput();if(this.phase==='playing')this.pause();},{signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clearInput();if(this.phase==='playing')this.pause();}this.last=performance.now();this.accumulator=0;},{signal});
    window.addEventListener('keydown',event=>{
      if(event.target instanceof HTMLSelectElement||event.target instanceof HTMLInputElement)return;
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
      if(event.code==='Escape'){event.preventDefault();if(this.phase==='playing')this.pause();else if(this.phase==='paused')this.resume();return;}
      if(event.repeat)return;
      if(event.code==='Enter'&&this.phase!=='playing'){event.preventDefault();this.phase==='paused'?this.resume():this.start();return;}
      if(event.code==='KeyV'){this.cycleMode();return;}
      if(event.code==='KeyM'){this.toggleSound();return;}
      if(event.code==='F3'){event.preventDefault();this.debug=!this.debug;return;}
      if(event.code==='KeyR'&&this.phase==='dead'){this.start();return;}
      if(this.phase!=='playing')return;
      this.keys.add(event.code);if(event.code==='Space')this.pendingDodge=true;if(event.code==='KeyQ')this.pendingHeal=true;
    },{signal});
    window.addEventListener('keyup',event=>this.keys.delete(event.code),{signal});
    this.canvas.addEventListener('pointermove',event=>{const rect=this.canvas.getBoundingClientRect();this.mouse.x=(event.clientX-rect.left)/rect.width*this.renderer.width;this.mouse.y=(event.clientY-rect.top)/rect.height*this.renderer.height;},{signal});
    this.canvas.addEventListener('pointerdown',event=>{if(this.phase!=='playing')return;event.preventDefault();const rect=this.canvas.getBoundingClientRect();this.mouse.x=(event.clientX-rect.left)/rect.width*this.renderer.width;this.mouse.y=(event.clientY-rect.top)/rect.height*this.renderer.height;this.canvas.focus();this.canvas.setPointerCapture(event.pointerId);if(event.button===0){this.mouse.left=true;this.pendingAttack=true;}if(event.button===2){this.mouse.right=true;this.pendingCast=true;}void this.audio.unlock().catch(()=>this.toast('Sound is unavailable in this browser.'));},{signal});
    window.addEventListener('pointerup',event=>{if(event.button===0)this.mouse.left=false;if(event.button===2)this.mouse.right=false;},{signal});
    this.canvas.addEventListener('pointercancel',()=>this.clearInput(),{signal});
    this.canvas.addEventListener('contextmenu',event=>event.preventDefault(),{signal});
    document.querySelector('#visual')!.addEventListener('click',()=>this.cycleMode(),{signal});
    document.querySelector('#sound')!.addEventListener('click',()=>this.toggleSound(),{signal});
    document.querySelector('#pause')!.addEventListener('click',()=>this.phase==='playing'?this.pause():this.phase==='paused'?this.resume():undefined,{signal});
  }
  private resize(){
    const width=window.innerWidth,height=window.innerHeight,ratio=Math.min(1.6,window.devicePixelRatio||1);
    this.canvas.width=Math.round(width*ratio);this.canvas.height=Math.round(height*ratio);
    const logicalHeight=Math.min(680,Math.max(450,Math.round(height/1.35)));
    this.renderer.resize(Math.max(540,Math.round(logicalHeight*width/height)),logicalHeight);
    this.mouse.x=this.renderer.width*.6;this.mouse.y=this.renderer.worldHeight*.43;
  }
  clearInput(){this.keys.clear();this.mouse.left=false;this.mouse.right=false;this.pendingDodge=false;this.pendingHeal=false;this.pendingAttack=false;this.pendingCast=false;this.sim.clearInput();this.accumulator=0;}
  start(){this.sim.reset();this.renderer.reset();this.hitPause=0;this.lastHitPause=-1;this.clearInput();this.phase='playing';this.showMenu();this.canvas.focus();void this.audio.unlock().catch(()=>this.toast('Sound is unavailable in this browser.'));this.audio.setEnabled(!this.preferences.muted);this.last=performance.now();}
  pause(){this.phase='paused';this.clearInput();this.showMenu();}
  resume(){this.clearInput();this.phase='playing';this.showMenu();this.canvas.focus();this.last=performance.now();}
  private readInput():Input{
    const aim=this.renderer.screenToWorld(this.mouse.x,this.mouse.y);
    const input={moveX:Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft')),moveY:Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-Number(this.keys.has('KeyW')||this.keys.has('ArrowUp')),aimX:aim.x,aimY:aim.y,attack:(this.mouse.left||this.pendingAttack)&&this.mouse.y<this.renderer.worldHeight,cast:(this.mouse.right||this.pendingCast)&&this.mouse.y<this.renderer.worldHeight,dodge:this.pendingDodge,heal:this.pendingHeal};
    this.pendingDodge=false;this.pendingHeal=false;this.pendingAttack=false;this.pendingCast=false;return input;
  }
  private frame=(now:number)=>{
    const dt=Math.min(.05,Math.max(0,(now-this.last)/1000));this.last=now;this.fps+=(1/Math.max(dt,.001)-this.fps)*.04;
    if(this.phase==='playing'){
      const pausedFor=Math.min(this.hitPause,dt);this.hitPause-=pausedFor;
      const activeDt=dt-pausedFor;
      if(activeDt>0){
        this.accumulator+=activeDt;
        while(this.accumulator>=1/60){this.sim.update(1/60,this.readInput());this.accumulator-=1/60;}
        const events=this.sim.drainEvents();this.renderer.handleEvents(events,this.preferences.reducedMotion);
        for(const e of events){if(!(e.type==='cast'&&e.enemyKind))this.audio.play(e);if(e.type==='hit'&&this.sim.time-this.lastHitPause>.18&&!this.preferences.reducedMotion){this.hitPause=e.heavy?.035:.018;this.lastHitPause=this.sim.time;}}
        if(this.sim.player.dead){this.phase='dead';this.clearInput();this.showMenu();}
      }
    }
    this.renderer.pointerX=this.mouse.x;this.renderer.pointerY=this.mouse.y;
    this.renderer.render(this.sim,this.world,dt,{...this.preferences,phase:this.phase,fps:this.fps,debug:this.debug});
    this.fx.render(this.renderer.canvas,this.preferences.mode,this.renderer.hurt);
    this.animation=requestAnimationFrame(this.frame);
  };
  private showMenu(){
    const overlay=document.querySelector<HTMLElement>('#overlay')!;overlay.hidden=this.phase==='playing';document.querySelector('.game-shell')!.classList.toggle('playing',this.phase==='playing');
    if(this.phase==='playing'){overlay.innerHTML='';return;}
    const ready=this.phase==='ready',dead=this.phase==='dead';
    overlay.innerHTML=`<section class="panel"><p class="eyebrow">${ready?'EVERGROWING':dead?'DEADWOOD':'EVERGROWING'}</p><h1 id="menu-title">${ready?'DEADWOOD':dead?'YOU FELL':'PAUSED'}</h1><div class="rule"></div>
      ${ready?'<div class="controls"><div><kbd>W A S D</kbd>Move through the woods</div><div><kbd>LEFT MOUSE</kbd>Hold for a sword combo</div><div><kbd>RIGHT MOUSE</kbd>Cast an ember</div><div><kbd>SPACE</kbd>Dodge through danger</div><div><kbd>Q</kbd>Drink a healing flask</div><div><kbd>ESC</kbd>Pause and settings</div></div>':''}
      ${dead?`<p class="death-count">${this.sim.kills} slain · ${Math.floor(this.sim.time/60)}:${String(Math.floor(this.sim.time%60)).padStart(2,'0')} survived</p>`:''}
      ${!ready&&!dead?`<div class="settings"><label>Display<select id="display-mode"><option value="crt">CRT</option><option value="phosphor">Phosphor</option><option value="clean">Clean</option></select></label><label>Sound<input type="checkbox" id="audio-enabled" ${this.preferences.muted?'':'checked'}></label><label>Reduced motion<input type="checkbox" id="reduced-motion" ${this.preferences.reducedMotion?'checked':''}></label></div>`:''}
      <div class="menu-actions"><button class="primary" id="play-action">${ready?'ENTER THE WOODS':dead?'TRY AGAIN':'RESUME'}</button>${!ready&&!dead?'<button class="secondary" id="restart-action">NEW RUN</button>':''}</div><p class="hint">${ready?'Headphones recommended · Keyboard and mouse':dead?'Your sword is still waiting.':'WASD · LMB combo · RMB ember · Space dodge · Q heal'}</p></section>`;
    document.querySelector('#play-action')!.addEventListener('click',()=>this.phase==='paused'?this.resume():this.start());
    document.querySelector('#restart-action')?.addEventListener('click',()=>this.start());
    const select=document.querySelector<HTMLSelectElement>('#display-mode');if(select){select.value=this.preferences.mode;select.addEventListener('change',()=>{this.preferences.mode=select.value as VisualMode;this.savePreferences();});}
    document.querySelector<HTMLInputElement>('#audio-enabled')?.addEventListener('change',event=>{this.preferences.muted=!(event.target as HTMLInputElement).checked;this.audio.setEnabled(!this.preferences.muted);this.savePreferences();});
    document.querySelector<HTMLInputElement>('#reduced-motion')?.addEventListener('change',event=>{this.preferences.reducedMotion=(event.target as HTMLInputElement).checked;this.savePreferences();});
    document.querySelector<HTMLButtonElement>('#play-action')?.focus();
    document.querySelector('#state-description')!.textContent=this.phase==='dead'?`You fell after defeating ${this.sim.kills} enemies. Try again to begin a new run.`:this.phase==='paused'?'Game paused.':'Ready to enter Deadwood.';
  }
  cycleMode(){this.preferences.mode=this.preferences.mode==='crt'?'phosphor':this.preferences.mode==='phosphor'?'clean':'crt';this.savePreferences();this.toast(`Display: ${this.preferences.mode.toUpperCase()}`);}
  toggleSound(){this.preferences.muted=!this.preferences.muted;this.audio.setEnabled(!this.preferences.muted);void this.audio.unlock().catch(()=>{});this.savePreferences();}
  private savePreferences(){try{localStorage.setItem('evergrowing-preferences',JSON.stringify(this.preferences));}catch{}this.updateToolbar();}
  private updateToolbar(){document.querySelector('#visual')!.textContent=this.preferences.mode.toUpperCase();document.querySelector('#sound')!.textContent=this.preferences.muted?'SOUND OFF':'SOUND ON';}
  private toast(message:string){const el=document.querySelector('#toast')!;el.textContent=message;el.classList.add('visible');window.clearTimeout(this.toastTimer);this.toastTimer=window.setTimeout(()=>el.classList.remove('visible'),1800);}
  dispose(){cancelAnimationFrame(this.animation);this.abort.abort();this.fx.dispose();}
}

try{
  const game=new Game();
  if(import.meta.env.DEV){Object.assign(window,{__evergrowing:game});}
  if(import.meta.hot)import.meta.hot.dispose(()=>game.dispose());
}catch(error){console.error(error);app.innerHTML='<div class="error"><h1>The woods could not be drawn.</h1><p>Reload to try again. This prototype needs a browser with Canvas support.</p></div>';}
