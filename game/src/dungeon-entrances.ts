import type { DungeonEntrance } from './dungeon.ts';
import type { World } from './world.ts';
import { getZoneAt } from './zone-progression.ts';
/** Stable, non-solid entrances reuse clear landmark approaches; the first is close to the starting route. */
export function dungeonEntrances(world: Pick<World, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>, x: number, y: number, w: number, h: number): DungeonEntrance[] {
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > 100000 || h > 100000)
        return [];
    const out: DungeonEntrance[] = [];
    const add = (id: string, px: number, py: number, seed: number) => { if (px < x || py < y || px >= x + w || py >= y + h)
        return; out.push({ id, name: 'Rootbound Crypt', x: px, y: py, seed: seed >>> 0, level: Math.min(1e6, getZoneAt(px, py, world.seed).level + 1), biome: world.sampleBiome(px, py).id }); };
    if (x < 0 && x + w > -1000 && y < 1000 && y + h > 0)
        for (let i = 0; i < 32; i++) {
            const px = -520 + (i % 8) * 48, py = 380 + Math.floor(i / 8) * 56;
            if (!world.blocked(px, py, 40) && !world.isSanctuary(px, py)) {
                add('dungeon:first', px, py, world.seed ^ 9127);
                break;
            }
        }
    for (const site of world.getWildernessSites(x - 220, y - 220, w + 440, h + 440))
        if (site.kind === 'graveyard')
            for (let i = 0; i < 16; i++) {
                const a = i * Math.PI / 8, px = site.entrance.x + Math.cos(a) * 160, py = site.entrance.y + Math.sin(a) * 160;
                if (!world.blocked(px, py, 40) && !world.isSanctuary(px, py)) {
                    add(`dungeon:${site.id}`, px, py, (site.seed ^ 731991) >>> 0);
                    break;
                }
            }
    return out;
}
