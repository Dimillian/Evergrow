import type { Simulation } from './simulation.ts';
import { currentDungeon, syncDungeon } from './dungeon-state.ts';
import { generateDungeon, dungeonRoomAt, DUNGEON_RULES } from './dungeon.ts';
import { isSpawnHidden, isEnemyInactive, type SpawnExclusion } from './spawn-visibility.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
/** Persistent roster entries are distinct from the bounded live actor set. */
export function updateDungeon(sim: Simulation, view: SpawnExclusion | null): void {
    const run = currentDungeon(sim.expeditions);
    if (!run)
        return;
    syncDungeon(run, sim.enemies, sim.player.x, sim.player.y);
    const floor = sim.dungeonFloor!;
    const room = dungeonRoomAt(floor, sim.player.x, sim.player.y);
    if (room && !run.explored.includes(room.id))
        run.explored.push(room.id);
    if (!view)
        return;
    sim.enemies = sim.enemies.filter(e => e.state === 'dead' || !(Math.hypot(e.x - sim.player.x, e.y - sim.player.y) > 1400 && isEnemyInactive(e) && isSpawnHidden(e.x, e.y, view, e.radius)));
    for (const room of [...floor.rooms].sort((a, b) => Math.hypot(a.x + a.width / 2 - sim.player.x, a.y + a.height / 2 - sim.player.y) - Math.hypot(b.x + b.width / 2 - sim.player.x, b.y + b.height / 2 - sim.player.y))) {
        if (Math.hypot(room.x + room.width / 2 - sim.player.x, room.y + room.height / 2 - sim.player.y) > 2100)
            continue;
        const members = floor.members.filter(m => m.room === room.id && run.states[m.id].hp > 0 && !sim.enemies.some(e => e.campMemberId === m.id) && (!m.wave || run.states.warden.hp > 0 && ((run.states.warden.bossPhases ?? 0) & m.wave)));
        if (!members.length || sim.enemies.filter(e => e.hp > 0).length + members.length > DUNGEON_RULES.liveCap)
            continue;
        if (members.some(m => { const s = run.states[m.id]; return !isSpawnHidden(s.x, s.y, view, ENEMY_DEFINITIONS[m.kind].radius) || sim.world.blocked(s.x, s.y, ENEMY_DEFINITIONS[m.kind].radius); }))
            continue;
        for (const m of members) {
            const s = run.states[m.id], e = sim.spawnEnemy(m.kind, s.x, s.y, m.rank, { campId: run.entrance.id, memberId: m.id, lootSeed: m.seed });
            if (!e)
                throw new Error('Validated dungeon spawn failed');
            e.hp = s.hp;
            e.homeX = m.x;
            e.homeY = m.y;
            e.bossPhases = s.bossPhases ?? 0;
            if (m.wave) {
                e.state = 'chase';
                e.awareness = 1;
                e.lastSeenX = sim.player.x;
                e.lastSeenY = sim.player.y;
                e.lostSightTime = 0;
            }
            s.admitted = true;
        }
    }
}
export function dungeonFromState(sim: Simulation) { const run = currentDungeon(sim.expeditions); return run ? generateDungeon(run.entrance.seed, run.entrance.level) : null; }
