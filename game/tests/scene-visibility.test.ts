import assert from 'node:assert/strict';
import test from 'node:test';
import { SceneVisibility } from '../src/scene-visibility.ts';
import type { Prop } from '../src/world.ts';

function fixture() {
  let propQueries = 0, buildingQueries = 0, siteQueries = 0;
  const props: Prop[] = [];
  return { props, get siteQueries() { return siteQueries; }, get propQueries() { return propQueries; }, get buildingQueries() { return buildingQueries; },
    getWildernessSites() { siteQueries++; return []; },
    getProps() { propQueries++; return props; }, getBuildings() { buildingQueries++; return []; } };
}
const view = { left: -200, top: -100, width: 900, height: 600 };

test('world replacement invalidates stationary scene coverage, including empty results', () => {
  const cache = new SceneVisibility(), first = fixture(), second = fixture();
  cache.update(first, view); assert.equal(cache.props, first.props);
  cache.update(second, view); assert.equal(cache.props, second.props);
  assert.equal(second.propQueries, 1); assert.equal(second.buildingQueries, 1);
});

test('panning reuses padded coverage but zooming any edge beyond it refreshes both scene queries', () => {
  const cache = new SceneVisibility(), world = fixture();
  cache.update(world, view);
  cache.update(world, { ...view, left: view.left + 20, top: view.top - 30 });
  assert.equal(world.propQueries, 1);
  cache.update(world, { ...view, width: view.width + 66 });
  assert.equal(world.propQueries, 2); assert.equal(world.buildingQueries, 2); assert.equal(world.siteQueries, 2);
  cache.update(world, { ...view, width: view.width + 66, height: view.height + 66 });
  assert.equal(world.propQueries, 3);
  cache.reset(); assert.equal(cache.props.length, 0); assert.equal(cache.buildings.length, 0); assert.equal(cache.sites.length, 0);
  cache.update(world, view); assert.equal(world.propQueries, 4);
});

test('caller mutation cannot alter cached view bounds or defeat coverage refresh', () => {
  const cache = new SceneVisibility(), world = fixture(), mutable = { ...view };
  cache.update(world, mutable); mutable.left += 200;
  cache.update(world, mutable); assert.equal(world.propQueries, 2);
});
