import type { CharacterPose } from './art-types.ts';
import { polygon, line, taper, type Color } from './art-primitives.ts';
import type { DungeonFloor, DungeonEntrance } from './dungeon.ts';
import type { DungeonRun } from './dungeon-state.ts';
import type { Enemy } from './model.ts';
import { WARDEN_RULES } from './dungeon-boss.ts';
import { drawGlow } from './lighting.ts';
import { cryptFixtures, cryptFlicker } from './dungeon-lighting.ts';
import { cryptHash, cryptOutline } from './dungeon-contours.ts';
export function warden(c: CanvasRenderingContext2D, p: CharacterPose, color: Color) {
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
export function drawCryptGate(c: CanvasRenderingContext2D, p: Pick<DungeonEntrance, 'x' | 'y'>, time: number) {
    c.save();
    c.translate(p.x, p.y);
    c.fillStyle = '#071218';
    c.fillRect(-25, -42, 50, 44);
    c.strokeStyle = '#9caf99';
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(-30, 3);
    c.lineTo(-30, -35);
    c.quadraticCurveTo(0, -76, 30, -35);
    c.lineTo(30, 3);
    c.stroke();
    for (let i = 0; i < 5; i++) {
        c.fillStyle = `rgba(110,175,160,${.12 + i * .025})`;
        c.fillRect(-22 + i * 3, -7 + i * 3, 44 - i * 6, 3);
    }
    for (const side of [-1, 1]) {
        c.fillStyle = '#deb77b';
        c.fillRect(side * 38 - 2, -25, 4, 6);
        const g = c.createRadialGradient(side * 38, -25, 0, side * 38, -25, 35);
        g.addColorStop(0, '#97d7c43a');
        g.addColorStop(1, '#97d7c400');
        c.fillStyle = g;
        c.fillRect(side * 38 - 35, -60, 70, 70);
    }
    c.strokeStyle = '#83bdad';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(0, 5, 28 + Math.sin(time) * 1.5, 9, 0, 0, Math.PI * 2);
    c.stroke();
    c.restore();
}
export function drawCryptDecor(c: CanvasRenderingContext2D, f: DungeonFloor, run: DungeonRun, time: number, opening?: {
    index: number;
    progress: number;
}) {
    for (const r of f.rooms) {
        c.save(); c.beginPath();
        cryptOutline(r).forEach((p,i) => i ? c.lineTo(p.x,p.y) : c.moveTo(p.x,p.y)); c.closePath(); c.clip();
        // Old drag marks and scattered bones interrupt the ordered burial masonry.
        if (r.kind !== 'entry') {
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
        for (const side of [-1, 1]) {
            const x = r.x + r.width / 2 + side * (r.width / 2 - 40);
            for (let i = 0; i < 3; i++) {
                const sy = r.y + 160 + i * 76;
                const wear = cryptHash(r.id, i + side * 17, f.seed);
                c.save(); c.translate(x, sy + 25); c.rotate(((wear % 7) - 3) * .025); c.translate(-x, -sy - 25);
                c.fillStyle = '#040e1770';
                c.beginPath();
                c.ellipse(x + 5, sy + 35, 21, 29, 0, 0, 7);
                c.fill();
                polygon(c, [[x - 16, sy + 7], [x - 10, sy - 2], [x + 10, sy - 2], [x + 16, sy + 7], [x + 16, sy + 48], [x + 10, sy + 55], [x - 10, sy + 55], [x - 16, sy + 48]], '#273b3d');
                c.save();
                if (wear % 4 === 0) { c.translate(side * 11, -6); c.translate(x,sy); c.rotate(side*.14); c.translate(-x,-sy); }
                polygon(c, [[x - 12, sy + 4], [x - 7, sy - 2], [x + 7, sy - 2], [x + 12, sy + 4], [x + 12, sy + 44], [x + 7, sy + 49], [x - 7, sy + 49], [x - 12, sy + 44]], '#505b57');
                line(c, [[x - 10, sy + 8], [x - 10, sy + 43], [x - 5, sy + 47], [x + 7, sy + 47]], '#a4ad892f', 1);
                c.fillStyle = '#8c8e7c';
                c.beginPath();
                c.ellipse(x, sy + 12, 4, 5, 0, 0, 7);
                c.fill();
                polygon(c, [[x - 6, sy + 20], [x, sy + 17], [x + 6, sy + 20], [x + 3, sy + 38], [x - 3, sy + 38]], '#717b6d');
                line(c, [[x - 5, sy + 22], [x + 3, sy + 28], [x + 5, sy + 22], [x - 3, sy + 28]], '#263c3b', 1);
                line(c, [[x - 12, sy + 33], [x - 2, sy + 30], [x + 8, sy + 34]], '#1c313244', 1);
                for(let chip=0;chip<8;chip++) {
                    const h=cryptHash(wear,chip,f.seed);
                    c.fillStyle=chip%2?'#111e2855':'#c5bda030'; c.fillRect(x-10+h%20,sy+4+(h>>>8)%42,2,1);
                }
                c.restore(); c.restore();
            }
            c.strokeStyle = '#4d6050';
            c.lineWidth = 3;
            c.beginPath();
            c.moveTo(x, r.y - 18);
            c.bezierCurveTo(x - side * 20, r.y + 30, x + side * 24, r.y + 68, x - side * 35, r.y + 115);
            c.stroke();
        }
    }
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
    drawCryptGate(c, f.entry, time);
    if (run.states.warden.hp <= 0)
        drawCryptGate(c, f.exit, time);
    f.chests.forEach((p, i) => { const open = (run.chestMasks[i] & (i === 2 ? 15 : 9)) === (i === 2 ? 15 : 9); c.save(); c.translate(p.x, p.y); c.fillStyle = '#233936'; c.fillRect(-24, -15, 48, 28); c.strokeStyle = '#b9aa71'; c.lineWidth = 2; c.strokeRect(-24, -15, 48, 28); c.fillStyle = '#6d7258'; const lift = open ? 1 : opening?.index === i ? opening.progress : 0; c.fillRect(-24, -21 - lift * 14, 48, 12 + lift * 2); c.strokeRect(-24, -21 - lift * 14, 48, 12 + lift * 2); c.fillStyle = '#e0c88c'; c.fillRect(-3, -8, 6, 9); c.restore(); });
}
export function drawWardenWarning(c: CanvasRenderingContext2D, e: Enemy) {
    if (e.kind !== 'warden' || !['windup', 'attack'].includes(e.state))
        return;
    c.save();
    c.translate(e.x, e.y);
    c.strokeStyle = e.state === 'attack' ? '#e8d293' : '#d59b73';
    c.fillStyle = '#b77b542e';
    c.lineWidth = 2;
    if (e.bossMove === 'fracture') {
        for (let i = 0; i < 3; i++) {
            const a = e.attackAngle + (i - 1) * .5;
            c.save();
            c.rotate(a);
            c.fillRect(0, -WARDEN_RULES.fractureWidth, WARDEN_RULES.fractureLength, WARDEN_RULES.fractureWidth * 2);
            c.strokeRect(0, -WARDEN_RULES.fractureWidth, WARDEN_RULES.fractureLength, WARDEN_RULES.fractureWidth * 2);
            c.restore();
        }
    }
    else if (e.bossMove === 'sweep') {
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, WARDEN_RULES.reach, e.attackAngle - Math.PI * .65, e.attackAngle + Math.PI * .65);
        c.closePath();
        c.fill();
        c.stroke();
    }
    else {
        c.beginPath();
        c.ellipse(0, 0, 80, 30, 0, 0, 7);
        c.stroke();
    }
    c.restore();
}

/** Hot source cores and small particles are emitted after the surface light pass. */
export function drawCryptEmission(c: CanvasRenderingContext2D, f: DungeonFloor, time: number,
    view: {left: number; top: number; width: number; height: number}) {
    for (const p of cryptFixtures(f)) {
        if (p.x < view.left-90 || p.x > view.left+view.width+90 || p.y < view.top-100 || p.y > view.top+view.height+90) continue;
        const {x, y} = p, flicker = cryptFlicker(p, time);
        if (p.kind === 'torch') {
            drawGlow(c,x,y,62,'#ff812f',.48*flicker);
            drawGlow(c,x,y,22,'#ffcb79',.8*flicker);
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
            drawGlow(c,x,y+bob,86,'#388bd5',.4*flicker);
            drawGlow(c,x,y+bob,31,'#68dbe9',.65);
            const sphere=c.createRadialGradient(x-2,y-3+bob,1,x,y+bob,9);
            sphere.addColorStop(0,'#f0ffff'); sphere.addColorStop(.35,'#9af3ef'); sphere.addColorStop(.75,'#499bc7'); sphere.addColorStop(1,'#235895');
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
