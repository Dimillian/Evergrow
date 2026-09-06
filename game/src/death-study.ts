import './death-study.css';
import { loadGameFont } from './font.ts';
import { randomFromSeed, polygon, line } from './art-primitives.ts';
import { drawHumanoid } from './art.ts';
import { PostFX } from './postfx.ts';
import { DEATH_DESIGNS, drawDeathStudy, deathStudyPhase, deathStudyTime } from './death-study-rig.ts';

if (!import.meta.env.DEV) throw new Error('Local review only');
await loadGameFont();
// Isolated art playback: no Simulation, gameplay input, audio, storage or saves.
const host=document.querySelector<HTMLElement>('#study')!;
host.innerHTML=`<header><div><p class="eyebrow">EVERGROW / MOTION STUDIES</p><h1>How should they fall?</h1>
<p class="intro">Four articulated takes on the Stalker. Same creature, different weight and timing.</p></div>
<span class="badge">HUMANOIDS · CONCEPT PREVIEW</span></header>
<section class="transport" aria-label="Animation playback">
<button id="play" class="primary">Pause</button><button id="replay">Replay all</button>
<label>Speed <select id="speed"><option value="1">1×</option><option value="0.5">½×</option><option value="0.25">¼×</option></select></label>
<label class="scrub">Death frame <input id="frame" type="range" min="0" max="1.4" value="0" step="0.005"><output id="time">0.00 s</output></label>
<button id="mirror" aria-pressed="false">Mirror</button></section>
<section class="grid" aria-label="Four death animation designs">${DEATH_DESIGNS.map((design,i)=>`
<article><div class="card-heading"><div><span class="number">0${i+1}</span><h2>${design.title}</h2></div><span class="phase" id="phase-${i}">Alive</span></div>
<p class="sequence">${design.subtitle}</p><div class="stage"><canvas id="canvas-${i}" width="480" height="224" aria-label="Animated ${design.title.toLowerCase()} design"></canvas>
<span class="scale-label">ENLARGED ×3.2</span><span class="native-label">1× SCALE</span></div>
<div class="filmstrip" aria-label="Frozen poses at impact, fall, landing and rest">${['Impact','Fall','Landing','Rest'].map((label,j)=>`<button class="pose" data-design="${i}" data-pose="${j}"><canvas id="pose-${i}-${j}" width="120" height="68" aria-hidden="true"></canvas><span>${label}</span></button>`).join('')}</div>
<p class="detail">${design.detail}</p></article>`).join('')}</section>
<footer><span>Loop: ready → death → hold. Click a pose to inspect that moment across all four.</span>
<span>Art study only · Gameplay deaths unchanged</span></footer>`;
const query=<T extends Element>(id:string)=>document.querySelector<T>(id)!;
const source=document.createElement('canvas'), filtered=document.createElement('canvas');
source.width=filtered.width=960;source.height=filtered.height=584;
const ctx=source.getContext('2d')!,fx=new PostFX(filtered);
const canvases=DEATH_DESIGNS.map((_,i)=>query<HTMLCanvasElement>(`#canvas-${i}`));
const strips=DEATH_DESIGNS.map((_,i)=>[0,1,2,3].map(j=>query<HTMLCanvasElement>(`#pose-${i}-${j}`)));
const phases=DEATH_DESIGNS.map((_,i)=>query<HTMLElement>(`#phase-${i}`));
const slider=query<HTMLInputElement>('#frame'),timeLabel=query<HTMLOutputElement>('#time'),play=query<HTMLButtonElement>('#play');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let running=!reduced.matches,clock=reduced.matches?1.8:0,speed=1,mirror=false,last=performance.now(),raf=0,dirty=true;
const events=new AbortController();
const readyBackground=document.createElement('canvas');readyBackground.width=480;readyBackground.height=224;
const bg=readyBackground.getContext('2d')!;
const wash=bg.createRadialGradient(245,137,15,245,130,270);
wash.addColorStop(0,'#263b30');wash.addColorStop(.65,'#17271f');wash.addColorStop(1,'#101c19');
bg.fillStyle=wash;bg.fillRect(0,0,480,224);
const random=randomFromSeed(831);
for(let i=0;i<1000;i++) {
  const x=random()*480,y=random()*224,s=.3+random()*1.5;
  bg.globalAlpha=.12+random()*.2;bg.fillStyle=i%3?'#81916a':'#0a1712';bg.fillRect(x,y,s,s*.6);
}
bg.globalAlpha=1;
for(let i=0;i<65;i++) {
  const x=random()*480,y=random()*224;
  if(x>110&&x<365&&y>65&&y<198) continue;
  line(bg,[[x-2,y],[x-3,y-3],[x-1,y-1],[x+1,y-5]],'#394d34',.7);
  if(i%4===0) polygon(bg,[[x,y],[x+5,y-1],[x+7,y+1],[x+2,y+3]],'#53604a');
}
function setRunning(value:boolean) { running=value;play.textContent=running?'Pause':'Play';dirty=true; }
function poseTime(i:number,j:number) { const d=DEATH_DESIGNS[i];return [.09,.3,d.contact,1.1][j]; }
function draw() {
  const age=deathStudyTime(clock);
  ctx.clearRect(0,0,source.width,source.height);
  DEATH_DESIGNS.forEach((design,i)=>{
    const x=i%2*480,y=Math.floor(i/2)*292;
    ctx.save();ctx.translate(x,y);ctx.drawImage(readyBackground,0,0);
    // Both sizes use the same proposed rig and exact sampled time.
    for(const [px,py,scale] of [[225,168,3.2],[419,167,1]]) {
      ctx.save();ctx.translate(px,py);ctx.scale(scale,scale);drawDeathStudy(ctx,design,age,mirror);ctx.restore();
    }
    // Existing live art provides an honest silhouette reference, not an animated replacement.
    ctx.save();ctx.translate(52,168);ctx.scale(1.6,1.6);ctx.globalAlpha=.7;
    drawHumanoid(ctx,{kind:'stalker',angle:0,time:1,moving:0,attack:0,attackAngle:0,hitFlash:0,dodging:false});ctx.restore();
    for(let j=0;j<4;j++) {
      ctx.fillStyle='#111e19';ctx.fillRect(j*120,224,120,68);
      ctx.save();ctx.translate(j*120+52,279);ctx.scale(1.28,1.28);
      drawDeathStudy(ctx,design,poseTime(i,j),mirror);ctx.restore();
    }
    ctx.restore();
  });
  fx.render(source,0);
  DEATH_DESIGNS.forEach((design,i)=>{
    const x=i%2*480,y=Math.floor(i/2)*292;
    const canvas=canvases[i],out=canvas.getContext('2d')!;
    out.drawImage(filtered,x,y,480,224,0,0,canvas.width,canvas.height);
    strips[i].forEach((strip,j)=>strip.getContext('2d')!.drawImage(filtered,x+j*120,y+224,120,68,0,0,strip.width,strip.height));
    phases[i].textContent=deathStudyPhase(design,age);
    phases[i].dataset.rest=String(age>=design.keys[design.keys.length-1].time);
  });
  if(document.activeElement!==slider) slider.value=String(age);
  timeLabel.value=`${age.toFixed(2)} s`;
}
function frame(now:number) {
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(running&&!document.hidden) { clock=(clock+dt*speed)%3.2;dirty=true; }
  if(dirty) {draw();dirty=false;}
  raf=requestAnimationFrame(frame);
}
play.addEventListener('click',()=>setRunning(!running),{signal:events.signal});
query('#replay').addEventListener('click',()=>{clock=0;setRunning(!reduced.matches);},{signal:events.signal});
query<HTMLSelectElement>('#speed').addEventListener('change',e=>{speed=Number((e.target as HTMLSelectElement).value);},{signal:events.signal});
slider.addEventListener('input',()=>{clock=.65+Number(slider.value);setRunning(false);},{signal:events.signal});
query('#mirror').addEventListener('click',e=>{mirror=!mirror;(e.currentTarget as HTMLButtonElement).setAttribute('aria-pressed',String(mirror));dirty=true;},{signal:events.signal});
document.querySelectorAll<HTMLButtonElement>('.pose').forEach(button=>button.addEventListener('click',()=>{
  clock=.65+poseTime(Number(button.dataset.design),Number(button.dataset.pose));setRunning(false);
},{signal:events.signal}));
reduced.addEventListener('change',()=>{if(reduced.matches) {clock=1.8;setRunning(false);}}, {signal:events.signal});
setRunning(running);raf=requestAnimationFrame(frame);
function dispose() { cancelAnimationFrame(raf);events.abort();fx.dispose(); }
window.addEventListener('pagehide',dispose,{once:true,signal:events.signal});
if(import.meta.hot) import.meta.hot.dispose(dispose);
