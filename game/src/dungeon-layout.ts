import { dungeonPassage } from './dungeon-passage.ts';
import type { Room } from './dungeon.ts';
import type { DungeonThemeId } from './dungeon-content.ts';

type Point = { x: number; y: number };
type Layout = { rooms: Room[]; edges: [number, number][]; corridors: Room[]; treasureIds: number[]; bossId: number };
const center = (r: Room): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const overlaps = (a: Room, b: Room, margin: number) => a.x < b.x + b.width + margin && a.x + a.width + margin > b.x && a.y < b.y + b.height + margin && a.y + a.height + margin > b.y;
const passage = (a:Point,b:Point,width:number,connection:number) => dungeonPassage([a,b],width,connection);

/** Pack a short procession of chambers, then attach two optional side rooms.
 * Doorways are chosen on facing walls: passages occupy the gap, never room centers.
 */
export function buildDungeonLayout(random: () => number, theme: DungeonThemeId): Layout {
    const coreCount = 4 + Math.floor(random()*3);
    const rooms: Room[] = [], edges: [number,number][] = [], corridors: Room[] = [];
    const dimensions = theme === 'foundry' ? [[832,512],[608,768],[704,576]] : theme === 'drowned' ? [[704,608],[576,768],[832,576]] : [[576,512],[704,576],[576,704]];
    function chamber(id: number, kind: Room['kind']): Room {
        const [width,height] = kind === 'boss' ? [1408,1088] : dimensions[Math.floor(random()*dimensions.length)];
        return { id, kind, x:-width/2, y:-height/2, width, height, shape: kind === 'boss' ? 'octagon' : kind === 'entry' ? 'hall' : random()<.18 ? 'cross' : random()<.15 ? 'octagon' : 'hall' };
    }
    rooms.push(chamber(0,'entry'));
    let heading = 0;
    function attach(parent: number, kind: Room['kind'], preferred: number, bend: boolean): number | null {
        const a=rooms[parent], ac=center(a), size=chamber(rooms.length,kind);
        for(let attempt=0;attempt<96;attempt++) {
            const direction=(preferred+(attempt<12?0:Math.floor(random()*4)))%4;
            const horizontal=direction%2===0, sign=direction<2?1:-1;
            const gap=260+Math.floor(random()*340), width=128+Math.floor(random()*3)*16;
            const b={...size};
            const diagonal=bend&&attempt<32;
            if(horizontal){
                b.x=sign>0?a.x+a.width+gap:a.x-gap-b.width;
                b.y=ac.y-b.height/2+(diagonal?(random()<.5?-1:1)*(a.height/2+b.height/2+gap*.5):(random()-.5)*Math.min(a.height,b.height)*.5);
            }else{
                b.y=sign>0?a.y+a.height+gap:a.y-gap-b.height;
                b.x=ac.x-b.width/2+(diagonal?(random()<.5?-1:1)*(a.width/2+b.width/2+gap*.5):(random()-.5)*Math.min(a.width,b.width)*.5);
            }
            const bc=center(b), connection=edges.length;
            let path: Room[];
            if(diagonal) {
                // A real corner: leave one wall and enter a perpendicular wall.
                const p=horizontal?{x:sign>0?a.x+a.width-40:a.x+40,y:ac.y}:{x:ac.x,y:sign>0?a.y+a.height-40:a.y+40};
                const corner=horizontal?{x:bc.x,y:ac.y}:{x:ac.x,y:bc.y};
                const q=horizontal?{x:bc.x,y:bc.y>ac.y?b.y+40:b.y+b.height-40}:{x:bc.x>ac.x?b.x+40:b.x+b.width-40,y:bc.y};
                path=[dungeonPassage([p,corner,q],width,connection)];
            }else{
                // Align doors within the central part of both walls; no tiny midpoint jog.
                const start=Math.max(horizontal?a.y+a.height*.32:a.x+a.width*.34,horizontal?b.y+b.height*.32:b.x+b.width*.34);
                const end=Math.min(horizontal?a.y+a.height*.68:a.x+a.width*.66,horizontal?b.y+b.height*.68:b.x+b.width*.66);
                if(end<start)continue;
                const door=(start+end)/2;
                const p=horizontal?{x:sign>0?a.x+a.width-40:a.x+40,y:door}:{x:door,y:sign>0?a.y+a.height-40:a.y+40};
                const q=horizontal?{x:sign>0?b.x+40:b.x+b.width-40,y:door}:{x:door,y:sign>0?b.y+40:b.y+b.height-40};
                path=[passage(p,q,width,connection)];
            }
            if(rooms.some(r=>overlaps(r,b,100)) || corridors.some(c=>overlaps(c,b,48)))continue;
            if(path.some(c=>rooms.some(r=>r.id!==parent&&overlaps(c,r,52)) || corridors.some(old=>overlaps(c,old,24))))continue;
            rooms.push(b);edges.push([parent,b.id]);corridors.push(...path);heading=direction;
            return b.id;
        }
        return null;
    }
    for(let id=1;id<coreCount;id++) {
        const turn=random()<.55?heading:(heading+(random()<.5?1:3))%4;
        let added=attach(id-1,'combat',turn,id===2);
        // A boxed-in chamber branches back from the preceding room, without overlaps.
        for(let parent=id-2;added===null&&parent>=0;parent--)added=attach(parent,'combat',turn,false);
        if(added===null)throw new Error('Dungeon chamber placement exhausted');
    }
    const treasureIds:number[]=[];
    for(let branch=0;branch<2;branch++) {
        let added:number|null=null;
        const first=1+Math.floor((coreCount-2)*(branch?.8:.2));
        for(let i=0;added===null&&i<coreCount-1;i++)added=attach(1+(first-1+i)%(coreCount-1),'treasure',(heading+(branch?1:3))%4,false);
        if(added===null)throw new Error('Dungeon side chamber placement exhausted');
        treasureIds.push(added);
    }
    let bossId=attach(coreCount-1,'boss',heading,false);
    for(let parent=coreCount-2;bossId===null&&parent>0;parent--)bossId=attach(parent,'boss',heading,false);
    if(bossId===null)throw new Error('Dungeon arena placement exhausted');

    // An occasional short cross-connection is admitted only where real walls align.
    // Optional encounters remain leaves, and no corridor crosses unrelated rooms.
    for(let a=0;a<coreCount;a++)for(let b=a+2;b<coreCount;b++){
        if(edges.some(([u,v])=>u===a&&v===b||u===b&&v===a))continue;
        const p=rooms[a],q=rooms[b],pc=center(p),qc=center(q),horizontal=Math.abs(pc.x-qc.x)>Math.abs(pc.y-qc.y);
        const low=horizontal?(pc.x<qc.x?p:q):(pc.y<qc.y?p:q),high=low===p?q:p;
        const gap=horizontal?high.x-low.x-low.width:high.y-low.y-low.height;
        const start=Math.max(horizontal?low.y+low.height*.36:low.x+low.width*.36,horizontal?high.y+high.height*.36:high.x+high.width*.36);
        const end=Math.min(horizontal?low.y+low.height*.64:low.x+low.width*.64,horizontal?high.y+high.height*.64:high.x+high.width*.64);
        if(gap<140||gap>650||end<start)continue;
        const door=(start+end)/2;
        const c=passage(horizontal?{x:low.x+low.width-40,y:door}:{x:door,y:low.y+low.height-40},horizontal?{x:high.x+40,y:door}:{x:door,y:high.y+40},144,edges.length);
        if(rooms.some(r=>r.id!==a&&r.id!==b&&overlaps(c,r,52))||corridors.some(old=>overlaps(c,old,24)))continue;
        edges.push([a,b]);corridors.push(c);
        return {rooms,edges,corridors,treasureIds,bossId};
    }
    return {rooms,edges,corridors,treasureIds,bossId};
}
