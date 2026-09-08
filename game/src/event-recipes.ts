import { hasLineOfSight } from './combat-geometry.ts';
import type { WorldQuery } from './model.ts';
import type { EventSite } from './poi-content.ts';
import type { EnemyKind } from './model.ts';
import { CAMP_BIOME_ROSTERS, siteHash } from './wilderness-sites.ts';
import type { EnemyRank } from './progression-content.ts';
import type { WaveRules } from './wave-system.ts';
export interface EventRecipe {
    id: string;
    action: string;
    objective: string;
    rules: WaveRules;
    size: number;
    growth: number;
    roster?: readonly EnemyKind[];
    elite: boolean;
    mode: 'assault' | 'defend' | 'seals' | 'timed';
}
const recipe = (id: string, action: string, objective: string, size: number, count: number, mode: EventRecipe['mode'] = 'assault', roster?: readonly EnemyKind[]): EventRecipe => ({
    id, action, objective, size, growth: 2, roster, elite: true, mode,
    rules: { count, interval: 2, duration: mode === 'timed' ? 90 : 0, hold: mode === 'defend' ? 12 : 0 },
});
export const EVENT_RECIPES: Readonly<Record<string, readonly EventRecipe[]>> = {
    graveyard: [recipe('vigil', 'Disturb the vigil', 'Defeat the guardians', 5, 3), recipe('grave-seals', 'Break the seals', 'Clear each seal and bind it', 4, 3, 'seals')],
    standingStones: [recipe('stone-ward', 'Bind the blessing', 'Defend the circle', 5, 2, 'defend')],
    cursedChest: [recipe('cursed-hoard', 'Unseal the chest', '90 seconds · More waves, more treasure', 5, 20, 'timed')],
    ruinedChapel: [recipe('profane-anchors', 'Break the ritual', 'Clear and break three ritual anchors', 5, 3, 'seals', ['caster', 'stalker', 'wisp', 'stalker']), recipe('chapel-guardian', 'Challenge the guardian', 'Defeat the tomb guardians', 6, 3, 'assault', ['brute', 'stalker', 'archer'])],
    beastDen: [recipe('brood', 'Purge the nests', 'Clear each nest and destroy it', 7, 3, 'seals', ['hound', 'hound', 'goblin']), recipe('alpha-hunt', 'Draw out the alpha', 'Defeat the hunting packs', 8, 3, 'assault', ['hound', 'hound', 'stalker', 'brute'])],
    quarry: [recipe('crystal-seam', 'Disturb the seam', 'Survive the crystal guardians', 6, 3, 'assault', ['wisp', 'brute', 'stalker']), recipe('quarry-hold', 'Secure the quarry', 'Hold the extraction site', 6, 3, 'defend', ['archer', 'stalker', 'brute'])],
    hamlet: [recipe('occupied-streets', 'Liberate the hamlet', 'Clear the occupying forces', 8, 3, 'assault', ['archer', 'stalker', 'hound', 'brute']), recipe('hamlet-wards', 'Break the occupation', 'Clear and dismantle the enemy standards', 6, 3, 'seals', ['goblin', 'goblin', 'archer', 'goblinChief'])],
    crossing: [recipe('blockade', 'Break the blockade', 'Defeat the road guards', 7, 3, 'assault', ['archer', 'stalker', 'brute']), recipe('crossing-hold', 'Hold the crossing', 'Defend the supply cache', 6, 3, 'defend', ['hound', 'stalker', 'archer'])],
    corruptedGrove: [recipe('blight-roots', 'Cleanse the roots', 'Clear and cleanse the corrupted roots', 6, 3, 'seals', ['wisp', 'hound', 'caster']), recipe('grove-heart', 'Purge the grove', 'Defend the heartwood', 7, 3, 'defend', ['stalker', 'wisp', 'brute'])],
};
for (const options of Object.values(EVENT_RECIPES)) {
    for (const r of options) {
        Object.freeze(r.rules);
        if (r.roster)
            Object.freeze(r.roster);
        Object.freeze(r);
    }
    Object.freeze(options);
}
Object.freeze(EVENT_RECIPES);
export function eventRecipe(site: Pick<EventSite, 'kind' | 'seed'>): EventRecipe | undefined {
    const options = EVENT_RECIPES[site.kind];
    return options?.[(site.seed >>> 8) % options.length];
}
export const isTrialKind = (kind: string): boolean => Object.hasOwn(EVENT_RECIPES, kind);
export function recipeMembers(site: EventSite) {
    const r = eventRecipe(site)!;
    return Array.from({ length: r.rules.count }, (_, wave) => Array.from({ length: Math.min(18, r.size + wave * r.growth) }, (_, i) => {
        const roster = r.roster ?? CAMP_BIOME_ROSTERS[site.biome];
        const final = wave === r.rules.count - 1 || r.mode === 'timed' && wave % 3 === 2;
        const rank: EnemyRank = i === 0 ? final && (site.scaling || site.level >= 3) && r.elite ? 'elite' : 'veteran' : i === 1 && wave > 1 ? 'veteran' : 'normal';
        return { wave, kind: roster[(i + wave) % roster.length], rank, seed: siteHash(site.seed, wave * 32 + i, 8791) };
    })).flat();
}
export function sealPoint(site: EventSite & {
    seals?: {
        x: number;
        y: number;
    }[];
}, wave: number) {
    if (site.seals?.[wave])
        return site.seals[wave];
    const angle = wave * Math.PI * 2 / 3 - Math.PI / 2;
    return { x: site.x + Math.cos(angle) * 105, y: site.y - 110 + Math.sin(angle) * 75 };
}
/** Freeze reachable objective anchors before starting a seal recipe. */
export function planSeals(site: EventSite, world: WorldQuery): {
    x: number;
    y: number;
}[] | null {
    const points: {
        x: number;
        y: number;
    }[] = [];
    for (let i = 0; i < 3; i++) {
        const preferred = sealPoint(site, i);
        const candidates = [preferred, ...Array.from({ length: 48 }, (_, n) => { const a = (i / 3 + n / 16) * Math.PI * 2, r = 100 + Math.floor(n / 16) * 50; return { x: site.x + Math.cos(a) * r, y: site.y + Math.sin(a) * r }; })];
        const point = candidates.find(p => !world.blocked(p.x, p.y, 22) && !world.isSanctuary?.(p.x, p.y) && hasLineOfSight(world, site.x, site.y, p.x, p.y) && points.every(q => Math.hypot(p.x - q.x, p.y - q.y) > 65));
        if (!point)
            return null;
        points.push(point);
    }
    return points;
}
