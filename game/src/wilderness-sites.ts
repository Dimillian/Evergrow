import { withGoblinWarband } from './goblin-camps.ts';
import { sampleBiome, type BiomeId } from './biomes.ts';
import { roadPaths, pathDistance } from './road-shape.ts';
import type { EnemyKind } from './model.ts';
import type { EnemyRank } from './progression-content.ts';
import type { WorldPOI } from './world-pois.ts';

export const WILDERNESS_RULES = Object.freeze({ cellSize: 1400, maxRadius: 280, cacheLimit: 128, maxQueryCells: 4096 });
export type WildernessKind = 'camp' | 'watchtower' | 'graveyard' | 'standingStones' | 'caravan' | 'cursedChest' | 'ruinedChapel' | 'beastDen' | 'quarry' | 'hamlet' | 'crossing' | 'corruptedGrove';
export type SiteDecorKind = 'tent' | 'fire' | 'crate' | 'barrel' | 'banner' | 'fence' | 'bones' | 'bedroll'
  | 'nest' | 'arch' | 'crystal' | 'cottage' | 'root' | 'barricade' | 'tower' | 'gravestone' | 'standingStone' | 'altar' | 'wagon' | 'wheel' | 'lantern';
export interface SiteDecor {
  readonly id: string; readonly kind: SiteDecorKind; readonly x: number; readonly y: number;
  readonly radius: number; readonly scale: number; readonly angle: number; readonly seed: number;
}
export interface CampMember {
  readonly id: string; readonly kind: EnemyKind; readonly rank: EnemyRank; readonly dx: number; readonly dy: number;
}
export interface EnemyCamp {
  readonly id: string; readonly x: number; readonly y: number; readonly radius: number;
  readonly members: readonly CampMember[];
}
export interface WildernessSite extends EnemyCamp {
  readonly kind: WildernessKind; readonly name: string; readonly description: string;
  readonly biome: BiomeId; readonly seed: number; readonly decor: readonly SiteDecor[];
  /** Ground paths meet this open entrance; geometry stays fixed after the camp is cleared. */
  readonly entrance: { readonly x: number; readonly y: number };
}
export type SiteReservation = (x: number, y: number, radius: number) => boolean;
/** Camp silhouettes and slot geometry stay shared while the climate supplies cloth and soil materials. */
export interface WildernessBiomeTheme {
  readonly cloth: string; readonly lining: string; readonly trim: string; readonly banner: string; readonly earthRgb: string;
}
export const WILDERNESS_BIOME_THEMES: Readonly<Record<BiomeId, WildernessBiomeTheme>> = Object.freeze({
  steppe: Object.freeze({ cloth: '#666a43', lining: '#979568', trim: '#d0bf8a', banner: '#859068', earthRgb: '147,138,89' }),
  sunscar: Object.freeze({ cloth: '#8f6b4a', lining: '#c7aa79', trim: '#e5ca9a', banner: '#bd855c', earthRgb: '168,139,98' }),
  deadwood: Object.freeze({ cloth: '#875146', lining: '#94815e', trim: '#c5b384', banner: '#9b4e49', earthRgb: '141,120,82' }),
  verdant: Object.freeze({ cloth: '#586e47', lining: '#8b9263', trim: '#c1bd85', banner: '#728b49', earthRgb: '119,134,86' }),
  swamp: Object.freeze({ cloth: '#46726c', lining: '#809587', trim: '#b5bfa3', banner: '#3f8e88', earthRgb: '134,121,84' }),
  frostpine: Object.freeze({ cloth: '#546d89', lining: '#91aab9', trim: '#ceddd7', banner: '#779bb3', earthRgb: '161,179,184' }),
  emberfall: Object.freeze({ cloth: '#723f36', lining: '#aa6b47', trim: '#d8a074', banner: '#b95836', earthRgb: '129,100,86' }),
  autumn: Object.freeze({ cloth: '#8b653e', lining: '#b48c51', trim: '#dbbc7b', banner: '#bc7d3e', earthRgb: '157,123,75' }),
  highlands: Object.freeze({ cloth: '#67617f', lining: '#9991a7', trim: '#c4c0ba', banner: '#84729b', earthRgb: '144,145,140' }),
});

/** Six authored roles, in the shared leader / sentry / hunter / guard / support / rear-guard slots. */
export const CAMP_BIOME_ROSTERS: Readonly<Record<BiomeId, readonly [EnemyKind, EnemyKind, EnemyKind, EnemyKind, EnemyKind, EnemyKind]>> = Object.freeze({
  steppe: Object.freeze(['hound','archer','hound','stalker','archer','brute'] as const),
  sunscar: Object.freeze(['stalker','caster','brute','archer','hound','stalker'] as const),
  deadwood: Object.freeze(['brute', 'archer', 'hound', 'stalker', 'caster', 'stalker'] as const),
  verdant: Object.freeze(['archer', 'archer', 'hound', 'stalker', 'caster', 'hound'] as const),
  swamp: Object.freeze(['caster', 'archer', 'hound', 'stalker', 'wisp', 'stalker'] as const),
  frostpine: Object.freeze(['wisp', 'archer', 'hound', 'stalker', 'caster', 'hound'] as const),
  emberfall: Object.freeze(['brute', 'archer', 'hound', 'stalker', 'caster', 'brute'] as const),
  autumn: Object.freeze(['archer', 'archer', 'hound', 'stalker', 'caster', 'hound'] as const),
  highlands: Object.freeze(['brute', 'archer', 'hound', 'stalker', 'archer', 'stalker'] as const),
});

const UINT_RANGE = 0x100000000;
export function siteHash(x: number, y: number, seed: number, salt = 0): number {
  let n = (seed ^ salt ^ Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(y | 0, 0x27d4eb2d)
    ^ Math.imul(Math.floor(x / UINT_RANGE), 0x165667b1) ^ Math.imul(Math.floor(y / UINT_RANGE), 0x85ebca77)) >>> 0;
  n = Math.imul(n ^ n >>> 16, 0x7feb352d); n = Math.imul(n ^ n >>> 15, 0x846ca68b);
  return (n ^ n >>> 16) >>> 0;
}
const random = (seed: number, salt: number) => siteHash(seed, salt, 97183) / UINT_RANGE;
const KINDS: readonly WildernessKind[] = ['camp', 'camp', 'watchtower', 'graveyard', 'standingStones', 'caravan', 'cursedChest', 'ruinedChapel', 'beastDen', 'quarry', 'hamlet', 'crossing', 'corruptedGrove'];
const DESCRIPTIONS: Record<WildernessKind, string> = {
  cursedChest:'A chained hoard. Clear waves before the curse expires.', ruinedChapel:'Broken arches shelter a forbidden ritual.', beastDen:'Tracks converge around a hungry brood.', quarry:'Cut stone and exposed crystal beneath abandoned workings.', hamlet:'Occupied homes around a ruined square.', crossing:'A guarded passage along the trade road.', corruptedGrove:'Living roots bind an infected heartwood.',
  camp: 'A watchfire among stitched hides and stolen supplies. Its sentries guard the approaches; defeating the whole garrison clears this camp for the current run.',
  watchtower: 'A broken signal tower, its lantern still burning above an overgrown patrol court.',
  graveyard: 'Weathered names, crooked vigil stones and an open iron gate beneath the trees.',
  standingStones: 'An ancient ring of engraved monoliths. Pale light threads between the stones.',
  caravan: 'A stranded caravan with torn canvas, scattered cargo and a lantern left for the missing travellers.',
};
const NAMES: Record<WildernessKind, readonly string[]> = {
  cursedChest:['The Hungry Hoard','Widow’s Fortune','The Bound Coffer'], ruinedChapel:['Chapel of Ash','The Broken Covenant','Moonfall Chapel'], beastDen:['The Gnawing Hollow','Briarfang Den','The Red Nest'], quarry:['Shiverstone Quarry','The Hollow Cut','Old Silverworks'], hamlet:['Forsaken Hearths','Blackthorn Hamlet','The Empty Square'], crossing:['Warden’s Crossing','The Broken Toll','Ashford Blockade'], corruptedGrove:['The Blighted Heart','Weeping Roots','The Twisted Orchard'],
  camp: ['Ashen Watch', 'Blackbriar Camp', 'The Ragged Vigil', 'Emberfang Hollow'],
  watchtower: ['The Hollow Beacon', 'Mournwatch Ruin', 'The Last Signal'],
  graveyard: ['The Nameless Rest', 'Briargrave', 'The Silent Acre'],
  standingStones: ['The Moonless Circle', 'The Listening Stones', 'The Elder Choir'],
  caravan: ['The Broken Procession', 'Wayfarer’s End', 'The Abandoned Convoy'],
};

function makeSite(seed: number, id: string, kind: WildernessKind, x: number, y: number, starter = false, biome: BiomeId = sampleBiome(x, y, seed).id, worldSeed = seed): WildernessSite {
  const radius = ['hamlet','quarry','ruinedChapel'].includes(kind) ? 270 : kind === 'camp' ? 205 : kind === 'graveyard' ? 172 : kind === 'standingStones' ? 165 : 160;
  const decor: SiteDecor[] = [], members: CampMember[] = [];
  const add = (kind: SiteDecorKind, dx: number, dy: number, radius: number, scale = 1, angle = 0) => {
    decor.push(Object.freeze({ id: `${id}:decor:${decor.length}`, kind, x: x + dx, y: y + dy, radius, scale, angle,
      seed: siteHash(seed, decor.length, 3167) }));
  };
  const member = (kind: EnemyKind, dx: number, dy: number, rank: EnemyRank = 'normal') => {
    members.push(Object.freeze({ id: `${id}:member:${members.length}`, kind, rank, dx, dy }));
  };
  if (kind === 'camp') {
    add('tent', -87, -75, 34, 1.15); add('tent', 88, -91, 31, 1.02);
    add('fire', 0, 0, 13); add('banner', 132, -10, 5, 1.15);
    add('crate', -112, 28, 12); add('crate', -132, 4, 11, .85); add('barrel', -129, 49, 10);
    add('bedroll', 80, 62, 0, 1.1, .17); add('bedroll', 106, 72, 0, .95, -.12);
    add('lantern', -57, -104, 3); add('bones', 42, 122, 0, 1.2, -.4);
    for (const [dx, dy, angle] of [[-139, -88, -.3], [-116, -142, .1], [-47, -158, .02], [42, -164, -.03], [126, -148, .25], [159, -93, 1.0], [164, -30, 1.5], [153, 60, 1.8], [91, 138, -.2], [-72, 145, .15]]) add('fence', dx, dy, 9, 1, angle);
    const roster = CAMP_BIOME_ROSTERS[biome];
    member(starter ? 'stalker' : roster[0], 0, -68,
      !starter && Math.hypot(x, y - 68) >= 6400 && random(seed, 29) > .72 ? 'elite' : 'veteran');
    member(starter ? 'archer' : roster[1], 71, 0);
    member(starter ? 'hound' : roster[2], -56, 74);
    member(starter ? 'stalker' : roster[3], 53, 104);
    if (!starter) { member(roster[4], -57, -11); member(roster[5], -27, 113); member('stalker', 8, 68); member('hound', -34, -65); }
  } else if (kind === 'watchtower') {
    add('tower', 0, -48, 37, 1.15); add('lantern', 33, -51, 3, 1.2);
    add('banner', -77, -4, 5, 1.05); add('crate', 67, 45, 13); add('barrel', 89, 30, 10);
    add('bones', -18, 56, 0, 1.2); add('bedroll', -69, 55, 0, 1, .3);
    for (const [dx, dy] of [[-99, -63], [-95, -106], [65, -108], [106, -70], [109, 2]]) add('fence', dx, dy, 8, .8, .2);
  } else if (kind === 'graveyard') {
    add('altar', 0, -98, 26, 1.5); add('lantern', -43, -87, 3); add('lantern', 43, -87, 3);
    for (let row = 0; row < 3; row++) for (const dx of [-89, -47, 48, 89]) add('gravestone', dx + (random(seed, row * 31 + dx) - .5) * 9, -48 + row * 50, 7, .83 + random(seed, row + dx) * .3, (random(seed, row * 13 + dx) - .5) * .12);
    for (const [dx, dy] of [[-128, -89], [-132, -25], [-129, 43], [127, -89], [133, -25], [132, 46], [-88, 116], [84, 117]]) add('fence', dx, dy, 8, 1, Math.abs(dx) > 120 ? Math.PI / 2 : 0);
    add('bones', -20, 65, 0, .8); add('banner', -29, 120, 4, .8);
  } else if (kind === 'standingStones') {
    add('altar', 0, -3, 21, 1.1);
    for (let i = 0; i < 7; i++) {
      const angle = (i / 8 + .375) * Math.PI * 2;
      add('standingStone', Math.cos(angle) * 109, Math.sin(angle) * 91, 14, .9 + random(seed, i) * .4, (random(seed, i + 30) - .5) * .08);
    }
    add('bones', -44, 24, 0); add('lantern', 59, 28, 0, .65);
  } else if (kind === 'caravan') {
    add('wagon', -52, -51, 29, 1.18, -.07); add('wagon', 66, 32, 25, .95, .2);
    add('wheel', -104, -6, 0, 1, .3); add('crate', -50, 36, 11); add('crate', -76, 46, 11, .85);
    add('barrel', 18, -60, 10); add('bedroll', 3, 55, 0, 1, -.4); add('lantern', -17, -45, 3);
    add('bones', 90, -22, 0, 1.1); add('fire', -60, 110, 9, .6);
  }
  if (kind === 'ruinedChapel') {
    add('arch',0,-110,30,1.7); add('altar',0,-45,21,1.4);
    for(const side of [-1,1])for(let i=0;i<3;i++){add('standingStone',side*125,-100+i*65,15,.8);add('lantern',side*70,-80+i*65,0,.7);}
    add('gravestone',-190,30,7); add('bones',65,88,0);
  } else if(kind === 'beastDen') {
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3;add('nest',Math.cos(a)*95,Math.sin(a)*65-35,16,1.1+i*.1);}
    add('arch',0,-100,26,1.2);for(let i=0;i<6;i++)add('bones',(i-2.5)*32,70+Math.sin(i)*25,0,1);
  } else if(kind === 'quarry') {
    for(const side of [-1,1])for(let i=0;i<3;i++){add('standingStone',side*(145+i*13),-130+i*95,18,1.3);add('crystal',side*105,-115+i*90,10,1+i*.2);}
    add('wheel',-55,75,0);add('crate',60,70,11);add('lantern',-80,-80,0);
  } else if(kind === 'hamlet') {
    for(const [dx,dy] of [[-145,-110],[145,-100],[-145,65],[145,70]])add('cottage',dx,dy,36,1.05);
    add('banner',0,-70,4,1.5);add('fire',0,10,10);add('crate',65,75,10);
  } else if(kind === 'crossing') {
    for(const side of [-1,1]){add('barricade',side*100,0,15,1.2);add('banner',side*140,-48,4);add('crate',side*85,60,10);}
    add('wagon',150,-90,25,.8);add('lantern',-130,45,0);
  } else if(kind === 'corruptedGrove') {
    add('root',0,-80,24,1.8);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;add('root',Math.cos(a)*118,Math.sin(a)*78-20,12,.8);}
    add('altar',-48,45,12,.7);
  } else if(kind === 'cursedChest') {
    for(const side of [-1,1]){add('gravestone',side*65,-10,9,1.2);add('bones',side*45,40,0);add('lantern',side*28,12,0,.7);}
  }
  const entrance = Object.freeze({ x, y: y + radius });
  const raw = withGoblinWarband({ id, kind, x, y, radius, name: starter ? 'Ashen Watch' : NAMES[kind][seed % NAMES[kind].length],
    description: DESCRIPTIONS[kind], biome, seed, entrance, decor, members });
  // Front-facing chapel architecture needs an aligned aisle and entrance.
  // Other sites orient their approach toward nearby roads or vary freely inland.
  const roads = starter ? [] : roadPaths(x-1800,y-1800,3600,3600,worldSeed);
  let roadPoint:{x:number;y:number;distance:number}|undefined;
  for(const road of roads)for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
    const px=a[0]+dx*t,py=a[1]+dy*t,distance=Math.hypot(px-x,py-y);
    if(!roadPoint||distance<roadPoint.distance)roadPoint={x:px,y:py,distance};
  }
  const angle=starter||kind==='ruinedChapel'?0:roadPoint&&roadPoint.distance<1500?Math.atan2(roadPoint.y-y,roadPoint.x-x)-Math.PI/2:random(seed,911)*Math.PI*2;
  const rotate=(dx:number,dy:number)=>({x:dx*Math.cos(angle)-dy*Math.sin(angle),y:dx*Math.sin(angle)+dy*Math.cos(angle)});
  const entry=rotate(0,radius);
  return Object.freeze({...raw,entrance:Object.freeze({x:x+entry.x,y:y+entry.y}),
    decor:Object.freeze(raw.decor.map(d=>{const p=rotate(d.x-x,d.y-y);return Object.freeze({...d,x:x+p.x,y:y+p.y,angle:['fence','bedroll','wheel','bones'].includes(d.kind)?d.angle+angle:d.angle});})),
    members:Object.freeze(raw.members.map(m=>{const p=rotate(m.dx,m.dy);return Object.freeze({...m,dx:p.x,dy:p.y});}))});
}

/** A small first garrison is reachable east of the starting clearing without crossing a town. */
export function startingEnemyCamp(seed: number): WildernessSite {
  return makeSite(seed, `site:${seed}:first-camp`, 'camp', 740, 180, true);
}

/** Each cell owns at most one immutable site; placement never depends on query order or live entities. */
export function generateWildernessSite(worldSeed: number, cx: number, cy: number, reserved: SiteReservation): WildernessSite | null {
  const seed = siteHash(cx, cy, worldSeed, 0x87231);
  const centerX=(cx+.5)*WILDERNESS_RULES.cellSize,centerY=(cy+.5)*WILDERNESS_RULES.cellSize;
  const biome=sampleBiome(centerX,centerY,worldSeed).id;
  const favored:Record<BiomeId,readonly WildernessKind[]>={steppe:['beastDen','crossing'],sunscar:['quarry','cursedChest'],deadwood:['graveyard','ruinedChapel','cursedChest'],verdant:['beastDen','corruptedGrove'],swamp:['corruptedGrove','standingStones'],frostpine:['beastDen','quarry'],emberfall:['quarry','cursedChest'],autumn:['hamlet','caravan'],highlands:['quarry','watchtower']};
  const region=siteHash(Math.floor(cx/4),Math.floor(cy/4),worldSeed,819);
  const pool=[...KINDS,...favored[biome],KINDS[region%KINDS.length],KINDS[region%KINDS.length]];
  const kind=pool[seed%pool.length],radius=['hamlet','quarry','ruinedChapel'].includes(kind)?270:205;
  const roadside=['caravan','crossing','hamlet'].includes(kind);
  let best:{x:number;y:number;score:number}|null=null;
  for(let attempt=0;attempt<12;attempt++){
    const x=centerX+(random(seed,attempt*2+1)-.5)*640,y=centerY+(random(seed,attempt*2+2)-.5)*640;
    if(Math.hypot(x,y)<radius+510||Math.hypot(x-740,y-180)<radius+300)continue;
    const road=pathDistance(x,y,worldSeed);
    if(road<(roadside?radius+35:radius+120)||roadside&&road>radius+450)continue;
    if(reserved(x,y,radius+55))continue;
    // Validate the whole footprint, including approaches, against water/settlements.
    if(Array.from({length:8},(_,i)=>i*Math.PI/4).some(a=>reserved(x+Math.cos(a)*radius,y+Math.sin(a)*radius,35)))continue;
    const score=roadside?Math.abs(road-(radius+100)):Math.abs(road-1000)*.15+random(seed,attempt+81)*220;
    if(!best||score<best.score)best={x,y,score};
  }
  if(best)return makeSite(seed,`site:${worldSeed}:${cx}:${cy}`,kind,best.x,best.y,false,sampleBiome(best.x,best.y,worldSeed).id,worldSeed);
  return null;
}

export function wildernessPOI(site: WildernessSite): WorldPOI {
  return { id: site.id, name: site.name, kind: site.kind, x: site.x, y: site.y, description: site.description };
}
