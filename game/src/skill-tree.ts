import type { ActionResult, CharacterSheet, SkillId, StatKey, StatModifiers } from './character-types.ts';
import { SKILL_DEFINITIONS, skillRequirementLabel } from './skill-content.ts';

export type SkillDomain = 'Might' | 'Cunning' | 'Arcana';
export interface SkillNode {
  readonly id: string; readonly name: string; readonly description: string;
  readonly x: number; readonly y: number;
  readonly kind: 'origin' | 'minor' | 'major' | 'notable';
  readonly domain: SkillDomain;
  readonly bonuses: Readonly<StatModifiers>;
  readonly skill?: SkillId;
  readonly cluster?: string;
  readonly role?: 'travel' | 'cluster';
  readonly neighbors: readonly string[];
}
export interface SkillEdge { readonly from: string; readonly to: string; readonly control?: Readonly<Point>; }
export interface SkillCluster { readonly id: string; readonly name: string; readonly domain: SkillDomain; readonly x: number; readonly y: number; readonly radius: number; }
export const SKILL_TREE_ORIGIN = 'origin';

interface Point { x: number; y: number; }
interface Family { name: string; description: string; minor: StatModifiers; notable: StatModifiers; }
interface WeaponSchool { id: string; name: string; angle: number; skills: readonly SkillId[]; }
interface Region { domain: SkillDomain; angle: number; schools: readonly WeaponSchool[]; attribute: StatKey; }
interface Blueprint extends SkillCluster { family: Family; shape: number; rotation: number; count: number; }
interface Route { a: number; b: number; }
type MutableNode = Omit<SkillNode, 'neighbors'> & { neighbors: string[] };
const TAU = Math.PI * 2;
const REGIONS: readonly Region[] = [
  { domain: 'Might', angle: 2.67, attribute: 'strength', schools: [
    { id: 'blade', name: 'Way of the Blade', angle: -.48, skills: ['cleave', 'lunge'] },
    { id: 'heavy', name: 'Way of the Colossus', angle: 0, skills: ['whirlwind', 'earthshatter'] },
    { id: 'shield', name: 'Way of the Sentinel', angle: .48, skills: ['shieldBash', 'bulwark'] },
  ] },
  { domain: 'Cunning', angle: .5, attribute: 'dexterity', schools: [
    { id: 'marksman', name: 'Way of the Marksman', angle: -.48, skills: ['volley', 'piercingShot'] },
    { id: 'ranger', name: 'Way of the Ranger', angle: 0, skills: ['ricochet', 'rainOfArrows'] },
    { id: 'dagger', name: 'Way of the Dagger', angle: .48, skills: ['backstab'] },
  ] },
  { domain: 'Arcana', angle: -1.55, attribute: 'intelligence', schools: [
    { id: 'flame', name: 'Way of the Pyromancer', angle: -.48, skills: ['fireball', 'meteor'] },
    { id: 'frost', name: 'Way of the Winter Star', angle: 0, skills: ['iceNova', 'frostLance'] },
    { id: 'spirit', name: 'Way of the Stormcaller', angle: .48, skills: ['arcLightning', 'siphon'] },
  ] },
];
const FAMILIES: Readonly<Record<SkillDomain, readonly Family[]>> = {
  Might: [
    { name: 'Tempered Edge', description: 'Increase the damage of your weapon attacks.', minor: { damagePercent: 4 }, notable: { damagePercent: 12, strength: 3 } },
    { name: 'Heart of Iron', description: 'Build a larger life reserve to withstand heavy hits.', minor: { maxHp: 8 }, notable: { maxHp: 28, vitality: 3 } },
    { name: 'Stonebound', description: 'Reduce incoming damage with stronger armor.', minor: { armor: 6 }, notable: { armor: 24, vitality: 2 } },
    { name: 'Sanguine Vow', description: 'Recover life steadily during and between fights.', minor: { lifeRegen: .12 }, notable: { lifeRegen: .45, maxHp: 12 } },
    { name: 'Titan Grip', description: 'Build strength to make every weapon strike heavier.', minor: { strength: 2 }, notable: { strength: 6, damagePercent: 6 } },
    { name: 'Bloodletting', description: 'Drive deeper wounds with stronger weapon attacks.', minor: { damagePercent: 3 }, notable: { damagePercent: 8, lifeOnHit: 1 } },
    { name: 'Battle Rhythm', description: 'Shorten the time between weapon attacks.', minor: { attackSpeedPercent: 2 }, notable: { attackSpeedPercent: 7, strength: 2 } },
  ],
  Cunning: [
    { name: 'Perfect Opening', description: 'Land critical hits more often.', minor: { critChance: 1 }, notable: { critChance: 3, critDamage: 10 } },
    { name: 'Ghost Step', description: 'Move faster to reposition between attacks.', minor: { moveSpeedPercent: 1 }, notable: { moveSpeedPercent: 4, dexterity: 3 } },
    { name: 'Waking Steel', description: 'Recover your weapon sooner for the next strike.', minor: { attackSpeedPercent: 2 }, notable: { attackSpeedPercent: 7, dexterity: 3 } },
    { name: 'Vital Strike', description: 'Make your critical hits more damaging.', minor: { critDamage: 4 }, notable: { critDamage: 16, critChance: 1 } },
    { name: 'Falcon Eye', description: 'Sharpen dexterity for faster attacks and more frequent critical hits.', minor: { dexterity: 2 }, notable: { dexterity: 6, critChance: 1 } },
    { name: 'Keen Pursuit', description: 'Increase weapon damage to bring enemies down sooner.', minor: { damagePercent: 4 }, notable: { damagePercent: 12, moveSpeedPercent: 2 } },
    { name: 'Borrowed Time', description: 'Bring skills and dodge charges back sooner.', minor: { cooldownPercent: 1 }, notable: { cooldownPercent: 3, attackSpeedPercent: 3 } },
  ],
  Arcana: [
    { name: 'Inner Flame', description: 'Increase the damage dealt by your spells.', minor: { spellDamagePercent: 4 }, notable: { spellDamagePercent: 14, intelligence: 3 } },
    { name: 'Astral Reservoir', description: 'Expand your mana reserve for longer sequences of spells.', minor: { maxMana: 7 }, notable: { maxMana: 24, manaRegen: .25 } },
    { name: 'Quiet Current', description: 'Restore mana faster between casts.', minor: { manaRegen: .15 }, notable: { manaRegen: .5, maxMana: 10 } },
    { name: 'Continuum', description: 'Reduce skill cooldowns and dodge recharge time.', minor: { cooldownPercent: 1 }, notable: { cooldownPercent: 3, spellDamagePercent: 5 } },
    { name: 'Higher Thought', description: 'Develop intelligence to strengthen spells and expand mana.', minor: { intelligence: 2 }, notable: { intelligence: 6, maxMana: 12 } },
    { name: 'Soul Stitch', description: 'Restore life steadily as you move and fight.', minor: { lifeRegen: .12 }, notable: { lifeRegen: .4, intelligence: 3 } },
    { name: 'Spirit Ward', description: 'Increase maximum life to survive incoming hits.', minor: { maxHp: 8 }, notable: { maxHp: 22, maxMana: 10 } },
  ],
};
const EPITHETS = ['Dawn', 'Vigil', 'Ember', 'Crown', 'Hollow', 'Veil', 'Reverie', 'Oath'];
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const polar = (radius: number, angle: number): Point => ({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const quadratic = (a: Point, control: Point, b: Point, t: number): Point => mix(mix(a, control, t), mix(control, b, t), t);
function segmentDistance(p: Point, a: Point, b: Point): number {
  const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / lengthSquared));
  return distance(p, mix(a, b, t));
}
function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < -1 && side(c, d, a) * side(c, d, b) < -1;
}
/** Fixed seed controls layout only; character state never changes the atlas. */
function randomSource(): () => number {
  let state = 0x5a17c9d3;
  return () => { state = Math.imul(state ^ state >>> 15, 0x2c1b3c6d); state = Math.imul(state ^ state >>> 12, 0x297a2d39); return ((state ^= state >>> 15) >>> 0) / 4294967296; };
}

function buildTree() {
  const random = randomSource(), nodes: MutableNode[] = [], edges: SkillEdge[] = [];
  const byId = new Map<string, MutableNode>(), blueprints: Blueprint[] = [], regionTrunks: number[][] = [];
  const add = (node: Omit<MutableNode, 'neighbors'>): MutableNode => {
    const result = { ...node, bonuses: Object.freeze({ ...node.bonuses }), neighbors: [] as string[] };
    nodes.push(result); byId.set(result.id, result); return result;
  };
  const link = (from: string, to: string, control?: Point) => {
    const a = byId.get(from)!, b = byId.get(to)!;
    if (a.neighbors.includes(to)) return;
    a.neighbors.push(to); b.neighbors.push(from);
    edges.push(Object.freeze({ from, to, ...(control ? { control: Object.freeze(control) } : {}) }));
  };
  const travel = (id: string, p: Point, domain: SkillDomain) => add({ id, ...p, kind: 'minor', domain, role: 'travel',
    name: `${domain === 'Might' ? 'Resolve' : domain === 'Cunning' ? 'Instinct' : 'Attunement'} · Path`,
    description: `A connecting path through ${domain.toLowerCase()}. Travel nodes join specialties and allow hybrid routes.`,
    bonuses: { [REGIONS.find(region => region.domain === domain)!.attribute]: 2 } });
  add({ id: SKILL_TREE_ORIGIN, x: 0, y: 0, kind: 'origin', domain: 'Might', name: 'The First Star',
    description: 'Three paths leave the same beginning. Follow a specialty, circle back, or cross into another discipline.', bonuses: {} });

  // Authored winding arteries establish a clear macro structure. Other clusters leave their corridors open.
  for (const [regionIndex, region] of REGIONS.entries()) {
    const trunk: number[] = [];
    for (let station = 0; station < 5; station++) {
      const radius = [660, 1400, 2170, 2950, 3690][station];
      const angle = region.angle + Math.sin(station * 1.6 + regionIndex * .9) * .14;
      trunk.push(blueprints.length);
      blueprints.push({ id: `${region.domain.toLowerCase()}:artery:${station}`, ...polar(radius, angle), domain: region.domain,
        name: `${FAMILIES[region.domain][station].name} · ${EPITHETS[station]}`, family: FAMILIES[region.domain][station],
        radius: 108 + random() * 22, rotation: random() * TAU, shape: station % 4, count: 11 + station % 3 });
    }
    regionTrunks.push(trunk);
  }
  for (const [regionIndex, region] of REGIONS.entries()) {
    let accepted = 0;
    for (let attempt = 0; accepted < 45 && attempt < 16000; attempt++) {
      const radial = 680 + Math.sqrt(random()) * 3250;
      const angle = region.angle + (random() - .5) * 1.89 + Math.sin(radial / 840 + regionIndex) * .085;
      const p = polar(radial, angle), radius = 91 + random() * 42;
      if (blueprints.some(other => distance(p, other) < radius + other.radius + 160)) continue;
      if (regionTrunks.some(trunk => trunk.some((index, station) => {
        const a = station === 0 ? polar(350, REGIONS[regionTrunks.indexOf(trunk)].angle) : blueprints[trunk[station - 1]];
        return segmentDistance(p, a, blueprints[index]) < radius + 80;
      }))) continue;
      const family = FAMILIES[region.domain][Math.floor(random() * FAMILIES[region.domain].length)];
      blueprints.push({ id: `${region.domain.toLowerCase()}:grove:${accepted}`, ...p, domain: region.domain,
        name: `${family.name} · ${EPITHETS[accepted % EPITHETS.length]}`, family, radius, rotation: random() * TAU,
        shape: Math.floor(random() * 4), count: 10 + Math.floor(random() * 5) });
      accepted++;
    }
    if (accepted < 45) throw new Error(`Could not place the ${region.domain} constellations.`);
  }

  const members = new Map<string, MutableNode[]>();
  for (const cluster of blueprints) {
    const group: MutableNode[] = [];
    const count = cluster.shape === 3 ? Math.min(cluster.count, 9) : cluster.shape === 2 ? Math.min(cluster.count, 13) : cluster.count;
    const local = (x: number, y: number) => ({ x: cluster.x + x * Math.cos(cluster.rotation) - y * Math.sin(cluster.rotation),
      y: cluster.y + x * Math.sin(cluster.rotation) + y * Math.cos(cluster.rotation) });
    const put = (p: Point, notable: boolean) => {
      const index = group.length;
      group.push(add({ id: `${cluster.id}:${index}`, ...p, cluster: cluster.id, role: 'cluster',
        domain: cluster.domain, kind: notable ? 'notable' : 'minor',
        name: notable ? cluster.name : cluster.family.name,
        description: cluster.family.description,
        bonuses: notable ? cluster.family.notable : cluster.family.minor }));
    };
    if (cluster.shape < 2) {
      // Unequal ellipses and open crescents have a clear route around a notable, rather than a hub and spokes.
      const span = cluster.shape === 0 ? TAU : Math.PI * 1.62;
      for (let i = 0; i < cluster.count; i++) {
        const angle = -.82 * Math.PI + i / (cluster.shape === 0 ? cluster.count : cluster.count - 1) * span;
        const r = cluster.radius * (1 + .06 * Math.sin(angle * 3));
        put(local(Math.cos(angle) * r, Math.sin(angle) * r * .77), i === Math.floor(cluster.count * .53));
      }
      for (let i = 1; i < group.length; i++) {
        const a = group[i - 1], b = group[i], mid = mix(a, b, .5);
        link(a.id, b.id, { x: cluster.x + (mid.x - cluster.x) * 1.045, y: cluster.y + (mid.y - cluster.y) * 1.045 });
      }
      if (cluster.shape === 0) {
        const a = group[0], b = group[group.length - 1], mid = mix(a, b, .5);
        link(a.id, b.id, { x: cluster.x + (mid.x - cluster.x) * 1.05, y: cluster.y + (mid.y - cluster.y) * 1.05 });
      }
    } else {
      // Three curved fingers create fans; a two-sided bough gives an asymmetrical branching silhouette.
      put(local(0, 0), true);
      const fingers = cluster.shape === 2 ? 3 : 2;
      for (let finger = 0; finger < fingers; finger++) {
        const steps = Math.floor((count - 1 + finger) / fingers);
        let previous = group[0];
        for (let step = 1; step <= steps; step++) {
          const baseAngle = cluster.shape === 2 ? -.72 * Math.PI + finger * .72 * Math.PI : finger * Math.PI + .35;
          const angle = baseAngle + Math.sin(step / steps * Math.PI) * (finger % 2 ? -.4 : .4);
          const r = cluster.radius * step / steps;
          put(local(Math.cos(angle) * r, Math.sin(angle) * r), false);
          const current = group[group.length - 1], midpoint = mix(previous, current, .5);
          link(previous.id, current.id, { x: midpoint.x + Math.cos(baseAngle + cluster.rotation + Math.PI / 2) * 5,
            y: midpoint.y + Math.sin(baseAngle + cluster.rotation + Math.PI / 2) * 5 });
          previous = current;
        }
      }
    }
    members.set(cluster.id, group);
  }

  const routes: Route[] = [], parents = blueprints.map((_, index) => index);
  const root = (index: number): number => { while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; } return index; };
  const join = (a: number, b: number) => { parents[root(a)] = root(b); routes.push({ a, b }); };
  for (const trunk of regionTrunks) for (let i = 1; i < trunk.length; i++) join(trunk[i - 1], trunk[i]);
  const candidates: Array<Route & { length: number }> = [];
  for (let a = 0; a < blueprints.length; a++) for (let b = a + 1; b < blueprints.length; b++) {
    const length = distance(blueprints[a], blueprints[b]);
    if (length < 2050) candidates.push({ a, b, length });
  }
  candidates.sort((a, b) => a.length - b.length || a.a - b.a || a.b - b.b);
  const clear = (a: number, b: number) => !blueprints.some((p, index) => index !== a && index !== b
    && segmentDistance(p, blueprints[a], blueprints[b]) < p.radius + 35)
    && !routes.some(route => route.a !== a && route.a !== b && route.b !== a && route.b !== b
      && crosses(blueprints[a], blueprints[b], blueprints[route.a], blueprints[route.b]));
  for (const { a, b } of candidates) if (root(a) !== root(b) && clear(a, b)) join(a, b);
  if (parents.some((_, index) => root(index) !== root(0))) throw new Error('Skill atlas roads must form a connected graph.');
  // Sparse short crosslinks create useful circuit routes; shared borders receive extra hybrid connections.
  const degree = blueprints.map((_, index) => routes.filter(route => route.a === index || route.b === index).length);
  let loops = 0;
  for (const { a, b, length } of candidates) {
    if (loops >= 47) break;
    if (length > 1140 || degree[a] >= 4 || degree[b] >= 4 || routes.some(route => route.a === a && route.b === b || route.a === b && route.b === a)) continue;
    if (blueprints[a].domain === blueprints[b].domain && random() > .4) continue;
    if (!clear(a, b)) continue;
    routes.push({ a, b }); degree[a]++; degree[b]++; loops++;
  }

  const nearest = (cluster: Blueprint, point: Point) => members.get(cluster.id)!.reduce((a, b) => distance(a, point) < distance(b, point) ? a : b);
  const road = (id: string, a: MutableNode, b: MutableNode, home: SkillDomain, away: SkillDomain, ignore: readonly string[] = []) => {
    const length = distance(a, b), mid = mix(a, b, .5), nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
    let control = mid;
    for (const bend of [Math.min(45, length * .11), -Math.min(45, length * .11), 0]) {
      const candidate = { x: mid.x + nx * bend, y: mid.y + ny * bend };
      let valid = true;
      for (let step = 1; step < 10 && valid; step++) {
        const p = quadratic(a, candidate, b, step / 10);
        valid = !blueprints.some(cluster => !ignore.includes(cluster.id) && distance(p, cluster) < cluster.radius + 16);
      }
      if (valid) { control = candidate; break; }
    }
    const count = Math.max(1, Math.round(length / 55));
    let previous = a, previousT = 0;
    for (let step = 1; step <= count; step++) {
      const t = step / count, p = quadratic(a, control, b, t);
      if (step !== count && nodes.some(node => distance(node, p) < 23)) continue;
      const current = step === count ? b : travel(`${id}:${step}`, p, t < .5 ? home : away);
      // The derivative at each segment's start gives an exact subdivision of the same quadratic curve.
      const tangent = { x: (1 - previousT) * (control.x - a.x) + previousT * (b.x - control.x),
        y: (1 - previousT) * (control.y - a.y) + previousT * (b.y - control.y) };
      link(previous.id, current.id, { x: previous.x + tangent.x * (t - previousT), y: previous.y + tangent.y * (t - previousT) });
      previous = current; previousT = t;
    }
  };
  for (const { a, b } of routes) {
    const from = blueprints[a], to = blueprints[b];
    road(`road:${a}:${b}`, nearest(from, to), nearest(to, from), from.domain, to.domain, [from.id, to.id]);
  }
  for (const [index, region] of REGIONS.entries()) {
    const first = travel(`path:${region.domain.toLowerCase()}:awakening`, polar(76, region.angle + .11), region.domain);
    const threshold = travel(`path:${region.domain.toLowerCase()}:threshold`, polar(165, region.angle - .06), region.domain);
    link(SKILL_TREE_ORIGIN, first.id, polar(37, region.angle + .22));
    link(first.id, threshold.id, polar(124, region.angle + .06));
    const schoolStarts: MutableNode[] = [];
    for (const school of region.schools) {
      const angle = region.angle + school.angle;
      const entrance = add({ id: `school:${school.id}`, ...polar(228, angle), kind: 'minor', domain: region.domain, role: 'travel',
        name: school.name, description: `Enter ${school.name.toLowerCase()}. Learn ${school.skills.map(skill => SKILL_DEFINITIONS[skill].name).join(' and ')}.`,
        bonuses: { [region.attribute]: 2 } });
      schoolStarts.push(entrance);
      link(threshold.id, entrance.id, polar(198, region.angle + school.angle * .55));
      let previous = entrance;
      for (const [stage, skill] of school.skills.entries()) {
        const definition = SKILL_DEFINITIONS[skill];
        const major = add({ id: `skill:${skill}`, ...polar(330 + stage * 137, angle + stage * Math.sign(school.angle || 1) * .055), kind: 'major',
          domain: definition.domain, name: definition.name, description: `${definition.description} Requires: ${skillRequirementLabel(definition.requirement)}.`, skill, bonuses: {} });
        if (stage === 0) link(previous.id, major.id, polar(280, angle + .025));
        else road(`path:${region.domain.toLowerCase()}:${skill}`, previous, major, region.domain, region.domain);
        previous = major;
      }
      const cluster = blueprints[regionTrunks[index][0]], arrival = nearest(cluster, previous);
      road(`path:${region.domain.toLowerCase()}:${school.id}:arrival`, previous, arrival, region.domain, region.domain, [cluster.id]);
    }
    // A short crescent between schools lets a build branch sideways without returning to origin.
    for (let school = 1; school < schoolStarts.length; school++) {
      const a = schoolStarts[school - 1], b = schoolStarts[school];
      link(a.id, b.id, polar(245, region.angle + (region.schools[school - 1].angle + region.schools[school].angle) / 2));
    }
  }

  const clusters = blueprints.map(cluster => Object.freeze({ id: cluster.id, name: cluster.family.name, domain: cluster.domain, x: cluster.x, y: cluster.y,
    radius: Math.max(...members.get(cluster.id)!.map(node => distance(node, cluster))) + 8 }));
  const bounds = Object.freeze({ minX: Math.min(...nodes.map(node => node.x)) - 90, minY: Math.min(...nodes.map(node => node.y)) - 90,
    maxX: Math.max(...nodes.map(node => node.x)) + 90, maxY: Math.max(...nodes.map(node => node.y)) + 90 });
  for (const node of nodes) { Object.freeze(node.neighbors); Object.freeze(node); }
  return Object.freeze({ nodes: Object.freeze(nodes) as readonly SkillNode[], edges: Object.freeze(edges), clusters: Object.freeze(clusters), bounds });
}

/** Organically spaced specialties joined by three arteries and sparse, curved hybrid routes. */
export const SKILL_TREE = buildTree();
export const SKILL_NODES: ReadonlyMap<string, SkillNode> = new Map(SKILL_TREE.nodes.map(node => [node.id, node]));

/** Merge only real, unique allocations. Repeated or unknown IDs never add power. */
export function getTreeBonuses(ids: readonly string[]): StatModifiers {
  const result: StatModifiers = {};
  for (const id of new Set(ids)) {
    const node = SKILL_NODES.get(id);
    if (!node) continue;
    for (const [key, value] of Object.entries(node.bonuses) as [StatKey, number][]) result[key] = (result[key] ?? 0) + value;
  }
  return result;
}
export function unlockedSkills(ids: readonly string[]): SkillId[] {
  const result = new Set<SkillId>();
  for (const id of ids) { const skill = SKILL_NODES.get(id)?.skill; if (skill) result.add(skill); }
  return [...result];
}
export function allocateNode(sheet: CharacterSheet, nodeId: string): ActionResult {
  const node = SKILL_NODES.get(nodeId);
  if (!node) return { ok: false, message: 'Unknown star.' };
  if (sheet.allocatedNodes.includes(nodeId)) return { ok: false, message: 'Already allocated.' };
  if (!Number.isSafeInteger(sheet.skillPoints) || sheet.skillPoints < 1) return { ok: false, message: 'Earn a skill point by leveling up.' };
  if (!node.neighbors.some(id => sheet.allocatedNodes.includes(id))) return { ok: false, message: 'Connect this star to your allocated path first.' };
  sheet.allocatedNodes.push(nodeId); sheet.skillPoints--;
  return { ok: true };
}
