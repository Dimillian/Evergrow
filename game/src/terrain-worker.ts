import { World } from './world.ts';
interface Request { id: number; seed: number; x: number; y: number; }
const scope = globalThis as unknown as { onmessage: (event: MessageEvent<Request>) => void; postMessage(value: unknown, transfer?: Transferable[]): void };
let world: World | undefined;
scope.onmessage = ({ data }) => {
  try {
    if (!world || world.seed !== data.seed) { world?.dispose(); world = new World(data.seed); }
    const tile = world.getGroundTile(data.x, data.y, () => new OffscreenCanvas(256, 256) as unknown as HTMLCanvasElement) as unknown as OffscreenCanvas;
    // transferToImageBitmap clears its canvas; keep World's cached tile intact.
    const copy = new OffscreenCanvas(256, 256); copy.getContext('2d')!.drawImage(tile, 0, 0);
    const bitmap = copy.transferToImageBitmap();
    scope.postMessage({ id: data.id, bitmap }, [bitmap]);
  } catch { scope.postMessage({ id: data.id, error: true }); }
};
