import type { Player } from './model.ts';
import type { SkillId, StatKey } from './character-types.ts';
import { SKILL_DEFINITIONS, skillIconSVG } from './skill-content.ts';
import { SKILL_TREE, SKILL_NODES, SKILL_TREE_ORIGIN, unlockedSkills, type SkillDomain, type SkillNode } from './skill-tree.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { UI_THEME } from './ui-theme.ts';
import { STAT_LABELS, formatStatValue } from './items.ts';
import './skill-tree-panel.css';

interface SkillTreeActions { close(): void; allocate(id: string): void; assign(slot: number, skill: SkillId | null): void; }
const COLORS: Record<SkillDomain, string> = { Might: '#cba888', Cunning: '#91beb0', Arcana: '#b9a4dc' };
const BINDINGS = ['RMB', '1', '2', '3', '4'];
const EDGE_NODES = SKILL_TREE.edges.map(edge => [SKILL_NODES.get(edge.from)!, SKILL_NODES.get(edge.to)!] as const);

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
  private allocated = new Set<string>();
  private reachable = new Set<string>();
  private zoom = .82;
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
      <header class="ui-window-header skill-atlas-header"><div><p class="ui-kicker">THE ASTRAL ATLAS</p><h2 class="ui-title" id="skill-atlas-title">Skill constellations</h2></div>
        <div class="skill-atlas-points" aria-live="polite"></div><button class="ui-button ui-button--quiet ui-button--icon" data-tree="close" aria-label="Close skill tree">${uiIcon('close')}</button></header>
      <div class="skill-atlas-main"><section class="skill-atlas-chart" aria-label="Skill atlas navigation">
        <div class="skill-atlas-toolbar"><label class="skill-atlas-search"><span>${uiIcon('center')}</span><input type="search" placeholder="Find a skill or bonus…" aria-label="Search skills and bonuses" maxlength="80"></label>
          <select class="ui-button" aria-label="Filter skill domain"><option value="all">All paths</option><option>Might</option><option>Cunning</option><option>Arcana</option></select>
          <button class="ui-button ui-button--quiet" data-tree="reachable" aria-pressed="false">Reachable</button></div>
        <div class="skill-atlas-results ui-scroll-area" hidden aria-label="Matching stars"></div>
        <div class="skill-atlas-viewport"><canvas tabindex="0" role="application" aria-label="Skill constellation map. Arrow keys inspect connected stars, Enter centers the selected star, plus and minus zoom." aria-describedby="skill-atlas-selection"></canvas>
          <div class="skill-atlas-compass" aria-hidden="true"><span>✦</span><small>PATHS WITHOUT END</small></div>
          <div class="skill-atlas-zoom"><button class="ui-button ui-button--icon" data-tree="out" aria-label="Zoom out">−</button><output>82%</output><button class="ui-button ui-button--icon" data-tree="in" aria-label="Zoom in">+</button><button class="ui-button ui-button--quiet" data-tree="origin">Origin</button></div>
          <div class="skill-atlas-domains" aria-hidden="true"><span>Might</span><span>Cunning</span><span>Arcana</span></div>
        </div></section>
        <aside class="skill-atlas-sidebar ui-scroll-area"><div class="skill-atlas-inspection" id="skill-atlas-selection" aria-live="polite"></div>
          <section class="skill-atlas-loadout"><div class="skill-atlas-section-heading"><span class="ui-kicker">ACTIVE SKILLS</span><span class="ui-muted">5 slots</span></div><div class="skill-atlas-assignments"></div></section>
        </aside></div>
      <footer class="ui-window-footer skill-atlas-footer"><span><b>2,779</b> stars <i>·</i> <b>6</b> active skills <i>·</i> <b>3</b> paths</span><span>One skill point per level</span></footer>
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
    this.search.addEventListener('input', () => { this.updateResults(); this.invalidate(); }, opts);
    this.root.querySelector('select')!.addEventListener('change', event => {
      this.domain = (event.target as HTMLSelectElement).value as SkillDomain | 'all'; this.updateResults(); this.invalidate();
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
    this.shown = true; this.root.hidden = false; this.refresh(player); this.resize();
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
    if (button.dataset.node) { this.inspectNode(button.dataset.node); return; }
    if (button.dataset.assign) {
      const skill = SKILL_NODES.get(this.selected)?.skill;
      if (skill && this.allocated.has(this.selected)) this.actions.assign(Number(button.dataset.assign) - 1, skill);
      return;
    }
    if (button.dataset.clear) { this.actions.assign(Number(button.dataset.clear) - 1, null); return; }
    const action = button.dataset.tree;
    if (action === 'close') this.actions.close();
    else if (action === 'allocate') this.actions.allocate(this.selected);
    else if (action === 'origin') { this.centerX = 0; this.centerY = 0; this.setZoom(.82); this.inspectNode(SKILL_TREE_ORIGIN); }
    else if (action === 'in') this.setZoom(this.zoom * 1.25);
    else if (action === 'out') this.setZoom(this.zoom / 1.25);
    else if (action === 'reachable') {
      this.reachableOnly = !this.reachableOnly; button.setAttribute('aria-pressed', String(this.reachableOnly)); this.updateResults(); this.invalidate();
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
    const heading = node.kind === 'origin' ? 'YOUR ORIGIN' : node.kind === 'major' ? 'MAJOR · ACTIVE SKILL' : node.kind === 'notable' ? 'NOTABLE STAR' : 'MINOR STAR';
    const bonuses = (Object.entries(node.bonuses) as [StatKey, number][]).map(([key, value]) => `<div class="ui-stat"><span>${STAT_LABELS[key]}</span><b>${formatStatValue(key, value)}</b></div>`).join('');
    this.detail.innerHTML = `<div class="skill-atlas-emblem" style="--star-color:${COLORS[node.domain]}">${node.skill ? skillIconSVG(node.skill, 48) : '<span>✦</span>'}</div>
      <p class="ui-kicker">${heading}</p><h3>${escapeUI(node.name)}</h3><p class="skill-atlas-domain" style="color:${COLORS[node.domain]}">${node.kind === 'origin' ? 'Might · Cunning · Arcana' : node.domain}</p>
      <p class="skill-atlas-description">${escapeUI(node.description)}</p>${bonuses ? `<div class="skill-atlas-bonuses ui-well">${bonuses}</div>` : ''}
      ${skill ? `<div class="skill-atlas-skill-costs"><span><b>${skill.manaCost}</b> mana</span><span><b>${skill.cooldown}s</b> cooldown</span><span><b>${Math.round(skill.damageMultiplier * 100)}%</b> damage${node.skill === 'volley' ? ' / thorn' : ''}</span></div>` : ''}
      <div class="skill-atlas-allocation"><span class="skill-atlas-node-state ${owned ? 'is-owned' : ''}">${owned ? '◆ Allocated' : reachable ? '◇ Connected to your path' : '◇ Path not connected'}</span>
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
    const active = !!this.search.value.trim() || this.reachableOnly;
    this.results.hidden = !active;
    if (!active) return;
    const matches = SKILL_TREE.nodes.filter(node => this.matches(node)).sort((a, b) => {
      const state = (node: SkillNode) => this.allocated.has(node.id) ? 0 : this.reachable.has(node.id) ? 1 : 2;
      return state(a) - state(b) || (a.kind === 'major' ? -1 : b.kind === 'major' ? 1 : 0) || Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y);
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
  private clampCenter(): void { this.centerX = Math.max(-2600, Math.min(2600, this.centerX)); this.centerY = Math.max(-2350, Math.min(2350, this.centerY)); }
  private setZoom(value: number, x = this.width / 2, y = this.height / 2): void {
    const zoom = Math.max(.07, Math.min(2, value));
    this.centerX += (x - this.width / 2) * (1 / this.zoom - 1 / zoom);
    this.centerY += (y - this.height / 2) * (1 / this.zoom - 1 / zoom);
    this.zoom = zoom; this.clampCenter(); this.zoomLabel.textContent = `${Math.round(zoom * 100)}%`; this.invalidate();
  }
  private pick(clientX: number, clientY: number): SkillNode | undefined {
    const rect = this.canvas.getBoundingClientRect(), x = (clientX - rect.left - this.width / 2) / this.zoom + this.centerX, y = (clientY - rect.top - this.height / 2) / this.zoom + this.centerY;
    let selected: SkillNode | undefined, distance = Infinity;
    for (const node of SKILL_TREE.nodes) {
      if (!this.matches(node)) continue;
      const d = Math.hypot(node.x - x, node.y - y), radius = node.kind === 'major' || node.kind === 'origin' ? 24 : node.kind === 'notable' ? 13 : 8;
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
    const w = this.width, h = this.height, z = this.zoom;
    ctx.setTransform(this.canvas.width / w, 0, 0, this.canvas.height / h, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const field = ctx.createRadialGradient(w * .48, h * .48, 10, w / 2, h / 2, Math.max(w, h) * .7);
    field.addColorStop(0, '#13202a'); field.addColorStop(.6, '#0b141e'); field.addColorStop(1, '#080f16'); ctx.fillStyle = field; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 100; i++) {
      const x = ((i * 179 + 43) % 991) / 991 * w, y = ((i * 283 + 67) % 997) / 997 * h;
      ctx.fillStyle = i % 7 ? '#52687545' : '#98aabe78'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    const sx = (x: number) => (x - this.centerX) * z + w / 2, sy = (y: number) => (y - this.centerY) * z + h / 2;
    const ox = sx(0), oy = sy(0);
    ctx.strokeStyle = '#7d9aaa14'; ctx.lineWidth = 1;
    for (const radius of [120, 330, 570, 810, 1080, 1450, 1850, 2320]) {
      ctx.beginPath(); ctx.arc(ox, oy, radius * z, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([2, 8]);
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(i * Math.PI / 3) * 2700 * z, oy + Math.sin(i * Math.PI / 3) * 2700 * z); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const [a, b] of EDGE_NODES) {
      const ax = sx(a.x), ay = sy(a.y), bx = sx(b.x), by = sy(b.y);
      if (Math.max(ax, bx) < -20 || Math.min(ax, bx) > w + 20 || Math.max(ay, by) < -20 || Math.min(ay, by) > h + 20) continue;
      const owned = this.allocated.has(a.id) && this.allocated.has(b.id);
      const available = this.allocated.has(a.id) || this.allocated.has(b.id);
      const faded = !this.matches(a) && !this.matches(b);
      ctx.globalAlpha = faded ? .12 : 1;
      ctx.strokeStyle = owned ? '#c3b6eb' : available ? '#7c7e9c' : '#405563'; ctx.lineWidth = owned ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      if (owned) { ctx.strokeStyle = '#d1c1ff25'; ctx.lineWidth = 6; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    for (const node of SKILL_TREE.nodes) {
      const x = sx(node.x), y = sy(node.y);
      if (x < -80 || x > w + 80 || y < -45 || y > h + 45) continue;
      const owned = this.allocated.has(node.id), reachable = this.reachable.has(node.id), selected = this.selected === node.id, hover = this.hovered === node.id;
      const major = node.kind === 'major' || node.kind === 'origin';
      const radius = Math.max(1.7, (major ? 24 : node.kind === 'notable' ? 12 : 6) * z), color = COLORS[node.domain];
      ctx.globalAlpha = this.matches(node) ? 1 : .15;
      if ((major && z > .25) || selected || hover || owned) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.8);
        glow.addColorStop(0, owned ? '#b7a2e447' : `${color}28`); glow.addColorStop(1, `${color}00`);
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, radius * 2.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = owned ? '#625a82' : '#0b151f'; ctx.strokeStyle = owned ? '#e0d4ff' : reachable ? '#c2cad8' : major ? color : '#657381';
      ctx.lineWidth = owned || selected || hover ? 1.8 : 1;
      ctx.beginPath();
      if (node.kind === 'notable') { ctx.moveTo(x, y - radius); ctx.lineTo(x + radius, y); ctx.lineTo(x, y + radius); ctx.lineTo(x - radius, y); ctx.closePath(); }
      else ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      if (major && z > .26) {
        ctx.strokeStyle = `${color}95`; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(x, y, radius + 4 * z, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = owned ? '#ede6ff' : color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.max(11, 20 * z)}px ${UI_THEME.typography.font}`;
        ctx.fillText(node.kind === 'origin' ? '✦' : node.skill === 'volley' ? '↟' : node.skill === 'cleave' ? '☽' : node.skill === 'lunge' ? '↗' : node.skill === 'nova' ? '✧' : node.skill === 'ember' ? '♢' : '☾', x, y);
      } else if (owned && radius > 3) {
        ctx.fillStyle = '#e4d7fa'; ctx.beginPath(); ctx.arc(x, y, Math.max(1.2, radius * .35), 0, Math.PI * 2); ctx.fill();
      }
      if (selected || hover) {
        ctx.strokeStyle = selected ? '#ded4f5' : '#c0cdd7'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.arc(x, y, radius + 7, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      if (major && z >= .5) {
        ctx.font = `14px ${UI_THEME.typography.font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        const label = node.kind === 'origin' ? 'THE FIRST STAR' : node.name, textWidth = ctx.measureText(label).width;
        ctx.fillStyle = '#0a131ee8'; ctx.fillRect(x - textWidth / 2 - 6, y + radius + 9, textWidth + 12, 19);
        ctx.fillStyle = owned ? '#e7dcff' : '#c3c8d5'; ctx.fillText(label, x, y + radius + 11);
      }
    }
    ctx.globalAlpha = 1;
    if (this.hovered && this.hovered !== this.selected) {
      const node = SKILL_NODES.get(this.hovered)!;
      if (node.kind === 'minor' || node.kind === 'notable' || z < .5) {
        ctx.font = `14px ${UI_THEME.typography.font}`; const textWidth = ctx.measureText(node.name).width;
        const x = Math.min(w - textWidth - 16, Math.max(8, sx(node.x) - textWidth / 2)), y = Math.max(8, sy(node.y) - 35);
        ctx.fillStyle = '#111c29'; ctx.fillRect(x - 6, y - 4, textWidth + 12, 24); ctx.strokeStyle = '#7e7897'; ctx.strokeRect(x - 6, y - 4, textWidth + 12, 24);
        ctx.fillStyle = '#e5dfec'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(node.name, x, y);
      }
    }
  }
}
