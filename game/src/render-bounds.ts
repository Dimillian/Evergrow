import { ENEMY_BODY_BOUNDS } from './enemy-body.ts';
import { enemyVisualScale } from './enemy-modifiers.ts';
import type { Enemy } from './model.ts';
import type { Prop } from './world.ts';
import { propDefinition } from './biome-props.ts';
import { TREE_BOUNDS, isTreeKind } from './tree-art.ts';
import { BIOME_PROP_BOUNDS } from './biome-prop-art.ts';

interface View { left: number; top: number; width: number; height: number; }
export function propArtSize(prop: Pick<Prop, 'kind'>): readonly [number, number] {
  if (isTreeKind(prop.kind)) return TREE_BOUNDS[prop.kind];
  return BIOME_PROP_BOUNDS[prop.kind] ?? (prop.kind === 'rock' ? [33, 31] : prop.kind === 'shrine' ? [50, 75]
    : prop.kind === 'fern' ? [52, 37] : prop.kind === 'reeds' ? [42, 49] : [34, 37]);
}
/** Source bounds plus maximum wind shear/bending, before sprite generation. */
export function propIntersectsView(prop: Prop, view: View): boolean {
  const [width, height] = propArtSize(prop), definition = propDefinition(prop.kind);
  const shear = definition.canopy ? .14 : definition.radius[1] === 0 ? .45 : 0;
  const radius = (width / 2 + height * shear + 3) * prop.scale;
  return prop.x + radius >= view.left && prop.x - radius <= view.left + view.width
    && prop.y + 8 * prop.scale >= view.top && prop.y - (height + 4) * prop.scale <= view.top + view.height;
}
/** Rendering only: includes recoil, held weapons, status glows and rank outlines.
 * Attack telegraphs have their own pass and are never clipped to these bounds. */
export function enemyIntersectsView(enemy: Pick<Enemy, 'kind' | 'rank'>, x: number, y: number, view: View): boolean {
  const body = ENEMY_BODY_BOUNDS[enemy.kind], scale = enemyVisualScale(enemy);
  const radius = (body.radiusX + 64) * scale;
  return x + radius >= view.left && x - radius <= view.left + view.width
    && y + (body.bottom + 48) * scale >= view.top && y + (body.top - 48) * scale <= view.top + view.height;
}
