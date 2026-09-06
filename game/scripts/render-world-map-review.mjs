// Optional static CPU export. Supply an already installed Canvas module; no browser, gameplay or saves.
const canvasModule = process.env.CANVAS_MODULE;
if (!canvasModule) throw new Error('Set CANVAS_MODULE to an installed @napi-rs/canvas index.js path.');
const { createCanvas, GlobalFonts } = await import(canvasModule);
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const outputDir = resolve(process.argv[2] ?? '/tmp/evergrow-world-generation');
mkdirSync(outputDir, { recursive: true });
const rendered = [];
import { World } from '../src/world.ts';
import { Exploration } from '../src/exploration.ts';
import { WorldMap } from '../src/world-map.ts';
import { fitMapBounds } from '../src/map-view.ts';
import { stageExtendedAtlasExploration, EXTENDED_ATLAS_BOUNDS } from '../src/atlas-review-data.ts';
import { text } from '../src/font.ts';
GlobalFonts.registerFromPath(new URL('../src/assets/fonts/PixelifySans-Variable.ttf', import.meta.url).pathname, 'Pixelify Sans');
globalThis.document = { createElement(name) { if(name==='canvas') return createCanvas(1,1); throw new Error(`Unexpected element ${name}`); } };
const stub = () => ({textContent: '', dataset: {}, style: {setProperty(){}}, hidden: true});
for (const seed of [7319, 18427, 90210]) {
  const world = new World(seed), exploration = new Exploration(world, {storage:null});
  stageExtendedAtlasExploration(exploration);
  const canvas=createCanvas(1600,1600), context=canvas.getContext('2d');
  const view=fitMapBounds({x:0,y:0,width:1600,height:1600,centerX:0,centerY:0,zoom:.17},EXTENDED_ATLAS_BOUNDS,40);
  
  const map=Object.assign(Object.create(WorldMap.prototype), {
    canvas,context,ratio:1,view,world,exploration,zoneLevels:true,tiles:new Map(),player:{x:0,y:0,angle:-Math.PI/2},pointer:null,
    drag:null,hovered:null,portalMarkers:()=>[],campStateReader:()=> 'dormant',eventStateReader:()=>null,title:stub(),status:stub(),discoveries:stub(),coordinates:stub(),tooltip:stub(),
  });
  const start=performance.now();
  map.drawChart();
  const first=performance.now()-start;
  const secondStart=performance.now();map.drawChart();const second=performance.now()-secondStart;
  // Frame identifies this as a direct renderer export, never a browser screenshot.
  const output=createCanvas(1660,1780), c=output.getContext('2d');
  c.fillStyle='#080f16';c.fillRect(0,0,1660,1780);
  text(c,'EVERGROW / GEOGRAPHY & DANGER',30,24,1.55,'#e9e4d3');
  text(c,`WORLD SEED ${seed}`,1630,29,1.15,'#a7c0ae','right');
  c.strokeStyle='#354641';c.lineWidth=1;c.strokeRect(29.5,66.5,1601,1601);
  c.drawImage(canvas,30,67);
  text(c,`${exploration.discoveredPOICount} PLACES CHARTED · GENERATION 5 · 40,000-UNIT SURVEY`,30,1700,1.03,'#9baa9e');
  text(c,'DIRECT CPU MAP RENDER / NO GAMEPLAY',1430,1700,.93,'#73857c','right');
  text(c,'NAMED REGIONS / ROAD-LED PROGRESSION / ! DANGEROUS WILDERNESS',30,1727,1.05,'#e0bd78');
  text(c,'TOWNS ARE SANCTUARIES · NO PLAYER SAVE WAS CHANGED',30,1750,1.05,'#9baa9e');
  const path=resolve(outputDir, `seed-${seed}.png`);
  rendered.push(output);
  writeFileSync(path,output.toBuffer('image/png'));
  console.log(JSON.stringify({seed,path,firstMs:Math.round(first),cachedMs:Math.round(second),cache:map.tiles.size,viewZoom:view.zoom}));
  exploration.dispose();world.dispose();
}

const comparison = createCanvas(1800, 644), summary = comparison.getContext('2d');
summary.fillStyle = '#080f16'; summary.fillRect(0, 0, 1800, 644);
rendered.forEach((canvas, i) => summary.drawImage(canvas, i * 600, 0, 600, 643.4));
writeFileSync(resolve(outputDir, 'comparison.png'), comparison.toBuffer('image/png'));

// The optional native Canvas runtime may retain worker handles after synchronous exports.
process.exit(0);
