import type { Player } from './model.ts';
import type { ActionResult, SkillId } from './character-types.ts';
import { assignableSkills } from './skill-assignment.ts';
import { SKILL_DEFINITIONS, skillIconSVG } from './skill-content.ts';
import { resolveSkill } from './skill-progression.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { HUD_SKILL_SLOTS } from './hud-layout.ts';
import './skill-assignment-panel.css';

/** Anchored assignment list; all input routes commit through the same command. */
export class SkillAssignmentPanel {
  readonly element: HTMLElement;
  private focus: ReturnType<typeof trapDialogFocus> | null = null;
  private readonly abort = new AbortController();
  private slot = 0;
  private busy = false;
  private player!: Player;
  private anchor!: { left: number; top: number; width: number; height: number };
  private viewport = { width: 1, height: 1 };
  private readonly actions: {
    close(): void; atlas(): void; assign(slot: number, skill: SkillId): Promise<ActionResult>;
  };
  constructor(mount: HTMLElement, actions: SkillAssignmentPanel['actions']) {
    this.actions = actions;
    this.element = document.createElement('div'); this.element.className = 'skill-assignment-layer'; this.element.hidden = true;
    mount.append(this.element);
    this.element.addEventListener('click', event => {
      if (this.busy) return;
      const target = event.target as Element;
      if (target === this.element || target.closest('[data-picker-close]')) { this.actions.close(); return; }
      if (target.closest('[data-picker-atlas]')) { this.actions.atlas(); return; }
      const skill = target.closest<HTMLElement>('[data-assign-skill]')?.dataset.assignSkill as SkillId | undefined;
      if (skill) void this.assign(skill);
    }, { signal: this.abort.signal });
    window.addEventListener('resize', () => {
      if (this.element.hidden) return;
      const width = window.innerWidth, height = window.innerHeight;
      this.anchor = { ...this.anchor, left: this.anchor.left / this.viewport.width * width, top: this.anchor.top / this.viewport.height * height };
      this.viewport = { width, height }; this.position();
    }, { signal: this.abort.signal });
  }
  open(player: Player, slot: number, anchor: SkillAssignmentPanel['anchor']): void {
    this.player = player; this.slot = slot; this.anchor = anchor; this.viewport = { width: window.innerWidth, height: window.innerHeight }; this.element.hidden = false; this.render();
  }
  refresh(player: Player): void { this.player = player; if (!this.element.hidden && !this.busy) this.render(); }
  private render(): void {
    this.focus?.dispose();
    const skills = assignableSkills(this.player), off = this.player.character.equipped.offhand;
    const equipment = `${this.player.character.equipped.weapon?.name ?? 'Unarmed'}${off ? ` + ${off.name}` : ''}`;
    this.element.innerHTML = `<section class="skill-assignment ui-well" role="dialog" aria-modal="true" aria-labelledby="skill-assignment-title">
      <header><h3 id="skill-assignment-title">Assign skill · ${HUD_SKILL_SLOTS[this.slot + 1].key}</h3><button class="ui-button ui-button--quiet ui-button--icon" data-picker-close aria-label="Close skill picker">${uiIcon('close')}</button></header>
      <p class="skill-assignment-equipment">${escapeUI(equipment)}</p>
      <div class="skill-assignment-list ui-scroll-area">${skills.map(id => {
        const skill = resolveSkill(id, this.player.derived, this.player.character), definition = SKILL_DEFINITIONS[id];
        return `<button type="button" class="ui-button ui-button--quiet skill-assignment-choice" data-assign-skill="${id}" aria-label="Assign ${definition.name}, ${skill.mana} mana${skill.cooldown ? `, ${skill.cooldown} second cooldown` : ''}"><span class="skill-assignment-icon" style="color:${definition.color}">${skillIconSVG(id, 30)}</span><span>${definition.name}</span><small>${skill.mana} mana${skill.cooldown ? ` · ${Number(skill.cooldown.toFixed(1))}s` : ''}</small></button>`;
      }).join('') || '<p class="skill-assignment-empty">No unlocked, unassigned skills match your equipment.</p><button class="ui-button" data-picker-atlas>Open skill atlas</button>'}</div>
      <p class="skill-assignment-message" role="status"></p><footer><span>A Assign</span><span>B Back</span></footer></section>`;
    this.position();
    this.focus = trapDialogFocus(this.element, { restoreFocus: false,
      initialFocus: () => this.element.querySelector<HTMLElement>('[data-assign-skill], [data-picker-atlas]') });
  }
  private position(): void {
    const panel = this.element.firstElementChild as HTMLElement, bounds = this.element.getBoundingClientRect();
    panel.style.left = `${Math.max(12, Math.min(this.anchor.left + this.anchor.width / 2 - bounds.left - panel.offsetWidth / 2, bounds.width - panel.offsetWidth - 12))}px`;
    panel.style.top = `${Math.max(12, Math.min(this.anchor.top - bounds.top - panel.offsetHeight - 8, bounds.height - panel.offsetHeight - 12))}px`;
  }
  private async assign(skill: SkillId): Promise<void> {
    this.busy = true;
    for (const button of this.element.querySelectorAll<HTMLButtonElement>('button')) button.disabled = true;
    this.element.querySelector('[role="status"]')!.textContent = 'Saving…';
    let result: ActionResult;
    try { result = await this.actions.assign(this.slot, skill); }
    catch { result = { ok: false, message: 'Could not save the skill assignment.' }; }
    finally { this.busy = false; }
    if (this.element.hidden) return;
    if (result.ok) this.actions.close();
    else { this.render(); this.element.querySelector('[role="status"]')!.textContent = result.message ?? 'Could not assign this skill.'; }
  }
  close(): void { this.focus?.dispose(); this.focus = null; this.element.hidden = true; }
  dispose(): void { this.close(); this.abort.abort(); this.element.remove(); }
}
