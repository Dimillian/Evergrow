import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeon, dungeonBlocked, type DungeonFloor, type Room } from '../src/dungeon.ts';
import { cryptOutline, cryptContains } from '../src/dungeon-contours.ts';
import { cryptFixtures, cryptLights, cryptLightMask } from '../src/dungeon-lighting.ts';

test('worn outlines keep original travel rectangles and saved positions clear across orientations', () => {
    for (let seed = 0; seed < 32; seed++) {
        const floor = generateDungeon(seed);
        for (const room of [...floor.rooms, ...floor.corridors]) {
            assert.ok(Object.isFrozen(cryptOutline(room)));
            for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
                const x = room.x + room.width * i / 8, y = room.y + room.height * j / 8;
                assert.ok(cryptContains(room, x, y));
                assert.equal(dungeonBlocked(floor, x, y, 0), false);
            }
            assert.equal(cryptContains(room, room.x - 100, room.y - 100), false);
            assert.ok(cryptOutline(room).some(p => p.x < room.x || p.y < room.y));
        }
    }
});

test('crypt fixtures are deterministic, bounded and share visible source/light anchors', () => {
    for (let seed = 0; seed < 30; seed++) {
        const f = generateDungeon(seed), fixtures = cryptFixtures(f);
        assert.deepEqual(fixtures, cryptFixtures(generateDungeon(seed)));
        assert.ok(Object.isFrozen(fixtures));
        assert.ok(fixtures.length >= 30 && fixtures.length <= 100);
        assert.ok(fixtures.some(p => p.kind === 'orb'));
        for (const p of fixtures) assert.equal(dungeonBlocked(f, p.x, p.y, 0), false);
        const a = cryptLights(f, 0), b = cryptLights(f, 1);
        assert.deepEqual(a.map(({x,y,radius}) => ({x,y,radius})), b.map(({x,y,radius}) => ({x,y,radius})));
        assert.ok(a.some((p,i) => p.power !== b[i].power));
        assert.deepEqual(a.map(({x,y}) => ({x,y})), fixtures.map(({x,y}) => ({x,y})));
    }
});

test('crypt illumination stops at solid masonry instead of crossing into a neighboring chamber', () => {
    const room: Room = {id:0,x:-100,y:-100,width:200,height:200,kind:'entry'};
    const next: Room = {id:1,x:300,y:-100,width:200,height:200,kind:'combat'};
    const f: DungeonFloor = {seed:1, rooms:[room,next], corridors:[],edges:[],members:[],entry:{x:0,y:0},exit:{x:400,y:0},chests:[]};
    const light = {x:0,y:0,radius:500,color:'#ffffff',power:1};
    const mask = cryptLightMask(f, light);
    assert.equal(mask.length, 96);
    assert.ok(mask.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
    assert.ok(mask[0].x < 220, 'right ray stops at the first room wall, including its illuminated face');
    assert.ok(mask[0].x > 100, 'the exposed wall receives light');
    assert.strictEqual(mask, cryptLightMask(f,light), 'stationary sources reuse the visibility fan');
    assert.deepEqual(mask, cryptLightMask({...f},light));
});
