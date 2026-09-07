import { weatherStone } from './material-art.ts';
import { polygon, line, randomFromSeed } from './art-primitives.ts';
import { drawGlow } from './lighting.ts';
import type { SiteDecor } from './wilderness-sites.ts';
/** Shared procedural assemblies: their solid anchors are authored by the site blueprint. */
export function drawWildernessDetail(c: CanvasRenderingContext2D, d: SiteDecor, time: number): void {
    const random = randomFromSeed(d.seed);
    if (d.kind === 'arch') {
        for (const side of [-1, 1])
            for (let i = 0; i < 4; i++) {
                const x = side * (25 - i * 2), y = -i * 15;
                polygon(c, [[x - 9, y], [x + 9, y - 2], [x + 8, y - 17], [x - 7, y - 16]], i % 2 ? '#58615d' : '#414e4c');
                weatherStone(c, [[x - 9, y], [x + 9, y - 2], [x + 8, y - 17], [x - 7, y - 16]], d.seed + i + side * 10);
                line(c, [[x - 7, y - 16], [x + 8, y - 17], [x + 9, y - 2]], '#8e9988', 1);
            }
        polygon(c, [[-21, -57], [-8, -78], [12, -80], [28, -61], [17, -54], [3, -64], [-11, -52]], '#687268');
        line(c, [[-20, -60], [-8, -78], [12, -80], [28, -61]], '#b2b59a', 1.3);
        weatherStone(c, [[-21, -57], [-8, -78], [12, -80], [28, -61], [17, -54], [3, -64], [-11, -52]], d.seed);
        line(c, [[-25, 2], [-22, -11], [-24, -24]], '#8e987454', 3);
        groundShade(c, 0, 3, 30, 9, '#14201b70');
    }
    else if (d.kind === 'cottage') {
        polygon(c, [[-40, 3], [-39, -45], [31, -44], [42, 7], [0, 20]], '#414c45');
        polygon(c, [[-49, -38], [-11, -83], [20, -72], [49, -32], [11, -35], [-4, -57], [-21, -34]], '#293f43');
        line(c, [[-49, -38], [-11, -83], [20, -72], [49, -32]], '#82908b', 2);
        weatherStone(c, [[-40, 3], [-39, -34], [-15, -35], [-11, -24], [29, -28], [36, 8], [0, 20]], d.seed);
        for (let i = 0; i < 5; i++) {
            const y = -68 + i * 6;
            line(c, [[-11 - i * 5, y], [15 + i * 5, y + 5]], '#77908b80', 1.1);
        }
        for (const x of [-34, 29])
            line(c, [[x, 6], [x, -34]], '#9a846b', 3);
        for (let i = 0; i < 5; i++)
            line(c, [[-31, -35 + i * 8], [30, -34 + i * 8]], '#697065', 1);
        polygon(c, [[-9, 13], [-10, -21], [9, -22], [14, 16]], '#101b1e');
        c.fillStyle = '#e1b770';
        c.fillRect(-29, -28, 8, 9);
        drawGlow(c, -25, -24, 26, '#e3ba74', .15);
        line(c, [[25, -41], [33, -2]], '#91836b', 3);
    }
    else if (d.kind === 'nest') {
        // A shallow leaf-lined hollow, with a broken rim rather than a cut-out disk.
        groundShade(c, 0, 3, 44, 24, '#20241bd0');
        groundShade(c, -2, 1, 27, 14, '#101b1ba0');
        const litter = ['#514c37', '#645b42', '#706448', '#474f36', '#807151'];
        for (let i = 0; i < 64; i++) {
            const a = random() * Math.PI * 2, r = 20 + random() * 17;
            const x = Math.cos(a) * r, y = Math.sin(a) * r * .52;
            const size = 2 + random() * 4, lean = random() * 3 - 1.5;
            polygon(c, [[x-size,y], [x+lean,y-size*.55], [x+size,y+1], [x-lean,y+size*.4]], litter[i % litter.length]);
        }
        // Short curved twigs follow the bowl, each with its own angle and length.
        for (let i = 0; i < 28; i++) {
            const a = random() * Math.PI * 2, r = 24 + random() * 11, span = .12 + random() * .24;
            c.beginPath();
            c.moveTo(Math.cos(a-span)*r, Math.sin(a-span)*r*.5);
            c.quadraticCurveTo(Math.cos(a)*(r+2), Math.sin(a)*(r+2)*.5-1, Math.cos(a+span)*r, Math.sin(a+span)*r*.5);
            c.strokeStyle = i % 4 ? '#6a5942' : '#8d7956';
            c.lineWidth = .7 + random() * .8; c.stroke();
        }
        // Unevenly nestled eggs: warm shells, soft volume and small mottled marks.
        for (const [x, y, tilt] of [[-10, -2, -.35], [2, -6, .15], [13, 0, .5]]) {
            const h = 7 + random() * 2;
            groundShade(c, x+1, y+3, 9, 4, '#15201bcc');
            c.save(); c.translate(x, y-3); c.rotate(tilt); c.beginPath();
            c.ellipse(0, 0, 5.5, h, 0, 0, Math.PI*2); c.clip();
            const shell = c.createLinearGradient(-5, -h, 5, h);
            shell.addColorStop(0, '#c0b795'); shell.addColorStop(.45, '#998f70'); shell.addColorStop(1, '#5d624e');
            c.fillStyle = shell; c.fillRect(-6, -h, 12, h*2);
            for (let fleck = 0; fleck < 8; fleck++) {
                c.fillStyle = '#5c604744'; c.fillRect((random()-.5)*10, (random()-.5)*h*1.7, .7+random(), .7);
            }
            c.restore();
        }
        // A little foreground moss embeds the shells into the rim.
        for (let i = 0; i < 12; i++) {
            const x = (random()-.5)*48, y = 8+random()*6;
            line(c, [[x-2,y+1], [x,y-1], [x+3,y]], i%2 ? '#626348' : '#50583c', 1.2);
        }
    }
    else if (d.kind === 'crystal') {
        drawGlow(c, 0, -17, 45, '#96cfe1', .22 + Math.sin(time * 2 + d.seed) * .025);
        for (const [x, h] of [[-13, 27], [0, 49], [14, 32]]) {
            polygon(c, [[x - 8, 1], [x - 7, -h + 9], [x, -h], [x + 9, -h + 13], [x + 7, 2]], '#538f9b');
            polygon(c, [[x, 1], [x, -h], [x + 9, -h + 13], [x + 7, 2]], '#b9e0dd');
            line(c, [[x - 7, -h + 9], [x, -h], [x + 9, -h + 13]], '#e2f4e3', 1);
        }
    }
    else if (d.kind === 'root') {
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4, r = 24 + random() * 13;
            line(c, [[Math.cos(a) * r, Math.sin(a) * r * .45], [Math.cos(a) * 13, -9], [Math.sin(i) * 8, -42 - random() * 17]], i % 2 ? '#344740' : '#55634a', 5 - i % 3);
        }
        polygon(c, [[-14, 0], [-11, -33], [0, -57], [15, -27], [10, 5]], '#3c5146');
        line(c, [[1, 2], [-4, -16], [5, -29], [0, -47]], '#b0dba0', 2);
        drawGlow(c, 0, -24, 42, '#86c69a', .25 + Math.sin(time * 1.5) * .04);
    }
    else if (d.kind === 'barricade') {
        for (let i = 0; i < 5; i++) {
            const x = (i - 2) * 14;
            polygon(c, [[x - 5, 7], [x - 4, -31], [x, -44], [x + 5, -30], [x + 5, 7]], '#705943');
            line(c, [[x, -42], [x + 3, -28], [x + 3, 4]], '#b19b74', 1);
        }
        line(c, [[-36, -8], [36, -13]], '#46524e', 5);
        line(c, [[-36, -25], [36, -20]], '#7b7961', 3);
    }
}

/** Feathered contact shading; no opaque oval silhouette on the forest floor. */
function groundShade(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
    c.save(); c.translate(x,y); c.scale(1,ry/rx);
    const shade=c.createRadialGradient(0,0,0,0,0,rx);
    shade.addColorStop(0,color); shade.addColorStop(.45,color); shade.addColorStop(1,'#18201900');
    c.fillStyle=shade; c.fillRect(-rx,-rx,rx*2,rx*2); c.restore();
}
