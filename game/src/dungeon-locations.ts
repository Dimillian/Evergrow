import { dungeonChestClaimed } from './expedition-route.ts';
import type { DungeonFloor } from './dungeon.ts';
import type { DungeonRun } from './dungeon-state.ts';
/** Runtime destinations may move; authored floor geometry remains immutable. */
export function dungeonRunChest(floor:DungeonFloor,run:DungeonRun,index:number){
 const chest=floor.chests[index],point=index===2?run.rift?.treasure:undefined;
 return point?{...chest,...point,room:floor.rooms.find(r=>point.x>=r.x&&point.x<=r.x+r.width&&point.y>=r.y&&point.y<=r.y+r.height)?.id??chest.room}:chest;
}
export const dungeonRunExit=(floor:DungeonFloor,run:DungeonRun)=>run.rift?.exit??floor.exit;

/** Shared prompt/input targets; partial deliveries remain reachable. */
export function dungeonInteractionChests(floor:DungeonFloor,run:DungeonRun){
 return floor.chests.flatMap((_,index)=>(!run.rift||index===2&&run.rift.phase==='complete')&&!dungeonChestClaimed(run,index)?[{...dungeonRunChest(floor,run,index),index}]:[]);
}
