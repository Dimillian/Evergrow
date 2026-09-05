import test from 'node:test';
import assert from 'node:assert/strict';
import { CameraZoom, cameraView, cameraFollowTarget, cameraSpawnExclusion, screenToWorld, worldToScreen,
  MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM } from '../src/camera.ts';
import type { CameraBounds, CameraView } from '../src/camera.ts';

const near = (actual: number, expected: number, message = '', tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${message}: expected ${expected}, received ${actual}`);

test('wheel input normalizes pixel, line and page deltas with symmetric directions', () => {
  for (const [delta, mode] of [[-100, 0], [-6.25, 1], [-.125, 2]]) {
    const zoom = new CameraZoom();
    zoom.wheel(delta, mode, 800);
    near(zoom.target, 1.12, 'wheel up magnifies by the same amount in each unit');
    assert.equal(zoom.value, 1, 'wheel changes the target without jumping the rendered view');
    zoom.wheel(-delta, mode, 800);
    near(zoom.target, 1, 'equal opposite wheel movement restores the target');
  }
});

test('fractional trackpad deltas accumulate without requiring full wheel notches', () => {
  const trackpad = new CameraZoom(), wheel = new CameraZoom();
  for (let index = 0; index < 200; index++) trackpad.wheel(-.5, 0, 800);
  wheel.wheel(-100, 0, 800);
  near(trackpad.target, wheel.target);
  trackpad.update(1 / 60);
  assert.ok(trackpad.value > 1 && trackpad.value < trackpad.target);
});

test('zoom limits discard excess input so reversing the wheel responds immediately', () => {
  const zoom = new CameraZoom();
  for (let index = 0; index < 100; index++) zoom.wheel(-100, 0, 800);
  assert.equal(zoom.target, MAX_CAMERA_ZOOM);
  zoom.wheel(1, 0, 800);
  assert.ok(zoom.target < MAX_CAMERA_ZOOM, 'no accumulated over-zoom to unwind');
  for (let index = 0; index < 100; index++) zoom.wheel(100, 0, 800);
  assert.equal(zoom.target, MIN_CAMERA_ZOOM);
  zoom.wheel(-1, 0, 800);
  assert.ok(zoom.target > MIN_CAMERA_ZOOM, 'no accumulated under-zoom to unwind');
});

test('large wheel events are bounded and invalid input cannot corrupt camera state', () => {
  const large = new CameraZoom(), bounded = new CameraZoom();
  large.wheel(-1e9, 0, 800);
  bounded.wheel(-300, 0, 800);
  near(large.target, bounded.target);
  assert.ok(large.target < MAX_CAMERA_ZOOM, 'one unusually large event does not jump to the limit');
  for (const delta of [NaN, Infinity, -Infinity, 0]) large.wheel(delta, 0, 800);
  large.wheel(-1, 2, NaN);
  near(large.target, bounded.target);
});

test('zoom converges without overshoot and is independent of frame rate', () => {
  const values: number[] = [];
  for (const fps of [30, 60, 144]) {
    const zoom = new CameraZoom();
    zoom.wheel(-300, 0, 800);
    let previous = zoom.value;
    for (let frame = 0; frame < fps; frame++) {
      const value = zoom.update(1 / fps);
      assert.ok(value > previous && value < zoom.target);
      previous = value;
    }
    values.push(zoom.value);
    near(zoom.value, zoom.target, 'settles near target within one second', 1e-5);
    zoom.wheel(300, 0, 800);
    const next = zoom.update(1 / fps);
    assert.ok(next < previous && next > zoom.target, 'changing direction immediately changes motion');
  }
  for (const value of values) near(value, values[0], 'same elapsed time gives the same zoom');
});

test('zero elapsed time holds the view and reduced motion applies the target directly', () => {
  const zoom = new CameraZoom();
  zoom.wheel(-100, 0, 800);
  for (const dt of [0, -1, NaN, Infinity]) assert.equal(zoom.update(dt), 1);
  assert.equal(zoom.update(1 / 60, true), zoom.target);
});

test('world and screen coordinates round trip at every zoom including fractional camera shake', () => {
  for (const zoom of [MIN_CAMERA_ZOOM, .837, 1, 1.427, MAX_CAMERA_ZOOM]) {
    const view = cameraView(1037, 617, -592.53, 1314.17, zoom, 3.41, -1.79);
    const center = worldToScreen(view, -592.53, 1314.17);
    near(center.x, 1037 / 2 + 3.41, 'camera position projects to center plus kick');
    near(center.y, 617 / 2 - 1.79);
    for (const [x, y] of [[0, 0], [1037, 617], [37.21, 513.64], [518.5, 308.5]]) {
      const world = screenToWorld(view, x, y);
      const screen = worldToScreen(view, world.x, world.y);
      near(screen.x, x, 'aim projects back to its original screen point');
      near(screen.y, y);
    }
  }
});

test('visible world bounds match screen edges and zooming out expands them', () => {
  const regular = cameraView(960, 600, 172.3, -421.6, 1);
  for (const zoom of [MIN_CAMERA_ZOOM, 1, MAX_CAMERA_ZOOM]) {
    const view = cameraView(960, 600, 172.3, -421.6, zoom, -2.6, 4.2);
    const topLeft = worldToScreen(view, view.left, view.top);
    const bottomRight = worldToScreen(view, view.left + view.width, view.top + view.height);
    near(topLeft.x, 0); near(topLeft.y, 0);
    near(bottomRight.x, 960); near(bottomRight.y, 600);
    near(view.width * zoom, regular.width);
    near(view.height * zoom, regular.height);
  }
  const wide = cameraView(960, 600, 172.3, -421.6, MIN_CAMERA_ZOOM);
  assert.ok(wide.left < regular.left && wide.top < regular.top);
  assert.ok(wide.left + wide.width > regular.left + regular.width);
  assert.ok(wide.top + wide.height > regular.top + regular.height);
});

function containsView(bounds: CameraBounds, view: CameraView, message: string) {
  const epsilon = 1e-8;
  assert.ok(bounds.x <= view.left + epsilon && bounds.y <= view.top + epsilon
    && bounds.x + bounds.width >= view.left + view.width - epsilon
    && bounds.y + bounds.height >= view.top + view.height - epsilon, message);
}

test('spawn bounds protect every pending zoom frame without changing the displayed view', () => {
  const player = { x: -131.5, y: 729.25, vx: 0, vy: 0 };
  const target = cameraFollowTarget(player);
  for (const [zoom, pending] of [[1.8, .65], [.65, 1.8], [1, 1]]) {
    const displayed = Object.freeze(cameraView(1024, 640, target.x, target.y, zoom, 7.6, -6.12));
    const snapshot = { ...displayed };
    const bounds = cameraSpawnExclusion(1024, 640, target.x, target.y, zoom, pending, displayed, player, 360);
    containsView(bounds, displayed, 'last displayed kick is protected');
    for (let step = 0; step <= 10; step++) {
      const intermediate = zoom + (pending - zoom) * step / 10;
      containsView(bounds, cameraView(1024, 640, target.x, target.y, intermediate, -7.6, 6.12),
        'instant reduced-motion zoom and every smoothed zoom share the protected rectangle');
    }
    assert.deepEqual(displayed, snapshot, 'querying the guard does not change aiming or camera geometry');
  }
});

test('spawn bounds retain the old frame and expanded dimensions through resize', () => {
  const player = { x: 400, y: -800, vx: 0, vy: 0 };
  const displayed = cameraView(1400, 480, 370, -815, .8);
  for (const [width, height] of [[2000, 900], [600, 900], [540, 450]]) {
    const bounds = cameraSpawnExclusion(width, height, 370, -815, .8, .65, displayed, player, 360);
    containsView(bounds, displayed, 'resizing cannot drop the still-displayed old world edges');
    containsView(bounds, cameraView(width, height, 370, -815, .65), 'new full-size target view is protected');
  }
});

test('spawn bounds cover camera catch-up, near-future travel and a changed movement direction', () => {
  for (const [vx, vy] of [[360, 0], [0, -360], [-254.56, 254.56], [0, 0]]) {
    const player = { x: 820, y: -195, vx, vy };
    const camera = { x: 660, y: -110 };
    const displayed = cameraView(1200, 680, camera.x, camera.y, 1.2);
    const bounds = cameraSpawnExclusion(1200, 680, camera.x, camera.y, 1.2, .65, displayed, player, 360);
    for (const t of [0, .025, .05, .1]) {
      const moving = cameraFollowTarget({ ...player, x: player.x + vx * t, y: player.y + vy * t });
      for (const follow of [0, .25, .5, 1]) {
        containsView(bounds, cameraView(1200, 680,
          camera.x + (moving.x - camera.x) * follow, camera.y + (moving.y - camera.y) * follow, .65),
        'the whole camera catch-up path toward the moving player stays protected');
      }
    }
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const dx = Math.cos(angle) * 360, dy = Math.sin(angle) * 360;
      const changed = cameraFollowTarget({ x: player.x + dx * .05, y: player.y + dy * .05, vx: dx, vy: dy });
      containsView(bounds, cameraView(1200, 680, changed.x, changed.y, .65),
        'a fresh dodge or reversed input cannot uncover a birth during the next frame');
    }
  }
});

test('stationary camera guard adds only camera motion space, leaving enemy body padding to spawn visibility', () => {
  const player = { x: 0, y: 0, vx: 0, vy: 0 }, follow = cameraFollowTarget(player);
  const displayed = cameraView(960, 600, follow.x, follow.y, 1);
  const bounds = cameraSpawnExclusion(960, 600, follow.x, follow.y, 1, 1, displayed, player, 360);
  assert.ok(bounds.width > 960 && bounds.width < 1080);
  assert.ok(bounds.height > 600 && bounds.height < 720);
});
