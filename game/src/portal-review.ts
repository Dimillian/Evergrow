import './ui-kit.css';
import './style.css';
import './typography.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { GameShell } from './game-shell.ts';
import { WorldMap } from './world-map.ts';
import { Exploration } from './exploration.ts';
import { portalMapMarkers } from './travel.ts';
import { Lifetime } from './lifetime.ts';

// Frozen art/UI review: no simulation ticks, live input or character storage.
if (!import.meta.env.DEV) throw new Error('Local review only.');
installUITheme(); await loadGameFont();
const life = new Lifetime(), world = life.own(new World(7319)), sim = new Simulation(world, { spawn: false });
const params = new URLSearchParams(location.search), town = params.get('state') !== 'cast', anchor = world.getPortalAnchor(0);
const p = sim.player;
p.x = p.prevX = town ? anchor.x - 46 : 0; p.y = p.prevY = town ? anchor.y + 20 : 330;
p.angle = -Math.PI / 2;
if (town) sim.travel.returnTo = { x: 0, y: 330, town: 0 };
else { sim.portal.origin = { x: p.x, y: p.y }; sim.portal.elapsed = 2.2; }
const shell = life.own(new GameShell(document.querySelector('#app')!, { play() {}, returnToTitle() {}, openMap() {}, openCharacter() {}, openSkills() {}, portal() {} }));
const chart = life.own(new Exploration(world, { storage: null })); chart.reveal(p.x, p.y);
const map = life.own(new WorldMap(world, chart, shell.mapMount, () => map.close()));
map.setPortalMarkers(() => portalMapMarkers(sim.travel, band => world.getPortalAnchor(band)));
const renderer = new Renderer(), fx = life.own(new PostFX(shell.canvas));
function draw() {
  const ratio = devicePixelRatio || 1;
  shell.canvas.width = innerWidth * Math.min(1.6, ratio); shell.canvas.height = innerHeight * Math.min(1.6, ratio);
  shell.uiCanvas.width = innerWidth * ratio; shell.uiCanvas.height = innerHeight * ratio;
  renderer.resize(Math.round(540 * innerWidth / innerHeight), 540); renderer.snapTo(p);
  const settings = { phase: 'playing' as const, reducedMotion: true, debug: false, fps: 60 };
  renderer.render(sim, world, 0, settings); fx.render(renderer.canvas, 0);
  const c = shell.uiCanvas.getContext('2d')!;
  c.setTransform(shell.uiCanvas.width / renderer.width, 0, 0, shell.uiCanvas.height / renderer.height, 0, 0);
  renderer.renderUI(c, sim, world, settings);
  map.drawMinimap(c, p, renderer.width, renderer.height, 0);
  shell.resizeControls(renderer.width, renderer.height);
  shell.setPortalState(sim.portal.active ? sim.portal.progress : null, town);
}
shell.showMenu('playing', 0, 0); draw();
if (params.has('map')) map.open(p);
window.addEventListener('resize', draw); life.defer(() => window.removeEventListener('resize', draw));
if (import.meta.hot) import.meta.hot.dispose(() => life.dispose());
