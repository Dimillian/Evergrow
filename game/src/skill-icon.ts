import type { SkillId } from './character-types.ts';
import { ICON_MATERIALS, SKILL_ICON_RECIPES, type SkillIconMaterial } from './skill-icon-content.ts';

export interface SkillIconDraw {
  readonly path: string;
  readonly transform: readonly [number, number, number, number, number, number];
  readonly opacity: number;
  readonly fill?: string;
  readonly surface?: SkillIconMaterial;
  readonly localGradient: boolean;
  readonly stroke?: string;
  readonly width?: number;
}
const identity = [1, 0, 0, 1, 0, 0] as const;
const scenes = new Map<string, readonly SkillIconDraw[]>();
/** The same finite draw list feeds SVG, native Canvas and inspection exports. */
export function skillIconDrawing(id: SkillId, detail: boolean): readonly SkillIconDraw[] {
  const key = `${id}:${detail}`;
  const cached = scenes.get(key);
  if (cached) return cached;
  const drawing: SkillIconDraw[] = [];
  for (const part of SKILL_ICON_RECIPES[id]) {
    if (part.detail && !detail) continue;
    const transform = part.transform ?? identity, opacity = part.opacity ?? 1;
    const base = { path: part.path, transform, opacity, localGradient: !!part.transform };
    const material = ICON_MATERIALS[part.material];
    if (part.kind === 'cut') drawing.push({ ...base, stroke: material.light, width: .65, opacity: opacity * .65 });
    else if (part.kind === 'facet') drawing.push({ ...base, fill: part.material === 'dark' ? material.shade : material.light, opacity: opacity * .82 });
    else {
      const [a, b, c, d, e, f] = transform;
      drawing.push({ ...base, transform: [a, b, c, d, e + c * 1.25, f + d * 1.25], fill: '#071018', stroke: '#071018', width: 2.2 });
      drawing.push({ ...base, surface: part.material, stroke: material.edge, width: .8 });
    }
  }
  const result = Object.freeze(drawing.map(op => Object.freeze({ ...op, transform: Object.freeze(op.transform) })));
  scenes.set(key, result);
  return result;
}
export function skillIconGradient(local: boolean): readonly [number, number, number, number] {
  return local ? [-12, -22, 15, 25] : [12, 5, 48, 59];
}
export const SKILL_ICON_STOPS = [0, .34, .58, 1] as const;
export function skillIconSurface(material: SkillIconMaterial): readonly string[] {
  const p = ICON_MATERIALS[material];
  return [p.light, p.face, p.shade, p.face];
}
let svgInstance = 0;
/** Self-contained inline art; unique paint IDs prevent collisions in repeated DOM icons. */
export function skillIconSVG(id: SkillId, size = 36): string {
  const dimension = Number.isFinite(size) ? Math.max(8, Math.min(256, size)) : 36;
  const drawing = skillIconDrawing(id, dimension >= 40), prefix = `skill-relief-${svgInstance++}`;
  const paints = new Map<string, string>();
  for (const op of drawing) if (op.surface) {
    const key = `${op.surface}-${Number(op.localGradient)}`;
    if (paints.has(key)) continue;
    const [x1, y1, x2, y2] = skillIconGradient(op.localGradient);
    paints.set(key, `<linearGradient id="${prefix}-${key}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${skillIconSurface(op.surface).map((color, i) => `<stop offset="${SKILL_ICON_STOPS[i]}" stop-color="${color}"/>`).join('')}</linearGradient>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="${dimension}" height="${dimension}" viewBox="0 0 64 64" fill="none" stroke-linejoin="round" stroke-linecap="round"><defs>${[...paints.values()].join('')}</defs>${drawing.map(op => `<path d="${op.path}" transform="matrix(${op.transform.join(' ')})" opacity="${op.opacity}" fill="${op.surface ? `url(#${prefix}-${op.surface}-${Number(op.localGradient)})` : op.fill ?? 'none'}"${op.stroke ? ` stroke="${op.stroke}" stroke-width="${op.width}"` : ''}/>`).join('')}</svg>`;
}
