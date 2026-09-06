import type { Prop } from './world.ts';

export interface PointLight {
  x: number;
  y: number;
  radius: number;
  color: string;
  power: number;
  shadows?: boolean;
  /** Fixed environmental anchor; dynamic lights render through the reusable scratch. */
  stationary?: boolean;
  /** World-space visibility polygon, used by enclosed environments. */
  clip?: readonly { x: number; y: number }[];
}

const stamps = new Map<string, HTMLCanvasElement>();

/** Cached, code-generated light cookies are shared by lights and flying sparks. */
function lightStamp(color: string): HTMLCanvasElement {
  const cached = stamps.get(color);
  if (cached) return cached;
  const image = document.createElement('canvas');
  image.width = image.height = 256;
  const c = image.getContext('2d')!;
  const gradient = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, color);
  gradient.addColorStop(.18, `${color}ce`);
  gradient.addColorStop(.5, `${color}58`);
  gradient.addColorStop(1, `${color}00`);
  c.fillStyle = gradient;
  c.fillRect(0, 0, 256, 256);
  if (stamps.size >= 24) stamps.delete(stamps.keys().next().value!);
  stamps.set(color, image);
  return image;
}

export function drawGlow(c: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, power = 1) {
  if (radius <= 0 || power <= 0) return;
  c.save();
  c.globalCompositeOperation = 'screen';
  c.globalAlpha *= Math.min(1, power);
  c.drawImage(lightStamp(color), x - radius, y - radius, radius * 2, radius * 2);
  c.restore();
}

/** Half-resolution surface illumination with bounded trunk/rock shadow casting. */
export class Lighting {
  private map = document.createElement('canvas');
  private context = this.map.getContext('2d')!;
  private scratch = document.createElement('canvas');
  private observed = new Set<string>();
  private nextObserved = new Set<string>();
  private cookies = new Map<string, HTMLCanvasElement>();
  private cookieProps: Prop[] | null = null;
  private scratchContext: CanvasRenderingContext2D;

  constructor() {
    this.scratch.width = this.scratch.height = 256;
    this.scratchContext = this.scratch.getContext('2d')!;
  }

  reset() { this.cookies.clear(); this.observed.clear(); this.nextObserved.clear(); this.cookieProps = null; }

  apply(target: CanvasRenderingContext2D, width: number, height: number,
    left: number, top: number, lights: PointLight[], props: Prop[], ambient = '#839cae', zoom = 1) {
    if (props !== this.cookieProps) { this.cookies.clear(); this.cookieProps = props; }
    const mw = Math.ceil(width / 2), mh = Math.ceil(height / 2);
    const worldWidth = width / zoom, worldHeight = height / zoom;
    // Use the real map ratios so odd-sized viewports upscale back onto the same
    // camera projection as the world, without drifting half a pixel at the edges.
    const scaleX = zoom * mw / width, scaleY = zoom * mh / height;
    if (this.map.width !== mw || this.map.height !== mh) {
      this.map.width = mw; this.map.height = mh;
    }
    const c = this.context;
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    // Cool moonlight keeps unlit combat terrain readable; warm sources change its color.
    c.fillStyle = ambient;
    c.fillRect(0, 0, mw, mh);
    c.globalCompositeOperation = 'lighter';
    this.nextObserved.clear();
    let shadowCount = 0;
    for (const light of lights.slice(0, 18)) {
      if (light.x + light.radius < left || light.x - light.radius > left + worldWidth
        || light.y + light.radius < top || light.y - light.radius > top + worldHeight) continue;
      const shadows = !!light.shadows && shadowCount++ < 4;
      // Power changes (fire flicker, roof fading) do not alter the reusable cookie.
      const key = `${light.x}:${light.y}:${light.radius}:${light.color}:${shadows}:` + (light.clip?.map(p => `${p.x},${p.y}`).join(';') ?? '');
      if (light.stationary) this.nextObserved.add(key);
      let cookie = !shadows && !light.clip?.length ? lightStamp(light.color) : light.stationary ? this.cookies.get(key) : undefined;
      if (!cookie) {
        const scratch = this.scratchContext;
        scratch.setTransform(1, 0, 0, 1, 0, 0);
        scratch.clearRect(0, 0, 256, 256);
        scratch.globalAlpha = 1;
        scratch.globalCompositeOperation = 'source-over';
        scratch.drawImage(lightStamp(light.color), 0, 0);
        if (light.clip?.length) {
          scratch.globalCompositeOperation = 'destination-in';
          scratch.fillStyle = '#fff';
          scratch.beginPath();
          light.clip.forEach((p, i) => {
            const x = 128 + (p.x - light.x) * 128 / light.radius, y = 128 + (p.y - light.y) * 128 / light.radius;
            if (i) scratch.lineTo(x, y); else scratch.moveTo(x, y);
          });
          scratch.closePath(); scratch.fill();
          scratch.globalCompositeOperation = 'source-over';
        }
        if (shadows) this.cutShadows(light, props);
        cookie = this.scratch;
        if (light.stationary && this.observed.has(key)) {
        cookie = document.createElement('canvas'); cookie.width = cookie.height = 256;
        cookie.getContext('2d')!.drawImage(this.scratch, 0, 0);
        if (this.cookies.size >= 32) this.cookies.delete(this.cookies.keys().next().value!);
        this.cookies.set(key, cookie);
        }
      }
      c.globalAlpha = Math.min(1, light.power);
      c.drawImage(cookie, (light.x - light.radius - left) * scaleX,
        (light.y - light.radius - top) * scaleY, light.radius * 2 * scaleX, light.radius * 2 * scaleY);
    }
    const previous = this.observed; this.observed = this.nextObserved; this.nextObserved = previous;
    c.globalAlpha = 1;
    target.save();
    target.globalCompositeOperation = 'multiply';
    target.imageSmoothingEnabled = true;
    target.drawImage(this.map, 0, 0, width, height);
    target.restore();
  }

  private cutShadows(light: PointLight, props: Prop[]) {
    const c = this.scratchContext, scale = 128 / light.radius;
    c.save();
    c.translate(128, 128); c.scale(scale, scale);
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = '#000';
    let count = 0;
    for (const prop of props) {
      if (prop.kind === 'shrine' || prop.radius <= 0) continue;
      const dx = prop.x - light.x, dy = prop.y - light.y;
      const distance = Math.hypot(dx, dy), radius = Math.max(3, prop.radius * .85);
      if (distance <= radius + 4 || distance - radius > light.radius || count++ >= 24) continue;
      const center = Math.atan2(dy, dx), spread = Math.asin(radius / distance);
      const near = Math.sqrt(distance * distance - radius * radius), far = light.radius * 1.7;
      // A wider, faint wedge softens the edge of the central shadow.
      for (const [softness, alpha] of [[.035, .2], [0, .65]]) {
        const a = center - spread - softness, b = center + spread + softness;
        c.globalAlpha = alpha;
        c.beginPath();
        c.moveTo(Math.cos(a) * near, Math.sin(a) * near);
        c.lineTo(Math.cos(a) * far, Math.sin(a) * far);
        c.lineTo(Math.cos(b) * far, Math.sin(b) * far);
        c.lineTo(Math.cos(b) * near, Math.sin(b) * near);
        c.closePath(); c.fill();
      }
    }
    c.restore();
  }
}
