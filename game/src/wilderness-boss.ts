import type { Enemy } from './model.ts';
import type { EnemyAIContext } from './enemy-ai.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { alertEnemy, transitionEnemy } from './enemy-state.ts';
import { circleIntersectsSector, segmentDistanceSquared } from './combat-geometry.ts';
import { isWildernessBoss, LAIR_RULES as R, BOSS_PALETTES } from './wilderness-boss-content.ts';

/** Each boss commits its warning geometry before release; phase two changes cadence, never warning duration. */
export function updateWildernessBoss(e: Enemy, dt: number, c: EnemyAIContext): void {
  if (!isWildernessBoss(e.kind)) return;
  const p=c.player, d=Math.hypot(p.x-e.x,p.y-e.y), angle=Math.atan2(p.y-e.y,p.x-e.x), def=ENEMY_DEFINITIONS[e.kind];
  const walk=(x:number,y:number,speed:number)=>{
    const target=c.world.navigationTarget?.(e.x,e.y,x,y)??{x,y};
    const length=Math.hypot(target.x-e.x,target.y-e.y);
    if(length>.5){e.angle=Math.atan2(target.y-e.y,target.x-e.x);c.move(e,(target.x-e.x)/length*speed,(target.y-e.y)/length*speed,dt);}
  };
  if(p.dead||c.world.isSanctuary?.(p.x,p.y)||Math.hypot(p.x-e.homeX,p.y-e.homeY)>R.leash||Math.hypot(e.x-e.homeX,e.y-e.homeY)>R.leash){
    if(e.state!=='return'){transitionEnemy(e,'return');e.bossMove=undefined;e.awareness=0;e.burnTime=0;e.slowTime=0;}
  }
  if(e.state==='return'){
    if(Math.hypot(e.x-e.homeX,e.y-e.homeY)<12){e.hp=e.maxHp;e.bossPhases=0;e.bossTurns=0;transitionEnemy(e,'idle',1);}
    else walk(e.homeX,e.homeY,def.speed*1.5);
    return;
  }
  if(e.state==='idle'||e.state==='patrol'){
    if(d<R.awareness&&c.visible(e.x,e.y,p.x,p.y)||e.awareness>=1)alertEnemy(e,p);else return;
  }
  if(e.awareness>=1&&e.campId)for(const guard of c.enemies)if(guard!==e&&guard.hp>0&&guard.campId===e.campId)alertEnemy(guard,p);
  if(e.interrupted){e.interrupted=false;transitionEnemy(e,'recover',.8);return;}
  if(e.state==='recover'){if(e.stateTime>=e.stateDuration)transitionEnemy(e,'chase');return;}
  if(e.state==='chase'){
    e.angle=angle;e.seesPlayer=c.visible(e.x,e.y,p.x,p.y);
    if(!e.seesPlayer||d>360){walk(p.x,p.y,def.speed*(e.slowTime>0?e.slowFactor:1));return;}
    const phase=e.hp/e.maxHp<=.5;
    const turns=e.bossTurns??0;
    const moves:Enemy['bossMove'][]=e.kind==='briarMatriarch'?['sweep','rush','fracture']
      :e.kind==='ashColossus'?['sweep','eruption','fracture']:['sweep','rush','command'];
    const move=moves[turns%moves.length];
    if(move==='sweep'&&d>R.sweepReach+10){walk(p.x,p.y,def.speed*(e.slowTime>0?e.slowFactor:1));return;}
    if(phase&&!e.bossPhases)c.emit({type:'blast',x:e.x,y:e.y-35,radius:110,duration:.7,color:BOSS_PALETTES[e.kind]});
    e.bossPhases=Number(phase);e.bossTurns=turns+1;e.bossMove=move;e.bossHits=0;
    e.bossOriginX=e.x;e.bossOriginY=e.y;e.attackAngle=angle;
    e.attackTargetX=p.x;e.attackTargetY=p.y;
    transitionEnemy(e,'windup',move==='sweep'?.85:move==='rush'?1:1.15);
    return;
  }
  if(e.state==='windup'){
    if(e.stateTime<e.stateDuration)return;
    transitionEnemy(e,'attack',e.bossMove==='rush'?.55:e.bossMove==='fracture'?.7:e.bossMove==='eruption'?1.4:.28);
    c.emit({type:'blast',x:e.bossMove==='eruption'?e.attackTargetX:e.x,y:e.bossMove==='eruption'?e.attackTargetY:e.y,
      radius:e.bossMove==='eruption'?R.eruptionRadius:70,duration:.45,color:BOSS_PALETTES[e.kind]});
    if(e.bossMove==='command'&&e.campId)for(const guard of c.enemies)if(guard!==e&&guard.hp>0&&guard.campId===e.campId&&Math.hypot(guard.x-e.x,guard.y-e.y)<R.rallyRadius){guard.rallyTime=R.rallyDuration;alertEnemy(guard,p);}
  }
  if(e.state!=='attack')return;
  let hit=false;
  if(e.bossMove==='sweep')hit=circleIntersectsSector(p.x,p.y,p.radius,e.x,e.y,e.attackAngle,R.sweepReach,R.sweepArc);
  if(e.bossMove==='rush'){
    const x=e.x,y=e.y;c.move(e,Math.cos(e.attackAngle)*R.rushLength/.55,Math.sin(e.attackAngle)*R.rushLength/.55,dt);
    hit=segmentDistanceSquared(p.x,p.y,x,y,e.x,e.y)<(R.rushWidth+p.radius)**2;
  }
  if(e.bossMove==='eruption')hit=Math.hypot(p.x-e.attackTargetX,p.y-e.attackTargetY)<R.eruptionRadius+p.radius;
  if(e.bossMove==='fracture')for(let i=0;i<3;i++){
    if(e.stateTime<i*.2||((e.bossHits??0)&1<<i))continue;
    e.bossHits=(e.bossHits??0)|1<<i;
    const a=e.attackAngle+(i-1)*.55,ox=e.bossOriginX!,oy=e.bossOriginY!;
    c.emit({type:'blast',x:ox+Math.cos(a)*180,y:oy+Math.sin(a)*180,radius:48,duration:.4,color:BOSS_PALETTES[e.kind]});
    hit ||= segmentDistanceSquared(p.x,p.y,ox,oy,ox+Math.cos(a)*R.fractureLength,oy+Math.sin(a)*R.fractureLength)<(R.fractureWidth+p.radius)**2;
  }
  if(hit&&!e.attackHit&&c.visible(e.x,e.y,p.x,p.y)){e.attackHit=true;c.hurt(e.damage*(e.bossMove==='sweep'?1:1.15),e.attackAngle,e);}
  if(e.stateTime>=e.stateDuration)transitionEnemy(e,'recover',e.bossMove==='command'?1.5:e.bossPhases?.75:1.2);
}
