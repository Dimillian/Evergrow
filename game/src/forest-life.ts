import { hash, randomFromSeed } from './art-primitives.ts';
import { forestWind } from './forest-wind.ts';
import type { Prop } from './world.ts';

export const FOREST_LIFE_LIMITS = Object.freeze({ trails: 40, footsteps: 48, leaves: 100, birds: 6, butterflies: 10 });
export interface ForestSubject { x: number; y: number; vx: number; vy: number; }
export interface ForestTrail { x: number; y: number; age: number; angle: number; foot: number; }
export interface ForestLeaf { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; phase: number; color: string; }
export interface ForestBird {
  id: string; x: number; y: number; z: number; homeX: number; homeY: number; homeZ: number;
  age: number; phase: number; state: 'perched' | 'fleeing' | 'returning'; elapsed: number; dx: number; dy: number;
}
export interface ForestButterfly { id: string; x: number; y: number; homeX: number; homeY: number; phase: number; age: number; alarm: number; }
const woodland = (prop: Prop) => prop.biome === 'verdant';
const tree = (prop: Prop) => prop.kind === 'tree' || prop.kind === 'canopy';

/** Bounded presentation state. No gameplay RNG, world writes, collisions, damage or rewards. */
export class ForestLife {
  readonly trails: ForestTrail[] = [];
  readonly footsteps: ForestTrail[] = [];
  readonly leaves: ForestLeaf[] = [];
  readonly birds: ForestBird[] = [];
  readonly butterflies: ForestButterfly[] = [];
  private previous: { x: number; y: number } | undefined;
  private distance = 0;
  private side = 1;
  private syncTime = 0;
  private leafTime = 0;
  private serial = 0;
  reset() {
    this.trails.length = this.footsteps.length = this.leaves.length = this.birds.length = this.butterflies.length = 0;
    this.previous = undefined; this.distance = this.syncTime = this.leafTime = this.serial = 0; this.side = 1;
  }
  update(dt: number, time: number, props: readonly Prop[], subject: ForestSubject, reducedMotion: boolean, inForest: boolean) {
    const step = Math.max(0, Math.min(.1, dt));
    if (reducedMotion) {
      if (!this.previous) {
        this.sync(props, subject);
        for (const bird of this.birds) bird.age = 1;
        for (const butterfly of this.butterflies) butterfly.age = 1;
      }
      this.previous = { x: subject.x, y: subject.y }; this.distance = 0; return;
    }
    if (step === 0) return;
    const moved = this.previous ? Math.hypot(subject.x - this.previous.x, subject.y - this.previous.y) : 0;
    if (moved > 120) { this.trails.length = this.footsteps.length = 0; this.distance = 0; }
    else if (inForest && moved > .1 && step > 0) {
      const angle = Math.atan2(subject.y - this.previous!.y, subject.x - this.previous!.x);
      this.distance += moved;
      if (this.distance >= 16) {
        this.distance %= 16; this.side *= -1;
        const x = subject.x + Math.cos(angle + Math.PI / 2) * this.side * 4;
        const y = subject.y + Math.sin(angle + Math.PI / 2) * this.side * 3;
        this.trails.push({ x, y, age: 0, angle, foot: this.side });
        this.footsteps.push({ x, y, age: 0, angle, foot: this.side });
        for (let i = 0; i < 3; i++) this.leaf(x, y, 1, time, true);
      }
    }
    this.previous = { x: subject.x, y: subject.y };
    for (const trail of [...this.trails, ...this.footsteps]) trail.age += step;
    this.trim(this.trails, FOREST_LIFE_LIMITS.trails, t => t.age > 2.2);
    this.trim(this.footsteps, FOREST_LIFE_LIMITS.footsteps, t => t.age > 3.5);
    for (const leaf of this.leaves) {
      const wind = forestWind(leaf.x, leaf.y, time);
      leaf.age += step; leaf.x += (leaf.vx + wind.x * 12) * step; leaf.y += (leaf.vy + wind.y * 5) * step;
      leaf.vz -= step * 16; leaf.z = Math.max(0, leaf.z + leaf.vz * step);
      if (leaf.z === 0) { leaf.vx *= Math.exp(-step * 5); leaf.vy *= Math.exp(-step * 5); }
    }
    this.trim(this.leaves, FOREST_LIFE_LIMITS.leaves, leaf => leaf.age > leaf.life);
    this.syncTime -= step; this.leafTime -= step;
    if (this.syncTime <= 0) { this.syncTime = .6; this.sync(props, subject); }
    if (this.leafTime <= 0) {
      this.leafTime = .2;
      let emitted = 0;
      for (const prop of props) {
        if (!woodland(prop) || !tree(prop) || hash(prop.seed) % 3 !== 0 || Math.hypot(prop.x - subject.x, prop.y - subject.y) > 600) continue;
        if (forestWind(prop.x, prop.y, time).gust < .52 || emitted++ >= 3) continue;
        const random = randomFromSeed(hash(prop.seed + this.serial));
        this.leaf(prop.x + (random() - .5) * 65, prop.y - 12, (58 + random() * 35) * prop.scale, time, false);
      }
    }
    for (const bird of this.birds) {
      bird.age += step; bird.elapsed += step;
      const near = Math.hypot(subject.x - bird.x, subject.y - bird.y) < 90;
      if (bird.state === 'perched' && near && Math.hypot(subject.vx, subject.vy) > 12) {
        bird.state = 'fleeing'; bird.elapsed = 0;
        const angle = Math.atan2(bird.y - subject.y, bird.x - subject.x);
        bird.dx = Math.cos(angle) * 58; bird.dy = Math.sin(angle) * 34;
      }
      if (bird.state === 'fleeing') {
        bird.x += bird.dx * step; bird.y += bird.dy * step; bird.z = Math.min(95, bird.z + step * 34);
        if (bird.elapsed > 2.6) { bird.state = 'returning'; bird.elapsed = 0; }
      } else if (bird.state === 'returning') {
        if (Math.hypot(subject.x - bird.homeX, subject.y - bird.homeY) < 115) {
          // A crow circles above an occupied perch instead of hovering in place.
          const a = bird.elapsed * .65 + bird.phase, blend = 1 - Math.exp(-step * 1.2);
          const x = bird.homeX + Math.cos(a) * 145, y = bird.homeY + Math.sin(a) * 70;
          bird.dx = x - bird.x; bird.dy = y - bird.y;
          bird.x += bird.dx * blend; bird.y += bird.dy * blend;
          bird.z += (85 - bird.z) * blend;
          continue;
        }
        const blend = 1 - Math.exp(-step * .65);
        bird.x += (bird.homeX - bird.x) * blend; bird.y += (bird.homeY - bird.y) * blend; bird.z += (bird.homeZ - bird.z) * blend;
        if (Math.hypot(bird.x - bird.homeX, bird.y - bird.homeY, bird.z - bird.homeZ) < 2) {
          bird.state = 'perched'; bird.x = bird.homeX; bird.y = bird.homeY; bird.z = bird.homeZ; bird.elapsed = 0;
        }
      }
    }
    for (const butterfly of this.butterflies) {
      butterfly.age += step;
      const dx = butterfly.x - subject.x, dy = butterfly.y - subject.y, d = Math.hypot(dx, dy);
      butterfly.alarm = Math.max(0, butterfly.alarm - step * .6);
      if (d < 48 && Math.hypot(subject.vx, subject.vy) > 12) {
        butterfly.alarm = 1; butterfly.x += dx / Math.max(1, d) * step * 50; butterfly.y += dy / Math.max(1, d) * step * 40;
      } else {
        const rest = Math.sin(time * .38 + butterfly.phase) > .65;
        const x = butterfly.homeX + (rest ? 0 : Math.sin(time * .9 + butterfly.phase) * 20);
        const y = butterfly.homeY + (rest ? 0 : Math.cos(time * .67 + butterfly.phase) * 11);
        const blend = 1 - Math.exp(-step * 2); butterfly.x += (x - butterfly.x) * blend; butterfly.y += (y - butterfly.y) * blend;
      }
    }
  }
  bend(x: number, y: number) {
    let value = 0;
    for (const trail of this.trails) {
      const d = Math.hypot(x - trail.x, (y - trail.y) * 1.35);
      if (d < 30) value += (x < trail.x ? -1 : 1) * (1 - d / 30) * Math.exp(-trail.age * 2.2);
    }
    return Math.max(-1, Math.min(1, value));
  }
  private trim<T>(items: T[], limit: number, expired: (item: T) => boolean) {
    for (let i = items.length - 1; i >= 0; i--) if (expired(items[i])) items.splice(i, 1);
    if (items.length > limit) items.splice(0, items.length - limit);
  }
  private leaf(x: number, y: number, z: number, time: number, kicked: boolean) {
    const random = randomFromSeed(hash(++this.serial + Math.floor(x * 7 + y * 13)));
    this.leaves.push({ x, y, z, vx: (random() - .5) * (kicked ? 50 : 12), vy: (random() - .5) * 22,
      vz: kicked ? 19 + random() * 18 : -3, age: 0, life: kicked ? 1.8 : 4.8, phase: time + random() * 6.28,
      color: ['#aa9b58', '#7e9952', '#bbaf6a', '#688447'][Math.floor(random() * 4)] });
    if (this.leaves.length > FOREST_LIFE_LIMITS.leaves) this.leaves.shift();
  }
  private sync(props: readonly Prop[], subject: ForestSubject) {
    const candidates = props.filter(p => woodland(p) && Math.hypot(p.x - subject.x, p.y - subject.y) < 650)
      .sort((a, b) => Math.hypot(a.x - subject.x, a.y - subject.y) - Math.hypot(b.x - subject.x, b.y - subject.y));
    const nearby = new Set(candidates.map(p => p.id));
    this.trim(this.birds, FOREST_LIFE_LIMITS.birds, b => !nearby.has(b.id));
    this.trim(this.butterflies, FOREST_LIFE_LIMITS.butterflies, b => !nearby.has(b.id));
    for (const prop of candidates) {
      const phase = hash(prop.seed) / 0x100000000 * Math.PI * 2;
      if (this.birds.length < FOREST_LIFE_LIMITS.birds && ['stump', 'rock', 'deadTree'].includes(prop.kind)
        && !this.birds.some(b => b.id === prop.id)) {
        const z = prop.kind === 'deadTree' ? 38 : prop.kind === 'stump' ? 15 : 12;
        this.birds.push({ id: prop.id, x: prop.x + 3, y: prop.y, z, homeX: prop.x + 3, homeY: prop.y, homeZ: z,
          age: 0, phase, state: 'perched', elapsed: 0, dx: 0, dy: 0 });
      }
      if (this.butterflies.length < FOREST_LIFE_LIMITS.butterflies && ['flowers', 'fern'].includes(prop.kind)
        && !this.butterflies.some(b => b.id === prop.id)) this.butterflies.push({ id: prop.id,
          x: prop.x, y: prop.y - 8, homeX: prop.x, homeY: prop.y - 8, phase, age: 0, alarm: 0 });
    }
  }
}
