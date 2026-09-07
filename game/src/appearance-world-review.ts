import './typography.css';
import { loadGameFont } from './font.ts';
import { installUITheme } from './ui-theme.ts';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { createCharacterSheet, STARTER_LOADOUTS } from './items.ts';
import { refreshCharacter } from './character.ts';
import { SKIN_PALETTES, HAIR_PALETTES, HAIR_STYLES, FACIAL_HAIR, ACCESSORIES } from './appearance-content.ts';
import { ARMOR_PARTS, ARMOR_TINTS } from './appearance-armor-content.ts';
import { escapeUI } from './ui-components.ts';
if(!import.meta.env.DEV)throw new Error('Local appearance world study only.');
await loadGameFont();installUITheme();
const root=document.querySelector<HTMLElement>('#looks')!,params=new URLSearchParams(location.search);
const selected=params.has('sample')?Math.max(0,Math.min(5,Number(params.get('sample'))||0)):null;
let seed=9072026;
const pick=<T,>(values:readonly T[]):T=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return values[Math.floor(seed/4294967296*values.length)];};
const samples=STARTER_LOADOUTS.map((loadout,index)=>{
  const sheet=createCharacterSheet(loadout.id);
  sheet.look={appearance:{skin:pick(SKIN_PALETTES).id,hairColor:pick(HAIR_PALETTES).id,hair:pick(HAIR_STYLES).id,facialHair:pick(FACIAL_HAIR).id,accessory:pick(ACCESSORIES).id},
    armorTints:Object.fromEntries(ARMOR_PARTS.map(p=>[p.id,pick(ARMOR_TINTS).id])),showHelmet:index===5};
  return {sheet,loadout,index};
});
root.innerHTML=`<style>body{margin:0;background:#0a1319;color:#d4ddd5;font:16px var(--ui-font)}main{max-width:1440px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:20px}h1{font-size:25px;margin:0 0 8px;font-weight:500}p{color:#a0b4ad;font-size:14px;line-height:1.6;margin:0}a{color:#b3cebd}section{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}article{background:#13212a;border:1px solid #50675b55;overflow:hidden}canvas{width:100%;display:block}h2{font-size:17px;margin:12px 14px 8px;font-weight:500}article p{margin:0 14px 12px;font-size:12px}.single{display:block;max-width:1100px;margin:auto}footer{margin-top:20px;font-size:13px;color:#9cafa8}</style>
<header><div><h1>Character looks · In the world</h1><p>Six seeded random recipes · Actual player rig, world lighting and CRT · World seed 7319</p></div><a href="/character-editor.html">Character editor</a></header><section class="${selected===null?'':'single'}"></section><footer>Frozen staged scene using the game renderer. No simulation ticks, combat, saves or cloud access. Gallery crops omit HUD; individual views include the native HUD.</footer>`;
try {
const world=new World(7319),renderer=new Renderer();
// A stationary, collision-free surface location; no gameplay input or simulation steps.
let scene: {x:number;y:number}|undefined;
for(let y=-600;y<=600&&!scene;y+=60)for(let x=-600;x<=600;x+=60){
  if(!world.blocked(x,y,28)&&!world.getBuildings(x-100,y-120,200,200).length){scene={x,y};break;}
}
if(!scene)throw new Error('No clear appearance staging location found.');
const width=selected===null?480:960,height=selected===null?360:600;renderer.resize(width,height);
const output=document.createElement('canvas');output.width=width;output.height=height;
const post=new PostFX(output);
const settings={phase:'playing' as const,reducedMotion:true,fps:60,debug:false};
for(const sample of samples.filter(s=>selected===null||s.index===selected)){
  const sim=new Simulation(world,{seed:7319,spawn:false,startX:scene.x,startY:scene.y});
  sim.player.character=sample.sheet;refreshCharacter(sim.player);sim.player.hp=sim.player.maxHp;sim.player.mana=sim.player.maxMana;
  sim.player.angle=Math.PI/2;sim.time=3;
  renderer.reset();renderer.cameraX=scene.x;renderer.cameraY=scene.y-25;
  for(let i=0;i<4;i++)renderer.zoomByWheel(-300,0,height);
  renderer.render(sim,world,1/60,settings);post.render(renderer.canvas,0);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d')!;ctx.drawImage(output,0,0);
  if(selected!==null)renderer.renderUI(ctx,sim,world,settings);
  const appearance=sample.sheet.look.appearance;
  const article=document.createElement('article');
  article.innerHTML=`<h2><a href="?sample=${sample.index}">${sample.index+1}. ${escapeUI(sample.loadout.label)}</a></h2><p>${escapeUI(appearance.skin)} skin · ${escapeUI(appearance.hairColor)} ${escapeUI(appearance.hair)} · ${escapeUI(appearance.facialHair)} · ${escapeUI(appearance.accessory)}${sample.sheet.look.showHelmet?' · Helmet shown':''}</p>`;
  article.prepend(canvas);root.querySelector('section')!.append(article);
}
post.dispose();world.dispose();
}catch(error){root.querySelector('section')!.textContent=String(error);throw error;}
