import type { Enemy, WorldQuery } from './model.ts';
import type { EnemyAIContext } from './enemy-ai.ts';
import { circleIntersectsSector } from './combat-geometry.ts';
import { transitionEnemy } from './enemy-state.ts';
import { riftMechanic, RIFT_TACTICS as R } from './rift-encounters.ts';
export const riftCanChannel=(e:Enemy)=>e.hp>0&&e.state!=='dead'&&e.state!=='return'&&!((e.stunTime??0)>0||(e.freezeTime??0)>0||e.stagger>0);
export function riftWardActive(e:Enemy,visible?:(ax:number,ay:number,bx:number,by:number)=>boolean):boolean {
  const source=e.riftWardSource;
  return !!source&&riftCanChannel(source)&&source.awareness>=1&&Math.hypot(source.x-e.x,source.y-e.y)<=R.wardRadius&&(!visible||visible(source.x,source.y,e.x,e.y));
}
/** Transient encounter director. Identity/casualties remain owned by saved camp members.
 * Specials share a start gap; normal attacks remain independent. No actor count limit. */
export class RiftTactics {
  private world:WorldQuery|undefined;
  private gap=2;
  private wardClock=0;
  private cursor=0;
  tick(context:EnemyAIContext,dt:number,active:boolean):void {
    const {enemies,player:p}=context;
    if(this.world!==context.world){this.world=context.world;this.gap=2;this.wardClock=0;this.cursor=0;}
    if(!active||p.dead){for(const e of enemies){e.riftWarning=undefined;e.riftWardSource=undefined;}return;}
    this.gap-=dt;this.wardClock-=dt;
    if(this.wardClock<=0){
      this.wardClock=.2;
      for(const e of enemies)e.riftWardSource=undefined;
      for(const source of enemies)if(riftMechanic(source)==='ritual'&&riftCanChannel(source)&&source.awareness>=1){
        for(const ally of context.neighbors?.(source,R.wardRadius)??enemies)
          if(ally!==source&&ally.hp>0&&ally.campId===source.campId&&!riftMechanic(ally)&&Math.hypot(source.x-ally.x,source.y-ally.y)<=R.wardRadius&&context.visible(source.x,source.y,ally.x,ally.y))ally.riftWardSource=source;
      }
    }
    for(const e of enemies){
      e.riftSpecialCooldown=Math.max(0,(e.riftSpecialCooldown??1)-dt);
      const warning=e.riftWarning;if(!warning)continue;
      if(!riftCanChannel(e)||Math.hypot(e.x-warning.originX,e.y-warning.originY)>35){e.riftWarning=undefined;continue;}
      warning.remaining-=dt;
      if(warning.remaining>0)continue;
      e.riftWarning=undefined;
      const storm=warning.kind==='storm';
      const hit=storm?Math.hypot(p.x-warning.x,p.y-warning.y)<=R.stormRadius+p.radius
        :circleIntersectsSector(p.x,p.y,p.radius,warning.x,warning.y,warning.angle,R.fireRadius,R.fireArc);
      if(hit&&!p.dead&&context.visible(e.x,e.y,warning.x,warning.y)&&context.visible(warning.x,warning.y,p.x,p.y))
        context.hurt(warning.damage,Math.atan2(p.y-warning.y,p.x-warning.x),e,storm?'lightning':'fire');
      context.emit({type:'blast',x:warning.x,y:warning.y,radius:storm?R.stormRadius:R.fireRadius,style:storm?'lightning':'fire',enemyKind:e.kind});
      transitionEnemy(e,'recover',.8);
    }
    if(this.gap>0||p.dead||context.world.isSanctuary?.(p.x,p.y))return;
    for(let i=0;i<enemies.length;i++){
      const index=(this.cursor+i)%enemies.length,e=enemies[index],kind=riftMechanic(e);
      if(!kind||kind==='ritual'||!riftCanChannel(e)||e.awareness<1||e.riftWarning||e.riftSpecialCooldown!>0||!['chase','recover'].includes(e.state))continue;
      const range=kind==='fire'?R.fireRadius:R.range;
      if(Math.hypot(p.x-e.x,p.y-e.y)>range||!context.visible(e.x,e.y,p.x,p.y))continue;
      const angle=Math.atan2(p.y-e.y,p.x-e.x);
      e.riftWarning={kind,x:kind==='storm'?p.x:e.x,y:kind==='storm'?p.y:e.y,originX:e.x,originY:e.y,angle,remaining:R.warning,damage:e.damage*R.damageMultiplier};
      transitionEnemy(e,'recover',R.warning+.8);e.angle=angle;e.riftSpecialCooldown=R.cooldown;
      this.gap=R.globalGap;this.cursor=index+1;break;
    }
  }
}
