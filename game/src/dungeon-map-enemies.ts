import type { DungeonFloor } from './dungeon.ts';
import type { Enemy } from './model.ts';
export type DungeonMapEnemy = Pick<Enemy, 'x' | 'y' | 'kind' | 'rank' | 'hp'>;
/** Reveal live actors only on already explored terrain, including connecting passages. */
export function dungeonMapEnemyVisible(enemy:DungeonMapEnemy, floor:DungeonFloor, seen:ReadonlySet<number>, box:{x:number;y:number;width:number;height:number}):boolean {
  const contains=(r:typeof box)=>enemy.x>=r.x&&enemy.x<=r.x+r.width&&enemy.y>=r.y&&enemy.y<=r.y+r.height;
  if(enemy.hp<=0||!contains(box))return false;
  if(floor.rooms.some(room=>seen.has(room.id)&&contains(room)))return true;
  return floor.corridors.some(passage=>{
    const edge=floor.edges[passage.connection!];
    return !!edge&&(seen.has(edge[0])||seen.has(edge[1]))&&contains(passage);
  });
}
