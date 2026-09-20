import type { Player } from './model.ts';
import type { Attribute } from './character-types.ts';
import { characterStatDetails, type StatDetail } from './character-stat-details.ts';
import { drawCharacterPortrait } from './character-portrait.ts';
import { xpForNextLevel } from './progression.ts';
import { RetainedTooltip } from './retained-tooltip.ts';
import { UITooltipStack } from './ui-tooltip-stack.ts';
import { effectExplanation } from './effect-terms.ts';
import { characterStatTooltip } from './character-stat-tooltip.ts';
import { GamepadMenu } from './gamepad-menu.ts';
import type { GamepadInput } from './gamepad-input.ts';
import { directionalControl } from './ui-navigation.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import './inventory-panel.css';
import './character-panel.css';

export interface CharacterPanelActions {
  close(): void;
  openInventory(): void;
  openSkills(): void;
  openChronicle?(): void;
  allocate(attribute: Attribute): void;
}
const ATTRIBUTES: Record<Attribute, { name: string; description: string }> = {
  strength: { name: 'Strength', description: 'Physical attack damage' },
  dexterity: { name: 'Dexterity', description: 'Attack speed & critical chance' },
  intelligence: { name: 'Intelligence', description: 'Spell & elemental damage, mana' },
  vitality: { name: 'Vitality', description: 'Maximum life' },
};
const CATEGORIES = ['Offense', 'Defense', 'Resources'] as const;
type Category = typeof CATEGORIES[number];
const TONES: Record<Category, readonly string[]> = {
  Offense: ['offense', 'skills'], Defense: ['defense', 'resistances'], Resources: ['resources', 'utility'],
};
const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 });

/** Build inspection and allocation; inventory owns equipment and bag interactions. */
export class CharacterPanel {
  readonly element: HTMLDivElement;
  private readonly window: HTMLElement;
  private readonly body: HTMLElement;
  private readonly lifetime = new AbortController();
  private readonly tooltip: RetainedTooltip;
  private readonly explanations: UITooltipStack;
  private readonly controller = new GamepadMenu();
  private readonly observer: ResizeObserver;
  private readonly details = new Map<string, StatDetail>();
  private focus: ReturnType<typeof trapDialogFocus> | null = null;
  private player: Player | null = null;
  private category: Category = 'Offense';
  private name = '';

  constructor(mount: HTMLElement, actions: CharacterPanelActions) {
    this.element = document.createElement('div');
    this.element.className = 'character-overlay character-sheet-overlay'; this.element.hidden = true;
    this.element.innerHTML = `<section class="ui-window character-window character-sheet" role="dialog" aria-modal="true" aria-labelledby="character-sheet-title">
      <header class="ui-window-header character-header"><div class="character-heading"><span class="character-sigil ui-header-emblem" aria-hidden="true">${uiIcon('character')}</span><h2 class="ui-title" id="character-sheet-title">Character</h2></div><button type="button" class="ui-button ui-button--icon" data-close aria-label="Close character">${uiIcon('close')}</button></header>
      <div class="character-sheet-body ui-scroll-area">
        <div class="character-sheet-identity"><canvas width="160" height="192" aria-label="Your equipped character"></canvas><div><h3 data-name></h3><span data-weapon></span></div><div class="character-sheet-level"><span>Level</span><strong data-level></strong></div></div>
        <div class="character-experience"><div><span data-xp-label></span><span data-xp-total></span></div><div class="character-experience-track" role="progressbar" aria-label="Experience to next level" aria-valuemin="0" aria-valuemax="100"><i data-xp-fill></i></div></div>
        <div class="character-section-title"><h3>Attributes</h3><span class="character-points-available" data-points-label></span></div>
        <div class="character-attribute-list">${(Object.entries(ATTRIBUTES) as [Attribute, typeof ATTRIBUTES[Attribute]][]).map(([id, a]) => `<div class="character-attribute"><div tabindex="0" data-stat-detail="${id}"><span>${a.name}</span><small>${a.description}</small></div><strong data-attribute-value="${id}"></strong><button type="button" class="ui-button ui-button--icon character-attribute-add" data-allocate="${id}" aria-label="Increase ${a.name}">${uiIcon('plus')}</button></div>`).join('')}</div>
        <nav class="character-stat-tabs" role="tablist" aria-label="Combat details">${CATEGORIES.map((category, i) => `<button type="button" class="ui-button ui-button--quiet" role="tab" id="character-stat-tab-${category}" data-category="${category}" aria-controls="character-stat-page" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${category}</button>`).join('')}</nav>
        <div id="character-stat-page" class="character-statistics" role="tabpanel" aria-labelledby="character-stat-tab-Offense"></div>
      </div>
      <footer class="ui-window-footer character-sheet-footer"><div class="character-sheet-links"><button type="button" class="ui-button ui-button--quiet" data-skills>${uiIcon('skilltree')}<span>Skill atlas</span><span class="character-skill-points-badge" data-skill-points-badge aria-hidden="true" hidden></span></button>${actions.openChronicle ? '<button type="button" class="ui-button ui-button--quiet" data-chronicle>Chronicle</button>' : ''}</div><button type="button" class="ui-button ui-button--quiet" data-inventory>${uiIcon('inventory')}Inventory</button></footer>
    </section>`;
    this.window = this.element.querySelector('.character-sheet')!;
    this.body = this.element.querySelector('.character-sheet-body')!;
    this.tooltip = new RetainedTooltip(this.window, 'character-sheet-stat-tooltip', 'character-stat-tooltip');
    this.explanations = new UITooltipStack(this.window, effectExplanation, this.window, anchor => !anchor.closest('.ui-tooltip'));
    mount.append(this.element);
    const options = { signal: this.lifetime.signal };
    this.element.querySelector('[data-close]')!.addEventListener('click', actions.close, options);
    this.element.querySelector('[data-inventory]')!.addEventListener('click', actions.openInventory, options);
    this.element.querySelector('[data-skills]')!.addEventListener('click', actions.openSkills, options);
    this.element.querySelector('[data-chronicle]')?.addEventListener('click', () => actions.openChronicle?.(), options);
    this.element.addEventListener('click', event => {
      const target = event.target as Element;
      const attribute = target.closest<HTMLElement>('[data-allocate]')?.dataset.allocate;
      if (attribute && Object.hasOwn(ATTRIBUTES, attribute)) actions.allocate(attribute as Attribute);
      const category = target.closest<HTMLElement>('[data-category]')?.dataset.category as Category | undefined;
      if (category) this.selectCategory(category);
      if (document.documentElement.classList.contains('touch-mode')) this.showDetail(target);
    }, options);
    this.element.addEventListener('pointerdown', () => this.element.classList.remove('is-controller'), options);
    this.element.addEventListener('pointerover', event => { if (event.pointerType !== 'touch') this.showDetail(event.target); }, options);
    this.element.addEventListener('focusin', event => this.showDetail(event.target), options);
    this.element.addEventListener('pointerout', event => {
      const anchor = (event.target as Element).closest('[data-stat-detail]');
      if (anchor && !anchor.contains(event.relatedTarget as Node | null) && !this.tooltip.element.contains(event.relatedTarget as Node | null)) this.tooltip.defer();
    }, options);
    this.element.addEventListener('focusout', () => this.tooltip.defer(), options);
    this.body.addEventListener('scroll', () => { this.tooltip.hide(); this.explanations.hide(); this.updateFade(); }, options);
    this.element.addEventListener('keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      const tab = target.closest<HTMLElement>('[data-category]');
      if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const current = CATEGORIES.indexOf(this.category);
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (current + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
        this.selectCategory(CATEGORIES[index], true); return;
      }
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const controls = [...this.window.querySelectorAll<HTMLElement>('button, [tabindex]')].filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[hidden], [inert]') && el.getClientRects().length > 0);
      const current = controls.indexOf(target);
      if (current < 0) return;
      event.preventDefault();
      const next = directionalControl(controls.map(el => el.getBoundingClientRect()), current, event.key);
      if (next === current) this.body.scrollBy({ top: event.key === 'ArrowDown' ? 90 : event.key === 'ArrowUp' ? -90 : 0 });
      else { controls[next].focus({ preventScroll: true }); controls[next].scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    }, options);
    this.observer = new ResizeObserver(() => this.updateFade()); this.observer.observe(this.body);
  }

  open(player: Player, name: string): void {
    const wasOpen = !this.element.hidden;
    this.name = name; this.element.hidden = false; this.refresh(player);
    if (!wasOpen) this.focus = trapDialogFocus(this.window, { signal: this.lifetime.signal, restoreFocus: false, initialFocus: () => this.window.querySelector<HTMLButtonElement>('[data-close]') });
  }
  refresh(player: Player): void {
    this.player = player;
    if (this.element.hidden) return;
    const text = (selector: string, value: string) => { this.element.querySelector(selector)!.textContent = value; };
    text('[data-name]', this.name); text('[data-level]', number(player.level));
    text('[data-weapon]', [player.character.equipped.weapon?.name ?? 'Unarmed', player.character.equipped.offhand?.name].filter(Boolean).join(' · '));
    text('[data-xp-label]', `Level ${number(player.level)} → ${number(player.level + 1)}`);
    text('[data-xp-total]', `${number(player.xp)} / ${number(xpForNextLevel(player.level))} XP`);
    const percent = Math.min(100, 100 * player.xp / xpForNextLevel(player.level));
    this.element.querySelector<HTMLElement>('[data-xp-fill]')!.style.width = `${percent}%`;
    this.element.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', String(percent));
    text('[data-points-label]', player.character.statPoints ? `${number(player.character.statPoints)} points available` : 'All assigned');
    const skillPoints = player.character.skillPoints;
    const skillBadge = this.element.querySelector<HTMLElement>('[data-skill-points-badge]')!;
    skillBadge.hidden = skillPoints <= 0;
    skillBadge.textContent = number(skillPoints);
    this.element.querySelector('[data-skills]')!.setAttribute('aria-label', skillPoints > 0
      ? `Skill atlas, ${number(skillPoints)} skill ${skillPoints === 1 ? 'point' : 'points'} available` : 'Skill atlas');
    for (const id of Object.keys(ATTRIBUTES) as Attribute[]) {
      text(`[data-attribute-value="${id}"]`, number(player.derived.attributes[id]));
      const button = this.element.querySelector<HTMLButtonElement>(`[data-allocate="${id}"]`)!;
      button.disabled = player.character.statPoints <= 0;
      if (button.disabled && document.activeElement === button) button.closest('.character-attribute')?.querySelector<HTMLElement>('[data-stat-detail]')?.focus({ preventScroll: true });
      button.dataset.tooltip = `Spend 1 attribute point on ${ATTRIBUTES[id].name}`;
    }
    this.renderStats();
    const canvas = this.element.querySelector('canvas')!; const context = canvas.getContext('2d');
    if (context) drawCharacterPortrait(context, player, 3, Math.PI / 2, canvas.width, canvas.height);
    this.updateFade();
  }
  private selectCategory(category: Category, focus = false): void {
    this.category = category; this.tooltip.hide(); this.explanations.hide(); this.renderStats();
    for (const tab of this.element.querySelectorAll<HTMLButtonElement>('[data-category]')) {
      const active = tab.dataset.category === category; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
      if (active && focus) { tab.focus({ preventScroll: true }); tab.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    }
    this.updateFade();
  }
  private renderStats(): void {
    if (!this.player) return;
    const groups = characterStatDetails(this.player);
    this.details.clear(); for (const group of groups) for (const row of group.rows) this.details.set(row.id, row);
    const content = groups.filter(group => TONES[this.category].includes(group.tone)).map(group => `<section class="character-stat-group character-stat-group--${group.tone}" aria-labelledby="sheet-${group.tone}"><h4 id="sheet-${group.tone}">${escapeUI(group.title)}</h4><dl>${group.rows.map(row => `<div class="ui-stat" tabindex="0" data-stat-detail="${escapeUI(row.id)}"><dt class="ui-stat-label">${escapeUI(row.label)}</dt><dd class="ui-stat-value">${escapeUI(row.value)}</dd></div>`).join('')}</dl></section>`).join('');
    const page = this.element.querySelector('#character-stat-page')!;
    page.setAttribute('aria-labelledby', `character-stat-tab-${this.category}`);
    if (page.innerHTML !== content) { this.tooltip.hide(); page.innerHTML = content; }
  }
  private showDetail(target: EventTarget | null): void {
    const anchor = target instanceof Element ? target.closest<HTMLElement>('[data-stat-detail]') : null;
    const detail = anchor && this.details.get(anchor.dataset.statDetail!);
    if (!anchor || !detail) return;
    this.explanations.hide();
    this.tooltip.show(characterStatTooltip(detail), anchor);
  }
  private updateFade(): void { this.body.classList.toggle('has-scroll-below', this.body.scrollHeight - this.body.clientHeight - this.body.scrollTop > 2); }
  updateGamepad(pad: GamepadInput, now: number): void {
    if (this.element.hidden) return;
    if (!pad.active) { this.controller.clear(); return; }
    this.element.classList.add('is-controller');
    this.controller.update(this.window, pad, now, { switchTab: delta => this.selectCategory(CATEGORIES[(CATEGORIES.indexOf(this.category) + delta + 3) % 3], true) });
  }
  close(): void { this.focus?.dispose(); this.focus = null; this.tooltip.hide(); this.explanations.hide(); this.element.hidden = true; this.element.classList.remove('is-controller'); this.controller.clear(); }
  dispose(): void { this.close(); this.observer.disconnect(); this.tooltip.dispose(); this.explanations.dispose(); this.lifetime.abort(); this.element.remove(); this.player = null; }
}
