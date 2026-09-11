import { gearSurface, materializeGear, gearMaterialStops, gearMaterialMarks, type GearMaterial, type GearSurface } from './gear-material.ts';
import type { ShieldDefinition, WeaponVisual } from './model.ts';
import { mixColor, type Point } from './art-primitives.ts';

export interface GearShape { points: readonly Point[]; fill?: string; stroke?: string; width?: number; fine?: boolean; surface?: GearSurface; }
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const poly = (points: readonly Point[], fill: string): GearShape => ({ points, fill });
const stroke = (points: readonly Point[], color: string, width = .7): GearShape => ({ points, stroke: color, width });
const gem = (x: number, y: number, rx: number, ry: number): Point[] => [[x - rx, y], [x, y - ry], [x + rx, y], [x, y + ry]];

/** Staff proportions fit a walking-staff carry; held effects share this tip. */
export const weaponArtLength = (visual: WeaponVisual) => clamp(visual.length, 8, 60) * (visual.kind === 'staff' ? .73 : 1);

/** The string and the support-hand anchor consume exactly the same draw offset. */
export const bowStringOffset = (draw: number) => -5 - clamp(draw, 0, 1) * 11;

/** Shared procedural silhouettes for worn weapons and inventory icons. +X is the attack direction. */
const weaponCache = new WeakMap<WeaponVisual, GearShape[]>();
export function weaponShapes(visual: WeaponVisual, draw = 0): GearShape[] {
  if (draw === 0) { const cached = weaponCache.get(visual); if (cached) return cached; }
  const shapes = buildWeaponShapes(visual, draw);
  const accents = new Map<string, GearMaterial>([[visual.guard, 'brass'], [visual.grip, ['bow','staff','wand','axe','mace'].includes(visual.kind) ? 'wood' : 'leather']]);
  if (visual.glow) accents.set(visual.glow, 'gem');
  accents.set(visual.metal, 'steel');
  accents.set(mixColor(visual.metal, '#121c28', .72), 'steel');
  accents.set(mixColor(visual.metal, '#bdc7cc', .25), 'steel');
  const result = materializeGear(shapes, visual.kind === 'wand' || visual.kind === 'staff' || visual.kind === 'bow' ? 'wood' : 'steel', Math.round(visual.length * 13 + visual.width * 71), accents).map(shape => shape.surface && visual.material && (shape.surface.material === 'steel' || (['staff','wand','bow'].includes(visual.kind) && shape.surface.material === 'wood')) ? { ...shape, surface: { ...shape.surface, material: visual.material } } : shape);
  if (draw === 0) weaponCache.set(visual, result);
  return result;
}
function buildWeaponShapes(visual: WeaponVisual, draw: number): GearShape[] {
  if (visual.kind === 'unarmed') return [];
  const length = weaponArtLength(visual), half = Math.max(.7, visual.width * .5);
  const grip = clamp(visual.gripLength ?? 12, 6, visual.kind === 'staff' ? 13 : 22), shapes: GearShape[] = [];
  if (visual.kind === 'bow') {
    const span = length * .64, tipX = -3 - clamp(draw, 0, 1) * 2, curve: Point[] = [], edge: Point[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = -1 + i / 10, y = span * t;
      const x = tipX * t * t + Math.sin(Math.abs(t) * Math.PI) * 3
        + Math.sin(Math.abs(t) * Math.PI * 2) * (visual.width >= 15 ? 2.2 : .6);
      curve.push([x, y]); edge.push([x + 1.2, y]);
    }
    const limbWidth = clamp(visual.width * .19, 2, 3.4);
    shapes.push(stroke(curve, '#192830', limbWidth + 1.1), stroke(curve, visual.grip, limbWidth), stroke(edge, visual.edge, .7));
    shapes.push(stroke([[tipX, -span], [bowStringOffset(draw), 0], [tipX, span]], '#d4d8c4', .45));
    shapes.push(poly([[-1.2, -3.2], [2.8, -3], [3.1, 0], [2.8, 3], [-1.2, 3.2]], visual.grip));
    for (let i = -2.5; i <= 2.5; i += 1.25) shapes.push(stroke([[-.6, i], [2.6, i + .3]], mixColor(visual.grip, visual.guard, .5), .4));
    shapes.push(poly(gem(tipX + .5, -span + 1, .7, 1.2), visual.guard), poly(gem(tipX + .5, span - 1, .7, 1.2), visual.guard));
    shapes.push(stroke(curve.map(([x, y]) => [x - .8, y] as Point), mixColor(visual.grip, '#080f16', .5), .65));
    if (draw > .05) {
      const nock = bowStringOffset(draw), tip = nock + 30;
      shapes.push(stroke([[nock, 0], [tip, 0]], '#bdab7d', 1));
      shapes.push(poly([[tip - 1, -2], [tip + 6, 0], [tip - 1, 2]], visual.edge));
      shapes.push(poly([[nock, 0], [nock - 3, -3], [nock + 2, -2], [nock + 5, 0]], '#a7c6b7'));
      shapes.push(poly([[nock, 0], [nock - 3, 3], [nock + 2, 2], [nock + 5, 0]], '#627f7d'));
    }
    return shapes;
  }
  if (visual.kind !== 'wand') {
  shapes.push(poly([[-grip, -1.35], [length * .8, -1.35], [length * .8, 1.35], [-grip, 1.35]], visual.grip));
  const wrappedEnd = visual.kind === 'sword' || visual.kind === 'dagger' ? 1 : 0;
  for (let wrap = -grip + 1; wrap < wrappedEnd; wrap += 2) shapes.push(stroke([[wrap, -1.2], [wrap + .8, 1.2]], visual.guard, .45));
  }
  if (visual.kind === 'sword' || visual.kind === 'dagger') {
    const broad = visual.kind === 'dagger' ? half * 1.4 : half * .88;
    shapes.push(poly([[3, -broad], [length * .77, -broad * .66], [length, 0], [length * .77, broad * .68], [3, broad]], '#233b43'));
    shapes.push(poly([[3.5, -broad * .73], [length * .77, -broad * .43], [length, 0], [length * .77, broad * .48], [3.5, broad * .8]], visual.metal));
    shapes.push(poly([[3, -broad], [length * .77, -broad * .66], [length, 0], [length * .76, -broad * .34], [4, -.15]], visual.edge));
    shapes.push({ ...poly([[5, .05], [length * .77, -.1], [length * .69, broad * .33], [5, broad * .48]], mixColor(visual.metal, '#152533', .55)), surface: gearSurface('steel', 3, [.65, .4, .65]) });
    shapes.push({ ...poly([[5, -.13], [length * .73, -.2], [length * .84, 0], [length * .73, .12], [5, .1]], visual.metal), surface: gearSurface('steel', 7, [-.4, -.7, .6]) });
    shapes.push(stroke([[6, -.1], [length * .7, -.1]], visual.edge, .35));
    const guard = Math.max(3.6, broad * 2.1);
    const dagger = visual.kind === 'dagger';
    shapes.push(poly(dagger
      ? [[.1, -guard + 1], [1.5, -guard], [3.5, -guard + 1], [3.5, guard - 1], [1.5, guard], [.1, guard - 1]]
      : [[-.5, -guard], [1.4, -guard - .8], [3.1, -guard + .4], [3.3, -1.6], [4.7, 0], [3.3, 1.6], [3.1, guard - .4], [1.4, guard + .8], [-.5, guard], [1, guard - 1.4], [1, -guard + 1.4]], visual.guard));
    shapes.push(stroke([[.1, -guard + .2], [1.5, -guard + .1], [2.1, -2.2], [3.8, 0], [2.1, 2.2]], visual.edge, .55));
    shapes.push(poly(gem(1.8, 0, 1.6, 1.3), '#344e56'), poly(gem(1.5, -.2, .65, .6), visual.edge));
    if (!dagger) shapes.push(stroke([[5.5, -broad * .55], [8, -.25], [5.5, broad * .55]], visual.guard, .45));
  } else if (visual.kind === 'axe') {
    const head = length * .68, blade = 5.8 + half * .85;
    shapes.push(poly([[head - 3, -3], [head - 7, -blade], [length - 1, -blade + 1], [length + 2, -blade * .25], [length - 2, -1], [head + 2, 2]], visual.metal));
    shapes.push(poly([[head - 7, -blade], [length - 1, -blade + 1], [length + 2, -blade * .25], [length - 2, -1], [length - 1, -blade + 3], [head - 5, -blade + 2]], visual.edge));
    shapes.push(stroke([[head - 2, -3], [length - 4, -blade + 4]], visual.guard, .8));
    shapes.push(poly([[head - 3, -4], [head - 4, -blade + 3], [length - 5, -blade + 4], [length - 3, -4], [head + 1, -2]], '#39515a'));
    shapes.push(stroke([[head - 1, -5], [head - 2, -blade + 5], [length - 6, -blade + 5]], visual.metal, 1.1));
    shapes.push({...poly([[head-2,-2],[head+2,-2],[head+2,2],[head-2,2]],visual.metal),surface:gearSurface('steel',8,[-.5,-.2,.84])});
    shapes.push({...poly([[head-6,-blade+.8],[head-4,-blade+2.5],[length-3,-blade+3],[length+.5,-blade*.25],[length-2,-1],[length-1,-blade+1.8]],mixColor(visual.metal,visual.edge,.48)),surface:{...gearSurface('steel',9,[-.3,-.75,.58]),facet:true}});
    shapes.push({...stroke([[head-2,-4],[head-1,-5],[head,-4]],visual.guard,.22),fine:true});
    if (length > 31) {
      shapes.push(poly([[head - 3, 3], [head - 6, blade * .7], [length - 1, blade * .75], [length + 1, blade * .2], [length - 2, 1]], visual.metal));
      shapes.push(stroke([[head - 6, blade * .7], [length - 1, blade * .75], [length + 1, blade * .2]], visual.edge, 1));
    } else shapes.push(poly([[head, 0], [head - 1, 5], [length - 2, 2], [length - 3, 0]], visual.guard));
    shapes.push(poly(gem(head, 0, 2.5, 2), visual.guard));
  } else if (visual.kind === 'mace') {
    const head=length-7, radius=length>30?5.8:3.9;
    shapes.push(poly([[head-2,-1.8],[head+.7,-2],[head+.7,2],[head-2,1.8]],visual.guard));
    // Forged head with dark joins between the flanges, not stacked gold bars.
    shapes.push(poly([[head,-radius*.6],[length-1,-radius],[length+1,0],[length-1,radius],[head,radius*.6]],mixColor(visual.metal,'#15232b',.42)));
    for(const side of [-1,0,1]) {
      const y=side*radius*.67;
      shapes.push({...poly([[head-.4,y],[head+1.3,y-1],[length-1.3,y-1.15],[length+.7,y-.25],[length-.8,y+1],[head+1,y+.8]],visual.metal),surface:gearSurface('steel',11+side,[0,side*.55,.84])});
      shapes.push({...poly([[head+1.3,y-1],[length-1.3,y-1.15],[length+.7,y-.25],[length-1,y-.52],[head+1.5,y-.55]],mixColor(visual.metal,visual.edge,.4)),surface:{...gearSurface('steel',12,[0,-.8,.6]),facet:true}});
    }
    shapes.push(poly([[head+1,-.7],[head+2,-.7],[head+2,.7],[head+1,.7]],visual.guard));
  } else if (visual.kind === 'wand') {
    const glow = visual.glow ?? '#b4a5ef', tip = length - 1.6;
    const wood = mixColor(visual.grip, '#283034', .2), grain = mixColor(visual.grip, visual.edge, .24);
    // Continuous tapered wood, with a short grip rather than a sword hilt.
    shapes.push(poly([[-grip,-.64],[-2,-.76],[2,-.58],[tip-2.6,-.27],[tip-1.3,0],[tip-2.6,.27],[2,.58],[-2,.76],[-grip,.64]], wood));
    shapes.push(stroke([[-grip+.4,-.38],[-1,-.48],[6,-.26],[tip-2.5,-.12]],grain,.22));
    shapes.push(poly([[-grip-.35,-.5],[-grip,-.67],[-grip+.6,-.62],[-grip+.6,.62],[-grip,.67],[-grip-.35,.5]],visual.guard));
    shapes.push(poly([[-.4,-.75],[.35,-.72],[.35,.72],[-.4,.75]],visual.guard));
    for(let x=-grip+1.1;x<-1;x+=1.1) shapes.push({ ...stroke([[x,-.52],[x+.25,.52]],mixColor(wood,'#202329',.25),.15),fine:true });
    // A small socket holds the crystal on the shaft's axis. No broad cage or guard.
    shapes.push(poly([[tip-3.1,-.38],[tip-1.8,-.62],[tip-.8,0],[tip-1.8,.62],[tip-3.1,.38]],visual.guard));
    const radius=visual.element==='frost'?.82:visual.element==='arcane'?.72:.62;
    const crystal:Point[] = [[tip-1.5,0],[tip-.5,-radius],[tip+.8,-radius*.45],[tip+1.6,0],[tip+.5,radius],[tip-.5,radius*.8]];
    shapes.push({...poly(crystal,glow),surface:gearSurface('gem',19)});
    shapes.push({...poly([[tip-1.5,0],[tip-.5,-radius],[tip+.8,-radius*.45],[tip+1.6,0],[tip-.1,-.1]],mixColor(glow,'#efffff',.55)),surface:{...gearSurface('gem',20,[-.1,-.6,.8]),facet:true}});
    if(visual.element==='lightning') shapes.push({ ...stroke([[6,-.2],[8,.2],[9,-.2],[11,0]],glow,.2),fine:true });
    if(visual.element==='arcane') shapes.push({ ...stroke([[tip-4.6,-.35],[tip-4.2,0],[tip-4.6,.35]],visual.guard,.2),fine:true });
    return shapes;
  } else if (visual.kind === 'staff') {
    const head = length - 4, glow = visual.glow ?? '#a99acf';
    const iron = mixColor(visual.metal, '#121c28', .72), lit = mixColor(visual.metal, '#bdc7cc', .25);
    // Tapered wood, recessed bindings and a small forged cage around an elemental core.
    shapes.push(poly([[-grip, -.9], [head - 6, -1.6], [head - 6, 1.4], [-grip, 1]], visual.grip));
    shapes.push(stroke([[-grip, -.8], [head - 7, -1.1]], mixColor(visual.grip, '#e2d2af', .3), .45));
    shapes.push(stroke([[-grip + 2, .6], [head - 6, .8]], mixColor(visual.grip, '#0a1217', .5), .5));
    for (const x of [-grip + 1, -5, 1, head - 8]) {
      shapes.push(poly([[x, -1.7], [x + 1.3, -1.7], [x + 1.3, 1.7], [x, 1.7]], iron),
        stroke([[x, -1.7], [x + 1.3, -1.7]], lit, .4));
    }
    shapes.push(poly([[head - 9, -2], [head - 5, -3], [head + 1, -6], [length + 3, -3.8],
      [head + 1, -4.2], [head - 3, -1.5], [head - 3, 1.5], [head + 1, 4.2], [length + 3, 3.8],
      [head + 1, 6], [head - 5, 3], [head - 9, 2]], iron));
    shapes.push(stroke([[head - 8, -1.8], [head - 4, -2.2], [head + 1, -5], [length + 2, -3.8]], lit, .65));
    shapes.push(stroke([[head - 5, 2.8], [head + 1, 5.4], [length + 2, 4.1]], visual.guard, .45));
    if (visual.element === 'fire') {
      shapes.push(poly([[head - 2, 0], [head + 1, -2.8], [length + 2, -.8], [length + 1, 1.6], [head + 1, 2.8]], '#783d38'),
        poly([[head - 1, 0], [head + 1, -2], [length + 1, -.7], [head + 2, 1.6]], glow),
        poly([[head + 1, -.8], [length, -.4], [head + 2, .8]], '#ffe0a0'));
    } else if (visual.element === 'frost') {
      shapes.push(poly([[head - 2, 0], [head + 2, -3.2], [length + 4, 0], [head + 2, 3.2]], glow),
        poly([[head - 2, 0], [head + 2, -3.2], [length + 4, 0], [head + 2, -.4]], '#d9eff0'),
        poly([[head + 2, -.4], [length + 4, 0], [head + 2, 3.2]], '#5989b0'));
    } else {
      shapes.push(poly(gem(head + 3, 0, 4, 3), glow),
        poly([[head - 1, 0], [head + 3, -3], [head + 2, .2]], '#ddd6f5'),
        poly([[head + 2, .2], [head + 3, 3], [head + 7, 0]], '#6863ab'));
    }
    shapes.push(poly(gem(head - 6, 0, 1.3, 1.7), visual.guard));
    for (let mark = 6; mark < head - 10; mark += 8) shapes.push({ ...stroke([[mark, -.6], [mark + 1.1, 0], [mark, .6]], lit, .28), fine: true });
  }
  const pommel: Point[] = [[-2, -.7], [-1.1, -1.7], [.2, -1.4], [.8, -.6], [.8, .6], [.2, 1.4], [-1.1, 1.7], [-2, .7]];
  shapes.push(poly(pommel.map(([x, y]) => [x - grip, y]), mixColor(visual.guard, '#23313a', .25)));
  shapes.push(stroke([[-grip - 1.6, -.5], [-grip - 1, -1.2], [-grip + .1, -.9]], visual.edge, .35));
  if (visual.glow && visual.kind !== 'staff') shapes.push(stroke([[Math.max(5, length * .35), -half], [length * .8, -half * .6], [length, 0]], visual.glow, .6));
  if (visual.kind !== 'staff') {
    const dark = mixColor(visual.metal, '#101b24', .65);
    for (let i = 0; i < 3; i++) {
      const x = length * (.32 + i * .16);
      shapes.push({ ...stroke([[x, -.2], [x + .9, -.55]], dark, .25), fine: true });
    }
    for (let wrap = -grip + 1; wrap < -1; wrap += 2) {
      shapes.push(stroke([[wrap, -.9], [wrap + .5, .8]], mixColor(visual.grip, '#172027', .55), .35));
    }
  }
  if (visual.kind === 'staff') return shapes.map(shape => ({ ...shape,
    points: shape.points.map(([x, y]): Point => [x, y * .62]),
    ...(shape.width !== undefined ? { width: shape.width * .8 } : {}),
  }));
  if (['sword', 'axe', 'mace', 'dagger'].includes(visual.kind) && visual.element && visual.element !== 'physical' && visual.glow) {
    const start = length * (visual.kind === 'axe' || visual.kind === 'mace' ? .65 : .25);
    shapes.push(stroke([[start, 0], [length * .9, 0]], visual.glow, .65));
    for (let i = 0; i < 3; i++) {
      const x = start + (length * .87 - start) * i / 2;
      shapes.push(stroke([[x - .8, -.9], [x + .5, 0], [x - .8, .9]], visual.glow, .45));
    }
  }
  return shapes;
}

/** Shields face the viewer; wrist attachment remains centered behind their boss. */
const shieldCache = new WeakMap<ShieldDefinition['visual'], GearShape[]>();
export function shieldShapes(visual: ShieldDefinition['visual']): GearShape[] {
  const cached = shieldCache.get(visual); if (cached) return cached;
  const round = visual.kind === 'buckler';
  const edge: Point[] = round
    ? Array.from({ length: 16 }, (_, i): Point => [Math.cos(i * Math.PI / 8) * 8.8, Math.sin(i * Math.PI / 8) * 9.5])
    : visual.kind === 'tower' ? [[-7, -11], [0, -13], [7, -11], [8, 9], [4, 12], [-4, 12], [-8, 9]]
      : [[0, -11], [8, -8], [7, 4], [0, 14], [-7, 4], [-8, -8]];
  const inset = edge.map(([x,y]): Point => [x * .85, y * .85]);
  const shapes: GearShape[] = [poly(edge.map(([x,y]): Point=>[x,y+.65]), visual.shadow), poly(edge, visual.shadow)];
  // Separate forged rim facets: only the light-facing bevel is bright.
  for (let i=0;i<edge.length;i++) {
    const next=(i+1)%edge.length, nx=(edge[i][0]+edge[next][0])/18, ny=(edge[i][1]+edge[next][1])/20;
    const light = Math.max(0, -.6*nx-.8*ny);
    shapes.push({ ...poly([edge[i], edge[next], inset[next], inset[i]], mixColor(visual.base, visual.edge, .15+light*.62)),
      surface: { ...gearSurface('steel', i, [nx,ny,.65]), facet: true } });
  }
  shapes.push(poly(inset, visual.shadow));
  const face=inset.map(([x,y]): Point=>[x*.94,y*.94]);
  shapes.push({ ...poly(face, visual.base), surface: gearSurface('steel', 51, [-.2,-.15,.96]) });
  shapes.push(stroke([...face,face[0]], mixColor(visual.base,visual.shadow,.4), .28));
  if (round) {
    // Broad dished face and raised boss replace the concentric outlined spokes.
    for (let i=0;i<8;i++) {
      const a=i*Math.PI/4,b=(i+1)*Math.PI/4;
      shapes.push({ ...poly([[0,0],[Math.cos(a)*6.6,Math.sin(a)*7.1],[Math.cos(b)*6.6,Math.sin(b)*7.1]],
        mixColor(visual.base, i<4?visual.shadow:visual.edge,i<4?.16:.11)), surface:gearSurface('steel',i,[Math.cos((a+b)/2)*.3,Math.sin((a+b)/2)*.3,.95]) });
    }
    const boss=Array.from({length:8},(_,i):Point=>[Math.cos(i*Math.PI/4)*3.15,Math.sin(i*Math.PI/4)*3.15+.5]);
    shapes.push(poly(boss.map(([x,y]):Point=>[x*1.14,y*1.14+.3]),visual.shadow));
    for(let i=0;i<8;i++) {
      const angle=(i+.5)*Math.PI/4;
      shapes.push({...poly([[-.35,-.4],boss[i],boss[(i+1)%8]],mixColor(visual.base,visual.edge,Math.max(.08,(-Math.cos(angle)-Math.sin(angle))*.32+.22))),surface:{...gearSurface('steel',i,[Math.cos(angle)*.7,Math.sin(angle)*.7,.7]),facet:true}});
    }
  } else {
    for (const side of [-1,1]) shapes.push({...poly([[0,-9],[side*5.8,-7],[side*5,3],[0,11]],mixColor(visual.base,side<0?visual.edge:visual.shadow,.12)),surface:gearSurface('steel',5,[side*.4,-.1,.91])});
    shapes.push({...poly([[-.5,-8],[.3,-9.5],[1,4],[0,10],[-.6,4]], visual.trim),surface:gearSurface('brass',4)});
    for(const side of [-1,1]) shapes.push({...poly([[side*.8,-4],[side*4.5,-6.5],[side*3.8,-1.5],[side*1.3,1.8]],visual.trim),surface:gearSurface('brass',6)});
  }
  for (let i=0;i<(round?8:edge.length);i++) {
    const p=round ? [Math.cos(i*Math.PI/4)*7.45,Math.sin(i*Math.PI/4)*8.05] : [edge[i][0]*.91,edge[i][1]*.91];
    shapes.push(poly(gem(p[0],p[1]+.12,.42,.42),visual.shadow),poly(gem(p[0]-.07,p[1]-.12,.27,.27),visual.trim));
  }
  const result=materializeGear(shapes,'steel',29,new Map([[visual.trim,'brass']])).map(shape=>shape.surface?.material==='steel'&&visual.material?{...shape,surface:{...shape.surface,material:visual.material}}:shape);
  shieldCache.set(visual,result); return result;
}

/** SVG and Canvas use these same points, keeping icons faithful to equipped silhouettes. */
/** Accept only bounded color forms emitted by the procedural material helpers. */
export function gearShapeColor(value: string): string {
  if (/^#[a-f0-9]{6}$/i.test(value)) return value;
  const rgb = /^rgb\((\d{1,3}),(\d{1,3}),(\d{1,3})\)$/.exec(value);
  if (rgb && rgb.slice(1).every(n => Number(n) <= 255)) return '#' + rgb.slice(1).map(n => Number(n).toString(16).padStart(2, '0')).join('');
  return '#829487';
}

export function gearShapesSVG(shapes: readonly GearShape[], fine = true, prefix = 'gear'): string {
  const definitions: string[] = [];
  const result = shapes.filter(shape => fine || !shape.fine).map((shape,i) => {
    const points=shape.points.map(p=>p.map(v=>Math.round(v*100)/100).join(',')).join(' ');
    let fill=shape.fill ? gearShapeColor(shape.fill) : 'none', marks='';
    if (shape.fill && shape.surface) {
      const id=`${prefix}-surface-${i}`, xs=shape.points.map(p=>p[0]),ys=shape.points.map(p=>p[1]);
      const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
      definitions.push(`<linearGradient id="${id}" x1="0" y1="0" x2=".8" y2="1">${gearMaterialStops(fill,shape.surface).map(([at,color])=>`<stop offset="${at}" stop-color="${gearShapeColor(color)}"/>`).join('')}</linearGradient>`);
      fill=`url(#${id}) ${fill}`;
      if(fine && !shape.fine && w*h>5) {
        definitions.push(`<clipPath id="${id}-clip"><polygon points="${points}"/></clipPath>`);
        marks=`<g clip-path="url(#${id}-clip)" stroke="${gearShapeColor(shape.fill)}" opacity=".13" stroke-width=".1">${gearMaterialMarks(shape.surface,[x,y,w,h]).map(mark=>`<polyline fill="none" points="${mark.map(p=>p.join(',')).join(' ')}"/>`).join('')}</g>`;
      }
    }
    return `<${shape.fill?'polygon':'polyline'} points="${points}" fill="${fill}"${shape.stroke?` stroke="${gearShapeColor(shape.stroke)}" stroke-width="${shape.width??.7}" stroke-linejoin="round" stroke-linecap="round"`:''}/>${marks}`;
  }).join('');
  return `<defs>${definitions.join('')}</defs>${result}`;
}
