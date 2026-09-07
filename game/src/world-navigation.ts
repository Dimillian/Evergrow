import type { WorldQuery } from './model.ts';
interface Field {
    queue: {
        x: number;
        y: number;
    }[];
    cursor: number;
    steps: Map<string, {
        x: number;
        y: number;
    }>;
}
/** Incremental local flow fields share obstacle detours among a pursuing pack. */
export class WorldNavigation {
    private fields = new Map<string, Field>();
    private world: Pick<WorldQuery, 'blocked'>;
    constructor(world: Pick<WorldQuery, 'blocked'>) { this.world = world; }
    target(x: number, y: number, tx: number, ty: number): {
        x: number;
        y: number;
    } {
        const cell = 48, gx = Math.round(tx / cell), gy = Math.round(ty / cell), key = `${gx}:${gy}`, sx = Math.round(x / cell), sy = Math.round(y / cell);
        if (this.world.blocked(gx * cell, gy * cell, 24))
            return { x, y };
        let field = this.fields.get(key);
        if (!field) {
            field = { queue: [{ x: gx, y: gy }], cursor: 0, steps: new Map([[key, { x: tx, y: ty }]]) };
            this.fields.set(key, field);
            if (this.fields.size > 4)
                this.fields.delete(this.fields.keys().next().value!);
        }
        const sourceKey=`${sx}:${sy}`,known=field.steps.get(sourceKey);
        if(known)return known;
        for (let work = 0; work < 128 && !field.steps.has(sourceKey) && field.cursor < field.queue.length && field.steps.size < 6400; work++) {
            const p = field.queue[field.cursor++];
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = p.x + dx, ny = p.y + dy, k = `${nx}:${ny}`;
                if (Math.abs(nx - gx) > 38 || Math.abs(ny - gy) > 38 || field.steps.has(k) || this.world.blocked(nx * cell, ny * cell, 26) || this.world.blocked((nx + p.x) * cell / 2, (ny + p.y) * cell / 2, 26))
                    continue;
                field.steps.set(k, { x: p.x * cell, y: p.y * cell });
                field.queue.push({ x: nx, y: ny });
            }
        }
        return field.steps.get(sourceKey) ?? { x, y };
    }
}
