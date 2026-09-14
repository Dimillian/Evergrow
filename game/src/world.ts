import { WorldLandscape, TILE_SIZE, hash, random, noise, smoothstep } from './world-landscape.ts';
import { waterTerrainSteps } from './water-terrain-art.ts';
import { groundSurfaceSteps } from './ground-surface.ts';
import { drawGroundPatches } from './ground-art.ts';
import { drawRoadDetails } from './road-art.ts';
import { drawBiomeGroundAccent } from './biome-prop-art.ts';
import { contains } from './settlements.ts';
import { pathDistance } from './road-shape.ts';
import { chooseBiomeProp } from './biome-props.ts';
export { TILE_SIZE, WORLD_GENERATION_VERSION, pathDistance, type Prop } from './world-landscape.ts';
const TILE_CACHE_LIMIT = 48;
type CanvasFactory = () => HTMLCanvasElement;

/** Canvas terrain presentation over the same headless landscape used by gameplay. */
export class World extends WorldLandscape {
  private groundWork = new Map<string, { canvas: HTMLCanvasElement; steps: Generator<void> }>();
  private groundTiles = new Map<string, HTMLCanvasElement>();
  override get cacheStats() { return { ...super.cacheStats, groundTiles: this.groundTiles.size }; }
  override dispose() { this.groundWork.clear(); this.groundTiles.clear(); super.dispose(); }

  /** Continuous coarse underlay while full-detail worker tiles are pending. */
  drawGroundPreview(c: CanvasRenderingContext2D, tx: number, ty: number) {
    const x = tx * TILE_SIZE, y = ty * TILE_SIZE;
    const towns = this.getSettlements(x - 192, y - 192, TILE_SIZE + 384, TILE_SIZE + 384);
    for (const _ of groundSurfaceSteps(c, 0, 0, 16, (sx, sy) => this.surfaceColor(x + sx * 16, y + sy * 16, towns, false))) { /* 25 shared samples */ }
  }

  /** Ground is rendered only on demand; the constructor and queries need no DOM. */
  getGroundTile(tileX: number, tileY: number, createCanvas?: CanvasFactory): HTMLCanvasElement;
  getGroundTile(tileX: number, tileY: number, createCanvas: CanvasFactory | undefined, budget: number): HTMLCanvasElement | null;
  getGroundTile(tileX: number, tileY: number, createCanvas?: CanvasFactory, budget = Infinity): HTMLCanvasElement | null {
    if (![tileX, tileY, tileX * TILE_SIZE, tileY * TILE_SIZE,
      (tileX + 1) * TILE_SIZE, (tileY + 1) * TILE_SIZE].every(Number.isSafeInteger)) {
      throw new RangeError('Ground tile coordinates must be safe integers.');
    }
    const key = `${tileX}:${tileY}`;
    const cached = this.groundTiles.get(key);
    if (cached) {
      this.groundTiles.delete(key);
      this.groundTiles.set(key, cached);
      return cached;
    }
    if (!(budget > 0)) return null;
    const deadline = performance.now() + budget;
    let work = this.groundWork.get(key);
    if (!work) {
      const canvas = createCanvas ? createCanvas() : document.createElement('canvas');
      canvas.width = TILE_SIZE; canvas.height = TILE_SIZE;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('A 2D canvas context is required for ground tiles.');
      work = { canvas, steps: this.drawGroundSteps(context, tileX * TILE_SIZE, tileY * TILE_SIZE) };
      if (this.groundWork.size >= 16) this.groundWork.delete(this.groundWork.keys().next().value!);
      this.groundWork.set(key, work);
    }
    let complete = false;
    while (performance.now() < deadline) if (work.steps.next().done) { complete = true; break; }
    if (!complete) return null;
    const { canvas } = work;
    this.groundWork.delete(key);
    this.groundTiles.set(key, canvas);
    if (this.groundTiles.size > TILE_CACHE_LIMIT) {
      this.groundTiles.delete(this.groundTiles.keys().next().value!);
    }
    return canvas;
  }

  private *drawGroundSteps(context: CanvasRenderingContext2D, originX: number, originY: number): Generator<void> {
    // Resolve nearby geometry once per tile, never while looking up individual pixels.
    const towns = this.getSettlements(originX - 192, originY - 192, TILE_SIZE + 384, TILE_SIZE + 384);
    const buildings = towns.flatMap(town => town.buildings);
    // Every material sample and detail anchor is in world space. Tile edges are
    // merely a crop of the same illustration, including at negative coordinates.
    yield* groundSurfaceSteps(context, originX, originY, TILE_SIZE, (x, y) => this.surfaceColor(x, y, towns, true));
    yield* waterTerrainSteps(context, originX, originY, TILE_SIZE, (x, y) => this.hydrology.sample(x, y));
    yield;
    drawGroundPatches(context, originX, originY, TILE_SIZE, this.seed, (x, y) => this.sampleBiome(x, y).id,
      (x, y) => this.roadWeight(x, y) < .025 && this.pavingWeight(towns, x, y, 0) < .025 && this.hydrology.sample(x, y).coverage < .02
        && !buildings.some(building => contains(building, x, y, 12)));
    yield;
    drawRoadDetails(context, originX, originY, TILE_SIZE, this.seed, (x, y) => {
      if (buildings.some(building => contains(building, x, y, 10))) return { road: 0, paved: 0 };
      const road = this.roadWeight(x, y);
      return { road:towns.some(t=>Math.hypot(x-t.x,y-t.y)<t.radius-100)?0:road, paved: towns.some(t=>t.kind==='city')?this.pavingWeight(towns,x,y,road)*smoothstep(.48,.76,noise(x/125,y/125,this.seed+941))*.6:0 };
    });

    yield;
    const detailCell = 15;
    const margin = 22;
    for (let cy = Math.floor((originY - margin) / detailCell);
      cy <= Math.floor((originY + TILE_SIZE + margin) / detailCell); cy++) {
      for (let cx = Math.floor((originX - margin) / detailCell);
        cx <= Math.floor((originX + TILE_SIZE + margin) / detailCell); cx++) {
        const wx = (cx + random(cx, cy, this.seed, 211)) * detailCell;
        const wy = (cy + random(cx, cy, this.seed, 212)) * detailCell;
        const px = wx - originX;
        const py = wy - originY;
        const pick = random(cx, cy, this.seed, 213);
        const onRoad = pathDistance(wx, wy, this.seed) < 37;
        if (this.hydrology.sample(wx, wy).coverage > .08 || buildings.some(building => contains(building, wx, wy, 9))
          || this.pavingWeight(towns, wx, wy, this.roadWeight(wx, wy)) > .08) continue;
        const weights = this.sampleBiome(wx, wy).weights;
        const { biome } = chooseBiomeProp(weights, random(cx, cy, this.seed, 217), 0);
        if (drawBiomeGroundAccent(context, biome, px, py, pick, hash(cx, cy, this.seed, 218), onRoad)) continue;
        if (biome === 'swamp' && !onRoad && noise(wx / 180, wy / 180, this.seed + 201) > .64) {
          if (pick > .8) {
            context.strokeStyle = 'rgba(90,160,161,0.22)'; context.lineWidth = .7;
            context.beginPath(); context.moveTo(px - 4, py); context.lineTo(px + 5, py);
            context.moveTo(px + 7, py + 2); context.lineTo(px + 10, py + 2); context.stroke();
          } else if (pick < .055) {
            context.fillStyle = 'rgba(87,128,76,0.7)'; context.fillRect(px - 2, py - 1, 5, 3);
            context.fillStyle = 'rgba(159,167,96,0.5)'; context.fillRect(px, py - 1, 2, 1);
          }
          continue;
        }

        if (pick < (onRoad ? 0.08 : 0.18 + noise(wx / 83, wy / 83, this.seed + 239) * .23)) {
          const length = 3 + random(cx, cy, this.seed, 214) * 5;
          const lean = random(cx, cy, this.seed, 215) * 5 - 2.5;
          context.strokeStyle = biome === 'swamp' ? 'rgba(111,155,132,0.31)' : biome === 'verdant' ? 'rgba(99,180,87,0.36)'
            : biome === 'autumn' ? 'rgba(161,151,83,0.33)' : biome === 'highlands' ? 'rgba(155,160,122,0.35)'
              : biome === 'frostpine' ? 'rgba(139,174,176,0.25)' : biome === 'emberfall' ? 'rgba(133,115,104,0.24)' : 'rgba(90,144,96,0.26)';
          context.lineWidth = 0.65;
          context.beginPath();
          context.moveTo(px, py);
          context.quadraticCurveTo(px + lean * 0.3, py - length * 0.55, px + lean, py - length);
          context.moveTo(px + 1, py);
          context.lineTo(px + 3 + lean * 0.3, py - length * 0.55);
          context.stroke();
        } else if (pick > 0.78) {
          const size = 0.8 + random(cx, cy, this.seed, 216) * 1.4;
          context.fillStyle = onRoad ? 'rgba(104,98,79,0.23)' : 'rgba(76,85,77,0.17)';
          context.fillRect(px, py, size * 1.6, size);
          context.fillStyle = 'rgba(5,11,12,0.15)';
          context.fillRect(px, py + size, size * 1.8, 0.8);
        } else if (pick > 0.70 && !onRoad) {
          context.strokeStyle = 'rgba(9,15,15,0.24)';
          context.lineWidth = 0.8;
          context.beginPath();
          context.moveTo(px - 3, py - 1);
          context.lineTo(px + 7, py + 2);
          context.lineTo(px + 11, py);
          context.moveTo(px + 2, py + 0.5);
          context.lineTo(px + 4, py - 3);
          context.stroke();
        }
      }
      yield;
    }
  }
}
