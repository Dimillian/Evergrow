import type { GroundItem } from './character-types.ts';
import type { Input, Player, WorldQuery } from './model.ts';
import { LOOT_RULES } from './combat-content.ts';
import { TREASURE_FLIGHT_DURATION } from './treasure-flight.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import { hasWalkableSegment, WorldNavigation } from './world-navigation.ts';

export const GROUND_PICKUP_RANGE = 360;
export function groundPickupProblem(player: Player, drop: GroundItem | undefined, time: number): string | null {
  if (!drop || player.dead) return 'Item unavailable';
  if (drop.flight && time < drop.flight.at + drop.flight.delay + TREASURE_FLIGHT_DURATION) return 'Item is landing';
  if (Math.hypot(drop.x-player.x,drop.y-player.y)>GROUND_PICKUP_RANGE) return 'Move closer';
  if (!player.character.inventory.includes(null)) return 'Inventory full';
  return null;
}

/** A transient player command; never persisted or resumed after loading/travel. */
export class GroundItemPickup {
  id: number | null = null;
  private world?: WorldQuery;
  private terrain?: Pick<WorldQuery, 'blocked'>;
  private navigation?: WorldNavigation;
  private elapsed=0;
  private stalled=0;
  private x=0; private y=0; private hp=0;
  private routeAt=0;
  private waypoint: {x:number;y:number} | null=null;
  cancel(): void { this.id=null;this.waypoint=null;this.navigation?.clear(); }
  select(player:Player,drop:GroundItem|undefined,time:number): string|null {
    this.cancel();
    const problem=groundPickupProblem(player,drop,time);
    if(problem)return problem;
    this.id=drop!.id;this.elapsed=this.stalled=this.routeAt=0;this.x=player.x;this.y=player.y;this.hp=player.hp;
    return null;
  }
  input(player:Player,drops:readonly GroundItem[],world:WorldQuery,time:number,dt:number,input:Input):Input {
    if(this.id===null)return input;
    const drop=drops.find(d=>d.id===this.id);
    if(input.moveX||input.moveY||input.attack||input.dodge||input.skillSlot!==null||player.hp<this.hp||groundPickupProblem(player,drop,time)){
      this.cancel();return input;
    }
    this.hp=player.hp;this.elapsed+=dt;
    this.stalled=Math.hypot(player.x-this.x,player.y-this.y)>.05?0:this.stalled+dt;
    this.x=player.x;this.y=player.y;
    if(this.elapsed>8||this.stalled>1.5){this.cancel();return input;}
    if(this.ready(player,drop!,world))return input;
    // Town sanctuary excludes enemies, but must never exclude the player.
    if (this.world !== world) {
      this.world = world;
      this.terrain = { blocked: (x, y, radius) => world.blocked(x, y, radius) };
      this.navigation = new WorldNavigation(this.terrain);
    }
    if(this.elapsed>=this.routeAt||(this.waypoint&&Math.hypot(player.x-this.waypoint.x,player.y-this.waypoint.y)<8)){
      this.routeAt=this.elapsed+.1;
      this.waypoint=this.navigation!.route(player.x,player.y,drop!.x,drop!.y,player.radius,64)?.target??null;
    }
    if(!this.waypoint)return input;
    const dx=this.waypoint.x-player.x,dy=this.waypoint.y-player.y,d=Math.hypot(dx,dy);
    if(d<1||!hasWalkableSegment(this.terrain!,player.x,player.y,this.waypoint.x,this.waypoint.y,player.radius))return input;
    return {...input,moveX:dx/d,moveY:dy/d};
  }
  ready(player:Player,drop:GroundItem,world:WorldQuery):boolean {
    return this.id===drop.id&&!player.dead&&player.hp>=this.hp
      &&Math.hypot(player.x-drop.x,player.y-drop.y)<=LOOT_RULES.equipmentCollectDistance
      &&hasLineOfSight(world,player.x,player.y,drop.x,drop.y);
  }
}
