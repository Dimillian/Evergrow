/** Presentation-only hops. Seeded timing never consumes gameplay RNG or moves a drop. */
export function dropIdleHop(time: number, id: number, index = 0): number {
  const noise = (seed: number) => {
    let n = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const period = 3.8 + noise(id) * 1.7;
  const clock = Math.max(0, time) + noise(id + 71) * period;
  const cycle = Math.floor(clock / period);
  const local = clock - cycle * period - .25 - noise(id + cycle * 101) * .65
    - index * .115;
  const duration = .38 + noise(id + index * 17) * .1;
  if (local <= 0 || local >= duration) return 0;
  const t = local / duration;
  return 4 * t * (1 - t) * (3 + noise(id + index * 31 + cycle * 107) * 2);
}
