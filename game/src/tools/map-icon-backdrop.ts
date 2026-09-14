import { World } from '../world.ts';
import { roadPaths } from '../road-shape.ts';
import { drawMapBuilding, drawMapProps } from '../map-terrain-art.ts';

/** A disposable, fixed world crop; uses actual terrain and placement queries. */
export function createMapIconBackdrop(): HTMLCanvasElement {
  const world = new World(7319), size = 1536, pixels = 256, origin = -size / 2;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = pixels;
  const c = canvas.getContext('2d')!;
  try {
    for (let y = 0; y < pixels; y += 2) for (let x = 0; x < pixels; x += 2) {
      c.fillStyle = world.atlasColor(origin + x * size / pixels, origin + y * size / pixels);
      c.fillRect(x, y, 2, 2);
    }
    drawMapProps(c, world.getProps(origin - 160, origin - 160, size + 320, size + 320), origin, origin, size, pixels);
    c.save(); c.setTransform(pixels / size, 0, 0, pixels / size, -origin * pixels / size, -origin * pixels / size);
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const road of roadPaths(origin, origin, size, size, world.seed)) {
      c.beginPath(); c.moveTo(...road.points[0]);
      for (const point of road.points.slice(1)) c.lineTo(...point);
      c.strokeStyle = '#15232180'; c.lineWidth = road.main ? 37 : 29; c.stroke();
      c.strokeStyle = road.main ? '#c8b88dba' : '#b4a88091'; c.lineWidth = road.main ? 22 : 16; c.stroke();
    }
    c.restore();
    for (const b of world.getBuildings(origin, origin, size, size))
      drawMapBuilding(c, (b.x - origin) * pixels / size, (b.y - origin) * pixels / size,
        b.width * pixels / size, b.height * pixels / size, b.kind);
    return canvas;
  } finally { world.dispose(); }
}
