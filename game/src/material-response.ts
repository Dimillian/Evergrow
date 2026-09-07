import { MATERIALS, type MaterialId } from './material-content.ts';
import type { CombatEvent, EnemyKind } from './model.ts';
export const MATERIAL_LIMITS = Object.freeze({ bursts: 48, fragments: 384 });
export interface MaterialFragment { angle: number; spread: number; flight: number; lift: number; spin: number; length: number; thickness: number; color: string; hoop: boolean; }
export interface MaterialRequest { x: number; y: number; angle: number; seed: number; material: MaterialId; strength: number; count: number; hoops?: number; height?: number; }
export interface MaterialBurst extends MaterialRequest { age: number; duration: number; fragments: readonly MaterialFragment[]; }
export const ENEMY_MATERIAL: Readonly<Record<EnemyKind, MaterialId>> = Object.freeze({
  thornReaver: 'wood', mireSpitter: 'bone', frostRevenant: 'ice', emberAcolyte: 'ember', duneScuttler: 'bone', stormSentinel: 'glass',
  stalker: 'bone', brute: 'bone', caster: 'glass', hound: 'bone', archer: 'bone', wisp: 'glass', goblin: 'bone', goblinChief: 'metal', warden: 'stone', briarMatriarch: 'wood', ashColossus: 'stone', graveMarshal: 'metal',
});
function random(seed: number, salt: number): number {
  let n = (seed ^ Math.imul(salt + 1, 0x45d9f3b)) >>> 0;
  n = Math.imul(n ^ n >>> 16, 0x7feb352d); n = Math.imul(n ^ n >>> 15, 0x846ca68b);
  return ((n ^ n >>> 16) >>> 0) / 0x100000000;
}
export function eventMaterial(event: CombatEvent): MaterialId | null {
  if (event.type === 'container-break') return 'wood';
  if (event.type === 'surface-hit') return event.material;
  if (event.type === 'block') return 'metal';
  if (event.type === 'blast') {
    if (event.groundKind === 'meteor' || event.skill === 'earthshatter') return 'stone';
    if (event.style === 'frost') return 'ice';
    if (event.style === 'fire') return 'ember';
    return null;
  }
  if (event.type !== 'hit' && event.type !== 'kill') return null;
  if (event.style === 'frost') return 'ice';
  if (event.style === 'fire') return 'ember';
  if (event.style === 'lightning') return 'metal';
  if (event.style === 'arcane' || event.style === 'spirit') return 'glass';
  return ENEMY_MATERIAL[event.enemyKind];
}
export function createMaterialBurst(request: MaterialRequest): MaterialBurst {
  const recipe = MATERIALS[request.material], count = Math.min(24, Math.max(0, Math.floor(request.count)));
  const strength = Math.max(.2, Math.min(1.8, request.strength));
  return { ...request, strength, count, age: 0, duration: recipe.duration, fragments: Array.from({ length: count }, (_, i) => ({
    angle: i * 2.39996 + random(request.seed, i) * .5,
    spread: recipe.spread * (.3 + random(request.seed, i + 40) * .7) * strength,
    flight: recipe.flight * (.65 + random(request.seed, i + 20) * .5),
    lift: recipe.lift * (.4 + random(request.seed, i + 60) * .6) * strength,
    spin: (random(request.seed, i + 120) - .5) * 8,
    length: recipe.length * (.3 + random(request.seed, i + 80) * .7),
    thickness: recipe.thickness * (.5 + random(request.seed, i + 100) * .5),
    color: recipe.colors[i % recipe.colors.length], hoop: i < (request.hoops ?? 0),
  })) };
}
/** Analytic trajectories, independent of render frequency. Motion reduction shows settled fragments. */
export function fragmentPose(burst: MaterialBurst, fragment: MaterialFragment, reducedMotion: boolean) {
  const recipe = MATERIALS[burst.material], age = reducedMotion ? 2 : burst.age;
  const t = Math.min(age / fragment.flight, 1), travel = (1 - (1 - t) ** 2) * fragment.spread;
  const rising = recipe.shape === 'ember';
  const height = reducedMotion ? 0 : rising ? 12 + age * fragment.lift
    : age < fragment.flight ? (burst.height ?? 12) * (1 - t) + Math.sin(t * Math.PI) * fragment.lift
    : age < fragment.flight + .18 ? Math.sin((age - fragment.flight) / .18 * Math.PI) * recipe.bounce : 0;
  return { x: Math.cos(fragment.angle) * travel + Math.cos(burst.angle) * t * 9,
    y: Math.sin(fragment.angle) * travel * .6 + Math.sin(burst.angle) * t * 7 - (rising && !reducedMotion ? Math.sin(age * 3 + fragment.angle) * 4 : 0),
    height, rotation: fragment.angle + t * fragment.spin,
    opacity: Math.max(0, Math.min(1, (burst.duration - burst.age) / Math.min(2, burst.duration * .65))) };
}
/** One bounded fragment budget for scenery, blocks, impacts and deaths. No save/combat ownership. */
export class MaterialResponses {
  readonly bursts: MaterialBurst[] = [];
  get fragmentCount(): number { return this.bursts.reduce((n, b) => n + b.fragments.length, 0); }
  add(request: MaterialRequest): void {
    const burst = createMaterialBurst(request);
    while (this.bursts.length && (this.bursts.length >= MATERIAL_LIMITS.bursts || this.fragmentCount + burst.count > MATERIAL_LIMITS.fragments)) this.bursts.shift();
    this.bursts.push(burst);
  }
  handle(event: CombatEvent): void {
    const material = eventMaterial(event); if (!material) return;
    // A lethal hit's death owns the response; avoid a duplicate burst for the same contact.
    if (event.type === 'hit' && event.remainingHp <= 0) return;
    const meteor = event.type === 'blast' && event.groundKind === 'meteor';
    const big = meteor || event.type === 'kill' || event.type === 'container-break';
    const seed = event.type === 'container-break' ? event.seed : ('targetId' in event ? event.targetId : Math.round(event.x * 31 + event.y * 17)) ^ Math.round(event.x + event.y);
    this.add({ x: event.x, y: event.y, angle: 'angle' in event ? event.angle : 0, seed, material,
      height: event.type === 'kill' ? 24 : 12, count: big ? 18 : event.type === 'block' ? 7 : 5, strength: big ? 1 : .5,
      ...(event.type === 'container-break' ? { count: 14, hoops: event.kind === 'barrel' ? 2 : 0 } : {}) });
    if (meteor) this.add({ x: event.x, y: event.y, angle: 0, seed: seed + 17, material: 'ember', strength: 1.5, count: 14 });
  }
  lights(reducedMotion: boolean): Array<{ x: number; y: number; radius: number; color: string; power: number }> {
    if (reducedMotion) return [];
    return this.bursts.filter(b => MATERIALS[b.material].glow > 0 && b.age < .5).slice(-6).map(b => ({
      x: b.x, y: b.y - 12, radius: 40 + b.strength * 28, color: MATERIALS[b.material].edge,
      power: MATERIALS[b.material].glow * .35 * (1 - b.age / .5),
    }));
  }
  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (let i = this.bursts.length - 1; i >= 0; i--) { this.bursts[i].age += dt; if (this.bursts[i].age >= this.bursts[i].duration) this.bursts.splice(i, 1); }
  }
  reset(): void { this.bursts.length = 0; }
}
