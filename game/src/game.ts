import { DungeonWorld } from './dungeon-world.ts';
import { generateDungeon, type DungeonEntrance } from './dungeon.ts';
import { currentDungeon } from './dungeon-state.ts';
import { planDungeonTravel, claimDungeonChest, dungeonChestProblem, type DungeonAction } from './dungeon-command.ts';
import { DungeonMap, drawCryptMinimap } from './dungeon-map.ts';
import { EventPanel } from './poi-panel.ts';
import { focusEvent, eventLabel, isEventKind, type EventSite, type EventChoice } from './poi-content.ts';
import { executeEvent, eventProblem } from './poi-command.ts';
import { executePortalTravel, activatePortalAnchor } from './travel-command.ts';
import { townPortalAnchor, withinPortalReach, portalMapMarkers, type PortalAnchor } from './travel.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import { ServicePanel } from './service-panel.ts';
import { buildingNPC, focusNPC, canInteractNPC, type TownNPC } from './npcs.ts';
import type { ServiceQuote } from './commerce.ts';
import { executeService } from './commerce-command.ts';
import { PanelCoordinator } from './panel-coordinator.ts';
import { bindGameKeyboard } from './game-keyboard.ts';
import { createCharacterSheet, type StarterLoadoutId } from './items.ts';
import { refreshCharacter } from './character.ts';
import { AreaNoticeTracker } from './notification-queue.ts';
import { getZoneAt } from './zone-progression.ts';
import { CharacterRepository } from './character-storage.ts';
import { CharacterSession } from './character-session.ts';
import { TitleScreen } from './title-screen.ts';
import { InventoryPanel } from './inventory-panel.ts';
import { SkillTreePanel } from './skill-tree-panel.ts';
import { executeCharacterCommand, type CharacterCommand } from './character-commands.ts';
import { Lifetime } from './lifetime.ts';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { GameAudio } from './audio.ts';
import { Exploration } from './exploration.ts';
import { WorldMap } from './world-map.ts';
import { GameInput } from './game-input.ts';
import { GamepadInput, PAD } from './gamepad-input.ts';
import { GamepadMenu } from './gamepad-menu.ts';
import { GameShell } from './game-shell.ts';
import { isGameUIPoint } from './ui-hit-test.ts';
import type { GamePhase } from './game-phase.ts';
import type { Input } from './model.ts';

/** Coordinates browser lifecycle, simulation and presentation; system rules live in their owners. */
export class Game {
  private lifetime = new Lifetime();
  readonly overworld = this.lifetime.own(new World(7319));
  world: World = this.overworld;
  private dungeonMap: DungeonMap;
  private activeDungeonEntrance: DungeonEntrance | null = null;
  sim = new Simulation(this.world, { seed: 7319 });
  renderer: Renderer;
  audio: GameAudio;
  private exploration: Exploration;
  private titleScreen: TitleScreen;
  private session: CharacterSession;
  private nextAutosave = 0;
  private areaNotices = new AreaNoticeTracker();
  private saveError = '';
  private worldMap: WorldMap;
  private shell: GameShell;
  private inventoryPanel: InventoryPanel;
  private skillPanel: SkillTreePanel;
  private servicePanel: ServicePanel;
  private eventPanel: EventPanel;
  private activeEvent: EventSite | null = null;
  private projectedBeacons = new Set<string>();
  private activeNPC: TownNPC | null = null;
  readonly canvas: HTMLCanvasElement;
  private uiCanvas: HTMLCanvasElement;
  private uiContext: CanvasRenderingContext2D;
  fx: PostFX;
  private panels: PanelCoordinator;
  get phase(): GamePhase { return this.panels?.phase ?? 'ready'; }
  private muted = false;
  private readonly motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  private get reducedMotion() { return this.motionPreference.matches; }
  private input = new GameInput();
  private gamepad = new GamepadInput();
  private gamepadMenu = new GamepadMenu();
  private usingGamepad = false;
  private padAimAngle: number | null = null;
  private padAimDistance = 180;
  private mouse = this.input.pointer;
  private last = performance.now();
  private animation = 0;
  private fps = 60;
  private abort = new AbortController();
  private debug = false;
  private disposed = false;

  constructor(root: HTMLElement) {
    this.lifetime.defer(() => this.abort.abort());
    this.lifetime.defer(() => cancelAnimationFrame(this.animation));
    this.lifetime.defer(() => { if(this.world !== this.overworld) this.world.dispose(); });
    try {
      this.renderer = new Renderer();
      this.audio = this.lifetime.own(new GameAudio());
      this.exploration = new Exploration(this.world, { storage: null });
      this.lifetime.defer(() => this.exploration.dispose());
      let storage: Storage | null = null;
      try { storage = localStorage; } catch { /* The title screen explains unavailable storage. */ }
      const repository = new CharacterRepository(storage);
      for (const slot of repository.list()) if (slot.state === 'invalid' || slot.record && slot.record.worldVersion < this.world.generationVersion)
        repository.remove(slot.index, slot.token);
      this.session = new CharacterSession(repository, this.world.seed, this.world.generationVersion);
      this.shell = this.lifetime.own(new GameShell(root, {
        play: () => this.phase === 'paused' ? this.resume() : this.start(),
        portal: () => { this.canvas.focus(); this.requestPortal(); },
        returnToTitle: () => this.returnToTitle(), openMap: () => this.openMap(),
        openCharacter: () => this.openCharacterPanel('character'), openSkills: () => this.openCharacterPanel('skills'),
      }));
      this.canvas = this.shell.canvas;
      this.uiCanvas = this.shell.uiCanvas;
      const uiContext = this.uiCanvas.getContext('2d');
      if (!uiContext) throw new Error('The HUD requires a 2D canvas context.');
      this.uiContext = uiContext;
      this.worldMap = new WorldMap(this.overworld, this.exploration, this.shell.mapMount, () => this.closeMap());
      this.lifetime.defer(() => this.worldMap.dispose());
      this.worldMap.setCampStateReader(id => this.sim.getCampState(id));
    this.worldMap.setEventStateReader(poi => { if(poi.kind==='dungeon'){const run=this.sim.expeditions.runs.find(r=>r.entrance.id===poi.id);return run?(run.states.warden.hp<=0?'Cleared':'Expedition active'):null;} const record = this.sim.eventState.sites[poi.id]; return isEventKind(poi.kind) ? eventLabel(record ?? { id: poi.id, kind: poi.kind }, this.sim.eventState, this.sim.getCampState(poi.id) === 'cleared') : null; });
    this.worldMap.setPortalMarkers(() => portalMapMarkers(this.sim.travel, band => this.overworld.getPortalAnchor(band)));
      this.inventoryPanel = this.lifetime.own(new InventoryPanel(this.shell.panelMount, {
        close: () => this.closeCharacterPanel(),
        equip: (index, slot) => this.characterAction({ type: 'equip', index, slot }),
        unequip: (slot, index) => this.characterAction({ type: 'unequip', slot, index }),
        move: (from, to) => this.characterAction({ type: 'moveItem', from, to }),
        allocate: attribute => this.characterAction({ type: 'allocateAttribute', attribute }),
      }));
      this.skillPanel = this.lifetime.own(new SkillTreePanel(this.shell.panelMount, {
        develop: command => this.characterAction(command),
        close: () => this.closeCharacterPanel(),
        allocate: id => this.characterAction({ type: 'allocateNode', id }),
        assign: (slot, skill) => this.characterAction({ type: 'assignSkill', slot, skill }),
      }));
      this.titleScreen = this.lifetime.own(new TitleScreen(this.shell.titleMount, {
        create: (index, name, weapon) => this.createCharacter(index, name, weapon),
        continue: index => this.continueCharacter(index), remove: index => this.deleteCharacter(index),
      }));
      this.servicePanel = this.lifetime.own(new ServicePanel(this.shell.panelMount, {
        close: () => this.resume(), trade: quote => this.trade(quote),
      }));
      this.dungeonMap = this.lifetime.own(new DungeonMap(this.shell.mapMount,()=>this.closeMap(),()=>this.worldMap.open({x:this.sim.expeditions.surfaceX,y:this.sim.expeditions.surfaceY,angle:0})));
      this.eventPanel = this.lifetime.own(new EventPanel(this.shell.panelMount, {
        enter: entrance => { this.resume(); this.switchDungeon({kind:'enter',entrance}); },
        close: () => this.resume(), choose: (site, choice) => { this.resume(); this.startEvent(site, choice); },
      }));
      this.panels = new PanelCoordinator({
        event: { open: () => { if(this.activeDungeonEntrance) this.eventPanel.openDungeon(this.activeDungeonEntrance); else if (this.activeEvent) this.eventPanel.open(this.activeEvent); }, close: () => { this.eventPanel.close(); this.activeEvent = null; this.activeDungeonEntrance = null; } },
        service: { open: () => { if (this.activeNPC) this.servicePanel.open(this.sim.player, this.activeNPC); }, close: () => { this.servicePanel.close(); this.activeNPC = null; } },
        map: { open: () => { const run=currentDungeon(this.sim.expeditions); if(run) this.dungeonMap.open(this.sim.dungeonFloor!,run,this.sim.player); else this.worldMap.open(this.sim.player); this.shell.setStatus('World map open. Game paused.'); }, close: () => { this.worldMap.close(); this.dungeonMap.close(); } },
        character: { open: () => { this.inventoryPanel.open(this.sim.player); this.shell.setStatus('Character and inventory open. Game paused.'); }, close: () => this.inventoryPanel.close() },
        skills: { open: () => { this.skillPanel.open(this.sim.player); this.shell.setStatus('Skill tree open. Game paused.'); }, close: () => this.skillPanel.close() },
      }, {
        clearInput: () => this.clearInput(), changed: () => this.showMenu(),
        resumeGameplay: () => { this.canvas.focus(); this.last = performance.now(); },
        save: () => { this.saveCharacter(); },
      });
      this.fx = this.lifetime.own(new PostFX(this.canvas));
      try {
        const saved = JSON.parse(localStorage.getItem('evergrow-preferences') ?? 'null');
        if (typeof saved?.muted === 'boolean') this.muted = saved.muted;
      } catch { /* Preferences are optional when storage is disabled. */ }
      // Presentation is fixed and motion follows the OS.
      this.savePreferences();
      this.audio.setEnabled(!this.muted);
      this.resize();
      this.bind();
      this.showMenu();
      this.titleScreen.open(this.session.repository.list());
      this.animation = requestAnimationFrame(this.frame);
    } catch (error) {
      try { this.lifetime.dispose(); } catch (cleanupError) { console.error(cleanupError); }
      throw error;
    }
  }

  private bind() {
    const signal = this.abort.signal;
    window.addEventListener('pagehide', () => { this.clearInput(); this.saveCharacter(); }, { signal });
    window.addEventListener('focus', () => this.clearInput(), { signal });
    this.canvas.addEventListener('blur', () => this.clearInput(), { signal });
    window.addEventListener('resize', () => this.resize(), { signal });
    window.addEventListener('blur', () => {
      this.mouse.present = false;
      this.clearInput();
      if (this.phase === 'playing') this.pause();
    }, { signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clearInput();
        if (this.phase === 'playing') this.pause();
        else this.saveCharacter();
      }
      this.last = performance.now();
    }, { signal });
    bindGameKeyboard(window, {
      clear: () => this.clearInput(),
      release: code => this.input.keyUp(code),
      press: event => {
        if (event.isTrusted) this.usingGamepad = false;
        if (event.code === 'Escape') {
          event.preventDefault();
          if (!event.repeat) {
            if (this.sim.portal.active) { this.sim.portal.cancel(); return; }
            if (this.panels.activePanel) this.resume();
            else if (this.phase === 'playing') this.pause();
            else if (this.phase === 'paused') this.resume();
          }
          return;
        }
        const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
          || event.target instanceof HTMLSelectElement || (event.target instanceof HTMLElement && event.target.isContentEditable);
        if (!typing && ['KeyC', 'KeyI', 'KeyT'].includes(event.code)
          && this.panels.canOpen(event.code === 'KeyT' ? 'skills' : 'character')) {
          event.preventDefault();
          if (!event.repeat) {
            const panel = event.code === 'KeyT' ? 'skills' : 'character';
            this.panels.toggle(panel);
          }
          return;
        }
        if (typing) return;
        if (event.code === 'KeyM' && (this.panels.canOpen('map') || this.phase === 'map')) {
          event.preventDefault();
          if (!event.repeat) this.panels.toggle('map');
          return;
        }
        if (event.code === 'Tab' && this.phase === 'playing') {
          event.preventDefault();
          if (!event.repeat) this.openMap();
          return;
        }
        if (event.code === 'KeyN') {
          if (!event.repeat) this.toggleSound();
          return;
        }
        // Native menu controls retain their ordinary keyboard behavior.
        if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement
          || event.target instanceof HTMLButtonElement) return;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
        if (event.repeat) return;
        if (event.code === 'Enter' && (this.phase === 'dead' || this.phase === 'paused')) {
          event.preventDefault();
          this.phase === 'paused' ? this.resume() : this.start();
          return;
        }
        if (event.code === 'F3') { event.preventDefault(); this.debug = !this.debug; return; }
        if (event.code === 'KeyR' && this.phase === 'dead') { this.start(); return; }
        if (this.phase !== 'playing') return;
        if (event.code === 'KeyP') { event.preventDefault(); this.requestPortal(); return; }
        if (event.code === 'KeyE') { event.preventDefault(); this.interact(); return; }
        this.input.keyDown(event.code);
      },
    }, signal);
    // Window-level tracking also follows the pointer across the DOM HUD buttons.
    window.addEventListener('pointermove', event => this.updatePointer(event), { signal });
    this.canvas.addEventListener('pointerleave', () => { this.mouse.present = false; }, { signal });
    this.canvas.addEventListener('wheel', event => {
      if (this.phase !== 'playing' || event.ctrlKey || event.metaKey) return;
      this.updatePointer(event);
      if (this.pointerInHUD()) return;
      event.preventDefault();
      this.renderer.zoomByWheel(event.deltaY, event.deltaMode, this.canvas.getBoundingClientRect().height);
    }, { signal, passive: false });
    this.canvas.addEventListener('pointerdown', event => {
      if (this.phase !== 'playing') return;
      event.preventDefault();
      this.updatePointer(event);
      if (this.pointerInHUD()) return;
      if (event.button === 0 && this.interact(this.renderer.screenToWorld(this.mouse.x, this.mouse.y))) return;
      this.canvas.focus();
      this.canvas.setPointerCapture(event.pointerId);
      this.input.pointerDown(event.button);
      void this.audio.unlock().catch(() => this.notify('Sound is unavailable in this browser.'));
    }, { signal });
    window.addEventListener('pointerup', event => {
      this.input.pointerUp(event.button);
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    }, { signal });
    this.canvas.addEventListener('pointercancel', () => this.clearInput(), { signal });
  }

  private updatePointer(event: { clientX: number; clientY: number }) {
    this.usingGamepad = false;
    this.input.movePointer(event.clientX, event.clientY, this.canvas.getBoundingClientRect(),
      this.renderer.width, this.renderer.height);
    this.canvas.classList.toggle('hud-hover', this.pointerInHUD());
    this.worldMap.setMinimapPointer({ x: this.mouse.x, y: this.mouse.y });
  }

  private pointerInHUD() {
    return isGameUIPoint(this.mouse.x, this.mouse.y, this.renderer.width, this.renderer.height);
  }

  private resize() {
    const width = window.innerWidth, height = window.innerHeight;
    const ratio = Math.min(1.6, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    // UI is rasterized at the display's native density, independently of the world buffer.
    const uiRatio = window.devicePixelRatio || 1;
    this.uiCanvas.width = Math.round(width * uiRatio);
    this.uiCanvas.height = Math.round(height * uiRatio);
    const logicalHeight = Math.min(680, Math.max(450, Math.round(height / 1.35)));
    this.renderer.resize(Math.max(540, Math.round(logicalHeight * width / height)), logicalHeight);
    this.sim.setSpawnExclusion(this.renderer.spawnExclusionBounds(this.sim.player));
    this.mouse.x = this.renderer.width * 0.6;
    this.mouse.y = this.renderer.height * 0.43;
    this.shell.resizeControls(this.renderer.width, this.renderer.height);
    this.worldMap.resize();
  }

  clearInput() {
    this.input.clear();
    this.gamepad.clear(); this.gamepadMenu.clear();
    this.sim.clearInput();
  }

  /** Defeat recovery keeps the character, allocations and loot; it never creates a new run. */
  start() {
    if (this.disposed || this.phase !== 'dead' || !this.session.active) return;
    if(this.sim.dungeonFloor && !this.switchDungeon({kind:'death'})) return;
    this.sim.revive(); this.enterWorld(); this.saveCharacter();
  }

  private createCharacter(index: number, name: string, weapon: StarterLoadoutId) {
    if (this.phase !== 'ready') return;
    const fresh = new Simulation(this.world, { seed: this.world.seed, spawn: false });
    fresh.player.character = createCharacterSheet(weapon); refreshCharacter(fresh.player);
    fresh.player.hp = fresh.player.maxHp; fresh.player.mana = fresh.player.maxMana;
    if (!this.session.create(index, name, fresh.captureCheckpoint(), crypto.randomUUID(), Date.now())) {
      this.titleScreen.message(this.session.error); return;
    }
    this.continueCharacter(index);
  }

  private continueCharacter(index: number) {
    if (this.phase !== 'ready') return;
    const record = this.session.load(index);
    if (!record) { this.titleScreen.message(this.session.error); return; }
    this.setLocationWorld(record.checkpoint);
    this.sim.restoreCheckpoint(record.checkpoint);
    this.projectedBeacons.clear();
    if (this.sim.player.dead) { if(this.sim.dungeonFloor && !this.switchDungeon({kind:'death'})) return; this.sim.revive(); }
    this.sim.player.name = record.name;
    this.worldMap.dispose(); this.exploration.dispose();
    this.exploration = new Exploration(this.overworld, { characterId: record.id,
      onDiscover: poi => {
        // Shops share their settlement announcement; landmarks deserve their own.
        if (!['blacksmith', 'merchant', 'inn', 'chapel', 'jeweler', 'enchanter'].includes(poi.kind))
          this.shell.notifications.push({ kind: 'discovery', poi });
      },
    });
    this.worldMap = new WorldMap(this.overworld, this.exploration, this.shell.mapMount, () => this.closeMap());
    this.worldMap.setCampStateReader(id => this.sim.getCampState(id));
    this.worldMap.setEventStateReader(poi => { if(poi.kind==='dungeon'){const run=this.sim.expeditions.runs.find(r=>r.entrance.id===poi.id);return run?(run.states.warden.hp<=0?'Cleared':'Expedition active'):null;} const record = this.sim.eventState.sites[poi.id]; return isEventKind(poi.kind) ? eventLabel(record ?? { id: poi.id, kind: poi.kind }, this.sim.eventState, this.sim.getCampState(poi.id) === 'cleared') : null; });
    this.worldMap.setPortalMarkers(() => portalMapMarkers(this.sim.travel, band => this.overworld.getPortalAnchor(band)));
    this.worldMap.resize(); this.titleScreen.close(); this.saveError = '';
    this.projectBeacons(); this.enterWorld(); this.saveCharacter();
  }

  private deleteCharacter(index: number) {
    if (this.phase !== 'ready') return;
    const slot = this.session.repository.read(index);
    const result = this.session.repository.remove(index, slot.token);
    if (!result.ok) { this.titleScreen.message(result.message); return; }
    if (slot.record) {
      try { localStorage.removeItem(`evergrow:exploration:1:${slot.record.worldVersion}:${slot.record.worldSeed}:${slot.record.id}`); } catch { /* Character deletion already committed; chart cleanup is best effort. */ }
    }
    this.shell.notifications.clear();
    this.titleScreen.open(this.session.repository.list(), index);
  }

  private enterWorld() {
    this.shell.notifications.clear();
    this.areaNotices.reset(getZoneAt(this.sim.player.x, this.sim.player.y, this.world.seed).id);
    this.sim.player.name = this.session.active?.record.name;
    this.renderer.reset();
    this.renderer.snapTo(this.sim.player);
    this.sim.setSpawnExclusion(this.renderer.spawnExclusionBounds(this.sim.player));
    this.panels.transition('playing');
    void this.audio.unlock().catch(() => this.notify('Sound is unavailable in this browser.'));
    this.audio.setEnabled(!this.muted); this.last = performance.now(); this.nextAutosave = this.last + 10_000;
  }

  private saveCharacter(): boolean {
    if (!this.session?.active) return true;
    const saved = this.session.save(this.sim.captureCheckpoint(), Date.now());
    const message = saved ? '' : this.session.error;
    if (message && message !== this.saveError) this.notify(message);
    this.saveError = message;
    this.shell.setSaveStatus(message || 'Character saved locally.', !saved);
    this.exploration.save();
    return saved;
  }

  private returnToTitle() {
    if (!this.session.active || !this.saveCharacter()) return;
    const index = this.session.active.index;
    this.session.active = null;
    this.shell.notifications.clear();
    if(this.world!==this.overworld)this.world.dispose(); this.world=this.overworld;this.sim.world=this.world;
    this.sim.reset(); this.renderer.reset();
    this.panels.transition('ready'); this.titleScreen.open(this.session.repository.list(), index);
  }

  pause() { if (!this.disposed) this.panels.pause(); }

  resume() { if (!this.disposed) this.panels.resume(); }

  private openMap() { this.panels.open('map'); }

  private closeMap() { if (this.phase === 'map') this.resume(); }

  private openCharacterPanel(panel: 'character' | 'skills') { this.panels.open(panel); }

  private closeCharacterPanel() {
    if (this.phase === 'character' || this.phase === 'skills') this.resume();
  }

  private interact(pointer?: {
      x: number;
      y: number;
  }): boolean {
      if (this.phase !== 'playing')
          return false;
      const p = this.sim.player;
      const run = currentDungeon(this.sim.expeditions);
      if (run) {
          const f = this.sim.dungeonFloor!, hit = (q: {
              x: number;
              y: number;
          }) => Math.hypot(p.x - q.x, p.y - q.y) < 75 && (!pointer || Math.hypot(pointer.x - q.x, pointer.y - (q.y - 20)) < 55);
          const chest = f.chests.findIndex(hit);
          if (chest >= 0) {
              const problem = dungeonChestProblem(this.sim, chest);
              if (problem)
                  this.notify(problem);
              else {
                  this.sim.clearInput();
                  this.sim.portal.cancel();
                  this.sim.eventChannel.start({ ...f.chests[chest], kind: 'cryptChest', name: 'Crypt chest', index: chest }, null);
              }
              return true;
          }
          if (hit(f.entry) || (run.states.warden.hp <= 0 && hit(f.exit))) {
              this.switchDungeon({ kind: 'exit' });
              return true;
          }
          return false;
      }
      const entrance = this.overworld.getDungeonEntrances(p.x - 80, p.y - 80, 160, 160).find(e => Math.hypot(e.x - p.x, e.y - p.y) < 75 && (!pointer || Math.hypot(pointer.x - e.x, pointer.y - (e.y - 20)) < 55));
      if (entrance) {
          this.activeDungeonEntrance = entrance;
          this.panels.open('event');
          return true;
      }
      const anchor = this.nearbyAnchor(pointer);
      if (anchor) {
          if (this.sim.travel.returnTo?.town === anchor.band)
              this.travelThrough(anchor, true);
          else {
              const result = activatePortalAnchor(this.sim, anchor, c => this.persistTravel(c));
              this.notify(result.message);
          }
          return true;
      }
      const npcs = this.world.getBuildings(p.x - 220, p.y - 220, 440, 440).map(buildingNPC).filter((npc): npc is TownNPC => npc !== null);
      const npc = focusNPC(npcs, p, this.world, pointer);
      if (!npc) {
          const site = focusEvent(this.world.getEventSites(p.x - 100, p.y - 100, 200, 200), p, this.world, pointer);
          if (!site)
              return false;
          const record = this.sim.eventState.sites[site.id];
          if (!record && ['caravan', 'standingStones', 'graveyard'].includes(site.kind)) {
              if (this.sim.eventState.trial && site.kind !== 'caravan') {
                  this.notify('Finish the active trial.');
                  return true;
              }
              this.activeEvent = site;
              this.panels.open('event');
          }
          else
              this.startEvent(site, record?.choice ?? null);
          return true;
      }
      this.activeNPC = npc;
      this.panels.open('service');
      return true;
  }

  private startEvent(site: EventSite, choice: EventChoice | null): void {
    const problem = eventProblem(this.sim, site, choice);
    if (problem) { this.notify(problem); return; }
    this.sim.portal.cancel(); this.sim.clearInput();
    this.sim.eventChannel.start(site, choice);
  }

  private finishEvent(): void {
      const channel = this.sim.eventChannel, site = channel.site;
      if (!site || !channel.ready)
          return;
      if (site.kind === 'cryptChest') {
          const result = claimDungeonChest(this.sim, site.index, c => this.persistTravel(c));
          channel.cancel();
          if (result.ok)
              this.renderer.handleEvents([{ type: 'blast', x: site.x, y: site.y, radius: 70, duration: .6, color: '#d7c18a' }], this.reducedMotion);
          this.notify(result.message);
          return;
      }
      const target = site.kind === 'watchtower' ? this.world.getPOIs(site.x - 2400, site.y - 2400, 4800, 4800)
          .filter(poi => poi.id !== site.id && !this.exploration.isDiscovered(poi.id) && Math.hypot(poi.x - site.x, poi.y - site.y) <= 2400
          && ['camp', 'watchtower', 'graveyard', 'standingStones', 'caravan', 'reliquary'].includes(poi.kind))
          .sort((a, b) => Math.hypot(a.x - site.x, a.y - site.y) - Math.hypot(b.x - site.x, b.y - site.y))[0] : undefined;
      const result = executeEvent(this.sim, site, channel.choice, c => this.persistTravel(c), target);
      channel.cancel();
      this.notify(result.message);
      this.projectBeacons();
  }

  private projectBeacons(): void {
    for (const record of Object.values(this.sim.eventState.sites)) {
      if (record.kind !== 'watchtower' || record.phase !== 'claimed' || this.projectedBeacons.has(record.id)) continue;
      this.exploration.revealFromBeacon(record.x, record.y, record.beaconTarget);
      this.projectedBeacons.add(record.id);
    }
  }

  private nearbyAnchor(pointer?: { x: number; y: number }): PortalAnchor | undefined {
    const p = this.sim.player;
    return this.world.getSettlements(p.x - 150, p.y - 150, 300, 300).map(townPortalAnchor)
      .find(anchor => withinPortalReach(p, anchor, this.world)
        && (!pointer || Math.hypot(pointer.x - anchor.x, pointer.y - (anchor.y - 25)) < 42));
  }

  private persistTravel(checkpoint: CharacterCheckpoint) {
    const ok = this.session.save(checkpoint, Date.now());
    this.saveError = ok ? '' : this.session.error;
    this.shell.setSaveStatus(this.saveError || 'Character saved locally.', !ok);
    return { ok, message: this.saveError };
  }

  private requestPortal() {
    if (this.phase !== 'playing' || !this.session.active) return;
    const p = this.sim.player, link = this.sim.travel.returnTo;
    if (this.world.isSanctuary(p.x, p.y)) {
      if (link) { this.renderer.portalGuide = 4; this.notify('Return portal marked on your map.'); }
      else this.notify('Explore outside the sanctuary to open a town portal.');
      return;
    }
    this.sim.eventChannel.cancel();
    this.sim.clearCombatInput();
    const problem = this.sim.portal.start(p, this.world);
    if (problem) this.notify(problem);
  }

  private setLocationWorld(checkpoint: CharacterCheckpoint) {
      const run = checkpoint.expeditions && currentDungeon(checkpoint.expeditions);
      if (this.world !== this.overworld)
          this.world.dispose();
      this.world = run ? new DungeonWorld(generateDungeon(run.entrance.seed, run.entrance.level), run.entrance) : this.overworld;
      this.sim.world = this.world;
  }
  private switchDungeon(action: DungeonAction): boolean {
      const result = planDungeonTravel(this.sim, action, this.overworld, c => this.persistTravel(c));
      if (!result.ok) {
          this.sim.portal.cancel();
          this.notify(result.message);
          return false;
      }
      this.setLocationWorld(result.checkpoint);
      this.sim.restoreCheckpoint(result.checkpoint);
      this.sim.relocate(this.sim.player.x, this.sim.player.y);
      this.input.clear();
      this.gamepad.clear();
      this.renderer.reset();
      this.renderer.snapTo(this.sim.player);
      this.sim.setSpawnExclusion(this.renderer.spawnExclusionBounds(this.sim.player));
      this.shell.portalTransition();
      this.canvas.focus();
      this.notify(result.message);
      return true;
  }
  private travelThrough(anchor: PortalAnchor, returning: boolean) {
    if(this.sim.dungeonFloor||returning&&this.sim.travel.returnTo?.dungeon){this.switchDungeon(returning?{kind:'return',anchor}:{kind:'town',anchor});return;}
    const result = executePortalTravel(this.sim, anchor, returning, c => this.persistTravel(c));
    if (!result.ok) { this.notify(result.message); return; }
    this.input.clear();
    this.gamepad.clear();
    this.renderer.reset(); this.renderer.snapTo(this.sim.player);
    this.sim.setSpawnExclusion(this.renderer.spawnExclusionBounds(this.sim.player));
    this.areaNotices.reset(getZoneAt(this.sim.player.x, this.sim.player.y, this.world.seed).id);
    this.worldMap.update(this.sim.player, 0);
    this.shell.portalTransition(); this.canvas.focus();
  }

  private trade(quote: ServiceQuote): { ok: boolean; message: string } {
    const npc = this.activeNPC, p = this.sim.player;
    if (this.phase !== 'service' || !npc || !this.session.active || !canInteractNPC(npc, p, this.world))
      return { ok: false, message: 'This service is no longer in reach.' };
    const result = executeService(p, npc, this.world, quote, (character, hp, mana) => {
      const saved = this.session.save({ ...this.sim.captureCheckpoint(), character, hp, mana }, Date.now());
      if (!saved) this.shell.setSaveStatus(this.session.error, true);
      return { ok: saved, message: this.session.error };
    });
    if (result.ok) { this.saveError = ''; this.shell.setSaveStatus('Character saved locally.'); this.notify(result.message); }
    return result;
  }

  private characterAction(command: CharacterCommand) {
    const result = executeCharacterCommand(this.sim.player, command);
    if (!result.ok) { this.notify(result.message ?? 'Action unavailable.'); return; }
    if (this.phase === 'character') this.inventoryPanel.refresh(this.sim.player);
    if (this.phase === 'skills') this.skillPanel.refresh(this.sim.player);
    this.saveCharacter();
  }

  private readInput(): Input {
    if (this.usingGamepad) {
      const pad = this.gamepad, p = this.sim.player;
      if (pad.aim.x || pad.aim.y) {
        this.padAimAngle = Math.atan2(pad.aim.y, pad.aim.x);
        this.padAimDistance = 60 + Math.hypot(pad.aim.x, pad.aim.y) * 220;
      } else if (pad.move.x || pad.move.y) this.padAimAngle = Math.atan2(pad.move.y, pad.move.x);
      const angle = this.padAimAngle ?? p.angle;
      const aim = { x: p.x + Math.cos(angle) * this.padAimDistance, y: p.y + Math.sin(angle) * this.padAimDistance };
      const screen = this.renderer.worldToScreen(aim.x, aim.y);
      this.mouse.x = screen.x; this.mouse.y = screen.y; this.mouse.present = true;
      // Controller aiming is independent of the last mouse position and HUD hit regions.
      const rangedAim = this.renderer.resolvePointerAim(this.sim, this.world, screen.x, screen.y, true);
      return { ...pad.gameplay(aim),
        ...(rangedAim ? { rangedAim: { x: rangedAim.x, y: rangedAim.y } } : {}) };
    }
    const blocked = this.pointerInHUD();
    const p = this.sim.player;
    const aim = blocked
      ? { x: p.x + Math.cos(p.angle) * 100, y: p.y + Math.sin(p.angle) * 100 }
      : this.renderer.screenToWorld(this.mouse.x, this.mouse.y);
    // A captured pointer still belongs to the canvas over a menu button.
    // Clear queued weapon inputs as well as suppressing the held buttons.
    if (blocked) this.sim.clearCombatInput();
    const input = this.input.consume(aim, blocked);
    const rangedAim = this.renderer.resolvePointerAim(this.sim, this.world, this.mouse.x, this.mouse.y, !blocked && this.mouse.present);
    return rangedAim ? { ...input, rangedAim: { x: rangedAim.x, y: rangedAim.y } } : input;
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.fps += (1 / Math.max(dt, 0.001) - this.fps) * 0.04;
    this.pollGamepad(now);
    this.renderer.gamepadActive = this.usingGamepad;
    this.shell.setGamepadActive(this.usingGamepad);
    if (this.phase === 'playing') {
      // The simulation owns the fixed 120 Hz clock and render interpolation.
      this.sim.setSpawnExclusion(this.renderer.spawnExclusionBounds(this.sim.player));
      this.sim.update(dt, this.readInput());
      const events = this.sim.drainEvents();
      this.renderer.handleEvents(events, this.reducedMotion);
      for (const event of events) {
        if (event.type === 'gold' || event.type === 'experience') this.shell.notifications.push({
          kind: 'rewards', gold: event.type === 'gold' ? event.amount : 0, xp: event.type === 'experience' ? event.amount : 0,
        });
        else if (event.type === 'loot') this.shell.notifications.push({ kind: 'loot', item: event.item });
        else if (event.type === 'level') this.shell.notifications.push({ kind: 'level', level: event.level, skillPoints: event.skillPoints, statPoints: event.statPoints });
        else if (event.type === 'notice') this.notify(event.message);
        if (!(event.type === 'cast' && event.enemyKind)) this.audio.play(event);
      }
      if (this.sim.eventChannel.ready) this.finishEvent();
      if (this.sim.portal.ready) this.travelThrough(this.overworld.getPortalAnchor(this.sim.travel.homeTown), false);
      const run=currentDungeon(this.sim.expeditions);
      const zone = run?{id:run.entrance.id,name:run.entrance.name,level:run.entrance.level}:getZoneAt(this.sim.player.x, this.sim.player.y, this.world.seed);
      if (this.areaNotices.update(zone.id, dt)) this.shell.notifications.push({ kind: 'area', id: zone.id, name: zone.name, level: zone.level });
      if (this.sim.player.dead) {
        this.panels.transition('dead', true);
      }
      if (now >= this.nextAutosave) { this.saveCharacter(); this.nextAutosave = now + 10_000; }
    }
    this.shell.setPortalState(this.sim.portal.active ? this.sim.portal.progress : null,
      !!this.sim.travel.returnTo && this.world.isSanctuary(this.sim.player.x, this.sim.player.y));
    this.renderer.pointerX = this.mouse.x;
    this.renderer.pointerY = this.mouse.y;
    this.renderer.pointerActive = this.mouse.present;
    const settings = {
      reducedMotion: this.reducedMotion, phase: this.phase, fps: this.fps, debug: this.debug,
    };
    if (this.phase === 'ready') {
      this.renderer.cameraX = -90 + (this.reducedMotion ? 0 : Math.sin(now / 24000) * 45);
      this.renderer.cameraY = -180 + (this.reducedMotion ? 0 : Math.cos(now / 31000) * 25);
    }
    this.renderer.render(this.sim, this.world, dt, settings);
    this.fx.render(this.renderer.canvas, this.renderer.hurt);
    const ui = this.uiContext;
    ui.setTransform(1, 0, 0, 1, 0, 0);
    ui.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);
    // Keep shared logical coordinates for drawing, aiming, and the HTML hit targets.
    ui.setTransform(this.uiCanvas.width / this.renderer.width, 0, 0,
      this.uiCanvas.height / this.renderer.height, 0, 0);
    if (this.phase !== 'ready') this.renderer.renderUI(ui, this.sim, this.world, settings);
    const p = this.sim.player, alpha = this.sim.interpolationAlpha;
    const mapPlayer = { x: p.prevX + (p.x - p.prevX) * alpha,
      y: p.prevY + (p.y - p.prevY) * alpha, angle: p.angle };
    const dungeonRun=currentDungeon(this.sim.expeditions);
    if (this.phase !== 'ready' && !dungeonRun) this.worldMap.update(mapPlayer, dt);
    if (this.phase !== 'ready' && dungeonRun) drawCryptMinimap(ui,this.sim.dungeonFloor!,dungeonRun,mapPlayer,this.renderer.width,this.renderer.height);
    if (this.phase !== 'ready' && !dungeonRun) this.worldMap.drawMinimap(ui, mapPlayer, this.renderer.width, this.renderer.height, now / 1000,
      this.sim.enemies.filter(enemy => enemy.hp > 0).map(enemy => ({
        x: enemy.prevX + (enemy.x - enemy.prevX) * alpha,
        y: enemy.prevY + (enemy.y - enemy.prevY) * alpha, kind: enemy.kind,
      })));
    this.animation = requestAnimationFrame(this.frame);
  };

  private pollGamepad(now: number) {
    let pads: (Gamepad | null)[] = [];
    try { pads = navigator.getGamepads ? [...navigator.getGamepads()] : []; } catch { /* API may be denied by the host. */ }
    this.gamepad.poll(pads, document.hasFocus() && !document.hidden);
    if (this.gamepad.disconnected && this.usingGamepad) {
      this.clearInput(); this.usingGamepad = false; this.mouse.present = false;
      if (this.phase === 'playing') this.pause();
      this.notify('Controller disconnected.'); return;
    }
    const pad = this.gamepad;
    if (pad.active && !this.usingGamepad) {
      this.input.clear(); this.sim.clearInput(); this.usingGamepad = true;
      this.padAimAngle = this.sim.player.angle;
    }
    if (!pad.active) { this.gamepadMenu.clear(); return; }
    if (pad.pressed.has(PAD.pause) || (this.phase !== 'playing' && pad.pressed.has(PAD.dodge))) {
      if (this.panels.activePanel) this.resume();
      else if (this.phase === 'playing') { if (this.sim.portal.active) this.sim.portal.cancel(); else this.pause(); }
      else if (this.phase === 'paused') this.resume();
      else if (this.phase === 'ready') this.shell.titleMount.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.click();
      return;
    }
    if (pad.pressed.has(PAD.map) && (this.panels.canOpen('map') || this.phase === 'map')) {
      this.panels.toggle('map'); return;
    }
    if (this.phase === 'playing') {
      if (pad.pressed.has(PAD.up)) { this.openCharacterPanel('skills'); return; }
      if (pad.pressed.has(PAD.left) || pad.pressed.has(PAD.right)) { this.openCharacterPanel('character'); return; }
      if (pad.pressed.has(PAD.down)) { this.requestPortal(); return; }
      if (pad.pressed.has(PAD.interact)) this.interact();
    } else {
      const root = this.phase === 'ready' ? this.shell.titleMount : this.phase === 'map' ? this.shell.mapMount
        : this.panels.activePanel ? this.shell.panelMount : this.canvas.parentElement!.querySelector<HTMLElement>('#overlay')!;
      this.gamepadMenu.update(root, pad, now);
    }
  }

  private showMenu() {
    const p = this.sim.player;
    const building = this.world.getBuildingAt(p.x, p.y);
    const town = this.world.getSettlements(p.x - 1, p.y - 1, 2, 2)
      .find(place => Math.hypot(p.x - place.x, p.y - place.y) <= place.radius);
    const location = building?.name ?? town?.name ?? this.world.sampleBiome(p.x, p.y).name;
    this.shell.showMenu(this.phase, this.sim.kills, this.sim.time, location);
  }

  toggleSound() {
    if (this.disposed) return;
    this.muted = !this.muted;
    this.audio.setEnabled(!this.muted);
    void this.audio.unlock().catch(() => {});
    this.savePreferences();
  }

  private savePreferences() {
    try { localStorage.setItem('evergrow-preferences', JSON.stringify({ muted: this.muted })); } catch { /* Storage may be disabled. */ }
  }

  private notify(message: string) {
    if (this.disposed) return;
    this.shell.notifications.info(message);
  }

  dispose() {
    if (this.disposed) return;
    this.saveCharacter();
    this.disposed = true;
    this.clearInput();
    this.renderer.reset();
    this.lifetime.dispose();
  }
}
