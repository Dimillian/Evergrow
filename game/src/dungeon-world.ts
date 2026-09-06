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
        c.fillStyle = '#070c12';
        c.fillRect(0, 0, 256, 256);
        for (let y = 0; y < 256; y += 32)
            for (let x = 0; x < 256; x += 32) {
                const wx = tx * 256 + x, wy = ty * 256 + y, open = !this.blocked(wx + 16, wy + 16, 0), bits = stoneHash(wx, wy, this.seed), n = bits % 10;
                if (open) {
                    c.fillStyle = `rgb(${29 + n},${39 + n},${42 + n})`;
                    c.fillRect(x, y, 32, 32);
                    c.fillStyle = '#0c1a2450';
                    c.fillRect(x, y, 32, 1);
                    c.fillRect(x, y, 1, 32);
                    c.fillStyle = '#8a928b22';
                    c.fillRect(x + 2, y + 2, 28, 1);
                    for (let i = 0; i < 9; i++) {
                        const h = stoneHash(wx + i * 13, wy + i * 27, this.seed);
                        c.fillStyle = i % 3 ? '#85958c12' : '#08172030';
                        c.fillRect(x + 2 + h % 28, y + 2 + (h >>> 8) % 28, 1 + (h >>> 16) % 3, 1);
                    }
                    if (bits % 7 === 0) {
                        c.fillStyle = '#61725425';
                        c.beginPath();
                        c.ellipse(x + 7, y + 25, 7, 3, .3, 0, 7);
                        c.fill();
                    }
                    if (bits % 13 === 0) {
                        c.fillStyle = '#adb39a38';
                        c.fillRect(x + 22, y + 18, 3, 2);
                        c.fillRect(x + 17, y + 25, 2, 2);
                    }
                    if (n % 4 === 0) {
                        c.strokeStyle = '#162329';
                        c.beginPath();
                        const k = (bits >>> 8) % 15;
                        c.moveTo(x + 4 + k, y + 2);
                        c.lineTo(x + 8 + k, y + 11);
                        c.lineTo(x + 4 + k, y + 20);
                        c.lineTo(x + 7 + k, y + 29);
                        c.stroke();
                    }
                }
                else if ([[32, 0], [-32, 0], [0, 32], [0, -32]].some(([dx, dy]) => !this.blocked(wx + 16 + dx, wy + 16 + dy, 0))) {
                    c.fillStyle = '#435452';
                    c.fillRect(x, y, 32, 32);
                    c.fillStyle = '#788578';
                    c.fillRect(x + 1, y + 1, 30, 3);
                    c.fillStyle = '#182630';
                    c.fillRect(x + 2, y + 17, 29, 14);
                    c.strokeStyle = '#12212a';
                    c.strokeRect(x + .5, y + .5, 31, 31);
                }
            }
        if (this.tiles.size >= 64)
            this.tiles.delete(this.tiles.keys().next().value!);
        this.tiles.set(key, tile);
        return tile;
    }
}
function stoneHash(x: number, y: number, seed: number) { let n = Math.imul(x ^ seed, 374761393) ^ Math.imul(y, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return (n ^ (n >>> 16)) >>> 0; }
