import { World } from './world.ts';
import type { DungeonEntrance, DungeonFloor } from './dungeon.ts';
/** The actual overworld terrain, water, vegetation, collision and navigation.
 * Only towns/landmarks are disabled; rift encounters own all population/rewards. */
export class RiftWorld extends World {
  readonly floor: DungeonFloor;
  readonly entrance: DungeonEntrance;
  readonly dungeonLevel: number;
  readonly dungeonBiome;
  constructor(floor:DungeonFloor,entrance:DungeonEntrance){
    super(floor.seed,true);this.floor=floor;this.entrance=entrance;
    this.dungeonLevel=entrance.level;this.dungeonBiome=this.sampleBiome(floor.entry.x,floor.entry.y).id;
  }
  override isSanctuary(x:number,y:number){return Math.hypot(x-this.floor.entry.x,y-this.floor.entry.y)<120;}
}
