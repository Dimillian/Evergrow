import { drawDungeonProps } from './dungeon-prop-art.ts';
import { dungeonTheme } from './dungeon-content.ts';
import { ChestArt } from './chest-art.ts';
const defaultChests=new ChestArt();
import type { CharacterPose } from './art-types.ts';
import { polygon, line, taper, type Color } from './art-primitives.ts';
import type { DungeonFloor, DungeonEntrance } from './dungeon.ts';
import type { DungeonRun } from './dungeon-state.ts';
import { drawGlow } from './lighting.ts';
import { cryptFixtures, cryptFlicker } from './dungeon-lighting.ts';
import { cryptHash, cryptOutline } from './dungeon-contours.ts';
export function warden(c: CanvasRenderingContext2D, p: CharacterPose, color: Color) {
    const themed=p.dungeonTheme==='rime'||p.dungeonTheme==='astral';
    const baseColor=color;
    if(themed)color=(value)=>baseColor(value==='#b3e6c2'?(p.dungeonTheme==='rime'?'#b5edff':'#dfb1ff'):value==='#969c81'||value==='#9a9f80'?(p.dungeonTheme==='rime'?'#9cbbcf':'#9581b4'):value==='#65746b'?(p.dungeonTheme==='rime'?'#5e849a':'#675379'):value);
    const sway = Math.sin(p.time * 1.6) * 1.2, bob = Math.abs(Math.sin(p.time * 5)) * p.moving * 2;
    c.save();
    polygon(c, [[-20, -66], [19, -66], [30, -8], [17, -1], [5, -7], [-9, -3], [-27, -9]], color('#263a3a'));
    for (const side of [-1, 1]) {
        taper(c, [side * 12, -30], [side * 16, -5 + side * bob], 12, 9, color('#52625b'));
        line(c, [[side * 16 - 5, 0], [side * 16 + 9, 0]], color('#222b30'), 7);
    }
    polygon(c, [[-23, -72], [20, -73], [25, -53], [16, -29], [-16, -29], [-28, -52]], color('#65746b'));
    polygon(c, [[-15, -65], [14, -65], [12, -35], [0, -29], [-13, -37]], color('#9a9f80'));
    for (let i = 0; i < 4; i++)
        line(c, [[-13, -61 + i * 7], [0, -57 + i * 7], [13, -61 + i * 7]], color('#263a39'), 3);
    for (const side of [-1, 1]) {
        const arm = side === 1 ? Math.sin(Math.max(0, p.attack) * Math.PI) * 24 : 0;
        taper(c, [side * 25, -65], [side * (32 + arm), -40], 11, 7, color('#69786b'));
        taper(c, [side * (32 + arm), -40], [side * 33, -23 - arm], 7, 5, color('#a0a084'));
        polygon(c, [[side * 17, -70], [side * 26, -79], [side * 38, -68], [side * 30, -56], [side * 20, -58]], color('#536961'));
    }
    if(p.dungeonTheme==='rime'){
      for(let i=0;i<5;i++){const x=-20+i*10;polygon(c,[[x-5,-86],[x,-112-Math.abs(i-2)*4],[x+5,-87]],color('#bedce6'));}
      for(const side of[-1,1])polygon(c,[[side*23,-65],[side*37,-98],[side*40,-59]],color('#94b9d0'));
    }else if(p.dungeonTheme==='astral'){
      c.strokeStyle=color('#d1ab6b');c.lineWidth=2;for(const tilt of[-.5,.5]){c.beginPath();c.ellipse(0,-75,47,19,tilt,0,7);c.stroke();}
      polygon(c,[[-8,-91],[0,-113],[8,-91],[0,-79]],color('#deb5ff'));
    }
    const angle = p.attack < 0 ? -1.8 : p.attack > 0 ? -1.8 + p.attack * 3.2 : -1.1;
    c.save();
    c.translate(33, -27);
    c.rotate(angle);
    line(c, [[0, 0], [62, 0]], color('#806d4d'), 6);
    polygon(c, [[39, -4], [60, -28], [68, -25], [75, 0], [65, 20], [52, 17], [58, 4]], color('#82917c'));
    line(c, [[60, -26], [69, -21], [74, 0], [66, 18]], color('#c4c69c'), 2);
    c.restore();
    c.save();
    c.translate(sway, -81);
    polygon(c, [[-13, -10], [0, -16], [14, -9], [11, 8], [0, 17], [-12, 8]], color('#969c81'));
    polygon(c, [[-9, -4], [9, -4], [7, 9], [0, 12], [-8, 8]], color('#112825'));
    c.fillStyle = color('#b3e6c2');
    c.fillRect(-8, 0, 5, 2);
    c.fillRect(3, 0, 5, 2);
    for (const side of [-1, 1])
        line(c, [[side * 10, -9], [side * 18, -22], [side * 20, -11]], color('#b8b58a'), 3);
    c.restore();
    c.restore();
}
export function drawCryptGate(c: CanvasRenderingContext2D, p: Pick<DungeonEntrance, 'x' | 'y'> & {seed?:number;theme?:import('./dungeon-content.ts').DungeonThemeId}, time: number) {
    const theme=dungeonTheme(p.seed??0,p.theme),id=theme.id;
    c.save();c.translate(p.x,p.y);
    const poly=(pts:number[][],fill:string)=>polygon(c,pts as [number,number][],fill);
    c.fillStyle='#03080ab0';c.beginPath();c.ellipse(6,12,64,24,0,0,7);c.fill();
    // Receding steps ground every entrance; the portal silhouette stays distinct.
    for(let i=0;i<5;i++)poly([[-33-i*5,5+i*5],[33+i*5,5+i*5],[38+i*5,10+i*5],[-38-i*5,10+i*5]],i%2?'#56605c':'#353e3f');
    const stone=`rgb(${theme.stone.map(v=>v+35).join(',')})`;
    if(id==='foundry') {
        poly([[-66,7],[-66,-75],[-45,-108],[43,-108],[64,-75],[64,8]],'#393337');
        poly([[-47,5],[-47,-71],[-29,-88],[29,-88],[47,-71],[47,5]],'#967255');
        poly([[-37,5],[-37,-63],[-22,-78],[22,-78],[37,-63],[37,5]],'#080c13');
        for(const side of[-1,1]){poly([[side*43,-77],[side*32,-64],[side*32,4],[side*44,-1]],'#555457');for(let y=-64;y<0;y+=16){c.fillStyle='#dfac68';c.fillRect(side*39-2,y,4,4);}poly([[side*48,-29],[side*60,-25],[side*61,-10],[side*48,-12]],'#db793f');}
        line(c,[[-24,-95],[24,-95]],'#dc9c60',4);
    } else if(id==='ossuary') {
        poly([[-66,6],[-59,-92],[59,-92],[67,6]],'#66553e');
        poly([[-66,-92],[-43,-119],[42,-119],[66,-92]],'#b29669');
        poly([[-36,5],[-34,-80],[34,-80],[36,5]],'#10141a');
        for(const side of[-1,1]){poly([[side*43-9,5],[side*43-9,-88],[side*43+9,-88],[side*43+9,5]],stone);for(let y=-75;y<0;y+=18)line(c,[[side*43-8,y],[side*43+8,y]],'#645238',2);}
        c.fillStyle='#d2c3a0';c.beginPath();c.ellipse(0,-95,12,14,0,0,7);c.fill();c.fillStyle='#3a342d';c.fillRect(-8,-99,5,6);c.fillRect(3,-99,5,6);line(c,[[-5,-86],[5,-86]],'#5b4b36',2);
    } else if(id==='astral') {
        for(const side of[-1,1]){poly([[side*49-11,9],[side*49-8,-85],[side*49,-105],[side*49+8,-85],[side*49+11,9]],stone);line(c,[[side*49,-90],[side*49,-5]],'#c4a873',2);}
        c.strokeStyle='#a18eb8';c.lineWidth=9;c.beginPath();c.ellipse(0,-42,39,58,0,0,7);c.stroke();c.fillStyle='#0b101c';c.beginPath();c.ellipse(0,-42,34,53,0,0,7);c.fill();
        c.strokeStyle='#c4a873';c.lineWidth=2;c.beginPath();c.ellipse(0,-42,48,64,.22,0,7);c.stroke();
        for(let i=0;i<8;i++){const a=i*Math.PI/4;poly([[Math.cos(a)*43,-42+Math.sin(a)*60-3],[Math.cos(a)*43+3,-42+Math.sin(a)*60],[Math.cos(a)*43,-42+Math.sin(a)*60+3],[Math.cos(a)*43-3,-42+Math.sin(a)*60]],theme.accent);}
        line(c,[[-17,-108],[0,-121],[17,-108],[0,-96],[-17,-108]],'#dbbd7e',2);
    } else {
        const pointed=id==='rime',top=pointed?-120:-89;
        poly([[-54,7],[-51,-65],[-32,top+12],[0,top],[32,top+12],[51,-65],[54,7]],stone);
        poly([[-31,7],[-30,-53],[0,pointed?-96:-70],[30,-53],[31,7]],'#060d14');
        line(c,[[-36,4],[-35,-57],[0,pointed?-103:-77],[35,-57],[36,4]],'#bcc0ad',3);
        for(const side of[-1,1])for(let i=0;i<5;i++)line(c,[[side*38,-8-i*13],[side*50,-10-i*13]],'#353d41',2);
        if(id==='rime') {
            for(const side of[-1,1]){poly([[side*55-8,2],[side*55-7,-104],[side*55,-133],[side*55+7,-104],[side*55+8,2]],'#8eafc4');line(c,[[side*55,-128],[side*55,-5]],'#d3eff2',2);}
            for(let i=0;i<7;i++){const x=-29+i*10;poly([[x,-62-Math.abs(x)*.7],[x+6,-62-Math.abs(x)*.7],[x+2,-45-Math.abs(x)*.7]],'#bee6ef');}
            poly([[-13,-107],[0,-123],[13,-107],[0,-96]],'#d1ebf0');
        }else if(id==='rootbound'){
            for(const side of[-1,1])for(let i=0;i<3;i++){c.strokeStyle=i%2?'#6d7350':'#3a4c34';c.lineWidth=5-i;c.beginPath();c.moveTo(side*(58+i*4),15);c.bezierCurveTo(side*27,-8,side*65,-60,side*(11+i*9),-93);c.stroke();}
            for(let i=0;i<8;i++){c.fillStyle='#648762';c.beginPath();c.ellipse(-42+i*12,-75-Math.sin(i)*12,7,3,i,0,7);c.fill();}
        }else{
            c.strokeStyle='#91bac5';c.lineWidth=2;for(let i=0;i<4;i++){c.beginPath();c.ellipse(0,14+i*4,40+i*8,8+i*2,0,.1,3.1);c.stroke();}
            for(const side of[-1,1])poly([[side*58-7,8],[side*58-6,-36],[side*58,-52],[side*58+7,-34],[side*58+8,8]],'#75b7c9');
        }
    }
    for(const side of[-1,1]){c.fillStyle='#826e45';c.fillRect(side*70-3,-22,6,26);drawGlow(c,side*70,-26,25,theme.accent,.5);poly([[side*70-4,-24],[side*70,-37],[side*70+4,-24]],theme.light);}
    // Restrained light at the threshold; no floating doorway text or decorative particles.
    const glow=c.createRadialGradient(0,1,1,0,1,35);glow.addColorStop(0,theme.accent+'45');glow.addColorStop(1,theme.accent+'00');c.fillStyle=glow;c.fillRect(-35,-28,70,60);
    c.strokeStyle=theme.accent+'70';c.lineWidth=1;c.beginPath();c.ellipse(0,8,28+Math.sin(time)*.6,8,0,0,7);c.stroke();c.restore();
}

export function drawCryptDecor(c: CanvasRenderingContext2D, f: DungeonFloor, run: DungeonRun, time: number, chests:ChestArt=defaultChests, reduced=false) {
    for (const r of f.rooms) {
        c.save(); c.beginPath();
        cryptOutline(r).forEach((p,i) => i ? c.lineTo(p.x,p.y) : c.moveTo(p.x,p.y)); c.closePath(); c.clip();
        // Old drag marks and scattered bones interrupt the ordered burial masonry.
        if (r.kind !== 'entry' && dungeonTheme(f.seed,f.theme).id==='rootbound') {
            const sx=r.x+r.width*.33, sy=r.y+r.height*.35;
            for(let i=0;i<9;i++) {
                const h=cryptHash(r.id,i,f.seed), x=sx+h%80, y=sy+(h>>>8)%130;
                c.strokeStyle=i%3?'#341f2055':'#4c292255'; c.lineWidth=2+i%4;
                c.beginPath(); c.moveTo(x,y); c.quadraticCurveTo(x+13,y+24,x-5,y+60+h%35); c.stroke();
                c.fillStyle='#aba088'; c.beginPath(); c.ellipse(x+8,y+5,3,2.5,.4,0,7); c.fill();
                c.fillStyle='#171d22'; c.fillRect(x+7,y+4,1,1); c.fillRect(x+9,y+4,1,1);
                line(c,[[x-9,y+13],[x-2,y+17]],'#8c8470',1.5);
            }
        }
        c.restore();
        if (r.kind === 'boss') {
            const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
            c.save();
            c.translate(cx, cy);
            c.strokeStyle = '#9c9d6845';
            c.lineWidth = 2;
            for (const radius of [155, 165, 220]) {
                c.beginPath();
                c.arc(0, 0, radius, 0, Math.PI * 2);
                c.stroke();
            }
            for (let i = 0; i < 12; i++) {
                const a = i * Math.PI / 6;
                c.save();
                c.rotate(a);
                line(c, [[176, -6], [190, 0], [176, 6]], '#abb88a55', 2);
                c.restore();
            }
            c.restore();
        }
    }
    drawDungeonProps(c,f,run,time);
    for (const p of cryptFixtures(f)) {
        const {x, y} = p;
        if (p.kind === 'torch') {
            // A forged bracket anchored into weathered stone, with a soot stain above it.
            const soot = c.createRadialGradient(x, y - 17, 1, x, y - 17, 27);
            soot.addColorStop(0, '#03050bdd'); soot.addColorStop(1, '#03050b00');
            c.fillStyle = soot; c.fillRect(x - 27, y - 44, 54, 54);
            c.strokeStyle='#5d594f'; c.lineWidth=3;
            c.beginPath(); c.moveTo(x-11,y+21); c.lineTo(x-11,y-7); c.quadraticCurveTo(x,y-24,x+11,y-7); c.lineTo(x+11,y+21); c.stroke();
            polygon(c, [[x-7,y+3],[x,y-5],[x+7,y+3],[x+5,y+25],[x,y+30],[x-5,y+25]], '#24282d');
            line(c, [[x+p.side*12,y+17],[x,y+20],[x,y+3]], '#8d7958', 3);
            line(c, [[x-7,y+6],[x-4,y+12],[x+4,y+12],[x+7,y+6]], '#b59863', 2);
        } else {
            c.fillStyle = '#04081199'; c.beginPath(); c.ellipse(x+6,y+39,28,10,0,0,7); c.fill();
            polygon(c, [[x-22,y+29],[x-12,y+20],[x+12,y+20],[x+22,y+29],[x+18,y+42],[x-18,y+42]], '#343e46');
            line(c, [[x-20,y+29],[x,y+34],[x+20,y+29]], '#87908c', 2);
            for (const side of [-1,1]) line(c, [[x+side*13,y+26],[x+side*20,y+7],[x+side*14,y-12]], '#8a8065', 3);
            c.strokeStyle = '#50829266'; c.lineWidth = 1; c.beginPath(); c.ellipse(x,y+37,38,16,0,0,7); c.stroke();
        }
    }
    drawCryptGate(c, {...f.entry,seed:f.seed,theme:f.theme}, time);
    if (run.states.warden.hp <= 0)
        drawCryptGate(c, {...f.exit,seed:f.seed,theme:f.theme}, time);
    f.chests.forEach((p,i)=>{const grand=i===2&&run.entrance.expedition?.stage===9;c.save();c.translate(p.x,p.y);if(grand){drawGlow(c,0,-12,90,'#c19af0',.3);c.scale(1.5,1.5);}chests.draw(c,`${run.entrance.id}:chest:${i}`,0,0,run.chestMasks[i]!==0,time,0,grand,reduced);c.restore();});
}


/** Hot source cores and small particles are emitted after the surface light pass. */
export function drawCryptEmission(c: CanvasRenderingContext2D, f: DungeonFloor, time: number,
    view: {left: number; top: number; width: number; height: number}, coresOnly = false) {
    for (const p of cryptFixtures(f)) {
        if (p.x < view.left-90 || p.x > view.left+view.width+90 || p.y < view.top-100 || p.y > view.top+view.height+90) continue;
        const {x, y} = p, flicker = cryptFlicker(p, time);
        if (p.kind === 'torch') {
            if (!coresOnly) drawGlow(c,x,y,62,'#ff812f',.48*flicker);
            if (!coresOnly) drawGlow(c,x,y,22,'#ffcb79',.8*flicker);
            const lean = Math.sin(time*7+p.phase)*3;
            c.fillStyle = '#f36b27'; c.beginPath(); c.moveTo(x-6,y+7);
            c.quadraticCurveTo(x-10,y-2,x+lean+2,y-21*flicker);
            c.quadraticCurveTo(x+3,y-7,x+7,y+4); c.quadraticCurveTo(x,y+12,x-6,y+7); c.fill();
            c.fillStyle='#ffcb70'; c.beginPath(); c.moveTo(x-4,y+5); c.quadraticCurveTo(x-5,y-3,x+lean,y-13*flicker); c.quadraticCurveTo(x+7,y+7,x-4,y+5); c.fill();
            c.fillStyle='#fff1c7'; c.beginPath(); c.ellipse(x,y+3,2.5,5,0,0,7); c.fill();
            for(let i=0;i<7;i++) {
                const life=(time*(.3+i*.021)+i/7+p.phase)%1, sx=x+Math.sin(life*7+i)* (3+life*10), sy=y-life*56;
                c.globalAlpha=(1-life)*.8; c.fillStyle=i%2?'#ffc176':'#fff1be'; c.fillRect(sx,sy,1.2,2.5*(1-life));
            }
            c.globalAlpha=1;
        } else {
            const bob=Math.sin(time*1.8+p.phase)*3;
            if (!coresOnly) drawGlow(c,x,y+bob,86,dungeonTheme(f.seed,f.theme).light,.4*flicker);
            if (!coresOnly) drawGlow(c,x,y+bob,31,dungeonTheme(f.seed,f.theme).accent,.65);
            const sphere=c.createRadialGradient(x-2,y-3+bob,1,x,y+bob,9);
            sphere.addColorStop(0,'#f0ffff'); sphere.addColorStop(.35,dungeonTheme(f.seed,f.theme).accent); sphere.addColorStop(.75,dungeonTheme(f.seed,f.theme).light); sphere.addColorStop(1,'#235895');
            c.fillStyle=sphere; c.beginPath(); c.arc(x,y+bob,9,0,7); c.fill();
            c.save(); c.translate(x,y+bob); c.strokeStyle='#9ce9f3a0'; c.lineWidth=.8;
            for(let ring=0;ring<2;ring++) {
                c.save(); c.rotate(time*(ring?-.35:.3)+ring*1.7+p.phase);
                c.beginPath(); c.ellipse(0,0,18+ring*5,6+ring*2,0,.3,5.6); c.stroke(); c.restore();
            }
            c.restore();
            for(let i=0;i<9;i++) {
                const a=time*(.3+i*.015)+i*2.4+p.phase, radius=16+(i%4)*7;
                const sx=x+Math.cos(a)*radius, sy=y+bob+Math.sin(a)*radius*.45;
                c.globalAlpha=.35+(Math.sin(a)+1)*.25; c.fillStyle='#b6f6ff'; c.fillRect(sx,sy,1.3,1.3);
            }
            c.globalAlpha=1;
            // A faint moving caustic on the stone below the suspended orb.
            c.strokeStyle='#77dbe938'; c.lineWidth=1; c.beginPath(); c.ellipse(x,y+35,21+Math.sin(time+p.phase)*3,7,0,0,7); c.stroke();
        }
    }
}
