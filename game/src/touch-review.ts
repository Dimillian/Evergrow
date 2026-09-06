import './ui-kit.css';
import './style.css';
import './typography.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { TouchHUD } from './touch-hud.ts';
import { InventoryPanel } from './inventory-panel.ts';
import { SkillTreePanel } from './skill-tree-panel.ts';
import { WorldMap } from './world-map.ts';
import { Exploration } from './exploration.ts';
import { generateItem } from './items.ts';
import { awardCharacterExperience } from './character.ts';
import { Lifetime } from './lifetime.ts';

// Real scene/UI components, frozen actor state. No Game, simulation ticks, or save access.
if (!import.meta.env.DEV) throw new Error('Touch study is local development only.');
installUITheme(); await loadGameFont();
const life = new Lifetime(), world = life.own(new World(7319));
const sim = new Simulation(world, {spawn:false});
const player = sim.player;
awardCharacterExperience(player, 600);
player.hp = Math.round(player.maxHp * .83); player.mana = Math.round(player.maxMana * .72);
player.character.gold = 1274; player.angle = Math.PI / 2;
player.character.skillSlots = ['cleave','lunge','shieldBash','bulwark','whirlwind'];
for (let i=0;i<19;i++) player.character.inventory[i] = generateItem(130+i,player.level,
  (['weapon','chest','ring','boots','grimoire','orb'] as const)[i%6], undefined, (['common','magic','rare','epic'] as const)[i%4]);
const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = '<div class="game-shell playing"><canvas id="game"></canvas><canvas id="game-ui"></canvas><div id="review-panels"></div></div>';
const shell = root.querySelector<HTMLElement>('.game-shell')!, mount = root.querySelector<HTMLElement>('#review-panels')!;
const canvas = root.querySelector<HTMLCanvasElement>('#game')!, ui = root.querySelector<HTMLCanvasElement>('#game-ui')!;
const renderer = new Renderer(), fx = life.own(new PostFX(canvas));
renderer.touchActive = true; renderer.pointerActive = false;
const exploration = new Exploration(world,{storage:null});
exploration.reveal(player.x,player.y,1600);
let panel = new URLSearchParams(location.search).get('panel') || 'world';
const noop = () => {};
const close = () => { panel='world'; inventory.close(); skills.close(); map.close(); shell.classList.add('playing'); };
const inventory = life.own(new InventoryPanel(mount,{close,equip:noop,unequip:noop,move:noop,equipBest:noop,sort:noop,allocate:noop}));
const skills = life.own(new SkillTreePanel(mount,{close,develop:noop,allocate:noop,assign:noop}));
const map = life.own(new WorldMap(world,exploration,mount,close));
const touch = life.own(new TouchHUD(shell,{activate:noop,clearAttack:noop,cancelCombat:noop,unlock:noop,notice:noop,
  menu: action => {
    if(action==='character') {panel='inventory';inventory.open(player);}
    else if(action==='skills') {panel='skills';skills.open(player);}
    else if(action==='map') {panel='map';map.open(player);}
    shell.classList.toggle('playing',panel==='world');
  }}, {forceTouch:true}));
touch.setActive(true);
if(panel==='inventory') inventory.open(player);
else if(panel==='skills') skills.open(player);
else if(panel==='map') map.open(player);
shell.classList.toggle('playing',panel==='world');
let frame=0, count=0;
function draw() {
  const w=innerWidth,h=innerHeight,dpr=devicePixelRatio||1,ratio=Math.min(1.6,dpr);
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)) {
    canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);ui.width=Math.round(w*dpr);ui.height=Math.round(h*dpr);
    const logicalHeight=Math.min(680,Math.max(450,Math.round(h/1.35)));
    renderer.resize(Math.round(logicalHeight*w/h),logicalHeight);
  }
  renderer.cameraX=player.x;renderer.cameraY=player.y-50;
  const settings={phase:'playing' as const,reducedMotion:true,fps:60,debug:false};
  renderer.render(sim,world,0,settings);fx.render(renderer.canvas,0);
  const c=ui.getContext('2d')!;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,ui.width,ui.height);
  c.setTransform(ui.width/renderer.width,0,0,ui.height/renderer.height,0,0);
  renderer.renderUI(c,sim,world,settings);
  if(w>=620)map.drawMinimap(c,player,renderer.width,renderer.height,0);
  touch.update(player,panel==='world'?'playing':'character',false,performance.now());
  if(++count>=3)root.dataset.ready='true';
  frame=requestAnimationFrame(draw);
}
draw();life.defer(()=>{cancelAnimationFrame(frame);renderer.reset();});
addEventListener('pagehide',()=>life.dispose(),{once:true});
if(import.meta.hot)import.meta.hot.dispose(()=>life.dispose());
