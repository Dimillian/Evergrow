import { buildAtlasLightPlan, drawAtlasLight, type AtlasLightPlan } from './skill-tree-light.ts';
import { GamepadMenu } from './gamepad-menu.ts';
import { PAD, PAD_SKILL_LABELS, type GamepadInput } from './gamepad-input.ts';
import { bindTouchCanvas } from './touch-canvas.ts';
import type { CharacterCommand } from './character-commands.ts';
import { resolveSkill, learnedSkillRank, activeSkillRank, maximumSkillRank, selectedSpecialization, SKILL_SPECIALIZATIONS, specializationNode, OVERLOAD_NODE } from './skill-progression.ts';
import { skillNodeOwner, skillNodeRole } from './skill-node-presentation.ts';
import { scaleTreeDefenses } from './skill-tree-balance.ts';
import { skillTooltipMarkup, specializationPreviewMarkup } from './skill-tree-tooltip.ts';
import { TooltipMotion } from './ui-tooltip-motion.ts';
import { skillDamageSuffix, skillUtilityLabel } from './skill-execution-content.ts';
import type { Player } from './model.ts';
import type { SkillId, StatKey } from './character-types.ts';
import { SKILL_DEFINITIONS, skillIconSVG, canUseSkill, skillRequirementLabel } from './skill-content.ts';
import { SKILL_TREE, SKILL_NODES, SKILL_TREE_ORIGIN, unlockedSkills, type SkillNode } from './skill-tree.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { drawSkillAtlas, type SkillAtlasView, SKILL_DOMAIN_COLORS, skillNodeScreenRadius } from './skill-tree-art.ts';
import { skillNodeIconSVG } from './skill-tree-glyphs.ts';
import { buildSkillRoutes, previewSkillRoute, type SkillRouteStep } from './skill-tree-routes.ts';
import { STAT_LABELS, formatStatValue } from './items.ts';
import { atlasNavigatorProjection, boundsForNodes, fitAtlasBounds } from './skill-tree-view.ts';
import './skill-tree-panel.css';

interface SkillTreeActions { develop(command: CharacterCommand): void; close(): void; allocate(id: string): void; assign(slot: number, skill: SkillId | null): void; }
const COLORS = SKILL_DOMAIN_COLORS;
const SEARCH_TEXT = new Map(SKILL_TREE.nodes.map(node => [node.id,
  `${node.name} ${skillNodeRole(node)} ${skillNodeOwner(node)?.name ?? ''} ${node.domain} ${node.territory??''} ${node.doctrine?'doctrine':''} ${node.specialization?'technique':''} ${node.description} ${Object.keys(node.bonuses).map(key => STAT_LABELS[key as StatKey]).join(' ')}`.toLowerCase()]));
const BINDINGS = ['RMB', '1', '2', '3', '4'];

/** Cached native-resolution atlas with a bounded 30 Hz light pass. Simulation owns allocations. */
export class SkillTreePanel {
  private root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private tooltip: HTMLDivElement;
  private tooltipMarkup = '';
  private detail: HTMLElement;
  private results: HTMLElement;
  private search: HTMLInputElement;
  private points: HTMLElement;
  private assignments: HTMLElement;
  private zoomLabel: HTMLElement;
  private actions: SkillTreeActions;
  private life = new AbortController();
  private focus?: { dispose(): void };
  private observer: ResizeObserver;
  private player?: Player;
  private selected = SKILL_TREE_ORIGIN;
  private hovered: string | null = null;
  private readonly tooltipMotion = new TooltipMotion();
  private reachableOnly = false;
  private resultsDismissed = false;
  private allocated = new Set<string>();
  private reachable = new Set<string>();
  private zoom = .8;
  private fitMode: 'all' | 'origin' | null = null;
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
        <div class="skill-atlas-points" aria-live="polite"></div><button class="ui-button ui-button--quiet ui-button--icon" data-tree="close" aria-label="Close skill tree">${uiIcon('close')}</button></header>
      <nav class="skill-atlas-controller" aria-label="Controller sections"><kbd>LB</kbd><span data-pad-section="0">Tree</span><span data-pad-section="1">Node</span><span data-pad-section="2">Skills</span><kbd>RB</kbd><small data-pad-help></small></nav>
      <div class="skill-atlas-main"><section class="skill-atlas-chart" aria-label="Skill atlas navigation">
        <div class="skill-atlas-toolbar"><label class="skill-atlas-search"><span>${uiIcon('center')}</span><input type="search" placeholder="Find a skill or bonus…" aria-label="Search skills and bonuses" maxlength="80"></label>
          <button class="ui-button ui-button--quiet" data-tree="reachable" aria-pressed="false">Reachable</button></div>
        <div class="skill-atlas-results ui-scroll-area" hidden aria-label="Matching paths"></div>
        <div class="skill-atlas-viewport"><canvas tabindex="0" role="application" aria-label="Skill territory map. Arrow keys inspect connected nodes, Enter centers the selected node, plus and minus zoom." aria-describedby="skill-atlas-selection"></canvas>
          <div class="ui-tooltip skill-atlas-tooltip" role="tooltip" hidden></div>
          <div class="skill-atlas-compass" aria-hidden="true"><span>✦</span><small data-atlas-context>THE SIX TERRITORIES</small></div>
          <div class="skill-atlas-zoom"><button class="ui-button ui-button--icon" data-tree="out" aria-label="Zoom out">−</button><output>80%</output><button class="ui-button ui-button--icon" data-tree="in" aria-label="Zoom in">+</button><button class="ui-button ui-button--quiet" data-tree="origin">Origin</button><button class="ui-button ui-button--quiet" data-tree="overview">All</button><button class="ui-button ui-button--quiet" data-tree="details" aria-expanded="true" aria-controls="skill-atlas-sidebar">Details</button></div>
          <div class="skill-atlas-navigator"><span>ATLAS <small>drag to explore</small></span><canvas tabindex="0" aria-label="Atlas navigator. Click or drag to move the view. Arrow keys pan, Enter shows the whole atlas."></canvas></div>
        </div></section>
        <aside class="skill-atlas-sidebar" id="skill-atlas-sidebar"><div class="skill-atlas-inspection ui-scroll-area" tabindex="-1" id="skill-atlas-selection" aria-live="polite"></div>
          <section class="skill-atlas-loadout"><div class="skill-atlas-section-heading"><span class="ui-kicker">Skills</span><span class="ui-muted" data-slot-help></span></div><div class="skill-atlas-assignments"></div></section>
        </aside></div>
      <footer class="ui-window-footer skill-atlas-footer"><span><b>${SKILL_TREE.nodes.length.toLocaleString('en-US')}</b> nodes <i>·</i> <b>${SKILL_TREE.clusters.length}</b> clusters <i>·</i> <b>${Object.keys(SKILL_DEFINITIONS).length}</b> skills</span><span>One skill point per level</span></footer>
    </section>`;
    mount.append(this.root);
    this.canvas = this.root.querySelector('canvas')!;
    this.navigator = this.root.querySelector('.skill-atlas-navigator canvas')!;
    this.tooltip = this.root.querySelector('.skill-atlas-tooltip')!;
    this.detail = this.root.querySelector('.skill-atlas-inspection')!;
    this.results = this.root.querySelector('.skill-atlas-results')!;
    this.search = this.root.querySelector('input')!;
    this.points = this.root.querySelector('.skill-atlas-points')!;
    this.assignments = this.root.querySelector('.skill-atlas-assignments')!;
    this.zoomLabel = this.root.querySelector('output')!;
    const opts = { signal: this.life.signal };
    this.root.addEventListener('pointerdown', () => this.root.classList.remove('is-controller'), opts);
    this.clearTouch = bindTouchCanvas(this.canvas,this.life.signal,{
      start:()=>{this.setHovered(null); this.lastClickedNode=this.doubleClickedNode=null;},
      pan:(dx,dy)=>{this.fitMode=null;this.centerX-=dx/this.zoom;this.centerY-=dy/this.zoom;this.clampCenter();this.invalidate();},
      zoom:(factor,p)=>this.setZoom(this.zoom*factor,p.x,p.y),
      tap:p=>{const r=this.canvas.getBoundingClientRect();const node=this.pick(r.left+p.x,r.top+p.y);if(node){this.inspectNode(node.id,false);if(window.innerWidth<620)this.detail.scrollIntoView({block:'nearest'});}},
    });
    this.root.addEventListener('click', event => this.click(event), opts);
    this.root.addEventListener('change', event => {
      const input = event.target as HTMLSelectElement, id = input.dataset.skill as SkillId;
      if (!id || !this.player) return;
      const sheet = this.player.character;
      this.actions.develop({ type: 'configureSkill', skill: id,
        rank: input.dataset.config === 'rank' ? Number(input.value) : Math.max(1, activeSkillRank(sheet,id)),
        specialization: input.dataset.config === 'variant' ? input.value || null : sheet.skillSpecializations[id] ?? null });
    }, opts);
    this.search.addEventListener('input', () => { this.resultsDismissed = false; this.updateResults(); this.invalidate(); }, opts);
    this.canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
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
        this.setHovered(id);
      }
    }, opts);
    this.canvas.addEventListener('pointerup', event => {
      if (this.drag?.pointer !== event.pointerId) return;
      const node = !this.drag.moved ? this.pick(event.clientX, event.clientY) : null;
      this.doubleClickedNode = node && this.lastClickedNode === node.id ? node.id : null;
      this.lastClickedNode = node?.id ?? null;
      if (node) this.inspectNode(node.id, false);
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
      this.drag = undefined; this.lastClickedNode = this.doubleClickedNode = null;
    }, opts);
    this.canvas.addEventListener('pointerleave', () => this.setHovered(null), opts);
    this.canvas.addEventListener('wheel', event => {
      event.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1);
      this.setZoom(this.zoom * Math.exp(-Math.max(-250, Math.min(250, delta)) * .0015), event.clientX - rect.left, event.clientY - rect.top);
    }, { ...opts, passive: false });
    this.canvas.addEventListener('keydown', event => this.key(event), opts);
    const navigate = (event:PointerEvent) => {
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
    this.updateDetail(); this.updateAssignments(); this.updateResults(); this.invalidate();
    if (this.shown && focusedControl) {
      const replacement = [...this.root.querySelectorAll<HTMLButtonElement>(`[${focusedControl.attribute}]`)]
        .find(button => button.getAttribute(focusedControl.attribute) === focusedControl.value && !button.disabled);
      (replacement ?? this.canvas).focus({ preventScroll: true });
    }
  }
  updateGamepad(pad: GamepadInput, now: number): void {
    if (!this.shown) return;
    const elapsed = Math.min(50, Math.max(0, now - this.controllerTime)); this.controllerTime = now;
    if (!pad.active) { this.controller.clear(); return; }
    if (!this.root.classList.contains('is-controller')) {
      this.root.classList.add('is-controller'); this.setHovered(null); this.selectControllerSection(0);
    }
    if (pad.pressed.has(PAD.skill3)) { this.selectControllerSection(2); return; }
    const region = this.controllerRegion();
    if (this.controllerSection === 1 && Math.abs(pad.aim.y) > .2) this.detail.scrollBy({ top: pad.aim.y * elapsed * .65 });
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
      : this.controllerSection === 1 ? this.detail : this.root.querySelector('.skill-atlas-loadout')!;
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
    this.controller.clear(); this.root.classList.remove('is-controller'); this.controllerSection = 0;
    this.clearTouch?.();
    this.lastClickedNode = this.doubleClickedNode = null;
    this.atlasDirty = true; this.lightPlan = undefined;
    this.atlasSurface.width = this.atlasSurface.height = 0;
    this.shown = false; this.root.hidden = true; this.focus?.dispose(); this.focus = undefined;
    this.drag = undefined; this.hovered = null; this.tooltipMotion.reset(); this.tooltip.hidden = true;
    if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0;
  }
  dispose(): void { this.close(); this.life.abort(); this.observer.disconnect(); this.root.remove(); }

  /** Also used by frozen review scenes; it changes presentation only. */
  inspectNode(id: string, center = true): void {
    const node = SKILL_NODES.get(id); if (!node) return;
    this.selected = id; this.hovered = null; this.tooltipMotion.reset(); this.tooltip.hidden = true;
    if (center) { this.centerX = node.x; this.centerY = node.y; this.setZoom(Math.max(.65, this.zoom)); }
    this.updateDetail(); this.updateAssignments(); this.detail.scrollTop = 0; this.invalidate();
  }
  private click(event: MouseEvent): void {
    const button = (event.target as Element).closest<HTMLButtonElement>('button'); if (!button) return;
    if (button.dataset.slot) {
      const index = Number(button.dataset.slot) - 1, node = SKILL_NODES.get(this.selected)!;
      if (node.skill && this.allocated.has(node.id)) this.actions.assign(index, node.skill);
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
      this.resultsDismissed = true; this.updateResults();
      this.inspectNode(button.dataset.node); this.selectControllerSection(0); return;
    }
    if (button.dataset.clear) { this.actions.assign(Number(button.dataset.clear) - 1, null); return; }
    const action = button.dataset.tree;
    if (action === 'close') this.actions.close();
    else if (action === 'assign') this.selectControllerSection(2);
    else if (action === 'allocate') this.actions.allocate(button.dataset.inspected ?? this.selected);
    else if (action === 'origin') this.showOrigin();
    else if (action === 'overview') this.showOverview();
    else if (action === 'details') this.setDetailsVisible(this.root.classList.contains('is-map-only'));
    else if (action === 'in') this.setZoom(this.zoom * 1.15);
    else if (action === 'out') this.setZoom(this.zoom / 1.15);
    else if (action === 'reachable') {
      this.reachableOnly = !this.reachableOnly; this.resultsDismissed = false;
      button.setAttribute('aria-pressed', String(this.reachableOnly)); this.updateResults(); this.invalidate();
    }
  }
  private key(event: KeyboardEvent): void {
    if (event.key === '+' || event.key === '=') { event.preventDefault(); this.setZoom(this.zoom * 1.2); return; }
    if (event.key === '-') { event.preventDefault(); this.setZoom(this.zoom / 1.2); return; }
    if (event.key === 'Enter') { event.preventDefault(); this.inspectNode(this.selected); return; }
    const direction = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    const current = SKILL_NODES.get(this.selected)!;
    const choices = current.neighbors.map(id => SKILL_NODES.get(id)!).map(node => {
      const dx = node.x - current.x, dy = node.y - current.y;
      return { node, alignment: (dx * direction[0] + dy * direction[1]) / Math.hypot(dx, dy) };
    }).sort((a, b) => b.alignment - a.alignment);
    if (choices[0]?.alignment > .1) this.inspectNode(choices[0].node.id);
  }
  private setHovered(id: string | null): void {
    if (id === this.hovered) return;
    this.hovered = id;
    this.tooltipMotion.set(id, performance.now(), window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.canvas.style.cursor = id ? 'pointer' : 'grab';
    this.updateDetail(); this.invalidate();
  }
  private updateDetail(): void {
    if (!this.player) return;
    const node = SKILL_NODES.get(this.hovered ?? this.selected)!, owned = this.allocated.has(node.id), reachable = this.reachable.has(node.id);
    const skill = node.skill ? SKILL_DEFINITIONS[node.skill] : undefined;
    const costs = skill ? resolveSkill(skill.id, this.player.derived, this.player.character) : undefined;
    const heading = skillNodeRole(node), owner = skillNodeOwner(node);
    const routeCost = this.routes.get(node.id)?.cost;
    const cluster = SKILL_TREE.clusters.find(cluster => cluster.id === node.cluster);
    const bonuses = (Object.entries(scaleTreeDefenses(node.bonuses, this.player.level)) as [StatKey, number][]).map(([key, value]) => `<div class="ui-stat"><span>${STAT_LABELS[key]}${key==='armor'?' (scales with level)':''}</span><b>${formatStatValue(key, value)}</b></div>`).join('');
    this.detail.classList.toggle('has-skill', !!skill);
    this.detail.innerHTML = `<header class="skill-node-heading"><div class="skill-atlas-emblem" style="--star-color:${COLORS[node.domain]}">${skillNodeIconSVG(node, 48)}</div>
      <div><p class="ui-kicker">${heading}</p><h3>${escapeUI(node.name)}</h3><p class="skill-atlas-domain" style="color:${COLORS[node.domain]}">${node.kind === 'origin' ? 'Six territories · one shared root' : escapeUI(owner && !skill ? owner.name : cluster && !cluster.id.startsWith('development:') ? `${node.domain} / ${cluster.name}` : node.domain)}</p></div></header>
      <p class="skill-atlas-description">${node.kind==='origin'&&this.player.character.treeRefunded?'Your previous tree and rank points have been refunded. Your character and world progress are preserved. Unlock your skills again and assign them to the five skill slots. The game is paused while this tree is open. ':''}${escapeUI(node.description)}${node.skill && costs?.variant ? `</p><p class="skill-atlas-description">${escapeUI(costs.variant.description)}` : ''}</p>${node.specialization ? `<p class="skill-atlas-requirement">${owned ? 'Variant for' : 'Unlock & activate for'} <b>${escapeUI(owner!.name)}</b>.</p>` : ''}${node.specialization ? specializationPreviewMarkup(node.specialization, this.player.derived, this.player.character) : ''}${bonuses ? `<div class="skill-atlas-bonuses ui-well">${bonuses}</div>` : ''}
      ${skill ? `<p class="skill-atlas-requirement ${canUseSkill(skill.id, this.player.equipment) ? 'is-ready' : ''}">Requires ${escapeUI(skillRequirementLabel(skill.requirement))}</p><div class="skill-atlas-skill-costs">${owned ? `<span class="skill-casting-rank">Casting rank ${costs!.rank}</span>` : ''}<span><b>${costs!.mana}</b> mana</span><span>${costs!.cooldown ? `<b>${Number(costs!.cooldown.toFixed(2))}s</b> cooldown` : 'No cooldown'}</span>${skill.damageMultiplier ? `<span><b>${Math.round(costs!.damageMultiplier * 100)}%</b> damage${skillDamageSuffix(skill.id, costs!.recipe)}</span>` : `<span>${costs!.recipe.kind === 'guard' ? `${costs!.recipe.duration}s · ${Math.round(costs!.recipe.reduction*100)}% block` : skillUtilityLabel(skill.id, costs!.recipe)}</span>`}${skill.damageMultiplier&&skillUtilityLabel(skill.id,costs!.recipe)?`<span>${skillUtilityLabel(skill.id,costs!.recipe)}</span>`:''}${costs!.upkeep ? `<span><b>${costs!.upkeep}</b> mana / second</span>` : ''}</div>` : ''}
      <div class="skill-atlas-allocation"><span class="skill-atlas-node-state ${owned ? 'is-owned' : ''}">${owned ? '◆ Allocated' : reachable ? '◇ Connected to your path' : routeCost !== undefined ? `◇ ${routeCost} ${routeCost === 1 ? 'point' : 'points'} along the highlighted path` : '◇ No connected path'}</span>
        ${owned ? '' : `<button class="ui-button ui-button--primary" data-tree="allocate" data-inspected="${node.id}" ${routeCost === undefined || this.player.character.skillPoints < routeCost ? 'disabled' : ''}>${routeCost === 1 ? 'Allocate' : 'Allocate path'} <span>${routeCost ?? '—'} ${routeCost === 1 ? 'point' : 'points'}</span></button>`}
        ${!owned && routeCost !== undefined && this.player.character.skillPoints < routeCost ? `<small class="ui-muted">${routeCost - this.player.character.skillPoints} more ${routeCost - this.player.character.skillPoints === 1 ? 'point' : 'points'} needed.</small>` : ''}</div>
      ${skill && owned ? '<button class="ui-button ui-button--quiet skill-assign-action" data-tree="assign">Assign skill <span class="controller-binding">X</span></button>' : ''}${this.progressionControls(node, owned)}`;
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
      ${next ? `<div class="skill-rank-preview"><span>Next</span><span>${next.recipe.kind === 'guard' && current.recipe.kind === 'guard' ? `${Math.round(current.recipe.reduction*100)} → ${Math.round(next.recipe.reduction*100)}% block · ${Number(current.recipe.duration.toFixed(2))} → ${Number(next.recipe.duration.toFixed(2))}s` : current.damageMultiplier ? `${Math.round(current.damageMultiplier*100)} → ${Math.round(next.damageMultiplier*100)}% damage` : `${skillUtilityLabel(id,current.recipe)} → ${skillUtilityLabel(id,next.recipe)}`}</span><span>${current.mana} → ${next.mana} mana</span>${next.cooldown ? `<span>${Number(next.cooldown.toFixed(2))}s cooldown</span>` : ''}</div>` : ''}
      <div class="skill-active-controls"><label>Active rank<select class="ui-button" data-config="rank" data-skill="${id}" aria-label="Active rank for ${SKILL_DEFINITIONS[id].name}">${Array.from({length:learned},(_,i)=>`<option value="${i+1}" ${i+1===active?'selected':''}>${i+1}</option>`).join('')}</select></label>
        <label>Technique<select class="ui-button" data-config="variant" data-skill="${id}" aria-label="Technique for ${SKILL_DEFINITIONS[id].name}" ${!unlocked.length ? 'disabled' : ''}><option value="">Original</option>${unlocked.map(v=>`<option value="${v.id}" ${selected?.id===v.id?'selected':''}>${v.name}</option>`).join('')}</select></label></div>
      ${variants.length ? `<details class="skill-variant-links"><summary>Explore Techniques <span>${unlocked.length} / ${variants.length}</span></summary>${variants.map(v=>`<button class="ui-button ui-button--quiet" data-node="${specializationNode(v.id)}"><span>${v.name}</span><small>${selected?.id===v.id?'Active':sheet.allocatedNodes.includes(specializationNode(v.id))?'Unlocked':'↗'}</small></button>`).join('')}
</details>` : ''}</section>`;
  }
  private updateAssignments(): void {
    if (!this.player) return;
    const skills = new Set(unlockedSkills(this.player.character.allocatedNodes));
    const node = SKILL_NODES.get(this.selected)!, assigning = !!node.skill && this.allocated.has(node.id);
    this.root.querySelector('[data-slot-help]')!.textContent = assigning ? `Assign ${SKILL_DEFINITIONS[node.skill!].name}` : '';
    this.assignments.innerHTML = BINDINGS.map((binding, index) => {
      const id = this.player!.character.skillSlots[index], skill = id && skills.has(id) ? SKILL_DEFINITIONS[id] : null;
      return `<div class="skill-atlas-assigned ${skill ? 'is-filled' : ''}"><button class="ui-button ui-button--quiet skill-slot-button" data-slot="${index+1}" aria-label="${assigning ? `Assign ${SKILL_DEFINITIONS[node.skill!].name} to` : 'Inspect'} ${binding}${skill ? `, ${skill.name}` : ', empty slot'}" title="${skill?.name ?? 'Empty slot'}" ${!assigning && !skill ? 'disabled' : ''}><span class="skill-atlas-assigned-icon" ${skill ? `style="color:${skill.color}"` : ''}>${skill ? skillIconSVG(skill.id, 24) : '◇'}</span><small><span class="desktop-binding">${binding}</span><span class="controller-binding">${PAD_SKILL_LABELS[index+1]}</span><span class="touch-only">${index+1}</span></small></button>${skill ? `<button class="ui-button ui-button--quiet skill-slot-clear" data-clear="${index+1}" aria-label="Remove ${skill.name} from ${binding}">×</button>` : ''}</div>`;
    }).join('');
  }

  private matches(node: SkillNode): boolean { return this.matching.has(node.id); }
  private updateResults(): void {
    const query = this.search.value.trim().toLowerCase();
    this.matching = new Set(SKILL_TREE.nodes.filter(node =>
      (!this.reachableOnly || this.reachable.has(node.id))
      && (!query || SEARCH_TEXT.get(node.id)!.includes(query))).map(node => node.id));
    const active = !this.resultsDismissed && (!!this.search.value.trim() || this.reachableOnly);
    this.results.hidden = !active;
    if (!active) return;
    const matches = SKILL_TREE.nodes.filter(node => this.matches(node)).sort((a, b) => {
      const state = (node: SkillNode) => this.allocated.has(node.id) ? 0 : this.reachable.has(node.id) ? 1 : 2;
      return state(a) - state(b) || Number(b.kind === 'major') - Number(a.kind === 'major') || Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y);
    });
    this.results.innerHTML = `<div class="skill-atlas-result-count">${matches.length} ${matches.length === 1 ? 'star' : 'stars'}${matches.length > 12 ? ' · nearest 12 shown' : ''}</div>${matches.slice(0, 12).map(node => `<button class="ui-button ui-button--quiet" data-node="${node.id}"><span>${escapeUI(node.name)}</span><small style="color:${COLORS[node.domain]}">${this.allocated.has(node.id) ? 'Allocated' : this.reachable.has(node.id) ? 'Reachable' : node.domain}</small></button>`).join('') || '<p class="ui-muted">No matching stars.</p>'}`;
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
    const nodes=SKILL_TREE.nodes.filter(n=>Math.hypot(n.x/1.8,n.y/.72)<720);
    const fit=fitAtlasBounds(mode==='all'?SKILL_TREE.bounds:boundsForNodes(nodes),this.width,this.height);
    this.centerX=fit.centerX;this.centerY=fit.centerY;this.setZoom(fit.zoom);this.fitMode=mode;
  }
  showOverview(): void {
    this.fitMode='all';this.fitCurrentRegion();
  }
  private showOrigin(): void {
    this.fitMode='origin';this.fitCurrentRegion();this.inspectNode(SKILL_TREE_ORIGIN,false);
  }
  setDetailsVisible(visible: boolean): void {
    const sidebar = this.root.querySelector<HTMLElement>('.skill-atlas-sidebar')!;
    if (!visible && sidebar.contains(document.activeElement)) this.canvas.focus();
    sidebar.hidden = !visible; this.root.classList.toggle('is-map-only', !visible);
    this.root.querySelector('[data-tree="details"]')!.setAttribute('aria-expanded', String(visible));
    this.resize();
  }
  /** Presentation-only camera access for frozen review and atlas navigation. */
  setView(centerX: number, centerY: number, zoom: number): void {
    if (![centerX, centerY, zoom].every(Number.isFinite)) return;
    this.centerX = centerX; this.centerY = centerY; this.setZoom(zoom);
  }
  private setZoom(value: number, x = this.width / 2, y = this.height / 2): void {
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
      c.strokeStyle=view.allocated.has(a.id)&&view.allocated.has(b.id)?'#ffdc9c':'#8fb6c43d';
      c.beginPath();c.moveTo(sx(a.x),sy(a.y));
      if(edge.control)c.quadraticCurveTo(sx(edge.control.x),sy(edge.control.y),sx(b.x),sy(b.y));else c.lineTo(sx(b.x),sy(b.y));c.stroke();
    }
    for(const n of SKILL_TREE.nodes)if(n.kind==='major'||n.kind==='origin'){
      c.fillStyle=view.allocated.has(n.id)?'#ffdc9c':COLORS[n.domain];c.beginPath();c.arc(sx(n.x),sy(n.y),n.kind==='origin'?2:1.1,0,Math.PI*2);c.fill();
    }
    const x=sx(view.centerX-view.width/2/view.zoom),y=sy(view.centerY-view.height/2/view.zoom),w=view.width/view.zoom*p.scale,h=view.height/view.zoom*p.scale;
    const left=Math.max(2,x),top=Math.max(2,y),right=Math.min(rect.width-2,x+w),bottom=Math.min(rect.height-2,y+h);
    c.fillStyle='#b6e5ff10';c.fillRect(left,top,right-left,bottom-top);c.strokeStyle='#bce8ffb0';c.lineWidth=1;c.strokeRect(left+.5,top+.5,right-left,bottom-top);
    this.root.querySelector('[data-atlas-context]')!.textContent=this.zoom<.22?'THE SIX TERRITORIES':this.zoom<.5?'ROADS & CONSTELLATIONS':'SKILLS & TECHNIQUES';
  }
  private draw(): void {
    const ctx = this.canvas.getContext('2d'); if (!ctx) return;
    const tooltip = this.tooltipMotion.sample(performance.now());
    const view: SkillAtlasView = { width: this.width, height: this.height, zoom: this.zoom,
      centerX: this.centerX, centerY: this.centerY, allocated: this.allocated, reachable: this.reachable,
      sheet: this.player?.character, selected: this.selected, hovered: this.hovered, route: previewSkillRoute(this.routes, this.hovered ?? this.selected),
      matches: node => this.matches(node) };
    const now = performance.now(), dirty = this.atlasDirty;
    if (dirty) {
      this.atlasSurface.width = this.canvas.width; this.atlasSurface.height = this.canvas.height;
      const base = this.atlasSurface.getContext('2d')!;
      base.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);
      const canvasBounds=this.canvas.getBoundingClientRect();
      view.labelExclusions=[...this.root.querySelectorAll<HTMLElement>('.skill-atlas-zoom, .skill-atlas-navigator, [data-atlas-context]')].map(element=>{
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
    this.tooltip.hidden = !node;
    if (node && (dirty || tooltip.active)) {
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
