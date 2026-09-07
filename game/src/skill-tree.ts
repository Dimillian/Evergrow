import { SKILL_SPECIALIZATIONS, specializationNode, specializationPassiveNode, SKILL_LEAF_BONUSES, masteryNode, OVERLOAD_NODE } from './skill-progression.ts';
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
  readonly specialization?: string;
  readonly developmentSkill?: SkillId;
  readonly improvement?: 'potency' | 'efficiency';
  readonly mastery?: SkillId;
  readonly keystone?: boolean;
  readonly cluster?: string;
  readonly role?: 'travel' | 'cluster' | 'choice';
  readonly neighbors: readonly string[];
}
export interface SkillEdge { readonly from: string; readonly to: string; readonly control?: Readonly<Point>; }
export interface SkillCluster { readonly id: string; readonly name: string; readonly domain: SkillDomain; readonly x: number; readonly y: number; readonly radius: number; }
export const SKILL_TREE_ORIGIN = 'origin';

interface Point { x: number; y: number; }
interface Family { name: string; description: string; minor: StatModifiers; notable: StatModifiers; }
interface WeaponSchool { id: string; name: string; angle: number; skills: readonly SkillId[]; }
interface Region { domain: SkillDomain; angle: number; schools: readonly WeaponSchool[]; attribute: StatKey; }
interface Blueprint extends SkillCluster { family: Family; shape: number; rotation: number; }
interface Route { a: number; b: number; }
type MutableNode = Omit<SkillNode, 'neighbors'> & { neighbors: string[] };
const TAU = Math.PI * 2;
const ULTIMATE_BRANCH_ANGLES: Partial<Record<SkillId, number>> = {
  cataclysm: 5.437462,
  absoluteZero: 6.042182,
  tempest: 3.29587,
};
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
    { name: 'Battle Rhythm', description: 'Attack faster and spend less mana on skills.', minor: { attackSpeedPercent: 2, manaCostPercent: 1 }, notable: { attackSpeedPercent: 7, manaCostPercent: 3, strength: 2 } },
  ],
  Cunning: [
    { name: 'Perfect Opening', description: 'Land critical hits more often.', minor: { critChance: 1 }, notable: { critChance: 3, critDamage: 10 } },
    { name: 'Ghost Step', description: 'Move faster to reposition between attacks.', minor: { moveSpeedPercent: 1 }, notable: { moveSpeedPercent: 4, dexterity: 3 } },
    { name: 'Waking Steel', description: 'Recover your weapon sooner for the next strike.', minor: { attackSpeedPercent: 2 }, notable: { attackSpeedPercent: 7, dexterity: 3 } },
    { name: 'Vital Strike', description: 'Make your critical hits more damaging.', minor: { critDamage: 4 }, notable: { critDamage: 16, critChance: 1 } },
    { name: 'Falcon Eye', description: 'Sharpen dexterity for faster attacks and more frequent critical hits.', minor: { dexterity: 2 }, notable: { dexterity: 6, critChance: 1 } },
    { name: 'Keen Pursuit', description: 'Increase weapon damage and reduce skill mana costs.', minor: { damagePercent: 4, manaCostPercent: 1 }, notable: { damagePercent: 12, manaCostPercent: 3, moveSpeedPercent: 2 } },
    { name: 'Borrowed Time', description: 'Bring skills and dodge charges back sooner.', minor: { cooldownPercent: 1 }, notable: { cooldownPercent: 3, attackSpeedPercent: 3 } },
  ],
  Arcana: [
    { name: 'Inner Flame', description: 'Strengthen spells and cast them faster.', minor: { spellDamagePercent: 4, castSpeedPercent: 2 }, notable: { spellDamagePercent: 14, castSpeedPercent: 6, intelligence: 3 } },
    { name: 'Astral Reservoir', description: 'Expand your mana reserve for longer sequences of spells.', minor: { maxMana: 7 }, notable: { maxMana: 24, manaRegen: .25 } },
    { name: 'Quiet Current', description: 'Spend less mana per skill and restore it faster.', minor: { manaRegen: .15, manaCostPercent: 2 }, notable: { manaRegen: .5, manaCostPercent: 5, maxMana: 10 } },
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
const bendBetween = (a: Point, b: Point, bend: number): Point => {
  const mid = mix(a, b, .5), length = distance(a, b);
  return { x: mid.x - (b.y - a.y) / length * bend, y: mid.y + (b.x - a.x) / length * bend };
};
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
  const byId = new Map<string, MutableNode>(), blueprints: Blueprint[] = [];
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

  // Five staggered terraces form three readable petals, with deliberate space between specialties.
  const terraceCounts = [3, 6, 10, 14, 17];
  for (const [regionIndex, region] of REGIONS.entries()) {
    for (const [terrace, count] of terraceCounts.entries()) {
      for (let slot = 0; slot < count; slot++) {
        const fraction = count === 1 ? 0 : slot / (count - 1) - .5;
        const angle = region.angle + fraction * 1.42 + Math.sin(terrace * 1.7 + regionIndex) * .025;
        const radius = [950, 1530, 2160, 2830, 3530][terrace] + Math.cos(fraction * TAU) * 48 + Math.sin(slot * 2.4) * 20;
        const familyIndex = terrace === 0 ? (region.domain === 'Arcana' ? [0, 1, 2][slot] : [0, 1, 6][slot]) : (slot + terrace * 2) % FAMILIES[region.domain].length;
        const family = FAMILIES[region.domain][familyIndex];
        blueprints.push({ id: `${region.domain.toLowerCase()}:terrace:${terrace}:${slot}`, ...polar(radius, angle), domain: region.domain,
          name: `${family.name} · ${EPITHETS[(slot + terrace) % EPITHETS.length]}`, family,
          radius: 118 + random() * 8, rotation: angle + Math.PI / 2,
          shape: (slot + terrace) % 5 });
      }
    }
  }

  const members = new Map<string, MutableNode[]>();
  for (const cluster of blueprints) {
    const group: MutableNode[] = [];
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
    // Authored silhouettes share a central notable and evenly spaced travel ports.
    // Diamond, hexagon, three rays, wings and compass remain balanced at every scale.
    put(local(0, 0), true);
    const connect = (a: number, b: number) => link(group[a].id, group[b].id, mix(group[a], group[b], .5));
    if (cluster.shape < 2) {
      const corners = cluster.shape === 0 ? 4 : 6;
      const subdivisions = cluster.shape === 0 ? 3 : 2;
      for (let corner = 0; corner < corners; corner++) {
        const a = polar(cluster.radius, -Math.PI / 2 + corner * TAU / corners);
        const b = polar(cluster.radius, -Math.PI / 2 + (corner + 1) * TAU / corners);
        for (let step = 0; step < subdivisions; step++) {
          const p = mix(a, b, step / subdivisions); put(local(p.x, p.y), false);
        }
      }
      for (let i = 1; i <= 12; i++) connect(i, i === 12 ? 1 : i + 1);
      for (let i = 1; i <= 12; i += cluster.shape === 0 ? 3 : 4) connect(0, i);
    } else if (cluster.shape === 3) {
      // Two mirrored boughs, with a generous opening around the focal star.
      for (const side of [-1, 1]) {
        let previous = 0;
        for (const [x, y] of [[42, -35], [76, -65], [112, -34], [112, 22], [76, 65]]) {
          put(local(x * side, y), false); connect(previous, group.length - 1); previous = group.length - 1;
        }
        connect(previous, 0);
      }
    } else {
      const arms = cluster.shape === 2 ? 3 : 4;
      const steps = cluster.shape === 2 ? 3 : 2;
      for (let arm = 0; arm < arms; arm++) {
        let previous = 0;
        for (let step = 1; step <= steps; step++) {
          const p = polar(cluster.radius * step / steps, -Math.PI / 2 + arm * TAU / arms);
          put(local(p.x, p.y), false); connect(previous, group.length - 1); previous = group.length - 1;
        }
      }
    }
    members.set(cluster.id, group);
  }

  const routes: Route[] = [], parents = blueprints.map((_, index) => index);
  const root = (index: number): number => { while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; } return index; };
  const join = (a: number, b: number) => { parents[root(a)] = root(b); routes.push({ a, b }); };
  // Each terrace is a complete belt: crossing disciplines never requires returning inward.
  for (let terrace = 0; terrace < 5; terrace++) for (let region = 0; region < REGIONS.length; region++) {
    const home = REGIONS[region].domain, away = REGIONS[(region + 1) % REGIONS.length].domain;
    const homeIndices = blueprints.flatMap((cluster, index) => cluster.domain === home && cluster.id.includes(`:terrace:${terrace}:`) ? [index] : []);
    const awayIndices = blueprints.flatMap((cluster, index) => cluster.domain === away && cluster.id.includes(`:terrace:${terrace}:`) ? [index] : []);
    const pairs = homeIndices.flatMap(a => awayIndices.map(b => ({ a, b, length: distance(blueprints[a], blueprints[b]) })))
      .sort((a, b) => a.length - b.length || a.a - b.a || a.b - b.b);
    join(pairs[0].a, pairs[0].b);
  }
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
  // Local crosslinks create circuits between nearby specialties, with extra hybrid connections at shared borders.
  const degree = blueprints.map((_, index) => routes.filter(route => route.a === index || route.b === index).length);
  let loops = 0;
  for (const { a, b, length } of candidates) {
    if (loops >= 110) break;
    if (length > 1140 || degree[a] >= 5 || degree[b] >= 5 || routes.some(route => route.a === a && route.b === b || route.a === b && route.b === a)) continue;
    if (blueprints[a].domain === blueprints[b].domain && random() > .85) continue;
    if (!clear(a, b)) continue;
    routes.push({ a, b }); degree[a]++; degree[b]++; loops++;
  }

  const nearest = (cluster: Blueprint, point: Point) => members.get(cluster.id)!.reduce((a, b) => distance(a, point) < distance(b, point) ? a : b);
  const road = (id: string, a: MutableNode, b: MutableNode, home: SkillDomain, away: SkillDomain, ignore: readonly string[] = [], maxSteps = 3) => {
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
    const count = Math.max(1, Math.min(maxSteps, Math.round(length / 180)));
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
    const source = nearest(from, to), target = nearest(to, from);
    road(`road:${a}:${b}`, source, target, from.domain, to.domain, [from.id, to.id]);
    for (const [cluster, gateway] of [[from, source], [to, target]] as const) {
      const focal = members.get(cluster.id)!.find(node => node.kind === 'notable')!;
      if (gateway.id !== focal.id) {
        const mid = mix(gateway, focal, .5);
        link(gateway.id, focal.id, { x: mid.x + (focal.y - gateway.y) * .06, y: mid.y - (focal.x - gateway.x) * .06 });
      }
    }
  }
  const earlyChoices: Readonly<Record<SkillDomain, readonly Family[]>> = {
    Might: [
      { name: 'Quickened Steel', description: 'Attack faster with melee weapons and bows.', minor: { attackSpeedPercent: 4 }, notable: {} },
      { name: 'Iron Vitality', description: 'Increase your maximum life.', minor: { maxHp: 16 }, notable: {} },
      { name: 'Measured Strikes', description: 'Spend less mana on weapon skills.', minor: { manaCostPercent: 4 }, notable: {} },
    ],
    Cunning: [
      { name: 'Quick Draw', description: 'Attack faster with bows and melee weapons.', minor: { attackSpeedPercent: 4 }, notable: {} },
      { name: 'Sure Aim', description: 'Increase your chance to critically strike.', minor: { critChance: 2 }, notable: {} },
      { name: 'Economy of Motion', description: 'Spend less mana on every skill.', minor: { manaCostPercent: 4 }, notable: {} },
    ],
    Arcana: [
      { name: 'Swift Invocation', description: 'Cast staff and wand attacks and magic skills faster.', minor: { castSpeedPercent: 4 }, notable: {} },
      { name: 'Deep Reservoir', description: 'Increase your maximum mana.', minor: { maxMana: 16 }, notable: {} },
      { name: 'Efficient Weaving', description: 'Reduce the mana cost of every skill.', minor: { manaCostPercent: 4 }, notable: {} },
    ],
  };
  const innerBorders: MutableNode[][] = [];
  for (const region of REGIONS) {
    const first = travel(`path:${region.domain.toLowerCase()}:awakening`, polar(82, region.angle), region.domain);
    link(SKILL_TREE_ORIGIN, first.id, polar(41, region.angle + .1));
    const schoolStarts: MutableNode[] = [], exits: MutableNode[] = [];
    for (const [schoolIndex, school] of region.schools.entries()) {
      const angle = region.angle + school.angle * 1.35;
      const local = (outward: number, side = 0): Point => ({
        x: Math.cos(angle) * outward - Math.sin(angle) * side,
        y: Math.sin(angle) * outward + Math.cos(angle) * side,
      });
      const family = earlyChoices[region.domain][schoolIndex];
      const entrance = add({ id: `school:${school.id}`, ...polar(185, angle), kind: 'minor', domain: region.domain, role: 'choice',
        name: family.name, description: `${family.description} Opens ${school.name.toLowerCase()}.`, bonuses: family.minor });
      schoolStarts.push(entrance);
      link(first.id, entrance.id, polar(132, region.angle + school.angle * .65));
      const skill = school.skills[0], definition = SKILL_DEFINITIONS[skill];
      const major = add({ id: `skill:${skill}`, ...local(292, -35), kind: 'major', domain: region.domain,
        name: definition.name, description: `${definition.description} Requires: ${skillRequirementLabel(definition.requirement)}.`, skill, bonuses: {} });
      link(entrance.id, major.id, mix(entrance, major, .5));
      const choices: MutableNode[] = [];
      for (let branch = 0; branch < 3; branch++) {
        const specialty = earlyChoices[region.domain][branch];
        const choice = add({ id: `choice:${school.id}:${branch}`, ...local([410, 525, 635][branch], 80),
          kind: 'minor', domain: region.domain, role: 'choice', name: specialty.name, description: specialty.description,
          bonuses: specialty.minor });
        choices.push(choice);
        const previous = branch === 0 ? entrance : choices[branch - 1];
        link(previous.id, choice.id, mix(previous, choice, .5));
      }
      const exit = choices[2];
      if (school.skills[1]) {
        const skill = school.skills[1], definition = SKILL_DEFINITIONS[skill];
        const advanced = add({ id: `skill:${skill}`, ...local(540, -35), kind: 'major', domain: region.domain,
          name: definition.name, description: `${definition.description} Requires: ${skillRequirementLabel(definition.requirement)}.`, skill, bonuses: {} });
        link(choices[0].id, advanced.id, mix(choices[0], advanced, .5));
      }
      exits.push(exit);
      const cluster = blueprints.filter(b => b.domain === region.domain).slice(0, 3)[schoolIndex];
      const arrival = nearest(cluster, exit);
      road(`path:${school.id}:arrival`, exit, arrival, region.domain, region.domain, [cluster.id], 1);
      const focal = members.get(cluster.id)!.find(node => node.kind === 'notable')!;
      if (focal.id !== arrival.id) link(arrival.id, focal.id, mix(arrival, focal, .5));
    }
    for (let school = 1; school < schoolStarts.length; school++) {
      const a = schoolStarts[school - 1], b = schoolStarts[school];
      link(a.id, b.id, mix(a, b, .5));
      const midAngle = region.angle + (region.schools[school - 1].angle + region.schools[school].angle) * .675;
      const junction = travel(`bridge:${region.domain}:${school}:1`, polar(730, midAngle), region.domain);
      link(exits[school - 1].id, junction.id, mix(exits[school - 1], junction, .5));
      link(junction.id, exits[school].id, bendBetween(junction, exits[school], -30));
    }
    innerBorders.push([schoolStarts[0], schoolStarts[2]]);
  }
  // Short inner hybrid bridges complement the outer network instead of forcing a return to origin.
  const borderNodes = innerBorders.flat().sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
  for (let i = 0; i < borderNodes.length; i++) {
    const a = borderNodes[i], b = borderNodes[(i + 1) % borderNodes.length];
    if (a.domain !== b.domain) link(a.id, b.id, mix(a, b, .5));
  }

  // Skill growth occupies the gaps between passive terraces, preserving their organic loops.
  const developmentClusters: SkillCluster[] = [];
  const openPosition = (point: Point): Point => {
    if (nodes.every(node => distance(node, point) >= 30)) return point;
    for (let ring = 1; ring <= 12; ring++) for (let step = 0; step < 24; step++) {
      const offset = polar(ring * 12, step * Math.PI / 12);
      const candidate = { x: point.x + offset.x, y: point.y + offset.y };
      if (nodes.every(node => distance(node, candidate) >= 30)) return candidate;
    }
    throw new Error('No clear skill development position.');
  };
  for (const region of REGIONS) for (const school of region.schools) {
    const angle = region.angle + school.angle * 1.05;
    const outward = blueprints.filter(b => b.domain === region.domain && b.id.includes(':terrace:1:'))
      .sort((a, b) => distance(a, polar(1530, angle)) - distance(b, polar(1530, angle)))[0];
    school.skills.forEach((skill, index) => {
      const node = add({ id: masteryNode(skill), ...openPosition(polar(1850, angle + (index ? .065 : -.065))), kind: 'notable', domain: region.domain,
        name: `${SKILL_DEFINITIONS[skill].name} Mastery`, description: 'Raises the purchased rank ceiling from 5 to 7. Each additional rank still costs one skill point.', mastery: skill, bonuses: {} });
      road(`mastery:${skill}:in`, nearest(outward, node), node, region.domain, region.domain);
      const next = blueprints.filter(b => b.domain === region.domain && b.id.includes(':terrace:2:')).sort((a,b) => distance(a,node)-distance(b,node))[0];
      road(`mastery:${skill}:out`, node, nearest(next,node), region.domain, region.domain);
    });
  }
  for (const [index, skill] of (['cataclysm', 'absoluteZero', 'tempest'] as const).entries()) {
    const angle = -1.55 + (index - 1) * .5, definition = SKILL_DEFINITIONS[skill];
    const node = add({ id: `skill:${skill}`, ...openPosition(polar(3170, angle)), cluster: `ultimate:${skill}`, kind: 'major', domain: 'Arcana', skill,
      name: definition.name, description: definition.description, bonuses: {} });
    for (const terrace of [3, 4]) {
      const near = blueprints.filter(b => b.domain === 'Arcana' && b.id.includes(`:terrace:${terrace}:`)).sort((a,b)=>distance(a,node)-distance(b,node))[0];
      road(`ultimate:${skill}:${terrace}`, nearest(near,node), node, 'Arcana', 'Arcana');
    }
    developmentClusters.push({ id: `ultimate:${skill}`, name: definition.name, domain: 'Arcana', x: node.x, y: node.y, radius: 65 });
  }
  const overload = add({ id: OVERLOAD_NODE, ...openPosition(polar(2510,-1.55)), kind: 'notable', domain: 'Arcana', keystone: true,
    name: 'Arcane Overload', description: 'Optional: Arcana skills deal 30% more damage and cost 60% more mana, including Tempest upkeep. Toggle in this node after allocation.', bonuses: {} });
  for (const terrace of [2,3]) {
    const near = blueprints.filter(b=>b.domain === 'Arcana' && b.id.includes(`:terrace:${terrace}:`)).sort((a,b)=>distance(a,overload)-distance(b,overload))[0];
    road(`overload:${terrace}`, nearest(near,overload), overload, 'Arcana','Arcana');
  }

  // Open the starter garden without changing any node IDs, links or point costs.
  // The inner schools get the most room; the outer atlas keeps its silhouette.
  const spread = (p: Point): Point => {
    const radius = Math.hypot(p.x, p.y);
    const scale = radius < 900 ? 2.5 : (radius + 1350) / radius;
    return { x: p.x * scale, y: p.y * scale };
  };
  const originalPositions = new Map(nodes.map(node => [node.id, { x: node.x, y: node.y }]));
  const clusterById = new Map(blueprints.map(cluster => [cluster.id, cluster]));
  const spreadMember = (p: Point, cluster: Blueprint): Point => {
    const center = spread(cluster);
    return { x: center.x + (p.x - cluster.x) * 1.45, y: center.y + (p.y - cluster.y) * 1.45 };
  };
  for (const node of nodes) {
    const cluster = node.cluster && clusterById.get(node.cluster);
    Object.assign(node, cluster ? spreadMember(node, cluster) : spread(node));
  }
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i], a = byId.get(edge.from)!, b = byId.get(edge.to)!;
    const cluster = a.cluster === b.cluster && a.cluster && clusterById.get(a.cluster);
    if (!edge.control) continue;
    const control = cluster ? spreadMember(edge.control, cluster) : spread(edge.control);
    if (!cluster) {
      // Reanchor roads to the rigid constellation ports without distorting their interiors.
      for (const node of [a, b]) {
        const warped = spread(originalPositions.get(node.id)!);
        control.x += (node.x - warped.x) / 2; control.y += (node.y - warped.y) / 2;
      }
    }
    edges[i] = Object.freeze({ ...edge, control: Object.freeze(control) });
  }
  for (const cluster of developmentClusters) Object.assign(cluster, spread(cluster));
  // Small outer-road deflections keep the ultimate branches clear.
  for (const [from, to, bend] of [
    ['road:130:146:1', 'road:130:146:2', 25],
  ] as const) {
    const index = edges.findIndex(edge => edge.from === from && edge.to === to);
    if (index >= 0) edges[index] = Object.freeze({ ...edges[index],
      control: Object.freeze(bendBetween(byId.get(from)!, byId.get(to)!, bend)) });
  }

  // Each skill is a self-contained three-pronged branch beside the passive backbone.
  for (const parent of [...nodes].filter(node => node.skill)) {
    const skill = parent.skill!, variants = SKILL_SPECIALIZATIONS.filter(v => v.skill === skill);
    const school = REGIONS.flatMap(region => region.schools).find(school => school.skills.includes(skill));
    const gate = school && byId.get(`school:${school.id}`)!;
    const rotation = ULTIMATE_BRANCH_ANGLES[skill] ?? Math.atan2(gate!.y, gate!.x);
    const fan = variants.map((_, leaf) => [85, 170, 255].map((outward, depth) => {
      const side = (leaf - 1) * (105 + depth * 10);
      return { x: parent.x + Math.cos(rotation) * outward - Math.sin(rotation) * side,
        y: parent.y + Math.sin(rotation) * outward + Math.cos(rotation) * side };
    }));
    const cluster = `development:${skill}`, members: MutableNode[] = [];
    variants.forEach((variant, leaf) => {
      let previous = parent;
      for (const [index, improvement] of (['potency', 'efficiency'] as const).entries()) {
        const duration = skill === 'bulwark';
        const description = improvement === 'potency'
          ? `+${SKILL_LEAF_BONUSES.potency * 100}% ${SKILL_DEFINITIONS[skill].name} ${duration ? 'guard duration' : 'damage'}.`
          : `${SKILL_LEAF_BONUSES.efficiency * 100}% reduced ${SKILL_DEFINITIONS[skill].name} mana cost${skill === 'tempest' ? ' and upkeep' : ''}.`;
        const node = add({ id: specializationPassiveNode(variant.id, improvement), ...fan[leaf][index],
          kind: 'minor', domain: parent.domain, cluster, developmentSkill: skill, improvement,
          name: improvement === 'potency' ? duration ? 'Endurance' : 'Potency' : 'Efficiency', description, bonuses: {} });
        link(previous.id, node.id, mix(previous, node, .5));
        members.push(node); previous = node;
      }
      const node = add({ id: specializationNode(variant.id), ...fan[leaf][2], kind: 'notable', domain: parent.domain,
        name: variant.name, description: variant.description, specialization: variant.id, developmentSkill: skill, cluster, bonuses: {} });
      const control = mix(previous, node, .5);
      link(previous.id, node.id, control); members.push(node);
    });
    const center = { x: members.reduce((sum, n) => sum + n.x, 0) / members.length, y: members.reduce((sum, n) => sum + n.y, 0) / members.length };
    developmentClusters.push({ id: cluster, name: SKILL_DEFINITIONS[skill].name, domain: parent.domain, ...center,
      radius: Math.max(...members.map(node => distance(node, center))) + 20 });
  }

  const clusters = blueprints.map(cluster => Object.freeze({ id: cluster.id, name: cluster.family.name, domain: cluster.domain, ...spread(cluster),
    radius: Math.max(...members.get(cluster.id)!.map(node => distance(node, spread(cluster)))) + 8 }));
  const bounds = Object.freeze({ minX: Math.min(...nodes.map(node => node.x)) - 90, minY: Math.min(...nodes.map(node => node.y)) - 90,
    maxX: Math.max(...nodes.map(node => node.x)) + 90, maxY: Math.max(...nodes.map(node => node.y)) + 90 });
  for (const node of nodes) { Object.freeze(node.neighbors); Object.freeze(node); }
  return Object.freeze({ nodes: Object.freeze(nodes) as readonly SkillNode[], edges: Object.freeze(edges), clusters: Object.freeze([...clusters, ...developmentClusters.map(cluster => Object.freeze(cluster))]), bounds });
}

/** Three terraced petals, early choice fans, and short interconnected specialty routes. */
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
