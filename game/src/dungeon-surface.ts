import type { DungeonFloor } from './dungeon.ts';
import { cryptFloorContains, cryptHash, cryptOutline } from './dungeon-contours.ts';

/** World-aligned masonry and eroded wall faces; tile crops always sample the same surface. */
export function drawCryptSurface(c: CanvasRenderingContext2D, f: DungeonFloor, tx: number, ty: number, size: number) {
    const ox = tx * size, oy = ty * size;
    const margin = 40, stride = (size + margin * 2) / 8, cells = new Uint8Array(stride * stride);
    for (let gy = 0; gy < stride; gy++) for (let gx = 0; gx < stride; gx++)
        cells[gy * stride + gx] = Number(cryptFloorContains(f, ox - margin + gx * 8 + 4, oy - margin + gy * 8 + 4));
    const openAt = (x: number, y: number) => !!cells[Math.floor((y - oy + margin) / 8) * stride + Math.floor((x - ox + margin) / 8)];
    c.fillStyle = '#030509'; c.fillRect(0, 0, size, size);
    c.save(); c.translate(-ox, -oy);
    // Draw only exposed wall cells. Union sampling avoids internal walls at room junctions.
    for (let y = oy; y < oy + size; y += 8) for (let x = ox; x < ox + size; x += 8) {
        if (openAt(x + 4, y + 4)) continue;
        let distance = 99;
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1], [-.7, -.7], [.7, .7], [-.7, .7], [.7, -.7]]) {
            for (let step = 8; step <= 32; step += 8) if (openAt(x + 4 + dx * step, y + 4 + dy * step)) { distance = Math.min(distance, step); break; }
        }
        if (distance > 32) continue;
        const h = cryptHash(Math.floor(x / 32), Math.floor(y / 16), f.seed), n = h % 14;
        const face = distance < 16 ? 48 : distance < 25 ? 76 : 33;
        c.fillStyle = `rgb(${face + n},${face + n - 2},${face + n - 6})`;
        c.fillRect(x, y, 8, 8);
        if (y % 16 === 0 || (x + (Math.floor(y / 16) % 2) * 16) % 32 === 0) {
            c.fillStyle = '#14171b'; c.fillRect(x, y, y % 16 === 0 ? 8 : 1, y % 16 === 0 ? 1 : 8);
        }
        c.fillStyle = '#b1a18425'; c.fillRect(x + (h % 5), y + 2, 2, 1);
    }
    c.beginPath();
    for (const r of [...f.rooms, ...f.corridors]) {
        if (r.x - 88 > ox + size || r.x + r.width + 88 < ox || r.y - 88 > oy + size || r.y + r.height + 88 < oy) continue;
        cryptOutline(r).forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath();
    }
    c.clip();
    c.fillStyle = '#3a3b3b'; c.fillRect(ox, oy, size, size);
    // Staggered, chipped flagstones avoid an uninterrupted square grid.
    for (let y = Math.floor(oy / 16) * 16 - 16; y < oy + size + 16; y += 16) {
        const shift = (Math.floor(y / 16) & 1) * 12;
        for (let x = Math.floor((ox - shift) / 24) * 24 + shift; x < ox + size + 24; x += 24) {
            const h = cryptHash(x, y, f.seed), n = h % 18, chip = 2 + (h >>> 8) % 5;
            c.save(); c.translate(x, y); c.scale(.5, .5);
            c.fillStyle = `rgb(${65 + n},${64 + n},${61 + n})`;
            c.beginPath(); c.moveTo(chip, 1); c.lineTo(45, 2); c.lineTo(47, 27);
            c.lineTo(40, 31); c.lineTo(2, 30); c.lineTo(1, 8); c.closePath(); c.fill();
            c.strokeStyle = '#a499791c'; c.lineWidth = 1; c.stroke();
            for (let i = 0; i < 12; i++) {
                const bits = cryptHash(x + i * 13, y + i * 27, f.seed);
                c.fillStyle = i % 3 ? '#b6a88a15' : '#131a2155';
                c.fillRect(3 + bits % 40, 3 + (bits >>> 8) % 25, 1 + (bits >>> 16) % 4, 1);
            }
            if (h % 4 === 0) {
                c.strokeStyle = '#1a2026'; c.beginPath(); c.moveTo(12, 1); c.lineTo(19, 13); c.lineTo(14, 21); c.lineTo(27, 30); c.stroke();
            }
            c.restore();
        }
    }
    // Seeded damp patches, dust, rubble and bone fragments belong to fixed world cells.
    for (let gy = Math.floor((oy - 100) / 96); gy <= Math.floor((oy + size + 100) / 96); gy++)
        for (let gx = Math.floor((ox - 100) / 96); gx <= Math.floor((ox + size + 100) / 96); gx++) {
            const h = cryptHash(gx, gy, f.seed), x = gx * 96 + h % 71, y = gy * 96 + (h >>> 8) % 71;
            if (h % 3 === 0) {
                const g = c.createRadialGradient(x, y, 5, x, y, 74);
                g.addColorStop(0, h % 2 ? '#152b2d88' : '#151a2399'); g.addColorStop(1, '#152b2d00');
                c.fillStyle = g; c.fillRect(x - 74, y - 74, 148, 148);
                c.strokeStyle = '#9ba79a18'; c.beginPath(); c.ellipse(x, y, 30, 8, -.2, .1, 2.6); c.stroke();
            }
            if (h % 5 === 0) for (let i = 0; i < 7; i++) {
                const dx = ((h >>> i) % 31) - 15, dy = ((h >>> (i + 4)) % 25) - 12;
                c.fillStyle = '#0c111977'; c.fillRect(x + dx, y + dy + 2, 6, 3);
                c.fillStyle = i % 3 ? '#5f6058' : '#a39a7f'; c.fillRect(x + dx, y + dy, 2 + i % 4, 2);
            }
        }
    // Darkness collects at the base of the walls, without obscuring the walkable boundary.
    for (let y = oy; y < oy + size; y += 8) for (let x = ox; x < ox + size; x += 8) {
        const near = [[24, 0], [-24, 0], [0, 24], [0, -24]].some(([dx, dy]) => !openAt(x + 4 + dx, y + 4 + dy));
        if (near) { c.fillStyle = '#080e1850'; c.fillRect(x, y, 8, 8); }
    }
    c.restore();
}
