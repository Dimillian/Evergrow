import { polygon, line } from './art-primitives.ts';
import type { DungeonFloor } from './dungeon.ts';
import type { DungeonRun } from './dungeon-state.ts';
import { dungeonTheme, DUNGEON_EVENTS } from './dungeon-content.ts';

/** Theme-specific silhouettes live in the same lit world pass as actors and masonry. */
export function drawDungeonProps(c: CanvasRenderingContext2D, f: DungeonFloor, run: DungeonRun, time: number) {
    const theme=dungeonTheme(f.seed);
    for(const p of f.props??[]){
        c.save();c.translate(p.x,p.y);
        c.fillStyle='#03090caf';c.beginPath();c.ellipse(5,10,36,15,0,0,7);c.fill();
        if(p.kind==='anvil'){
            polygon(c,[[-21,12],[-14,-5],[12,-5],[22,12],[15,19],[-17,19]],'#4c3930');
            polygon(c,[[-35,-22],[18,-22],[36,-31],[39,-22],[18,-10],[8,-4],[-14,-4],[-17,-14],[-35,-16]],'#849198');
            line(c,[[-33,-23],[16,-23],[35,-31]],'#c1c6bd',2);
            polygon(c,[[-12,-4],[8,-4],[13,8],[-17,8]],'#3c4a51');
        }else if(p.kind==='furnace'){
            polygon(c,[[-32,6],[-30,-42],[-20,-60],[20,-60],[32,-42],[34,8],[20,20],[-20,20]],'#34333a');
            polygon(c,[[-19,5],[-18,-31],[-10,-43],[12,-43],[21,-29],[22,5]],'#ff8c40');
            polygon(c,[[-14,2],[-11,-24],[-4,-17],[4,-35],[12,-15],[14,3]],'#ffd188');
            for(let i=0;i<5;i++)line(c,[[-21+i*10,-36],[-20+i*10,12]],'#151c24',4);
            line(c,[[-27,-44],[-20,-58],[20,-58],[28,-44]],'#8f8272',3);
        }else if(p.kind==='crystal'){
            for(const side of [-1,0,1]){const x=side*18,h=side?40:68;
                polygon(c,[[x-10,4],[x-13,-h+13],[x,-h],[x+12,-h+10],[x+9,4]],'#426f91');
                polygon(c,[[x,-h],[x+12,-h+10],[x+9,4],[x,9]],'#8fc6d5');line(c,[[x,-h+3],[x,-2]],'#d2f5ef',2);
            }
        }else if(p.kind==='pool'){
            c.fillStyle='#173e53';c.beginPath();c.ellipse(0,0,52,31,-.2,0,7);c.fill();
            c.strokeStyle='#a4cbd24f';c.lineWidth=2;
            for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,-3,18+i*12,8+i*6,-.2,time*.2+i,4+time*.2+i);c.stroke();}
        }else if(p.kind==='roots'){
            for(let i=0;i<5;i++){c.strokeStyle=i%2?'#71805a':'#3a4a38';c.lineWidth=6-i;
                c.beginPath();c.moveTo((i-2)*8,-50);c.bezierCurveTo(-26+i*7,-25,24-i*9,-5,(i-2)*23,20);c.stroke();}
            c.fillStyle='#a1d896';for(let i=0;i<6;i++){c.beginPath();c.ellipse((i-2)*8,-20+i*4,4,2,i,0,7);c.fill();}
        }else if(p.kind==='tomb'){
            polygon(c,[[-23,-39],[-14,-51],[14,-51],[23,-39],[23,25],[14,35],[-14,35],[-23,25]],'#283735');
            polygon(c,[[-20,-46],[-12,-58],[12,-58],[20,-46],[20,14],[12,25],[-12,25],[-20,14]],'#71816b');
            line(c,[[-15,-44],[-15,11],[-8,19],[11,19]],'#b2b399',2);
            c.fillStyle='#aeb59a';c.beginPath();c.ellipse(0,-36,6,8,0,0,7);c.fill();
            polygon(c,[[-8,-22],[0,-27],[8,-22],[5,8],[-5,8]],'#9bA18a');
        }else{
            polygon(c,[[-22,-28],[17,-35],[28,-25],[28,12],[-13,19],[-22,8]],'#6b5137');
            polygon(c,[[-22,-28],[-12,-35],[17,-35],[28,-25],[-12,-17]],'#9a7d51');
            for(const y of [-12,7])line(c,[[-20,y],[-12,y+8],[27,y]],'#af9569',3);
            if(p.kind==='crate')line(c,[[-10,-15],[20,9]],'#c1a777',3);
        }
        c.restore();
    }
    for(const event of f.events??[]){
        const state=run.events?.[event.id];
        c.save();c.translate(event.x,event.y);
        c.strokeStyle=state?.finished?'#7caa89':theme.accent;c.lineWidth=2;
        const r=event.kind==='ward'?155:70;
        c.globalAlpha=state?.started ? .55:.3;
        c.beginPath();c.ellipse(0,0,r,r*.68,0,0,7);c.stroke();
        for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.moveTo(Math.cos(a)*(r-8),Math.sin(a)*(r-8)*.68);c.lineTo(Math.cos(a)*(r+5),Math.sin(a)*(r+5)*.68);c.stroke();}
        c.globalAlpha=1;
        polygon(c,[[-20,-5],[0,-16],[20,-5],[20,12],[0,23],[-20,12]],'#334347');
        polygon(c,[[-23,-13],[0,-24],[23,-13],[0,-2]],theme.accent);
        c.restore();
        // Native text belongs to the HUD pass; this altar art contains no labels.
    }
}

export function dungeonEventLabel(run: DungeonRun, event: NonNullable<DungeonFloor['events']>[number]): string {
    const state=run.events?.[event.id],recipe=DUNGEON_EVENTS[event.kind];
    if(state?.finished)return 'Complete';
    if(!state?.started)return `${recipe.action} [E]`;
    return `${recipe.name} · ${state.wave+1}/${recipe.rules.count}${recipe.rules.hold ? ` · Hold ${Math.ceil(Math.max(0,recipe.rules.hold-state.held))}s` : ''}`;
}
