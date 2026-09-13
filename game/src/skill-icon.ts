import type { SkillId } from './character-types.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { ICON_MATERIALS, SKILL_ICON_RECIPES, type SkillIconMaterial } from './skill-icon-content.ts';

export interface SkillIconDraw {
  readonly path: string;
  readonly transform: readonly [number, number, number, number, number, number];
  readonly opacity: number;
  readonly fill?: string;
  readonly surface?: SkillIconMaterial;
  readonly halo?: SkillIconMaterial;
  readonly clip?: string;
  readonly localGradient: boolean;
  readonly stroke?: string;
  readonly width?: number;
}
const identity = [1, 0, 0, 1, 0, 0] as const;
const scenes = new Map<string, readonly SkillIconDraw[]>();
const themes: Partial<Record<SkillId, SkillIconMaterial>> = {
  fireball: 'fire', meteor: 'fire', cataclysm: 'fire', iceNova: 'ice', frostLance: 'ice', absoluteZero: 'ice',
  bulwark: 'ice', runicWard: 'jade', siphon: 'rose', backstab: 'rose', nightReaping: 'violet', lunge: 'jade',
};
/** Presentation color only: these palettes never assign a combat damage element. */
function glassTheme(id: SkillId): SkillIconMaterial {
  return themes[id] ?? ({ Might: 'gold', Cunning: 'jade', Arcana: 'violet' } as const)[SKILL_DEFINITIONS[id].domain];
}
// Irregular panes tile the drawing plane. Clipping them to each authored silhouette
// gives glass construction to curved flames and narrow blades alike, without noise.
const panes = [
  [[0, 0], [27, 0], [30, 24], [0, 39]],
  [[27, 0], [64, 0], [46, 22], [30, 24]],
  [[64, 0], [64, 44], [46, 22]],
  [[64, 44], [64, 64], [29, 64], [35, 43], [46, 22]],
  [[29, 64], [0, 64], [0, 39], [30, 24], [35, 43]],
  [[30, 24], [46, 22], [35, 43]],
];
const broadPanes = [
  [[0, 0], [64, 0], [36, 31], [0, 48]],
  [[64, 0], [64, 64], [36, 31]],
  [[64, 64], [0, 64], [0, 48], [36, 31]],
];
function panePaths(local: boolean, detail: boolean): string[] {
  const offset = local ? 32 : 0;
  return (detail ? panes : broadPanes).map(points => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x - offset} ${y - offset}`).join('') + 'Z');
}
/** One finite draw list feeds SVG and Canvas, including clipped panes and bounded light. */
export function skillIconDrawing(id: SkillId, detail: boolean): readonly SkillIconDraw[] {
  const key = `${id}:${detail}`;
  const cached = scenes.get(key);
  if (cached) return cached;
  const theme = glassTheme(id);
  const drawing: SkillIconDraw[] = [{ path: 'M32 1A31 31 0 1 1 32 63 31 31 0 1 1 32 1Z', transform: identity, opacity: .65, localGradient: false, halo: theme }];
  // Wide, low-opacity edges sit behind every pane instead of washing over the seams.
  for (const part of SKILL_ICON_RECIPES[id]) if (part.kind === 'body') {
    const material = ICON_MATERIALS[part.material === 'steel' || part.material === 'dark' ? theme : part.material];
    drawing.push({ path: part.path, transform: part.transform ?? identity, opacity: .13 * (part.opacity ?? 1), localGradient: !!part.transform, stroke: material.face, width: 5 });
  }
  for (const part of SKILL_ICON_RECIPES[id]) {
    if (part.detail && !detail) continue;
    const transform = part.transform ?? identity, opacity = part.opacity ?? 1;
    const base = { path: part.path, transform, opacity, localGradient: !!part.transform };
    const tint = part.material === 'steel' || part.material === 'dark' ? theme : part.material;
    const material = ICON_MATERIALS[tint];
    if (part.kind === 'cut') drawing.push({ ...base, stroke: material.light, width: .65, opacity: opacity * .6 });
    else if (part.kind === 'facet') drawing.push({ ...base, fill: part.material === 'dark' ? material.shade : material.light, opacity: opacity * (part.material === 'dark' ? .65 : .48) });
    else {
      drawing.push({ ...base, fill: '#0a1726', stroke: '#101b29', width: 2.4 });
      drawing.push({ ...base, surface: tint });
      for (const [i, path] of panePaths(base.localGradient, detail).entries()) {
        drawing.push({ ...base, path, clip: part.path, fill: i % 3 === 0 ? material.light : i % 3 === 1 ? material.shade : material.face,
          stroke: '#071a2c', width: detail ? .85 : 1.05, opacity: opacity * (i % 3 === 0 ? .38 : .52) });
      }
      // Lead outlines stay dark; a hairline on their inside catches transmitted light.
      drawing.push({ ...base, stroke: '#142332', width: 1.35 });
      drawing.push({ ...base, stroke: material.edge, width: .45, opacity: opacity * .85 });
    }
  }
  const result = Object.freeze(drawing.map(op => Object.freeze({ ...op, transform: Object.freeze(op.transform) })));
  scenes.set(key, result);
  return result;
}
/** Backlight is inside the pane, not a metallic top-to-bottom surface reflection. */
export function skillIconLight(local: boolean): readonly [number, number, number] {
  return local ? [-3, -5, 34] : [28, 27, 43];
}
export const SKILL_ICON_STOPS = [0, .2, .58, 1] as const;
export function skillIconSurface(material: SkillIconMaterial): readonly string[] {
  const p = ICON_MATERIALS[material];
  return [p.light, p.face, p.face, p.shade];
}
export const SKILL_ICON_HALO_STOPS = [0, .45, 1] as const;
export function skillIconHalo(material: SkillIconMaterial): readonly string[] {
  const p = ICON_MATERIALS[material];
  return [p.face + '55', p.face + '24', p.face + '00'];
}
let svgInstance = 0;
/** Instance-local gradients and clips; no bitmap, animation, filter or external asset. */
export function skillIconSVG(id: SkillId, size = 36): string {
  const dimension = Number.isFinite(size) ? Math.max(8, Math.min(256, size)) : 36;
  const drawing = skillIconDrawing(id, dimension >= 40), prefix = `skill-glass-${svgInstance++}`;
  const paints = new Map<string, string>(), clips = new Map<string, string>();
  for (const op of drawing) {
    if (op.clip && !clips.has(op.clip)) clips.set(op.clip, `${prefix}-clip-${clips.size}`);
    const material = op.surface ?? op.halo;
    if (!material) continue;
    const key = `${op.halo ? 'halo' : 'glass'}-${material}-${Number(op.localGradient)}`;
    if (paints.has(key)) continue;
    const [cx, cy, r] = op.halo ? [32, 32, 31] : skillIconLight(op.localGradient);
    const colors = op.halo ? skillIconHalo(material) : skillIconSurface(material), stops = op.halo ? SKILL_ICON_HALO_STOPS : SKILL_ICON_STOPS;
    paints.set(key, `<radialGradient id="${prefix}-${key}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">${colors.map((color, i) => `<stop offset="${stops[i]}" stop-color="${color.slice(0, 7)}"${color.length === 9 ? ` stop-opacity="${parseInt(color.slice(7), 16) / 255}"` : ''}/>`).join('')}</radialGradient>`);
  }
  const paths = drawing.map(op => {
    const material = op.surface ?? op.halo;
    const fill = material ? `url(#${prefix}-${op.halo ? 'halo' : 'glass'}-${material}-${Number(op.localGradient)})` : op.fill ?? 'none';
    return `<g transform="matrix(${op.transform.join(' ')})"${op.clip ? ` clip-path="url(#${clips.get(op.clip)})"` : ''}><path d="${op.path}" opacity="${op.opacity}" fill="${fill}"${op.stroke ? ` stroke="${op.stroke}" stroke-width="${op.width}"` : ''}/></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="${dimension}" height="${dimension}" viewBox="0 0 64 64" fill="none" stroke-linejoin="round" stroke-linecap="round"><defs>${[...paints.values()].join('')}${[...clips].map(([path, clip]) => `<clipPath id="${clip}" clipPathUnits="userSpaceOnUse"><path d="${path}"/></clipPath>`).join('')}</defs>${paths}</svg>`;
}
