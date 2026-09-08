import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldNavigation, hasWalkableSegment } from '../src/world-navigation.ts';

function walk(nav: WorldNavigation, world: { blocked(x: number, y: number, radius: number): boolean }, start: { x: number; y: number }, goal: { x: number; y: number }, radius: number) {
    let { x, y } = start;
    for (let tick = 0; tick < 1800 && Math.hypot(goal.x - x, goal.y - y) > 4; tick++) {
        const p = nav.target(x, y, goal.x, goal.y, radius);
        const d = Math.hypot(p.x - x, p.y - y), scale = d > 0 ? Math.min(3, d) / d : 0;
        const nx = x + (p.x - x) * scale, ny = y + (p.y - y) * scale;
        assert.ok(!world.blocked(nx, ny, radius), `route clips terrain at ${nx},${ny}`);
        x = nx; y = ny;
    }
    assert.ok(Math.hypot(goal.x - x, goal.y - y) <= 4, `did not arrive: ${x},${y}`);
}

test('body-sized navigation detours through a U-shaped obstacle without cutting corners', () => {
    const rects = [{ x: -100, y: -160, w: 28, h: 320 }, { x: -100, y: -160, w: 260, h: 28 }, { x: -100, y: 132, w: 260, h: 28 }];
    const world = { blocked: (x: number, y: number, r: number) => rects.some(b => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) };
    walk(new WorldNavigation(world), world, { x: -240, y: 0 }, { x: 0, y: 0 }, 18);
});

test('target rounding into a trunk cannot strand pursuing enemies', () => {
    const world = { blocked: (x: number, y: number, r: number) => Math.hypot(x - 14, y - 14) < 10 + r || Math.hypot(x + 100, y) < 34 + r };
    const goal = { x: -12, y: -12 };
    assert.ok(world.blocked(0, 0, 12));
    assert.ok(!world.blocked(goal.x, goal.y, 12));
    walk(new WorldNavigation(world), world, { x: -250, y: 0 }, goal, 12);
});

test('a clear sight slit is not a walking route and disconnected ground is rejected', () => {
    const world = { blocked: (x: number, y: number, r: number) => Math.abs(x) < 12 + r && Math.abs(y) + r > 5 };
    assert.ok(hasWalkableSegment(world, -150, 0, 150, 0, 1));
    assert.ok(!hasWalkableSegment(world, -150, 0, 150, 0, 18));
    const nav = new WorldNavigation(world);
    for (let i = 0; i < 150; i++) assert.equal(nav.route(-150, 0, 150, 0, 18), null);
});

test('routes cannot cross sanctuary even if it is geometrically open', () => {
    const world = { blocked: () => false, isSanctuary: (x: number, y: number) => Math.abs(x) < 80 && Math.abs(y) < 100 };
    walk(new WorldNavigation(world), world, { x: -240, y: 0 }, { x: 240, y: 0 }, 18);
});

test('large guardians can approach a player standing close beside a tree', () => {
    const world = { blocked: (x: number, y: number, r: number) => Math.hypot(x - 25, y) < 10 + r };
    assert.ok(!world.blocked(0, 0, 12));
    const nav = new WorldNavigation(world);
    let p = { x: -300, y: 0 };
    for (let i = 0; i < 300; i++) {
        const next = nav.target(p.x, p.y, 0, 0, 18), d = Math.hypot(next.x - p.x, next.y - p.y);
        if (d) p = { x: p.x + (next.x - p.x) / d * Math.min(d, 3), y: p.y + (next.y - p.y) / d * Math.min(d, 3) };
        assert.ok(!world.blocked(p.x, p.y, 18));
    }
    assert.ok(Math.hypot(p.x, p.y) < 48);
});
