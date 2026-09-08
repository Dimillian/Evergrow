import { Exploration, type ExplorationWorld, type MapPOI, type MapRect } from '../exploration.ts';
import { EXPLORATION_CHUNK_SIZE, EXPLORATION_CHUNK_CELLS } from '../exploration-save.ts';

export const ATLAS_SURVEYS = Object.freeze([
  { id: 'local', label: 'Local', chunks: 16 },
  { id: 'wide', label: 'Wide', chunks: 32 },
  { id: 'vast', label: 'Vast', chunks: 64 },
] as const);
export const ATLAS_ZOOM = Object.freeze({ min: .001, max: .7 });
export function atlasSurveyBounds(id: string | null): MapRect {
  const size = (ATLAS_SURVEYS.find(s => s.id === id) ?? ATLAS_SURVEYS[1]).chunks * EXPLORATION_CHUNK_SIZE;
  return { x: -size / 2, y: -size / 2, width: size, height: size };
}

/** Disposable survey: real terrain/POIs, no saved discoveries or gameplay limits changed. */
export class AtlasSurvey extends Exploration {
  private landmarks = new Map<string, MapPOI>();
  override get discoveredPOICount() { return this.landmarks.size; }
  override getDiscoveredPOIs(bounds?: MapRect): MapPOI[] {
    return [...this.landmarks.values()].filter(p => !bounds || (p.x >= bounds.x && p.x <= bounds.x + bounds.width
      && p.y >= bounds.y && p.y <= bounds.y + bounds.height));
  }
  constructor(world: ExplorationWorld, region: MapRect) {
    super(world, { storage: null });
    const chunks = [];
    for (let y = region.y / EXPLORATION_CHUNK_SIZE; y < (region.y + region.height) / EXPLORATION_CHUNK_SIZE; y++)
      for (let x = region.x / EXPLORATION_CHUNK_SIZE; x < (region.x + region.width) / EXPLORATION_CHUNK_SIZE; x++)
        chunks.push({ x, y, revision: 0, words: new Uint32Array(EXPLORATION_CHUNK_CELLS).fill(0xffffffff) });
    if (!this.importSnapshot({ chunks, pois: [] })) throw new Error('Survey exceeds chart capacity');
  }
  /** Small spatial batches yield between frames; switching survey/closing cancels discovery. */
  async survey(region: MapRect, signal: AbortSignal, progress: (fraction: number) => void,
    yieldFrame = () => new Promise<void>(resolve => setTimeout(resolve, 0))) {
    const step = EXPLORATION_CHUNK_SIZE * 4, total = Math.ceil(region.width / step) * Math.ceil(region.height / step);
    let done = 0, started = performance.now();
    for (let y = region.y; y < region.y + region.height; y += step)
      for (let x = region.x; x < region.x + region.width; x += step) {
        if (signal.aborted) return;
        for (const poi of this.world.getPOIs(x, y, Math.min(step, region.x + region.width - x), Math.min(step, region.y + region.height - y)))
          if (this.isRevealed(poi.x, poi.y)) this.landmarks.set(poi.id, poi);
        this.revision++; done++;
        if (performance.now() - started >= 12 || done === total) {
          progress(done / total); await yieldFrame(); started = performance.now();
        }
      }
  }
}
