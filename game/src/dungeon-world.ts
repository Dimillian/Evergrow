import { DRY_WATER } from './hydrology.ts';
import { drawCryptSurface } from './dungeon-surface.ts';
import { World, TILE_SIZE } from './world.ts';
import { DungeonGeometry, type DungeonFloor } from './dungeon.ts';
import type { DungeonEntrance } from './dungeon.ts';
import { BIOMES } from './biomes.ts';
/** The active floor is a distinct World object, with no overworld content or coordinate-level queries. */
export class DungeonWorld extends World {
    readonly dungeonLevel: number;
    readonly dungeonBiome: DungeonEntrance['biome'];
    private geometry: DungeonGeometry;
    private tiles = new Map<string, HTMLCanvasElement>();
    readonly floor: DungeonFloor;
    readonly entrance: DungeonEntrance;
    constructor(floor: DungeonFloor, entrance: DungeonEntrance) { super(entrance.seed); this.floor = floor; this.entrance = entrance; this.dungeonLevel = entrance.level; this.dungeonBiome=entrance.biome; this.geometry = new DungeonGeometry(floor); }
    override getSettlements() { return []; }
    override getWildernessSites() { return []; }
    override getEventSites() { return []; }
    override getEnemyCamps() { return []; }
    override getBuildings() { return []; }
    override getBuildingAt() { return null; }
    override getProps() { return []; }
    override getDungeonEntrances() { return []; }
    override getPOIs() { return []; }
    override isSanctuary(x: number, y: number) { return Math.hypot(x - this.floor.entry.x, y - this.floor.entry.y) < 120; }
    override sampleBiome(_x: number, _y: number) { return { ...BIOMES.deadwood, weights: { deadwood: 1, verdant: 0, swamp: 0, frostpine: 0, emberfall: 0, autumn: 0, highlands: 0 } }; }
    override sampleWater() { return { ...DRY_WATER }; }
    override sampleGroundContact(x: number, y: number) { return { weights: this.sampleBiome(x, y).weights, water: 0, natural: 0, indoors: true }; }
    override blocked(x: number, y: number, r: number) { return this.geometry.blocked(x, y, r); }
    override move(x: number, y: number, dx: number, dy: number, r: number) { return this.geometry.move(x, y, dx, dy, r); }
    navigationTarget(x: number, y: number, tx: number, ty: number) { return this.geometry.navigationTarget(x, y, tx, ty); }
    override mapColor(x: number, y: number) { return this.blocked(x, y, 0) ? '#080d14' : '#465653'; }
    override atlasColor(x: number, y: number) { return this.mapColor(x, y); }
    override dispose() { this.tiles.clear(); super.dispose(); }
    override getGroundTile(tx: number, ty: number, create?: () => HTMLCanvasElement) {
        const key = `${tx}:${ty}`;
        let tile = this.tiles.get(key);
        if (tile)
            return tile;
        tile = create ? create() : document.createElement('canvas');
        tile.width = tile.height = TILE_SIZE;
        const c = tile.getContext('2d')!;
        drawCryptSurface(c, this.floor, tx, ty, TILE_SIZE);
        if (this.tiles.size >= 64)
            this.tiles.delete(this.tiles.keys().next().value!);
        this.tiles.set(key, tile);
        return tile;
    }
}
