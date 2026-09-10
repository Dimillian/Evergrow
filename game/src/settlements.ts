import { buildWallSegments, type WallSegment } from './settlement-walls.ts';
import { sampleBiome, type BiomeId } from './biomes.ts';
import { settlementBenefits, type SettlementTier } from './settlement-services.ts';
import type { Place } from './world-geography.ts';
import type { WorldPOI } from './world-pois.ts';
export type POI = WorldPOI;

export interface Rect { x: number; y: number; width: number; height: number; }
export type BuildingKind = 'expedition' | 'blacksmith' | 'merchant' | 'inn' | 'house' | 'chapel' | 'gambler' | 'noble' | 'stash' | 'hearth' | 'barricade' | 'tower' | 'torch' | 'shelter' | 'cart' | 'supplies' | 'bench' | 'rack' | 'garden' | 'well';
export interface Building extends Rect {
  biome?: BiomeId;
  settlementTier?: SettlementTier;
  id: string;
  seed: number;
  name: string;
  kind: BuildingKind;
  form?: 'house' | 'stall' | 'tent' | 'fixture';
  fortification?: 'wood' | 'palisade' | 'stone';
  wallSegment?: WallSegment;
  door: { x: number; y: number; width: number };
  walls: Rect[];
  furniture: Array<Rect & { kind: string }>;
}
export interface Settlement {
  id: string;
  seed: number;
  name: string;
  kind: 'settlement' | 'village' | 'city';
  layout: 'crescent' | 'fork' | 'commons';
  paths: Array<{ points: Array<[number, number]>; width: number }>;
  x: number;
  y: number;
  radius: number;
  buildings: Building[];
  plaza: Rect;

}


export const MAX_TOWN_RADIUS = 1000;
const NAMES = ['Alder', 'Briar', 'Mourn', 'Thorn', 'Raven', 'Ash', 'Mist', 'Willow', 'Oak', 'Hollow', 'Wren', 'Red', 'Silver', 'Bracken', 'Dawn', 'Grey', 'Fern', 'Elder', 'Stone', 'West', 'High', 'Amber', 'White', 'Copper'];
const BUILDING_NAMES: Record<BuildingKind, string> = {
  expedition:'Expeditions', garden:'Kitchen garden', well:'Village well', shelter: 'Traveller’s shelter', cart: 'Supply cart', supplies: 'Supplies', bench: 'Bench', rack: 'Work rack',
  gambler: 'Gambler', noble: 'Count’s Hall', stash: 'Storage', hearth: 'Hearth', barricade: 'Fortification', tower: 'Watchtower', torch: 'Torch',
  blacksmith: 'The Ember Forge', merchant: 'Wayfarer Goods', inn: 'The Lantern Inn', house: 'Woodland House', chapel: 'Chapel of the Vigil',
};
const BUILDING_DESCRIPTIONS: Record<BuildingKind, string> = {
  expedition:'Choose a dungeon route. Requires level 20.', garden:'',well:'', shelter: 'Canvas and firelight keep the weather out.', cart: '', supplies: '', bench: '', rack: '',
  gambler: 'Trade gold for an unknown piece of equipment.', noble: 'The local household keeps court behind these walls.', stash: 'Your personal equipment storage.', hearth: 'A warm refuge for travellers.', barricade: '', tower: '', torch: '',
  blacksmith: 'Coal glows in the forge beside a scarred iron anvil.',
  merchant: 'Shelves of travel supplies stand above tightly sealed crates.',
  inn: 'Lamplit beds and a quiet common table offer shelter from the woods.',
  house: 'A modest timber home tucked beside the road.',
  chapel: 'Candles gather around an old stone altar beneath dark rafters.',
};

/** Cached generation is a blueprint; future mutable settlement state belongs elsewhere. */
export function freezeSettlement(town: Settlement): Settlement {
  for (const building of town.buildings) {
    Object.freeze(building.door);
    if(building.wallSegment){building.wallSegment.footprint.forEach(Object.freeze);Object.freeze(building.wallSegment.footprint);Object.freeze(building.wallSegment);}
    building.walls.forEach(Object.freeze); Object.freeze(building.walls);
    building.furniture.forEach(Object.freeze); Object.freeze(building.furniture);
    Object.freeze(building);
  }
  for (const path of town.paths) { path.points.forEach(Object.freeze); Object.freeze(path.points); Object.freeze(path); } Object.freeze(town.paths);
  Object.freeze(town.plaza); Object.freeze(town.buildings);
  return Object.freeze(town);
}

export function contains(rect: Rect, x: number, y: number, margin = 0): boolean {
  return x >= rect.x - margin && x < rect.x + rect.width + margin && y >= rect.y - margin && y < rect.y + rect.height + margin;
}
export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
export function circleHitsRect(x: number, y: number, radius: number, rect: Rect): boolean {
  const dx = x - Math.max(rect.x, Math.min(rect.x + rect.width, x));
  const dy = y - Math.max(rect.y, Math.min(rect.y + rect.height, y));
  return radius === 0 ? contains(rect, x, y) : dx * dx + dy * dy < radius * radius - 1e-7;
}

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = Math.imul(state ^ state >>> 15, state | 1);
    x ^= x + Math.imul(x ^ x >>> 7, x | 61);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}

function building(id: string, seed: number, kind: BuildingKind, rect: Rect): Building {
  const { x, y, width, height } = rect;
  const door = { x: x + width / 2, y: y + height, width: 42 };
  const walls = [
    { x, y, width, height: 8 }, { x, y, width: 8, height }, { x: x + width - 8, y, width: 8, height },
    { x, y: door.y - 8, width: width / 2 - door.width / 2, height: 8 },
    { x: door.x + door.width / 2, y: door.y - 8, width: width / 2 - door.width / 2, height: 8 },
  ];
  const furniture: Building['furniture'] = [];
  const add = (kind: string, rx: number, ry: number, width: number, height: number) => furniture.push({ kind, x: x + rx, y: y + ry, width, height });
  if (kind === 'blacksmith') {
    add('forge', 15, 15, 35, 27); add('anvil', width - 43, height * .5, 25, 18); add('barrel', 16, height - 36, 17, 17);
  } else if (kind === 'merchant') {
    add('shelf', 15, 15, 37, 16); add('shelf', width - 52, 15, 37, 16);
    add('counter', 15, height * .53, 35, 16); add('barrel', width - 34, height - 35, 17, 17);
  } else if (kind === 'inn') {
    add('bed', 15, 15, 28, 39); add('bed', width - 43, 15, 28, 39);
    add('table', 16, height - 39, 28, 19); add('table', width - 44, height - 39, 28, 19);
  } else if (kind === 'chapel') {
    add('altar', width / 2 - 22, 16, 44, 18); add('table', 16, height * .5, 26, 16); add('table', width - 42, height * .5, 26, 16);
  } else {
    add('bed', 15, 15, 28, 39); add('table', width - 44, 19, 28, 22); add('shelf', width - 44, height - 34, 28, 15);
  }
  return { id, seed, kind, name: BUILDING_NAMES[kind], ...rect, door, walls, furniture };
}

/** Seeded plots surround an open commons. Walkways are routed around the actual footprints. */
export function generateSettlement(seed: number, place: Place): Settlement {
  const random = rng(place.seed), { x, y } = place, id = `town:${seed}:${place.id}`;
  const kind: Settlement['kind'] = place.id === 0 ? 'settlement' : place.city ? 'city' : place.seed % 3 === 0 ? 'settlement' : 'village';
  const layout = (['crescent', 'fork', 'commons'] as const)[Math.floor(random()*3)];
  const city = kind === 'city', small = kind === 'settlement';
  const radius = city ? 960 : small ? 500 : 770;
  const buildings: Building[] = [], paths: Settlement['paths'] = [];
  const plaza = { x: x - 105, y: y - 78, width: 210, height: 156 };
  const plots = small ? (layout==='crescent'?[[-190,-100],[150,0],[-60,175],[165,-195],[-60,-270],[-240,180],[200,205]]
    :layout==='fork'?[[-195,-90],[125,-175],[-110,190],[195,110],[-95,-280],[-265,140],[230,-120]]
    :[[-170,-165],[175,-75],[-195,105],[150,195],[30,-290],[-255,215],[245,110]])
    : city ? (layout==='crescent'?
      [[-220,-70],[220,-125],[-230,200],[205,180],[-250,-370],[55,-470],[-470,-235],[450,-330],[-470,100],[475,20],[-275,415],[245,410]]
      :layout==='fork'? [[-235,-90],[205,-125],[-215,215],[220,210],[-240,-360],[70,-475],[-480,-285],[435,-325],[-455,30],[480,60],[-300,390],[295,410]]
      :[[-245,-120],[195,-125],[-215,195],[220,190],[-250,-380],[45,-475],[-480,-275],[465,-300],[-460,45],[480,60],[-285,415],[260,425]])
    : (layout==='crescent'? [[-220,-60],[205,-150],[-205,220],[205,170],[-175,-360],[225,-375],[-430,-240],[375,355]]
      :layout==='fork'? [[-235,-115],[195,-135],[-200,180],[235,170],[-225,-370],[195,-385],[-430,105],[350,370]]
      :[[-200,-155],[240,-90],[-235,160],[200,230],[-245,-380],[180,-390],[-430,-70],[360,375]]);
  const roles: BuildingKind[] = ['blacksmith','merchant','chapel','gambler', ...(small ? ['shelter' as const,'shelter' as const,'shelter' as const] : ['inn' as const, city ? 'noble' as const : 'house' as const])];
  const count = small ? 7 : city ? 12 : 8;
  for (let i=0;i<count;i++) {
    let [dx,dy]=plots[i];
    // Three compositions vary the balance of the neighbourhood, then each plot drifts independently.
    dx *= small?(layout==='crescent'?1.06:layout==='fork'?.91:1):1;
    dy += small?(layout==='crescent'?dx*.12:layout==='fork'?-Math.abs(dx)*.1:0):0;
    dx += (random()-.5)*34; dy += (random()-.5)*32;
    const role=roles[i]??'house', tent=role==='shelter', stall=i<4&&(small||i===3||(!city&&i===1));
    if(role==='noble'){dx=plots[i][0];dy=plots[i][1];}
    const width=tent?(i===4?106:76):stall?92+Math.floor(random()*24):role==='noble'?240:124+Math.floor(random()*44), height=tent?(i===4?82:58):stall?64+Math.floor(random()*16):role==='noble'?164:106+Math.floor(random()*30);
    // Reserve breathing room around plots, including their southern entrance.
    // Seeded jitter must never put a shelter across its neighbour's doorway.
    const preferredX=dx,preferredY=dy;
    for(let attempt=0;attempt<160;attempt++) {
      const distance=attempt===0?0:14*Math.sqrt(attempt),angle=attempt*2.399963229728653;
      dx=preferredX+Math.cos(angle)*distance;dy=preferredY+Math.sin(angle)*distance;
      const candidate={x:x+dx-width/2,y:y+dy-height/2,width,height};
      const gap=small?56:78,verticalGap=small?56:108;
      const clashes=buildings.some(other=>candidate.x<other.x+other.width+gap&&candidate.x+width>other.x-gap&&candidate.y<other.y+other.height+verticalGap&&candidate.y+height>other.y-verticalGap);
      const commons=candidate.x<x+65&&candidate.x+width>x-115&&candidate.y<y+85&&candidate.y+height>y-50;
      if(!clashes&&!commons&&Math.hypot(dx,dy)+Math.max(width,height)/2<radius-30)break;
      if(attempt===159)throw new Error(`No clear settlement plot: ${id}/${i}`);
    }
    const b=building(`${id}:building:${i}`, (place.seed+i*193)>>>0, role, {x:x+dx-width/2,y:y+dy-height/2,width,height});
    b.biome=sampleBiome(x,y,seed).id;b.settlementTier=kind;
    b.form=tent?'tent':stall?'stall':'house';
    if (stall) {
      b.walls=[];
      b.furniture=role==='blacksmith'?[{kind:'forge',x:b.x+10,y:b.y+8,width:30,height:18},{kind:'anvil',x:b.x+width-38,y:b.y+20,width:26,height:20}]
        :[{kind:'counter',x:b.x+8,y:b.y+height*.5,width:26,height:16},{kind:'counter',x:b.x+width-34,y:b.y+height*.5,width:26,height:16}];
    }
    if(tent){b.walls=[];b.furniture=[];}
    if(role==='house') {
      b.name=['The Weaver’s Home','The Miller’s Home','The Forester’s Home','The Potter’s Home'][i%4];
      b.furniture.push({kind:'bed',x:b.x+14,y:b.y+b.height-48,width:26,height:34},{kind:'barrel',x:b.x+b.width-31,y:b.y+55,width:16,height:16});
    }
    buildings.push(b);
  }
  // Shared hearth and stash are ordinary collidable fixtures, never breakable loot containers.
  const fixture=(role:BuildingKind,dx:number,dy:number,w:number,h:number,fortification?:Building['fortification'])=>{
    const b:Building={id:`${id}:building:${buildings.length}`,seed:(place.seed+buildings.length*193)>>>0,name:BUILDING_NAMES[role],kind:role,form:'fixture',fortification,biome:sampleBiome(x,y,seed).id,settlementTier:kind,
      x:x+dx-w/2,y:y+dy-h/2,width:w,height:h,door:{x:x+dx,y:y+dy+h/2,width:42},walls:[],furniture:[]};
    b.walls=[{x:b.x,y:b.y,width:w,height:h}]; buildings.push(b);return b;
  };
  fixture('hearth',-38,-10,32,24); fixture('stash',-88,38,34,22);
  // The north/south world-road approaches meet in the common. Doorways join the nearest lane,
  // rather than laying a separate long spoke from every house to the fire.
  const origin:[number,number]=[x,y+45];
  const gates:Array<[number,number]>=[[x,y+radius-55],[x,y-radius+55]];
  for(const [index,target] of gates.entries()) {
    const vertical=index<2;
    const bend:[number,number]=vertical?[x+(layout==='fork'?65:-65),y+(target[1]-y)*.55]:[x+(target[0]-x)*.6,y+(layout==='crescent'?65:-55)];
    const midpointClear=!buildings.some(b=>circleHitsRect(bend[0],bend[1],32,b));
    const points=midpointClear?[...routeSettlementPath(buildings,origin,bend),...routeSettlementPath(buildings,bend,target).slice(1)]:routeSettlementPath(buildings,origin,target);
    paths.push({points,width:small?26:index<2?(city?42:32):24});
  }
  const entrances=buildings.filter(b=>b.form!=='fixture').map(b=>[b.door.x,b.door.y+30] as [number,number]);
  for(const target of entrances) {
    let closest=origin,best=Infinity;
    for(const path of paths)for(let i=1;i<path.points.length;i++) {
      const a=path.points[i-1],b=path.points[i],vx=b[0]-a[0],vy=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((target[0]-a[0])*vx+(target[1]-a[1])*vy)/(vx*vx+vy*vy||1)));
      const q:[number,number]=[a[0]+t*vx,a[1]+t*vy],distance=Math.hypot(target[0]-q[0],target[1]-q[1]);
      if(distance<best){closest=q;best=distance;}
    }
    paths.push({points:routeSettlementPath(buildings,closest,target),width:small?22:city?26:22});
  }
  const ring=(radius-65)*(city?.91:1), material=city?'stone':small?'wood':'palisade';
  const fenceRuns:Array<{points:Array<[number,number]>;closed:boolean}>=[];
  if(small){
    const sections=layout==='fork'?
      [[[-335,-115],[-320,-255],[-150,-355],[45,-355]],[[120,-330],[275,-250],[340,-95]],[[340,0],[355,155],[240,305]],[[80,330],[-95,340],[-270,280],[-345,160]]]
      :layout==='crescent'?
      [[[-350,-90],[-310,-235],[-150,-340],[30,-370]],[[110,-350],[260,-300],[325,-180]],[[345,-55],[360,90],[295,230]],[[195,305],[40,340],[-160,320],[-320,240]]]
      :[[[-325,-155],[-240,-295],[-50,-360],[140,-330]],[[225,-290],[325,-160],[350,-10]],[[350,80],[320,235],[190,315]],[[40,345],[-150,320],[-315,260]]];
    for(const section of sections)fenceRuns.push({points:section as Array<[number,number]>,closed:false});
  }else{
    // Built boundaries follow neighbourhood edges, with offsets and stepped corners.
    // They are deliberately not a circle or a radial approximation of one.
    const boundary=city ? (layout==='fork'?
      [[-590,-470],[-350,-485],[-345,-650],[230,-650],[250,-550],[580,-545],[650,-220],[625,365],[425,365],[425,565],[-365,570],[-380,400],[-625,380],[-650,-160]]
      :[[-635,-350],[-405,-360],[-405,-605],[285,-635],[305,-530],[630,-505],[650,250],[555,260],[550,535],[185,565],[-400,545],[-420,375],[-645,360]])
      : (layout==='commons'?
      [[-565,-250],[-425,-255],[-405,-530],[295,-535],[315,-410],[505,-390],[555,105],[510,510],[190,545],[-235,485],[-270,320],[-565,305]]
      :[[-555,-370],[-330,-390],[-310,-550],[310,-545],[340,-370],[535,-315],[535,180],[500,515],[185,535],[-270,440],[-295,260],[-570,240]]);
    fenceRuns.push({points:boundary as Array<[number,number]>,closed:true});
  }
  const wallThickness=city?22:small?10:15;
  for(const run of fenceRuns){
    const points=run.points.map(([dx,dy])=>[x+dx,y+dy] as [number,number]);
    const segments=buildWallSegments(points,run.closed,wallThickness,(wx,wy)=>{
      if(buildings.some(b=>b.form!=='fixture'&&circleHitsRect(wx,wy,28,b)))return false;
      return !paths.some(path=>path.points.slice(1).some((b,j)=>{
        const a=path.points[j],vx=b[0]-a[0],vy=b[1]-a[1],t=Math.max(0,Math.min(1,((wx-a[0])*vx+(wy-a[1])*vy)/(vx*vx+vy*vy||1)));
        return Math.hypot(wx-a[0]-t*vx,wy-a[1]-t*vy)<58;
      }));
    });
    for(const segment of segments){
      const xs=segment.footprint.map(p=>p[0]),ys=segment.footprint.map(p=>p[1]);
      const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      const b=fixture('barricade',(minX+maxX)/2-x,(minY+maxY)/2-y,maxX-minX,maxY-minY,material);
      b.wallSegment=segment;
    }
    // Occasional corner towers reinforce the authored boundary, never every N wall stamps.
    if(!small)for(const [index,[tx,ty]]of points.entries()){
      if(index%3!==0)continue;
      const width=city?38:30,depth=city?30:24;
      if(buildings.some(b=>b.form!=='fixture'&&circleHitsRect(tx,ty,40,b)))continue;
      if(paths.some(path=>path.points.some(p=>Math.hypot(p[0]-tx,p[1]-ty)<85)))continue;
      if(!segments.some(s=>s.footprint.some(p=>Math.hypot(p[0]-tx,p[1]-ty)<24)))continue;
      const b=fixture('tower',tx-x,ty-y,width,depth,material);
      b.wallSegment={footprint:[[tx-width/2,ty+depth/2],[tx+width/2,ty+depth/2],
        [tx+width/2,ty-depth/2],[tx-width/2,ty-depth/2]],distance:0,length:width,startCap:true,endCap:true};
    }
  }
  for(const [dx,dy] of [[-68,ring*.86],[68,ring*.86],[-68,-ring*.86],[68,-ring*.86],[-ring,68],[ring,68]]){
    for(let offset=0;offset<100;offset+=12){const tx=x+dx+Math.sign(dx)*offset,ty=y+dy;
      if(paths.some(path=>path.points.slice(1).some((b,j)=>{const a=path.points[j],vx=b[0]-a[0],vy=b[1]-a[1],t=Math.max(0,Math.min(1,((tx-a[0])*vx+(ty-a[1])*vy)/(vx*vx+vy*vy||1)));return Math.hypot(tx-a[0]-t*vx,ty-a[1]-t*vy)<30;})))continue;
      if(buildings.some(b=>circleHitsRect(tx,ty,12,b)))continue;
      fixture('torch',tx-x,ty-y,7,7);break;
    }
  }
  const portalClear={x:plaza.x+plaza.width*.76-38,y:plaza.y+plaza.height*.55-38,width:76,height:76};
  const occupied=buildings.filter(b=>b.form!=='fixture');
  for(const [i,b]of occupied.entries()){
    const decorations:Array<[BuildingKind,number,number,number,number]>=[
      ['supplies',b.x+b.width+42,b.y+b.height*.7,24,22],
      [i%3===0?'cart':'rack',b.x-50,b.y+b.height*.5,i%3===0?34:18,i%3===0?48:32],
      ['bench',b.x-28,b.door.y+32,28,11],
      ...(b.form==='house'?[[b.kind==='house'?'garden':'supplies',b.x+b.width*.5,b.y-48,b.kind==='house'?62:24,b.kind==='house'?38:22] as [BuildingKind,number,number,number,number]]:[])];
    for(const [kind,tx,ty,w,h]of decorations){
      if(circleHitsRect(tx,ty,Math.max(w,h)*.55+10,portalClear))continue;
      if(buildings.some(other=>circleHitsRect(tx,ty,Math.max(w,h)*.55+10,other)))continue;
      if(paths.some(path=>path.points.slice(1).some((q,j)=>{const a=path.points[j],vx=q[0]-a[0],vy=q[1]-a[1],t=Math.max(0,Math.min(1,((tx-a[0])*vx+(ty-a[1])*vy)/(vx*vx+vy*vy||1)));return Math.hypot(tx-a[0]-t*vx,ty-a[1]-t*vy)<Math.max(w,h)/2+24;})))continue;
      fixture(kind,tx-x,ty-y,w,h);
    }
  }
  for(const [kind,dx,dy,w,h]of [...(!small?[['well',92,112,32,26] as const]:[]),['cart',-255,-225,34,48],['cart',260,240,34,48],['bench',-96,-42,30,10],['supplies',-135,70,22,20]] as const){
    const tx=x+dx,ty=y+dy;
    if(circleHitsRect(tx,ty,Math.max(w,h)/2+10,portalClear))continue;
    if(buildings.some(b=>circleHitsRect(tx,ty,Math.max(w,h)/2+10,b)))continue;
    if(paths.some(path=>path.points.slice(1).some((q,j)=>{const a=path.points[j],vx=q[0]-a[0],vy=q[1]-a[1],t=Math.max(0,Math.min(1,((tx-a[0])*vx+(ty-a[1])*vy)/(vx*vx+vy*vy||1)));return Math.hypot(tx-a[0]-t*vx,ty-a[1]-t*vy)<Math.max(w,h)/2+24;})))continue;
    fixture(kind,dx,dy,w,h);
  }
  for(let i=0;i<192;i++) {
    const angle=i*Math.PI*.382,dist=110+Math.floor(i/24)*28,dx=Math.cos(angle)*dist,dy=Math.sin(angle)*dist;
    if(circleHitsRect(x+dx,y+dy,55,portalClear)||buildings.some(b=>circleHitsRect(x+dx,y+dy,65,b)))continue;
    if(paths.some(path=>path.points.slice(1).some((q,j)=>{const a=path.points[j],vx=q[0]-a[0],vy=q[1]-a[1],t=Math.max(0,Math.min(1,((x+dx-a[0])*vx+(y+dy-a[1])*vy)/(vx*vx+vy*vy||1)));return Math.hypot(x+dx-a[0]-t*vx,y+dy-a[1]-t*vy)<65;})))continue;
    const table=fixture('expedition',dx,dy,54,32);
    table.door.y+=12;
    break;
  }
  return {id,seed:place.seed,name:NAMES[place.seed%NAMES.length]+['ford','haven','watch','rest','wick','mere','bridge','fall','brook','cross','holm','stead','gate','wall','bury','crest'][Math.floor(place.seed/29)%16],kind,layout,x,y,radius,buildings,plaza,paths};
}

/** Bounded local routing, then visibility simplification; the result is immutable generation data. */
function routeSettlementPath(buildings:Building[],start:[number,number],end:[number,number]):Array<[number,number]> {
  const step=24, limit=44, key=(x:number,y:number)=>`${x},${y}`;
  const clear=(x:number,y:number)=>!buildings.some(b=>circleHitsRect(x,y,25,b));
  const visible=(a:number[],b:number[])=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/8);for(let i=1;i<=n;i++)if(!clear(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n))return false;return true;};
  if(visible(start,end))return [start,end];
  const queue:Array<[number,number]>=[[0,0]], parents=new Map<string,[number,number]|null>([['0,0',null]]);
  let found:[number,number]|null=null;
  for(let i=0;i<queue.length;i++) {
    const q=queue[i], point:[number,number]=[start[0]+q[0]*step,start[1]+q[1]*step];
    if(Math.hypot(point[0]-end[0],point[1]-end[1])<step*2&&visible(point,end)){found=q;break;}
    for(const [dx,dy]of [[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]]){
      const next:[number,number]=[q[0]+dx,q[1]+dy],k=key(...next);
      if(Math.abs(next[0])>limit||Math.abs(next[1])>limit||parents.has(k))continue;
      if(!visible(point,[start[0]+next[0]*step,start[1]+next[1]*step]))continue;
      parents.set(k,q);queue.push(next);
    }
  }
  if(!found)throw new Error(`Settlement plot has no reachable entrance: ${JSON.stringify({start,end,obstacles:buildings.filter(b=>circleHitsRect(end[0],end[1],25,b)||circleHitsRect(start[0],start[1],25,b))})}`);
  const raw:Array<[number,number]>=[end];
  while(found){raw.push([start[0]+found[0]*step,start[1]+found[1]*step]);found=parents.get(key(...found))??null;}raw.reverse();
  const result=[raw[0]];
  for(let i=0;i<raw.length-1;){let next=raw.length-1;while(next>i+1&&!visible(raw[i],raw[next]))next--;result.push(raw[next]);i=next;}
  // Chaikin softening keeps bends inside the validated walking corridor.
  for(let pass=0;pass<2;pass++){
    const soft:Array<[number,number]>=[result[0]];
    for(let i=0;i<result.length-1;i++){const a=result[i],b=result[i+1];soft.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);}soft.push(result.at(-1)!);
    if(soft.every((p,i)=>!i||visible(soft[i-1],p)))result.splice(0,result.length,...soft);
  }
  return result;
}

function smoothstep(a: number, b: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Worn continuous tracks, shared by terrain tiles and review maps. No rectangular street masks. */
export function settlementPavingWeight(town:Settlement,x:number,y:number,_road:number):number {
  if(town.buildings.some(b=>b.form==='house'&&contains(b,x,y)&&y<b.door.y-8))return 0;
  let distance=Math.hypot((x-town.x)*.85,y-town.y)-76;
  for(const path of town.paths)for(let i=1;i<path.points.length;i++){
    const a=path.points[i-1],b=path.points[i],dx=b[0]-a[0],dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
    distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)-path.width/2);
  }
  return 1-smoothstep(-4,town.kind==='city'?46:62,distance+Math.sin(x*.023+y*.018)*3);
}

export function settlementPOIs(town: Settlement): POI[] {
  return [
    { id: town.id, name: town.name, kind: 'town', x: town.x, y: town.y,
      description: settlementBenefits(town.kind)+'. '+(town.kind === 'city' ? 'A fortified city beneath the local count’s hall.' : town.kind === 'village' ? 'A palisaded village of homes, workshops and market stalls.' : 'A timber refuge gathered around a traveller’s fire.') },
    ...town.buildings.filter(b => ['blacksmith','merchant','chapel','inn','gambler','stash'].includes(b.kind)).map(b => ({ id: `${b.id}:poi`, name: b.kind === 'merchant' ? 'Jeweler' : b.kind === 'chapel' ? 'Enchanter' : b.name, kind: b.kind === 'merchant' ? 'jeweler' : b.kind === 'chapel' ? 'enchanter' : b.kind,
      x: b.door.x, y: b.door.y, description: BUILDING_DESCRIPTIONS[b.kind] } as POI)),
  ];
}
