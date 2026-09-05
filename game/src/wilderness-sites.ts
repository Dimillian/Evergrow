import { sampleBiome, type BiomeId } from './biomes.ts';
import { mainPathX, pathDistance } from './road-shape.ts';
import type { EnemyKind } from './model.ts';
import type { EnemyRank } from './progression-content.ts';
import type { WorldPOI } from './world-pois.ts';

export const WILDERNESS_RULES = Object.freeze({ cellSize: 1600, maxRadius: 220, cacheLimit: 128, maxQueryCells: 4096 });
export type WildernessKind = 'camp' | 'watchtower' | 'graveyard' | 'standingStones' | 'caravan';
export type SiteDecorKind = 'tent' | 'fire' | 'crate' | 'barrel' | 'banner' | 'fence' | 'bones' | 'bedroll'
  | 'tower' | 'gravestone' | 'standingStone' | 'altar' | 'wagon' | 'wheel' | 'lantern';
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
const UINT_RANGE = 0x100000000;
export function siteHash(x: number, y: number, seed: number, salt = 0): number {
  let n = (seed ^ salt ^ Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(y | 0, 0x27d4eb2d)
    ^ Math.imul(Math.floor(x / UINT_RANGE), 0x165667b1) ^ Math.imul(Math.floor(y / UINT_RANGE), 0x85ebca77)) >>> 0;
  n = Math.imul(n ^ n >>> 16, 0x7feb352d); n = Math.imul(n ^ n >>> 15, 0x846ca68b);
  return (n ^ n >>> 16) >>> 0;
}
const random = (seed: number, salt: number) => siteHash(seed, salt, 97183) / UINT_RANGE;
const KINDS: readonly WildernessKind[] = ['camp', 'camp', 'camp', 'watchtower', 'graveyard', 'standingStones', 'caravan'];
const DESCRIPTIONS: Record<WildernessKind, string> = {
  camp: 'A watchfire among stitched hides and stolen supplies. Its sentries guard the approaches; defeating the whole garrison clears this camp for the current run.',
  watchtower: 'A broken signal tower, its lantern still burning above an overgrown patrol court.',
  graveyard: 'Weathered names, crooked vigil stones and an open iron gate beneath the trees.',
  standingStones: 'An ancient ring of engraved monoliths. Pale light threads between the stones.',
  caravan: 'A stranded caravan with torn canvas, scattered cargo and a lantern left for the missing travellers.',
};
const NAMES: Record<WildernessKind, readonly string[]> = {
  camp: ['Ashen Watch', 'Blackbriar Camp', 'The Ragged Vigil', 'Emberfang Hollow'],
  watchtower: ['The Hollow Beacon', 'Mournwatch Ruin', 'The Last Signal'],
  graveyard: ['The Nameless Rest', 'Briargrave', 'The Silent Acre'],
  standingStones: ['The Moonless Circle', 'The Listening Stones', 'The Elder Choir'],
  caravan: ['The Broken Procession', 'Wayfarer’s End', 'The Abandoned Convoy'],
};

function makeSite(seed: number, id: string, kind: WildernessKind, x: number, y: number, starter = false, biome: BiomeId = sampleBiome(x, y, seed).id): WildernessSite {
  const radius = kind === 'camp' ? 205 : kind === 'graveyard' ? 172 : kind === 'standingStones' ? 165 : 160;
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
    member(starter ? 'stalker' : biome === 'swamp' ? 'caster' : 'brute', 0, -68,
      !starter && Math.hypot(x, y - 68) >= 6400 && random(seed, 29) > .72 ? 'elite' : 'veteran');
    member('archer', 71, 0); member('hound', -56, 74); member('stalker', 53, 104);
    if (!starter) { member(biome === 'swamp' ? 'wisp' : 'caster', -57, -11); member(biome === 'verdant' ? 'hound' : 'stalker', -27, 113); }
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
  } else {
    add('wagon', -52, -51, 29, 1.18, -.07); add('wagon', 66, 32, 25, .95, .2);
    add('wheel', -104, -6, 0, 1, .3); add('crate', -50, 36, 11); add('crate', -76, 46, 11, .85);
    add('barrel', 18, -60, 10); add('bedroll', 3, 55, 0, 1, -.4); add('lantern', -17, -45, 3);
    add('bones', 90, -22, 0, 1.1); add('fire', -60, 110, 9, .6);
  }
  const entrance = Object.freeze({ x, y: y + radius });
  return Object.freeze({ id, kind, x, y, radius, name: starter ? 'Ashen Watch' : NAMES[kind][seed % NAMES[kind].length],
    description: DESCRIPTIONS[kind], biome, seed, entrance, decor: Object.freeze(decor), members: Object.freeze(members) });
}

/** A small first garrison is reachable east of the starting clearing without crossing a town. */
export function startingEnemyCamp(seed: number): WildernessSite {
  return makeSite(seed, `site:${seed}:first-camp`, 'camp', 740, 180, true);
}

/** Each cell owns at most one immutable site; placement never depends on query order or live entities. */
export function generateWildernessSite(worldSeed: number, cx: number, cy: number, reserved: SiteReservation): WildernessSite | null {
  const seed = siteHash(cx, cy, worldSeed, 0x87231);
  const kind = KINDS[seed % KINDS.length];
  const radius = kind === 'camp' ? 205 : 172;
  for (let attempt = 0; attempt < 4; attempt++) {
    const x = (cx + .5) * WILDERNESS_RULES.cellSize + (random(seed, attempt * 2 + 1) - .5) * 560;
    const y = (cy + .5) * WILDERNESS_RULES.cellSize + (random(seed, attempt * 2 + 2) - .5) * 560;
    if (Math.hypot(x, y) < radius + 470 || Math.hypot(x - 740, y - 180) < radius + 300) continue;
    // Distance is normalised by road slope; this margin also covers its curvature and shoulder.
    if (pathDistance(x, y) < radius + 120 || Math.abs(x - mainPathX(y)) < radius + 120 || reserved(x, y, radius + 55)) continue;
    return makeSite(seed, `site:${worldSeed}:${cx}:${cy}`, kind, x, y, false, sampleBiome(x, y, worldSeed).id);
  }
  return null;
}

export function wildernessPOI(site: WildernessSite): WorldPOI {
  return { id: site.id, name: site.name, kind: site.kind, x: site.x, y: site.y, description: site.description };
}
