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
        c.fillStyle = '#101a16';
        c.beginPath();
        c.ellipse(0, 3, 21, 7, 0, 0, Math.PI * 2);
        c.fill();
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
        c.fillStyle = '#131b1b';
        c.beginPath();
        c.ellipse(0, 1, 36, 19, 0, 0, Math.PI * 2);
        c.fill();
        for (let i = 0; i < 30; i++) {
            const a = random() * Math.PI * 2, r = 22 + random() * 12, x = Math.cos(a) * r, y = Math.sin(a) * r * .5;
            line(c, [[x - 8, y - 3], [x + 9, y + 2]], i % 3 ? '#625447' : '#938369', 1.5);
        }
        for (const x of [-12, 0, 13]) {
            c.fillStyle = '#a0a48a';
            c.beginPath();
            c.ellipse(x, -4, 6, 9, .3, 0, Math.PI * 2);
            c.fill();
            line(c, [[x - 2, -10], [x + 2, -5], [x - 1, -2]], '#526158', .8);
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
