import { ATLAS_WEAPON_FILTERS, matchesAtlasSkillFilter, type AtlasWeaponFilter } from './skill-tree-filters.ts';
import { RESPEC_GOLD_PER_POINT, respecPoints, planSkillChainRefund, type SkillChainRefund } from './skill-respec.ts';
import { canAfford, goldBalance } from './wallet.ts';
import type { SkillPreview } from './skill-preview.ts';
import { controls } from './control-preferences.ts';
import { SKILL_ACTIONS } from './control-bindings.ts';
import { skillValuesMarkup, skillValueChangesMarkup } from './skill-effect-values.ts';
import { previewSkillVariant } from './skill-variant-preview.ts';
import { nodeDescription, nodeMechanicDetails } from './skill-node-explanation.ts';
import { TECHNIQUE_SUMMARIES } from './technique-summaries.ts';
import { UITooltipStack } from './ui-tooltip-stack.ts';
import { effectExplanation, effectText, statTerm, effectTerm, spellweaveFit, spellweaveNodeMarkup } from './effect-terms.ts';
import { buildAtlasLightPlan, drawAtlasLight, type AtlasLightPlan } from './skill-tree-light.ts';
import { GamepadMenu } from './gamepad-menu.ts';
import { PAD, PAD_SKILL_LABELS, type GamepadInput } from './gamepad-input.ts';
import { bindTouchCanvas } from './touch-canvas.ts';
import type { CharacterCommand } from './character-commands.ts';
import { resolveSkill, learnedSkillRank, activeSkillRank, maximumSkillRank, selectedSpecialization, SKILL_SPECIALIZATIONS, specializationNode, OVERLOAD_NODE } from './skill-progression.ts';
import { skillNodeOwner, skillNodeRole } from './skill-node-presentation.ts';
import { scaleTreeDefenses } from './skill-tree-balance.ts';
import { skillTooltipMarkup } from './skill-tree-tooltip.ts';
import { TooltipMotion } from './ui-tooltip-motion.ts';
import { tooltipTargetHeld } from './ui-tooltip.ts';
import type { Player } from './model.ts';
import type { SkillId, StatKey } from './character-types.ts';
import { SKILL_DEFINITIONS, canUseSkill, skillRequirementLabel } from './skill-content.ts';
import { skillIconSVG } from './skill-icon.ts';
import { SKILL_TREE, SKILL_NODES, SKILL_TREE_ORIGIN, unlockedSkills, type SkillNode } from './skill-tree.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { drawSkillAtlas, type SkillAtlasView, SKILL_DOMAIN_COLORS, skillNodeScreenRadius } from './skill-tree-art.ts';
import { skillNodeIconSVG } from './skill-tree-glyphs.ts';
import { buildSkillRoutes, previewSkillRoute, type SkillRouteStep } from './skill-tree-routes.ts';
import { STAT_LABELS, formatStatValue } from './items.ts';
import { atlasNavigatorProjection, boundsForNodes, fitAtlasBounds } from './skill-tree-view.ts';
import { searchSkillAtlas, groupAtlasSearchMatches, type AtlasSearchMatch } from './skill-tree-search.ts';
import { ATLAS_SEARCH_COLOR } from './skill-tree-search-art.ts';
import './skill-tree-panel.css';

interface SkillTreeActions { develop(command: CharacterCommand): void; close(): void; allocate(id: string): void; assign(slot: number, skill: SkillId | null): void; }
const COLORS = SKILL_DOMAIN_COLORS;

/** Cached native-resolution atlas with a bounded 30 Hz light pass. Simulation owns allocations. */
export class SkillTreePanel {
  private root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private tooltip: HTMLDivElement;
  private explanations: UITooltipStack;
  private hoverExit?: ReturnType<typeof setTimeout>;
  private tooltipMarkup = '';
  private detail: HTMLElement;
  private inspection: HTMLElement;
  private previewHost: HTMLElement;
  private previewDisclosure: HTMLDetailsElement;
  private detailMarkup = '';
  private detailIcon?: { node: string; markup: string };
  private search: HTMLInputElement;
  private points: HTMLElement;
  private assignments: HTMLElement;
  private zoomLabel: HTMLElement;
  private actions: SkillTreeActions;
  private life = new AbortController();
  private focus?: { dispose(): void };
  private observer: ResizeObserver;
  private player?: Player;
  private selected: string | null = SKILL_TREE_ORIGIN;
  private hovered: string | null = null;
  private refundedHover: string | null = null;
  private readonly tooltipMotion = new TooltipMotion();
  private skillsOnly = false;
  private weaponFilter: AtlasWeaponFilter = 'all';
  private preview?: SkillPreview;
  private previewRequest = 0;
  private respecDialog?: HTMLDialogElement;
  private respecFocus?: { dispose(): void };
  private allocated = new Set<string>();
  private reachable = new Set<string>();
  private zoom = .8;
  private fitMode: 'all' | 'origin' | 'search' | null = null;
  private navigator: HTMLCanvasElement;
  private routes = new Map<string, SkillRouteStep>();
  private centerX = 0;
  private centerY = 0;
  private width = 1;
  private height = 1;
  private frame = 0;
  private atlasDirty = true;
  private readonly atlasSurface = document.createElement('canvas');
  private lightPlan?: AtlasLightPlan;
  private lastLightFrame = -Infinity;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private matching = new Set(SKILL_TREE.nodes.map(node => node.id));
  private searchMatches: AtlasSearchMatch[] = [];
  private activeSearchGroup: string | null = null;
  private searchFitTimer?: number;
  private searchSummary: HTMLElement;
  private lastClickedNode: string | null = null;
  private doubleClickedNode: string | null = null;
  private clearTouch: (() => void) | null = null;
  private drag?: { pointer: number; x: number; y: number; startX: number; startY: number; moved: boolean };
  private shown = false;
  private readonly controller = new GamepadMenu();
  private controllerSection = 0;
  private controllerTime = 0;

  constructor(mount: HTMLElement, actions: SkillTreeActions) {
    this.actions = actions;
    this.reducedMotion.addEventListener('change', () => this.invalidate(), { signal: this.life.signal });
    document.addEventListener('visibilitychange', () => this.invalidate(), { signal: this.life.signal });
    this.root = document.createElement('div');
    this.root.className = 'skill-atlas';
    this.root.hidden = true;
    this.root.innerHTML = `<section class="ui-window skill-atlas-window" role="dialog" aria-modal="true" aria-labelledby="skill-atlas-title">
      <header class="ui-window-header skill-atlas-header"><h2 class="ui-title" id="skill-atlas-title">Atlas of Becoming</h2>
        <div class="skill-atlas-points" aria-live="polite"></div><button class="ui-button ui-button--quiet skill-atlas-respec" data-tree="respec">Respec <span class="controller-binding">Y</span></button><button class="ui-button ui-button--quiet ui-button--icon" data-tree="close" aria-label="Close skill tree">${uiIcon('close')}</button></header>
      <nav class="skill-atlas-controller" aria-label="Controller sections"><kbd>LB</kbd><span data-pad-section="0">Tree</span><span data-pad-section="1">Node</span><span data-pad-section="2">Skills</span><kbd>RB</kbd><small data-pad-help></small></nav>
      <div class="skill-atlas-main"><section class="skill-atlas-chart" aria-label="Skill atlas navigation">
        <div class="skill-atlas-toolbar"><label class="skill-atlas-search"><span>${uiIcon('center')}</span><input type="search" placeholder="Find a skill or bonus…" aria-label="Search skills and bonuses" maxlength="80"></label>
          <button class="ui-button ui-button--quiet" data-tree="skills" aria-pressed="false" title="Highlight skill unlocks and plan a route">${uiIcon('star')} Skills</button>
          <label class="skill-atlas-weapon"><span class="ui-kicker">Weapon</span><select class="ui-button" data-weapon-filter aria-label="Highlight skills by weapon">${ATLAS_WEAPON_FILTERS.map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
          </div>
        <div class="skill-atlas-search-summary" hidden><div class="skill-atlas-search-status"><span role="status" aria-live="polite"></span><button class="ui-button ui-button--quiet" data-tree="search-map">Recenter</button><button class="ui-button ui-button--quiet" data-tree="search-clear">Clear</button></div><div class="skill-atlas-search-groups ui-scroll-area" role="group" aria-label="Matching bonuses"></div></div>
        <div class="skill-atlas-viewport"><button class="ui-button ui-button--icon skill-atlas-sidebar-toggle" data-tree="details" aria-expanded="true" aria-controls="skill-atlas-sidebar" aria-label="Close node details" title="Close node details">${uiIcon('sidebar')}</button><canvas tabindex="0" role="application" aria-label="Skill territory map. Arrow keys inspect connected nodes, Enter centers the selected node, plus and minus zoom." aria-describedby="skill-atlas-selection"></canvas>
          <div class="ui-tooltip skill-atlas-tooltip" role="tooltip" hidden></div>
          <div class="skill-atlas-compass" aria-hidden="true"><span>✦</span><small data-atlas-context>THE SIX TERRITORIES</small></div>
          <div class="skill-atlas-zoom"><button class="ui-button ui-button--icon" data-tree="out" aria-label="Zoom out">−</button><output>80%</output><button class="ui-button ui-button--icon" data-tree="in" aria-label="Zoom in">+</button><button class="ui-button ui-button--quiet" data-tree="origin">Origin</button><button class="ui-button ui-button--quiet" data-tree="overview">All</button></div>
          <div class="skill-atlas-navigator"><span>ATLAS <small>drag to explore</small></span><canvas tabindex="0" aria-label="Atlas navigator. Click or drag to move the view. Arrow keys pan, Enter shows the whole atlas."></canvas></div>
        </div></section>
        <aside class="skill-atlas-sidebar" id="skill-atlas-sidebar"><div class="skill-atlas-inspection ui-scroll-area" tabindex="-1" id="skill-atlas-selection"><div class="skill-atlas-detail" aria-live="polite"></div></div>
          <section class="skill-atlas-loadout"><div class="skill-atlas-section-heading"><span class="ui-kicker">Skill bar</span><span class="ui-muted" data-slot-help></span></div><div class="skill-atlas-assignments"></div></section>
        </aside></div>
      <footer class="ui-window-footer skill-atlas-footer"><span><b>${SKILL_TREE.nodes.length.toLocaleString('en-US')}</b> nodes <i>·</i> <b>${SKILL_TREE.clusters.length}</b> clusters <i>·</i> <b>${Object.keys(SKILL_DEFINITIONS).length}</b> skills</span><span>One skill point per level</span></footer>
    </section>`;
    mount.append(this.root);
    this.canvas = this.root.querySelector('canvas')!;
    this.navigator = this.root.querySelector('.skill-atlas-navigator canvas')!;
    this.tooltip = this.root.querySelector('.skill-atlas-tooltip')!;
    this.explanations = new UITooltipStack(this.root, effectExplanation);
    this.tooltip.addEventListener('pointerenter', () => { clearTimeout(this.hoverExit); this.hoverExit = undefined; }, { signal: this.life.signal });
    this.tooltip.addEventListener('pointerleave', () => this.leaveHovered(), { signal: this.life.signal });
    this.inspection = this.root.querySelector('.skill-atlas-inspection')!;
    this.detail = this.root.querySelector('.skill-atlas-detail')!;
    this.previewDisclosure = document.createElement('details');
    this.previewDisclosure.className = 'skill-preview-accordion';
    this.previewDisclosure.innerHTML = '<summary tabindex="0">Preview<span aria-hidden="true">⌄</span></summary><div class="skill-atlas-preview-host"></div>';
    this.previewHost = this.previewDisclosure.querySelector('.skill-atlas-preview-host')!;
    this.previewDisclosure.addEventListener('toggle', () => {
      if (this.previewDisclosure.open) {
        const { node, skill, variant } = this.previewDisclosure.dataset;
        if (node && skill) void this.openPreview(node, skill as SkillId, variant ?? '');
      } else this.closePreview();
    }, { signal: this.life.signal });
    this.search = this.root.querySelector('input')!;
    this.searchSummary = this.root.querySelector('.skill-atlas-search-summary')!;
    this.points = this.root.querySelector('.skill-atlas-points')!;
    this.assignments = this.root.querySelector('.skill-atlas-assignments')!;
    this.zoomLabel = this.root.querySelector('output')!;
    const opts = { signal: this.life.signal };
    this.root.addEventListener('pointerdown', () => this.root.classList.remove('is-controller'), opts);
    this.clearTouch = bindTouchCanvas(this.canvas,this.life.signal,{
      start:()=>{this.cancelSearchFit();this.setHovered(null); this.lastClickedNode=this.doubleClickedNode=null;},
      pan:(dx,dy)=>{this.fitMode=null;this.centerX-=dx/this.zoom;this.centerY-=dy/this.zoom;this.clampCenter();this.invalidate();},
      zoom:(factor,p)=>this.setZoom(this.zoom*factor,p.x,p.y),
      tap:p=>{const r=this.canvas.getBoundingClientRect();const node=this.pick(r.left+p.x,r.top+p.y);if(node){this.inspectNode(node.id,false);if(window.innerWidth<620)this.inspection.scrollIntoView({block:'nearest'});}else this.clearSelection();},
    });
    this.root.addEventListener('click', event => this.click(event), opts);
    this.root.addEventListener('change', event => {
      const input = event.target as HTMLSelectElement, id = input.dataset.skill as SkillId;
      if (input.hasAttribute('data-weapon-filter')) {
        // Highlight in place, including when a prior search fit is still pending.
        this.cancelSearchFit(); this.fitMode = null;
        this.weaponFilter = input.value as AtlasWeaponFilter;
        if (this.weaponFilter !== 'all') this.skillsOnly = true;
        this.root.querySelector('[data-tree="skills"]')!.setAttribute('aria-pressed', String(this.skillsOnly));
        this.activeSearchGroup = null; this.updateSearch(); this.setHovered(null); this.invalidate(); return;
      }
      if (!id || !this.player) return;
      const sheet = this.player.character;
      this.actions.develop({ type: 'configureSkill', skill: id,
        rank: input.dataset.config === 'rank' ? Number(input.value) : Math.max(1, activeSkillRank(sheet,id)),
        specialization: input.dataset.config === 'variant' ? input.value || null : sheet.skillSpecializations[id] ?? null });
    }, opts);
    this.search.addEventListener('input', () => { this.activeSearchGroup = null; this.updateSearch(); this.scheduleSearchFit(); this.setHovered(null); this.invalidate(); }, opts);
    this.search.addEventListener('keydown', event => {
      if (event.key === 'Enter' && this.searchMatches.length) { event.preventDefault(); this.showSearchMatches(); }
    }, opts);
    this.canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      this.cancelSearchFit();
      this.setHovered(null);
      this.canvas.focus(); this.canvas.setPointerCapture(event.pointerId);
      this.drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
    }, opts);
    this.canvas.addEventListener('pointermove', event => {
      if (this.drag) {
        const d = this.drag;
        if (Math.hypot(event.clientX - d.startX, event.clientY - d.startY) > 4) d.moved = true;
        if (d.moved) { this.fitMode=null; this.setHovered(null); this.centerX -= (event.clientX - d.x) / this.zoom; this.centerY -= (event.clientY - d.y) / this.zoom; this.clampCenter(); }
        d.x = event.clientX; d.y = event.clientY; this.invalidate();
      } else {
        const node = this.pick(event.clientX, event.clientY), id = node?.id ?? null;
        if (id && id === this.refundedHover) return;
        this.refundedHover = null;
        if (id) this.setHovered(id); else this.leaveHovered();
      }
    }, opts);
    this.canvas.addEventListener('pointerup', event => {
      if (this.drag?.pointer !== event.pointerId) return;
      const node = !this.drag.moved ? this.pick(event.clientX, event.clientY) : null;
      this.doubleClickedNode = node && this.lastClickedNode === node.id ? node.id : null;
      this.lastClickedNode = node?.id ?? null;
      if (node) this.inspectNode(node.id, false);
      else if (!this.drag.moved) this.clearSelection();
      this.drag = undefined;
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    }, opts);
    this.canvas.addEventListener('dblclick', event => {
      event.preventDefault();
      const node = this.pick(event.clientX, event.clientY);
      if (event.button === 0 && node && node.id === this.doubleClickedNode) {
        if (this.allocated.has(node.id) && node.skill) this.actions.develop({ type: 'upgradeSkill', skill: node.skill });
        else if (!this.allocated.has(node.id)) this.actions.allocate(node.id);
      }
      this.lastClickedNode = this.doubleClickedNode = null;
    }, opts);
    this.canvas.addEventListener('pointercancel', () => {
      this.setHovered(null);
      this.drag = undefined; this.lastClickedNode = this.doubleClickedNode = null;
    }, opts);
    this.canvas.addEventListener('contextmenu', event => this.refundAt(event), opts);
    this.canvas.addEventListener('pointerleave', () => { this.refundedHover = null; this.leaveHovered(); }, opts);
    this.canvas.addEventListener('wheel', event => {
      event.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1);
      this.setZoom(this.zoom * Math.exp(-Math.max(-250, Math.min(250, delta)) * .0015), event.clientX - rect.left, event.clientY - rect.top);
    }, { ...opts, passive: false });
    this.canvas.addEventListener('keydown', event => this.key(event), opts);
    const navigate = (event:PointerEvent) => {
      this.cancelSearchFit();
      this.setHovered(null);
      const rect=this.navigator.getBoundingClientRect(),projection=atlasNavigatorProjection(rect.width,rect.height);
      const point=projection.toWorld(event.clientX-rect.left,event.clientY-rect.top);
      this.fitMode=null;if(this.zoom<.22)this.setZoom(.38);this.centerX=point.x;this.centerY=point.y;this.clampCenter();this.invalidate();
    };
    this.navigator.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;event.preventDefault();this.navigator.focus();this.navigator.setPointerCapture(event.pointerId);navigate(event);
    },opts);
    this.navigator.addEventListener('pointermove',event=>{if(this.navigator.hasPointerCapture(event.pointerId))navigate(event);},opts);
    this.navigator.addEventListener('pointerup',event=>{if(this.navigator.hasPointerCapture(event.pointerId))this.navigator.releasePointerCapture(event.pointerId);},opts);
    this.navigator.addEventListener('keydown',event=>{
      this.cancelSearchFit();
      if(event.key==='Enter'){event.preventDefault();this.showOverview();return;}
      const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
      if(!direction)return;event.preventDefault();this.fitMode=null;
      this.centerX+=direction[0]*this.width/this.zoom*.2;this.centerY+=direction[1]*this.height/this.zoom*.2;this.clampCenter();this.invalidate();
    },opts);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(this.canvas);
  }

  open(player: Player): void {
    const firstOpen = !this.player;
    this.shown = true; this.root.hidden = false; this.refresh(player); this.resize();
    if (firstOpen) this.showOrigin();
    this.focus?.dispose();
    this.focus = trapDialogFocus(this.root, { signal: this.life.signal, initialFocus: this.canvas, restoreFocus: false });
  }
  refresh(player: Player): void {
    const active = this.root.ownerDocument.activeElement;
    const focusedControl = active && this.root.contains(active)
      ? ['data-tree', 'data-clear', 'data-upgrade', 'data-config', 'data-variant', 'data-overload', 'data-slot'].flatMap(attribute => {
        const value = active.getAttribute(attribute);
        return value === null ? [] : [{ attribute, value }];
      })[0] : undefined;
    this.player = player; this.allocated = new Set(player.character.allocatedNodes); this.reachable.clear();
    for (const id of this.allocated) for (const neighbor of SKILL_NODES.get(id)?.neighbors ?? []) if (!this.allocated.has(neighbor)) this.reachable.add(neighbor);
    this.routes = buildSkillRoutes(this.allocated);
    this.points.innerHTML = `<strong>${player.character.skillPoints}</strong><span>SKILL ${player.character.skillPoints === 1 ? 'POINT' : 'POINTS'}</span>`;
    this.updateDetail(); this.updateAssignments(); this.updateSearch(); this.invalidate();
    if (this.shown && focusedControl) {
      const replacement = [...this.root.querySelectorAll<HTMLButtonElement>(`[${focusedControl.attribute}]`)]
        .find(button => button.getAttribute(focusedControl.attribute) === focusedControl.value && !button.disabled);
      (replacement ?? this.canvas).focus({ preventScroll: true });
    }
  }
  updateGamepad(pad: GamepadInput, now: number): void {
    if (!this.shown) return;
    const modal = this.respecDialog;
    if (modal) { this.controller.update(modal, pad, now); return; }
    const elapsed = Math.min(50, Math.max(0, now - this.controllerTime)); this.controllerTime = now;
    if (!pad.active) { this.controller.clear(); return; }
    if (!this.root.classList.contains('is-controller')) {
      this.root.classList.add('is-controller'); this.setHovered(null); this.selectControllerSection(0);
    }
    if (pad.pressed.has(PAD.skill4)) { this.openRespec(); return; }
    if (pad.pressed.has(PAD.skill3)) { this.selectControllerSection(2); return; }
    const region = this.controllerRegion();
    if (this.controllerSection === 1 && Math.abs(pad.aim.y) > .2) this.inspection.scrollBy({ top: pad.aim.y * elapsed * .65 });
    this.controller.update(region, pad, now, {
      switchTab: delta => this.selectControllerSection((this.controllerSection + delta + 3) % 3),
      activate: target => {
        if (target !== this.canvas) return false;
        this.selectControllerSection(1); return true;
      },
    });
  }
  private controllerRegion(): HTMLElement {
    return this.controllerSection === 0 ? this.root.querySelector('.skill-atlas-chart')!
      : this.controllerSection === 1 ? this.inspection : this.root.querySelector('.skill-atlas-loadout')!;
  }
  private selectControllerSection(section: number): void {
    if (section !== 0) this.setDetailsVisible(true);
    this.controllerSection = section; this.controller.clear();
    for (const label of this.root.querySelectorAll<HTMLElement>('[data-pad-section]'))
      label.setAttribute('aria-current', String(Number(label.dataset.padSection) === section));
    this.root.querySelector('[data-pad-help]')!.textContent = section === 0 ? 'A Node · X Assign · LT/RT Zoom · B Back' : 'A Select · RS Scroll · B Back';
    const region = this.controllerRegion();
    const target = section === 0 ? this.canvas
      : region.querySelector<HTMLElement>('[data-tree="assign"], [data-tree="allocate"]:not(:disabled), [data-slot]:not(:disabled), button:not(:disabled), select') ?? this.detail;
    target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  close(): void {
    this.closePreview(); this.closeRespec();
    this.cancelSearchFit();
    this.controller.clear(); this.root.classList.remove('is-controller'); this.controllerSection = 0;
    this.clearTouch?.();
    this.lastClickedNode = this.doubleClickedNode = null;
    this.atlasDirty = true; this.lightPlan = undefined;
    this.atlasSurface.width = this.atlasSurface.height = 0;
    clearTimeout(this.hoverExit); this.hoverExit = undefined; this.explanations.hide();
    this.shown = false; this.root.hidden = true; this.focus?.dispose(); this.focus = undefined;
    this.drag = undefined; this.hovered = null; this.tooltipMotion.reset(); this.tooltip.hidden = true;
    if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0;
  }
  dispose(): void { this.close(); this.explanations.dispose(); this.life.abort(); this.observer.disconnect(); this.root.remove(); }

  /** Also used by frozen review scenes; it changes presentation only. */
  inspectNode(id: string, center = true): void {
    this.cancelSearchFit();
    const node = SKILL_NODES.get(id); if (!node) return;
    this.refundedHover = null;
    if (id !== this.selected) this.closePreview();
    this.selected = id; this.setHovered(null); this.setDetailsVisible(true);
    if (center) { this.centerX = node.x; this.centerY = node.y; this.setZoom(Math.max(.65, this.zoom)); }
    this.updateDetail(); this.updateAssignments(); this.inspection.scrollTop = 0; this.invalidate();
  }
  /** Called only after a refund commits; leave the camera and unrelated selection alone. */
  pointRefunded(id: string): void {
    if (this.selected === id) { this.selected = SKILL_TREE_ORIGIN; this.closePreview(); }
    if (this.hovered === id) this.setHovered(null);
    // Small pointer movements after right-click must not relight the refunded path.
    this.refundedHover = id;
  }
  private clearSelection(): void {
    this.cancelSearchFit(); this.setHovered(null); this.closePreview();
    this.selected = null; this.refundedHover = null;
    this.lastClickedNode = this.doubleClickedNode = null;
    this.updateDetail(); this.updateAssignments(); this.invalidate();
  }
  private refundAt(event: MouseEvent): void {
    event.preventDefault();
    if (this.drag) return;
    const node = this.pick(event.clientX, event.clientY);
    if (!node || node.kind === 'origin' || !this.allocated.has(node.id)) return;
    this.cancelSearchFit(); this.fitMode = null;
    this.lastClickedNode = this.doubleClickedNode = null;
    this.inspectNode(node.id, false);
    const chain = this.player && planSkillChainRefund(this.player.character, node.id);
    if (chain && chain.nodeIds.length > 1) { this.openRespec(chain); return; }
    this.actions.develop({ type: 'refundNode', id: node.id });
  }
  private click(event: MouseEvent): void {
    const button = (event.target as Element).closest<HTMLButtonElement>('button'); if (!button) return;
    if (button.dataset.slot) {
      const index = Number(button.dataset.slot) - 1, node = this.selected ? SKILL_NODES.get(this.selected) : undefined;
      if (node?.skill && this.allocated.has(node.id)) this.actions.assign(index, node.skill);
      else { const skill = this.player?.character.skillSlots[index]; if (skill) this.inspectNode(`skill:${skill}`); }
      return;
    }
    if(button.dataset.doctrine){this.actions.develop({type:'chooseDoctrine',id:button.dataset.doctrine});this.inspectNode(button.dataset.doctrine,false);return;}
    if (button.dataset.upgrade) { this.actions.develop({ type: 'upgradeSkill', skill: button.dataset.upgrade as SkillId }); return; }
    if (button.dataset.variant && this.player) {
      const spec = SKILL_SPECIALIZATIONS.find(s => s.id === button.dataset.variant)!;
      this.actions.develop({ type: 'configureSkill', skill: spec.skill, rank: activeSkillRank(this.player.character, spec.skill), specialization: spec.id }); return;
    }
    if (button.hasAttribute('data-overload') && this.player) { this.actions.develop({ type: 'overload', enabled: !this.player.character.arcaneOverload }); return; }
    if (button.dataset.node) {
      this.cancelSearchFit();
      this.inspectNode(button.dataset.node); this.selectControllerSection(0); return;
    }
    if (button.hasAttribute('data-search-group')) {
      this.activeSearchGroup = button.dataset.searchGroup || null;
      this.updateSearch(); this.showSearchMatches();
      [...this.searchSummary.querySelectorAll<HTMLButtonElement>('[data-search-group]')]
        .find(control => (control.dataset.searchGroup || null) === this.activeSearchGroup)?.focus({ preventScroll: true });
      return;
    }
    if (button.dataset.clear) { this.actions.assign(Number(button.dataset.clear) - 1, null); return; }
    const action = button.dataset.tree;
    if (action === 'close') this.actions.close();
    else if (action === 'respec') this.openRespec();
    else if (action === 'skills') {
      this.cancelSearchFit(); this.fitMode = null;
      this.skillsOnly = !this.skillsOnly;
      if (!this.skillsOnly) { this.weaponFilter = 'all'; this.root.querySelector<HTMLSelectElement>('[data-weapon-filter]')!.value = 'all'; }
      button.setAttribute('aria-pressed', String(this.skillsOnly));
      this.activeSearchGroup = null; this.updateSearch(); this.setHovered(null); this.invalidate();
    }
    else if (action === 'assign') this.selectControllerSection(2);
    else if (action === 'allocate') { const id = button.dataset.inspected ?? this.selected; if (id) this.actions.allocate(id); }
    else if (action === 'origin') this.showOrigin();
    else if (action === 'overview') this.showOverview();
    else if (action === 'details') this.setDetailsVisible(this.root.classList.contains('is-map-only'));
    else if (action === 'in') this.setZoom(this.zoom * 1.15);
    else if (action === 'out') this.setZoom(this.zoom / 1.15);
    else if (action === 'search-map') this.showSearchMatches();
    else if (action === 'search-clear') {
      this.cancelSearchFit(); this.search.value = ''; this.activeSearchGroup = null;
      this.skillsOnly = false; this.weaponFilter = 'all';
      this.root.querySelector('[data-tree="skills"]')!.setAttribute('aria-pressed', 'false');
      this.root.querySelector<HTMLSelectElement>('[data-weapon-filter]')!.value = 'all';
      this.updateSearch(); this.invalidate(); this.search.focus();
    }
  }
  private async openPreview(node: string, skill: SkillId, specialization: string): Promise<void> {
    this.preview?.dispose(); this.preview = undefined;
    const request = ++this.previewRequest;
    const rank = Math.max(1, this.player ? activeSkillRank(this.player.character, skill) : 1);
    this.previewHost.textContent = 'Loading preview…';
    try {
      const { SkillPreview } = await import('./skill-preview.ts');
      if (!this.shown || request !== this.previewRequest || !this.previewDisclosure.open || node !== this.selected) return;
      this.previewHost.replaceChildren();
      this.preview = new SkillPreview(this.previewHost, skill, rank, specialization);
    } catch {
      if (this.shown && request === this.previewRequest) this.previewHost.textContent = 'Preview unavailable. Close and reopen to retry.';
    }
  }
  dismissPopup(): boolean {
    if (this.respecDialog) { this.closeRespec(); return true; }
    return false;
  }
  private closePreview(): void {
    this.previewRequest++; this.preview?.dispose(); this.preview = undefined;
    this.previewDisclosure.open = false; this.previewHost.replaceChildren();
  }
  private closeRespec(): void {
    this.respecFocus?.dispose(); this.respecFocus = undefined;
    this.respecDialog?.close(); this.respecDialog?.remove(); this.respecDialog = undefined;
  }
  private openRespec(chain?: SkillChainRefund): void {
    if (!this.player) return;
    this.closePreview(); this.closeRespec();
    const sheet = this.player.character, points = chain?.points ?? respecPoints(sheet), price = points * RESPEC_GOLD_PER_POINT;
    const affectedSkills = chain?.nodeIds.flatMap(id => {
      const node = SKILL_NODES.get(id)!;
      return node.skill ? [`${node.name} (rank ${learnedSkillRank(sheet, node.skill)})`] : [];
    });
    const description = chain
      ? `<p>Removing <b>${escapeUI(SKILL_NODES.get(chain.nodeIds[0])!.name)}</b> also disconnects ${chain.nodeIds.length - 1} other ${chain.nodeIds.length === 2 ? 'node' : 'nodes'}. Refund this entire chain?</p>
        <p class="ui-muted">${chain.nodeIds.length} nodes${points > chain.nodeIds.length ? ` + ${points - chain.nodeIds.length} purchased ranks` : ''} will be removed. Other connected branches stay invested.</p>
        ${affectedSkills?.length ? `<p>Skills removed: ${affectedSkills.map(escapeUI).join(', ')}. Their skill-bar assignments will be cleared.</p>` : ''}`
      : '<p>Refund all allocated nodes and purchased ranks. Your skills, Techniques and skill bar will be cleared.</p><p>Attributes, equipment and world progress stay yours.</p>';
    const dialog = this.respecDialog = document.createElement('dialog');
    dialog.className = 'ui-window skill-respec-dialog'; dialog.setAttribute('aria-labelledby', 'skill-respec-title');
    dialog.innerHTML = `<header class="ui-window-header"><h3 class="ui-title" id="skill-respec-title">${chain ? 'Refund this chain?' : 'Choose a new path'}</h3></header>
      <div class="skill-respec-body">${description}<div class="ui-well skill-respec-quote"><span><b>${points}</b> skill points returned</span><span><b>${price.toLocaleString('en-US')}</b> gold · ${RESPEC_GOLD_PER_POINT} per point</span></div>
      <p class="ui-muted">Your gold: ${goldBalance(sheet).toLocaleString('en-US')}${!points ? ' · No spent points to refund.' : !canAfford(sheet, price) ? ` · ${(price - goldBalance(sheet)).toLocaleString('en-US')} more needed.` : ''}</p>
      <div class="skill-preview-controls"><button class="ui-button" data-respec-cancel>Keep my build</button><button class="ui-button ui-button--primary" data-respec-confirm ${!points || !canAfford(sheet, price) ? 'disabled' : ''}>${chain ? 'Refund chain' : 'Respec'} · ${price.toLocaleString('en-US')} gold</button></div></div>`;
    this.root.append(dialog);
    dialog.querySelector('[data-respec-cancel]')!.addEventListener('click', () => this.closeRespec());
    dialog.querySelector('[data-respec-confirm]')!.addEventListener('click', () => {
      this.closeRespec(); this.actions.develop(chain ? { type: 'refundNode', id: chain.nodeIds[0], chain } : { type: 'respecSkills', points });
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); this.closeRespec(); });
    dialog.showModal(); this.respecFocus = trapDialogFocus(dialog);
    dialog.addEventListener('keydown', event => event.stopPropagation());
  }
  private key(event: KeyboardEvent): void {
    this.cancelSearchFit();
    if (event.key === '+' || event.key === '=') { event.preventDefault(); this.setZoom(this.zoom * 1.2); return; }
    if (event.key === '-') { event.preventDefault(); this.setZoom(this.zoom / 1.2); return; }
    if (event.key === 'Enter') { event.preventDefault(); if (this.selected) this.inspectNode(this.selected); return; }
    const direction = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    const current = SKILL_NODES.get(this.selected ?? SKILL_TREE_ORIGIN)!;
    const choices = current.neighbors.map(id => SKILL_NODES.get(id)!).map(node => {
      const dx = node.x - current.x, dy = node.y - current.y;
      return { node, alignment: (dx * direction[0] + dy * direction[1]) / Math.hypot(dx, dy) };
    }).sort((a, b) => b.alignment - a.alignment);
    if (choices[0]?.alignment > .1) this.inspectNode(choices[0].node.id);
  }
  private leaveHovered(): void {
    // Passing over a node must never reveal its card after the pointer has left.
    if (this.tooltipMotion.sample(performance.now()).opacity === 0) { this.setHovered(null); return; }
    if (this.hoverExit) return;
    this.hoverExit = setTimeout(() => {
      this.hoverExit = undefined;
      if (tooltipTargetHeld(this.tooltip) || this.explanations.held) { this.leaveHovered(); return; }
      this.setHovered(null);
    }, 200);
  }
  private setHovered(id: string | null): void {
    clearTimeout(this.hoverExit); this.hoverExit = undefined;
    if (id === this.hovered) return;
    this.explanations.hide();
    this.hovered = id;
    this.tooltipMotion.reset(); this.tooltip.hidden = true;
    if (id) this.tooltipMotion.set(id, performance.now(), this.reducedMotion.matches, 350);
    this.canvas.style.cursor = id ? 'pointer' : 'grab';
    this.invalidate();
  }
  private updateDetail(): void {
    if (!this.player) return;
    if (!this.selected) {
      this.previewDisclosure.remove(); this.detailMarkup = ''; this.detail.dataset.node = '';
      this.detail.classList.remove('has-skill');
      this.detail.innerHTML = '<p class="ui-muted">Select a node to inspect it.</p>';
      return;
    }
    const node = SKILL_NODES.get(this.selected)!, owned = this.allocated.has(node.id), reachable = this.reachable.has(node.id);
    // Reuse this inspector's SVG instance so gradient IDs don't force a DOM rebuild on every refresh.
    if (this.detailIcon?.node !== node.id) this.detailIcon = { node: node.id, markup: skillNodeIconSVG(node, 48) };
    const owner = skillNodeOwner(node), skill = node.skill ? SKILL_DEFINITIONS[node.skill] : node.specialization ? owner : undefined;
    const variantPreview = node.specialization ? previewSkillVariant(node.specialization, this.player.derived, this.player.character) : null;
    const costs = variantPreview?.after ?? (skill ? resolveSkill(skill.id, this.player.derived, this.player.character) : undefined);
    const routeCost = this.routes.get(node.id)?.cost;
    const heading = `${skillNodeRole(node)}${node.specialization && owner ? ` · ${owner.name}` : node.kind !== 'origin' ? ` · ${node.domain}` : ''}`;
    const bonuses = (Object.entries(scaleTreeDefenses(node.bonuses, this.player.level)) as [StatKey, number][]).map(([key, value]) => `<div class="ui-stat"><span>${statTerm(key, STAT_LABELS[key]) || STAT_LABELS[key]}${key==='armor'?' (scales with level)':''}</span><b>${formatStatValue(key, value)}</b></div>`).join('');
    const previewVariant = node.specialization ?? costs?.variant?.id ?? '';
    const signature = skill && costs ? `${skill.id}:${costs.rank}:${previewVariant}` : '';
    if (this.previewDisclosure.dataset.signature !== signature) this.closePreview();
    const compatible = skill && canUseSkill(skill.id, this.player.equipment);
    const allocatedState = owned ? '' : `<div class="skill-atlas-allocation">
      <button class="ui-button ui-button--primary" data-tree="allocate" data-inspected="${node.id}" ${routeCost === undefined || this.player.character.skillPoints < routeCost ? 'disabled' : ''}>${skill ? 'Unlock' : 'Allocate'}${routeCost && routeCost > 1 ? ' path' : ''}<span>${routeCost ?? '—'} ${routeCost === 1 ? 'point' : 'points'}</span></button>
      <small class="ui-muted">${routeCost === undefined ? 'No connected path.' : this.player.character.skillPoints < routeCost ? `${routeCost - this.player.character.skillPoints} more points needed.` : reachable ? 'Connected to your path.' : 'Includes the highlighted connecting nodes.'}</small></div>`;
    const assignment = node.skill && owned ? `<button class="ui-button ui-button--primary skill-assign-action" data-tree="assign">Assign to skill bar<span>${this.player.character.skillSlots.includes(node.skill) ? escapeUI(controls.label(SKILL_ACTIONS[this.player.character.skillSlots.indexOf(node.skill)])) : '<span class="controller-binding">X</span>'}</span></button>` : '';
    const markup = `<header class="skill-node-heading"><div class="skill-atlas-emblem" style="--star-color:${COLORS[node.domain]}">${this.detailIcon.markup}</div>
      <div><p class="ui-kicker">${escapeUI(heading)}</p><h3>${escapeUI(node.name)}</h3></div></header>
      <p class="skill-atlas-description">${node.kind==='origin'&&this.player.character.treeRefunded?'Your previous tree and rank points have been refunded. Unlock your skills again and assign them to the five skill slots. ':''}${nodeDescription(node)}</p>
      ${node.skill && costs?.variant ? `<p class="skill-atlas-technique-note">${effectText(TECHNIQUE_SUMMARIES[costs.variant.id])}</p>` : ''}
      ${skill ? `<p class="skill-equipment-fit ${compatible ? 'is-ready' : 'is-missing'}"><span aria-hidden="true">${compatible ? '✓' : '!'}</span>${escapeUI(skillRequirementLabel(skill.requirement))}${!compatible ? '<small>Equip to use</small>' : ''}</p>` : ''}
      ${skill && costs ? skillValuesMarkup(skill.id, costs) : ''}
      ${variantPreview && variantPreview.before.variant?.id !== variantPreview.after.variant?.id ? `<details class="skill-next-rank" data-inspector-section="technique-changes"><summary tabindex="0">Changes from current skill</summary>${skillValueChangesMarkup(skill!.id, variantPreview.before, variantPreview.after)}</details>` : ''}
      ${nodeMechanicDetails(node, this.player.character)}${spellweaveNodeMarkup(node.bonuses.spellweavePercent ?? 0, node.id === 'keystone:borrowed-flame')}${node.bonuses.spellweavePercent || node.id === 'keystone:borrowed-flame' ? `<p class="effect-fit">${spellweaveFit(this.player.equipment)} ${effectTerm('hybrid', 'Equipment')}</p>` : ''}${bonuses ? `<div class="skill-atlas-bonuses ui-well">${bonuses}</div>` : ''}
      ${skill ? '<div data-preview-slot></div>' : ''}
      ${allocatedState}${assignment}${this.progressionControls(node, owned)}`;
    this.detail.classList.toggle('has-skill', !!skill);
    if (markup !== this.detailMarkup) {
      const openSections = [...this.detail.querySelectorAll<HTMLDetailsElement>('details[data-inspector-section][open]')].map(el => el.dataset.inspectorSection);
      const sameNode = this.detail.dataset.node === node.id;
      this.previewDisclosure.remove();
      this.detail.innerHTML = markup; this.detailMarkup = markup; this.detail.dataset.node = node.id;
      if (sameNode) for (const el of this.detail.querySelectorAll<HTMLDetailsElement>('details[data-inspector-section]')) el.open = openSections.includes(el.dataset.inspectorSection);
    }
    if (skill) {
      Object.assign(this.previewDisclosure.dataset, { node: node.id, skill: skill.id, variant: previewVariant, signature });
      const slot = this.detail.querySelector('[data-preview-slot]')!;
      if (this.previewDisclosure.parentElement !== slot) slot.append(this.previewDisclosure);
    }
  }
  private progressionControls(node: SkillNode, owned: boolean): string {
    const p = this.player!, sheet = p.character;
    if(node.doctrine&&sheet.allocatedNodes.some(id=>SKILL_NODES.get(id)?.doctrine===node.doctrine))return `<div class="skill-specialization-actions"><p class="ui-muted">One paid choice. Switching is free and clears temporary skill buffs.</p>${SKILL_TREE.nodes.filter(n=>n.doctrine===node.doctrine).map(n=>`<button class="ui-button" data-doctrine="${n.id}" ${sheet.allocatedNodes.includes(n.id)?'disabled':''}>${n.name}${sheet.allocatedNodes.includes(n.id)?' · selected':''}</button>`).join('')}</div>`;
    if (node.id===OVERLOAD_NODE && owned) return `<button class="ui-button ui-button--primary" data-overload aria-pressed="${sheet.arcaneOverload}">Overload ${sheet.arcaneOverload ? 'on' : 'off'}</button>`;
    if (node.specialization) {
      const variant = SKILL_SPECIALIZATIONS.find(s => s.id === node.specialization)!;
      const learned = learnedSkillRank(sheet, variant.skill), selected = sheet.skillSpecializations[variant.skill] === variant.id;
      return `<div class="skill-specialization-actions"><button class="ui-button ui-button--quiet" data-node="skill:${variant.skill}">View ${SKILL_DEFINITIONS[variant.skill].name}</button>
        ${owned ? `<button class="ui-button ui-button--primary" data-variant="${variant.id}" aria-pressed="${selected}" ${!learned || selected ? 'disabled' : ''}>${selected ? 'Active' : 'Activate'}</button>` : ''}</div>`;
    }
    if (!node.skill || !owned) return '';
    const id = node.skill, learned = learnedSkillRank(sheet,id), max = maximumSkillRank(sheet,id), active = activeSkillRank(sheet,id);
    const current = resolveSkill(id,p.derived,sheet,learned), next = learned < max ? resolveSkill(id,p.derived,sheet,learned+1) : null;
    const variants = SKILL_SPECIALIZATIONS.filter(v=>v.skill===id), selected = selectedSpecialization(sheet,id);
    const unlocked = variants.filter(v => sheet.allocatedNodes.includes(specializationNode(v.id)));
    return `<section class="skill-rank-controls ui-well">
      <header class="skill-rank-heading"><strong>Rank ${learned}<small> / ${max}${current.bonusRanks ? ` · +${current.bonusRanks} gear` : ''}</small></strong>
        ${next ? `<button class="ui-button ui-button--primary" data-upgrade="${id}" aria-label="Upgrade ${SKILL_DEFINITIONS[id].name} to rank ${learned+1} for 1 skill point" ${sheet.skillPoints < 1 ? 'disabled' : ''}>Upgrade <span>1 pt</span></button>` : '<span class="skill-rank-max">Max rank</span>'}</header>
      ${next ? `<details class="skill-next-rank" data-inspector-section="next-rank"><summary tabindex="0">Next rank <span>${learned + 1}</span></summary>${skillValueChangesMarkup(id, current, next)}</details>` : ''}
      <div class="skill-active-controls"><label>Use rank<select class="ui-button" data-config="rank" data-skill="${id}" aria-label="Active rank for ${SKILL_DEFINITIONS[id].name}">${Array.from({length:learned},(_,i)=>`<option value="${i+1}" ${i+1===active?'selected':''}>${i+1}</option>`).join('')}</select></label>
        ${variants.length?`<label>Technique<select class="ui-button" data-config="variant" data-skill="${id}" aria-label="Technique for ${SKILL_DEFINITIONS[id].name}" ${!unlocked.length ? 'disabled' : ''}><option value="">Original</option>${unlocked.map(v=>`<option value="${v.id}" ${selected?.id===v.id?'selected':''}>${v.name}</option>`).join('')}</select></label>`:''}</div>
      ${variants.length ? `<details class="skill-variant-links" data-inspector-section="techniques"><summary tabindex="0">Browse Techniques <span>${unlocked.length} / ${variants.length}</span></summary>${variants.map(v=>`<button class="ui-button ui-button--quiet" data-node="${specializationNode(v.id)}"><span>${v.name}</span><small>${selected?.id===v.id?'Active':sheet.allocatedNodes.includes(specializationNode(v.id))?'Unlocked':'↗'}</small></button>`).join('')}
</details>` : ''}</section>`;
  }
  private updateAssignments(): void {
    if (!this.player) return;
    const skills = new Set(unlockedSkills(this.player.character.allocatedNodes));
    const node = this.selected ? SKILL_NODES.get(this.selected) : undefined, assigning = !!node?.skill && this.allocated.has(node.id);
    this.root.querySelector('[data-slot-help]')!.textContent = assigning ? `Assign ${SKILL_DEFINITIONS[node.skill!].name}` : '';
    this.assignments.innerHTML = SKILL_ACTIONS.map((action, index) => {
      const binding = escapeUI(controls.label(action));
      const id = this.player!.character.skillSlots[index], skill = id && skills.has(id) ? SKILL_DEFINITIONS[id] : null;
      return `<div class="skill-atlas-assigned ${skill ? 'is-filled' : ''}"><button class="ui-button ui-button--quiet skill-slot-button" data-slot="${index+1}" aria-label="${assigning ? `Assign ${SKILL_DEFINITIONS[node.skill!].name} to` : 'Inspect'} ${binding}${skill ? `, ${skill.name}` : ', empty slot'}" title="${skill?.name ?? 'Empty slot'}" ${!assigning && !skill ? 'disabled' : ''}><span class="skill-atlas-assigned-icon" ${skill ? `style="color:${skill.color}"` : ''}>${skill ? skillIconSVG(skill.id, 24) : '◇'}</span><small><span class="desktop-binding">${binding}</span><span class="controller-binding">${PAD_SKILL_LABELS[index+1]}</span><span class="touch-only">${index+1}</span></small></button>${skill ? `<button class="ui-button ui-button--quiet skill-slot-clear" data-clear="${index+1}" aria-label="Remove ${skill.name} from ${binding}">×</button>` : ''}</div>`;
    }).join('');
  }

  private matches(node: SkillNode): boolean { return this.matching.has(node.id); }
  private get filterActive(): boolean { return !!this.search.value.trim() || this.skillsOnly || this.weaponFilter !== 'all'; }
  private updateSearch(): void {
    this.searchMatches = searchSkillAtlas(this.search.value).filter(({ node }) => (!this.player || matchesAtlasSkillFilter(node, this.skillsOnly, this.weaponFilter, this.player.equipment)));
    const groups = groupAtlasSearchMatches(this.search.value, this.searchMatches);
    const selected = groups.find(group => group.id === this.activeSearchGroup);
    if (!selected) this.activeSearchGroup = null;
    this.matching = new Set(selected?.nodeIds ?? this.searchMatches.map(({ node }) => node.id));
    this.searchSummary.hidden = !this.filterActive;
    this.searchSummary.querySelector('[role="status"]')!.textContent = this.matching.size
      ? `${this.matching.size} ${this.skillsOnly ? (this.matching.size === 1 ? 'skill' : 'skills') : (this.matching.size === 1 ? 'node' : 'nodes')} highlighted` : 'No matching nodes';
    (this.searchSummary.querySelector('[data-tree="search-map"]') as HTMLButtonElement).disabled = !this.matching.size;
    this.searchSummary.querySelector('.skill-atlas-search-groups')!.innerHTML =
      (groups.length > 1 ? `<button class="ui-button ui-button--quiet" data-search-group="" aria-pressed="${!selected}">All matches <b>${this.searchMatches.length}</b></button>` : '')
      + groups.map(group => `<button class="ui-button ui-button--quiet" data-search-group="${escapeUI(group.id)}" aria-pressed="${groups.length === 1 || group.id === selected?.id}">${escapeUI(group.label)} <b>${group.nodeIds.size}</b></button>`).join('');
    if (!this.filterActive && this.fitMode === 'search') this.fitMode = null;
  }
  private cancelSearchFit(): void {
    if (this.searchFitTimer !== undefined) window.clearTimeout(this.searchFitTimer);
    this.searchFitTimer = undefined;
  }
  private scheduleSearchFit(): void {
    this.cancelSearchFit();
    if (!this.filterActive || !this.matching.size) return;
    this.searchFitTimer = window.setTimeout(() => {
      this.searchFitTimer = undefined;
      if (this.shown) this.showSearchMatches();
    }, 220);
  }
  private showSearchMatches(): void {
    this.cancelSearchFit();
    if (!this.filterActive || !this.matching.size) return;
    this.fitMode = 'search'; this.fitCurrentRegion();
  }
  private resize(): void {
    if (!this.shown) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, bounds.width); this.height = Math.max(1, bounds.height);
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.width * ratio); this.canvas.height = Math.round(this.height * ratio);
    if(this.fitMode)this.fitCurrentRegion();
    this.invalidate();
  }
  private clampCenter(): void {
    const bounds = SKILL_TREE.bounds;
    this.centerX = Math.max(bounds.minX - 120, Math.min(bounds.maxX + 120, this.centerX));
    this.centerY = Math.max(bounds.minY - 120, Math.min(bounds.maxY + 120, this.centerY));
  }
  private fitCurrentRegion():void {
    const mode=this.fitMode;if(!mode)return;
    const nodes=SKILL_TREE.nodes.filter(n=>mode==='search'?this.matching.has(n.id):Math.hypot(n.x/1.8,n.y/.72)<720);
    if (!nodes.length) return;
    const fit=fitAtlasBounds(mode==='all'?SKILL_TREE.bounds:boundsForNodes(nodes),this.width,this.height);
    this.centerX=fit.centerX;this.centerY=fit.centerY;this.setZoom(mode==='search'?Math.min(.85,fit.zoom):fit.zoom,this.width/2,this.height/2,false);this.fitMode=mode;
  }
  showOverview(): void {
    this.cancelSearchFit();
    this.fitMode='all';this.fitCurrentRegion();
  }
  private showOrigin(): void {
    this.cancelSearchFit();
    this.fitMode='origin';this.fitCurrentRegion();this.inspectNode(SKILL_TREE_ORIGIN,false);
  }
  setDetailsVisible(visible: boolean): void {
    const sidebar = this.root.querySelector<HTMLElement>('.skill-atlas-sidebar')!;
    if (!visible && sidebar.contains(document.activeElement)) this.canvas.focus();
    if (!visible) this.closePreview();
    sidebar.hidden = !visible; this.root.classList.toggle('is-map-only', !visible);
    const toggle = this.root.querySelector<HTMLButtonElement>('[data-tree="details"]')!;
    toggle.setAttribute('aria-expanded', String(visible));
    toggle.setAttribute('aria-label', visible ? 'Close node details' : 'Open node details');
    toggle.title = visible ? 'Close node details' : 'Open node details';
    this.resize();
  }
  /** Presentation-only camera access for frozen review and atlas navigation. */
  setView(centerX: number, centerY: number, zoom: number): void {
    if (![centerX, centerY, zoom].every(Number.isFinite)) return;
    this.centerX = centerX; this.centerY = centerY; this.setZoom(zoom);
  }
  private setZoom(value: number, x = this.width / 2, y = this.height / 2, cancelSearch = true): void {
    this.setHovered(null);
    if (cancelSearch) this.cancelSearchFit();
    this.fitMode=null;
    const b = SKILL_TREE.bounds;
    const minimum = Math.max(.005, Math.min((this.width - 80) / (b.maxX - b.minX), (this.height - 90) / (b.maxY - b.minY)) * .85);
    const zoom = Math.max(minimum, Math.min(1.65, value));
    this.centerX += (x - this.width / 2) * (1 / this.zoom - 1 / zoom);
    this.centerY += (y - this.height / 2) * (1 / this.zoom - 1 / zoom);
    this.zoom = zoom; this.clampCenter(); this.zoomLabel.textContent = `${Math.round(zoom * 100)}%`; this.invalidate();
  }
  private pick(clientX: number, clientY: number): SkillNode | undefined {
    const rect = this.canvas.getBoundingClientRect(), x = (clientX - rect.left - this.width / 2) / this.zoom + this.centerX, y = (clientY - rect.top - this.height / 2) / this.zoom + this.centerY;
    let selected: SkillNode | undefined, distance = Infinity;
    for (const node of SKILL_TREE.nodes) {
      if (!this.matches(node)) continue;
      const d = Math.hypot(node.x - x, node.y - y), radius = skillNodeScreenRadius(node, this.zoom) / this.zoom;
      if (d < Math.max(radius, (document.documentElement.classList.contains('touch-mode') ? 20 : 12) / this.zoom) && d < distance) { selected = node; distance = d; }
    }
    return selected;
  }
  private invalidate(atlas = true): void {
    this.atlasDirty ||= atlas;
    if (!this.shown || this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.draw(); });
  }
  private drawNavigator(view:SkillAtlasView):void {
    const rect=this.navigator.getBoundingClientRect(),ratio=Math.min(3,window.devicePixelRatio||1);
    if(!rect.width||!rect.height)return;
    this.navigator.width=Math.round(rect.width*ratio);this.navigator.height=Math.round(rect.height*ratio);
    const c=this.navigator.getContext('2d')!;c.setTransform(ratio,0,0,ratio,0,0);
    const p=atlasNavigatorProjection(rect.width,rect.height),sx=(x:number)=>x*p.scale+p.offsetX,sy=(y:number)=>y*p.scale+p.offsetY;
    c.clearRect(0,0,rect.width,rect.height);c.lineWidth=.6;
    for(const edge of SKILL_TREE.edges){
      const a=SKILL_NODES.get(edge.from)!,b=SKILL_NODES.get(edge.to)!;
      const owned=view.allocated.has(a.id)&&view.allocated.has(b.id);
      c.strokeStyle=owned?'#ffdc9c':view.filterActive?'#8fb6c41c':'#8fb6c42b';c.lineWidth=owned?1.3:.6;
      c.beginPath();c.moveTo(sx(a.x),sy(a.y));
      if(edge.control)c.quadraticCurveTo(sx(edge.control.x),sy(edge.control.y),sx(b.x),sy(b.y));else c.lineTo(sx(b.x),sy(b.y));c.stroke();
    }
    for(const n of SKILL_TREE.nodes)if(view.allocated.has(n.id)||(view.filterActive?view.matches(n):n.kind==='major')){
      const owned=view.allocated.has(n.id),matched=view.filterActive&&view.matches(n);
      c.fillStyle=owned?'#ffdc9c':matched?ATLAS_SEARCH_COLOR:'#75919c80';
      c.beginPath();c.arc(sx(n.x),sy(n.y),owned||matched?2:1,0,Math.PI*2);c.fill();
      if(owned&&matched){c.beginPath();c.arc(sx(n.x),sy(n.y),3.5,0,Math.PI*2);c.strokeStyle=ATLAS_SEARCH_COLOR;c.lineWidth=.8;c.stroke();}
    }
    const x=sx(view.centerX-view.width/2/view.zoom),y=sy(view.centerY-view.height/2/view.zoom),w=view.width/view.zoom*p.scale,h=view.height/view.zoom*p.scale;
    const left=Math.max(2,x),top=Math.max(2,y),right=Math.min(rect.width-2,x+w),bottom=Math.min(rect.height-2,y+h);
    c.fillStyle='#b6e5ff10';c.fillRect(left,top,right-left,bottom-top);c.strokeStyle='#bce8ffb0';c.lineWidth=1;c.strokeRect(left+.5,top+.5,right-left,bottom-top);
    this.root.querySelector('[data-atlas-context]')!.textContent=this.zoom<.22?'THE SIX TERRITORIES':this.zoom<.5?'ROADS & CONSTELLATIONS':'SKILLS & TECHNIQUES';
  }
  private draw(): void {
    const ctx = this.canvas.getContext('2d'); if (!ctx) return;
    const tooltip = this.tooltipMotion.sample(performance.now());
    const focused = this.hovered ?? this.selected;
    const view: SkillAtlasView = { width: this.width, height: this.height, zoom: this.zoom,
      centerX: this.centerX, centerY: this.centerY, allocated: this.allocated, reachable: this.reachable,
      sheet: this.player?.character, selected: this.selected, hovered: this.hovered,
      route: !focused || this.filterActive && !this.matching.has(focused) ? [] : previewSkillRoute(this.routes, focused),
      filterActive: this.filterActive,
      matches: node => this.matches(node) };
    const now = performance.now(), dirty = this.atlasDirty;
    if (dirty) {
      this.atlasSurface.width = this.canvas.width; this.atlasSurface.height = this.canvas.height;
      const base = this.atlasSurface.getContext('2d')!;
      base.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);
      const canvasBounds=this.canvas.getBoundingClientRect();
      view.labelExclusions=[...this.root.querySelectorAll<HTMLElement>('.skill-atlas-zoom, .skill-atlas-navigator, .skill-atlas-sidebar-toggle, [data-atlas-context]')].map(element=>{
        const rect=element.getBoundingClientRect();return{x:rect.left-canvasBounds.left,y:rect.top-canvasBounds.top,width:rect.width,height:rect.height};
      });
      const captions=drawSkillAtlas(base, view); this.drawNavigator(view); this.lightPlan = buildAtlasLightPlan(view, captions); this.atlasDirty = false;
    }
    if (dirty || now - this.lastLightFrame >= 1000 / 30) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.atlasSurface, 0, 0);
      ctx.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);
      if (this.lightPlan) drawAtlasLight(ctx, this.lightPlan, this.reducedMotion.matches ? 0 : now / 1000);
      this.lastLightFrame = now;
    }
    const node = tooltip.id ? SKILL_NODES.get(tooltip.id) : undefined;
    const tooltipWasHidden = this.tooltip.hidden;
    this.tooltip.hidden = !node;
    if (node && (dirty || tooltip.active || tooltipWasHidden)) {
      const markup = skillTooltipMarkup(node, { allocated: this.allocated, reachable: this.reachable,
        level: this.player?.level, sheet: this.player?.character, costStats: this.player?.derived, routes: this.routes });
      if (markup !== this.tooltipMarkup) { this.tooltip.innerHTML = markup; this.tooltipMarkup = markup; }
      this.tooltip.style.setProperty('--tooltip-color', COLORS[node.domain]);
      this.tooltip.style.opacity = String(tooltip.opacity);
      this.tooltip.style.translate = `0 ${tooltip.lift}px`;
      const width = this.tooltip.offsetWidth, height = this.tooltip.offsetHeight;
      const x = (node.x - this.centerX) * this.zoom + this.width / 2;
      const y = (node.y - this.centerY) * this.zoom + this.height / 2;
      const radius = skillNodeScreenRadius(node, this.zoom);
      const above = y - radius - height - 14;
      this.tooltip.style.left = `${Math.max(8, Math.min(this.width - width - 8, x - width / 2))}px`;
      this.tooltip.style.top = `${Math.max(8, Math.min(this.height - height - 8, above >= 8 ? above : y + radius + 14))}px`;
    }
    if (tooltip.active || !this.reducedMotion.matches && !document.hidden) this.invalidate(false);
  }
}
