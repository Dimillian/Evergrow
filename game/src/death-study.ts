import './death-study.css';
import { loadGameFont } from './font.ts';
import { randomFromSeed, polygon, line } from './art-primitives.ts';
import { drawHumanoid } from './art.ts';
import { PostFX } from './postfx.ts';
import { DEATH_KINDS, DEATH_VARIANTS, ENEMY_DEATHS } from './death-content.ts';
import { drawDeathFigure } from './death-art.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { EnemyDeaths } from './death-presentation.ts';
import { DEATH_MATERIALS } from './death-humanoid-art.ts';
import type { EnemyKind } from './model.ts';

if (!import.meta.env.DEV) throw new Error('Local review only');
await loadGameFont();
// Isolated art playback: no Simulation, gameplay input, audio, storage or saves.
const host=document.querySelector<HTMLElement>('#study')!;
const requested=new URLSearchParams(location.search).get('creature');
let kind:EnemyKind=DEATH_KINDS.find(k=>k===requested)??'stalker';
let designs=ENEMY_DEATHS[kind],facing=1.05;
host.innerHTML=`<header><div><p class="eyebrow">EVERGROW / MOTION STUDIES</p><h1>How should they fall?</h1>
<p class="intro">Nine creatures. Four deaths each. One random choice on every kill.</p></div>
<span class="badge">36 ANIMATIONS · SHARED WITH GAMEPLAY</span></header>
<nav class="creatures" aria-label="Creature">${DEATH_KINDS.map(k=>`<button data-creature="${k}" aria-pressed="${k===kind}">${ENEMY_DEFINITIONS[k].name}</button>`).join('')}</nav>
<section class="transport" aria-label="Animation playback">
<button id="play" class="primary">Pause</button><button id="replay">Replay all</button>
<label>Speed <select id="speed"><option value="1">1×</option><option value="0.5">½×</option><option value="0.25">¼×</option></select></label>
<label class="scrub">Death frame <input id="frame" type="range" min="0" max="2.2" value="0" step="0.005"><output id="time">0.00 s</output></label>
<label>Facing <select id="facing">${['East','Southeast','South','Southwest','West','Northwest','North','Northeast'].map((name,i)=>`<option value="${i*Math.PI/4}" ${i===1?'selected':''}>${name}</option>`).join('')}</select></label>
<button id="roll">Roll a death</button><output id="choice" aria-live="polite"></output></section>
<section class="grid" aria-label="Four death animation designs">${designs.map((design,i)=>`
<article><div class="card-heading"><div><span class="number">0${i+1}</span><h2>${design.title}</h2></div><span class="phase" id="phase-${i}">Alive</span></div>
<p class="sequence">${design.sequence}</p><div class="stage"><canvas id="canvas-${i}" width="480" height="224" aria-label="Animated ${design.title.toLowerCase()} design"></canvas>
<span class="scale-label">ENLARGED ×3.2</span><span class="native-label">1× SCALE</span></div>
<div class="filmstrip" aria-label="Frozen poses at impact, fall, landing and rest">${['Impact','Fall','Landing','Rest'].map((label,j)=>`<button class="pose" data-design="${i}" data-pose="${j}"><canvas id="pose-${i}-${j}" width="120" height="68" aria-hidden="true"></canvas><span>${label}</span></button>`).join('')}</div>
<p class="detail">Ground contact ${design.contact.toFixed(2)} s · Settled ${design.settle.toFixed(2)} s</p></article>`).join('')}</section>
<footer><span>Loop: ready → death → hold. Click a pose to inspect that moment across all four.</span>
<span>Save-free preview · Same 36 animations as gameplay</span></footer>`;
const query=<T extends Element>(id:string)=>document.querySelector<T>(id)!;
const source=document.createElement('canvas'), filtered=document.createElement('canvas');
source.width=filtered.width=960;source.height=filtered.height=584;
const ctx=source.getContext('2d')!,fx=new PostFX(filtered);
const canvases=designs.map((_,i)=>query<HTMLCanvasElement>(`#canvas-${i}`));
const strips=designs.map((_,i)=>[0,1,2,3].map(j=>query<HTMLCanvasElement>(`#pose-${i}-${j}`)));
const phases=designs.map((_,i)=>query<HTMLElement>(`#phase-${i}`));
const slider=query<HTMLInputElement>('#frame'),timeLabel=query<HTMLOutputElement>('#time'),play=query<HTMLButtonElement>('#play');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let running=!reduced.matches,clock=reduced.matches?2.9:0,speed=1,last=performance.now(),raf=0,dirty=true;
facing=Math.PI/4;
const rolls=new EnemyDeaths();let rollId=0;
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
function poseTime(i:number,j:number) { const d=designs[i];return [.09,d.contact*.58,d.contact,d.settle][j]; }
function updateCreature() {
  designs=ENEMY_DEATHS[kind];
  document.querySelectorAll<HTMLButtonElement>('[data-creature]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.creature===kind)));
  document.querySelectorAll<HTMLElement>('article').forEach((article,i)=>{
    const d=designs[i];article.querySelector('h2')!.textContent=d.title;
    article.querySelector('.sequence')!.textContent=d.sequence;
    article.querySelector('.detail')!.textContent=`Ground contact ${d.contact.toFixed(2)} s · Settled ${d.settle.toFixed(2)} s`;
    article.classList.remove('chosen');canvases[i].setAttribute('aria-label',`Animated ${ENEMY_DEFINITIONS[kind].name}: ${d.title}`);
  });
  query('#choice').textContent='';clock=reduced.matches?2.9:0;dirty=true;
}
function draw() {
  const age=Math.max(0,Math.min(2.2,clock-.65));
  ctx.clearRect(0,0,source.width,source.height);
  designs.forEach((_,i)=>{
    const x=i%2*480,y=Math.floor(i/2)*292;
    ctx.save();ctx.translate(x,y);ctx.drawImage(readyBackground,0,0);
    // Both sizes use the same proposed rig and exact sampled time.
    const artScale=kind==='hound'||kind==='wisp'?1:DEATH_MATERIALS[kind].scale;
    const zoom=kind==='warden'?1.15:kind==='goblinChief'?2.55:2.9;
    for(const [px,py,scale] of [[215,148,zoom],[kind==='warden'?410:425,167,kind==='warden'?.38:1]]) {
      ctx.save();ctx.translate(px,py);ctx.scale(scale,scale);drawDeathFigure(ctx,kind,DEATH_VARIANTS[i],age,facing);ctx.restore();
    }
    // Existing live art provides an honest silhouette reference, not an animated replacement.
    ctx.save();ctx.translate(48,168);ctx.scale(1.3/artScale,1.3/artScale);ctx.globalAlpha=.7;
    drawHumanoid(ctx,{kind,angle:facing,time:1,moving:0,attack:0,attackAngle:facing,hitFlash:0,dodging:false});ctx.restore();
    for(let j=0;j<4;j++) {
      ctx.fillStyle='#111e19';ctx.fillRect(j*120,224,120,68);
      ctx.save();ctx.translate(j*120+52,275);ctx.scale(1.05/artScale,1.05/artScale);
      drawDeathFigure(ctx,kind,DEATH_VARIANTS[i],poseTime(i,j),facing);ctx.restore();
    }
    ctx.restore();
  });
  fx.render(source,0);
  designs.forEach((design,i)=>{
    const x=i%2*480,y=Math.floor(i/2)*292;
    const canvas=canvases[i],out=canvas.getContext('2d')!;
    out.drawImage(filtered,x,y,480,224,0,0,canvas.width,canvas.height);
    strips[i].forEach((strip,j)=>strip.getContext('2d')!.drawImage(filtered,x+j*120,y+224,120,68,0,0,strip.width,strip.height));
    phases[i].textContent=age===0?'Alive':age<.12?'Impact':age<design.contact?'Falling':age<design.settle?'Settling':'At rest';
    phases[i].dataset.rest=String(age>=design.settle);
    canvases[i].parentElement!.querySelector('.scale-label')!.textContent=kind==='warden'?'ENLARGED ×1.15':'ENLARGED';
    canvases[i].parentElement!.querySelector('.native-label')!.textContent=kind==='warden'?'×0.38 SCALE':'1× SCALE';
  });
  if(document.activeElement!==slider) slider.value=String(age);
  timeLabel.value=`${age.toFixed(2)} s`;
}
function frame(now:number) {
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(running&&!document.hidden) { clock=(clock+dt*speed)%4.2;dirty=true; }
  if(dirty) {draw();dirty=false;}
  raf=requestAnimationFrame(frame);
}
play.addEventListener('click',()=>setRunning(!running),{signal:events.signal});
query('#replay').addEventListener('click',()=>{clock=0;setRunning(!reduced.matches);},{signal:events.signal});
query<HTMLSelectElement>('#speed').addEventListener('change',e=>{speed=Number((e.target as HTMLSelectElement).value);},{signal:events.signal});
slider.addEventListener('input',()=>{clock=.65+Number(slider.value);setRunning(false);},{signal:events.signal});
query<HTMLSelectElement>('#facing').addEventListener('change',e=>{facing=Number((e.target as HTMLSelectElement).value);dirty=true;},{signal:events.signal});
document.querySelectorAll<HTMLButtonElement>('[data-creature]').forEach(b=>b.addEventListener('click',()=>{kind=b.dataset.creature as EnemyKind;updateCreature();},{signal:events.signal}));
query('#roll').addEventListener('click',()=>{
  rolls.reset();rolls.handle({type:'kill',x:0,y:0,angle:facing,facing,targetId:++rollId,remainingHp:0,enemyKind:kind});
  const variant=rolls.remains[0].variant;
  document.querySelectorAll('article').forEach((article,i)=>article.classList.toggle('chosen',variant===i));
  query('#choice').textContent=`Picked ${variant+1}: ${designs[variant].title}`;
  clock=reduced.matches?2.9:0;setRunning(!reduced.matches);
},{signal:events.signal});
document.querySelectorAll<HTMLButtonElement>('.pose').forEach(button=>button.addEventListener('click',()=>{
  clock=.65+poseTime(Number(button.dataset.design),Number(button.dataset.pose));setRunning(false);
},{signal:events.signal}));
reduced.addEventListener('change',()=>{if(reduced.matches) {clock=2.9;setRunning(false);}}, {signal:events.signal});
setRunning(running);raf=requestAnimationFrame(frame);
function dispose() { cancelAnimationFrame(raf);events.abort();fx.dispose(); }
window.addEventListener('pagehide',dispose,{once:true,signal:events.signal});
if(import.meta.hot) import.meta.hot.dispose(dispose);
