import type { WorldQuery } from './model.ts';
import { SKILL_TARGETING } from './skill-execution-content.ts';

/** Shared by action commitment and touch preview; stop before the same obstruction. */
export function skillTargetPoint(world: Pick<WorldQuery, 'blocked'>, player: {x:number;y:number;angle:number}, aim: {x:number;y:number}, range: number) {
  const dx=aim.x-player.x,dy=aim.y-player.y,distance=Math.hypot(dx,dy);
  const angle=Number.isFinite(distance)&&distance>0 ? Math.atan2(dy,dx) : player.angle;
  const reach=Math.min(SKILL_TARGETING.maximumRange,range,Number.isFinite(distance)&&distance>0 ? distance : range);
  let result={x:player.x,y:player.y};
  const steps=Math.max(1,Math.ceil(reach/SKILL_TARGETING.probeStep));
  for(let step=1;step<=steps;step++) {
    const t=reach*step/steps,x=player.x+Math.cos(angle)*t,y=player.y+Math.sin(angle)*t;
    if(world.blocked(x,y,SKILL_TARGETING.probeRadius)) break;
    result={x,y};
  }
  return result;
}
