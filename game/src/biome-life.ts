import { hash, randomFromSeed } from './art-primitives.ts';
import { biomeWind } from './biome-wind.ts';
import { BIOME_LIFE, biomeForDebris, type ParticleKind, type BirdKind, type InsectKind } from './biome-life-content.ts';
import type { GroundContact } from './ground-material.ts';
import type { BiomeId } from './biomes.ts';
import type { Prop } from './world.ts';

export const BIOME_LIFE_LIMITS = Object.freeze({ trails: 40, footsteps: 48, particles: 100, birds: 6, insects: 10 });
export interface BiomeSubject { x: number; y: number; vx: number; vy: number; }
export interface BiomeTrail { x: number; y: number; age: number; angle: number; foot: number; material: ParticleKind; color: string; wet: number; }
export interface BiomeParticle { biome: BiomeId; kind: ParticleKind; x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; phase: number; color: string; }
export interface BiomeBird { biome: BiomeId; kind: BirdKind;
  id: string; x: number; y: number; z: number; homeX: number; homeY: number; homeZ: number;
  age: number; phase: number; state: 'perched' | 'fleeing' | 'returning'; elapsed: number; dx: number; dy: number;
}
export interface BiomeInsect { biome: BiomeId; kind: InsectKind; color: string; id: string; x: number; y: number; homeX: number; homeY: number; phase: number; age: number; alarm: number; }

/** Bounded presentation state. No gameplay RNG, world writes, collisions, damage or rewards. */
export class BiomeLife {
  readonly trails: BiomeTrail[] = [];
  readonly footsteps: BiomeTrail[] = [];
  readonly particles: BiomeParticle[] = [];
  readonly birds: BiomeBird[] = [];
  readonly insects: BiomeInsect[] = [];
  private previous: { x: number; y: number } | undefined;
  private distance = 0;
  private side = 1;
  private syncTime = 0;
  private particleTime = 0;
  private serial = 0;
  reset() {
    this.trails.length = this.footsteps.length = this.particles.length = this.birds.length = this.insects.length = 0;
    this.previous = undefined; this.distance = this.syncTime = this.particleTime = this.serial = 0; this.side = 1;
  }
  update(dt: number, time: number, props: readonly Prop[], subject: BiomeSubject, reducedMotion: boolean, groundAt: (x: number, y: number) => GroundContact) {
    const step = Math.max(0, Math.min(.1, dt));
    if (reducedMotion) {
      this.syncTime -= step;
      if (!this.previous || this.syncTime <= 0) {
        this.sync(props, subject); this.syncTime = .6;
        for (const bird of this.birds) bird.age = Math.max(1, bird.age);
        for (const insect of this.insects) insect.age = Math.max(1, insect.age);
      }
      this.previous = { x: subject.x, y: subject.y }; this.distance = 0; return;
    }
    if (step === 0) return;
    const moved = this.previous ? Math.hypot(subject.x - this.previous.x, subject.y - this.previous.y) : 0;
    if (moved > 120) { this.trails.length = this.footsteps.length = 0; this.distance = 0; }
    else if (moved > .1 && step > 0) {
      const angle = Math.atan2(subject.y - this.previous!.y, subject.x - this.previous!.x);
      this.distance += moved;
      if (this.distance >= 16) {
        this.distance %= 16; this.side *= -1;
        const x = subject.x + Math.cos(angle + Math.PI / 2) * this.side * 4;
        const y = subject.y + Math.sin(angle + Math.PI / 2) * this.side * 3;
        const contact = groundAt(x, y);
        if (!contact.indoors && !contact.simulatedWater) {
          const random = randomFromSeed(hash(++this.serial + Math.floor(x * 7 + y * 13)));
          const biome = biomeForDebris(contact.weights, random());
          const wet = contact.water, natural = random() < contact.natural;
          const material: ParticleKind = wet > .18 ? 'droplet' : natural ? BIOME_LIFE[biome].debris : 'dust';
          const color = natural ? BIOME_LIFE[biome].footColor : '#3b3630';
          const foot = { x, y, age: 0, angle, foot: this.side, material, color, wet };
          this.trails.push(foot); this.footsteps.push({ ...foot });
          for (let i = 0; i < 3; i++) {
            const localBiome = biomeForDebris(contact.weights, random());
            const kind = random() < wet ? 'droplet' : random() < contact.natural ? BIOME_LIFE[localBiome].debris : 'dust';
            this.particle(x, y, 1, time, true, localBiome, kind);
          }
        }
      }
    }
    this.previous = { x: subject.x, y: subject.y };
    for (const trail of [...this.trails, ...this.footsteps]) trail.age += step;
    this.trim(this.trails, BIOME_LIFE_LIMITS.trails, t => t.age > 2.2);
    this.trim(this.footsteps, BIOME_LIFE_LIMITS.footsteps, t => t.age > 3.5);
    for (const particle of this.particles) {
      const wind = biomeWind(particle.x, particle.y, time, particle.biome);
      particle.age += step; particle.x += (particle.vx + wind.x * 12) * step; particle.y += (particle.vy + wind.y * 5) * step;
      particle.vz -= step * (particle.kind === 'ember' ? -2 : particle.kind === 'droplet' ? 45 : particle.kind === 'snow' || particle.kind === 'seed' ? 4 : 16); particle.z = Math.max(0, particle.z + particle.vz * step);
      if (particle.z === 0) { particle.vx *= Math.exp(-step * 5); particle.vy *= Math.exp(-step * 5); }
    }
    this.trim(this.particles, BIOME_LIFE_LIMITS.particles, particle => particle.age > particle.life);
    this.syncTime -= step; this.particleTime -= step;
    if (this.syncTime <= 0) { this.syncTime = .6; this.sync(props, subject); }
    if (this.particleTime <= 0) {
      this.particleTime = .2;
      let emitted = 0;
      for (const prop of props) {
        if (!prop.biome) continue;
        if (!BIOME_LIFE[prop.biome].emitters.includes(prop.kind) || hash(prop.seed) % 3 !== 0 || Math.hypot(prop.x - subject.x, prop.y - subject.y) > 600) continue;
        if (biomeWind(prop.x, prop.y, time, prop.biome).gust < .52 || emitted++ >= 3) continue;
        const random = randomFromSeed(hash(prop.seed + this.serial));
        const crown = ['tree', 'canopy', 'willow', 'snowPine', 'autumnTree', 'deadTree', 'charredTree', 'windTree'].includes(prop.kind);
        const kind = prop.kind === 'emberRock' ? 'ember' : prop.kind === 'snowPine' ? 'snow' : BIOME_LIFE[prop.biome].debris;
        this.particle(prop.x + (random() - .5) * (crown ? 65 : 18), prop.y - 12,
          (crown ? 58 + random() * 35 : 5 + random() * 12) * prop.scale, time, false, prop.biome, kind);
      }
    }
    for (const bird of this.birds) {
      bird.age += step; bird.elapsed += step;
      const near = Math.hypot(subject.x - bird.x, subject.y - bird.y) < 90;
      if (bird.state === 'perched' && near && Math.hypot(subject.vx, subject.vy) > 12) {
        bird.state = 'fleeing'; bird.elapsed = 0;
        const angle = Math.atan2(bird.y - subject.y, bird.x - subject.x);
        const speed = bird.kind === 'snowfinch' ? 1.3 : bird.kind === 'wader' ? .8 : 1;
        bird.dx = Math.cos(angle) * 58 * speed; bird.dy = Math.sin(angle) * 34 * speed;
      }
      if (bird.state === 'fleeing') {
        bird.x += bird.dx * step; bird.y += bird.dy * step; bird.z = Math.min(95, bird.z + step * 34);
        if (bird.elapsed > 2.6) { bird.state = 'returning'; bird.elapsed = 0; }
      } else if (bird.state === 'returning') {
        if (Math.hypot(subject.x - bird.homeX, subject.y - bird.homeY) < 115) {
          // A bird circles above an occupied perch instead of hovering in place.
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
    for (const insect of this.insects) {
      insect.age += step;
      const dx = insect.x - subject.x, dy = insect.y - subject.y, d = Math.hypot(dx, dy);
      insect.alarm = Math.max(0, insect.alarm - step * .6);
      if (d < 48 && Math.hypot(subject.vx, subject.vy) > 12) {
        insect.alarm = 1; insect.x += dx / Math.max(1, d) * step * 50; insect.y += dy / Math.max(1, d) * step * 40;
      } else {
        const rest = Math.sin(time * .38 + insect.phase) > (insect.kind === 'dragonfly' ? .92 : .65);
        const x = insect.homeX + (rest ? 0 : Math.sin(time * .9 + insect.phase) * 20);
        const y = insect.homeY + (rest ? 0 : Math.cos(time * .67 + insect.phase) * 11);
        const blend = 1 - Math.exp(-step * 2); insect.x += (x - insect.x) * blend; insect.y += (y - insect.y) * blend;
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
  private particle(x: number, y: number, z: number, time: number, kicked: boolean, biome: BiomeId, kind: ParticleKind) {
    const random = randomFromSeed(hash(++this.serial + Math.floor(x * 7 + y * 13)));
    const palette = kind === 'droplet' ? ['#91bdbf', '#78a5b4', '#bddad6']
      : kind === 'ember' ? ['#e9a563', '#f4c68c', '#cc7956']
      : kind === 'dust' ? ['#9a9078', '#777f79', '#a9a593'] : BIOME_LIFE[biome].colors;
    this.particles.push({ x, y, z, biome, kind,
      vx: (random() - .5) * (kicked ? 50 : 12), vy: (random() - .5) * 22,
      vz: kind === 'ember' ? 9 : kicked ? 19 + random() * 18 : -3,
      age: 0, life: kind === 'droplet' ? .8 : kicked ? 1.8 : 4.8,
      phase: time + random() * 6.28, color: palette[Math.floor(random() * palette.length)] });
    if (this.particles.length > BIOME_LIFE_LIMITS.particles) this.particles.shift();
  }
  private sync(props: readonly Prop[], subject: BiomeSubject) {
    const candidates = props.filter(p => Math.hypot(p.x - subject.x, p.y - subject.y) < 650)
      .sort((a, b) => Math.hypot(a.x - subject.x, a.y - subject.y) - Math.hypot(b.x - subject.x, b.y - subject.y));
    const nearby = new Set(candidates.map(p => p.id));
    this.trim(this.birds, BIOME_LIFE_LIMITS.birds, b => !nearby.has(b.id));
    this.trim(this.insects, BIOME_LIFE_LIMITS.insects, b => !nearby.has(b.id));
    for (const prop of candidates) {
      if (!prop.biome) continue;
      const profile = BIOME_LIFE[prop.biome];
      const phase = hash(prop.seed) / 0x100000000 * Math.PI * 2;
      if (this.birds.length < BIOME_LIFE_LIMITS.birds && profile.bird && profile.perches.includes(prop.kind)
        && !this.birds.some(b => b.id === prop.id)) {
        const z = prop.kind === 'deadTree' || prop.kind === 'windTree' ? 38 : prop.kind === 'lilies' ? 0 : prop.kind === 'stump' ? 15 : 12;
        this.birds.push({ id: prop.id, biome: prop.biome, kind: profile.bird, x: prop.x + 3, y: prop.y, z, homeX: prop.x + 3, homeY: prop.y, homeZ: z,
          age: 0, phase, state: 'perched', elapsed: 0, dx: 0, dy: 0 });
      }
      if (this.insects.length < BIOME_LIFE_LIMITS.insects && profile.insect && profile.insectAnchors.includes(prop.kind)
        && !this.insects.some(b => b.id === prop.id)) this.insects.push({ id: prop.id, biome: prop.biome, kind: profile.insect, color: profile.insectColor,
          x: prop.x, y: prop.y - 8, homeX: prop.x, homeY: prop.y - 8, phase, age: 0, alarm: 0 });
    }
  }
}
