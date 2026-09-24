import { text } from './font.ts';
import type { DungeonRun } from './dungeon-state.ts';
import { RIFT_RULES } from './rift-content.ts';
export function drawRiftHUD(c:CanvasRenderingContext2D,run:DungeonRun,width:number):void {
  const r=run.rift;if(!r)return;const w=Math.min(270,width-32),x=20,y=88;
  const seconds=Math.max(0,Math.ceil(RIFT_RULES.duration-r.elapsed)),clock=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  const elapsedSec=Math.floor(r.elapsed),clearTimeClock=`${Math.floor(elapsedSec/60)}:${String(elapsedSec%60).padStart(2,'0')}`;
  c.save();c.fillStyle='#080d1ddd';c.fillRect(x,y,w,67);c.strokeStyle='#ce799955';c.strokeRect(x,y,w,67);
  const label=r.phase==='hunt'?'Cull the rift':r.phase==='boss'?(r.guardian&&r.elapsed-r.guardian.at<RIFT_RULES.guardianArrival?'Guardian arriving':'Slay the guardian'):r.phase==='complete'?(r.claimed?'Rift complete':'Reward waiting'):'Rift failed';
  text(c,label,x+12,y+17,.9,'#ebc6d7');text(c,r.phase==='complete'?clearTimeClock:clock,x+w-12,y+17,1,r.phase==='complete'?'#e1dbe4':seconds<60?'#f7959e':'#e1dbe4','right');
  c.fillStyle='#32243a';c.fillRect(x+12,y+32,w-24,5);c.fillStyle='#d47baf';c.fillRect(x+12,y+32,(w-24)*r.points/RIFT_RULES.progress,5);
  text(c,r.phase==='hunt'?`${r.points} / ${RIFT_RULES.progress}`:r.phase==='complete'?(r.claimed?'Return to town':'Claim the rift chest'):r.phase==='failed'?'Returning to town':'Guardian marked on your map',x+12,y+54,.75,'#bbbecd');c.restore();
}
