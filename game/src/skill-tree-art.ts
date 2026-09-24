import { layoutAtlasCaptions, skillNodeScreenRadius, type AtlasCaption, type AtlasLabelBox } from './skill-tree-labels.ts';
export { skillNodeRadius, skillNodeScreenRadius } from './skill-tree-labels.ts';
import { learnedSkillRank, maximumSkillRank } from './skill-progression.ts';
import { SKILL_TERRITORIES, SKILL_TREE, SKILL_NODES, type SkillNode } from './skill-tree.ts';
import { drawSkillGlyph } from './skill-tree-glyphs.ts';
import type { CharacterSheet } from './character-types.ts';
import { UI_THEME } from './ui-theme.ts';
import { drawAtlasSearchMarkers } from './skill-tree-search-art.ts';

export const SKILL_DOMAIN_COLORS = { Might: '#e5b881', Cunning: '#8bd5b9', Arcana: '#b9b4ee' } as const;
export interface SkillAtlasView {
  width: number; height: number; zoom: number; centerX: number; centerY: number;
  allocated: ReadonlySet<string>; reachable: ReadonlySet<string>; sheet?: CharacterSheet;
  selected: string | null; hovered: string | null; route: readonly string[];
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
  // Quiet territory tint retains geography; only invested nodes and preview routes emit light.
  for (const t of regions) {
    const x=sx(t.x),y=sy(t.y),r=Math.max(210,1750*z);
    const haze=c.createRadialGradient(x,y,0,x,y,r);
    haze.addColorStop(0,t.color+'0b'); haze.addColorStop(.42,t.color+'05'); haze.addColorStop(1,t.color+'00');
    c.fillStyle=haze;c.fillRect(x-r,y-r,r*2,r*2);
  }
  // Fixed world-space pinpricks and fine compass arcs, never a moving layer over the graph.
  const grid=180;
  const minX=Math.floor((view.centerX-w/2/z)/grid),maxX=Math.ceil((view.centerX+w/2/z)/grid);
  const minY=Math.floor((view.centerY-h/2/z)/grid),maxY=Math.ceil((view.centerY+h/2/z)/grid);
  if(z>.08)for(let ix=minX;ix<=maxX;ix++)for(let iy=minY;iy<=maxY;iy++){
    const seed=Math.sin(ix*127.1+iy*311.7)*43758.5453,noise=seed-Math.floor(seed);
    const x=sx((ix+noise*.6)*grid),y=sy((iy+noise*.3)*grid);
    c.fillStyle=noise>.8?'#c5e7ef15':'#9bc7d709';circle(c,x,y,noise>.8?.8:.5);c.fill();
  }
  for(let i=0;i<3;i++){
    c.strokeStyle='#b1d6e509';c.lineWidth=.8;
    circle(c,sx(0),sy(0),(850+i*850)*z);c.stroke();
  }
  const routeEdges=new Set(view.route.slice(1).map((id,i)=>edgeKey(id,view.route[i])));
  const routeNodes=new Set(view.route);
  c.lineCap='round'; c.lineJoin='round';
  for(const {a,b,control} of edges){
    const ax=sx(a.x),ay=sy(a.y),bx=sx(b.x),by=sy(b.y);
    const cx=control?sx(control.x):(ax+bx)/2,cy=control?sy(control.y):(ay+by)/2;
    if(Math.max(ax,bx,cx)<-16||Math.min(ax,bx,cx)>w+16||Math.max(ay,by,cy)<-16||Math.min(ay,by,cy)>h+16)continue;
    const owned=view.allocated.has(a.id)&&view.allocated.has(b.id),route=routeEdges.has(edgeKey(a.id,b.id));
    const road=(a.role==='travel'||a.kind==='origin')&&(b.role==='travel'||b.kind==='origin');
    c.globalAlpha=owned||route?1:view.filterActive?(view.matches(a)||view.matches(b)?.65:.22):1;
    c.beginPath();c.moveTo(ax,ay);c.quadraticCurveTo(cx,cy,bx,by);
    c.strokeStyle='#08131f99';c.lineWidth=Math.max(1.6,3*Math.sqrt(z));c.stroke();
    if(owned||route){
      c.strokeStyle=owned?'#ffd89935':'#81ddff25';
      c.lineWidth=Math.max(3,9*Math.sqrt(z));c.stroke();
    }
    c.strokeStyle=owned?'#ffdc9c':route?'#99e4ff':road?'#7893a05c':'#6b84904a';
    c.lineWidth=owned?Math.max(1.8,2.5*Math.sqrt(z)):route?Math.max(1.4,1.9*Math.sqrt(z)):road?.8:.6;
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
    const previewed=routeNodes.has(node.id),focused=selected||hover;
    const accent=owned?'#ffdb96':previewed||focused?'#9ce9ff':color;
    c.globalAlpha=owned||focused||previewed?1:view.filterActive?(view.matches(node)?.85:.16):reachable?.85:landmark?.6:.5;
    if(owned||focused||previewed){
      const bloom=c.createRadialGradient(x,y,r*.3,x,y,r*(landmark?3.8:2.6));
      bloom.addColorStop(0,accent+(owned?'55':focused?'30':'1c'));bloom.addColorStop(1,accent+'00');
      c.fillStyle=bloom;c.fillRect(x-r*4,y-r*4,r*8,r*8);
    }
    if(r<2.5){
      circle(c,x,y,r);
      if(owned||previewed){c.fillStyle=owned?'#ffe4b3':accent;c.fill();}
      else{c.strokeStyle=focused?accent:'#8097a3';c.lineWidth=.65;c.stroke();}
      continue;
    }
    // Every node is a polished circular lens. Role comes from scale, concentric rims and engraving.
    const lens=c.createLinearGradient(x-r,y-r,x+r,y+r);
    lens.addColorStop(0,owned?'#78603c':'#24323e');lens.addColorStop(.35,owned?'#51402a':'#121f2a');lens.addColorStop(1,'#091621');
    circle(c,x,y,r);c.fillStyle=lens;c.fill();
    c.strokeStyle=owned?'#ffe1a7':previewed||focused?accent:reachable?'#a1b7c2':accent+(landmark?'99':'70');
    c.lineWidth=owned?1.8:landmark?1.1:notable?.9:.75;c.stroke();
    if((landmark||notable)&&r>5){
      circle(c,x,y,r-2.5);c.strokeStyle=accent+'43';c.lineWidth=.65;c.stroke();
      c.beginPath();c.arc(x,y,r-.9,Math.PI*1.1,Math.PI*1.7);c.strokeStyle=owned?'#fff1cc99':'#a6bdc333';c.lineWidth=.9;c.stroke();
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
      const gap=Math.min(6,2+z*4);circle(c,x,y,r+gap);c.strokeStyle=owned?'#ffe4b0':'#b8ebff';c.lineWidth=1;c.stroke();
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
