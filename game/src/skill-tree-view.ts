import { SKILL_TREE, type SkillNode } from './skill-tree.ts';

export interface AtlasBounds { minX:number; minY:number; maxX:number; maxY:number; }
export function boundsForNodes(nodes:readonly SkillNode[], padding=180):AtlasBounds {
  if(!nodes.length)return SKILL_TREE.bounds;
  return {minX:Math.min(...nodes.map(n=>n.x))-padding,minY:Math.min(...nodes.map(n=>n.y))-padding,
    maxX:Math.max(...nodes.map(n=>n.x))+padding,maxY:Math.max(...nodes.map(n=>n.y))+padding};
}
export function fitAtlasBounds(bounds:AtlasBounds,width:number,height:number) {
  return {centerX:(bounds.minX+bounds.maxX)/2,centerY:(bounds.minY+bounds.maxY)/2,
    zoom:Math.max(.005,Math.min(Math.max(1,width-80)/(bounds.maxX-bounds.minX),Math.max(1,height-140)/(bounds.maxY-bounds.minY)))};
}
/** Letterboxing uses one scale in both directions, so the navigator never distorts the tree. */
export function atlasNavigatorProjection(width:number,height:number) {
  const b=SKILL_TREE.bounds,scale=Math.min((width-12)/(b.maxX-b.minX),(height-12)/(b.maxY-b.minY));
  const offsetX=(width-(b.maxX-b.minX)*scale)/2-b.minX*scale;
  const offsetY=(height-(b.maxY-b.minY)*scale)/2-b.minY*scale;
  return {scale,offsetX,offsetY,toWorld:(x:number,y:number)=>({x:(x-offsetX)/scale,y:(y-offsetY)/scale})};
}
