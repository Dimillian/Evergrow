import { PORTAL_RULES } from './travel.ts';
import { TouchInput, type TouchAction } from './touch-input.ts';
import { touchTargeting } from './touch-targeting.ts';
import { resolveSkill } from './skill-progression.ts';
import { canUseSkill, SKILL_DEFINITIONS, skillIconSVG } from './skill-content.ts';
import { basicAttackManaCost } from './equipment.ts';
import { uiIcon } from './ui-components.ts';
import type { Player } from './model.ts';
import type { GamePhase } from './game-phase.ts';
import './touch-ui.css';

type MenuAction = 'pause' | 'character' | 'skills' | 'journeys' | 'map' | 'portal' | 'interact' ;
export class TouchHUD {
  readonly input = new TouchInput();
  readonly element: HTMLElement;
  active = false;
  private enabled = false;
  private player: Player | null = null;
  private abort = new AbortController();
  private captured = new Map<number, HTMLElement>();
  private icons = new Map<number, string | null>();
  private cancel: HTMLElement;
  private stick: HTMLElement;
  private aimStick: HTMLElement;
  private nextUpdate = 0;
  private mount: HTMLElement;
  private actions: { clearAttack(): void; cancelCombat(): void; activate(active: boolean): void; menu(action: MenuAction): void; unlock(): void; notice(message: string): void };
  constructor(mount: HTMLElement, actions: TouchHUD['actions'], options: {forceTouch?: boolean} = {}) {
    this.mount = mount; this.actions = actions;
    this.element = document.createElement('div'); this.element.className = 'touch-hud'; this.element.hidden = true;
    const button = (action: string, label: string, icon: string) => `<button type="button" class="touch-button" data-touch-menu="${action}" aria-label="${label}">${icon}${action==='interact' || action==='portal' ? `<small>${action==='interact'?'Interact':'Portal'}</small>` : ''}</button>`;
    this.element.innerHTML = `<nav class="touch-menu" aria-label="Game menus">${button('character','Character and inventory',uiIcon('character'))}${button('skills','Skill tree',uiIcon('skilltree'))}${button('journeys','Journeys',uiIcon('journal'))}${button('map','Map',uiIcon('map'))}${button('pause','Pause','Ⅱ')}</nav>
      <div class="touch-resources"><div class="touch-life" role="meter" aria-label="Life" aria-valuemin="0"><span></span></div><div class="touch-mana" role="meter" aria-label="Mana" aria-valuemin="0"><span></span></div></div>
      <div class="touch-move" data-touch-action="move" role="group" aria-label="Movement stick"><i></i></div>
      <div class="touch-actions">${Array.from({length:5},(_,i)=>`<button class="touch-button touch-skill" data-touch-action="skill-${i}" aria-label="Empty skill ${i+1}"><span class="touch-icon"></span><small></small></button>`).join('')}
      <button class="touch-button touch-attack" data-touch-action="attack" aria-label="Aim stick: drag to face and attack in any direction"><span class="touch-aim-knob">${uiIcon('sword')}</span></button>
      <button class="touch-button touch-potion" data-touch-action="heal" aria-label="Potion">${uiIcon('potion')}<small></small></button>
      <button class="touch-button touch-dodge" data-touch-action="dodge" aria-label="Dodge">${uiIcon('dodge')}<small></small></button></div>
      <div class="touch-world-actions">${button('interact','Interact','✦')}${button('portal','Town portal',uiIcon('portal'))}</div>
      <div class="touch-cancel" hidden>Cancel</div>`;
    mount.append(this.element);
    for(const menu of ['character','skills']) {
      const badge=document.createElement('span');badge.className='touch-point-badge';badge.hidden=true;
      this.element.querySelector(`[data-touch-menu="${menu}"]`)!.append(badge);
    }
    this.cancel = this.element.querySelector('.touch-cancel')!; this.stick = this.element.querySelector('.touch-move i')!;
    this.aimStick = this.element.querySelector('.touch-aim-knob')!;
    const signal = this.abort.signal;
    mount.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') { this.setActive(true); this.actions.unlock(); }
      else if (e.pointerType !== 'touch' && e.isTrusted && !options.forceTouch) this.setActive(false);
    }, { signal, capture: true });
    this.element.addEventListener('pointerdown', e => {
      const target = (e.target as Element).closest<HTMLElement>('[data-touch-action]');
      if (!target || !this.enabled || e.pointerType !== 'touch') return;
      e.preventDefault(); e.stopPropagation();
      const action = target.dataset.touchAction as TouchAction;
      const slot = action.startsWith('skill-') ? Number(action.slice(6)) : -1;
      const id = this.player?.character.skillSlots[slot];
      if (slot >= 0 && (!id || !this.player)) return;
      if (id && this.player && !canUseSkill(id, this.player.equipment)) { this.actions.notice('Equip a compatible weapon to use this skill.'); return; }
      if(id && this.player) {
        const cooldown=this.player.skillCooldowns[id]??0, cost=resolveSkill(id,this.player.derived,this.player.character).mana;
        if(cooldown>0 || this.player.mana<cost) { this.actions.notice(cooldown>0?'Skill is recharging.':'Not enough mana.'); return; }
      }
      const targeting = id && this.player ? touchTargeting(resolveSkill(id, this.player.derived, this.player.character).recipe) : 'direction';
      const bounds = target.getBoundingClientRect();
      const origin = action === 'attack' ? {x:bounds.left + bounds.width / 2,y:bounds.top + bounds.height / 2} : {x:e.clientX,y:e.clientY};
      if (this.input.down(e.pointerId, action, origin, targeting)) {
        this.input.update(e.pointerId, {x:e.clientX,y:e.clientY});
        this.updateSticks();
        target.setPointerCapture(e.pointerId); this.captured.set(e.pointerId,target); target.classList.add('is-held');
        if(slot>=0) this.cancel.hidden = false;
      }
    }, {signal});
    this.element.addEventListener('pointermove', e => {
      if (!this.captured.has(e.pointerId)) return;
      e.preventDefault();
      const r = this.cancel.getBoundingClientRect();
      const outside = e.clientX<0 || e.clientY<0 || e.clientX>window.innerWidth || e.clientY>window.innerHeight;
      const cancel = outside || !this.cancel.hidden && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      this.input.update(e.pointerId,{x:e.clientX,y:e.clientY},cancel);
      this.cancel.classList.toggle('is-held',!!this.input.preview?.canceled);
      this.updateSticks();
    }, {signal});
    const release = (e: PointerEvent, canceled: boolean) => {
      const target = this.captured.get(e.pointerId); if(!target) return;
      const action = target.dataset.touchAction;
      const r = this.cancel.getBoundingClientRect();
      const outside = e.clientX<0 || e.clientY<0 || e.clientX>window.innerWidth || e.clientY>window.innerHeight;
      const overCancel = !this.cancel.hidden && e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom;
      if(!canceled) this.input.update(e.pointerId,{x:e.clientX,y:e.clientY},outside||overCancel);
      if(action==='attack') this.actions.clearAttack();
      if(canceled && action?.startsWith('skill-')) this.actions.cancelCombat();
      this.input.up(e.pointerId,canceled); this.captured.delete(e.pointerId); target.classList.remove('is-held');
      if(target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
      this.cancel.hidden = !this.input.preview; this.updateSticks();
    };
    this.element.addEventListener('pointerup',e=>release(e,false),{signal});
    this.element.addEventListener('pointercancel',e=>release(e,true),{signal});
    this.element.addEventListener('lostpointercapture',e=>release(e,true),{signal});
    this.element.addEventListener('click', e=> {
      const action = (e.target as Element).closest<HTMLElement>('[data-touch-menu]')?.dataset.touchMenu as MenuAction;
      if(action && this.enabled) { this.clear(); this.actions.menu(action); }
    },{signal});
    this.setActive(options.forceTouch || matchMedia('(pointer: coarse)').matches);
  }
  private updateSticks() {
    this.stick.style.transform = `translate(${this.input.move.x*28}px,${this.input.move.y*28}px)`;
    this.aimStick.style.transform = `translate(${this.input.attackStick.x*18}px,${this.input.attackStick.y*18}px)`;
  }
  get safeTop(): number { return parseFloat(getComputedStyle(this.element).paddingTop) || 0; }
  setActive(active: boolean) {
    if(this.active === active) return;
    this.clear(); this.active = active; this.mount.classList.toggle('touch-mode',active);
    document.documentElement.classList.toggle('touch-mode',active);
    this.mount.dispatchEvent(new CustomEvent('evergrow-input-mode',{bubbles:true,detail:{touch:active}})); this.actions.activate(active);
    this.element.hidden = !active || !this.enabled;
  }
  clear() {
    this.input.clear(); const contacts = [...this.captured]; this.captured.clear();
    for(const [id,target] of contacts) { target.classList.remove('is-held'); if(target.hasPointerCapture(id)) target.releasePointerCapture(id); }
    this.cancel.hidden = true; this.updateSticks();
  }
  update(player: Player, phase: GamePhase, busy: boolean, now: number) {
    this.player = player;
    const enabled = phase === 'playing' && !busy && !player.dead;
    if(enabled !== this.enabled) { this.clear(); this.enabled = enabled; }
    const hidden = !this.active || !enabled;
    if(this.element.hidden !== hidden) this.element.hidden = hidden;
    if(!this.active || !enabled || now < this.nextUpdate) return;
    this.nextUpdate = now+75;
    for(const [kind,value,max] of [['life',player.hp,player.maxHp],['mana',player.mana,player.maxMana]] as const) {
      const el = this.element.querySelector<HTMLElement>(`.touch-${kind}`)!;
      el.setAttribute('aria-valuenow',String(Math.ceil(value))); el.setAttribute('aria-valuemax',String(max));
      el.querySelector('span')!.textContent = `${Math.ceil(value)} / ${max}`;
    }
    for(const [menu,points] of [['character',player.character.statPoints],['skills',player.character.skillPoints]] as const) {
      const badge=this.element.querySelector<HTMLElement>(`[data-touch-menu="${menu}"] .touch-point-badge`)!;
      badge.hidden=points===0;badge.textContent=points>99?'99+':String(points);
    }
    for(let i=0;i<5;i++) {
      const id = player.character.skillSlots[i], el = this.element.querySelector<HTMLButtonElement>(`[data-touch-action="skill-${i}"]`)!;
      if(this.icons.get(i)!==id) { el.querySelector('.touch-icon')!.innerHTML = id ? skillIconSVG(id,29) : ''; this.icons.set(i,id); }
      const cooldown = id ? player.skillCooldowns[id]??0 : 0;
      const cost = id ? resolveSkill(id,player.derived,player.character).mana : 0;
      el.classList.toggle('is-unavailable',!id || cooldown>0 || player.mana<cost || !canUseSkill(id,player.equipment));
      el.setAttribute('aria-label',id ? `${SKILL_DEFINITIONS[id].name}${cooldown>0?`, ${cooldown.toFixed(1)} seconds`:player.mana<cost?', Not enough mana':''}` : `Empty skill ${i+1}`);
      el.querySelector('small')!.textContent = cooldown>0 ? cooldown.toFixed(1) : id ? `${i+1} · ${cost}` : '—';
    }
    this.element.querySelector('.touch-potion small')!.textContent = player.healCooldown>0 ? player.healCooldown.toFixed(1) : String(player.flasks);
    this.element.querySelector('.touch-potion')!.classList.toggle('is-unavailable',player.flasks===0||player.healCooldown>0||(player.hp>=player.maxHp&&player.mana>=player.maxMana));
    this.element.querySelector('.touch-dodge small')!.textContent = String(player.dodgeCharges);
    this.element.querySelector('.touch-dodge')!.classList.toggle('is-unavailable',player.dodgeCharges===0);
    this.element.querySelector('.touch-attack')!.classList.toggle('is-unavailable',player.mana<basicAttackManaCost(player.equipment.mainHand,player.derived));
  }
  setPortal(progress: number | null, returning: boolean) {
    if(!this.active) return;
    const el=this.element.querySelector<HTMLButtonElement>('[data-touch-menu="portal"]')!;
    const label=progress!==null ? `Cancel portal · ${(PORTAL_RULES.channel*(1-progress)).toFixed(1)} seconds` : returning ? 'Locate return portal' : 'Town portal';
    if(el.getAttribute('aria-label')!==label) el.setAttribute('aria-label',label);
    el.querySelector('small')!.textContent=progress!==null ? 'Cancel' : returning ? 'Return' : 'Portal';
    el.classList.toggle('is-held',progress!==null);
  }
  dispose() { this.clear(); this.abort.abort(); this.element.remove(); this.mount.classList.remove('touch-mode'); document.documentElement.classList.remove('touch-mode'); }
}
