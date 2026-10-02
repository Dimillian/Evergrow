import '../typography.css';
import '../layout-review.css';
import { loadGameFont, text } from '../font.ts';
import { ArtLibrary } from '../prop-art.ts';
import { EnvironmentArt } from '../environment-art.ts';
import { PropSurfaceLight } from '../prop-surface-light.ts';
import { SceneShadows } from '../scene-shadows.ts';
import { drawHumanoid } from '../art.ts';
import { STARTER_OUTFIT } from '../equipment-art.ts';
import { STARTING_SWORD } from '../equipment.ts';
import { SHIELD_PROFILES } from '../weapon-content.ts';
import { withGearLight, type GearLight } from '../gear-material.ts';
import { sampleGearLight } from '../gear-scene-light.ts';
import { drawGlow, type PointLight } from '../lighting.ts';
import { skyAtHour } from '../world-time.ts';
import { cameraView } from '../camera.ts';
import type { Prop } from '../world.ts';
import type { TreeKind } from '../tree-art.ts';
import { PostFX } from '../postfx.ts';
if (!import.meta.env.DEV) throw Error('Local art study only');
await loadGameFont();
const root = document.querySelector<HTMLElement>('#biome-review')!;
root.innerHTML = `<header class="layout-review-header"><div><p class="layout-review-eyebrow">SCULPTED STAINED GLASS</p><h1>Light gives the world shape</h1></div></header>
<div class="layout-review-toolbar"><div class="layout-review-actions"><button data-light="day">Daylight</button><button data-light="lamp">Moving lantern</button><button data-light="rift">Rift light</button></div><button data-pause>Pause light</button><label>Tree <select aria-label="Tree family"><option value="canopy">Verdant</option><option value="autumnTree">Amberwood</option><option value="snowPine">Frostpine</option><option value="willow">Mire</option><option value="deadTree">Deadwood</option></select></label></div>
<div class="volume-comparison" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:16px"></div>
<p style="color:#94abae;font-size:16px">Same procedural assets, light and pose. New surface planes, overlap shading, contact depth and material response.</p>
<p><a href="/biomes.html?lighting&volume&view=verdant&hour=10" style="color:#cddcb8">See the volume pass in the real forest →</a></p>
<output data-cost style="color:#899f9d;font-size:14px"></output>`;
root.removeAttribute('aria-busy');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let mode = 'day', paused = reduced.matches, time = 1.8, tree: TreeKind = 'canopy';
const art = new ArtLibrary(), environment = new EnvironmentArt(), shadows = new SceneShadows();
const prop = (id: number, kind: Prop['kind'], x: number, y: number, scale: number, seed: number): Prop => ({ id: `study:${id}`,kind,x,y,scale,seed,radius:12,biome:'verdant' } as Prop);
const scenes = [false, true].map(volume => {
  const box = document.createElement('figure'); box.style.cssText='margin:0;background:#0c171c;border:1px solid #334440';
  const caption = document.createElement('figcaption'); caption.textContent=volume?'AFTER · Sculpted surfaces':'BEFORE · Painted surfaces';caption.style.cssText='padding:12px 16px;color:'+(volume?'#d2e0bb':'#96a8a8');box.append(caption);
  const canvas = document.createElement('canvas'); canvas.width=1200;canvas.height=820;canvas.style.cssText='display:block;width:100%;height:auto';box.append(canvas);
  root.querySelector('.volume-comparison')!.append(box);
  const raw = document.createElement('canvas');raw.width=1200;raw.height=820;
  const fx = new PostFX(canvas), surface = new PropSurfaceLight();
  return {volume,canvas,raw,fx,surface};
});
function draw() {
  const start=performance.now(), sky=skyAtHour(mode==='day'?10:0);
  const key:GearLight={direction:sky.direction,color:mode==='day'?'#eee4c7':'#8eadd5',power:mode==='day'?1:.38};
  const lamp:PointLight={x:360+Math.cos(time*.7)*200,y:220+Math.sin(time*.7)*110,radius:410,color:mode==='rift'?'#d286ef':'#ffc67e',power:1.35};
  const props=[prop(1,tree,162,320,1.7,1827),prop(2,'rock',389,322,3.5,138),prop(3,'limestone',462,289,1.25,726)];
  const view=cameraView(600,410,300,205,1);
  for(const scene of scenes) {
    const c=scene.raw.getContext('2d')!; c.setTransform(2,0,0,2,0,0);
    const ground=c.createLinearGradient(0,0,0,410);ground.addColorStop(0,mode==='day'?'#243832':'#111d2b');ground.addColorStop(1,mode==='day'?'#3b4534':'#202b32');c.fillStyle=ground;c.fillRect(0,0,600,410);
    // Quiet exhibit ground; the actual-world view below uses normal terrain generation.
    for(let i=0;i<100;i++){const x=(i*137.3)%600,y=(i*97.7)%410;c.fillStyle=i%3?'#8995760b':'#0c202217';c.fillRect(x,y,3+i%8,1);}
    if(mode!=='day') {c.save();c.scale(1,.65);drawGlow(c,lamp.x,lamp.y/.65,210,lamp.color,.16);c.restore();}
    const light={...key,volume:scene.volume}, lights=mode==='day'?[]:[lamp];
    scene.surface.beginFrame();
    const spriteFor=(p:Prop)=>environment.getSprite(p)??art.getRock(p.seed,p.scale);
    shadows.drawProps(c,props,view,spriteFor,time,true,key.direction,mode==='day'?1:.5,scene.volume);
    for(const p of props) {
      const sprite=spriteFor(p), local=sampleGearLight(p.x,p.y-sprite.height*p.scale*.45,lights,light);
      c.save();c.translate(p.x,p.y);c.scale(p.scale,p.scale);
      for(const image of [sprite.image,...sprite.foliage??[]]) {
        if(scene.volume&&scene.surface.drawVolume(c,sprite,image,local,0))continue;
        c.drawImage(image,-sprite.anchorX,-sprite.anchorY,sprite.width,sprite.height);
        scene.surface.draw(c,p,sprite,image,sky);
      }
      c.restore();
    }
    const heroLight=sampleGearLight(292,290,lights,light);
    shadows.drawActor(c,292,326,14,70,heroLight,false);
    c.save();c.translate(292,326);c.scale(2,2);
    withGearLight(c,heroLight,()=>drawHumanoid(c,{kind:'player',time:1,angle:1.1,attackAngle:1.1,moving:0,attack:-1,hitFlash:0,dodging:false,
      outfit:STARTER_OUTFIT,weapon:STARTING_SWORD.visual,offHand:{kind:'shield',visual:SHIELD_PROFILES[0].visual}}));c.restore();
    if(mode!=='day'){drawGlow(c,lamp.x,lamp.y,17,lamp.color,.7);drawGlow(c,lamp.x,lamp.y,4,'#fff3d6',1);}
    text(c,'CANOPY',161,371,.8,'#a8b9a6','center');text(c,'FORGED ARMOR',292,371,.8,'#a8b9a6','center');text(c,'FACETED STONE',430,371,.8,'#a8b9a6','center');
    scene.fx.render(scene.raw,0);
  }
  root.querySelector('[data-cost]')!.textContent=`Comparison draw: ${(performance.now()-start).toFixed(1)} ms CPU · two scenes, enlarged art; not a gameplay FPS benchmark`;
}
for(const button of root.querySelectorAll<HTMLButtonElement>('[data-light]')) button.onclick=()=>{mode=button.dataset.light!; for(const b of root.querySelectorAll('[data-light]'))b.setAttribute('aria-current',String(b===button));draw();};
const pause=root.querySelector<HTMLButtonElement>('[data-pause]')!;
pause.textContent=paused?'Animate light':'Pause light';
pause.onclick=()=>{paused=!paused;pause.textContent=paused?'Animate light':'Pause light';};
root.querySelector('select')!.onchange=e=>{tree=(e.target as HTMLSelectElement).value as TreeKind;draw();};
root.querySelector('[data-light="day"]')!.setAttribute('aria-current','true');
let frame=0,previous=performance.now();draw();
requestAnimationFrame(()=>draw());
const animate=(now:number)=>{if(now-previous>=1000/30){if(!document.hidden&&!paused){time+=Math.min(.05,(now-previous)/1000);if(mode!=='day')draw();}previous=now;}frame=requestAnimationFrame(animate);};frame=requestAnimationFrame(animate);
function dispose(){cancelAnimationFrame(frame);scenes.forEach(s=>s.fx.dispose());art.reset();environment.reset();shadows.reset();}
window.addEventListener('pagehide',dispose,{once:true});if(import.meta.hot)import.meta.hot.dispose(dispose);
