import { ENEMY_BODY_BOUNDS } from './enemy-body.ts';
import type { EnemyKind } from './model.ts';
interface OutlineSurface {
 sprite:HTMLCanvasElement;mask:HTMLCanvasElement;
 art:CanvasRenderingContext2D;tint:CanvasRenderingContext2D;
 x:number;y:number;width:number;height:number;
}
/** Small reusable surfaces per authored body, never a full-screen silhouette pass. */
export class EnemyOutlineArt {
 private surfaces=new Map<EnemyKind,OutlineSurface>();
 private surface(kind:EnemyKind):OutlineSurface {
  const cached=this.surfaces.get(kind);if(cached)return cached;
  // Include held weapons and animated limbs beyond the aiming silhouette.
  const body=ENEMY_BODY_BOUNDS[kind],x=-Math.ceil(body.radiusX+52),y=Math.floor(body.top-36);
  const width=-x*2,height=Math.ceil(body.bottom+36-y);
  const sprite=document.createElement('canvas'),mask=document.createElement('canvas');
  for(const canvas of [sprite,mask]){canvas.width=width*2;canvas.height=height*2;}
  const result={sprite,mask,art:sprite.getContext('2d')!,tint:mask.getContext('2d')!,x,y,width,height};
  this.surfaces.set(kind,result);return result;
 }
 draw(c:CanvasRenderingContext2D,kind:EnemyKind,color:string,paint:(target:CanvasRenderingContext2D)=>void):void {
  const s=this.surface(kind),{art:a,tint:m,sprite,mask,x,y,width,height}=s;
  a.clearRect(0,0,sprite.width,sprite.height);
  a.save();a.scale(2,2);a.translate(-x,-y);paint(a);a.restore();
  m.clearRect(0,0,mask.width,mask.height);m.drawImage(sprite,0,0);
  m.globalCompositeOperation='source-in';m.fillStyle=color;m.fillRect(0,0,mask.width,mask.height);m.globalCompositeOperation='source-over';
  c.save();c.globalAlpha*=.75;c.shadowColor=color;c.shadowBlur=8;
  c.drawImage(mask,x,y,width,height);c.shadowBlur=0;c.globalAlpha*=.65;
  for(const [dx,dy] of [[-.7,0],[.7,0],[0,-.7],[0,.7]])c.drawImage(mask,x+dx,y+dy,width,height);
  c.restore();c.drawImage(sprite,x,y,width,height);
 }
}
