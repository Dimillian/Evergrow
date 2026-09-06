import { JourneyPanel } from './journey-panel.ts';
import { executeJourneyCommand } from './journey-command.ts';
import type { JourneyCommand } from './journey-state.ts';
import { JourneySearch, reconcileJourneys, journeyNeedsRefresh, type JourneyFacts } from './journey-director.ts';
import { publicJourneyMarker, type JourneyMarker } from './journey-marker.ts';
import { currentDungeon } from './dungeon-state.ts';
import { getZoneAt } from './zone-progression.ts';
import type { Simulation } from './simulation.ts';
import type { World } from './world.ts';
import type { Exploration } from './exploration.ts';
import type { Renderer } from './renderer.ts';
import type { WorldMap } from './world-map.ts';
import type { DungeonMap } from './dungeon-map.ts';
import type { PanelCoordinator } from './panel-coordinator.ts';
import type { GamePhase } from './game-phase.ts';
import type { PersistDungeon } from './dungeon-command.ts';
export interface JourneyHost {
    readonly sim: Simulation;
    readonly overworld: World;
    readonly world: World;
    readonly exploration: Exploration;
    readonly phase: GamePhase;
    readonly savingAction: boolean;
    readonly renderer: Pick<Renderer, 'width' | 'height' | 'extraUIBounds'>;
    readonly panels: Pick<PanelCoordinator, 'canOpen' | 'open' | 'transition'>;
    readonly worldMap: Pick<WorldMap, 'setJourneyMarker' | 'fitBounds'>;
    readonly dungeonMap: Pick<DungeonMap, 'marker'>;
    durable(work: () => Promise<boolean>, fallback: boolean): Promise<boolean>;
    persistTravel: PersistDungeon;
    resume(): void;
}
/** Runtime guidance scheduling and presentation. Rewards remain in source commands/simulation. */
export class JourneyController {
    readonly panel: JourneyPanel;
    private journeySearch: JourneySearch | null = null;
    private journeySearchOwner: unknown = null;
    private journeyCheckedAt = -1;
    selected: string | undefined;
    marker: JourneyMarker | null = null;
    private journeyMapPreview: JourneyMarker | null = null;
    private host: JourneyHost;
    constructor(host: JourneyHost, panelMount: HTMLElement, miniMount: HTMLElement) {
        this.host = host;
        this.panel = new JourneyPanel(panelMount, miniMount, {
            open: id => this.open(id), close: () => host.resume(), command: c => this.command(c), map: id => this.showMap(id),
        });
    }
    dispose() { this.panel.dispose(); }
    private facts(): JourneyFacts {
        const p = this.host.sim.player;
        const area = getZoneAt(p.x, p.y, this.host.overworld.seed);
        return { areaId: area.id, areaLevel: area.level, x: p.x, y: p.y, level: p.level, time: this.host.sim.time, events: this.host.sim.eventState, expeditions: this.host.sim.expeditions,
            discovered: id => { const goal = [...this.host.sim.journeys.accepted, ...this.host.sim.journeys.offers].find(g => g.id === id); return goal?.kind === 'frontier' ? this.host.exploration.isRevealed(goal.x, goal.y) : this.host.exploration.isDiscovered(id); }, campCleared: id => this.host.sim.getCampState(id) === 'cleared' || !!this.host.sim.expeditions.surface?.clearedCamps.includes(id) };
    }
    async command(command: JourneyCommand): Promise<boolean> {
        return this.host.durable(async () => {
            const result = await executeJourneyCommand(this.host.sim, command, c => this.host.persistTravel(c), this.facts());
            if (!result.ok)
                return false;
            this.refreshUI();
            return true;
        }, false);
    }
    open(id?: string) {
        if (this.host.savingAction)
            return;
        if (!this.host.panels.canOpen('journeys'))
            return;
        this.selected = id;
        this.refreshUI();
        this.host.panels.open('journeys');
    }
    private showMap(id: string) {
        if (this.host.savingAction)
            return;
        const goal = [...this.host.sim.journeys.accepted, ...this.host.sim.journeys.offers].find(g => g.id === id);
        if (!goal)
            return;
        this.host.panels.transition('map');
        if (!this.host.sim.dungeonFloor) {
            const target = publicJourneyMarker(goal, this.facts().discovered(goal.id));
            this.journeyMapPreview = target;
            this.host.worldMap.setJourneyMarker(target);
            this.host.worldMap.fitBounds({ x: target.x - 900, y: target.y - 900, width: 1800, height: 1800 });
        }
    }
    update() {
        if (this.host.savingAction)
            return;
        if (this.host.phase === 'ready') {
            this.panel.mini.hidden = true;
            this.host.renderer.extraUIBounds = null;
            this.journeySearch = null;
            this.journeySearchOwner = null;
            return;
        }
        const p = this.host.sim.player, facts = this.facts();
        const safe = this.host.phase === 'playing' && !this.host.sim.dungeonFloor && !p.attack && p.castTime <= 0 && !this.host.sim.eventChannel.site && !this.host.sim.portal.active
            && !this.host.sim.enemies.some(enemy => enemy.hp > 0 && Math.hypot(enemy.x - p.x, enemy.y - p.y) < 550 && ['chase', 'windup', 'attack'].includes(enemy.state));
        if (this.journeySearchOwner !== p.character) {
            this.journeySearchOwner = p.character;
            this.journeySearch = null;
            this.journeyCheckedAt = -1;
        }
        if (this.journeySearch && safe) {
            if (Math.hypot(p.x - this.journeySearch.origin.x, p.y - this.journeySearch.origin.y) > 1200)
                this.journeySearch = null;
            else if (this.journeySearch.step()) {
                const current = this.host.sim.journeys;
                const result = this.journeySearch.result(current, facts);
                this.host.sim.journeys = { ...current, ...result, areaId: facts.areaId, refreshedAt: this.host.sim.time, level: p.level, x: p.x, y: p.y };
                this.journeySearch = null;
            }
        }
        if (this.journeyCheckedAt < 0 || this.host.sim.time - this.journeyCheckedAt >= .5) {
            this.journeyCheckedAt = this.host.sim.time;
            if (this.host.phase === 'playing' && !this.host.sim.dungeonFloor) {
                const towns = this.host.overworld.getSettlements(p.x - 260, p.y - 260, 520, 520);
                const arrivals = [...this.host.sim.journeys.accepted, ...this.host.sim.journeys.offers,
                    ...towns.map(t => ({ id: t.id, kind: 'town' as const, name: t.name, x: t.x, y: t.y, level: getZoneAt(t.x, t.y, this.host.overworld.seed).level, region: getZoneAt(t.x, t.y, this.host.overworld.seed).name }))];
                for (const goal of arrivals)
                    this.host.sim.completeJourneyArrival(goal);
                facts.level = p.level;
            }
            this.host.sim.journeys = reconcileJourneys(this.host.sim.journeys, facts, safe || !!this.host.sim.dungeonFloor && !this.host.sim.enemies.some(e => e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 550));
            const current = this.host.sim.journeys;
            if (safe && !this.journeySearch && journeyNeedsRefresh(current, facts)) {
                this.journeySearch = new JourneySearch(this.host.overworld, facts, this.host.exploration.getDiscoveredPOIs());
            }
            this.refreshUI();
        }
        // Visibility is a phase property, not a simulation timer (menus pause that timer).
        this.panel.mini.hidden = this.host.phase !== 'playing';
        this.host.renderer.extraUIBounds = this.panel.bounds(this.host.renderer.width, this.host.renderer.height);
    }
    refreshUI() {
        const state = this.host.sim.journeys, p = this.host.sim.player, facts = this.facts();
        this.panel.update(state, facts, this.host.phase === 'playing', this.host.renderer.width, this.host.renderer.height);
        const goal = state.accepted.find(g => g.id === state.tracked && g.finishedAt === undefined);
        let marker: JourneyMarker | null = goal ? publicJourneyMarker(goal, this.facts().discovered(goal.id)) : null;
        if (this.host.phase !== 'map')
            this.journeyMapPreview = null;
        const surfaceMarker = marker;
        const run = currentDungeon(this.host.sim.expeditions), floor = this.host.sim.dungeonFloor;
        if (goal && run && floor) {
            if (goal.id !== run.entrance.id)
                marker = { ...floor.entry, known: true, name: 'Exit to the surface' };
            else if (run.explored.includes(12)) {
                const target = run.states.warden?.hp > 0 ? run.states.warden : floor.chests[2];
                marker = { x: target.x, y: target.y, known: true, name: run.states.warden?.hp > 0 ? 'Hollow Warden' : 'Warden’s chest' };
            }
            else {
                const edges = floor.edges.filter(([a, b]) => run.explored.includes(a) !== run.explored.includes(b));
                const choices = edges.map(([a, b]) => { const from = floor.rooms[run.explored.includes(a) ? a : b], to = floor.rooms[run.explored.includes(a) ? b : a]; return { x: (from.x + from.width / 2 + to.x + to.width / 2) / 2, y: (from.y + from.height / 2 + to.y + to.height / 2) / 2 }; });
                const next = choices.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
                marker = next ? { ...next, known: false, name: 'Explore the crypt' } : null;
            }
        }
        else if (marker?.known && goal && goal.kind !== 'town' && goal.kind !== 'frontier' && goal.kind !== 'dungeon') {
            const anchor = this.host.overworld.getEventSites(goal.x - 300, goal.y - 300, 600, 600).find(s => s.id === goal.id);
            if (anchor)
                marker = { ...marker, x: anchor.x, y: anchor.y };
        }
        if (goal && !run && this.host.world.isSanctuary(p.x, p.y)) {
            const back = this.host.sim.travel.returnTo;
            if (back && (back.dungeon === goal.id || !back.dungeon && Math.hypot(back.x - goal.x, back.y - goal.y) + 500 < Math.hypot(p.x - goal.x, p.y - goal.y))) {
                const portal = this.host.overworld.getPortalAnchor(this.host.sim.travel.homeTown);
                marker = { x: portal.x, y: portal.y, known: true, name: 'Return portal' };
            }
        }
        this.host.worldMap.setJourneyMarker(this.journeyMapPreview ?? (run ? surfaceMarker : marker));
        this.marker = marker;
        this.host.dungeonMap.marker = marker;
        this.host.renderer.extraUIBounds = this.panel.bounds(this.host.renderer.width, this.host.renderer.height);
    }
}
