import { propDefinition } from './biome-props.ts';
import type { Prop } from './world.ts';

/** Atlas silhouettes are tied to real prop anchors; nothing is scattered for decoration. */
export function drawMapProps(c: CanvasRenderingContext2D, props: readonly Prop[], x: number, y: number, size: number, pixels: number): void {
  c.save(); c.setTransform(pixels / size, 0, 0, pixels / size, -x * pixels / size, -y * pixels / size);
  if (size >= 3072) c.globalAlpha *= .62;
  const trees = new Set(['tree', 'canopy', 'willow', 'snowPine', 'autumnTree', 'windTree']);
  const rocks = new Set(['rock', 'limestone', 'basalt', 'emberRock', 'iceCrystal']);
  for (const prop of props) {
    const { kind, scale, seed } = prop;
    if (!trees.has(kind) && !rocks.has(kind) && kind !== 'deadTree' && kind !== 'charredTree') continue;
    const r = (rocks.has(kind) ? 15 : (propDefinition(kind).canopy?.radius ?? 40) * .8) * scale;
    c.fillStyle = '#07161965'; c.beginPath(); c.ellipse(prop.x + r * .24, prop.y + r * .23, r * 1.1, r * .76, 0, 0, Math.PI * 2); c.fill();
    if (kind === 'deadTree' || kind === 'charredTree') {
      c.strokeStyle = kind === 'charredTree' ? '#6b6255' : '#839285'; c.lineWidth = 3 * scale;
      c.beginPath(); c.moveTo(prop.x, prop.y + 9 * scale); c.lineTo(prop.x, prop.y - r);
      c.moveTo(prop.x - r * .65, prop.y - r * .65); c.lineTo(prop.x, prop.y - r * .1);
      c.lineTo(prop.x + r * .7, prop.y - r * .8); c.stroke(); continue;
    }
    const color = kind === 'snowPine' ? ['#6c989a', '#bdd3c8'] : kind === 'autumnTree' ? ['#815b35', '#bf9651']
      : kind === 'willow' ? ['#315b53', '#54806a'] : kind === 'windTree' ? ['#515f45', '#89996a']
      : rocks.has(kind) ? kind === 'iceCrystal' ? ['#598e9b', '#abd5d9'] : kind === 'emberRock' ? ['#594538', '#a87853']
        : ['#59625a', '#929782'] : ['#294c3d', '#577552'];
    if (kind === 'tree' || kind === 'snowPine') {
      for (let tier = 0; tier < 3; tier++) {
        const span = r * (1 - tier * .23), top = prop.y - r * (.65 + tier * .4);
        c.fillStyle = tier === 0 ? color[0] : color[1]; c.beginPath();
        c.moveTo(prop.x, top - span * .65); c.lineTo(prop.x + span * .8, top + span * .6);
        c.lineTo(prop.x, top + span * .4); c.lineTo(prop.x - span * .8, top + span * .6); c.closePath(); c.fill();
        c.strokeStyle = '#142a2940'; c.lineWidth = 2; c.stroke();
      }
      continue;
    }
    const corners = rocks.has(kind) ? 5 : 11;
    c.beginPath();
    for (let i = 0; i < corners; i++) {
      const angle = i / corners * Math.PI * 2, radius = r * (.83 + Math.sin(seed + i * 2.4) * .14);
      const px = prop.x + Math.cos(angle) * radius, py = prop.y - r * .22 + Math.sin(angle) * radius * .84;
      if (!i) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath(); c.fillStyle = color[0]; c.fill(); c.strokeStyle = '#12292580'; c.lineWidth = 2; c.stroke();
    c.fillStyle = color[1]; c.beginPath();
    if (rocks.has(kind)) { c.moveTo(prop.x - r * .8, prop.y - r * .35); c.lineTo(prop.x - r * .2, prop.y - r); c.lineTo(prop.x + r * .65, prop.y - r * .35); c.lineTo(prop.x, prop.y + r * .12); }
    else { c.ellipse(prop.x - r * .22, prop.y - r * .48, r * .59, r * .43, -.3, 0, Math.PI * 2); }
    c.fill();
    if (size <= 1536 && !rocks.has(kind)) {
      c.fillStyle = '#bcc5a42b'; c.beginPath(); c.ellipse(prop.x - r * .3, prop.y - r * .58, r * .3, r * .18, -.3, 0, Math.PI * 2); c.fill();
    }
  }
  c.restore();
}

export function drawMapBuilding(c: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, kind?: string): void {
  c.fillStyle = '#030d13a0'; c.fillRect(x + 2, y + 3, width, height);
  c.fillStyle = '#283637'; c.fillRect(x - 1, y - 1, width + 2, height + 2);
  const warm = kind === 'inn' || kind === 'merchant';
  c.fillStyle = warm ? '#a08b65' : '#7f9394'; c.fillRect(x, y, width / 2, height);
  c.fillStyle = warm ? '#6e5e48' : '#4d646a'; c.fillRect(x + width / 2, y, width / 2, height);
  c.strokeStyle = '#d0c8a8a0'; c.lineWidth = .7; c.strokeRect(x, y, width, height);
  if (width < 7 || height < 7) return;
  c.strokeStyle = '#172c3650';
  for (let row = 3; row < height - 1; row += 4) { c.beginPath(); c.moveTo(x + 1, y + row); c.lineTo(x + width - 1, y + row); c.stroke(); }
  c.strokeStyle = '#cec8a4'; c.beginPath(); c.moveTo(x + width / 2, y + 1); c.lineTo(x + width / 2, y + height - 1); c.stroke();
  c.fillStyle = '#d8b96f'; c.fillRect(x + width * .5 - 1.5, y + height - 1, 3, 2);
}
