import { ThorCommands } from './thor-commands.ts';
import { ThorNative } from './thor-native.ts';
import { thorSnapshot } from './thor-state.ts';
import type { ThorPanel } from './thor-protocol.ts';
import type { Simulation } from './simulation.ts';
import type { WorldMap } from './world-map.ts';
import type { GamePhase } from './game-phase.ts';
import { currentDungeon } from './dungeon-state.ts';
import { drawDungeonMap } from './dungeon-map.ts';
import { getZoneAt } from './zone-progression.ts';
export interface ThorRuntimeHost {
    readonly sim: Simulation;
    readonly phase: GamePhase;
    readonly session: {
        id: string;
        name: string;
    } | null;
    readonly busy: boolean;
    readonly worldMap: WorldMap;
    readonly seed: number;
    resume(): void;
    panel(panel: ThorPanel): void;
    equip(index: number): void;
    track(id: string): void;
    portal(): void;
    background(): void;
    foreground(): void;
    back(): void;
}
/** The lower screen owns presentation only. Every action returns to the primary command boundary. */
export class ThorRuntime {
    private bridge: ThorNative;
    private canvas: HTMLCanvasElement | null = null;
    private commands: ThorCommands;
    private session = '';
    private host: ThorRuntimeHost;
    constructor(host: ThorRuntimeHost) {
        this.host = host;
        this.commands = new ThorCommands(host);
        this.bridge = new ThorNative({ snapshot: map => this.snapshot(map), command: c => this.commands.command(c),
            background: () => host.background(), foreground: () => host.foreground(), back: () => host.back() });
    }
    private snapshot(map: boolean) {
        const h = this.host, session = h.phase === 'ready' ? '' : h.session?.id ?? '';
        if (session !== this.session) {
            this.session = session;
            this.commands.reset();
        }
        if (h.phase === 'dead') this.commands.selection.selected = null;
        const p = h.sim.player, run = currentDungeon(h.sim.expeditions);
        const zone = run?.entrance ?? getZoneAt(p.x, p.y, h.seed);
        const state = thorSnapshot(h.sim, session, h.session?.name ?? '', h.phase, zone.name, zone.level, this.commands.selection.selected);
        if (map && session && this.commands.selection.tab === 'map' && !state.detail) {
            this.canvas ??= document.createElement('canvas');
            if (this.canvas.width !== 512) {
                this.canvas.width = 512;
                this.canvas.height = 380;
            }
            const c = this.canvas.getContext('2d')!;
            c.clearRect(0, 0, 512, 380);
            if (run && h.sim.dungeonFloor)
                drawDungeonMap(c, h.sim.dungeonFloor, run, p, { x: 0, y: 0, width: 512, height: 380 }, this.commands.selection.zoom, p.x, p.y);
            else
                h.worldMap.drawCompanion(c, p, 512, 380, this.commands.selection.zoom);
            state.map = this.canvas.toDataURL('image/png');
        }
        return state;
    }
    dismissInspection(): boolean {
        if (!this.commands.selection.selected)
            return false;
        this.commands.selection.selected = null;
        return true;
    }
    update(now: number) { this.bridge.update(now); }
    dispose() { this.bridge.dispose(); this.canvas = null; }
}
