/** Small native-density cache for static procedural UI chrome. Animation/text remain live.
 * Context ownership prevents sharing raster scale between previews and the real display. */
const caches = new WeakMap<CanvasRenderingContext2D, Map<string, HTMLCanvasElement>>();
export function drawCachedUIArt(c: CanvasRenderingContext2D, id: string, x: number, y: number,
  width: number, height: number, draw: (art: CanvasRenderingContext2D) => void): void {
  const transform = c.getTransform();
  const density = Math.max(1, Math.ceil(Math.max(Math.hypot(transform.a, transform.b), Math.hypot(transform.c, transform.d)) * 4) / 4);
  let cache = caches.get(c);
  if (!cache) { cache = new Map(); caches.set(c, cache); }
  const key = `${id}:${density}`;
  let canvas = cache.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * density); canvas.height = Math.ceil(height * density);
    const art = canvas.getContext('2d')!;
    art.setTransform(density, 0, 0, density, -x * density, -y * density);
    art.lineCap = c.lineCap; art.lineJoin = c.lineJoin;
    draw(art);
    if (cache.size >= 4) cache.delete(cache.keys().next().value!);
    cache.set(key, canvas);
  }
  c.drawImage(canvas, 0, 0, width * density, height * density, x, y, width, height);
}
