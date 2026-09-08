import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.ts';
import { eventSite, blessingChoices, type EventSite } from '../src/poi-content.ts';
import { EVENT_RECIPES, eventRecipe } from '../src/event-recipes.ts';
import { executeEvent } from '../src/poi-command.ts';
import { advanceTrial } from '../src/poi-runtime.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { worldNavigation, hasWalkableSegment } from '../src/world-navigation.ts';
import { isSpawnHidden } from '../src/spawn-visibility.ts';
import type { WorldQuery } from '../src/model.ts';
const persist = () => ({ ok: true, message: '' });

test('all wave recipes find nearby body-clear approaches around trees and an obstructed north edge', async () => {
    for (const kind of Object.keys(EVENT_RECIPES) as EventSite['kind'][]) for (const seed of [0, 256]) {
        const world: WorldQuery = {
            blocked: (x, y, r) => (Math.abs(x) < 190 + r && y + r > -310 && y - r < -260)
                || [{ x: -150, y: 160 }, { x: 100, y: 200 }, { x: -320, y: 60 }].some(p => Math.hypot(x - p.x, y - p.y) < 38 + r),
            move(x, y, dx, dy, r) { return this.blocked(x + dx, y + dy, r) ? { x, y } : { x: x + dx, y: y + dy }; },
            navigationTarget(x, y, tx, ty, radius) { return worldNavigation(this).target(x, y, tx, ty, radius); },
        };
        const sim = new Simulation(world, { spawn: false });
        const site: EventSite = { id: `site:7319:route-${kind}`, kind, name: kind, seed, x: 0, y: 30, level: 5, biome: 'deadwood' };
        assert.ok((await executeEvent(sim, site, kind === 'standingStones' ? 'haste' : null, persist)).ok);
        const view = { x: -350, y: -200, width: 700, height: 400 };
        for (let i = 0; i < 8; i++) advanceTrial({ state: sim.eventState, player: sim.player, enemies: sim.enemies, world, view,
            spawn: (k, x, y, r, source) => sim.spawnEnemy(k, x, y, r, source), dt: .5 });
        assert.equal(sim.enemies.length, eventRecipe(site)!.size, `${kind}/${seed}: whole first wave admitted`);
        for (const e of sim.enemies) {
            assert.ok(isSpawnHidden(e.x, e.y, view, e.radius));
            const route = worldNavigation(world).route(e.x, e.y, sim.player.x, sim.player.y, e.radius + 1, 2048);
            assert.ok(route && route.distance < 700, `${kind}: reachable, short approach`);
        }
        const wave = [...sim.enemies], attacked = new Set<number>();
        sim.player.hp = sim.player.maxHp = 1e6;
        // Pure headless combat regression, no browser or playable saves.
        for (let t = 0; t < 14 / FIXED_STEP; t++) {
            sim.update(FIXED_STEP, { moveX: 0, moveY: 0, aimX: 100, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null });
            for (const e of wave) if (e.state === 'attack') attacked.add(e.id);
        }
        assert.ok(wave.every(e => Math.hypot(e.x - sim.player.x, e.y - sim.player.y) < 320), `${kind}: no stranded guardians`);
        assert.ok(wave.every(e => attacked.has(e.id)), `${kind}: every guardian enters an attack`);
    }
});

test('seeded generated event sites admit complete first waves with collision-safe routes', async () => {
    const seen = new Set<string>();
    for (const seed of [7319, 42, 18427]) {
        const world = new World(seed);
        for (const blueprint of world.getWildernessSites(-8000, -8000, 16000, 16000)) {
            const site = eventSite(blueprint, seed), recipe = eventRecipe(site);
            if (!recipe) continue;
            const sim = new Simulation(world, { spawn: false, startX: site.x, startY: site.y });
            assert.ok((await executeEvent(sim, site, site.kind === 'standingStones' ? blessingChoices(site)[0] : null, persist)).ok, recipe.id);
            const view = { x: site.x - 480, y: site.y - 270, width: 960, height: 540 };
            for (let i = 0; i < 12; i++) advanceTrial({ state: sim.eventState, player: sim.player, enemies: sim.enemies, world, view,
                spawn: (k, x, y, r, source) => sim.spawnEnemy(k, x, y, r, source), dt: .5 });
            assert.equal(sim.enemies.length, recipe.size, `${recipe.id} ${blueprint.id}`);
            for (const e of sim.enemies) {
                assert.ok(isSpawnHidden(e.x, e.y, view, e.radius));
                assert.ok(!world.blocked(e.x, e.y, e.radius + 2));
                assert.ok(hasWalkableSegment(world, e.x, e.y, site.x, site.y, e.radius)
                    || worldNavigation(world).route(e.x, e.y, site.x, site.y, e.radius + 1, 2048), `${recipe.id}: full route exists`);
            }
            seen.add(recipe.id);
        }
    }
    assert.equal(seen.size, Object.values(EVENT_RECIPES).flat().length, 'every authored recipe covered in real terrain');
});
