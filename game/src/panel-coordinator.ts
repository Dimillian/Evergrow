import type { GamePhase } from './game-phase.ts';
export type PanelPhase = Exclude<GamePhase, 'ready' | 'playing' | 'paused' | 'dead'>;
export interface PanelLifecycle { open(): void; close(): void; }
export interface PanelHooks {
  clearInput(preserveMovement?: boolean): void; changed(phase: GamePhase): void; resumeGameplay(): void; save(): void;
}
const OPEN_FROM: Record<PanelPhase, readonly GamePhase[]> = {
  console: ['playing','paused'],
  chronicle: ['playing','paused','character'], journeys: ['playing','paused'], event: ['playing'], service: ['playing'], map: ['playing','paused'], character: ['playing','paused', 'character', 'skills'], skills: ['playing','paused', 'character', 'skills'],
};
/** One control-context owner. Panel views own their focus traps; this owner closes
 * the old trap before opening a new view and returns focus only when play resumes. */
export class PanelCoordinator {
  private current: GamePhase = 'ready';
  private holdingMap = false;
  get mapHeld() { return this.holdingMap; }
  get simulationActive() { return this.current === 'playing' || this.current === 'map' && this.holdingMap; }
  holdMap(): boolean {
    if (this.current !== 'playing') return false;
    this.transition('map', false, true); return true;
  }
  releaseMap(): void { if (this.holdingMap) this.resume(); }
  toggleMap(): void {
    if (this.holdingMap) this.transition('map', true);
    else this.toggle('map');
  }
  private chronicleReturn: 'playing'|'paused'|'character' = 'playing';
  private returnToPause = false;
  private mapReturn: 'journeys' | null = null;
  private readonly panels: Record<PanelPhase, PanelLifecycle>;
  private readonly hooks: PanelHooks;
  constructor(panels: Record<PanelPhase, PanelLifecycle>, hooks: PanelHooks) { this.panels = panels; this.hooks = hooks; }
  get phase(): GamePhase { return this.current; }
  get activePanel(): PanelPhase | null { return Object.hasOwn(this.panels, this.current) ? this.current as PanelPhase : null; }
  canOpen(panel: PanelPhase): boolean { return OPEN_FROM[panel].includes(this.holdingMap ? 'playing' : this.current); }
  open(panel: PanelPhase): boolean {
    if (!this.canOpen(panel) || this.current === panel && !this.holdingMap) return false;
    if(panel==='chronicle')this.chronicleReturn=this.current==='paused'?'paused':this.current==='character'?'character':'playing';
    this.transition(panel, true); return true;
  }
  toggle(panel: PanelPhase): boolean { return this.current === panel ? this.resume() : this.open(panel); }
  pause(): boolean {
    if (this.current !== 'playing' && this.current !== 'map') return false;
    this.transition('paused', true); return true;
  }
  resume(): boolean {
    if (this.current !== 'paused' && !this.activePanel) return false;
    const next = this.current === 'map' && this.mapReturn ? this.mapReturn : this.current === 'chronicle' ? this.chronicleReturn : this.current !== 'paused' && this.returnToPause ? 'paused' : 'playing';
    this.transition(next); return true;
  }
  /** Explicit lifecycle changes: character entry, title return and defeat use the same cleanup. */
  transition(next: GamePhase, save = false, holdMap = false): void {
    if (next === 'map' && this.current === 'journeys' && !holdMap) this.mapReturn = 'journeys';
    else if (next !== 'map' || this.current !== 'map') this.mapReturn = null;
    if (this.current === 'paused' && Object.hasOwn(this.panels, next)) this.returnToPause = true;
    if (next === 'playing' || next === 'ready' || next === 'dead') this.returnToPause = false;
    this.hooks.clearInput(this.current === 'playing' && next === 'map' && holdMap
      || this.current === 'map' && this.holdingMap && next === 'playing');
    this.holdingMap = next === 'map' && holdMap;
    const active = this.activePanel;
    if (active) this.panels[active].close();
    this.current = next;
    this.hooks.changed(next);
    const incoming = this.activePanel;
    if (incoming) this.panels[incoming].open();
    if (next === 'playing') this.hooks.resumeGameplay();
    if (save) this.hooks.save();
  }
}
