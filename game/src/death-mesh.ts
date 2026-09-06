import { polygon, line, mixColor, type Point } from './art-primitives.ts';
import { at, vadd, vsub, vmul, vunit, vcross, type Vec3, type Frame3 } from './death-rig.ts';

/** Small procedural volumes, sorted by camera depth. No image shear or squash. */
export class DeathMesh {
  private readonly faces: { points: Vec3[]; color: string; width: number; depth: number }[]=[];
  private readonly facing: number;
  private readonly scale: number;
  constructor(facing: number, scale: number) { this.facing=facing;this.scale=scale; }
  private world(v: Vec3): Vec3 {
    const a=this.facing,cs=Math.cos(a),sn=Math.sin(a);
    return [(v[0]*sn+v[1]*cs)*this.scale,(-v[0]*cs+v[1]*sn)*this.scale,Math.max(.05,v[2])*this.scale];
  }
  face(points: readonly Vec3[],color: string,width=0): void {
    if(width&&points.length>2) {
      for(let i=1;i<points.length;i++)this.face([points[i-1],points[i]],color,width);
      return;
    }
    const vertices=points.map(v=>this.world(v));
    const depth=vertices.reduce((sum,v)=>sum+v[1]+v[2]*.55,0)/vertices.length;
    this.faces.push({points:vertices,color,width:width*this.scale,depth});
  }
  /** Extrude an authored silhouette through depth, retaining side/top surfaces. */
  solid(frame: Frame3,outline: readonly Point[],depth: number,color: string): void {
    const back=outline.map(([x,z])=>at(frame,x,-depth/2,z));
    const front=outline.map(([x,z])=>at(frame,x,depth/2,z));
    // Lift the complete rigid part if it would penetrate the floor.
    const lift=Math.max(0,.1-Math.min(...back.map(v=>v[2]),...front.map(v=>v[2])));
    const b=back.map(v=>vadd(v,[0,0,lift])),f=front.map(v=>vadd(v,[0,0,lift]));
    this.face(b,mixColor(color,'#091912',.3));this.face(f,color);
    // Short depth spans keep raised ribs/trim in front of their own surface.
    const slices=Math.max(1,Math.ceil(depth/2.5));
    for(let i=0;i<outline.length;i++)for(let s=0;s<slices;s++) {
      const j=(i+1)%outline.length,lo=s/slices,hi=(s+1)/slices;
      const slice=(index:number,t:number)=>vadd(b[index],vmul(vsub(f[index],b[index]),t));
      this.face([slice(i,lo),slice(j,lo),slice(j,hi),slice(i,hi)],mixColor(color,i%3===0?'#e3d8b2':'#12281e',i%3===0?.16:.2));
    }
  }
  bone(start: Vec3,end: Vec3,width: number,tip: number,color: string): void {
    const axis=vunit(vsub(end,start));
    const right=vunit(vcross(axis,Math.abs(axis[2])<.9?[0,0,1]:[0,1,0]));
    const front=vcross(axis,right);
    const ring=(center:Vec3,r:number)=>[0,1,2,3,4,5].map(i=>vadd(center,vadd(vmul(right,Math.cos(i*Math.PI/3)*r/2),vmul(front,Math.sin(i*Math.PI/3)*r/2))));
    const a=ring(start,width),b=ring(end,tip);
    for(let i=0;i<6;i++) this.face([a[i],a[(i+1)%6],b[(i+1)%6],b[i]],mixColor(color,i<3?'#e0d4ac':'#14281e',i<3?.12:.22));
    this.face(b,color);
  }
  draw(c: CanvasRenderingContext2D): void {
    const project=(v:Vec3):Point=>[v[0],v[1]*.55-v[2]];
    this.faces.sort((a,b)=>a.depth-b.depth);
    for(const f of this.faces) {
      if(f.width) line(c,f.points.map(project),f.color,f.width);
      else polygon(c,f.points.map(project),f.color);
    }
  }
}
