import type { ThorCommand, ThorPanel, ThorTab } from './thor-protocol.ts';
import type { Simulation } from './simulation.ts';
import type { GamePhase } from './game-phase.ts';
export interface ThorCommandHost {
    readonly sim: Pick<Simulation, 'player'>;
    readonly phase: GamePhase;
    readonly session: {
        id: string;
    } | null;
    readonly busy: boolean;
    resume(): void;
    panel(panel: ThorPanel): void;
    equip(index: number): void;
    track(id: string): void;
    portal(): void;
}
/** Second-display commands never trust a bag index or an earlier character snapshot. */
export class ThorCommands {
    readonly selection = { selected: null as string | null, zoom: .085, tab: 'map' as ThorTab };
    private host: ThorCommandHost;
    constructor(host: ThorCommandHost) { this.host = host; }
    reset() { this.selection.selected = null; this.selection.zoom = .085; }
    command(c: ThorCommand) {
        const h = this.host;
        if (c.type === 'tab' && h.session && c.session === h.session.id) { this.selection.tab = c.tab; return; }
        if (!h.session || c.session !== h.session.id || h.busy || h.phase === 'ready' || h.phase === 'dead')
            return;
        switch (c.type) {
            case 'zoom':
                this.selection.zoom = Math.max(.035, Math.min(.25, this.selection.zoom * c.factor));
                return;
            case 'closeInspect':
                this.selection.selected = null;
                return;
            case 'resume':
                this.selection.selected = null;
                h.resume();
                return;
            case 'portal':
                if (h.phase === 'playing')
                    h.portal();
                return;
            case 'panel':
                this.selection.selected = null;
                h.resume();
                h.panel(c.panel);
                return;
            case 'track':
                h.track(c.id);
                return;
            case 'inspect': {
                const sheet = h.sim.player.character;
                if (![...sheet.inventory, ...Object.values(sheet.equipped)].some(item => item?.id === c.id))
                    return;
                this.selection.selected = c.id;
                return;
            }
            case 'equip': {
                if (c.id !== this.selection.selected || (h.phase !== 'playing' && h.phase !== 'paused' && h.phase !== 'character'))
                    return;
                const index = h.sim.player.character.inventory.findIndex(item => item?.id === c.id);
                if (index >= 0)
                    h.equip(index);
            }
        }
    }
}
