// Optional terrain/query CPU benchmark. No browser, gameplay ticks or save access.
import {createRequire} from 'node:module';import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
if (!process.env.CANVAS_MODULE) throw new Error('Set CANVAS_MODULE to an installed @napi-rs/canvas module.');
const {createCanvas}=require(process.env.CANVAS_MODULE);
globalThis.document={createElement:()=>createCanvas(1,1)};
const root=process.env.WORLD_BENCH_SOURCE??new URL('../src/', import.meta.url).pathname;
const {World}=await import(root+'world.ts');const {GroundLayer}=await import(root+'ground-layer.ts');
const stats=a=>{a.sort((a,b)=>a-b);return{median:+a[Math.floor(a.length/2)].toFixed(3),p95:+a[Math.floor(a.length*.95)].toFixed(3),max:+a.at(-1).toFixed(3)}};
const report={};
for(const [width,height] of [[960,600],[1600,900]]){
 const world=new World(7319),layer=new GroundLayer(),canvas=createCanvas(width,height),c=canvas.getContext('2d');let calls=0;
 const original=world.getGroundTile.bind(world);world.getGroundTile=(...args)=>{calls++;return original(...args)};
 const frames=[],requests=[];
 for(let i=0;i<180;i++){const left=2100+i*3,top=1550+i*.9;const n=calls,t=performance.now();c.setTransform(1,0,0,1,-left,-top);layer.draw(c,world,left,top,width,height);c.getImageData(0,0,1,1);if(i){frames.push(performance.now()-t);requests.push(calls-n)}}
 report['ground'+width]={ms:stats(frames),requests:stats(requests),calls};world.dispose();
}
const world=new World(18427);let queried=0;const sites=world.getWildernessSites.bind(world);world.getWildernessSites=(...args)=>{queried++;return sites(...args)};
const samples=[];for(let i=0;i<120;i++){const t=performance.now();world.getProps(2100+i,1500+i*.3,1400,1100);samples.push(performance.now()-t)}report.props={ms:stats(samples),siteQueries:queried};
const collision=[];queried=0;for(let i=0;i<240;i++){const t=performance.now();for(let j=0;j<12;j++)world.blocked(2150+j*35+i*.05,1600+j*9,14);collision.push(performance.now()-t)}report.collision={ms:stats(collision),siteQueries:queried};
console.log(JSON.stringify(report,null,2));if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(report,null,2));process.exit(0);
