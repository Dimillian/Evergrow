import type { WildernessSite, CampMember } from './wilderness-sites.ts';

/** A seeded subset of ordinary camp footprints becomes a compact goblin warband. */
export function withGoblinWarband(site: WildernessSite): WildernessSite {
  if (site.kind !== 'camp' || site.id.endsWith(':first-camp') || site.seed % 3 !== 0) return site;
  const count = 10 + Math.floor(site.seed / 7) % 6;
  const members: CampMember[] = [{ id: `${site.id}:member:0`, kind: 'goblinChief', rank: site.members[0].rank, dx: 0, dy: -68 }];
  for (let i = 0; i < count; i++) members.push({ id: `${site.id}:member:${i + 1}`, kind: 'goblin', rank: 'normal',
    dx: (i % 5 - 2) * 40, dy: 28 + Math.floor(i / 5) * 40 });
  const name = ['Rattlefang Warband', 'Briarknife Warband', 'Scraptooth Warband'][Math.floor(site.seed / 11) % 3];
  return Object.freeze({ ...site, name, description: `${count} scrap goblins follow a war chief. Break their command, then claim the strongbox.`,
    members: Object.freeze(members.map(m => Object.freeze(m))) });
}
