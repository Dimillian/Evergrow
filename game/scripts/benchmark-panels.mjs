// Optional CPU benchmark of real Canvas panels. No browser, gameplay ticks or save access.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
if (!process.env.CANVAS_MODULE) throw new Error('Set CANVAS_MODULE to an installed @napi-rs/canvas module.');
const {createCanvas,GlobalFonts,Path2D}=require(process.env.CANVAS_MODULE);
globalThis.Path2D=Path2D;
const root=new URL('../', import.meta.url).pathname;
GlobalFonts.registerFromPath(root+'src/assets/fonts/PixelifySans-Variable.ttf','Pixelify Sans');
GlobalFonts.registerFromPath(root+'src/assets/fonts/Barlow-Medium.ttf','Evergrow Numerals');
globalThis.document={createElement:()=>createCanvas(1,1)};
const {World}=await import(root+'src/world.ts');
const {Exploration}=await import(root+'src/exploration.ts');
const {WorldMap}=await import(root+'src/world-map.ts');
const {drawSkillAtlas,drawSkillAtlasTooltip}=await import(root+'src/skill-tree-art.ts');
const {SKILL_TREE_ORIGIN}=await import(root+'src/skill-tree.ts');
const {stageAtlasExploration}=await import(root+'src/atlas-review-data.ts');
const world=new World(18427),exploration=new Exploration(world,{storage:null});
stageAtlasExploration(exploration,18427);
const stub=()=>({textContent:'',dataset:{},style:{setProperty(){}},hidden:true});
const canvas=createCanvas(1000,700),context=canvas.getContext('2d');
const map=Object.assign(Object.create(WorldMap.prototype),{canvas,context,ratio:1,view:{x:0,y:0,width:1000,height:700,centerX:0,centerY:0,zoom:.05},world,exploration,zoneLevels:true,tiles:new Map(),player:{x:0,y:0,angle:0},pointer:null,drag:null,hovered:null,portalMarkers:()=>[],campStateReader:()=> 'dormant',eventStateReader:()=>null,status:stub(),discoveries:stub(),coordinates:stub(),tooltip:stub()});
const report={};
if(process.env.PANEL_CAPTURE_DIR) {
  map.buildBudget=0; map.pendingTerrain=false; map.drawChart(); map.buildBudget=undefined;
  writeFileSync(`${process.env.PANEL_CAPTURE_DIR}/map-preview.png`,canvas.toBuffer('image/png'));
}
let queued;
globalThis.requestAnimationFrame = callback => { queued = callback; return 1; };
globalThis.cancelAnimationFrame = () => { queued = undefined; };
if (process.argv.includes('--progressive')) {
  Object.assign(map,{opened:true,disposed:false,frame:0,chartDirty:false});
  const samples=[];
  const run = () => { const start=performance.now(); map.render(); samples.push(performance.now()-start); };
  run();
  while(queued && samples.length < 3000) { queued=undefined; run(); }
  if(queued) throw new Error('Progressive chart did not finish');
  samples.sort((a,b)=>a-b);
  report.progressive = { frames:samples.length,medianMs:samples[Math.floor(samples.length/2)],p95Ms:samples[Math.floor(samples.length*.95)],maxMs:samples.at(-1) };
}
function measure(name,fn,n=24){const samples=[];for(let i=0;i<n;i++){const t=performance.now();fn(i);samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);report[name]={medianMs:+samples[Math.floor(n/2)].toFixed(2),p95Ms:+samples[Math.floor(n*.95)].toFixed(2)};}
measure(process.argv.includes('--progressive') ? 'mapSettled' : 'mapCold',()=>map.drawChart(),1);
measure('mapWarm',()=>map.drawChart());
measure('mapPan',i=>{map.view.centerX=i*8;map.drawChart();});
measure('mapZoom',i=>{map.view.zoom=.048+i*.00008;map.drawChart();});
if(process.env.PANEL_CAPTURE_DIR) writeFileSync(`${process.env.PANEL_CAPTURE_DIR}/map.png`,canvas.toBuffer('image/png'));
for(const zoom of [.12,.8]){const view={width:1000,height:700,zoom,centerX:0,centerY:0,allocated:new Set([SKILL_TREE_ORIGIN]),reachable:new Set(),selected:SKILL_TREE_ORIGIN,hovered:null,route:[],matches:()=>true};drawSkillAtlas(context,view);measure('tree'+zoom,()=>drawSkillAtlas(context,view));
const layer=createCanvas(1000,700),base=layer.getContext('2d');
const hover={...view,hovered:SKILL_TREE_ORIGIN,tooltip:{id:SKILL_TREE_ORIGIN,opacity:.7,lift:1}};
drawSkillAtlas(base,hover,false);
measure('treeTooltipFull'+zoom,()=>drawSkillAtlas(context,hover));
measure('treeTooltipRetained'+zoom,()=>{context.clearRect(0,0,1000,700);context.drawImage(layer,0,0);drawSkillAtlasTooltip(context,hover);});
const retained=context.getImageData(0,0,1000,700).data;
drawSkillAtlas(context,hover);
const direct=context.getImageData(0,0,1000,700).data;
let difference=0;for(let i=0;i<direct.length;i++) difference=Math.max(difference,Math.abs(direct[i]-retained[i]));
if(difference > 1) throw new Error(`Tooltip layer changed pixels by ${difference}`);
if(process.env.PANEL_CAPTURE_DIR) writeFileSync(`${process.env.PANEL_CAPTURE_DIR}/tree-${zoom}.png`,canvas.toBuffer('image/png'));}
console.log(JSON.stringify(report,null,2));
if(process.argv[2] && !process.argv[2].startsWith('--')) writeFileSync(process.argv[2],JSON.stringify(report,null,2));
process.exit(0);
