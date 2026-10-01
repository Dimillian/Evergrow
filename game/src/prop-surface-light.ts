import type { SkyState } from './world-time.ts';
import type { Sprite } from './art-types.ts';
import type { Prop, World } from './world.ts';
import { propDefinition } from './biome-props.ts';

/** A cached relief pass for existing painted sprites. Gear uses its authored normals;
 * scenery keeps its painted facets, with blended directional keys and narrow lit edges. */
export class PropSurfaceLight {
  private combined = new WeakMap<HTMLCanvasElement, { image: HTMLCanvasElement; key: string }>();
  private bakeBudget = 0;
  beginFrame() { this.bakeBudget = 4; }
  private edges = new WeakMap<HTMLCanvasElement, readonly HTMLCanvasElement[]>();
  private wetMasks = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
  private climates = new WeakMap<Prop, { warm: number; cool: number; wet: number }>();
  private masks = new WeakMap<HTMLCanvasElement, readonly HTMLCanvasElement[]>();
  reset() { this.masks = new WeakMap(); this.edges = new WeakMap(); this.wetMasks = new WeakMap(); this.climates = new WeakMap(); this.combined = new WeakMap(); }
  /** Small projected props use one prelit image per independently moving layer.
   * Slowly changing sky updates are spread over frames, never a whole-forest bake. */
  drawCompact(c: CanvasRenderingContext2D, prop: Prop, sprite: Sprite, source: HTMLCanvasElement, sky?: SkyState): boolean {
    if (propDefinition(prop.kind).radius[1] === 0 || propDefinition(prop.kind).emissive) return false;
    const power = Math.round((sky?.power ?? .95) * 32) / 32;
    const right = Math.round(Math.max(0, Math.min(1, .5 + (sky?.direction[0] ?? -.56) * .9)) * 32) / 32;
    const key = `${power}:${right}:${propDefinition(prop.kind).canopy ? 1 : 0}`;
    let cached = this.combined.get(source);
    if (cached?.key !== key && this.bakeBudget > 0) {
      this.bakeBudget--;
      const image = cached?.image ?? document.createElement('canvas');
      if (image.width !== source.width || image.height !== source.height) { image.width = source.width; image.height = source.height; }
      const target = image.getContext('2d')!;
      target.clearRect(0, 0, image.width, image.height); target.drawImage(source, 0, 0);
      const opacity = (propDefinition(prop.kind).canopy ? .55 : .85) * power;
      for (const [flip, weight] of [[false, 1 - right], [true, right]] as const) {
        if (weight < .001) continue;
        target.globalAlpha = opacity * weight; target.drawImage(this.mask(source, flip), 0, 0);
      }
      target.globalAlpha = 1;
      cached = { image, key }; this.combined.set(source, cached);
    }
    if (!cached) return false;
    c.drawImage(cached.image, -sprite.anchorX, -sprite.anchorY, sprite.width, sprite.height);
    return true;
  }
  private mask(source: HTMLCanvasElement, right = false) {
    const cached = this.masks.get(source); if (cached) return cached[right ? 1 : 0];
    const images = [false,true].map(flip=>{
    const image = document.createElement('canvas');
    image.width = source.width; image.height = source.height;
    const c = image.getContext('2d')!;
    c.drawImage(source, 0, 0);
    c.globalCompositeOperation = 'source-in';
    const gradient = c.createLinearGradient(flip ? image.width : 0, 0, flip ? 0 : image.width, image.height);
    gradient.addColorStop(0, '#e1e9cf48'); gradient.addColorStop(.42, '#c5d8d411');
    gradient.addColorStop(.67, '#10203b08'); gradient.addColorStop(1, '#08112642');
    c.fillStyle = gradient; c.fillRect(0, 0, image.width, image.height);
    return image; });
    this.masks.set(source, images); return images[right ? 1 : 0];
  }

  private leafEdges(source: HTMLCanvasElement) {
    const cached = this.edges.get(source); if (cached) return cached;
    const images = ['#f1dc85', '#abd5f1', '#f1dc85', '#abd5f1'].map((color,index) => {
      const canvas = document.createElement('canvas'), scale = Math.min(1, 256 / Math.max(source.width, source.height));
      canvas.width = Math.max(1, Math.ceil(source.width * scale)); canvas.height = Math.max(1, Math.ceil(source.height * scale));
      const c = canvas.getContext('2d')!;
      c.drawImage(source, 0, 0, canvas.width, canvas.height); c.globalCompositeOperation = 'destination-out';
      c.drawImage(source, Math.max(1, 2 * scale) * (index < 2 ? 1 : -1), Math.max(1, 3 * scale), canvas.width, canvas.height);
      c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, canvas.width, canvas.height);
      return canvas;
    });
    this.edges.set(source, images); return images;
  }
  /** The painted facets remain visible beneath a cached, silhouette-clipped wet sheen. */
  private wetMask(source: HTMLCanvasElement) {
    let cached = this.wetMasks.get(source); if (cached) return cached;
    cached = document.createElement('canvas'); cached.width = source.width; cached.height = source.height;
    const c = cached.getContext('2d')!, w = cached.width, h = cached.height;
    c.drawImage(source, 0, 0); c.globalCompositeOperation = 'source-in';
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#b5ded4bb'); g.addColorStop(.28, '#abd8c660');
    g.addColorStop(.34, '#d4ebcebb'); g.addColorStop(.40, '#90beba18'); g.addColorStop(.68, '#8bb9b300');
    c.fillStyle = g; c.fillRect(0, 0, w, h); this.wetMasks.set(source, cached); return cached;
  }
  drawOutdoor(c: CanvasRenderingContext2D, prop: Prop, sprite: Sprite, image: HTMLCanvasElement,
    world: Pick<World, 'sampleBiome' | 'sampleGroundContact'>, time: number, reduced: boolean, sky?: SkyState) {
    let climate = this.climates.get(prop);
    if (!climate) {
      const w = world.sampleBiome(prop.x, prop.y).weights;
      const wet = prop.kind === 'rock' ? world.sampleGroundContact(prop.x, prop.y).water : 0;
      climate = { warm: w.verdant+w.autumn+w.steppe*.6+w.sunscar*.3+w.emberfall*.2, cool: w.swamp+w.deadwood*.4+w.frostpine+w.highlands*.7, wet }; this.climates.set(prop, climate);
    }
    const pulse = reduced ? 1 : .9 + .1 * Math.sin(time * .6 - prop.x * .01 - prop.y * .004);
    c.save(); c.globalCompositeOperation = 'screen';
    if (image !== sprite.image && propDefinition(prop.kind).canopy) {
      const edges=this.leafEdges(image), right=sky ? Math.max(0,Math.min(1,.5+sky.direction[0]*.9)) : 0;
      const opacity=c.globalAlpha*(sky?.power??.95)*pulse;
      for(const [side,weight] of [[0,1-right],[2,right]]){
        if(weight<.001)continue;
        c.globalAlpha=opacity*weight*climate.warm*.56*(sky?.daylight??1);
        c.drawImage(edges[side],-sprite.anchorX,-sprite.anchorY,sprite.width,sprite.height);
        c.globalAlpha=opacity*weight*(climate.cool*.42+(1-(sky?.daylight??1))*.25);
        c.drawImage(edges[side+1],-sprite.anchorX,-sprite.anchorY,sprite.width,sprite.height);
      }
    } else if (prop.kind === 'rock') {
      c.globalAlpha *= (climate.cool * .35 + climate.warm * .10 + climate.wet * .35) * pulse * (sky?.power ?? .95);
      c.drawImage(this.wetMask(image), -sprite.anchorX, -sprite.anchorY, sprite.width, sprite.height);
    }
    c.restore();
  }
  draw(c: CanvasRenderingContext2D, prop: Prop, sprite: Sprite, image = sprite.image, sky?: SkyState) {
    const definition = propDefinition(prop.kind);
    if (definition.radius[1] === 0) return;
    c.save();
    // Broad matte foliage/wood versus more readable stone planes. Surface emissions
    // are drawn separately after illumination and must not acquire a painted tint.
    c.globalAlpha *= (definition.canopy ? .55 : definition.emissive ? .4 : .85) * (sky?.power ?? .95);
    const opacity=c.globalAlpha,right=sky ? Math.max(0,Math.min(1,.5+sky.direction[0]*.9)) : 0;
    for(const [flip,weight] of [[false,1-right],[true,right]] as const){
      if(weight<.001)continue;c.globalAlpha=opacity*weight;
      c.drawImage(this.mask(image,flip),-sprite.anchorX,-sprite.anchorY,sprite.width,sprite.height);
    }
    c.restore();
  }
}
