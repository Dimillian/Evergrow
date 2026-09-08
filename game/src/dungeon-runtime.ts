import { encounterApproaches } from './encounter-approaches.ts';
import { advanceDungeonEvents } from './dungeon-events.ts';
import type { CombatEvent } from './model.ts';
import type { Simulation } from './simulation.ts';
import { currentDungeon, syncDungeon, dungeonMemberLevel } from './dungeon-state.ts';
import { generateDungeon, dungeonRoomAt } from './dungeon.ts';
import { isSpawnHidden, isEnemyInactive, type SpawnExclusion } from './spawn-visibility.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
const admissions = new WeakMap<Simulation, { run:object; at:number }>();
/** Persistent room rosters stream by proximity without an actor-count ceiling. */
export function updateDungeon(sim: Simulation, view: SpawnExclusion | null, dt=1/120, emit: (event:CombatEvent)=>void = ()=>{}): void {
    const run = currentDungeon(sim.expeditions);
    if (!run)
        return;
    syncDungeon(run, sim.enemies, sim.player.x, sim.player.y);
    const floor = sim.dungeonFloor!;
    advanceDungeonEvents(sim,dt,emit);
    const room = dungeonRoomAt(floor, sim.player.x, sim.player.y);
    if (room && !run.explored.includes(room.id))
        run.explored.push(room.id);
    if (!view) return;
    const last=admissions.get(sim);
    const admitEvents=!last||last.run!==run||sim.time<last.at||sim.time-last.at>=.5;
    if(admitEvents)admissions.set(sim,{run,at:sim.time});
    sim.enemies = sim.enemies.filter(e => e.state === 'dead' || !(Math.hypot(e.x - sim.player.x, e.y - sim.player.y) > 1400 && isEnemyInactive(e) && isSpawnHidden(e.x, e.y, view, e.radius)));
    for (const room of [...floor.rooms].sort((a, b) => Math.hypot(a.x + a.width / 2 - sim.player.x, a.y + a.height / 2 - sim.player.y) - Math.hypot(b.x + b.width / 2 - sim.player.x, b.y + b.height / 2 - sim.player.y))) {
        if (Math.hypot(room.x + room.width / 2 - sim.player.x, room.y + room.height / 2 - sim.player.y) > 2100)
            continue;
        const members = floor.members.filter(m => m.room === room.id && run.states[m.id].hp > 0 && !sim.enemies.some(e => e.campMemberId === m.id) && (m.event===undefined || !!run.events?.[m.event]?.started && !run.events[m.event].finished && run.events[m.event].rest<=0 && run.events[m.event].wave===m.eventWave) && (!m.wave || run.states.warden.hp > 0 && ((run.states.warden.bossPhases ?? 0) & m.wave)));
        if (!members.length)
            continue;
        const event=floor.events?.find(e=>e.room===room.id);
        if(event&&!admitEvents)continue;
        const eventNear=event&&Math.hypot(sim.player.x-event.x,sim.player.y-event.y)<650;
        const approaches=eventNear?encounterApproaches(sim.world,view,sim.player,event,Math.max(...members.map(m=>ENEMY_DEFINITIONS[m.kind].radius))+2):[];
        if(event&&!eventNear)continue;
        for (const m of members) {
            const s = run.states[m.id];
            const radius=ENEMY_DEFINITIONS[m.kind].radius;
            if(event&&!s.admitted){
                const point=approaches.find(p=>sim.enemies.every(e=>e.hp<=0||Math.hypot(e.x-p.x,e.y-p.y)>e.radius+radius+10));
                if(!point)continue;s.x=point.x;s.y=point.y;
            }
            if(!isSpawnHidden(s.x,s.y,view,radius)||sim.world.blocked(s.x,s.y,radius))continue;
            const e = sim.spawnEnemy(m.kind, s.x, s.y, m.rank, { campId: run.entrance.id, memberId: m.id, lootSeed: m.seed, level: dungeonMemberLevel(run.entrance, m) });
            if (!e)
                throw new Error('Validated dungeon spawn failed');
            e.hp = s.hp;
            e.homeX = event?.x ?? m.x;
            e.homeY = event?.y ?? m.y;
            e.bossPhases = s.bossPhases ?? 0;
            if (m.wave || event) {
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
