import { layoutAtlasCaptions, skillNodeScreenRadius, type AtlasCaption, type AtlasLabelBox } from './skill-tree-labels.ts';
export { skillNodeRadius, skillNodeScreenRadius } from './skill-tree-labels.ts';
import { learnedSkillRank, maximumSkillRank } from './skill-progression.ts';
import { SKILL_TERRITORIES, SKILL_TREE, SKILL_NODES, type SkillNode } from './skill-tree.ts';
import { skillNodeOwner } from './skill-node-presentation.ts';
import { drawSkillGlyph } from './skill-tree-glyphs.ts';
import type { CharacterSheet } from './character-types.ts';
import { UI_THEME } from './ui-theme.ts';
import { drawAtlasSearchMarkers } from './skill-tree-search-art.ts';

export const SKILL_DOMAIN_COLORS = { Might: '#e5b881', Cunning: '#8bd5b9', Arcana: '#b9b4ee' } as const;
export interface SkillAtlasView {
  width: number; height: number; zoom: number; centerX: number; centerY: number;
  allocated: ReadonlySet<string>; reachable: ReadonlySet<string>; sheet?: CharacterSheet;
  selected: string; hovered: string | null; route: readonly string[];
  labelExclusions?: readonly AtlasLabelBox[];
  filterActive?: boolean;
  matches(node: SkillNode): boolean;
}
const TAU = Math.PI * 2;
const edges = SKILL_TREE.edges.map(edge => ({ ...edge, a: SKILL_NODES.get(edge.from)!, b: SKILL_NODES.get(edge.to)! }));
const edgeKey = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`;
const territoryColors = new Map(SKILL_TERRITORIES.map(t => [t.id, t.color]));
const regions = SKILL_TERRITORIES.map(t => {
  const members = SKILL_TREE.nodes.filter(n => n.territory === t.id);
  return { ...t, x: members.reduce((s,n) => s+n.x,0)/members.length, y: members.reduce((s,n) => s+n.y,0)/members.length };
});
const orderedNodes = [...SKILL_TREE.nodes].sort((a,b) =>
  Number(a.kind === 'major' || a.kind === 'origin') - Number(b.kind === 'major' || b.kind === 'origin'));
const circle = (c: CanvasRenderingContext2D, x:number, y:number, radius:number) => { c.beginPath(); c.arc(x,y,radius,0,TAU); };

/** Cached luminous glass map. Every stroke uses the same world projection and shared geometry. */
export function drawSkillAtlas(c: CanvasRenderingContext2D, view: SkillAtlasView): AtlasCaption[] {
  const { width:w, height:h, zoom:z } = view;
  const sx = (x:number) => (x-view.centerX)*z+w/2;
  const sy = (y:number) => (y-view.centerY)*z+h/2;
  c.clearRect(0,0,w,h);
  const base = c.createLinearGradient(0,0,w,h);
  base.addColorStop(0,'#101b29'); base.addColorStop(.5,'#091b24'); base.addColorStop(1,'#151b2b');
  c.fillStyle=base; c.fillRect(0,0,w,h);
  // Broad colored light behind frosted glass supplies geography even before labels resolve.
  for (const t of regions) {
    const x=sx(t.x),y=sy(t.y),r=Math.max(210,1750*z);
    const haze=c.createRadialGradient(x,y,0,x,y,r);
    haze.addColorStop(0,t.color+'26'); haze.addColorStop(.42,t.color+'13'); haze.addColorStop(1,t.color+'00');
    c.fillStyle=haze;c.fillRect(x-r,y-r,r*2,r*2);
  }
  // Fixed world-space pinpricks and fine compass arcs, never a moving layer over the graph.
  const grid=180;
  const minX=Math.floor((view.centerX-w/2/z)/grid),maxX=Math.ceil((view.centerX+w/2/z)/grid);
  const minY=Math.floor((view.centerY-h/2/z)/grid),maxY=Math.ceil((view.centerY+h/2/z)/grid);
  if(z>.08)for(let ix=minX;ix<=maxX;ix++)for(let iy=minY;iy<=maxY;iy++){
    const seed=Math.sin(ix*127.1+iy*311.7)*43758.5453,noise=seed-Math.floor(seed);
    const x=sx((ix+noise*.6)*grid),y=sy((iy+noise*.3)*grid);
    c.fillStyle=noise>.8?'#c5e7ef30':'#9bc7d713';circle(c,x,y,noise>.8?.8:.5);c.fill();
  }
  for(let i=0;i<3;i++){
    c.strokeStyle='#b1d6e509';c.lineWidth=.8;
    circle(c,sx(0),sy(0),(850+i*850)*z);c.stroke();
  }
  for(const cluster of SKILL_TREE.clusters){
    if(cluster.id.startsWith('development:'))continue;
    const x=sx(cluster.x),y=sy(cluster.y),r=(cluster.radius+38)*z;
    if(x+r<0||x-r>w||y+r<0||y-r>h)continue;
    const color=territoryColors.get(cluster.territory??'')??SKILL_DOMAIN_COLORS[cluster.domain];
    const halo=c.createRadialGradient(x,y,0,x,y,Math.max(1,r));
    halo.addColorStop(0,color+'0d');halo.addColorStop(.7,color+'06');halo.addColorStop(1,color+'00');
    c.fillStyle=halo;c.fillRect(x-r,y-r,r*2,r*2);
  }
  const routeEdges=new Set(view.route.slice(1).map((id,i)=>edgeKey(id,view.route[i])));
  const routeNodes=new Set(view.route);
  const focusedNode=SKILL_NODES.get(view.hovered??view.selected);
  const focusedSkill=focusedNode&&skillNodeOwner(focusedNode)?.id;
  c.lineCap='round'; c.lineJoin='round';
  for(const {a,b,control} of edges){
    const ax=sx(a.x),ay=sy(a.y),bx=sx(b.x),by=sy(b.y);
    const cx=control?sx(control.x):(ax+bx)/2,cy=control?sy(control.y):(ay+by)/2;
    if(Math.max(ax,bx,cx)<-16||Math.min(ax,bx,cx)>w+16||Math.max(ay,by,cy)<-16||Math.min(ay,by,cy)>h+16)continue;
    const owned=view.allocated.has(a.id)&&view.allocated.has(b.id),route=routeEdges.has(edgeKey(a.id,b.id));
    const family=focusedSkill&&(a.developmentSkill===focusedSkill||b.developmentSkill===focusedSkill);
    const road=(a.role==='travel'||a.kind==='origin')&&(b.role==='travel'||b.kind==='origin');
    const sameCluster=a.cluster&&a.cluster===b.cluster;
    const color=territoryColors.get(a.territory??'')??SKILL_DOMAIN_COLORS[a.domain];
    c.globalAlpha=view.filterActive?(view.matches(a)&&view.matches(b)?.65:view.matches(a)||view.matches(b)?.28:owned||route?.2:.07):1;
    c.beginPath();c.moveTo(ax,ay);c.quadraticCurveTo(cx,cy,bx,by);
    c.strokeStyle='#08131f99';c.lineWidth=Math.max(1.6,3*Math.sqrt(z));c.stroke();
    if(owned||route||road){
      c.strokeStyle=owned?'#ffd89928':route?'#81ddff25':color+'0c';
      c.lineWidth=Math.max(3,(owned||route?9:6)*Math.sqrt(z));c.stroke();
    }
    c.strokeStyle=owned?'#ffdc9c':route?'#99e4ff':family?color:color+(road?'b5':sameCluster?'a0':z<.22?'65':'9a');
    c.lineWidth=owned||route?Math.max(1.3,1.9*Math.sqrt(z)):road?Math.max(.8,1.15*Math.sqrt(z)):Math.max(.55,.9*Math.sqrt(z));
    c.stroke();
  }
  c.globalAlpha=1;
  for(const node of orderedNodes){
    const x=sx(node.x),y=sy(node.y),r=skillNodeScreenRadius(node,z);
    if(x<-r-20||x>w+r+20||y<-r-20||y>h+r+20)continue;
    const owned=view.allocated.has(node.id),reachable=view.reachable.has(node.id);
    const selected=view.selected===node.id,hover=view.hovered===node.id;
    const landmark=node.kind==='major'||node.kind==='origin',notable=node.kind==='notable';
    const color=territoryColors.get(node.territory??'')??SKILL_DOMAIN_COLORS[node.domain];
    const accent=owned?'#ffdb96':routeNodes.has(node.id)?'#9ce9ff':color;
    c.globalAlpha=view.filterActive?(view.matches(node)?1:selected||hover?.6:routeNodes.has(node.id)?.3:.09):1;
    if(landmark||owned||selected||hover||notable&&z>.3){
      const bloom=c.createRadialGradient(x,y,r*.3,x,y,r*(landmark?3.8:2.6));
      bloom.addColorStop(0,accent+(owned||hover?'65':landmark?'40':'24'));bloom.addColorStop(1,accent+'00');
      c.fillStyle=bloom;c.fillRect(x-r*4,y-r*4,r*8,r*8);
    }
    if(r<2.5){
      circle(c,x,y,r);c.fillStyle=owned?'#ffe4b3':node.role==='travel'?color+'c0':color;c.fill();
      continue;
    }
    // Every node is a polished circular lens. Role comes from scale, concentric rims and engraving.
    const lens=c.createLinearGradient(x-r,y-r,x+r,y+r);
    lens.addColorStop(0,owned?'#6a5940':'#3c505e');lens.addColorStop(.35,owned?'#3f352b':'#182d3d');lens.addColorStop(1,'#091621');
    circle(c,x,y,r);c.fillStyle=lens;c.fill();
    c.strokeStyle=owned?'#ffe1a7':reachable?'#e3ecdf':accent+(landmark?'ef':notable?'c0':'91');
    c.lineWidth=landmark?1.35:notable?1:.8;c.stroke();
    if((landmark||notable)&&r>5){
      circle(c,x,y,r-2.5);c.strokeStyle=accent+'43';c.lineWidth=.65;c.stroke();
      c.beginPath();c.arc(x,y,r-.9,Math.PI*1.1,Math.PI*1.7);c.strokeStyle='#e7f9ff77';c.lineWidth=.9;c.stroke();
    }
    if(node.keystone&&r>6){
      // A radial seal, never an angular frame.
      for(let i=0;i<8;i++){const a=i*TAU/8; c.beginPath();c.arc(x,y,r+3,a+.12,a+.47);c.strokeStyle=accent+'b0';c.stroke();}
    }else if(node.doctrine&&r>5){
      for(let i=0;i<3;i++){const a=-Math.PI/2+(i-1)*.5;circle(c,x+Math.cos(a)*(r+3),y+Math.sin(a)*(r+3),1);c.fillStyle=accent;c.fill();}
    }else if(node.skill&&r>5){
      c.beginPath();c.arc(x,y,r+3,.2,Math.PI-.2);c.arc(x,y,r+3,Math.PI+.2,TAU-.2);c.strokeStyle=accent+'80';c.lineWidth=.8;c.stroke();
    }
    if(r>=6)drawSkillGlyph(c,node,x,y,r*(landmark?1.18:1.25),owned?'#ffebbf':accent);
    else{circle(c,x,y,r*.3);c.fillStyle=accent;c.fill();}
    if(selected||hover){
      const gap=Math.min(6,2+z*4);circle(c,x,y,r+gap);c.strokeStyle=selected?'#ffe4b0':'#dbf5ff';c.lineWidth=1;c.stroke();
    }
  }
  c.globalAlpha=1;
  drawAtlasSearchMarkers(c, view);
  const captions=layoutAtlasCaptions(view,(text,size)=>{
    c.font=`${size}px ${UI_THEME.typography.font}`;return c.measureText(text).width;
  },node=>view.sheet&&z>=.6&&node.skill&&view.allocated.has(node.id)
    ?`${learnedSkillRank(view.sheet,node.skill)}/${maximumSkillRank(view.sheet,node.skill)}`:undefined);
  for(const label of captions){
    c.font=`${label.size}px ${UI_THEME.typography.font}`;
    c.beginPath();c.roundRect(label.x,label.y,label.width,label.height,6);c.fillStyle='#091925ef';c.fill();
    c.textAlign='center';c.textBaseline='top';c.fillStyle=label.color;
    c.shadowColor='#07111f';c.shadowBlur=5;c.fillText(label.text,label.x+label.width/2,label.y+4);c.shadowBlur=0;
  }
  return captions;
}
