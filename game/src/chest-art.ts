import { polygon, line } from './art-primitives.ts';
/** One opening language for surface caches and dungeon treasure. No reward ownership. */
export class ChestArt {
    private states = new Map<string, {
        open: boolean;
        at: number;
    }>();
    draw(c: CanvasRenderingContext2D, id: string, x: number, y: number, open: boolean, time: number, preparation = 0, cursed = false, reduced = false): void {
        let state = this.states.get(id);
        if (!state || state.at > time) {
            state = { open, at: time - 10 };
            this.states.set(id, state);
        }
        if (!open && state.open) {
            state.open = false;
            state.at = time - 10;
        }
        if (open && !state.open) {
            state.open = true;
            state.at = time;
        }
        if (this.states.size > 96)
            this.states.delete(this.states.keys().next().value!);
        const age = time - state.at, t = reduced ? 1 : Math.min(1, age / 1.15), burst = open && age < 1.7 && !reduced;
        const lift = open ? Math.min(1.12, 1 - Math.pow(1 - t, 3) + Math.sin(t * Math.PI * 2) * .12) : preparation * .08;
        const color = cursed ? '#d59be9' : '#f0d18d';
        c.save();
        c.translate(x, y);
        if (preparation && !reduced)
            c.rotate(Math.sin(time * 45) * preparation * .015);
        c.fillStyle = '#0207089a';
        c.beginPath();
        c.ellipse(0, 8, 31, 10, 0, 0, Math.PI * 2);
        c.fill();
        if (burst || preparation) {
            const radius = 45 + Math.max(preparation, 1 - t) * 90, g = c.createRadialGradient(0, -8, 0, 0, -8, radius);
            g.addColorStop(0, color + '95');
            g.addColorStop(.3, color + '35');
            g.addColorStop(1, color + '00');
            c.fillStyle = g;
            c.fillRect(-radius, -radius, radius * 2, radius * 2);
        }
        polygon(c, [[-24, -17], [19, -17], [27, -10], [25, 9], [-22, 9]], '#3c3027');
        polygon(c, [[19, -17], [27, -10], [25, 9], [18, 4]], '#211f22');
        for (let i = 0; i < 3; i++)
            line(c, [[-21, -11 + i * 7], [18, -11 + i * 7]], '#806344', 1);
        polygon(c, [[-22, -17], [18, -17], [24, -11], [-19, -10]], open ? '#100f18' : '#65513a');
        for (const side of [-1, 1]) {
            c.fillStyle = '#8f927c';
            c.fillRect(side * 14 - 2, -15, 4, 22);
            for (const h of [-10, 2]) {
                c.fillStyle = '#d1cba3';
                c.fillRect(side * 14 - 1, h, 2, 2);
            }
        }
        c.save();
        c.translate(0, -17);
        c.scale(1, 1 - lift * 1.85);
        polygon(c, [[-25, 1], [-24, -9], [-17, -15], [17, -15], [24, -8], [25, 1]], '#68543c');
        polygon(c, [[-24, -9], [-17, -15], [17, -15], [24, -8]], '#9a835c');
        line(c, [[-25, 1], [-24, -9], [-17, -15], [17, -15], [24, -8], [25, 1]], '#c5b78b', 1);
        for (const side of [-1, 1]) {
            c.fillStyle = '#a6a990';
            c.fillRect(side * 14 - 2, -14, 4, 15);
        }
        c.restore();
        if (!open) {
            c.fillStyle = color;
            c.fillRect(-4, -12, 8, 10);
            c.fillStyle = '#253036';
            c.fillRect(-1, -9, 2, 4);
        }
        if (cursed && !open) {
            for (const side of [-1, 1])
                line(c, [[side * 24, -17], [-side * 22, 7]], '#b090b9', 2);
        }
        if (burst) {
            c.strokeStyle = color;
            c.globalAlpha = Math.max(0, 1 - age / 1.7) * .6;
            c.lineWidth = 1.5;
            c.beginPath();
            c.ellipse(0, 5, 30 + age * 90, 10 + age * 28, 0, 0, Math.PI * 2);
            c.stroke();
            for (let i = 0; i < 24; i++) {
                const a = i * 2.4, travel = age * (38 + (i % 5) * 12);
                c.globalAlpha = Math.max(0, 1 - age / 1.7);
                c.fillStyle = i % 3 ? color : '#fff4ca';
                c.fillRect(Math.cos(a) * travel, -14 - Math.sin(age / 1.7 * Math.PI) * (30 + i % 7 * 8) + Math.sin(a) * travel * .35, 1.5, 3);
            }
        }
        c.restore();
    }
}
