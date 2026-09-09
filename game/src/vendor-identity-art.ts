import { vendorIdentity } from './vendor-identity.ts';
export function drawVendorGlyph(c:CanvasRenderingContext2D,kind:string,x:number,y:number,size=20){
 const identity=vendorIdentity(kind);if(!identity)return;
 c.save();c.translate(x,y);c.scale(size/20,size/20);c.strokeStyle=identity.color;c.lineWidth=1.6;c.lineJoin='miter';c.lineCap='square';
 for(const path of identity.paths){c.beginPath();const tokens=path.match(/[MLZ]|-?\d+/g)!;let i=0;while(i<tokens.length){const op=tokens[i++];if(op==='Z'){c.closePath();continue;}const px=Number(tokens[i++]),py=Number(tokens[i++]);if(op==='M')c.moveTo(px,py);else c.lineTo(px,py);}c.stroke();}c.restore();
}
