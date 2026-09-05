import type { Player } from './model.ts';
import type { SkillId, StatKey } from './character-types.ts';
import { SKILL_DEFINITIONS, skillIconSVG } from './skill-content.ts';
import { SKILL_TREE, SKILL_NODES, SKILL_TREE_ORIGIN, unlockedSkills, type SkillDomain, type SkillNode } from './skill-tree.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { drawSkillAtlas, SKILL_DOMAIN_COLORS, skillNodeRadius } from './skill-tree-art.ts';
import { skillNodeIconSVG } from './skill-tree-glyphs.ts';
import { buildSkillRoutes, previewSkillRoute, type SkillRouteStep } from './skill-tree-routes.ts';
import { STAT_LABELS, formatStatValue } from './items.ts';
import './skill-tree-panel.css';

interface SkillTreeActions { close(): void; allocate(id: string): void; assign(slot: number, skill: SkillId | null): void; }
const COLORS = SKILL_DOMAIN_COLORS;
const BINDINGS = ['RMB', '1', '2', '3', '4'];

/** Native-resolution atlas, drawn only when its view/state changes. Simulation owns allocations. */
export class SkillTreePanel {
  private root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
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
  private domain: SkillDomain | 'all' = 'all';
  private reachableOnly = false;
  private resultsDismissed = false;
  private allocated = new Set<string>();
  private reachable = new Set<string>();
  private zoom = .8;
  private routes = new Map<string, SkillRouteStep>();
  private centerX = 0;
  private centerY = 0;
  private width = 1;
  private height = 1;
  private frame = 0;
  private drag?: { pointer: number; x: number; y: number; startX: number; startY: number; moved: boolean };
  private shown = false;

  constructor(mount: HTMLElement, actions: SkillTreeActions) {
    this.actions = actions;
    this.root = document.createElement('div');
    this.root.className = 'skill-atlas';
    this.root.hidden = true;
    this.root.innerHTML = `<section class="ui-window skill-atlas-window" role="dialog" aria-modal="true" aria-labelledby="skill-atlas-title">
      <header class="ui-window-header skill-atlas-header"><div><p class="ui-kicker">THE ASTRAL ATLAS</p><h2 class="ui-title" id="skill-atlas-title">The living atlas</h2></div>
        <div class="skill-atlas-points" aria-live="polite"></div><button class="ui-button ui-button--quiet ui-button--icon" data-tree="close" aria-label="Close skill tree">${uiIcon('close')}</button></header>
      <div class="skill-atlas-main"><section class="skill-atlas-chart" aria-label="Skill atlas navigation">
        <div class="skill-atlas-toolbar"><label class="skill-atlas-search"><span>${uiIcon('center')}</span><input type="search" placeholder="Find a skill or bonus…" aria-label="Search skills and bonuses" maxlength="80"></label>
          <select class="ui-button" aria-label="Filter skill domain"><option value="all">All paths</option><option>Might</option><option>Cunning</option><option>Arcana</option></select>
          <button class="ui-button ui-button--quiet" data-tree="reachable" aria-pressed="false">Reachable</button></div>
        <div class="skill-atlas-results ui-scroll-area" hidden aria-label="Matching stars"></div>
        <div class="skill-atlas-viewport"><canvas tabindex="0" role="application" aria-label="Skill constellation map. Arrow keys inspect connected stars, Enter centers the selected star, plus and minus zoom." aria-describedby="skill-atlas-selection"></canvas>
          <div class="skill-atlas-compass" aria-hidden="true"><span>✦</span><small>EVERY PATH, A CHOICE</small></div>
          <div class="skill-atlas-zoom"><button class="ui-button ui-button--icon" data-tree="out" aria-label="Zoom out">−</button><output>80%</output><button class="ui-button ui-button--icon" data-tree="in" aria-label="Zoom in">+</button><button class="ui-button ui-button--quiet" data-tree="origin">Origin</button><button class="ui-button ui-button--quiet" data-tree="overview">All</button></div>
          <div class="skill-atlas-domains" aria-hidden="true"><span>Might</span><span>Cunning</span><span>Arcana</span></div>
        </div></section>
        <aside class="skill-atlas-sidebar ui-scroll-area"><div class="skill-atlas-inspection" id="skill-atlas-selection" aria-live="polite"></div>
          <section class="skill-atlas-loadout"><div class="skill-atlas-section-heading"><span class="ui-kicker">ACTIVE SKILLS</span><span class="ui-muted">5 slots</span></div><div class="skill-atlas-assignments"></div></section>
        </aside></div>
      <footer class="ui-window-footer skill-atlas-footer"><span><b>${SKILL_TREE.nodes.length.toLocaleString('en-US')}</b> nodes <i>·</i> <b>${SKILL_TREE.clusters.length}</b> clusters <i>·</i> <b>6</b> skills</span><span>One skill point per level</span></footer>
    </section>`;
    mount.append(this.root);
    this.canvas = this.root.querySelector('canvas')!;
    this.detail = this.root.querySelector('.skill-atlas-inspection')!;
    this.results = this.root.querySelector('.skill-atlas-results')!;
    this.search = this.root.querySelector('input')!;
    this.points = this.root.querySelector('.skill-atlas-points')!;
    this.assignments = this.root.querySelector('.skill-atlas-assignments')!;
    this.zoomLabel = this.root.querySelector('output')!;
    const opts = { signal: this.life.signal };
    this.root.addEventListener('click', event => this.click(event), opts);
    this.search.addEventListener('input', () => { this.resultsDismissed = false; this.updateResults(); this.invalidate(); }, opts);
    this.root.querySelector('select')!.addEventListener('change', event => {
      this.domain = (event.target as HTMLSelectElement).value as SkillDomain | 'all'; this.resultsDismissed = false; this.updateResults(); this.invalidate();
    }, opts);
    this.canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      this.canvas.focus(); this.canvas.setPointerCapture(event.pointerId);
      this.drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
    }, opts);
    this.canvas.addEventListener('pointermove', event => {
      if (this.drag) {
        const d = this.drag;
        if (Math.hypot(event.clientX - d.startX, event.clientY - d.startY) > 4) d.moved = true;
        if (d.moved) { this.centerX -= (event.clientX - d.x) / this.zoom; this.centerY -= (event.clientY - d.y) / this.zoom; this.clampCenter(); }
        d.x = event.clientX; d.y = event.clientY; this.invalidate();
      } else {
        const node = this.pick(event.clientX, event.clientY), id = node?.id ?? null;
        if (id !== this.hovered) { this.hovered = id; this.canvas.style.cursor = id ? 'pointer' : 'grab'; this.invalidate(); }
      }
    }, opts);
    this.canvas.addEventListener('pointerup', event => {
      if (this.drag?.pointer !== event.pointerId) return;
      if (!this.drag.moved) { const node = this.pick(event.clientX, event.clientY); if (node) this.inspectNode(node.id, false); }
      this.drag = undefined;
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    }, opts);
    this.canvas.addEventListener('pointercancel', () => { this.drag = undefined; }, opts);
    this.canvas.addEventListener('pointerleave', () => { this.hovered = null; this.invalidate(); }, opts);
    this.canvas.addEventListener('wheel', event => {
      event.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1);
      this.setZoom(this.zoom * Math.exp(-Math.max(-250, Math.min(250, delta)) * .0015), event.clientX - rect.left, event.clientY - rect.top);
    }, { ...opts, passive: false });
    this.canvas.addEventListener('keydown', event => this.key(event), opts);
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
      ? ['data-tree', 'data-assign', 'data-clear'].flatMap(attribute => {
        const value = active.getAttribute(attribute);
        return value === null ? [] : [{ attribute, value }];
      })[0] : undefined;
    this.player = player; this.allocated = new Set(player.character.allocatedNodes); this.reachable.clear();
    for (const id of this.allocated) for (const neighbor of SKILL_NODES.get(id)?.neighbors ?? []) if (!this.allocated.has(neighbor)) this.reachable.add(neighbor);
    this.routes = buildSkillRoutes(this.allocated);
    this.points.innerHTML = `<strong>${player.character.skillPoints}</strong><span>SKILL ${player.character.skillPoints === 1 ? 'POINT' : 'POINTS'}</span>`;
    this.updateDetail(); this.updateAssignments(); this.updateResults(); this.invalidate();
    if (this.shown && focusedControl) {
      const replacement = [...this.root.querySelectorAll<HTMLButtonElement>(`button[${focusedControl.attribute}]`)]
        .find(button => button.getAttribute(focusedControl.attribute) === focusedControl.value && !button.disabled);
      (replacement ?? this.canvas).focus({ preventScroll: true });
    }
  }
  close(): void {
    this.shown = false; this.root.hidden = true; this.focus?.dispose(); this.focus = undefined;
    this.drag = undefined; this.hovered = null;
    if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0;
  }
  dispose(): void { this.close(); this.life.abort(); this.observer.disconnect(); this.root.remove(); }

  /** Also used by frozen review scenes; it changes presentation only. */
  inspectNode(id: string, center = true): void {
    const node = SKILL_NODES.get(id); if (!node) return;
    this.selected = id;
    if (center) { this.centerX = node.x; this.centerY = node.y; }
    this.updateDetail(); this.invalidate();
  }
  private click(event: MouseEvent): void {
    const button = (event.target as Element).closest<HTMLButtonElement>('button'); if (!button) return;
    if (button.dataset.node) {
      this.resultsDismissed = true; this.updateResults();
      this.inspectNode(button.dataset.node); this.canvas.focus({ preventScroll: true }); return;
    }
    if (button.dataset.assign) {
      const skill = SKILL_NODES.get(this.selected)?.skill;
      if (skill && this.allocated.has(this.selected)) this.actions.assign(Number(button.dataset.assign) - 1, skill);
      return;
    }
    if (button.dataset.clear) { this.actions.assign(Number(button.dataset.clear) - 1, null); return; }
    const action = button.dataset.tree;
    if (action === 'close') this.actions.close();
    else if (action === 'allocate') this.actions.allocate(this.selected);
    else if (action === 'origin') this.showOrigin();
    else if (action === 'overview') this.showOverview();
    else if (action === 'in') this.setZoom(this.zoom * 1.25);
    else if (action === 'out') this.setZoom(this.zoom / 1.25);
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
  private updateDetail(): void {
    if (!this.player) return;
    const node = SKILL_NODES.get(this.selected)!, owned = this.allocated.has(node.id), reachable = this.reachable.has(node.id);
    const skill = node.skill ? SKILL_DEFINITIONS[node.skill] : undefined;
    const heading = node.kind === 'origin' ? 'YOUR ORIGIN' : node.kind === 'major' ? 'MAJOR · ACTIVE SKILL' : node.kind === 'notable' ? 'NOTABLE · SPECIALIZATION' : node.role === 'travel' ? 'TRAVEL NODE' : 'MINOR · PASSIVE';
    const routeCost = this.routes.get(node.id)?.cost;
    const cluster = SKILL_TREE.clusters.find(cluster => cluster.id === node.cluster);
    const bonuses = (Object.entries(node.bonuses) as [StatKey, number][]).map(([key, value]) => `<div class="ui-stat"><span>${STAT_LABELS[key]}</span><b>${formatStatValue(key, value)}</b></div>`).join('');
    this.detail.innerHTML = `<div class="skill-atlas-emblem" style="--star-color:${COLORS[node.domain]}">${skillNodeIconSVG(node, 48)}</div>
      <p class="ui-kicker">${heading}</p><h3>${escapeUI(node.name)}</h3><p class="skill-atlas-domain" style="color:${COLORS[node.domain]}">${node.kind === 'origin' ? 'Might · Cunning · Arcana' : escapeUI(cluster ? `${node.domain} / ${cluster.name}` : node.domain)}</p>
      <p class="skill-atlas-description">${escapeUI(node.description)}</p>${bonuses ? `<div class="skill-atlas-bonuses ui-well">${bonuses}</div>` : ''}
      ${skill ? `<div class="skill-atlas-skill-costs"><span><b>${skill.manaCost}</b> mana</span><span><b>${skill.cooldown}s</b> cooldown</span><span><b>${Math.round(skill.damageMultiplier * 100)}%</b> damage${node.skill === 'volley' ? ' / thorn' : ''}</span></div>` : ''}
      <div class="skill-atlas-allocation"><span class="skill-atlas-node-state ${owned ? 'is-owned' : ''}">${owned ? '◆ Allocated' : reachable ? '◇ Connected to your path' : routeCost !== undefined ? `◇ ${routeCost} ${routeCost === 1 ? 'point' : 'points'} along the highlighted path` : '◇ No connected path'}</span>
        ${owned ? '' : `<button class="ui-button ui-button--primary" data-tree="allocate" ${!reachable || this.player.character.skillPoints < 1 ? 'disabled' : ''}>Allocate <span>1 point</span></button>`}
        ${!owned && reachable && this.player.character.skillPoints < 1 ? '<small class="ui-muted">Your next level grants one skill point.</small>' : ''}</div>
      ${skill && owned ? `<div class="skill-atlas-equip"><p class="ui-kicker">ASSIGN TO A SLOT</p><div>${BINDINGS.map((binding, index) => `<button class="ui-button ${this.player!.character.skillSlots[index] === node.skill ? 'ui-button--primary' : 'ui-button--quiet'}" data-assign="${index + 1}" aria-label="Assign ${skill.name} to ${binding}">${binding}</button>`).join('')}</div></div>` : ''}`;
  }
  private updateAssignments(): void {
    if (!this.player) return;
    const skills = new Set(unlockedSkills(this.player.character.allocatedNodes));
    this.assignments.innerHTML = BINDINGS.map((binding, index) => {
      const id = this.player!.character.skillSlots[index], skill = id && skills.has(id) ? SKILL_DEFINITIONS[id] : null;
      return `<div class="skill-atlas-assigned ${skill ? 'is-filled' : ''}"><span class="skill-atlas-assigned-icon" ${skill ? `style="color:${skill.color}"` : ''}>${skill ? skillIconSVG(skill.id, 26) : '◇'}</span><div><span>${skill?.name ?? 'Empty slot'}</span><small>${binding}</small></div>${skill ? `<button class="ui-button ui-button--quiet ui-button--icon" data-clear="${index + 1}" aria-label="Remove ${skill.name} from ${binding}">×</button>` : ''}</div>`;
    }).join('');
  }
  private matches(node: SkillNode): boolean {
    if (this.domain !== 'all' && node.domain !== this.domain && node.kind !== 'origin') return false;
    if (this.reachableOnly && !this.reachable.has(node.id)) return false;
    const query = this.search.value.trim().toLowerCase();
    return !query || `${node.name} ${node.domain} ${node.description} ${Object.keys(node.bonuses).map(key => STAT_LABELS[key as StatKey]).join(' ')}`.toLowerCase().includes(query);
  }
  private updateResults(): void {
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
    this.canvas.width = Math.round(this.width * ratio); this.canvas.height = Math.round(this.height * ratio); this.invalidate();
  }
  private clampCenter(): void {
    const bounds = SKILL_TREE.bounds;
    this.centerX = Math.max(bounds.minX - 120, Math.min(bounds.maxX + 120, this.centerX));
    this.centerY = Math.max(bounds.minY - 120, Math.min(bounds.maxY + 120, this.centerY));
  }
  showOverview(): void {
    const b = SKILL_TREE.bounds;
    this.centerX = (b.minX + b.maxX) / 2; this.centerY = (b.minY + b.maxY) / 2;
    this.setZoom(Math.min((this.width - 80) / (b.maxX - b.minX), (this.height - 90) / (b.maxY - b.minY)));
  }
  private showOrigin(): void {
    this.centerX = 0; this.centerY = -35;
    this.setZoom(Math.min(.8, (this.width - 100) / 800, (this.height - 90) / 640));
    this.inspectNode(SKILL_TREE_ORIGIN, false);
  }
  /** Presentation-only camera access for frozen review and atlas navigation. */
  setView(centerX: number, centerY: number, zoom: number): void {
    if (![centerX, centerY, zoom].every(Number.isFinite)) return;
    this.centerX = centerX; this.centerY = centerY; this.setZoom(zoom);
  }
  private setZoom(value: number, x = this.width / 2, y = this.height / 2): void {
    const b = SKILL_TREE.bounds;
    const minimum = Math.min(.035, Math.max(.005, Math.min((this.width - 80) / (b.maxX - b.minX), (this.height - 90) / (b.maxY - b.minY))));
    const zoom = Math.max(minimum, Math.min(2.2, value));
    this.centerX += (x - this.width / 2) * (1 / this.zoom - 1 / zoom);
    this.centerY += (y - this.height / 2) * (1 / this.zoom - 1 / zoom);
    this.zoom = zoom; this.clampCenter(); this.zoomLabel.textContent = `${Math.round(zoom * 100)}%`; this.invalidate();
  }
  private pick(clientX: number, clientY: number): SkillNode | undefined {
    const rect = this.canvas.getBoundingClientRect(), x = (clientX - rect.left - this.width / 2) / this.zoom + this.centerX, y = (clientY - rect.top - this.height / 2) / this.zoom + this.centerY;
    let selected: SkillNode | undefined, distance = Infinity;
    for (const node of SKILL_TREE.nodes) {
      if (!this.matches(node)) continue;
      const d = Math.hypot(node.x - x, node.y - y), radius = skillNodeRadius(node);
      if (d < Math.max(radius, 12 / this.zoom) && d < distance) { selected = node; distance = d; }
    }
    return selected;
  }
  private invalidate(): void {
    if (!this.shown || this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.draw(); });
  }
  private draw(): void {
    const ctx = this.canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);
    drawSkillAtlas(ctx, { width: this.width, height: this.height, zoom: this.zoom,
      centerX: this.centerX, centerY: this.centerY, allocated: this.allocated, reachable: this.reachable,
      selected: this.selected, hovered: this.hovered, route: previewSkillRoute(this.routes, this.hovered ?? this.selected),
      matches: node => this.matches(node) });
  }
}
