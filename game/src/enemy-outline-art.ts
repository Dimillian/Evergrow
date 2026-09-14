/** One reusable sprite and mask. Paint the rig once, then rim its actual silhouette. */
export class EnemyOutlineArt {
 private sprite=document.createElement('canvas');
 private mask=document.createElement('canvas');
 private art:CanvasRenderingContext2D;
 private tint:CanvasRenderingContext2D;
 constructor(){
  for(const canvas of [this.sprite,this.mask]){canvas.width=640;canvas.height=600;}
  this.art=this.sprite.getContext('2d')!;this.tint=this.mask.getContext('2d')!;
 }
 draw(c:CanvasRenderingContext2D,color:string,paint:(target:CanvasRenderingContext2D)=>void):void {
  const a=this.art,m=this.tint;
  a.setTransform(1,0,0,1,0,0);a.clearRect(0,0,640,600);
  a.save();a.translate(320,440);a.scale(2,2);paint(a);a.restore();
  m.clearRect(0,0,640,600);m.drawImage(this.sprite,0,0);
  m.globalCompositeOperation='source-in';m.fillStyle=color;m.fillRect(0,0,640,600);m.globalCompositeOperation='source-over';
  c.save();c.globalAlpha*=.75;c.shadowColor=color;c.shadowBlur=8;
  c.drawImage(this.mask,-160,-220,320,300);c.shadowBlur=0;
  // A narrow colored rim survives the ambient light pass without a floating badge.
  c.globalAlpha*=.65;
  for(const [x,y] of [[-.7,0],[.7,0],[0,-.7],[0,.7]])c.drawImage(this.mask,-160+x,-220+y,320,300);
  c.restore();c.drawImage(this.sprite,-160,-220,320,300);
 }
}
