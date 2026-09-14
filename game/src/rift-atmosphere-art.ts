import { hash, randomFromSeed, polygon, line, type Point } from './art-primitives.ts';
import type { BiomeId } from './biomes.ts';
import type { World } from './world.ts';
import type { RiftProgress } from './rift-content.ts';
import { RIFT_RULES } from './rift-content.ts';

type View = {left:number; top:number; width:number; height:number};
export const RIFT_ATMOSPHERE = Object.freeze({cell:256, cache:96, visible:56, candidates:12, stormPeriod:6, stormDuration:1.1});
const PALETTES: Record<BiomeId, {edge:string; stone:string; face:string; form:'root'|'ice'|'vein'}> = {
  verdant:{edge:'#c878a6',stone:'#3b4148',face:'#647269',form:'root'},
  deadwood:{edge:'#ac7aaa',stone:'#353643',face:'#66666d',form:'root'},
  swamp:{edge:'#a273bc',stone:'#283f43',face:'#59756e',form:'root'},
  autumn:{edge:'#d58b8d',stone:'#483a43',face:'#897664',form:'root'},
  frostpine:{edge:'#b49be4',stone:'#334c66',face:'#99becb',form:'ice'},
  emberfall:{edge:'#ef986f',stone:'#332b3d',face:'#6c5060',form:'vein'},
  highlands:{edge:'#b09cdc',stone:'#414552',face:'#839080',form:'vein'},
  steppe:{edge:'#c791bb',stone:'#3f3944',face:'#807f6b',form:'root'},
  sunscar:{edge:'#e58ca6',stone:'#56404a',face:'#aa826b',form:'vein'},
};
export interface RiftScar {x:number; y:number; seed:number; biome:BiomeId; points:readonly Point[]; edges:readonly [readonly Point[],readonly Point[]]; float:boolean; size:number}

/** Deterministic slow sky discharge. One event at most, no screen flash. More
 * progress admits more six-second windows without accelerating or restarting a bolt. */
export function riftLightning(seed:number,time:number,progress:number,reduced:boolean):number {
  if(reduced||time<0)return 0;
  const window=Math.floor(time/RIFT_ATMOSPHERE.stormPeriod),random=randomFromSeed(hash(seed^Math.imul(window,7919)^819));
  const chance=.2+.75*Math.max(0,Math.min(1,progress));
  if(random()>chance)return 0;
  const age=time-window*RIFT_ATMOSPHERE.stormPeriod-(.8+random()*2.8);
  return age>0&&age<RIFT_ATMOSPHERE.stormDuration?Math.sin(age/RIFT_ATMOSPHERE.stormDuration*Math.PI)**2:0;
}

/** Presentation-only world-space detail. Candidate work happens when entering a
 * cell, never per monster or per frame. No particles, collision, rewards or lights. */
export class RiftAtmosphereArt {
  private world: World | null = null;
  private cache = new Map<string, RiftScar | null>();
  readonly visible: RiftScar[] = [];
  private time=0;
  private state: RiftProgress | undefined;
  private reduced=false;
  reset(){this.world=null;this.cache.clear();this.visible.length=0;this.state=undefined;}
  get cacheSize(){return this.cache.size;}
  prepare(world:World,view:View,state:RiftProgress|undefined,reduced:boolean){
    if(!state){if(this.world)this.reset();return;}
    if(this.world!==world){this.reset();this.world=world;}
    this.state=state;this.time=state.elapsed;this.reduced=reduced;this.visible.length=0;
    const {cell}=RIFT_ATMOSPHERE;
    const cx=Math.floor((view.left+view.width/2)/cell),cy=Math.floor((view.top+view.height/2)/cell);
    // Camera-centered bounded coverage also protects extreme dev-tool zooms.
    const rx=Math.min(4,Math.ceil(view.width/cell/2)+1),ry=Math.min(4,Math.ceil(view.height/cell/2)+1);
    for(let y=cy-ry;y<=cy+ry;y++)for(let x=cx-rx;x<=cx+rx;x++){
      const key=`${x}:${y}`;
      let scar=this.cache.get(key);
      if(scar===undefined){scar=this.create(world,x,y);this.cache.set(key,scar);}
      else {this.cache.delete(key);this.cache.set(key,scar);}
      if(this.cache.size>RIFT_ATMOSPHERE.cache)this.cache.delete(this.cache.keys().next().value!);
      if(scar&&scar.x+110>=view.left&&scar.x-110<=view.left+view.width&&scar.y+40>=view.top&&scar.y-130<=view.top+view.height&&this.visible.length<RIFT_ATMOSPHERE.visible)this.visible.push(scar);
    }
  }
  private create(world:World,cx:number,cy:number):RiftScar|null {
    const seed=hash(Math.imul(cx,73856093)^Math.imul(cy,19349663)^world.seed^7119),random=randomFromSeed(seed),cell=RIFT_ATMOSPHERE.cell;
    for(let i=0;i<RIFT_ATMOSPHERE.candidates;i++){
      let x=(cx+random())*cell,y=(cy+random())*cell;
      if(world.riftShape){const edge=world.riftShape.distance(x,y);if(edge < -65||edge>100)continue;}
      else {
        // Existing open rifts use the actual scenery as their border vocabulary.
        const prop=world.getProps(cx*cell,cy*cell,cell,cell).find(p=>p.radius>6&&Math.floor(p.x/cell)===cx&&Math.floor(p.y/cell)===cy);
        if(!prop)return null;x=prop.x+22;y=prop.y+12;
      }
      if(world.sampleWater(x,y).coverage>.08||Math.hypot(x,y)<420)continue;
      const angle=random()*Math.PI*2,length=55+random()*65,points:Point[]=[];
      for(let n=0;n<6;n++){
        const d=(n/5-.5)*length,jitter=(random()-.5)*18;
        points.push([x+Math.cos(angle)*d-Math.sin(angle)*jitter,y+Math.sin(angle)*d*.52+Math.cos(angle)*jitter*.52]);
      }
      const edges = [-1,1].map(side=>points.map((point,n):Point=>{
        const width=n===0||n===points.length-1?0:1.6+random()*1.8;
        return [point[0]-Math.sin(angle)*width*side,point[1]+Math.cos(angle)*width*.65*side];
      })) as [Point[],Point[]];
      return {x,y,seed,biome:world.sampleBiome(x,y).id,points,edges,float:random()<.55,size:8+random()*10};
    }
    return null;
  }
  drawGround(c:CanvasRenderingContext2D){
    c.save();c.lineCap='round';c.lineJoin='round';
    for(const scar of this.visible){
      polygon(c,[...scar.edges[0],...[...scar.edges[1]].reverse()],'#160e1bd9');
      for(const edge of scar.edges)line(c,edge,'#6b2f4e',1.3);
      const [a,b,d]=[scar.points[1],scar.points[3],scar.points[5]],palette=PALETTES[scar.biome];
      c.globalAlpha=.55;
      if(palette.form==='root'){
        c.beginPath();c.moveTo(a[0],a[1]);c.quadraticCurveTo(scar.x-20,scar.y-30,b[0]+18,b[1]-15);c.strokeStyle=palette.stone;c.lineWidth=5;c.stroke();
        c.strokeStyle=palette.edge;c.lineWidth=.7;c.stroke();
      }else if(palette.form==='ice'){
        line(c,[a,[b[0]-18,b[1]-24],d],palette.edge,.9);
        polygon(c,[[b[0]-8,b[1]-5],[b[0]+2,b[1]-28],[b[0]+9,b[1]-8]],palette.face);
      }else line(c,[a,[scar.x-12,scar.y+19],b,[d[0]+12,d[1]+9]],palette.edge,1);
      c.globalAlpha=1;
      if(scar.float){c.fillStyle='#10101c70';c.beginPath();c.ellipse(scar.x,scar.y+5,scar.size*1.2,scar.size*.38,0,0,Math.PI*2);c.fill();}
    }
    c.restore();
  }
  drawFragment(c:CanvasRenderingContext2D,scar:RiftScar){
    const palette=PALETTES[scar.biome],s=scar.size;
    const lift=24+(this.reduced?0:Math.sin(this.time*.8+scar.seed)*5);
    c.save();c.translate(scar.x,scar.y-lift);
    polygon(c,[[-s,-s*.35],[-s*.4,-s],[s*.65,-s*.75],[s,0],[0,s*.5]],palette.stone);
    polygon(c,[[-s,-s*.35],[-s*.4,-s],[s*.65,-s*.75],[s*.25,-s*.05]],palette.face);
    line(c,[[-s,-s*.35],[s*.25,-s*.05],[s,0]],palette.edge,.8);
    line(c,[[s*.25,-s*.05],[0,s*.5]],'#d174a6',1);
    // A second small chip makes the suspended cluster read without a halo/ring.
    polygon(c,[[s*1.1,4],[s*1.4,-1],[s*1.6,5],[s*1.3,8]],palette.stone);
    c.restore();
  }
  drawEmission(c:CanvasRenderingContext2D,view:View){
    if(!this.state||!this.world)return;
    c.save();c.lineCap='round';c.lineJoin='round';c.globalCompositeOperation='screen';
    const settled=this.state.phase==='complete'||this.state.phase==='failed';
    for(const scar of this.visible){
      const pulse=this.reduced?.55:.55+.2*Math.sin(this.time*.65+scar.seed);
      c.globalAlpha=pulse*(settled?.4:1);
      for(const edge of scar.edges){
        c.globalAlpha=pulse*(settled?.2:.5);line(c,edge,'#b33d75',3.5);
        c.globalAlpha=pulse*(settled?.4:1);line(c,edge,'#e07aa6',.6);
      }
    }
    const progress=this.state.points/RIFT_RULES.progress;
    const envelope=this.state.phase==='hunt'?riftLightning(this.world.seed,this.time,progress,this.reduced):0;
    if(envelope){
      const random=randomFromSeed(hash(this.world.seed^Math.imul(Math.floor(this.time/RIFT_ATMOSPHERE.stormPeriod),7919)^928));
      const x=view.left+view.width*(.16+random()*.68),y=view.top+view.height*.08,h=Math.min(150,view.height*.21),points:Point[]=[];
      for(let n=0;n<8;n++)points.push([x+(random()-.5)*27,y+h*n/7]);
      c.globalAlpha=envelope*.45;line(c,points,'#6d48aa',10);
      c.globalAlpha=envelope*.65;line(c,points,'#b09ae0',1.3);
      line(c,[points[3],[points[3][0]+24,points[3][1]+9],[points[3][0]+34,points[3][1]+26]],'#9678c6',.65);
    }
    c.restore();
  }
}
