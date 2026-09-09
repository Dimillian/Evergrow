import type { PointLight } from './lighting.ts';
import { DEFAULT_GEAR_LIGHT, type GearLight } from './gear-material.ts';
/** One bounded, smoothly weighted material light per actor, using the existing scene budget. */
export function sampleGearLight(x:number,y:number,lights:readonly PointLight[], key: GearLight = DEFAULT_GEAR_LIGHT):GearLight {
  const packedKey = Number.parseInt(key.color.slice(1), 16), ambient = .5 * key.power;
  let dx=key.direction[0]*ambient,dy=key.direction[1]*ambient,dz=key.direction[2]*ambient,weight=ambient,
    red=((packedKey>>>16)&255)*ambient,green=((packedKey>>>8)&255)*ambient,blue=(packedKey&255)*ambient,total=0;
  for(const light of lights.slice(0,18)) {
    if(light.radius<=0||light.power<=0)continue;
    const lx=light.x-x,ly=light.y-y,distance=Math.hypot(lx,ly);
    if(distance>=light.radius)continue;
    if(light.clip?.length) {
      let inside=false;
      for(let i=0,j=light.clip.length-1;i<light.clip.length;j=i++) {
        const a=light.clip[i],b=light.clip[j];
        if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
      }
      if(!inside)continue;
    }
    const w=Math.min(1.5,light.power)*(1-distance/light.radius)**2;
    const height=Math.max(25,light.radius*.25),length=Math.hypot(lx,ly,height);
    dx+=lx/length*w;dy+=ly/length*w;dz+=height/length*w;weight+=w;total+=w;
    const packed=Number.parseInt(light.color.slice(1),16);
    red+=((packed>>>16)&255)*w;green+=((packed>>>8)&255)*w;blue+=(packed&255)*w;
  }
  if(!total)return key;
  return {direction:[dx/weight,dy/weight,dz/weight],color:`rgb(${Math.round(red/weight)},${Math.round(green/weight)},${Math.round(blue/weight)})`,power:Math.min(1.5,key.power+total*.5)};
}
