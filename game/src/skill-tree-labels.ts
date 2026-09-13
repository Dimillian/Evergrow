import { SKILL_TREE, SKILL_NODES, SKILL_TERRITORIES, type SkillNode } from './skill-tree.ts';
/** Screen-space budgets prevent higher zoom from turning every star into a caption. */
export function atlasLabelBudget(zoom: number, width: number, height: number) {
  const capacity = Math.max(3, Math.min(10, Math.floor(width * height / 85000)));
  return { landmarks: zoom >= .72 ? Math.min(4, capacity) : capacity,
    clusters: zoom >= .72 ? 2 : zoom >= .27 ? Math.min(5, capacity) : 0,
    techniques: zoom >= .72 ? 3 : 0 };
}
export function atlasLabelCandidates(view: { zoom: number; width: number; height: number; centerX: number; centerY: number;
  selected?: string | null; hovered?: string | null; labelExclusions?: readonly AtlasLabelBox[]; matches(node: SkillNode): boolean }) {
  const { zoom: z, width: w, height: h } = view;
  const visible = (n: { x: number; y: number }) => Math.abs(n.x-view.centerX)*z<w/2-12 && Math.abs(n.y-view.centerY)*z<h/2-24;
  const focused = [...new Set([view.selected, view.hovered])].flatMap(id => id && SKILL_NODES.has(id) ? [SKILL_NODES.get(id)!] : []).filter(visible);
  const anchor = focused.at(-1) ?? { x: view.centerX, y: view.centerY };
  const distance = (n: { x: number; y: number }) => Math.hypot(n.x-anchor.x,n.y-anchor.y);
  const byDistance = (a: { x: number; y: number }, b: { x: number; y: number }) => distance(a)-distance(b);
  const budget = atlasLabelBudget(z,w,h);
  const landmarks = SKILL_TREE.nodes.filter(n => (n.kind==='major'||n.kind==='origin') && !focused.includes(n) && visible(n) && view.matches(n) && (z>=.22||n.kind==='origin')).sort(byDistance);
  const clusterIds = new Set(focused.map(n=>n.cluster));
  const clusters = SKILL_TREE.clusters.filter(c=>!c.id.startsWith('development:') && visible(c)
    && SKILL_TREE.nodes.some(n=>n.cluster===c.id&&view.matches(n)))
    .sort((a,b)=>Number(clusterIds.has(b.id))-Number(clusterIds.has(a.id))||byDistance(a,b));
  const owner = focused.at(-1), skill = owner?.skill ?? owner?.developmentSkill;
  const techniques = skill ? SKILL_TREE.nodes.filter(n=>n.specialization&&n.developmentSkill===skill&&visible(n)&&view.matches(n)&&!focused.includes(n)) : [];
  return { focused, landmarks: landmarks.slice(0,budget.landmarks), clusters: clusters.slice(0,budget.clusters), techniques: techniques.slice(0,budget.techniques) };
}

export interface AtlasLabelBox { x: number; y: number; width: number; height: number }
interface Point { x: number; y: number }
export interface AtlasLabelObstacles {
  nodes: (Point & { radius: number })[];
  lines: { a: Point; b: Point }[];
}
export interface AtlasCaption extends AtlasLabelBox { text: string; size: number; color: string; owner: string }
export const skillNodeRadius = (n: SkillNode) => n.kind === 'origin' ? 28 : n.keystone ? 22 : n.skill ? 21 : n.doctrine ? 16 : n.specialization ? 12 : n.kind === 'notable' ? 15 : n.role === 'travel' ? 4 : 8;
export const skillNodeScreenRadius = (node: SkillNode, zoom: number) => {
  const scale = zoom < .4 ? zoom / Math.sqrt(.4) : Math.sqrt(zoom);
  return Math.max(node.kind === 'origin' ? 5 : node.kind === 'major' ? 3.2 : .65, skillNodeRadius(node) * scale);
};
type LabelView = Parameters<typeof atlasLabelCandidates>[0];
const screen = (p: Point, v: LabelView): Point => ({ x: (p.x-v.centerX)*v.zoom+v.width/2, y: (p.y-v.centerY)*v.zoom+v.height/2 });

/** Cached with the atlas, using the actual lens sizes and the same curved connectors as the renderer. */
export function atlasLabelObstacles(view: LabelView): AtlasLabelObstacles {
  const nodes = SKILL_TREE.nodes.map(n=>({...screen(n,view),radius:skillNodeScreenRadius(n,view.zoom)+6}));
  const lines: AtlasLabelObstacles['lines'] = [];
  for(const edge of SKILL_TREE.edges){
    const a=screen(SKILL_NODES.get(edge.from)!,view),b=screen(SKILL_NODES.get(edge.to)!,view);
    const c=edge.control?screen(edge.control,view):{x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    if(Math.max(a.x,b.x,c.x)<0||Math.min(a.x,b.x,c.x)>view.width||Math.max(a.y,b.y,c.y)<0||Math.min(a.y,b.y,c.y)>view.height)continue;
    // Quadratic subdivision has <= half a pixel of deviation, including long cross-country curves.
    const steps=Math.max(1,Math.ceil(Math.sqrt(Math.hypot(a.x-2*c.x+b.x,a.y-2*c.y+b.y)/2)));
    let previous=a;
    for(let i=1;i<=steps;i++){
      const t=i/steps,u=1-t,p={x:u*u*a.x+2*u*t*c.x+t*t*b.x,y:u*u*a.y+2*u*t*c.y+t*t*b.y};
      lines.push({a:previous,b:p});previous=p;
    }
  }
  return {nodes:nodes.filter(n=>n.x+n.radius>=0&&n.x-n.radius<=view.width&&n.y+n.radius>=0&&n.y-n.radius<=view.height),lines};
}
export function atlasLabelIntersectsLine(box: AtlasLabelBox, a: Point, b: Point, padding=4): boolean {
  let enter=0,leave=1;
  for(const [position,delta,low,high] of [[a.x,b.x-a.x,box.x-padding,box.x+box.width+padding],[a.y,b.y-a.y,box.y-padding,box.y+box.height+padding]]){
    if(Math.abs(delta)<1e-9){if(position<low||position>high)return false;continue;}
    const first=(low-position)/delta,last=(high-position)/delta;
    enter=Math.max(enter,Math.min(first,last));leave=Math.min(leave,Math.max(first,last));
    if(enter>leave)return false;
  }
  return true;
}
export function atlasLabelClear(box: AtlasLabelBox, obstacles: AtlasLabelObstacles, occupied: readonly AtlasLabelBox[]): boolean {
  if(occupied.some(b=>box.x<b.x+b.width+6&&box.x+box.width>b.x-6&&box.y<b.y+b.height+6&&box.y+box.height>b.y-6))return false;
  if(obstacles.nodes.some(n=>Math.hypot(n.x-Math.max(box.x,Math.min(n.x,box.x+box.width)),n.y-Math.max(box.y,Math.min(n.y,box.y+box.height)))<n.radius))return false;
  return !obstacles.lines.some(line=>atlasLabelIntersectsLine(box,line.a,line.b));
}

/** Find a nearby empty pocket. Never hide a node or a road to force a caption onto the map. */
export function placeAtlasLabel(anchor: Point & { radius: number }, width: number, height: number,
  view: Pick<LabelView,'width'|'height'>, obstacles: AtlasLabelObstacles, occupied: readonly AtlasLabelBox[]): AtlasLabelBox | undefined {
  for(const gap of [10,20,34,48]){
    const r=anchor.radius+gap;
    const positions=[[0,r+height/2],[0,-r-height/2],[r+width/2,0],[-r-width/2,0]];
    for(const side of [-1,1])for(const shift of [-.35,.35,-.7,.7]){
      positions.push([width*shift,side*(r+height/2)],[side*(r+width/2),height*shift]);
    }
    for(const [dx,dy] of positions){
      const box={x:anchor.x+dx-width/2,y:anchor.y+dy-height/2,width,height};
      if(box.x<8||box.x+width>view.width-8||box.y<8||box.y+height>view.height-65)continue;
      if(atlasLabelClear(box,obstacles,occupied))return box;
    }
  }
  return undefined;
}


const territories=SKILL_TERRITORIES.map(t=>{
  const nodes=SKILL_TREE.nodes.filter(n=>n.territory===t.id);
  return {...t,x:nodes.reduce((sum,n)=>sum+n.x,0)/nodes.length,y:nodes.reduce((sum,n)=>sum+n.y,0)/nodes.length};
});
/** Priority is focus, its Techniques, nearby landmarks, then optional geographic captions. */
export function layoutAtlasCaptions(view: LabelView & { allocated?: ReadonlySet<string> },
  measure: (text: string, size: number)=>number, rankLabel?: (node: SkillNode)=>string | undefined): AtlasCaption[] {
  const obstacles=atlasLabelObstacles(view),result:AtlasCaption[]=[],occupied:AtlasLabelBox[]=[...(view.labelExclusions??[])];
  const add=(text:string,owner:string,anchor:Point&{radius:number},color:string,size:number)=>{
    const box=placeAtlasLabel(anchor,measure(text,size)+16,size+10,view,obstacles,occupied);
    if(box){result.push({...box,text,owner,color,size});occupied.push(box);return true;}return false;
  };
  const captions=atlasLabelCandidates(view);
  const anchorVisible=(n:SkillNode)=>{
    const p=screen(n,view),r=skillNodeScreenRadius(n,view.zoom);
    return p.x>=r&&p.x<=view.width-r&&p.y>=r&&p.y<=view.height-r
      &&!view.labelExclusions?.some(b=>p.x+r>b.x&&p.x-r<b.x+b.width&&p.y+r>b.y&&p.y-r<b.y+b.height);
  };
  const labelNode=(n:SkillNode,size=12,color=view.allocated?.has(n.id)?'#ffe3ae':'#dce9eb')=>{
    if(anchorVisible(n))add(n.kind==='origin'?'THE ROOT':n.name,n.id,{...screen(n,view),radius:skillNodeScreenRadius(n,view.zoom)},color,size);
  };
  for(const n of captions.focused)labelNode(n);
  for(const n of captions.techniques)labelNode(n,11,'#b9d2e4');
  for(const n of captions.landmarks)labelNode(n);
  for(const n of captions.focused){
    const rank=rankLabel?.(n);
    if(rank&&anchorVisible(n))add(rank,n.id,{...screen(n,view),radius:skillNodeScreenRadius(n,view.zoom)},'#ffe2af',10);
  }
  if(view.zoom<.45)for(const t of territories){
    if(!SKILL_TREE.nodes.some(n=>n.territory===t.id&&view.matches(n)))continue;
    const side=t.id==='forge'||t.id==='hunt'||t.id==='wellspring'?-1:1;
    const bounds=SKILL_TREE.bounds;
    // The full overview names territories around the outside of the atlas, not inside its dense root.
    const anchor=view.zoom<.2
      ?{x:(bounds.minX+bounds.maxX)/2+Math.cos(t.angle)*(bounds.maxX-bounds.minX)*.43,
        y:(bounds.minY+bounds.maxY)/2+Math.sin(t.angle)*(bounds.maxY-bounds.minY)*.59}
      :{x:t.x-Math.sin(t.angle)*side*370,y:t.y+Math.cos(t.angle)*side*370};
    const p=screen(anchor,view);
    if(view.zoom<.2)p.y=Math.max(36,Math.min(view.height-80,p.y));
    const size=view.zoom<.2?15:18;
    if(!add(t.name.toUpperCase(),t.id,{...p,radius:0},t.color,size)&&view.zoom<.2){
      for(const dx of [90,-90,150,-150,210,-210])if(add(t.name.toUpperCase(),t.id,{x:p.x+dx,y:p.y,radius:0},t.color,size))break;
    }
  }
  for(const cluster of captions.clusters){
    if(captions.focused.some(n=>n.cluster===cluster.id&&n.name===cluster.name))continue;
    const notable=SKILL_TREE.nodes.filter(n=>n.cluster===cluster.id&&n.kind==='notable').at(-1)!;
    if(!anchorVisible(notable))continue;
    add(cluster.name.toUpperCase(),cluster.id,{...screen(notable,view),radius:skillNodeScreenRadius(notable,view.zoom)},
      SKILL_TERRITORIES.find(t=>t.id===cluster.territory)?.color??'#b8cfdf',11);
  }
  return result;
}
