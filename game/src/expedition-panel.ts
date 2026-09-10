import { EXPEDITION_MODIFIERS } from './expedition-modifiers.ts';
import type { Expeditions } from './dungeon-state.ts';
import type { DungeonAction } from './dungeon-command.ts';
import { newExpeditionRoute, EXPEDITION_RULES } from './expedition-route.ts';
import { expeditionMap, type ExpeditionMapNode } from './expedition-map.ts';
import { dungeonTheme } from './dungeon-content.ts';
import { escapeUI, trapDialogFocus } from './ui-components.ts';
import { ChestArt } from './chest-art.ts';
import { drawCryptGate } from './dungeon-art.ts';
import './expedition-panel.css';

export class ExpeditionPanel {
  readonly element: HTMLElement;
  private focus: { dispose(): void } | null = null;
  private abort = new AbortController();
  private action: ((choice: number) => DungeonAction) | null = null;
  private busy = false;
  private locked = false;
  private selected: ExpeditionMapNode | null = null;
  private nodes: ExpeditionMapNode[] = [];
  private resuming = false;
  private actions: { close(): void; enter(action: DungeonAction): Promise<boolean> };

  constructor(mount: HTMLElement, actions: ExpeditionPanel['actions']) {
    this.actions = actions;
    this.element = document.createElement('section');
    this.element.className = 'expedition-panel ui-window';
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', 'expedition-title');
    mount.append(this.element);
    const signal = this.abort.signal;
    this.element.addEventListener('click', async e => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button || this.busy) return;
      if (button.hasAttribute('data-close')) { this.actions.close(); return; }
      if (button.dataset.node) {
        const node = this.nodes.find(n => n.id === button.dataset.node)!;
        if (node.state === 'available' && !this.locked) { this.selected = node; this.updateSelection(); }
        this.showTip(button);
        return;
      }
      if (!this.action || (!button.hasAttribute('data-enter') && !button.hasAttribute('data-return'))) return;
      const choice = button.hasAttribute('data-return') ? -1 : this.selected?.choice;
      if (choice === undefined || this.locked) return;
      this.busy = true;
      this.hideTip();
      this.element.querySelectorAll('button').forEach(b => b.disabled = true);
      try {
        if (!await this.actions.enter(this.action(choice))) this.element.querySelector('[role=status]')!.textContent = 'Could not enter. Try again.';
      } catch {
        this.element.querySelector('[role=status]')!.textContent = 'Could not enter. Try again.';
      } finally {
        this.busy = false;
        this.element.querySelectorAll('button').forEach(b => b.disabled = false);
        this.updateSelection();
      }
    }, { signal });
    this.element.addEventListener('pointerover', e => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-node],[data-treasure],[data-rules]');
      if (target) this.showTip(target);
    }, { signal });
    this.element.addEventListener('pointerout', e => {
      const target = (e.target as HTMLElement).closest('[data-node],[data-treasure],[data-rules]');
      if (target && !target.contains(e.relatedTarget as Node | null)) this.hideTip();
    }, { signal });
    this.element.addEventListener('focusin', e => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-node],[data-treasure],[data-rules]');
      if (target) this.showTip(target); else this.hideTip();
    }, { signal });
    this.element.addEventListener('scroll', () => this.hideTip(), { signal, capture: true });
    window.addEventListener('resize', () => this.hideTip(), { signal });
  }

  open(state: Expeditions, level: number, worldSeed: number, tableId: string): void {
    const existing = state.route;
    const route = existing?.status === 'active' ? existing : newExpeditionRoute(worldSeed, level, (existing?.attempt ?? 0) + 1);
    this.locked = level < EXPEDITION_RULES.minimumLevel;
    this.resuming = route.choice !== null;
    const lastRun = existing && existing.status !== 'failed' ? state.runs.filter(r => r.entrance.expedition?.attempt === existing.attempt).at(-1) : undefined;
    this.action = choice => ({ ...(choice === -1 ? { resume: lastRun?.entrance.id } : {}), kind: 'expedition', tableId, choice, attempt: existing?.attempt ?? 0, restart: existing?.status === 'complete' });
    const stages = expeditionMap(route, state.runs);
    this.nodes = stages.flat();
    const available = this.nodes.filter(n => n.state === 'available');
    this.selected = available.length === 1 && !this.locked ? available[0] : null;
    this.element.hidden = false;
    const height = Math.max(500, 370 + route.cleared * 170);
    const paths = stages.slice(0, -1).map((from, i) => {
      const to = stages[i + 1];
      return to.map(b => {
        const a = from[0], middle = (a.y + b.y) / 2;
        return `<path d="M${a.x},${a.y} C${a.x},${middle} ${b.x},${middle} ${b.x},${b.y}" class="${b.state === 'available' ? 'is-next' : 'is-travelled'}"/>`;
      }).join('');
    }).join('');
    const first = stages[0][0];
    this.element.innerHTML = `<header class="ui-window-header"><h2 class="ui-title" id="expedition-title">Expeditions</h2><span class="expedition-progress">${existing?.status === 'complete' ? 'New route' : existing?.status === 'failed' ? 'New attempt' : `${route.cleared} / 10`}</span><button class="ui-button ui-button--icon" data-close aria-label="Close expeditions">×</button></header>
      <div class="expedition-chart-scroll ui-scroll-area"><div class="expedition-chart" style="height:${height}px" aria-label="Revealed expedition trail">
        <svg class="expedition-cartography" viewBox="0 0 600 ${height}" preserveAspectRatio="none" aria-hidden="true">
          <g class="expedition-contours"><path d="M-40 100Q80 10 130 90T270 140M410 70Q530 5 655 100M-40 120Q80 30 130 110T270 160M410 90Q530 25 655 120"/></g>
          <g class="expedition-paths">${paths}${stages[0].map(n=>`<path d="M${n.x},${n.y} C${n.x},${n.y + 85} 300,${n.y + 65} 300,${n.y + 125}" class="is-travelled"/>`).join('')}</g>
          <path class="expedition-departure" d="M300 ${first.y + 116}l9 9-9 9-9-9Z"/>
        </svg>
        ${this.nodes.map(n => {
          const theme = n.entry ? dungeonTheme(n.entry.seed, n.entry.theme) : null;
          return `<button class="expedition-node is-${n.state}" data-node="${n.id}" style="--map-x:${n.x / 6}%;--map-y:${n.y}px;--node-color:${theme?.accent ?? '#9cbba7'}" aria-label="${escapeUI(`Stage ${n.stage + 1} · ${theme?.name ?? 'Cleared'} · ${n.state}`)}" ${n.state === 'available' ? 'aria-current="step"' : ''}><span class="expedition-node-ground"></span>${n.entry ? `<canvas width="180" height="180" data-gate="${n.id}" aria-hidden="true"></canvas>` : '<span class="expedition-cleared-mark">✓</span>'}<span class="expedition-node-number">${n.state === 'cleared' ? '✓' : n.stage + 1}</span>${n.state === 'available' ? `<span class="expedition-node-name">${theme!.name}</span>` : ''}</button>`;
        }).join('')}
      </div></div>
      <footer class="ui-window-footer"><span role="status">${this.locked ? 'Unlocks at level 20' : existing?.status === 'complete' ? 'New route replaces uncollected loot.' : 'Choose your path'}</span>${route.cleared === 9 ? '<button class="expedition-treasure" data-treasure aria-label="Grand chest rewards"><canvas width="96" height="80" aria-hidden="true"></canvas></button>' : ''}<button class="expedition-rule ui-button ui-button--quiet" data-rules aria-label="Expedition rules">◇</button>${lastRun && route.choice === null ? '<button class="ui-button ui-button--quiet" data-return>Return for loot</button>' : ''}<button class="ui-button ui-button--primary expedition-enter" data-enter></button></footer>
      <div class="expedition-tooltip" id="expedition-tooltip" role="tooltip" hidden></div>`;
    this.element.querySelectorAll<HTMLCanvasElement>('[data-gate]').forEach(canvas => {
      const entry = this.nodes.find(n => n.id === canvas.dataset.gate)!.entry!;
      const c = canvas.getContext('2d')!;
      c.translate(90, 143); c.scale(.9, .9);
      drawCryptGate(c, { ...entry, x: 0, y: 0 }, 0);
    });
    this.updateSelection();
    const chest = this.element.querySelector<HTMLCanvasElement>('[data-treasure] canvas');
    if (chest) { const c = chest.getContext('2d')!; c.translate(48, 50); new ChestArt().draw(c, 'expedition-reward', 0, 0, false, 0, 0, true, true); }
    this.element.querySelector('.expedition-chart-scroll')!.scrollTop = 0;
    this.focus?.dispose();
    this.focus = trapDialogFocus(this.element, { initialFocus: this.element, restoreFocus: false });
  }

  private updateSelection(): void {
    this.element.querySelectorAll<HTMLElement>('[data-node]').forEach(el => {
      const selected = el.dataset.node === this.selected?.id;
      el.classList.toggle('is-selected', selected);
      el.setAttribute('aria-pressed', String(selected));
    });
    const button = this.element.querySelector<HTMLButtonElement>('[data-enter]');
    if (button) {
      button.disabled = this.busy || this.locked || !this.selected;
      button.textContent = this.selected ? `${this.resuming ? 'Resume' : 'Enter'} · ${this.selected.entry!.name}` : 'Select a dungeon';
    }
    const back = this.element.querySelector<HTMLButtonElement>('[data-return]');
    if (back) back.disabled = this.busy || this.locked;
  }

  private showTip(target: HTMLElement): void {
    if (this.busy) return;
    this.hideTip();
    const tip = this.element.querySelector<HTMLElement>('.expedition-tooltip')!;
    if (target.hasAttribute('data-rules')) {
      tip.innerHTML = '<strong>Ten dungeons. One life.</strong><p>Death resets the route. Collected loot stays yours.</p><p>Save or visit town anytime.</p>';
    } else if (target.hasAttribute('data-treasure')) {
      const r = EXPEDITION_RULES.grandRarity;
      tip.innerHTML = `<strong>Grand chest</strong><p>Clear dungeon 10 · ${EXPEDITION_RULES.grandRewards} rewards</p><div class="expedition-odds"><span>${r.epic}% Epic</span><span>${r.legendary}% Legendary</span><span>${r.rare}% Rare</span></div>`;
    } else {
      const node = this.nodes.find(n => n.id === target.dataset.node)!;
      if (!node.entry) tip.innerHTML = `<strong>Stage ${node.stage + 1} · Cleared</strong>`;
      else {
        const theme = dungeonTheme(node.entry.seed, node.entry.theme), mod = EXPEDITION_MODIFIERS[node.entry.expedition!.modifier];
        tip.style.setProperty('--tooltip-accent', theme.accent);
        tip.innerHTML = `<small>${node.state === 'available' ? this.locked ? 'Requires level 20' : 'Choose this path' : node.state === 'skipped' ? 'Path not taken' : 'Cleared'}</small><strong>${theme.name}</strong><div class="expedition-tip-level">Lv ${node.entry.level} <span>Boss ${node.entry.level + 3}</span></div><p class="expedition-tip-modifier">${mod.name}</p><p>${mod.description}</p><div class="expedition-tip-boss">${theme.bossName ?? 'Hollow Warden'}</div>`;
      }
    }
    tip.hidden = false;
    target.setAttribute('aria-describedby', 'expedition-tooltip');
    const panel = this.element.getBoundingClientRect(), anchor = target.getBoundingClientRect();
    const width = tip.offsetWidth, height = tip.offsetHeight;
    const left = Math.max(12, Math.min(panel.width - width - 12, anchor.left - panel.left + anchor.width / 2 - width / 2));
    const above = anchor.top - panel.top - height - 10;
    const top = above > 60 ? above : Math.min(panel.height - height - 65, anchor.bottom - panel.top + 8);
    tip.style.left = `${left}px`; tip.style.top = `${Math.max(60, top)}px`;
  }

  private hideTip(): void {
    const tip = this.element.querySelector<HTMLElement>('.expedition-tooltip');
    if (tip) { tip.hidden = true; tip.style.removeProperty('--tooltip-accent'); }
    this.element.querySelectorAll('[aria-describedby="expedition-tooltip"]').forEach(el => el.removeAttribute('aria-describedby'));
  }
  close(): void { this.hideTip(); this.focus?.dispose(); this.focus = null; this.element.hidden = true; this.action = null; }
  dispose(): void { this.close(); this.abort.abort(); this.element.remove(); }
}
