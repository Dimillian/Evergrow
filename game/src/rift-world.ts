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
  protected override sanctuaryOnSegment(ax:number,ay:number,bx:number,by:number,steps:number):boolean {
    const dx=bx-ax,dy=by-ay,p=this.floor.entry,length=dx*dx+dy*dy;
    const nearest=length?Math.round(((p.x-ax)*dx+(p.y-ay)*dy)/length*steps):0;
    const t=Math.max(0,Math.min(steps,nearest))/steps;
    return Math.hypot(ax+dx*t-p.x,ay+dy*t-p.y)<120;
  }
}
