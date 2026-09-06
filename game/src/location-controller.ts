import { planDungeonTravel, type DungeonAction, type PersistDungeon } from './dungeon-command.ts';
import { executePortalTravel } from './travel-command.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { Simulation } from './simulation.ts';
import type { WorldQuery } from './model.ts';
import type { PortalAnchor } from './travel.ts';
export interface LocationHost {
    simulation(): Simulation;
    surface(): WorldQuery;
    persist: PersistDungeon;
    restoreWorld(checkpoint: CharacterCheckpoint): void;
    arrived(): void;
    notify(message: string): void;
}
/** Called inside the application's durable-action barrier. No world/camera change before persistence. */
export class LocationController {
    private host: LocationHost;
    constructor(host: LocationHost) { this.host = host; }
    async dungeon(action: DungeonAction): Promise<boolean> {
        const host = this.host, sim = host.simulation();
        const result = await planDungeonTravel(sim, action, host.surface(), host.persist);
        if (!result.ok) {
            sim.portal.cancel();
            host.notify(result.message);
            return false;
        }
        host.restoreWorld(result.checkpoint);
        sim.restoreCheckpoint(result.checkpoint);
        sim.relocate(sim.player.x, sim.player.y);
        host.arrived();
        host.notify(result.message);
        return true;
    }
    async portal(anchor: PortalAnchor, returning: boolean): Promise<boolean> {
        const host = this.host, sim = host.simulation();
        if (sim.dungeonFloor || returning && sim.travel.returnTo?.dungeon)
            return this.dungeon(returning ? { kind: 'return', anchor } : { kind: 'town', anchor });
        const result = await executePortalTravel(sim, anchor, returning, host.persist);
        if (!result.ok) {
            host.notify(result.message);
            return false;
        }
        host.arrived();
        return true;
    }
}
