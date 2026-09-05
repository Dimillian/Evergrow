import type { World, Prop } from './world.ts';
import type { Building } from './settlements.ts';
import type { WildernessSite } from './wilderness-sites.ts';

interface ViewBounds { left: number; top: number; width: number; height: number; }
type SceneWorld = Pick<World, 'getProps' | 'getBuildings' | 'getWildernessSites'>;
const REFRESH_DISTANCE = 65;
const PROP_MARGIN = 240;
const BUILDING_MARGIN = 300;
const SITE_MARGIN = 320;

/** Only the current view is retained; world replacement always invalidates coverage. */
export class SceneVisibility {
  props: Prop[] = [];
  buildings: Building[] = [];
  sites: WildernessSite[] = [];
  private world: SceneWorld | null = null;
  private bounds: ViewBounds | null = null;

  reset(): void {
    this.world = null; this.bounds = null;
    this.props = []; this.buildings = []; this.sites = [];
  }

  update(world: SceneWorld, view: ViewBounds): void {
    const previous = this.bounds;
    if (world === this.world && previous
      && Math.abs(previous.left - view.left) <= REFRESH_DISTANCE
      && Math.abs(previous.top - view.top) <= REFRESH_DISTANCE
      && Math.abs(previous.left + previous.width - view.left - view.width) <= REFRESH_DISTANCE
      && Math.abs(previous.top + previous.height - view.top - view.height) <= REFRESH_DISTANCE) return;
    // Gather both queries before publishing a new cache, so consumers see one view.
    const props = world.getProps(view.left - PROP_MARGIN, view.top - PROP_MARGIN,
      view.width + PROP_MARGIN * 2, view.height + PROP_MARGIN * 2);
    const buildings = world.getBuildings(view.left - BUILDING_MARGIN, view.top - BUILDING_MARGIN,
      view.width + BUILDING_MARGIN * 2, view.height + BUILDING_MARGIN * 2);
    const sites = world.getWildernessSites(view.left - SITE_MARGIN, view.top - SITE_MARGIN,
      view.width + SITE_MARGIN * 2, view.height + SITE_MARGIN * 2);
    this.props = props; this.buildings = buildings; this.sites = sites;
    this.world = world; this.bounds = { ...view };
  }
}
