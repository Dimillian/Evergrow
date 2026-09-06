import { roadPaths } from '../src/road-shape.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { World, TILE_SIZE, pathDistance, type Prop } from '../src/world.ts';

test('world queries are reproducible, order-independent, and safe without a DOM', () => {
  const first = new World();
  const second = new World(7319);
  const expected = first.getProps(-800, -1200, 1600, 2000);
  assert.ok(expected.length > 60);
  first.getProps(4800, -6000, 1000, 1000);
  assert.deepEqual(first.getProps(-800, -1200, 1600, 2000), expected);
  assert.deepEqual(second.getProps(-800, -1200, 1600, 2000), expected);
  assert.notDeepEqual(new World(999).getProps(-800, -1200, 1600, 2000), expected);
  assert.equal(new Set(expected.map(prop => prop.id)).size, expected.length);
  for (let i = 1; i < expected.length; i++) assert.ok(expected[i].y >= expected[i - 1].y);
});

test('partitioned queries have exactly the same identities and values at negative coordinates', () => {
  const world = new World();
  const whole = world.getProps(-512, -512, 1024, 1024);
  const quadrants = [
    world.getProps(-512, -512, 512, 512), world.getProps(0, -512, 512, 512),
    world.getProps(-512, 0, 512, 512), world.getProps(0, 0, 512, 512),
  ].flat().sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  assert.deepEqual(quadrants, whole);
  const negativeTree = whole.find(prop => prop.x < -180 && prop.y < -140 && prop.kind !== 'rock');
  assert.ok(negativeTree);
  assert.equal(world.blocked(negativeTree.x, negativeTree.y, 1), true);
  assert.equal(world.blocked(0, 0, 12), false);
  assert.equal(world.blocked(-85, -95, 12), true);
  assert.equal(whole.filter(prop => prop.id === 'shrine:origin').length, 1);
});

test('the starting ellipse has no props except its shrine', () => {
  const props = new World().getProps(-180, -140, 360, 280);
  for (const prop of props) {
    if ((prop.x / 180) ** 2 + (prop.y / 140) ** 2 < 1) assert.equal(prop.id, 'shrine:origin');
  }
});

test('generated roads remain walkable across positive and negative regions', () => {
  for (const seed of [7319, 9, -127]) {
    const world = new World(seed);
    for (const road of roadPaths(-16000, -16000, 32000, 32000, seed)) {
      for (const [x,y] of road.points.filter((_,i)=>i%7===0)) {
        assert.ok(pathDistance(x,y,seed)<1e-6);
        assert.equal(world.blocked(x,y,14),false, `route blocked at ${x},${y}, seed ${seed}`);
      }
    }
  }
});

class SingleTreeWorld extends World {
  tree: Prop = { id: 'prop:-4:-7', x: -300, y: -500, radius: 12, kind: 'deadTree', seed: 1, scale: 1 };

  override getProps(x: number, y: number, width: number, height: number): Prop[] {
    const prop = this.tree;
    return prop.x >= x && prop.x < x + width && prop.y >= y && prop.y < y + height ? [prop] : [];
  }
}

test('a large movement cannot tunnel through a trunk, even with clear endpoints', () => {
  const world = new SingleTreeWorld();
  const radius = 11;
  const from = { x: world.tree.x - 160, y: world.tree.y };
  const result = world.move(from.x, from.y, 400, 0, radius);
  assert.ok(result.x > from.x + 100, 'the player should approach the trunk');
  assert.ok(result.x <= world.tree.x - radius - world.tree.radius + 0.001);
  assert.equal(result.y, from.y);
  assert.equal(world.blocked(result.x, result.y, radius), false);
});

test('diagonal movement slides along a trunk and preserves progress on its free axis', () => {
  const world = new SingleTreeWorld();
  const from = { x: world.tree.x - 60, y: world.tree.y - 10 };
  const result = world.move(from.x, from.y, 120, 55, 11);
  assert.ok(result.y > from.y + 45, 'movement should continue along the free vertical axis');
  assert.ok(result.x > world.tree.x, 'the player should pass around the trunk');
  assert.equal(world.blocked(result.x, result.y, 11), false);
});

test('unobstructed movement preserves requested displacement and rejects invalid query rectangles', () => {
  const world = new World();
  assert.deepEqual(world.move(0, 0, 12, 16, 12), { x: 12, y: 16 });
  assert.deepEqual(world.getProps(0, 0, -10, 20), []);
  assert.deepEqual(world.getProps(Infinity, 0, 10, 20), []);
});

test('ground tiles use an injected canvas and a bounded LRU cache', () => {
  let created = 0;
  const context = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    createImageData(width: number, height: number) { return { width, height, data: new Uint8ClampedArray(width * height * 4) }; },
    createRadialGradient() { return { addColorStop() {} }; },
    putImageData() {}, translate() {}, scale() {}, save() {}, restore() { this.globalAlpha = 1; }, rect() {}, clip() {}, closePath() {}, fill() {},
    fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, stroke() {},
  };
  const factory = () => {
    created++;
    return { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
  };
  const world = new World();
  const first = world.getGroundTile(-1, -1, factory);
  assert.equal(first.width, TILE_SIZE);
  assert.equal(first.height, TILE_SIZE);
  assert.equal(world.getGroundTile(-1, -1, factory), first);
  assert.equal(created, 1);
  const second = world.getGroundTile(0, -1, factory);
  for (let x = 1; x < 47; x++) world.getGroundTile(x, -1, factory);
  assert.equal(created, 48);
  assert.equal(world.getGroundTile(-1, -1, factory), first); // Make this entry most recently used.
  world.getGroundTile(47, -1, factory);
  assert.equal(world.getGroundTile(-1, -1, factory), first);
  assert.notEqual(world.getGroundTile(0, -1, factory), second);
  assert.equal(created, 50);
});


test('repeated prop and collision queries reuse immutable cell blueprints, including empty cells', () => {
  const world = new World(18427);
  const internals = world as unknown as { generateCellProp(x:number,y:number): unknown; propCells: Map<string,unknown> };
  const generate = internals.generateCellProp.bind(world); let generations=0;
  internals.generateCellProp=(x,y)=>{generations++;return generate(x,y);};
  const first=world.getProps(2100,1500,1400,1100), count=generations;
  assert.ok(first.length>0 && count>first.length);
  for(let i=0;i<20;i++) assert.deepEqual(world.getProps(2100,1500,1400,1100),first);
  assert.equal(generations,count);
  for(const prop of first.filter(p=>p.id.startsWith('prop:'))) assert.ok(Object.isFrozen(prop));
  for(let i=0;i<30;i++) world.blocked(2400,1800,14);
  assert.equal(generations,count,'collision reads reuse the same cells');
  world.dispose(); assert.equal(internals.propCells.size,0);
});

test('prop blueprint eviction is bounded and cannot alter regenerated identities or values', () => {
  const world = new World(7319);
  const internals = world as unknown as { cellProp(x:number,y:number): unknown; propCells: Map<string,unknown>; generateCellProp(x:number,y:number): unknown };
  const before=world.getProps(2100,1500,500,500);
  // Cheap deterministic empty cells exercise capacity without generating thousands of distant towns.
  const generate=internals.generateCellProp;
  internals.generateCellProp=()=>null;
  for(let i=0;i<9000;i++) internals.cellProp(100000+i,100000);
  assert.equal(internals.propCells.size,8192);
  internals.generateCellProp=generate;
  assert.deepEqual(world.getProps(2100,1500,500,500),before);
});


test('budgeted ground preparation stays private until complete and foreground requests resume the same canvas', t => {
  const original=Object.getOwnPropertyDescriptor(globalThis,'performance');
  let now=0,steps=0,created=0;
  Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now}});
  t.after(()=>original ? Object.defineProperty(globalThis,'performance',original) : Reflect.deleteProperty(globalThis,'performance'));
  const world=new World();
  const internals=world as unknown as {drawGroundSteps():Generator<void>;groundWork:Map<string,unknown>};
  internals.drawGroundSteps=function*(){for(let i=0;i<20;i++){steps++;now++;yield;}};
  const factory=()=>{created++;return {width:0,height:0,getContext:()=>({})} as unknown as HTMLCanvasElement;};
  assert.equal(world.getGroundTile(0,0,factory,0),null);assert.equal(created,0);
  assert.equal(world.getGroundTile(0,0,factory,2),null);assert.equal(steps,2);assert.equal(world.cacheStats.groundTiles,0);
  const ready=world.getGroundTile(0,0,factory);assert.ok(ready);assert.equal(steps,20);assert.equal(created,1);
  assert.equal(world.getGroundTile(0,0,factory,2),ready);assert.equal(steps,20);
  for(let i=1;i<40;i++)world.getGroundTile(i,0,factory,1);
  assert.equal(internals.groundWork.size,16,'abandoned preparation cannot grow indefinitely');
  world.dispose();assert.equal(internals.groundWork.size,0);
});
