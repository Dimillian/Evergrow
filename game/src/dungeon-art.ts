import type { CharacterPose } from './art-types.ts';
import { polygon, line, taper, type Color } from './art-primitives.ts';
import type { DungeonFloor, DungeonEntrance } from './dungeon.ts';
import type { DungeonRun } from './dungeon-state.ts';
import type { Enemy } from './model.ts';
import { WARDEN_RULES } from './dungeon-boss.ts';
import type { PointLight } from './lighting.ts';
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
export function cryptLights(f: DungeonFloor): PointLight[] { return f.rooms.flatMap(r => [-1, 1].map(side => ({ x: r.x + r.width / 2 + side * (r.width / 2 - 38), y: r.y + 80, radius: 240, color: side < 0 ? '#9ad7c8' : '#e7b777', power: .65 }))); }
export function drawCryptDecor(c: CanvasRenderingContext2D, f: DungeonFloor, run: DungeonRun, time: number, opening?: {
    index: number;
    progress: number;
}) {
    for (const r of f.rooms) {
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
            const x = r.x + r.width / 2 + side * (r.width / 2 - 40), y = r.y + 80;
            c.fillStyle = '#172628';
            c.fillRect(x - 13, y - 10, 26, 28);
            c.strokeStyle = '#748478';
            c.strokeRect(x - 11, y - 10, 22, 24);
            c.fillStyle = side < 0 ? '#afe4d2' : '#f0bf7d';
            c.beginPath();
            c.ellipse(x, y - 15, 5, 8 + Math.sin(time * 3 + r.id) * 1.5, 0, 0, 7);
            c.fill();
            for (let i = 0; i < 3; i++) {
                const sy = r.y + 160 + i * 76;
                c.fillStyle = '#040e1770';
                c.beginPath();
                c.ellipse(x + 5, sy + 35, 21, 29, 0, 0, 7);
                c.fill();
                polygon(c, [[x - 16, sy + 7], [x - 10, sy - 2], [x + 10, sy - 2], [x + 16, sy + 7], [x + 16, sy + 48], [x + 10, sy + 55], [x - 10, sy + 55], [x - 16, sy + 48]], '#273b3d');
                polygon(c, [[x - 12, sy + 4], [x - 7, sy - 2], [x + 7, sy - 2], [x + 12, sy + 4], [x + 12, sy + 44], [x + 7, sy + 49], [x - 7, sy + 49], [x - 12, sy + 44]], '#61736a');
                line(c, [[x - 10, sy + 8], [x - 10, sy + 43], [x - 5, sy + 47], [x + 7, sy + 47]], '#a4ad892f', 1);
                c.fillStyle = '#a0a88a';
                c.beginPath();
                c.ellipse(x, sy + 12, 4, 5, 0, 0, 7);
                c.fill();
                polygon(c, [[x - 6, sy + 20], [x, sy + 17], [x + 6, sy + 20], [x + 3, sy + 38], [x - 3, sy + 38]], '#809183');
                line(c, [[x - 5, sy + 22], [x + 3, sy + 28], [x + 5, sy + 22], [x - 3, sy + 28]], '#263c3b', 1);
                line(c, [[x - 12, sy + 33], [x - 2, sy + 30], [x + 8, sy + 34]], '#1c313244', 1);
            }
            c.strokeStyle = '#4d6050';
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(x, r.y + 6);
            c.bezierCurveTo(x - side * 20, r.y + 30, x + side * 24, r.y + 68, x - side * 35, r.y + 115);
            c.stroke();
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
