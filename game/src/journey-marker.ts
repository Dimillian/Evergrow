import { mapIconVisible, type MapIconVisibility } from './map-legend-content.ts';
import { projectMapPoint, type MapView } from './map-view.ts';
import type { JourneyGoal } from './journey-state.ts';
import { drawMapSymbol } from './map-symbol-art.ts';
export interface JourneyMarker { x:number;y:number;known:boolean;name:string; }
export function publicJourneyMarker(goal:JourneyGoal,discovered:boolean):JourneyMarker {
  discovered ||= goal.kind==='town';
  return {x:discovered?goal.x:(Math.floor(goal.x/768)+.5)*768,y:discovered?goal.y:(Math.floor(goal.y/768)+.5)*768,known:discovered,name:discovered?goal.name:'Search area'};
}
export function drawJourneyDestination(c:CanvasRenderingContext2D,x:number,y:number,size=7){
  c.save();c.translate(x,y);c.fillStyle='#10202a';c.beginPath();c.arc(0,0,size+2,0,Math.PI*2);c.fill();
  drawMapSymbol(c,'destination',size,'#ead7a1','#10202a');c.restore();
}
export function drawJourneyMapMarker(c:CanvasRenderingContext2D,view:MapView,marker:JourneyMarker|null,edge:boolean,visibility?:MapIconVisibility){
  if(!marker || !mapIconVisible(visibility, marker.known ? 'journey:destination' : 'journey:search'))return;
  const p=projectMapPoint(marker.x,marker.y,view),cx=view.x+view.width/2,cy=view.y+view.height/2;
  const dx=p.x-cx,dy=p.y-cy,scale=Math.min(1,(view.width/2-11)/Math.max(1,Math.abs(dx)),(view.height/2-11)/Math.max(1,Math.abs(dy)));
  if(!edge&&scale<1&&!marker.known){/* The clipped search circle may still intersect this view. */}
  else if(!edge&&scale<1&&marker.known)return;
  const x=edge?cx+dx*scale:p.x,y=edge?cy+dy*scale:p.y;
  c.save();c.beginPath();c.rect(view.x+1,view.y+1,view.width-2,view.height-2);c.clip();
  if(!marker.known){c.strokeStyle='#decb8b8c';c.fillStyle='#decb8b09';c.lineWidth=1;c.setLineDash([3,5]);c.beginPath();c.arc(x,y,edge?12:Math.max(16,540*view.zoom),0,Math.PI*2);c.fill();c.stroke();c.setLineDash([]);}
  if(edge&&scale<1){c.translate(x,y);c.rotate(Math.atan2(dy,dx));drawMapSymbol(c,'direction',7,'#e3cf91','#10202a');}
  else if(marker.known)drawJourneyDestination(c,x,y,edge?6:9);
  else {c.translate(x,y);c.fillStyle='#10202a';c.beginPath();c.arc(0,0,10,0,Math.PI*2);c.fill();drawMapSymbol(c,'search',edge?6:9,'#ead7a1','#10202a');}
  c.restore();
}
