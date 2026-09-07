import './typography.css';
import './ui-kit.css';
import './layout-review.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { Simulation } from './simulation.ts';
import { eventSite, type EventRecord } from './poi-content.ts';
import { eventRewards, eventRewardMask } from './poi-rewards.ts';
import { treasureLanding } from './treasure-flight.ts';
import { WILDERNESS_BOSSES, BOSS_NAMES, isWildernessBoss } from './wilderness-boss-content.ts';
// Static scene staging only: no simulation ticks, gameplay input or storage access.
if(!import.meta.env.DEV)throw new Error('Local review only.');
installUITheme();await loadGameFont();
const root=document.querySelector<HTMLElement>('#boss-review')!;
root.innerHTML='<header class="layout-review-header"><h1>Rulers of the wild</h1><p>Three bosses · Elite lieutenants · Veteran guards</p></header><div class="layout-review-toolbar"><nav class="layout-review-views"></nav><div class="layout-review-actions"><button data-mode="lair">Lair</button><button data-mode="warning">Attack warning</button><button data-mode="hoard">Open hoard</button></div></div><figure class="layout-review-figure"><div class="layout-review-frame"></div></figure>';
const world=new World(7319),sites=world.getWildernessSites(-18000,-18000,36000,36000).filter(s=>s.kind==='bossLair');
const canvas=document.createElement('canvas'),display=document.createElement('canvas');canvas.width=display.width=1920;canvas.height=display.height=1280;canvas.className='layout-review-scene';root.querySelector('.layout-review-frame')!.append(canvas);
const renderer=new Renderer(),fx=new PostFX(display),params=new URLSearchParams(location.search);
let kind=WILDERNESS_BOSSES.find(k=>k===params.get('boss'))??'briarMatriarch',mode='lair',frame=0,disposed=false,sim:Simulation,start=performance.now();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const buttons=new Map<string,HTMLButtonElement>();
for(const id of WILDERNESS_BOSSES){const b=document.createElement('button');b.textContent=BOSS_NAMES[id];b.onclick=()=>{kind=id;stage();};root.querySelector('nav')!.append(b);buttons.set(id,b);}
function stage(){
 cancelAnimationFrame(frame);const site=sites.find(s=>s.members[0].kind===kind);if(!site){root.querySelector('h1')!.textContent='No lair found for this seed';return;}
 sim=new Simulation(world,{spawn:false,startX:site.x+45,startY:site.y+190});sim.player.angle=-Math.PI/2;sim.time=12;
 const center=eventSite(site,world.seed);
 if(mode!=='hoard')for(const member of site.members){const enemy=sim.spawnEnemy(member.kind,site.x+member.dx,site.y+member.dy,member.rank,{campId:site.id,memberId:member.id,lootSeed:site.seed})!;enemy.angle=Math.PI/2;enemy.attackAngle=Math.PI/2;
  if(isWildernessBoss(enemy.kind)&&mode==='warning'){enemy.state='windup';enemy.stateDuration=1.15;enemy.bossMove=kind==='ashColossus'?'eruption':kind==='briarMatriarch'?'fracture':'rush';enemy.bossOriginX=enemy.x;enemy.bossOriginY=enemy.y;enemy.attackTargetX=sim.player.x;enemy.attackTargetY=sim.player.y;}
 }
 if(mode==='hoard'){
  const record:EventRecord={...center,phase:'claimed',choice:null,wavesCleared:0,delivered:0,bonusGranted:true};record.delivered=eventRewardMask(record);sim.eventState.sites[site.id]=record;
  const reward=eventRewards(record);sim.groundItems=reward.items.map((item,i)=>({id:100+i,item,...treasureLanding(world,center.x,center.y,i,site.seed),flight:{x:center.x,y:center.y,at:12,delay:i*.15}}));
  sim.groundGold=[{id:110,...treasureLanding(world,center.x,center.y,12,site.seed),amount:reward.gold,age:0,flight:{x:center.x,y:center.y,at:12,delay:.1}}];
 }
 renderer.reset();renderer.resize(960,640);renderer.cameraX=site.x;renderer.cameraY=site.y+10;start=performance.now();
 for(const [id,b] of buttons)b.setAttribute('aria-current',String(id===kind));
 for(const b of root.querySelectorAll<HTMLButtonElement>('[data-mode]'))b.setAttribute('aria-current',String(b.dataset.mode===mode));
 params.set('boss',kind);history.replaceState(null,'',`${location.pathname}?${params}`);paint(start);
}
function paint(now:number){
 if(disposed)return;const t=reduced.matches?2:(now-start)/1000;sim.time=12+t;
 for(const enemy of sim.enemies)if(enemy.state==='windup')enemy.stateTime=reduced.matches?.8:(t%2)/2*enemy.stateDuration;
 const settings={phase:'playing' as const,reducedMotion:reduced.matches,fps:0,debug:false};
 renderer.render(sim,world,1/60,settings);fx.render(renderer.canvas,sim.time);
 const c=canvas.getContext('2d')!;c.setTransform(1,0,0,1,0,0);c.drawImage(display,0,0);c.save();c.scale(2,2);renderer.renderUI(c,sim,world,settings);c.restore();
 canvas.setAttribute('aria-label',`${BOSS_NAMES[kind]} · ${mode}`);root.dataset.ready='true';frame=requestAnimationFrame(paint);
}
for(const b of root.querySelectorAll<HTMLButtonElement>('[data-mode]'))b.onclick=()=>{mode=b.dataset.mode!;stage();};
stage();
function dispose(){disposed=true;cancelAnimationFrame(frame);fx.dispose();renderer.reset();world.dispose();}
window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
if(import.meta.hot)import.meta.hot.dispose(dispose);
