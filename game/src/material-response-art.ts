import { MATERIALS } from './material-content.ts';
import { fragmentPose, type MaterialBurst } from './material-response.ts';
/** Geometry and shading consume the same material/trajectory recipes as the response manager. */
export function drawMaterialBurst(c: CanvasRenderingContext2D, burst: MaterialBurst, reducedMotion: boolean): void {
  const recipe = MATERIALS[burst.material];
  c.save(); c.translate(burst.x, burst.y);
  if (!reducedMotion && burst.age < .6) {
    c.save(); c.globalAlpha *= (1 - burst.age / .6) * .14 * burst.strength; c.fillStyle = recipe.dust;
    for (let i = 0; i < 5; i++) { const angle = i * Math.PI * 2 / 5;
      c.beginPath(); c.ellipse(Math.cos(angle) * burst.age * 30, Math.sin(angle) * burst.age * 14 - 5,
        2 + burst.age * 12, 1 + burst.age * 7, angle, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  for (const f of burst.fragments) {
    const p = fragmentPose(burst, f, reducedMotion); if (!p.opacity) continue;
    c.save(); c.globalAlpha *= p.opacity;
    if (!recipe.glow || f.hoop) { c.save(); c.globalAlpha *= .25; c.fillStyle = '#020908'; c.beginPath(); c.ellipse(p.x + 2, p.y + 2, f.length * .6, 1.5, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    c.translate(p.x, p.y - p.height); c.rotate(p.rotation);
    const l = f.length, w = f.thickness;
    if (recipe.glow && !reducedMotion) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= recipe.glow * .2;
      c.fillStyle = f.color; c.beginPath(); c.ellipse(0, 0, l, Math.max(2, w * 1.6), 0, 0, Math.PI * 2); c.fill(); c.restore();
    }
    if (f.hoop) { c.strokeStyle = '#78817d'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, 8, 4, 0, .3, 5.3); c.stroke(); }
    else {
      c.fillStyle = f.color; c.beginPath();
      switch (recipe.shape) {
        case 'sliver': c.moveTo(-l / 2, -w / 2); c.lineTo(l / 2, -w * .25); c.lineTo(l * .3, w / 2); c.lineTo(-l * .6, w * .3); break;
        case 'chip': c.moveTo(-l * .5, -w * .2); c.lineTo(-l * .15, -w * .6); c.lineTo(l * .5, -w * .15); c.lineTo(l * .3, w * .5); c.lineTo(-l * .4, w * .4); break;
        case 'shard': c.moveTo(-l * .6, -w * .25); c.lineTo(l * .55, -w * .45); c.lineTo(l * .1, w * .6); break;
        case 'bone': c.moveTo(-l * .5, -w * .5); c.lineTo(-l * .2, -w * .25); c.lineTo(l * .4, -w * .4); c.lineTo(l * .5, w * .4); c.lineTo(-l * .3, w * .2); c.lineTo(-l * .6, w * .5); break;
        case 'spark': c.moveTo(-l, 0); c.lineTo(l * .3, -w); c.lineTo(l * .5, 0); c.lineTo(l * .3, w); break;
        case 'ember': c.ellipse(0, 0, l * .5, w * .5, 0, 0, Math.PI * 2); break;
      }
      c.closePath(); c.fill(); c.strokeStyle = recipe.edge; c.lineWidth = .6; c.globalAlpha *= .6;
      c.beginPath(); c.moveTo(-l * .4, 0); c.lineTo(l * .35, -w * .2); c.stroke();
    }
    c.restore();
  }
  c.restore();
}
