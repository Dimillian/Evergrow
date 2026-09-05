import type { Prop } from './world.ts';

export interface PointLight {
  x: number;
  y: number;
  radius: number;
  color: string;
  power: number;
  shadows?: boolean;
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
  private scratchContext: CanvasRenderingContext2D;

  constructor() {
    this.scratch.width = this.scratch.height = 256;
    this.scratchContext = this.scratch.getContext('2d')!;
  }

  apply(target: CanvasRenderingContext2D, width: number, height: number,
    left: number, top: number, lights: PointLight[], props: Prop[]) {
    const mw = Math.ceil(width / 2), mh = Math.ceil(height / 2);
    if (this.map.width !== mw || this.map.height !== mh) {
      this.map.width = mw; this.map.height = mh;
    }
    const c = this.context;
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    // Cool moonlight keeps unlit combat terrain readable; warm sources change its color.
    c.fillStyle = '#839cae';
    c.fillRect(0, 0, mw, mh);
    c.globalCompositeOperation = 'lighter';
    let shadowCount = 0;
    for (const light of lights.slice(0, 18)) {
      if (light.x + light.radius < left || light.x - light.radius > left + width
        || light.y + light.radius < top || light.y - light.radius > top + height) continue;
      const scratch = this.scratchContext;
      scratch.setTransform(1, 0, 0, 1, 0, 0);
      scratch.clearRect(0, 0, 256, 256);
      scratch.globalAlpha = 1;
      scratch.globalCompositeOperation = 'source-over';
      scratch.drawImage(lightStamp(light.color), 0, 0);
      if (light.shadows && shadowCount++ < 4) this.cutShadows(light, props);
      c.globalAlpha = Math.min(1, light.power);
      c.drawImage(this.scratch, (light.x - light.radius - left) / 2,
        (light.y - light.radius - top) / 2, light.radius, light.radius);
    }
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
      if (prop.kind === 'shrine') continue;
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
